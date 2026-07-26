const MAX_FILE_SIZE_BYTES = 150 * 1024 * 1024;
const MIN_SELECTION_SECONDS = 0.05;
const WAVEFORM_STEP_SECONDS = 1;
const WAVEFORM_FAST_STEP_SECONDS = 5;

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "mp3-editor") {
    initializeMp3EditorPage();
  }
});

function initializeMp3EditorPage() {
  const panel = document.querySelector("[data-audio-editor]");

  if (!panel) {
    return;
  }

  const elements = {
    panel,
    input: panel.querySelector('input[type="file"]'),
    dropzone: panel.querySelector('[data-role="dropzone"]'),
    status: panel.querySelector('[data-role="status"]'),
    fileName: panel.querySelector('[data-role="file-name"]'),
    fileMeta: panel.querySelector('[data-role="file-meta"]'),
    selectionMeta: panel.querySelector('[data-role="selection-meta"]'),
    waveform: panel.querySelector('[data-role="waveform"]'),
    waveOverlay: panel.querySelector('[data-role="wave-overlay"]'),
    waveEmpty: panel.querySelector('[data-role="wave-empty"]'),
    playheadMarker: panel.querySelector('[data-role="playhead-marker"]'),
    playheadOriginMarker: panel.querySelector('[data-role="playhead-origin-marker"]'),
    playheadPreviewMarker: panel.querySelector('[data-role="playhead-preview-marker"]'),
    playheadPreviewLabel: panel.querySelector('[data-role="playhead-preview-label"]'),
    playheadLabel: panel.querySelector('[data-role="playhead-label"]'),
    durationLabel: panel.querySelector('[data-role="duration-label"]'),
    playButton: panel.querySelector('[data-action="play"]'),
    stopButton: panel.querySelector('[data-action="stop"]'),
    setStartButton: panel.querySelector('[data-action="set-start"]'),
    setEndButton: panel.querySelector('[data-action="set-end"]'),
    resetButton: panel.querySelector('[data-action="reset"]'),
    trimStart: panel.querySelector('[data-role="trim-start"]'),
    trimEnd: panel.querySelector('[data-role="trim-end"]'),
    trimReset: panel.querySelector('[data-action="trim-reset"]'),
    playbackRate: panel.querySelector('[data-role="playback-rate"]'),
    loopPreview: panel.querySelector('[data-role="loop-preview"]'),
    exportSelection: panel.querySelector('[data-action="export-selection"]'),
    exportZip: panel.querySelector('[data-action="export-zip"]'),
    segmentName: panel.querySelector('[data-role="segment-name"]'),
    addSegment: panel.querySelector('[data-action="add-segment"]'),
    segmentList: panel.querySelector('[data-role="segment-list"]'),
  };

  if (Object.values(elements).some((element) => !element)) {
    return;
  }

  const state = {
    audioContext: null,
    audioBuffer: null,
    file: null,
    selectionStart: 0,
    selectionEnd: 0,
    playhead: 0,
    playbackRate: 1,
    waveformPeaks: [],
    activePlayback: null,
    animationFrame: 0,
    dragRenderFrame: 0,
    waveformWidth: 0,
    waveformDragRect: null,
    dragDepth: 0,
    playheadDragPointerId: null,
    playheadDragOrigin: null,
    playheadPreview: null,
    segments: [],
    nextSegmentId: 1,
    isBusy: false,
    busyTarget: null,
    elements,
  };

  bindAudioEditorEvents(state);
  updateAudioEditorUI(state);
  renderWaveform(state);
  renderSegmentList(state);
  announceRuntimeRequirements(state);
}

function bindAudioEditorEvents(state) {
  const { elements } = state;

  elements.input.addEventListener("change", () => {
    void loadAudioFile(state, Array.from(elements.input.files || [])[0] || null);
  });

  elements.dropzone.addEventListener("click", () => {
    openFilePicker(state);
  });

  elements.dropzone.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openFilePicker(state);
  });

  elements.dropzone.addEventListener("dragenter", (event) => {
    if (state.isBusy || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth += 1;
    elements.dropzone.classList.add("is-drag-over");
  });

  elements.dropzone.addEventListener("dragover", (event) => {
    if (state.isBusy || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    elements.dropzone.classList.add("is-drag-over");
  });

  elements.dropzone.addEventListener("dragleave", (event) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth = Math.max(0, state.dragDepth - 1);

    if (state.dragDepth === 0) {
      elements.dropzone.classList.remove("is-drag-over");
    }
  });

  elements.dropzone.addEventListener("drop", (event) => {
    if (state.isBusy || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth = 0;
    elements.dropzone.classList.remove("is-drag-over");
    void loadAudioFile(state, Array.from(event.dataTransfer?.files || [])[0] || null);
  });

  elements.playButton.addEventListener("click", () => {
    void togglePlayback(state);
  });

  elements.stopButton.addEventListener("click", () => {
    if (!state.audioBuffer) {
      return;
    }

    stopPlayback(state, { preservePlayhead: false });
    setPlayhead(state, state.selectionStart, { skipSegments: true });
  });

  elements.setStartButton.addEventListener("click", () => {
    if (!state.audioBuffer) {
      return;
    }

    setSelectionBounds(state, state.playhead, state.selectionEnd);
  });

  elements.setEndButton.addEventListener("click", () => {
    if (!state.audioBuffer) {
      return;
    }

    setSelectionBounds(state, state.selectionStart, state.playhead);
  });

  elements.trimStart.addEventListener("change", () => {
    setSelectionBounds(state, Number(elements.trimStart.value), state.selectionEnd);
  });

  elements.trimEnd.addEventListener("change", () => {
    setSelectionBounds(state, state.selectionStart, Number(elements.trimEnd.value));
  });

  elements.trimReset.addEventListener("click", () => {
    if (!state.audioBuffer) {
      return;
    }

    setSelectionBounds(state, 0, state.audioBuffer.duration);
  });

  elements.playbackRate.addEventListener("change", () => {
    state.playbackRate = Number(elements.playbackRate.value || 1);
    setStatus(state, `배속을 ${state.playbackRate.toFixed(2)}x로 변경했습니다.`, { tone: "info" });
    updateAudioEditorUI(state);
  });

  elements.exportSelection.addEventListener("click", () => {
    void exportCurrentSelection(state);
  });

  elements.exportZip.addEventListener("click", () => {
    void exportAllSegmentsZip(state);
  });

  elements.resetButton.addEventListener("click", () => {
    resetAudioEditor(state);
  });

  elements.addSegment.addEventListener("click", () => {
    addSegmentFromSelection(state);
  });

  elements.waveform.addEventListener("keydown", (event) => {
    void handleWaveformKeydown(state, event);
  });

  elements.waveform.addEventListener("pointerdown", (event) => {
    if (!state.audioBuffer || state.isBusy) {
      return;
    }

    event.preventDefault();
    stopPlayback(state, { preservePlayhead: true });
    state.waveformDragRect = getWaveformPointerRect(state);

    if (!isPointerNearPlayhead(state, event)) {
      movePlayheadFromPointer(state, event, {
        updateSelection: true,
        skipSegments: true,
      });
      state.waveformDragRect = null;
      return;
    }

    state.playheadDragPointerId = event.pointerId;
    state.playheadDragOrigin = state.playhead;
    state.playheadPreview = null;
    elements.waveform.classList.add("is-dragging");
    elements.waveform.setPointerCapture?.(event.pointerId);
    updateWaveformOverlay(state);
  });

  elements.waveform.addEventListener("pointermove", (event) => {
    if (!state.audioBuffer || state.isBusy || state.playheadDragPointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    previewPlayheadFromPointer(state, event);
  });

  elements.waveform.addEventListener("pointerup", (event) => {
    finishPlayheadDrag(state, event.pointerId, { commit: true });
  });

  elements.waveform.addEventListener("pointercancel", (event) => {
    finishPlayheadDrag(state, event.pointerId, { commit: false });
  });

  elements.waveform.addEventListener("lostpointercapture", (event) => {
    finishPlayheadDrag(state, event.pointerId, { commit: false });
  });

  window.addEventListener("resize", () => {
    renderWaveform(state);
  });
}

function announceRuntimeRequirements(state) {
  const missing = [];

  if (!window.lamejs) {
    missing.push("MP3 저장 라이브러리");
  }

  if (!window.JSZip) {
    missing.push("ZIP 라이브러리");
  }

  if (missing.length === 0) {
    return;
  }

  setStatus(
    state,
    `오디오 편집은 로컬에서 계속 사용할 수 있지만 사이트에 포함된 ${missing.join(", ")}를 읽지 못했습니다. 페이지를 새로고침하거나 배포 파일을 확인해 주세요.`,
    { tone: "warning" }
  );
}

function openFilePicker(state) {
  if (state.isBusy) {
    return;
  }

  state.elements.input.click();
}

async function handleWaveformKeydown(state, event) {
  if (!state.audioBuffer || state.isBusy) {
    return;
  }

  const duration = state.audioBuffer.duration;
  const step = event.shiftKey ? WAVEFORM_FAST_STEP_SECONDS : WAVEFORM_STEP_SECONDS;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    stopPlayback(state, { preservePlayhead: true });
    setPlayhead(state, state.playhead - step, { skipSegments: true });
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    stopPlayback(state, { preservePlayhead: true });
    setPlayhead(state, state.playhead + step, { skipSegments: true });
    return;
  }

  if (event.key === "Home") {
    event.preventDefault();
    stopPlayback(state, { preservePlayhead: true });
    setPlayhead(state, 0, { skipSegments: true });
    return;
  }

  if (event.key === "End") {
    event.preventDefault();
    stopPlayback(state, { preservePlayhead: true });
    setPlayhead(state, duration, { skipSegments: true });
    return;
  }

  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    await togglePlayback(state);
  }
}

async function togglePlayback(state) {
  if (!state.audioBuffer || state.isBusy) {
    return;
  }

  if (state.activePlayback) {
    stopPlayback(state, { preservePlayhead: true });
    return;
  }

  const playbackStart = clamp(
    state.playhead < state.selectionStart || state.playhead >= state.selectionEnd ? state.selectionStart : state.playhead,
    state.selectionStart,
    Math.max(state.selectionStart, state.selectionEnd - MIN_SELECTION_SECONDS)
  );

  await startPlayback(state, playbackStart, state.selectionEnd, { allowLoop: true });
}

function movePlayheadFromPointer(state, event, options = {}) {
  const time = getWaveformTimeFromPointer(state, event);

  state.playheadPreview = null;

  if (options.updateSelection && event.shiftKey) {
    state.playhead = time;
    setSelectionBounds(state, state.selectionStart, state.playhead, {
      skipSegments: options.skipSegments,
    });
    return;
  }

  if (options.updateSelection && event.altKey) {
    state.playhead = time;
    setSelectionBounds(state, state.playhead, state.selectionEnd, {
      skipSegments: options.skipSegments,
    });
    return;
  }

  setPlayhead(state, time, { skipSegments: options.skipSegments });
}

function previewPlayheadFromPointer(state, event) {
  state.playheadPreview = getWaveformTimeFromPointer(state, event);
  scheduleDragOverlayUpdate(state);
}

function scheduleDragOverlayUpdate(state) {
  if (state.dragRenderFrame) {
    return;
  }

  state.dragRenderFrame = requestAnimationFrame(() => {
    state.dragRenderFrame = 0;
    updateWaveformOverlay(state);
  });
}

function cancelScheduledDragOverlayUpdate(state) {
  if (!state.dragRenderFrame) {
    return;
  }

  cancelAnimationFrame(state.dragRenderFrame);
  state.dragRenderFrame = 0;
}

function finishPlayheadDrag(state, pointerId, options = {}) {
  if (state.playheadDragPointerId !== pointerId) {
    return;
  }

  if (options.commit && Number.isFinite(state.playheadPreview)) {
    state.playhead = clamp(state.playheadPreview, 0, state.audioBuffer?.duration || 0);
  }

  state.playheadDragPointerId = null;
  state.playheadDragOrigin = null;
  state.playheadPreview = null;
  state.waveformDragRect = null;
  state.elements.waveform.classList.remove("is-dragging");
  cancelScheduledDragOverlayUpdate(state);

  try {
    if (state.elements.waveform.hasPointerCapture?.(pointerId)) {
      state.elements.waveform.releasePointerCapture?.(pointerId);
    }
  } catch (error) {
    console.error(error);
  }

  updateAudioEditorUI(state, { skipSegments: true });
  updateWaveformOverlay(state);
}

function getWaveformTimeFromPointer(state, event) {
  const rect = state.waveformDragRect || getWaveformPointerRect(state);
  const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);

  return ratio * (state.audioBuffer?.duration || 0);
}

function isPointerNearPlayhead(state, event) {
  const rect = state.waveformDragRect || getWaveformPointerRect(state);
  const duration = Math.max(0.01, state.audioBuffer?.duration || 0);
  const playheadX = rect.left + (state.playhead / duration) * rect.width;

  return Math.abs(event.clientX - playheadX) <= 12;
}

function getWaveformPointerRect(state) {
  const rect = state.elements.waveform.getBoundingClientRect();

  return {
    left: rect.left,
    width: Math.max(1, rect.width || state.elements.waveform.clientWidth || state.waveformWidth || 1),
  };
}

async function loadAudioFile(state, file) {
  if (!file || state.isBusy) {
    return;
  }

  if (!isSupportedAudioFile(file)) {
    setStatus(state, "지원하지 않는 파일입니다. 확장자와 형식이 MP3인 파일만 열 수 있습니다.", { tone: "error" });
    return;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    setStatus(
      state,
      `파일 크기가 ${formatBytes(file.size)}입니다. MP3 편집기는 150 MB 이하 파일만 열 수 있습니다.`,
      { tone: "error" }
    );
    return;
  }

  try {
    setBusy(state, true, {
      message: "오디오 파일을 불러오고 파형을 준비하는 중입니다...",
      target: "load-file",
      tone: "info",
    });
    stopPlayback(state, { preservePlayhead: false });
    await ensureAudioContext(state);

    const arrayBuffer = await file.arrayBuffer();
    const decoded = await state.audioContext.decodeAudioData(arrayBuffer.slice(0));

    state.file = file;
    state.audioBuffer = decoded;
    state.selectionStart = 0;
    state.selectionEnd = decoded.duration;
    state.playhead = 0;
    state.playheadDragPointerId = null;
    state.playheadDragOrigin = null;
    state.playheadPreview = null;
    state.waveformDragRect = null;
    state.waveformPeaks = buildWaveformPeaks(decoded, 1600);
    state.segments = [];
    state.nextSegmentId = 1;
    state.elements.segmentName.value = "";
    cancelScheduledDragOverlayUpdate(state);

    updateAudioEditorUI(state);
    renderWaveform(state);
    renderSegmentList(state);

    const availabilityNote = window.lamejs
      ? "선택 구간을 조정하거나 세그먼트를 추가해 보세요."
      : "파형 확인과 미리 듣기는 가능하지만, MP3 저장용 라이브러리를 불러오지 못해 내보내기는 비활성화됩니다.";

    setStatus(state, `${file.name} 파일을 불러왔습니다. ${availabilityNote}`, { tone: "success" });
  } catch (error) {
    console.error(error);
    setStatus(state, interpretLoadError(error), { tone: "error" });
    resetLoadedAudioState(state);
    updateAudioEditorUI(state);
    renderWaveform(state);
    renderSegmentList(state);
  } finally {
    setBusy(state, false);
    state.elements.input.value = "";
  }
}

function resetAudioEditor(state) {
  stopPlayback(state, { preservePlayhead: false });
  resetLoadedAudioState(state);
  cancelScheduledDragOverlayUpdate(state);
  state.elements.waveform.classList.remove("is-dragging");
  updateAudioEditorUI(state);
  renderWaveform(state);
  renderSegmentList(state);
  setStatus(state, "MP3 편집기를 초기화했습니다.", { tone: "info" });
}

function resetLoadedAudioState(state) {
  state.audioBuffer = null;
  state.file = null;
  state.selectionStart = 0;
  state.selectionEnd = 0;
  state.playhead = 0;
  state.playheadDragPointerId = null;
  state.playheadDragOrigin = null;
  state.playheadPreview = null;
  state.waveformDragRect = null;
  state.waveformPeaks = [];
  state.segments = [];
  state.nextSegmentId = 1;
  state.elements.segmentName.value = "";
}

async function ensureAudioContext(state) {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("AUDIO_CONTEXT_UNSUPPORTED");
    }

    state.audioContext = new AudioContextClass();
  }

  if (state.audioContext.state === "suspended") {
    await state.audioContext.resume();
  }
}

function setSelectionBounds(state, start, end, options = {}) {
  if (!state.audioBuffer) {
    return;
  }

  const duration = state.audioBuffer.duration;
  const safeStart = clamp(Number.isFinite(start) ? start : state.selectionStart, 0, duration);
  const safeEnd = clamp(Number.isFinite(end) ? end : state.selectionEnd, 0, duration);
  const normalizedStart = Math.min(safeStart, safeEnd);
  const normalizedEnd = Math.max(safeStart, safeEnd);

  state.selectionStart = clamp(normalizedStart, 0, Math.max(0, duration - MIN_SELECTION_SECONDS));
  state.selectionEnd = clamp(
    Math.max(normalizedEnd, state.selectionStart + MIN_SELECTION_SECONDS),
    MIN_SELECTION_SECONDS,
    duration
  );
  state.playhead = clamp(state.playhead, state.selectionStart, state.selectionEnd);

  updateAudioEditorUI(state, { skipSegments: options.skipSegments });
  renderWaveform(state);
}

function setPlayhead(state, time, options = {}) {
  const duration = state.audioBuffer?.duration || 0;

  state.playheadPreview = null;
  state.playhead = clamp(Number(time) || 0, 0, duration);
  updateAudioEditorUI(state, { skipSegments: options.skipSegments });
  updateWaveformOverlay(state);
}

async function startPlayback(state, start, end, options = {}) {
  if (!state.audioBuffer) {
    return;
  }

  await ensureAudioContext(state);
  stopPlayback(state, { preservePlayhead: true });

  const source = state.audioContext.createBufferSource();
  source.buffer = state.audioBuffer;
  source.playbackRate.value = state.playbackRate;
  source.connect(state.audioContext.destination);

  const rawDuration = Math.max(MIN_SELECTION_SECONDS, end - start);
  const playedDuration = rawDuration / state.playbackRate;
  const startedAt = state.audioContext.currentTime;

  source.start(0, start, rawDuration);
  source.stop(startedAt + playedDuration + 0.02);

  state.activePlayback = {
    source,
    startedAt,
    start,
    end,
    rate: state.playbackRate,
    allowLoop: Boolean(options.allowLoop),
  };

  source.onended = () => {
    if (!state.activePlayback || state.activePlayback.source !== source) {
      return;
    }

    if (state.elements.loopPreview.checked && state.activePlayback.allowLoop) {
      void startPlayback(state, state.activePlayback.start, state.activePlayback.end, { allowLoop: true });
      return;
    }

    state.playhead = state.activePlayback.end;
    state.activePlayback = null;
    cancelAnimationFrame(state.animationFrame);
    updateAudioEditorUI(state, { skipSegments: true });
    updateWaveformOverlay(state);
  };

  updateAudioEditorUI(state, { skipSegments: true });
  updateWaveformOverlay(state);
  tickPlayback(state);
}

function stopPlayback(state, options = {}) {
  if (!state.activePlayback) {
    cancelAnimationFrame(state.animationFrame);
    return;
  }

  const playback = state.activePlayback;
  state.activePlayback = null;

  if (options.preservePlayhead) {
    const elapsed = (state.audioContext?.currentTime || playback.startedAt) - playback.startedAt;
    state.playhead = clamp(playback.start + elapsed * playback.rate, playback.start, playback.end);
  }

  try {
    playback.source.onended = null;
    playback.source.stop();
  } catch (error) {
    console.error(error);
  }

  cancelAnimationFrame(state.animationFrame);
  updateAudioEditorUI(state, { skipSegments: true });
  updateWaveformOverlay(state);
}

function tickPlayback(state) {
  if (!state.activePlayback) {
    return;
  }

  const elapsed = state.audioContext.currentTime - state.activePlayback.startedAt;
  state.playhead = clamp(
    state.activePlayback.start + elapsed * state.activePlayback.rate,
    state.activePlayback.start,
    state.activePlayback.end
  );

  updateAudioEditorUI(state, { skipSegments: true });
  updateWaveformOverlay(state);
  state.animationFrame = requestAnimationFrame(() => tickPlayback(state));
}

function buildWaveformPeaks(audioBuffer, buckets) {
  const channelCount = audioBuffer.numberOfChannels;
  const channelData = [];
  const length = audioBuffer.length;
  const bucketSize = Math.max(1, Math.floor(length / buckets));
  const peaks = [];

  for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
    channelData.push(audioBuffer.getChannelData(channelIndex));
  }

  for (let bucketIndex = 0; bucketIndex < buckets; bucketIndex += 1) {
    const start = bucketIndex * bucketSize;
    const end = Math.min(length, start + bucketSize);
    let min = 1;
    let max = -1;

    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      let mixed = 0;

      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        mixed += channelData[channelIndex][sampleIndex] || 0;
      }

      mixed /= channelCount;
      min = Math.min(min, mixed);
      max = Math.max(max, mixed);
    }

    peaks.push({ min, max });
  }

  return peaks;
}

function renderWaveform(state) {
  const { waveform, waveEmpty } = state.elements;
  const context = waveform.getContext("2d");

  if (!context) {
    return;
  }

  const rect = waveform.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width || waveform.clientWidth || 860));
  const height = Math.max(220, Math.round(rect.height || 280));
  const pixelRatio = window.devicePixelRatio || 1;
  const canvasWidth = Math.round(width * pixelRatio);
  const canvasHeight = Math.round(height * pixelRatio);

  state.waveformWidth = width;

  if (waveform.width !== canvasWidth || waveform.height !== canvasHeight) {
    waveform.width = canvasWidth;
    waveform.height = canvasHeight;
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050005";
  context.fillRect(0, 0, width, height);

  if (!state.audioBuffer || state.waveformPeaks.length === 0) {
    waveEmpty.hidden = false;
    updateWaveformOverlay(state);
    return;
  }

  waveEmpty.hidden = true;

  const duration = state.audioBuffer.duration;
  const selectionStartX = (state.selectionStart / duration) * width;
  const selectionEndX = (state.selectionEnd / duration) * width;

  context.fillStyle = "rgba(255, 0, 255, 0.08)";
  context.fillRect(selectionStartX, 0, Math.max(2, selectionEndX - selectionStartX), height);
  context.fillStyle = "rgba(0, 0, 0, 0.34)";
  context.fillRect(0, 0, selectionStartX, height);
  context.fillRect(selectionEndX, 0, width - selectionEndX, height);

  const middle = height / 2;
  context.strokeStyle = "rgba(255, 0, 255, 0.88)";
  context.lineWidth = 1;
  context.beginPath();

  for (let x = 0; x < width; x += 1) {
    const peak = state.waveformPeaks[Math.floor((x / width) * state.waveformPeaks.length)] || { min: 0, max: 0 };
    context.moveTo(x + 0.5, middle + peak.min * middle * 0.82);
    context.lineTo(x + 0.5, middle + peak.max * middle * 0.82);
  }

  context.stroke();

  state.segments.forEach((segment, index) => {
    const startX = (segment.start / duration) * width;
    const endX = (segment.end / duration) * width;
    context.fillStyle = index % 2 === 0 ? "rgba(255, 0, 255, 0.18)" : "rgba(255, 101, 255, 0.16)";
    context.fillRect(startX, height - 22, Math.max(2, endX - startX), 14);
  });

  updateWaveformOverlay(state);
}

function updateWaveformOverlay(state) {
  const { playheadMarker, playheadOriginMarker, playheadPreviewMarker, playheadPreviewLabel } = state.elements;
  const hasAudio = Boolean(state.audioBuffer);
  const duration = Math.max(0.01, state.audioBuffer?.duration || 0);
  const width = state.waveformWidth || state.elements.waveform.clientWidth || 0;
  const isDragging = state.playheadDragPointerId !== null;
  const showOrigin =
    hasAudio &&
    isDragging &&
    Number.isFinite(state.playheadDragOrigin) &&
    Number.isFinite(state.playheadPreview) &&
    Math.abs(state.playheadDragOrigin - state.playheadPreview) > 0.01;
  const showPreview = hasAudio && isDragging && Number.isFinite(state.playheadPreview);

  setWaveformMarker(playheadMarker, state.playhead, duration, width, hasAudio);
  setWaveformMarker(playheadOriginMarker, state.playheadDragOrigin, duration, width, showOrigin);
  setWaveformMarker(playheadPreviewMarker, state.playheadPreview, duration, width, showPreview);

  if (showPreview) {
    playheadPreviewLabel.textContent = `이동 ${formatTime(state.playheadPreview)}`;
  } else {
    playheadPreviewLabel.textContent = "";
  }
}

function setWaveformMarker(marker, time, duration, width, isVisible) {
  if (!isVisible || !Number.isFinite(time) || width <= 0) {
    marker.classList.remove("is-visible", "is-label-left");
    return;
  }

  const x = clamp((time / duration) * width, 0, width);

  marker.style.transform = `translate3d(${x}px, 0, 0)`;
  marker.classList.toggle("is-label-left", x > width - 150);
  marker.classList.add("is-visible");
}

async function exportCurrentSelection(state) {
  if (!state.audioBuffer || state.isBusy) {
    return;
  }

  if (!window.lamejs) {
    setStatus(state, "사이트에 포함된 MP3 저장 라이브러리를 읽지 못했습니다. 새로고침하거나 배포 파일을 확인해 주세요.", { tone: "error" });
    return;
  }

  try {
    setBusy(state, true, {
      message: "선택 구간을 MP3로 저장하는 중입니다...",
      target: "export-selection",
      tone: "info",
    });
    const rendered = await renderEditedBuffer(state, state.selectionStart, state.selectionEnd, state.playbackRate);
    const blob = await audioBufferToMp3Blob(rendered);
    downloadBlob(blob, buildAudioFileName(state, "selection"));
    setStatus(state, "선택 구간 MP3 저장이 완료되었습니다.", { tone: "success" });
  } catch (error) {
    console.error(error);
    setStatus(state, "선택 구간 MP3 저장에 실패했습니다. 브라우저 메모리와 파일 상태를 확인해 주세요.", { tone: "error" });
  } finally {
    setBusy(state, false);
  }
}

async function exportAllSegmentsZip(state) {
  if (!state.audioBuffer || state.segments.length === 0 || state.isBusy) {
    return;
  }

  if (!window.JSZip) {
    setStatus(state, "사이트에 포함된 ZIP 라이브러리를 읽지 못했습니다. 새로고침하거나 배포 파일을 확인해 주세요.", { tone: "error" });
    return;
  }

  if (!window.lamejs) {
    setStatus(state, "사이트에 포함된 MP3 저장 라이브러리를 읽지 못했습니다. 새로고침하거나 배포 파일을 확인해 주세요.", { tone: "error" });
    return;
  }

  try {
    setBusy(state, true, {
      message: "세그먼트를 MP3로 변환해 ZIP으로 묶는 중입니다...",
      target: "export-zip",
      tone: "info",
    });
    const zip = new window.JSZip();

    for (const [index, segment] of state.segments.entries()) {
      setStatus(state, `${index + 1}/${state.segments.length} 세그먼트를 변환하는 중입니다...`, { tone: "info" });
      const rendered = await renderEditedBuffer(state, segment.start, segment.end, state.playbackRate);
      const blob = await audioBufferToMp3Blob(rendered);
      zip.file(`${sanitizeSegmentName(segment.name, index + 1)}.mp3`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `${baseAudioName(state.file)}-segments.zip`);
    setStatus(state, "세그먼트 ZIP 저장이 완료되었습니다.", { tone: "success" });
  } catch (error) {
    console.error(error);
    setStatus(state, "세그먼트 ZIP 저장에 실패했습니다. 브라우저 메모리와 파일 상태를 확인해 주세요.", { tone: "error" });
  } finally {
    setBusy(state, false);
  }
}

async function exportSingleSegment(state, segmentId) {
  const segment = state.segments.find((item) => item.id === segmentId);

  if (!segment || state.isBusy) {
    return;
  }

  if (!window.lamejs) {
    setStatus(state, "사이트에 포함된 MP3 저장 라이브러리를 읽지 못했습니다. 새로고침하거나 배포 파일을 확인해 주세요.", { tone: "error" });
    return;
  }

  try {
    setBusy(state, true, {
      message: `${segment.name} 구간을 MP3로 저장하는 중입니다...`,
      target: `segment-export-${segment.id}`,
      tone: "info",
    });
    const rendered = await renderEditedBuffer(state, segment.start, segment.end, state.playbackRate);
    const blob = await audioBufferToMp3Blob(rendered);
    downloadBlob(blob, `${sanitizeSegmentName(segment.name)}.mp3`);
    setStatus(state, `${segment.name} MP3 저장이 완료되었습니다.`, { tone: "success" });
  } catch (error) {
    console.error(error);
    setStatus(state, `${segment.name} MP3 저장에 실패했습니다.`, { tone: "error" });
  } finally {
    setBusy(state, false);
  }
}

async function renderEditedBuffer(state, start, end, rate) {
  await ensureAudioContext(state);

  const sourceDuration = Math.max(MIN_SELECTION_SECONDS, end - start);
  const outputDuration = sourceDuration / rate;
  const sampleRate = state.audioBuffer.sampleRate;
  const channels = Math.min(2, state.audioBuffer.numberOfChannels);
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  if (!OfflineContext) {
    throw new Error("OFFLINE_AUDIO_CONTEXT_UNSUPPORTED");
  }

  const offlineContext = new OfflineContext(channels, Math.ceil(sampleRate * outputDuration), sampleRate);
  const source = offlineContext.createBufferSource();

  source.buffer = state.audioBuffer;
  source.playbackRate.value = rate;
  source.connect(offlineContext.destination);
  source.start(0, start, sourceDuration);

  return offlineContext.startRendering();
}

async function audioBufferToMp3Blob(audioBuffer) {
  if (!window.lamejs) {
    throw new Error("LAME_NOT_AVAILABLE");
  }

  const channels = Math.min(2, audioBuffer.numberOfChannels);
  const encoder = new window.lamejs.Mp3Encoder(channels, audioBuffer.sampleRate, 192);
  const left = floatTo16BitPCM(audioBuffer.getChannelData(0));
  const right = channels > 1 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : null;
  const mp3Chunks = [];
  const blockSize = 1152;

  for (let offset = 0; offset < left.length; offset += blockSize) {
    const leftChunk = left.subarray(offset, offset + blockSize);
    const encoded = right
      ? encoder.encodeBuffer(leftChunk, right.subarray(offset, offset + blockSize))
      : encoder.encodeBuffer(leftChunk);

    if (encoded.length > 0) {
      mp3Chunks.push(new Int8Array(encoded));
    }
  }

  const flushed = encoder.flush();

  if (flushed.length > 0) {
    mp3Chunks.push(new Int8Array(flushed));
  }

  return new Blob(mp3Chunks, { type: "audio/mpeg" });
}

function floatTo16BitPCM(float32Array) {
  const output = new Int16Array(float32Array.length);

  for (let index = 0; index < float32Array.length; index += 1) {
    const sample = clamp(float32Array[index], -1, 1);
    output[index] = sample < 0 ? sample * 32768 : sample * 32767;
  }

  return output;
}

function addSegmentFromSelection(state) {
  if (!state.audioBuffer) {
    return;
  }

  const start = roundTime(state.selectionStart);
  const end = roundTime(state.selectionEnd);

  if (end - start < MIN_SELECTION_SECONDS) {
    setStatus(state, "세그먼트로 저장할 구간이 너무 짧습니다.", { tone: "error" });
    return;
  }

  const fallbackName = `segment-${String(state.nextSegmentId).padStart(2, "0")}`;
  const name = state.elements.segmentName.value.trim() || fallbackName;

  state.segments.push({
    id: state.nextSegmentId,
    name,
    start,
    end,
  });
  state.nextSegmentId += 1;
  state.elements.segmentName.value = "";

  renderSegmentList(state);
  renderWaveform(state);
  updateAudioEditorUI(state);
  setStatus(state, `${name} 구간을 저장했습니다.`, { tone: "success" });
}

function updateSegment(state, segmentId, patch) {
  const segment = state.segments.find((item) => item.id === segmentId);

  if (!segment || !state.audioBuffer) {
    return;
  }

  Object.assign(segment, patch);

  if ("name" in patch) {
    segment.name = String(segment.name || "").trim() || `segment-${String(segmentId).padStart(2, "0")}`;
  }

  if ("start" in patch || "end" in patch) {
    segment.start = clamp(roundTime(segment.start), 0, state.audioBuffer.duration);
    segment.end = clamp(roundTime(segment.end), segment.start + MIN_SELECTION_SECONDS, state.audioBuffer.duration);
  }

  renderSegmentList(state);
  renderWaveform(state);
}

function removeSegment(state, segmentId) {
  const segment = state.segments.find((item) => item.id === segmentId);

  if (!segment) {
    return;
  }

  state.segments = state.segments.filter((item) => item.id !== segmentId);
  renderSegmentList(state);
  renderWaveform(state);
  updateAudioEditorUI(state);
  setStatus(state, `${segment.name} 구간을 삭제했습니다.`, { tone: "info" });
}

function renderSegmentList(state) {
  const { segmentList } = state.elements;
  segmentList.innerHTML = "";

  if (state.segments.length === 0) {
    const empty = document.createElement("p");
    empty.className = "audio-empty-state";
    empty.textContent = "저장한 구간이 없습니다. 파형에서 필요한 부분을 고른 뒤 현재 선택 구간 저장을 눌러 보세요.";
    segmentList.append(empty);
    return;
  }

  state.segments.forEach((segment, index) => {
    const card = document.createElement("article");
    card.className = "audio-segment-card";

    const header = document.createElement("div");
    header.className = "audio-segment-header";

    const title = document.createElement("input");
    title.type = "text";
    title.className = "audio-segment-name";
    title.value = segment.name;
    title.disabled = state.isBusy;
    title.setAttribute("aria-label", `세그먼트 ${index + 1} 이름`);
    title.addEventListener("change", () => {
      updateSegment(state, segment.id, { name: title.value });
    });

    const badge = document.createElement("span");
    badge.className = "queue-position";
    badge.textContent = String(index + 1).padStart(2, "0");

    header.append(title, badge);

    const grid = document.createElement("div");
    grid.className = "audio-field-grid";

    const startLabel = document.createElement("label");
    const startText = document.createElement("span");
    startText.textContent = "시작";
    const startInput = document.createElement("input");
    startInput.type = "number";
    startInput.min = "0";
    startInput.step = "0.01";
    startInput.value = segment.start.toFixed(2);
    startInput.disabled = state.isBusy;
    startInput.setAttribute("aria-label", `${segment.name} 시작 시간`);
    startInput.addEventListener("change", () => {
      updateSegment(state, segment.id, { start: Number(startInput.value) });
    });
    startLabel.append(startText, startInput);

    const endLabel = document.createElement("label");
    const endText = document.createElement("span");
    endText.textContent = "끝";
    const endInput = document.createElement("input");
    endInput.type = "number";
    endInput.min = "0";
    endInput.step = "0.01";
    endInput.value = segment.end.toFixed(2);
    endInput.disabled = state.isBusy;
    endInput.setAttribute("aria-label", `${segment.name} 끝 시간`);
    endInput.addEventListener("change", () => {
      updateSegment(state, segment.id, { end: Number(endInput.value) });
    });
    endLabel.append(endText, endInput);

    grid.append(startLabel, endLabel);

    const meta = document.createElement("p");
    meta.className = "audio-helper";
    meta.textContent = `길이 ${formatTime(segment.end - segment.start)} · 현재 저장 배속 ${state.playbackRate.toFixed(2)}x`;

    const actions = document.createElement("div");
    actions.className = "tool-actions";

    const playButton = document.createElement("button");
    playButton.type = "button";
    playButton.textContent = "구간 재생";
    playButton.disabled = state.isBusy;
    playButton.addEventListener("click", () => {
      void startPlayback(state, segment.start, segment.end, { allowLoop: true });
    });

    const exportButton = document.createElement("button");
    exportButton.type = "button";
    exportButton.textContent = "MP3 저장";
    exportButton.disabled = state.isBusy || !window.lamejs;
    exportButton.setAttribute("aria-busy", String(state.isBusy && state.busyTarget === `segment-export-${segment.id}`));
    exportButton.addEventListener("click", () => {
      void exportSingleSegment(state, segment.id);
    });

    const useSelectionButton = document.createElement("button");
    useSelectionButton.type = "button";
    useSelectionButton.textContent = "이 구간 선택";
    useSelectionButton.disabled = state.isBusy;
    useSelectionButton.addEventListener("click", () => {
      setSelectionBounds(state, segment.start, segment.end);
      setStatus(state, `${segment.name} 구간을 현재 선택 영역으로 불러왔습니다.`, { tone: "info" });
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "remove-file-button";
    deleteButton.textContent = "삭제";
    deleteButton.disabled = state.isBusy;
    deleteButton.addEventListener("click", () => {
      removeSegment(state, segment.id);
    });

    actions.append(playButton, exportButton, useSelectionButton, deleteButton);
    card.append(header, grid, meta, actions);
    segmentList.append(card);
  });
}

function updateAudioEditorUI(state, options = {}) {
  const { elements } = state;
  const hasAudio = Boolean(state.audioBuffer);
  const canEncodeMp3 = Boolean(window.lamejs);
  const canCreateZip = Boolean(window.JSZip);
  const canExportSelection = hasAudio && !state.isBusy && canEncodeMp3;
  const canExportZip = canExportSelection && state.segments.length > 0 && canCreateZip;

  elements.panel.setAttribute("aria-busy", String(state.isBusy));
  elements.dropzone.setAttribute("aria-busy", String(state.isBusy && state.busyTarget === "load-file"));
  elements.dropzone.setAttribute("aria-disabled", String(state.isBusy));
  elements.waveEmpty.hidden = hasAudio;
  elements.fileName.textContent = hasAudio ? state.file.name : "No file loaded";
  elements.fileMeta.textContent = hasAudio
    ? `${formatTime(state.audioBuffer.duration)} / ${formatBytes(state.file.size)}`
    : "0.00s / 0 KB";
  elements.selectionMeta.textContent = `선택 구간 ${formatTime(Math.max(0, state.selectionEnd - state.selectionStart))}`;
  elements.playheadLabel.textContent = `재생 위치 ${formatTime(state.playhead)}`;
  elements.durationLabel.textContent = `전체 길이 ${hasAudio ? formatTime(state.audioBuffer.duration) : "0.00s"}`;

  elements.trimStart.value = hasAudio ? state.selectionStart.toFixed(2) : "0";
  elements.trimEnd.value = hasAudio ? state.selectionEnd.toFixed(2) : "0";

  elements.input.disabled = state.isBusy;
  elements.playButton.disabled = !hasAudio || state.isBusy;
  elements.playButton.textContent = state.activePlayback ? "일시정지" : "재생";
  elements.playButton.setAttribute("aria-pressed", String(Boolean(state.activePlayback)));
  elements.stopButton.disabled = !hasAudio || state.isBusy;
  elements.setStartButton.disabled = !hasAudio || state.isBusy;
  elements.setEndButton.disabled = !hasAudio || state.isBusy;
  elements.trimReset.disabled = !hasAudio || state.isBusy;
  elements.resetButton.disabled = !hasAudio || state.isBusy;
  elements.exportSelection.disabled = !canExportSelection;
  elements.exportZip.disabled = !canExportZip;
  elements.addSegment.disabled = !hasAudio || state.isBusy;
  elements.trimStart.disabled = !hasAudio || state.isBusy;
  elements.trimEnd.disabled = !hasAudio || state.isBusy;
  elements.playbackRate.disabled = state.isBusy;
  elements.loopPreview.disabled = !hasAudio || state.isBusy;
  elements.segmentName.disabled = !hasAudio || state.isBusy;

  elements.exportSelection.setAttribute("aria-busy", String(state.isBusy && state.busyTarget === "export-selection"));
  elements.exportZip.setAttribute("aria-busy", String(state.isBusy && state.busyTarget === "export-zip"));

  updateWaveformAccessibility(state);

  if (!options.skipSegments) {
    renderSegmentList(state);
  }
}

function updateWaveformAccessibility(state) {
  const { waveform } = state.elements;
  const hasAudio = Boolean(state.audioBuffer);
  const duration = hasAudio ? state.audioBuffer.duration : 0;
  const playhead = clamp(state.playhead, 0, duration);

  waveform.setAttribute("aria-valuemin", "0");
  waveform.setAttribute("aria-valuemax", duration.toFixed(2));
  waveform.setAttribute("aria-valuenow", playhead.toFixed(2));
  waveform.setAttribute("aria-disabled", String(!hasAudio || state.isBusy));

  if (!hasAudio) {
    waveform.setAttribute("aria-valuetext", "오디오가 아직 로드되지 않았습니다.");
    return;
  }

  waveform.setAttribute(
    "aria-valuetext",
    `현재 재생 위치 ${formatTime(playhead)}, 전체 길이 ${formatTime(duration)}, 선택 구간 ${formatTime(
      state.selectionStart
    )}부터 ${formatTime(state.selectionEnd)}까지`
  );
}

function setBusy(state, isBusy, options = {}) {
  state.isBusy = isBusy;
  state.busyTarget = isBusy ? options.target || null : null;

  if (options.message) {
    setStatus(state, options.message, { tone: options.tone || "info" });
  }

  updateAudioEditorUI(state);
}

function setStatus(state, message, options = {}) {
  state.elements.status.textContent = message;
  state.elements.status.dataset.statusTone = options.tone || "info";
}

function interpretLoadError(error) {
  if (!error) {
    return "오디오 파일을 해석하지 못했습니다. 다른 MP3 파일로 다시 시도해 주세요.";
  }

  if (error.message === "AUDIO_CONTEXT_UNSUPPORTED") {
    return "이 브라우저는 Web Audio를 지원하지 않아 MP3 편집기를 사용할 수 없습니다.";
  }

  if (error.name === "EncodingError" || error.name === "NotSupportedError") {
    return "브라우저가 이 오디오 파일을 해석하지 못했습니다. 손상되지 않은 MP3인지 확인해 주세요.";
  }

  return "오디오 파일을 해석하지 못했습니다. 파일 형식, 브라우저 메모리, 손상 여부를 확인한 뒤 다시 시도해 주세요.";
}

function buildAudioFileName(state, suffix) {
  return `${baseAudioName(state.file)}-${suffix}-${state.playbackRate.toFixed(2)}x.mp3`;
}

function baseAudioName(file) {
  return sanitizeSegmentName(file?.name?.replace(/\.[^.]+$/, "") || "audio-edit");
}

function sanitizeSegmentName(name, fallbackIndex = 1) {
  const safe = String(name || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return safe || `segment-${String(fallbackIndex).padStart(2, "0")}`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(2).padStart(5, "0")}`;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function roundTime(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hasDraggedFiles(event) {
  const types = event.dataTransfer?.types;

  if (!types) {
    return false;
  }

  return Array.from(types).includes("Files");
}

function isSupportedAudioFile(file) {
  const fileName = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();

  return fileName.endsWith(".mp3") && (!type || ["audio/mpeg", "audio/mp3", "audio/x-mpeg"].includes(type));
}
