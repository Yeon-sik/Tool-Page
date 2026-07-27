const toolConfigs = {};
const DEFAULT_FILE_SORT_MODE = "name-asc";
const fileSortModes = [
  { value: "name-asc", label: "파일 이름 오름차순" },
  { value: "name-desc", label: "파일 이름 내림차순" },
  { value: "random", label: "랜덤" },
];

const sharedOutputSettings = [
  {
    key: "outputBaseName",
    label: "출력 파일명",
    description: "생성할 파일의 기본 이름입니다. 비워 두면 기본 이름을 사용합니다.",
    type: "text",
    defaultValue: "",
    placeholder: "결과물",
  },
  {
    key: "outputPrefix",
    label: "접두어",
    description: "내보내는 모든 파일명 앞에 추가됩니다.",
    type: "text",
    defaultValue: "",
    placeholder: "프로젝트-",
  },
  {
    key: "outputSuffix",
    label: "접미어",
    description: "내보내는 모든 파일명 뒤에 추가됩니다.",
    type: "text",
    defaultValue: "",
    placeholder: "-최종본",
  },
  {
    key: "outputNameMode",
    label: "파일명 방식",
    description: "원본 파일명을 유지할지, 일괄 번호 이름으로 바꿀지 선택합니다.",
    type: "select",
    defaultValue: "original",
    options: [
      { value: "original", label: "원본 이름 유지" },
      { value: "numbered", label: "번호 순서로 이름 지정" },
    ],
  },
  {
    key: "outputStartNumber",
    label: "시작 번호",
    description: "파일명 방식을 번호 순서로 설정했을 때 시작되는 번호입니다.",
    type: "number",
    min: 1,
    max: 9999,
    step: 1,
    defaultValue: 1,
  },
];

const MAX_FILE_COUNT = 100;
const WARNING_FILE_COUNT = 40;
const MAX_FILE_SIZE_BYTES = 120 * 1024 * 1024;
const WARNING_TOTAL_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_SIZE_BYTES = 250 * 1024 * 1024;
const workflowSteps = ["파일 준비", "변환 실행", "결과 다운로드"];
const workflowPhaseMeta = {
  idle: { label: "대기", tone: "idle" },
  ready: { label: "준비 완료", tone: "ready" },
  running: { label: "변환 중", tone: "running" },
  success: { label: "완료", tone: "success" },
  error: { label: "오류", tone: "error" },
  cancelled: { label: "취소됨", tone: "cancelled" },
};
const toolPanelStates = new Set();
let pagehideCleanupRegistered = false;

const ToolPage = {
  assertJobActive,
  blobToDataUrl,
  buildBundleFileName,
  buildDocumentImageFileName,
  buildOutputFileName,
  canvasToBlob,
  coverWithinBox,
  createCanvasImageResult,
  createImageResults,
  createRenderedImagePreview,
  createZipBlob,
  downloadBlob,
  fitWithinBox,
  formatFileSize,
  isJobActive,
  loadImage,
  loadImageFromDataUrl,
  normalizeHexColor,
  registerTool,
  removeFileAtIndex,
  renderImageToBlob,
  renderState,
  resolvePageImageOutput,
  sanitizeFileNameSegment,
  setJobCancellation,
  stripExtension,
};

window.ToolPage = ToolPage;

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "tool") {
    initializeToolPage();
    setupDirectionSwitchers();
  }
});

function registerTool(toolName, config) {
  toolConfigs[toolName] = {
    ...config,
    name: toolName,
  };
}

function initializeToolPage() {
  registerPagehideCleanup();
  document.querySelectorAll("[data-tool]").forEach((panel) => initializeToolPanel(panel));
}

function registerPagehideCleanup() {
  if (pagehideCleanupRegistered) {
    return;
  }

  window.addEventListener("pagehide", () => {
    toolPanelStates.forEach((state) => {
      cancelActiveJob(state);
      revokePreviewUrls(state.previews);
    });
  });
  pagehideCleanupRegistered = true;
}

function initializeToolPanel(panel) {
  const input = panel.querySelector('input[type="file"]');
  const list = panel.querySelector('[data-role="list"]');
  const actions = panel.querySelector(".tool-actions");
  const downloadAllButton = panel.querySelector('[data-action="download-all"]');
  const convertButton = panel.querySelector('[data-action="convert"]');
  const clearButton = panel.querySelector('[data-action="clear"]');
  const uploaderBox = panel.querySelector(".uploader-box");
  const config = toolConfigs[panel.dataset.tool];

  if (!config || !input || !list || !actions || !downloadAllButton || !convertButton || !clearButton || !uploaderBox) {
    return;
  }

  downloadAllButton.textContent = config.downloadAllLabel;
  input.id = input.id || `${panel.dataset.tool}-file-input`;

  const state = {
    files: [],
    results: [],
    previews: [],
    frameSettings: [],
    fileSettings: [],
    dragIndex: null,
    dropInsertionIndex: null,
    dropMoveTargetIndex: null,
    pointerDrag: null,
    dragDepth: 0,
    dropTarget: null,
    input,
    list,
    status: null,
    downloadAllButton,
    convertButton,
    clearButton,
    cancelButton: null,
    uploaderBox,
    panel,
    actions,
    config,
    fileSortMode: DEFAULT_FILE_SORT_MODE,
    settings: loadStoredSettings(config),
    settingsRoot: null,
    settingsControls: [],
    workflow: null,
    sortControlsRoot: null,
    actionToken: 0,
    activeJobToken: 0,
    activeJobCancel: null,
  };

  state.cancelButton = ensureCancelButton(state);
  state.workflow = ensureWorkflowStatusLine(state);
  state.status = state.workflow.message;
  state.dropTarget = ensureDropTarget(state);
  state.settingsRoot = renderSettingsPanel(panel, state);
  state.sortControlsRoot = renderFileSortControls(panel, state);
  attachStatusNormalizer(state);
  attachBusyInteractionGuards(state);
  setupDropzone(state);
  toolPanelStates.add(state);
  syncControlStates(state);
  setWorkflowPhase(state, "idle", buildIdleStatusMessage(state));

  if (typeof config.onReady === "function") {
    config.onReady({ state, api: ToolPage });
  }

  input.addEventListener("change", () => {
    processSelectedFiles(state, Array.from(input.files || []));
  });

  convertButton.addEventListener("click", async () => {
    if (state.files.length === 0) {
      setWorkflowPhase(state, "idle", "먼저 파일을 준비해 주세요.");
      return;
    }

    const jobToken = ++state.actionToken;
    const jobSettings = { ...state.settings };
    const jobFrameSettings = state.frameSettings.map((frameSetting) => ({ ...frameSetting }));
    const jobFileSettings = state.fileSettings.map((fileSetting) => ({ ...fileSetting }));
    state.activeJobToken = jobToken;
    state.activeJobCancel = null;
    state.results = [];
    renderState(state);
    syncControlStates(state);
    setWorkflowPhase(state, "running", "변환을 시작했습니다. 작업이 끝날 때까지 입력과 목록 수정이 잠깁니다.");

    try {
      const results = await createResults(state.files, config, jobSettings, jobFrameSettings, jobFileSettings, jobToken, state);

      if (!isJobActive(state, jobToken)) {
        return;
      }

      state.results = results;
      renderState(state);
      syncControlStates(state);
      setWorkflowPhase(state, "success", `${state.results.length}개 결과 파일을 준비했습니다. ${config.statusDone}`);
    } catch (error) {
      if (!isJobActive(state, jobToken)) {
        return;
      }

      console.error(error);
      state.results = [];
      renderState(state);
      syncControlStates(state);
      setWorkflowPhase(state, "error", error instanceof Error ? error.message : "변환 중 오류가 발생했습니다.");
    } finally {
      clearJobCancellation(state, jobToken);

      if (state.activeJobToken === jobToken) {
        state.activeJobToken = 0;
      }

      syncControlStates(state);
    }
  });

  downloadAllButton.addEventListener("click", async () => {
    if (state.results.length === 0) {
      return;
    }

    try {
      if (config.mode === "image" || config.bundleResults) {
        setWorkflowPhase(state, "success", "ZIP 파일을 준비하고 있습니다.");
        const blob = await createZipBlob(state.results);
        downloadBlob(blob, buildBundleFileName(state.settings, panel.dataset.tool, "zip"));
      } else {
        const result = state.results[0];
        downloadBlob(result.blob, result.fileName);
      }

      setWorkflowPhase(state, "success", "다운로드를 시작했습니다.");
    } catch (error) {
      console.error(error);
      setWorkflowPhase(state, "error", "다운로드 준비 중 오류가 발생했습니다.");
    }
  });

  clearButton.addEventListener("click", () => {
    if (isPanelBusy(state)) {
      setWorkflowPhase(state, "running", "변환 중에는 목록을 초기화할 수 없습니다. 필요하면 변환 취소를 눌러 주세요.");
      return;
    }

    cancelActiveJob(state);
    revokePreviewUrls(state.previews);
    state.files = [];
    state.results = [];
    state.previews = [];
    state.frameSettings = [];
    state.fileSettings = [];
    state.dragIndex = null;
    state.pointerDrag = null;
    state.dropMoveTargetIndex = null;
    state.input.value = "";
    renderState(state);
    syncControlStates(state);
    setWorkflowPhase(state, "idle", "목록을 비웠습니다. 새 파일을 추가해 주세요.");
  });
}

function shouldAppendFiles(config) {
  return Boolean(config.appendFiles);
}

function isDocumentImageMode(config) {
  return config.mode === "pdf-images" || config.mode === "ppt-images";
}

function ensureCancelButton(state) {
  const existingButton = state.actions.querySelector('[data-action="cancel"]');

  if (existingButton) {
    existingButton.addEventListener("click", () => cancelRunningJob(state));
    return existingButton;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = "cancel";
  button.className = "cancel-convert-button";
  button.textContent = "변환 취소";
  button.disabled = true;
  button.addEventListener("click", () => cancelRunningJob(state));
  state.clearButton.insertAdjacentElement("afterend", button);
  return button;
}

function ensureWorkflowStatusLine(state) {
  const existingLine = state.panel.querySelector('[data-role="status-line"]');

  if (existingLine) {
    existingLine.remove();
  }

  Array.from(state.panel.children)
    .filter((child) => child.dataset?.role === "status")
    .forEach((child) => child.remove());

  const line = document.createElement("section");
  line.className = "status-line";
  line.dataset.role = "status-line";
  line.dataset.phase = "idle";

  const summary = document.createElement("div");
  summary.className = "status-line-summary";

  const phase = document.createElement("span");
  phase.className = "status-line-phase";
  phase.dataset.role = "phase";

  const status = document.createElement("p");
  status.className = "status-line-message";
  status.dataset.role = "status";
  status.dataset.tone = "idle";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");

  const meta = document.createElement("p");
  meta.className = "status-line-meta";
  meta.dataset.role = "summary";

  summary.append(phase, status, meta);

  const steps = document.createElement("ol");
  steps.className = "workflow-steps";
  steps.setAttribute("aria-label", "작업 단계");
  const stepItems = workflowSteps.map((label, index) => {
    const item = document.createElement("li");
    item.className = "workflow-step";
    item.dataset.stepIndex = String(index);
    item.dataset.stepState = index === 0 ? "current" : "pending";
    item.textContent = label;
    steps.append(item);
    return item;
  });

  line.append(summary, steps);
  state.uploaderBox.insertAdjacentElement("afterend", line);
  return { root: line, phase, message: status, meta, steps: stepItems };
}

function attachStatusNormalizer(state) {
  const observer = new MutationObserver(() => {
    const normalized = normalizeStatusCopy(state.status.textContent || "");

    if (normalized === state.status.textContent) {
      return;
    }

    observer.disconnect();
    state.status.textContent = normalized;
    observer.observe(state.status, { childList: true, characterData: true, subtree: true });
  });

  observer.observe(state.status, { childList: true, characterData: true, subtree: true });
}

function normalizeStatusCopy(message) {
  const text = String(message || "").trim();
  const exactMap = {
    "No files were added.": "추가된 파일이 없습니다.",
    "GIF frame order reversed.": "GIF 프레임 순서를 반대로 바꿨습니다.",
  };

  if (exactMap[text]) {
    return exactMap[text];
  }

  const duplicateMatch = text.match(/^Skipped (\d+) duplicate file\(s\)\.?$/i);

  if (duplicateMatch) {
    return `중복 파일 ${duplicateMatch[1]}개는 제외했습니다.`;
  }

  const readyMatch = text.match(/^(\d+) file\(s\) ready\.\s*(.*)$/i);

  if (readyMatch) {
    return `${readyMatch[1]}개 파일 준비가 완료되었습니다. ${readyMatch[2]}`.trim();
  }

  return text;
}

function attachBusyInteractionGuards(state) {
  const stopBusyMutation = (event) => {
    if (!isPanelBusy(state)) {
      const duplicateButton = event.target.closest(".duplicate-file-button");

      if (duplicateButton) {
        const card = duplicateButton.closest(".queue-card");
        const cardIndex = Number(card?.dataset.index);
        const sourceFile = state.files[cardIndex];

        if (sourceFile) {
          const budgetError = validateSelectionBudget(state.files, [sourceFile], true);

          if (budgetError) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            setWorkflowPhase(state, "error", budgetError);
          }
        }
      }

      return;
    }

    const interactiveTarget = event.target.closest("button, input, select, label");

    if (!interactiveTarget || interactiveTarget === state.cancelButton) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    setWorkflowPhase(state, "running", "변환 중에는 업로드와 목록 수정이 잠깁니다. 필요하면 변환 취소를 눌러 주세요.");
  };

  state.uploaderBox.addEventListener("click", stopBusyMutation, true);
  state.list.addEventListener("click", stopBusyMutation, true);
  state.list.addEventListener("change", stopBusyMutation, true);
  state.list.addEventListener("keydown", stopBusyMutation, true);
}

function setWorkflowPhase(state, phase, message) {
  const resolvedPhase = workflowPhaseMeta[phase] ? phase : "idle";
  const meta = workflowPhaseMeta[resolvedPhase];
  state.panel.dataset.phase = resolvedPhase;
  state.workflow.root.dataset.phase = resolvedPhase;
  state.workflow.phase.textContent = meta.label;
  state.status.dataset.tone = meta.tone;
  state.status.textContent = normalizeStatusCopy(message);
  state.workflow.meta.textContent = buildFileSummaryText(state);
  updateWorkflowSteps(state, resolvedPhase);
}

function updateWorkflowSteps(state, phase) {
  const stepStates = resolveWorkflowStepStates(state, phase);
  state.workflow.steps.forEach((step, index) => {
    step.dataset.stepState = stepStates[index] || "pending";
  });
}

function resolveWorkflowStepStates(state, phase) {
  switch (phase) {
    case "ready":
      return ["done", "current", "pending"];
    case "running":
      return ["done", "current", "pending"];
    case "success":
      return ["done", "done", "current"];
    case "error":
      return [state.files.length > 0 ? "done" : "current", "error", "pending"];
    case "cancelled":
      return [state.files.length > 0 ? "done" : "current", "pending", "pending"];
    case "idle":
    default:
      return ["current", "pending", "pending"];
  }
}

function buildIdleStatusMessage(state) {
  return `파일을 추가하면 변환을 시작할 수 있습니다. 지원 형식: ${describeAcceptedFormats(state.input)}. 파일은 브라우저에서 로컬로 처리됩니다.`;
}

function describeAcceptedFormats(input) {
  const accept = String(input.accept || "").trim();

  if (!accept) {
    return "이 도구가 허용하는 형식";
  }

  const labels = accept
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const normalized = item.toLowerCase();

      if (normalized.startsWith(".")) {
        const extension = normalized.slice(1);

        if (extension === "jpg" || extension === "jpeg") {
          return "JPG";
        }

        if (extension === "tif" || extension === "tiff") {
          return "TIFF";
        }

        return extension.toUpperCase();
      }

      if (normalized.includes("pdf")) {
        return "PDF";
      }

      if (normalized.includes("presentation")) {
        return "PPTX";
      }

      if (normalized.includes("png")) {
        return "PNG";
      }

      if (normalized.includes("jpeg")) {
        return "JPG";
      }

      if (normalized.includes("webp")) {
        return "WEBP";
      }

      if (normalized.includes("svg")) {
        return "SVG";
      }

      if (normalized.includes("tiff")) {
        return "TIFF";
      }

      if (normalized.includes("mpeg")) {
        return "MP3";
      }

      return item.toUpperCase();
    });

  return [...new Set(labels)].join(", ");
}

function buildFileSummaryText(state) {
  if (state.files.length === 0) {
    return "파일 없음";
  }

  const totalBytes = getTotalFileBytes(state.files);
  const parts = [`총 ${state.files.length}개`, formatFileSize(totalBytes)];

  if (state.files.length >= WARNING_FILE_COUNT || totalBytes >= WARNING_TOTAL_SIZE_BYTES) {
    parts.push("대용량 작업");
  }

  return parts.join(" · ");
}

function buildPreparedStatusMessage(state, duplicateCount = 0) {
  const totalBytes = getTotalFileBytes(state.files);
  const warnings = [];

  if (duplicateCount > 0) {
    warnings.push(`중복 ${duplicateCount}개는 제외했습니다.`);
  }

  if (state.files.length >= WARNING_FILE_COUNT || totalBytes >= WARNING_TOTAL_SIZE_BYTES) {
    warnings.push("파일 수 또는 용량이 커서 변환 시간이 길어질 수 있습니다.");
  }

  return `${state.files.length}개 파일 준비가 완료되었습니다. 총 ${formatFileSize(totalBytes)}. ${state.config.statusReady}${
    warnings.length > 0 ? ` ${warnings.join(" ")}` : ""
  }`;
}

function validateSelectionBudget(existingFiles, nextFiles, shouldAppend) {
  const oversizedFile = nextFiles.find((file) => file.size > MAX_FILE_SIZE_BYTES);

  if (oversizedFile) {
    return `${oversizedFile.name} 파일은 ${formatFileSize(MAX_FILE_SIZE_BYTES)} 제한을 초과했습니다. 파일당 최대 120MB까지 추가할 수 있습니다.`;
  }

  const candidateFiles = shouldAppend ? [...existingFiles, ...nextFiles] : [...nextFiles];

  if (candidateFiles.length > MAX_FILE_COUNT) {
    return `파일은 한 번에 최대 ${MAX_FILE_COUNT}개까지 준비할 수 있습니다. 현재 선택 기준 ${candidateFiles.length}개입니다.`;
  }

  const totalBytes = getTotalFileBytes(candidateFiles);

  if (totalBytes > MAX_TOTAL_SIZE_BYTES) {
    return `총 파일 크기 ${formatFileSize(totalBytes)}는 허용 한도 ${formatFileSize(MAX_TOTAL_SIZE_BYTES)}를 넘었습니다. 총 250MB 이하로 줄여 주세요.`;
  }

  return "";
}

function getTotalFileBytes(files) {
  return files.reduce((total, file) => total + Number(file?.size || 0), 0);
}

function syncControlStates(state) {
  const busy = isPanelBusy(state);
  const hasFiles = state.files.length > 0;

  state.panel.dataset.busy = String(busy);
  state.convertButton.disabled = busy || !hasFiles;
  state.clearButton.disabled = busy || !hasFiles;
  state.cancelButton.disabled = !busy;
  state.downloadAllButton.disabled = busy || state.results.length === 0;
  state.input.disabled = busy;
  state.dropTarget.disabled = busy;
  state.dropTarget.setAttribute("aria-disabled", String(busy));
  state.uploaderBox.dataset.busy = String(busy);
  state.uploaderBox.classList.toggle("is-busy", busy);
  state.list.dataset.busy = String(busy);
  setSettingsDisabled(state, busy);

  state.list.querySelectorAll("button, input, select").forEach((element) => {
    element.disabled = busy;
  });
}

function isPanelBusy(state) {
  return state.activeJobToken !== 0;
}

function cancelRunningJob(state) {
  if (!isPanelBusy(state)) {
    return;
  }

  cancelActiveJob(state);
  state.results = [];
  renderState(state);
  syncControlStates(state);
  setWorkflowPhase(state, "cancelled", "변환을 취소했습니다. 파일과 설정은 그대로 유지됩니다.");
}

function renderFileSortControls(panel, state) {
  if (!state.input.multiple) {
    return null;
  }

  const controls = document.createElement("div");
  controls.className = "file-sort-controls";
  controls.setAttribute("role", "group");

  const label = document.createElement("span");
  label.className = "file-sort-label";
  label.id = `${state.panel.dataset.tool}-file-sort-label`;
  label.textContent = "파일 정렬";
  controls.setAttribute("aria-labelledby", label.id);

  const options = document.createElement("div");
  options.className = "file-sort-options";
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", "파일 정렬 형식");

  fileSortModes.forEach((sortMode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "file-sort-button";
    button.dataset.sortMode = sortMode.value;
    button.textContent = sortMode.label;
    button.addEventListener("click", () => setFileSortMode(state, sortMode.value));
    options.append(button);
  });

  controls.append(label, options);
  panel.insertBefore(controls, state.list);
  state.sortControlsRoot = controls;
  updateFileSortControls(state);
  return controls;
}

function setFileSortMode(state, sortMode) {
  if (isPanelBusy(state)) {
    setWorkflowPhase(state, "running", "변환 중에는 파일 순서를 바꿀 수 없습니다. 필요하면 변환 취소를 눌러 주세요.");
    return;
  }

  state.fileSortMode = getFileSortMode(sortMode).value;
  updateFileSortControls(state);

  if (state.files.length === 0) {
    setWorkflowPhase(state, "idle", `다음 업로드부터 ${getFileSortModeLabel(state.fileSortMode)} 형식으로 정렬합니다.`);
    return;
  }

  applySortedUploadRecords(state);
  state.results = [];
  renderState(state);
  syncControlStates(state);
  setWorkflowPhase(
    state,
    "ready",
    `${buildPreparedStatusMessage(state)} ${createFileSortStatusMessage(state.fileSortMode)}`
  );
}

function updateFileSortControls(state) {
  state.sortControlsRoot?.querySelectorAll("[data-sort-mode]").forEach((button) => {
    const isActive = button.dataset.sortMode === state.fileSortMode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setupDirectionSwitchers() {
  document.querySelectorAll('[data-role="direction-switcher"]').forEach((switcher) => {
    const root = switcher.closest("main") || document;
    const buttons = Array.from(switcher.querySelectorAll("[data-direction-target]"));
    const panels = Array.from(root.querySelectorAll("[data-direction-panel]"));

    if (buttons.length === 0 || panels.length === 0) {
      return;
    }

    const requestedDirection =
      new URLSearchParams(window.location.search).get("direction") || window.location.hash.replace(/^#/, "");
    const initialTarget = buttons.some((button) => button.dataset.directionTarget === requestedDirection)
      ? requestedDirection
      : buttons[0].dataset.directionTarget;

    const activateDirection = (target, shouldUpdateUrl = false) => {
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.directionPanel !== target;
      });
      buttons.forEach((button) => {
        const isActive = button.dataset.directionTarget === target;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });

      if (shouldUpdateUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set("direction", target);
        window.history.replaceState(null, "", url);
      }
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => activateDirection(button.dataset.directionTarget, true));
    });
    activateDirection(initialTarget);
  });
}

function setupDropzone(state) {
  const enterDropState = (event) => {
    if (isPanelBusy(state) || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth += 1;
    state.uploaderBox.classList.add("is-drag-over");
    state.dropTarget?.classList.add("is-drag-over");
  };

  const leaveDropState = (event) => {
    if (isPanelBusy(state) || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth = Math.max(0, state.dragDepth - 1);

    if (state.dragDepth === 0) {
      state.uploaderBox.classList.remove("is-drag-over");
      state.dropTarget?.classList.remove("is-drag-over");
    }
  };

  state.uploaderBox.addEventListener("dragenter", enterDropState);
  state.uploaderBox.addEventListener("dragover", (event) => {
    if (isPanelBusy(state) || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    state.uploaderBox.classList.add("is-drag-over");
    state.dropTarget?.classList.add("is-drag-over");
  });
  state.uploaderBox.addEventListener("dragleave", leaveDropState);
  state.uploaderBox.addEventListener("drop", (event) => {
    if (isPanelBusy(state) || !hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth = 0;
    state.uploaderBox.classList.remove("is-drag-over");
    state.dropTarget?.classList.remove("is-drag-over");
    processSelectedFiles(state, Array.from(event.dataTransfer?.files || []));
  });
}

function ensureDropTarget(state) {
  const existingTarget = state.uploaderBox.querySelector(".uploader-drop-target");

  if (existingTarget) {
    existingTarget.addEventListener("click", () => {
      if (!existingTarget.disabled) {
        state.input.click();
      }
    });
    return existingTarget;
  }

  const dropTarget = document.createElement("button");
  const title = document.createElement("span");
  const description = document.createElement("span");

  title.className = "uploader-drop-target-title";
  title.textContent = "파일을 놓거나 눌러서 선택";
  description.className = "uploader-drop-target-description";
  description.textContent =
    `지원 형식: ${describeAcceptedFormats(state.input)} · 최대 ${MAX_FILE_COUNT}개, 파일당 120MB, 총 250MB · ` +
    "브라우저에서 로컬로 처리";
  dropTarget.className = "uploader-drop-target";
  dropTarget.type = "button";
  dropTarget.append(title, description);
  dropTarget.addEventListener("click", () => {
    if (!dropTarget.disabled) {
      state.input.click();
    }
  });
  dropTarget.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && !dropTarget.disabled) {
      event.preventDefault();
      state.input.click();
    }
  });
  state.uploaderBox.insertBefore(dropTarget, state.uploaderBox.firstChild);
  return dropTarget;
}

function hasDraggedFiles(event) {
  const types = event.dataTransfer?.types;

  if (!types) {
    return false;
  }

  return Array.from(types).includes("Files");
}

function processSelectedFiles(state, nextFiles) {
  if (isPanelBusy(state)) {
    setWorkflowPhase(state, "running", "변환 중에는 새 파일을 추가할 수 없습니다. 필요하면 먼저 변환을 취소해 주세요.");
    return;
  }

  if (nextFiles.length === 0) {
    setWorkflowPhase(state, state.files.length > 0 ? "ready" : "idle", "추가된 파일이 없습니다.");
    return;
  }

  const invalidReason = validateFilesForConfig(nextFiles, state.config);

  if (invalidReason) {
    state.input.value = "";
    setWorkflowPhase(state, "error", invalidReason);
    return;
  }

  const { files: acceptedFiles, duplicateCount } = getAcceptedFiles(
    nextFiles,
    shouldAppendFiles(state.config) ? state.files : []
  );

  if (acceptedFiles.length === 0) {
    state.input.value = "";
    setWorkflowPhase(
      state,
      "error",
      duplicateCount > 0 ? `중복 파일 ${duplicateCount}개는 제외했습니다. 다른 파일을 선택해 주세요.` : "추가된 파일이 없습니다."
    );
    return;
  }

  const budgetError = validateSelectionBudget(
    shouldAppendFiles(state.config) ? state.files : [],
    acceptedFiles,
    shouldAppendFiles(state.config)
  );

  if (budgetError) {
    state.input.value = "";
    setWorkflowPhase(state, "error", budgetError);
    return;
  }

  cancelActiveJob(state);
  const sortedAcceptedFiles = sortFilesForMode(acceptedFiles, state.fileSortMode);
  const nextPreviews = sortedAcceptedFiles.map((file) => createPreviewRecord(file));
  const nextFrameSettings = createFrameSettings(sortedAcceptedFiles, state.settings.gifFrameDelay);
  const nextFileSettings = createFileSettings(sortedAcceptedFiles, state);
  const nextUploadRecords = createUploadRecords({
    files: sortedAcceptedFiles,
    previews: nextPreviews,
    frameSettings: nextFrameSettings,
    fileSettings: nextFileSettings,
    startIndex: shouldAppendFiles(state.config) ? state.files.length : 0,
  });
  const uploadRecords = sortUploadRecords(
    shouldAppendFiles(state.config)
      ? [
          ...createUploadRecords({
            files: state.files,
            previews: state.previews,
            frameSettings: state.frameSettings,
            fileSettings: state.fileSettings,
          }),
          ...nextUploadRecords,
        ]
      : nextUploadRecords,
    state.fileSortMode
  );

  if (shouldAppendFiles(state.config)) {
    applyUploadRecords(state, uploadRecords);
  } else {
    revokePreviewUrls(state.previews);
    applyUploadRecords(state, uploadRecords);
  }

  state.results = [];
  renderState(state);
  syncControlStates(state);
  state.input.value = "";
  setWorkflowPhase(
    state,
    "ready",
    `${buildPreparedStatusMessage(state, duplicateCount)} ${createFileSortStatusMessage(state.fileSortMode)}`
  );
}

function createUploadRecords({ files, previews, frameSettings, fileSettings, startIndex = 0 }) {
  return files.map((file, index) => ({
    file,
    preview: previews[index],
    frameSetting: frameSettings[index],
    fileSetting: fileSettings[index],
    order: startIndex + index,
  }));
}

function sortUploadRecords(records, sortMode) {
  const normalizedSortMode = getFileSortMode(sortMode).value;

  if (normalizedSortMode === "random") {
    return shuffleRecords(records);
  }

  const direction = normalizedSortMode === "name-desc" ? -1 : 1;

  return [...records].sort((left, right) => {
    const compared = compareFileNames(left.file, right.file) * direction;
    return compared || left.order - right.order;
  });
}

function sortFilesForMode(files, sortMode) {
  return sortUploadRecords(
    createUploadRecords({
      files,
      previews: [],
      frameSettings: [],
      fileSettings: [],
    }),
    sortMode
  ).map((record) => record.file);
}

function compareFileNames(left, right) {
  return left.name.localeCompare(right.name, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function applyUploadRecords(state, records) {
  state.files = records.map((record) => record.file);
  state.previews = records.map((record) => record.preview);
  state.frameSettings = records.map((record) => record.frameSetting);
  state.fileSettings = records.map((record) => record.fileSetting);
}

function applySortedUploadRecords(state) {
  applyUploadRecords(
    state,
    sortUploadRecords(
      createUploadRecords({
        files: state.files,
        previews: state.previews,
        frameSettings: state.frameSettings,
        fileSettings: state.fileSettings,
      }),
      state.fileSortMode
    )
  );
}

function shuffleRecords(records) {
  const shuffled = [...records];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function getFileSortMode(sortMode) {
  return fileSortModes.find((candidate) => candidate.value === sortMode) || fileSortModes[0];
}

function getFileSortModeLabel(sortMode) {
  return getFileSortMode(sortMode).label;
}

function createFileSortStatusMessage(sortMode) {
  return `${getFileSortModeLabel(sortMode)} 형식으로 정렬되었습니다.`;
}

function getSettingsDefinitions(config) {
  return [...(config.settings || []), ...sharedOutputSettings];
}

function renderSettingsPanel(panel, state) {
  const primarySettings = state.config.settings || [];

  if (primarySettings.length === 0 && sharedOutputSettings.length === 0) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "settings-panel";
  section.setAttribute("aria-label", "설정");

  const heading = document.createElement("div");
  heading.className = "settings-heading";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "SETTINGS";

  const title = document.createElement("h3");
  title.textContent = "설정";

  const description = document.createElement("p");
  description.textContent = "핵심 옵션을 먼저 보여 주고, 파일명 규칙은 고급 설정으로 접어 둡니다.";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "settings-reset-button";
  resetButton.textContent = "기본값 복원";
  resetButton.addEventListener("click", () => restoreDefaultSettings(state));

  heading.append(eyebrow, title, description, resetButton);
  section.append(heading);

  if (primarySettings.length > 0) {
    const grid = document.createElement("div");
    grid.className = "settings-grid";
    primarySettings.forEach((setting) => {
      grid.append(createSettingField(setting, state));
    });
    section.append(grid);
  }

  if (sharedOutputSettings.length > 0) {
    const details = document.createElement("details");
    details.className = "advanced-output-settings";

    const summary = document.createElement("summary");
    summary.textContent = "파일명 고급 설정";

    const advancedGrid = document.createElement("div");
    advancedGrid.className = "settings-grid advanced-settings-grid";
    sharedOutputSettings.forEach((setting) => {
      advancedGrid.append(createSettingField(setting, state));
    });

    details.append(summary, advancedGrid);
    section.append(details);
  }

  state.list.insertAdjacentElement("afterend", section);
  return section;
}

function createSettingField(setting, state) {
  const field = document.createElement("label");
  field.className = "setting-field";
  field.dataset.settingType = setting.type;
  field.dataset.settingKey = setting.key;

  const labelRow = document.createElement("span");
  labelRow.className = "setting-label-row";

  const label = document.createElement("span");
  label.className = "setting-label";
  label.textContent = setting.label;
  labelRow.append(label);

  const description = document.createElement("span");
  description.className = "setting-description";
  description.textContent = setting.description || "";

  let input;
  let valuePreview = null;

  if (setting.type === "select") {
    input = document.createElement("select");
    setting.options.forEach((option) => {
      const optionElement = document.createElement("option");
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      input.append(optionElement);
    });
    input.value = String(state.settings[setting.key]);
  } else if (setting.type === "checkbox") {
    field.classList.add("is-checkbox");
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(state.settings[setting.key]);
    input.dataset.settingKey = setting.key;
    labelRow.append(input, label);
    field.append(labelRow, description);
    bindSettingInput(input, setting, state, null);
    return field;
  } else {
    input = document.createElement("input");
    input.type = setting.type;
    input.value = String(state.settings[setting.key] ?? "");

    if (setting.placeholder) {
      input.placeholder = setting.placeholder;
    }

    if (setting.type === "range") {
      input.min = String(setting.min);
      input.max = String(setting.max);
      input.step = String(setting.step);
      input.value = String(state.settings[setting.key]);
      valuePreview = document.createElement("span");
      valuePreview.className = "setting-value";
      valuePreview.textContent = formatSettingValue(setting, state.settings[setting.key]);
      labelRow.append(valuePreview);
    } else if (setting.type === "color") {
      input.value = String(state.settings[setting.key]);
      valuePreview = document.createElement("span");
      valuePreview.className = "setting-value setting-color-value";
      valuePreview.textContent = String(state.settings[setting.key]).toUpperCase();
      labelRow.append(valuePreview);
    } else if (setting.type === "number") {
      if (setting.min !== undefined) {
        input.min = String(setting.min);
      }

      if (setting.max !== undefined) {
        input.max = String(setting.max);
      }

      if (setting.step !== undefined) {
        input.step = String(setting.step);
      }
    }
  }

  input.dataset.settingKey = setting.key;
  field.append(labelRow, description, input);
  bindSettingInput(input, setting, state, valuePreview);
  return field;
}

function bindSettingInput(input, setting, state, valuePreview) {
  state.settingsControls.push({ input, setting, valuePreview });
  const update = () => {
    const nextValue =
      setting.type === "checkbox"
        ? input.checked
        : setting.type === "range" || setting.type === "number"
          ? Number(input.value)
          : input.value;

    state.settings[setting.key] = nextValue;
    persistSettings(state);

    if (valuePreview) {
      valuePreview.textContent = formatSettingValue(setting, nextValue);
    }

    if (typeof state.config.onSettingChange === "function") {
      state.config.onSettingChange({ state, setting, value: nextValue, api: ToolPage });
    }

    if (state.results.length > 0) {
      state.results = [];
      renderState(state);
      syncControlStates(state);
      setWorkflowPhase(state, "ready", "설정이 변경되었습니다. 현재 파일로 다시 변환해 주세요.");
    }
  };

  input.addEventListener("input", update);
  input.addEventListener("change", update);
}

function buildDefaultSettings(config) {
  return getSettingsDefinitions(config).reduce((accumulator, setting) => {
    accumulator[setting.key] = setting.defaultValue;
    return accumulator;
  }, {});
}

function loadStoredSettings(config) {
  const defaults = buildDefaultSettings(config);

  try {
    const raw = window.localStorage.getItem(getSettingsStorageKey(config.name));

    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw);
    return getSettingsDefinitions(config).reduce((accumulator, setting) => {
      accumulator[setting.key] = normalizeStoredSettingValue(setting, parsed?.[setting.key]);
      return accumulator;
    }, { ...defaults });
  } catch (error) {
    console.warn("설정 복원에 실패했습니다.", error);
    return defaults;
  }
}

function persistSettings(state) {
  try {
    window.localStorage.setItem(getSettingsStorageKey(state.config.name), JSON.stringify(state.settings));
  } catch (error) {
    console.warn("설정 저장에 실패했습니다.", error);
  }
}

function restoreDefaultSettings(state) {
  if (isPanelBusy(state)) {
    setWorkflowPhase(state, "running", "변환 중에는 설정을 초기값으로 돌릴 수 없습니다.");
    return;
  }

  const defaults = buildDefaultSettings(state.config);
  state.settings = { ...defaults };
  state.settingsControls.forEach(({ input, setting, valuePreview }) => {
    applySettingControlValue(input, setting, valuePreview, defaults[setting.key]);
    if (typeof state.config.onSettingChange === "function") {
      state.config.onSettingChange({ state, setting, value: defaults[setting.key], api: ToolPage });
    }
  });
  persistSettings(state);

  if (state.results.length > 0) {
    state.results = [];
    renderState(state);
  }

  syncControlStates(state);
  setWorkflowPhase(state, state.files.length > 0 ? "ready" : "idle", "설정을 기본값으로 복원했습니다.");
}

function applySettingControlValue(input, setting, valuePreview, value) {
  if (setting.type === "checkbox") {
    input.checked = Boolean(value);
  } else {
    input.value = String(value ?? "");
  }

  if (valuePreview) {
    valuePreview.textContent = formatSettingValue(setting, value);
  }
}

function getSettingsStorageKey(toolName) {
  return `tool-page:settings:${toolName}`;
}

function normalizeStoredSettingValue(setting, value) {
  if (value === undefined || value === null) {
    return setting.defaultValue;
  }

  if (setting.type === "checkbox") {
    return Boolean(value);
  }

  if (setting.type === "range" || setting.type === "number") {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : setting.defaultValue;
  }

  if (setting.type === "select") {
    return setting.options.some((option) => option.value === value) ? value : setting.defaultValue;
  }

  return String(value);
}

function formatSettingValue(setting, value) {
  if (typeof setting.valueLabel === "function") {
    return setting.valueLabel(value);
  }

  if (setting.type === "color") {
    return String(value).toUpperCase();
  }

  return String(value);
}

function cancelActiveJob(state) {
  const activeCancel = state.activeJobCancel;
  state.activeJobCancel = null;

  if (activeCancel?.cancel) {
    try {
      activeCancel.cancel();
    } catch (error) {
      console.warn("실행 중인 변환 작업을 정리하지 못했습니다.", error);
    }
  }

  state.actionToken += 1;
  state.activeJobToken = 0;
}

function setJobCancellation(state, jobToken, cancel) {
  if (typeof cancel !== "function") {
    return;
  }

  if (!isJobActive(state, jobToken)) {
    cancel();
    return;
  }

  state.activeJobCancel = { jobToken, cancel };
}

function clearJobCancellation(state, jobToken) {
  if (state.activeJobCancel?.jobToken === jobToken) {
    state.activeJobCancel = null;
  }
}

function setSettingsDisabled(state, disabled) {
  state.settingsRoot?.querySelectorAll("input, select, button").forEach((element) => {
    element.disabled = disabled;
  });
  state.sortControlsRoot?.querySelectorAll("button").forEach((element) => {
    element.disabled = disabled;
  });
  state.list?.querySelectorAll("[data-file-setting-input]").forEach((element) => {
    element.disabled = disabled;
  });
}

function isJobActive(state, jobToken) {
  return state.activeJobToken === jobToken && state.actionToken === jobToken;
}

function assertJobActive(state, jobToken) {
  if (!isJobActive(state, jobToken)) {
    throw new Error("취소된 작업입니다.");
  }
}

function renderState(state) {
  state.list.innerHTML = "";
  state.list.classList.remove("is-reorderable");

  if (state.files.length === 0) {
    return;
  }

  if (state.config.mode === "image") {
    renderImageState(state);
    return;
  }

  if (isDocumentImageMode(state.config)) {
    renderDocumentImageState(state);
    return;
  }

  renderQueueState(state);
}

function renderImageState(state) {
  state.files.forEach((file, index) => {
    const result = state.results[index];
    const card = document.createElement("article");
    card.className = "file-card media-card uploaded-card";

    const preview =
      state.config.useResultPreviewAsFilePreview && result?.previewDataUrl
        ? createRenderedImagePreview(result, String(index + 1).padStart(2, "0"))
        : createFilePreview(state.previews[index], file.name, {
            badgeText: String(index + 1).padStart(2, "0"),
          });

    const meta = document.createElement("div");
    meta.className = "file-meta";

    const title = document.createElement("strong");
    title.textContent = file.name;

    const info = document.createElement("span");
    info.textContent = result
      ? `완료 · ${formatFileSize(result.blob.size)} · ${result.fileName}`
      : `대기 중 · ${formatFileSize(file.size)}`;

    meta.append(title, info);

    if (typeof state.config.createImageFileControls === "function") {
      const controls = state.config.createImageFileControls({ state, file, index, result, api: ToolPage });

      if (controls) {
        meta.append(controls);
      }
    }

    const actions = document.createElement("div");
    actions.className = "file-actions";

    actions.append(createRemoveButton(state, index, file.name));

    if (result) {
      const downloadButton = document.createElement("button");
      downloadButton.type = "button";
      downloadButton.className = "download-link";
      downloadButton.textContent = "개별 다운로드";
      downloadButton.addEventListener("click", () => downloadBlob(result.blob, result.fileName));
      actions.append(downloadButton);
    }

    card.append(preview, meta, actions);
    state.list.append(card);
  });
}

function renderDocumentImageState(state) {
  const [file] = state.files;

  if (!file) {
    return;
  }

  const sourceCard = document.createElement("article");
  sourceCard.className = "file-card media-card uploaded-card";

  const sourcePreview = createDocumentPreview(state.config.sourceLabel || "문서", "SOURCE");

  const sourceMeta = document.createElement("div");
  sourceMeta.className = "file-meta";

  const sourceTitle = document.createElement("strong");
  sourceTitle.textContent = file.name;

  const sourceInfo = document.createElement("span");
  sourceInfo.textContent =
    state.results.length > 0
      ? `완료 · ${state.results.length}개 이미지 생성 · ${formatFileSize(file.size)}`
      : `대기 중 · ${formatFileSize(file.size)}`;

  sourceMeta.append(sourceTitle, sourceInfo);

  const sourceActions = document.createElement("div");
  sourceActions.className = "file-actions";
  sourceActions.append(createRemoveButton(state, 0, file.name));

  sourceCard.append(sourcePreview, sourceMeta, sourceActions);
  state.list.append(sourceCard);

  state.results.forEach((result, index) => {
    const card = document.createElement("article");
    card.className = "file-card media-card result-image-card";

    const preview = createRenderedImagePreview(result, `${state.config.resultLabel || "이미지"} ${index + 1}`);

    const meta = document.createElement("div");
    meta.className = "file-meta";

    const title = document.createElement("strong");
    title.textContent = result.fileName;

    const info = document.createElement("span");
    info.textContent = `완료 · ${formatFileSize(result.blob.size)} · ${result.width}x${result.height}`;

    meta.append(title, info);

    const actions = document.createElement("div");
    actions.className = "file-actions";

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "download-link";
    downloadButton.textContent = "개별 다운로드";
    downloadButton.addEventListener("click", () => downloadBlob(result.blob, result.fileName));
    actions.append(downloadButton);

    card.append(preview, meta, actions);
    state.list.append(card);
  });
}

function renderQueueState(state) {
  const isReorderable = Boolean(state.config.reorderable) && state.files.length > 1;
  state.list.classList.toggle("is-reorderable", isReorderable && state.files.length > 1);

  if (typeof state.config.createQueueUtilityBar === "function" && state.files.length > 1) {
    state.list.append(state.config.createQueueUtilityBar({ state, api: ToolPage }));
  }

  if (isReorderable && state.files.length > 1) {
    const guide = document.createElement("p");
    guide.className = "queue-guide";
    guide.textContent =
      "DRAG 핸들을 잡고 원하는 위치로 옮겨 순서를 바꾸세요. 키보드에서는 핸들을 선택한 뒤 ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, End로 이동할 수 있습니다.";
    state.list.append(guide);
  }

  state.files.forEach((file, index) => {
    const card = document.createElement("article");
    card.className = "file-card queue-card media-card uploaded-card";
    card.draggable = false;
    card.dataset.index = String(index);
    card.setAttribute("aria-label", `${file.name}, ${index + 1}번째 순서`);

    const preview = createFilePreview(state.previews[index], file.name, {
      badgeText: String(index + 1).padStart(2, "0"),
      captionText:
        typeof state.config.getQueueCaptionText === "function"
          ? state.config.getQueueCaptionText({ state, file, index })
          : "ORDER",
      deleteAction:
        typeof state.config.createPreviewDeleteAction === "function"
          ? state.config.createPreviewDeleteAction({ state, file, index, api: ToolPage })
          : null,
      deleteLabel:
        typeof state.config.getPreviewDeleteLabel === "function"
          ? state.config.getPreviewDeleteLabel({ state, file, index })
          : `${file.name} 삭제`,
    });

    const meta = document.createElement("div");
    meta.className = "file-meta";

    const title = document.createElement("strong");
    title.textContent = file.name;

    const info = document.createElement("span");
    info.textContent = `${index + 1}번째 순서 · ${formatFileSize(file.size)}`;
    meta.append(title, info);

    const actions = document.createElement("div");
    actions.className = "queue-actions";

    if (isReorderable) {
      const dragToolbar = document.createElement("div");
      dragToolbar.className = "queue-toolbar";

      const handle = document.createElement("button");
      handle.type = "button";
      handle.className = "queue-drag-handle";
      handle.textContent = "DRAG";
      handle.draggable = true;
      handle.setAttribute(
        "aria-label",
        `${file.name} 순서 이동. 현재 ${index + 1}번째입니다. ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Home, End 또는 드래그로 이동하세요.`
      );
      handle.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown Home End");
      handle.addEventListener("click", () => {
        setWorkflowPhase(state, "ready", "핸들을 드래그하거나 방향키로 파일 순서를 바꿔 주세요.");
      });
      handle.addEventListener("keydown", (event) => handleQueueKeydown(event, state, index));
      handle.addEventListener("pointerdown", (event) => startPointerQueueDrag(event, state, index, card, handle));
      handle.addEventListener("pointermove", (event) => updatePointerQueueDrag(event, state));
      handle.addEventListener("pointerup", (event) => finishPointerQueueDrag(event, state));
      handle.addEventListener("pointercancel", () => cancelPointerQueueDrag(state));
      handle.addEventListener("dragstart", (event) => startQueueDrag(event, state, index, card));
      handle.addEventListener("dragend", () => endQueueDrag(state));

      const position = document.createElement("span");
      position.className = "queue-position";
      position.textContent = String(index + 1).padStart(2, "0");

      dragToolbar.append(position, handle);
      actions.append(dragToolbar);

      card.addEventListener("dragover", (event) => updateQueueDropTarget(event, state, index, card));
      card.addEventListener("dragleave", () => clearQueueDropIndicators(state));
      card.addEventListener("drop", (event) => finishQueueDrop(event, state, index, card));
    } else {
      const position = document.createElement("span");
      position.className = "queue-position";
      position.textContent = String(index + 1).padStart(2, "0");
      actions.append(position);
    }

    if (!state.config.hideDefaultRemoveAction) {
      actions.append(createRemoveButton(state, index, file.name));
    }

    if (typeof state.config.renderAdditionalFileActions === "function") {
      state.config.renderAdditionalFileActions({ state, file, index, actions, api: ToolPage });
    }

    card.append(preview, meta, actions);
    state.list.append(card);
  });

  const result = state.results[0];

  if (!result) {
    return;
  }

  const resultCard = document.createElement("article");
  resultCard.className = "file-card result-card";

  const resultMeta = document.createElement("div");
  resultMeta.className = "file-meta";

  const resultTitle = document.createElement("strong");
  resultTitle.textContent = result.fileName;

  const resultInfo = document.createElement("span");
  resultInfo.textContent =
    typeof state.config.describeResult === "function"
      ? state.config.describeResult({ state, result, api: ToolPage })
      : `완료 · ${formatFileSize(result.blob.size)} · ${state.config.resultTypeLabel || "결과 파일"}`;

  resultMeta.append(resultTitle, resultInfo);

  if (result.previewDataUrl && state.config.showResultPreview !== false) {
    const preview = document.createElement("img");
    preview.className = "result-preview";
    preview.src = result.previewDataUrl;
    preview.alt = `${result.fileName} 미리보기`;
    resultMeta.append(preview);
  }

  const resultActions = document.createElement("div");
  resultActions.className = "file-actions";

  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.className = "download-link";
  downloadButton.textContent = state.config.resultDownloadLabel || state.config.downloadAllLabel || "다운로드";
  downloadButton.addEventListener("click", () => downloadBlob(result.blob, result.fileName));
  resultActions.append(downloadButton);

  resultCard.append(resultMeta, resultActions);
  state.list.append(resultCard);
}

function startQueueDrag(event, state, index, card) {
  if (isPanelBusy(state)) {
    return;
  }

  state.dragIndex = index;
  state.dropInsertionIndex = index;
  state.dropMoveTargetIndex = index;
  card.classList.add("is-dragging");

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }
}

function updateQueueDropTarget(event, state, index, card) {
  if (isPanelBusy(state) || state.dragIndex === null) {
    return;
  }

  event.preventDefault();
  previewQueueMove(state, getQueueMovePlanFromPoint(state, state.dragIndex, event.clientX, event.clientY));

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function finishQueueDrop(event, state, index, card) {
  if (isPanelBusy(state)) {
    return;
  }

  event.preventDefault();

  const rawIndex = event.dataTransfer?.getData("text/plain");
  const fromIndex = state.dragIndex ?? Number(rawIndex);
  const movePlan =
    state.dropMoveTargetIndex === null
      ? getQueueMovePlanFromPoint(state, fromIndex, event.clientX, event.clientY)
      : createQueueMovePlan(state.files.length, fromIndex, state.dropMoveTargetIndex);

  reorderFile(state, fromIndex, movePlan.targetIndex);
  endQueueDrag(state);
}

function clearQueueDropIndicators(state) {
  state.list.querySelectorAll(".queue-card").forEach((card) => {
    card.classList.remove("drop-before", "drop-after", "is-preview-active", "is-preview-shifted");
  });
}

function endQueueDrag(state) {
  state.dragIndex = null;
  state.dropInsertionIndex = null;
  state.dropMoveTargetIndex = null;
  resetQueuePreview(state);
  state.list.querySelectorAll(".queue-card").forEach((card) => {
    card.classList.remove("is-dragging", "drop-before", "drop-after");
  });
}

function handleQueueKeydown(event, state, index) {
  if (isPanelBusy(state)) {
    return;
  }

  const movementByKey = {
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    ArrowUp: index - 1,
    ArrowDown: index + 1,
    Home: 0,
    End: state.files.length - 1,
  };

  if (!(event.key in movementByKey)) {
    return;
  }

  event.preventDefault();
  reorderFile(state, index, movementByKey[event.key], { focusMoved: true });
}

function startPointerQueueDrag(event, state, index, card, handle) {
  if (isPanelBusy(state) || event.isPrimary === false || state.files.length <= 1) {
    return;
  }

  event.preventDefault();
  state.pointerDrag = {
    fromIndex: index,
    pointerId: event.pointerId,
    handle,
  };
  state.dragIndex = index;
  state.dropMoveTargetIndex = index;
  card.classList.add("is-dragging");
  handle.setPointerCapture?.(event.pointerId);
}

function updatePointerQueueDrag(event, state) {
  if (isPanelBusy(state) || !state.pointerDrag || state.pointerDrag.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  previewQueueMove(state, getQueueMovePlanFromPoint(state, state.pointerDrag.fromIndex, event.clientX, event.clientY));
}

function finishPointerQueueDrag(event, state) {
  if (isPanelBusy(state) || !state.pointerDrag || state.pointerDrag.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  const { fromIndex, handle, pointerId } = state.pointerDrag;
  const movePlan =
    state.dropMoveTargetIndex === null
      ? getQueueMovePlanFromPoint(state, fromIndex, event.clientX, event.clientY)
      : createQueueMovePlan(state.files.length, fromIndex, state.dropMoveTargetIndex);

  if (handle.hasPointerCapture?.(pointerId)) {
    handle.releasePointerCapture(pointerId);
  }

  state.pointerDrag = null;
  reorderFile(state, fromIndex, movePlan.targetIndex, { focusMoved: true });
  endQueueDrag(state);
}

function cancelPointerQueueDrag(state) {
  state.pointerDrag = null;
  endQueueDrag(state);
}

function showDropIndicator(state, movePlan) {
  if (!movePlan || !movePlan.isValid || movePlan.isNoop) {
    return;
  }

  const card = state.list.querySelector(`.queue-card[data-index="${movePlan.targetIndex}"]`);

  if (!card) {
    return;
  }

  card.classList.add(movePlan.targetIndex > movePlan.fromIndex ? "drop-after" : "drop-before");
}

function previewQueueMove(state, movePlan) {
  const previousTargetIndex = state.dropMoveTargetIndex;
  state.dropInsertionIndex = movePlan.insertionIndex;
  state.dropMoveTargetIndex = movePlan.targetIndex;
  clearQueueDropIndicators(state);
  showDropIndicator(state, movePlan);
  updateQueuePreview(state, movePlan.targetIndex);

  if (previousTargetIndex !== movePlan.targetIndex) {
    setWorkflowPhase(state, "ready", describeQueueMovePlan(state, movePlan));
  }
}

function getQueueMovePlanFromPoint(state, fromIndex, clientX, clientY) {
  const cards = getQueueCardRects(state);

  if (cards.length === 0) {
    return createQueueMovePlan(state.files.length, fromIndex, 0);
  }

  const hoveredCard = getQueueCardAtPoint(cards, clientX, clientY);

  if (hoveredCard && hoveredCard.index !== Number(fromIndex)) {
    return createQueueMovePlan(state.files.length, fromIndex, hoveredCard.index);
  }

  const insertionIndex = getInsertionIndexFromCards(cards, clientX, clientY);
  return createQueueMovePlan(
    state.files.length,
    fromIndex,
    getQueueTargetIndexFromInsertion(state.files.length, fromIndex, insertionIndex),
    insertionIndex
  );
}

function getQueueCardRects(state) {
  return Array.from(state.list.querySelectorAll(".queue-card")).map((card) => ({
    card,
    index: Number(card.dataset.index),
    rect: card.getBoundingClientRect(),
  }));
}

function getQueueCardAtPoint(cards, clientX, clientY) {
  return cards.find(
    ({ rect }) => clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  );
}

function getInsertionIndexFromPoint(state, clientX, clientY) {
  return getInsertionIndexFromCards(getQueueCardRects(state), clientX, clientY);
}

function getInsertionIndexFromCards(cards, clientX, clientY) {
  if (cards.length === 0) {
    return 0;
  }

  const rowTolerance = 12;
  const rowCards = cards.filter(
    ({ rect }) => clientY >= rect.top - rowTolerance && clientY <= rect.bottom + rowTolerance
  );

  if (rowCards.length > 0) {
    rowCards.sort((left, right) => left.rect.left - right.rect.left);

    for (const item of rowCards) {
      if (clientX < item.rect.left + item.rect.width / 2) {
        return item.index;
      }
    }

    return rowCards[rowCards.length - 1].index + 1;
  }

  const nextRowCard = cards.find(({ rect }) => clientY < rect.top);

  if (nextRowCard) {
    return nextRowCard.index;
  }

  return cards.length;
}

function getQueueTargetIndexFromInsertion(length, fromIndex, insertionIndex) {
  const normalizedFrom = Number(fromIndex);
  const normalizedInsertion = Math.max(0, Math.min(Number(insertionIndex), length));

  if (!Number.isInteger(normalizedFrom) || normalizedFrom < 0 || normalizedFrom >= length || length <= 0) {
    return 0;
  }

  const targetIndex = normalizedFrom < normalizedInsertion ? normalizedInsertion - 1 : normalizedInsertion;
  return Math.max(0, Math.min(targetIndex, length - 1));
}

function createQueueMovePlan(length, fromIndex, targetIndex, insertionIndex = null) {
  const normalizedFrom = Number(fromIndex);
  const normalizedTarget = Math.max(0, Math.min(Number(targetIndex), Math.max(0, length - 1)));

  if (
    length <= 0 ||
    !Number.isInteger(normalizedFrom) ||
    normalizedFrom < 0 ||
    normalizedFrom >= length ||
    !Number.isInteger(normalizedTarget)
  ) {
    return {
      fromIndex: normalizedFrom,
      targetIndex: normalizedFrom,
      insertionIndex: normalizedFrom,
      isValid: false,
      isNoop: true,
    };
  }

  return {
    fromIndex: normalizedFrom,
    targetIndex: normalizedTarget,
    insertionIndex:
      insertionIndex === null
        ? normalizedTarget > normalizedFrom
          ? normalizedTarget + 1
          : normalizedTarget
        : Math.max(0, Math.min(Number(insertionIndex), length)),
    isValid: true,
    isNoop: normalizedFrom === normalizedTarget,
  };
}

function buildPreviewOrder(length, fromIndex, targetIndex) {
  const indexes = Array.from({ length }, (_, index) => index);
  const normalizedFrom = Number(fromIndex);
  const normalizedTarget = Math.max(0, Math.min(Number(targetIndex), Math.max(0, length - 1)));

  if (
    !Number.isInteger(normalizedFrom) ||
    normalizedFrom < 0 ||
    normalizedFrom >= length ||
    !Number.isInteger(normalizedTarget) ||
    normalizedFrom === normalizedTarget
  ) {
    return indexes;
  }

  const [moved] = indexes.splice(normalizedFrom, 1);
  indexes.splice(normalizedTarget, 0, moved);
  return indexes;
}

function updateQueuePreview(state, targetIndex) {
  if (state.dragIndex === null) {
    return;
  }

  const previewOrder = buildPreviewOrder(state.files.length, state.dragIndex, targetIndex);

  previewOrder.forEach((originalIndex, previewPosition) => {
    const card = state.list.querySelector(`.queue-card[data-index="${originalIndex}"]`);

    if (!card) {
      return;
    }

    const label = String(previewPosition + 1).padStart(2, "0");
    card.querySelector(".queue-position")?.replaceChildren(document.createTextNode(label));
    card.querySelector(".file-preview-badge")?.replaceChildren(document.createTextNode(label));

    if (originalIndex === state.dragIndex) {
      card.classList.add("is-preview-active");
    } else if (previewPosition !== originalIndex) {
      card.classList.add("is-preview-shifted");
    }
  });
}

function resetQueuePreview(state) {
  state.list.querySelectorAll(".queue-card").forEach((card) => {
    const index = Number(card.dataset.index);
    const label = String(index + 1).padStart(2, "0");
    card.querySelector(".queue-position")?.replaceChildren(document.createTextNode(label));
    card.querySelector(".file-preview-badge")?.replaceChildren(document.createTextNode(label));
    card.classList.remove("is-preview-active", "is-preview-shifted");
  });
}

function describeQueueMovePlan(state, movePlan) {
  if (!movePlan?.isValid || movePlan.isNoop) {
    return "현재 위치입니다. 다른 카드 위로 끌면 이동될 순서가 표시됩니다.";
  }

  const moved = state.files[movePlan.fromIndex];
  const target = state.files[movePlan.targetIndex];
  const fromLabel = `${movePlan.fromIndex + 1}번째`;
  const targetLabel = `${movePlan.targetIndex + 1}번째`;

  if (Math.abs(movePlan.targetIndex - movePlan.fromIndex) === 1 && target) {
    return `${moved.name} 파일은 ${fromLabel}에서 ${targetLabel}로 이동 예정입니다. ${target.name} 파일은 ${fromLabel}로 바뀝니다.`;
  }

  if (movePlan.targetIndex > movePlan.fromIndex) {
    return `${moved.name} 파일은 ${fromLabel}에서 ${targetLabel}로 이동 예정입니다. ${movePlan.fromIndex + 2}~${
      movePlan.targetIndex + 1
    }번째 파일은 한 칸씩 앞으로 이동합니다.`;
  }

  return `${moved.name} 파일은 ${fromLabel}에서 ${targetLabel}로 이동 예정입니다. ${movePlan.targetIndex + 1}~${
    movePlan.fromIndex
  }번째 파일은 한 칸씩 뒤로 이동합니다.`;
}

function describeQueueMoveResult(moved, target, movePlan) {
  const fromLabel = `${movePlan.fromIndex + 1}번째`;
  const targetLabel = `${movePlan.targetIndex + 1}번째`;

  if (Math.abs(movePlan.targetIndex - movePlan.fromIndex) === 1 && target) {
    return `${moved.name} 파일이 ${fromLabel}에서 ${targetLabel}로 이동했습니다. ${target.name} 파일은 ${fromLabel}로 바뀌었습니다. 현재 순서로 다시 생성해 주세요.`;
  }

  if (movePlan.targetIndex > movePlan.fromIndex) {
    return `${moved.name} 파일이 ${fromLabel}에서 ${targetLabel}로 이동했습니다. ${movePlan.fromIndex + 2}~${
      movePlan.targetIndex + 1
    }번째 파일은 한 칸씩 앞으로 이동했습니다. 현재 순서로 다시 생성해 주세요.`;
  }

  return `${moved.name} 파일이 ${fromLabel}에서 ${targetLabel}로 이동했습니다. ${movePlan.targetIndex + 1}~${
    movePlan.fromIndex
  }번째 파일은 한 칸씩 뒤로 이동했습니다. 현재 순서로 다시 생성해 주세요.`;
}

function reorderFile(state, fromIndex, targetIndex, options = {}) {
  if (isPanelBusy(state)) {
    setWorkflowPhase(state, "running", "변환 중에는 파일 순서를 바꿀 수 없습니다.");
    return;
  }

  const movePlan = createQueueMovePlan(state.files.length, fromIndex, targetIndex);

  if (!movePlan.isValid || movePlan.isNoop) {
    return;
  }

  const files = [...state.files];
  const previews = [...state.previews];
  const frameSettings = [...state.frameSettings];
  const fileSettings = [...state.fileSettings];
  const target = files[movePlan.targetIndex];
  const [moved] = files.splice(movePlan.fromIndex, 1);
  const [movedPreview] = previews.splice(movePlan.fromIndex, 1);
  const [movedFrameSetting] = frameSettings.splice(movePlan.fromIndex, 1);
  const [movedFileSetting] = fileSettings.splice(movePlan.fromIndex, 1);
  files.splice(movePlan.targetIndex, 0, moved);
  previews.splice(movePlan.targetIndex, 0, movedPreview);
  frameSettings.splice(movePlan.targetIndex, 0, movedFrameSetting);
  fileSettings.splice(movePlan.targetIndex, 0, movedFileSetting);

  state.files = files;
  state.previews = previews;
  state.frameSettings = frameSettings;
  state.fileSettings = fileSettings;
  state.results = [];
  renderState(state);
  syncControlStates(state);
  setWorkflowPhase(state, "ready", describeQueueMoveResult(moved, target, movePlan));

  if (options.focusMoved) {
    state.list.querySelector(`.queue-card[data-index="${movePlan.targetIndex}"] .queue-drag-handle`)?.focus({ preventScroll: true });
  }
}

function removeFileAtIndex(state, index, options = {}) {
  const normalizedIndex = Number(index);

  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= state.files.length) {
    return;
  }

  if (isPanelBusy(state)) {
    setWorkflowPhase(state, "running", "변환 중에는 파일을 제거할 수 없습니다. 필요하면 먼저 변환을 취소해 주세요.");
    return;
  }

  if (options.confirmMessage && !window.confirm(options.confirmMessage)) {
    setWorkflowPhase(state, state.files.length > 0 ? "ready" : "idle", "삭제를 취소했습니다.");
    return;
  }

  cancelActiveJob(state);

  const removedFile = state.files[normalizedIndex];
  const removedPreview = state.previews[normalizedIndex];

  if (removedPreview?.url) {
    URL.revokeObjectURL(removedPreview.url);
  }

  state.files = state.files.filter((_, fileIndex) => fileIndex !== normalizedIndex);
  state.previews = state.previews.filter((_, previewIndex) => previewIndex !== normalizedIndex);
  state.frameSettings = state.frameSettings.filter((_, frameIndex) => frameIndex !== normalizedIndex);
  state.fileSettings = state.fileSettings.filter((_, fileSettingIndex) => fileSettingIndex !== normalizedIndex);
  state.results =
    state.config.mode === "image"
      ? state.results.filter((_, resultIndex) => resultIndex !== normalizedIndex)
      : [];
  state.dragIndex = null;
  state.dropInsertionIndex = null;
  state.dropMoveTargetIndex = null;
  state.pointerDrag = null;
  state.input.value = "";
  renderState(state);
  syncControlStates(state);

  if (options.successMessage) {
    setWorkflowPhase(state, state.files.length > 0 ? "ready" : "idle", options.successMessage);
    return;
  }

  if (state.files.length === 0) {
    setWorkflowPhase(state, "idle", `${removedFile.name} 파일을 제거했습니다. 목록이 비어 있습니다.`);
    return;
  }

  setWorkflowPhase(state, "ready", `${removedFile.name} 파일을 제거했습니다. 현재 ${state.files.length}개 파일이 준비되었습니다.`);
}

async function createResults(files, config, settings, frameSettings, fileSettings, jobToken, state) {
  if (typeof config.createResults !== "function") {
    throw new Error("이 페이지의 변환 스크립트를 찾지 못했습니다.");
  }

  const results = await config.createResults({
    files,
    config,
    settings,
    frameSettings,
    fileSettings,
    jobToken,
    state,
    api: ToolPage,
  });

  return ensureUniqueResultFileNames(results);
}

async function createImageResults(files, config, settings, jobToken, state) {
  const results = [];

  for (const [index, file] of files.entries()) {
    assertJobActive(state, jobToken);
    const image = await loadImage(file);
    const format = config.mimeType === "image/jpeg" ? "jpeg" : "png";
    const quality = format === "jpeg" ? settings.jpegQuality ?? config.quality : config.quality;
    const backgroundColor = format === "jpeg" ? settings.jpegBackground ?? "#ffffff" : null;
    const rendered = await renderImageToBlob(image, {
      format,
      quality,
      backgroundColor,
    });

    results.push({
      blob: rendered.blob,
      fileName: buildOutputFileName(settings, {
        originalName: file.name,
        defaultBaseName: stripExtension(file.name),
        extension: config.outputExtension,
        index,
        total: files.length,
      }),
    });
  }

  return results;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`이미지를 읽을 수 없습니다: ${file.name}`));
    };

    image.src = url;
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 렌더링하지 못했습니다."));
    image.src = dataUrl;
  });
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일을 데이터 URL로 변환하지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

async function renderImageToBlob(image, options = {}) {
  const format = options.format || "png";
  const targetWidth = Math.max(1, Math.round(options.width || image.naturalWidth));
  const targetHeight = Math.max(1, Math.round(options.height || image.naturalHeight));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas context를 만들 수 없습니다.");
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  if (!options.autoFormat && (format === "jpeg" || options.backgroundColor)) {
    context.fillStyle = options.backgroundColor || "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
  }

  if (options.crop && options.cropBox) {
    context.drawImage(
      image,
      options.cropBox.x,
      options.cropBox.y,
      options.cropBox.width,
      options.cropBox.height,
      0,
      0,
      targetWidth,
      targetHeight
    );
  } else {
    context.drawImage(image, 0, 0, targetWidth, targetHeight);
  }

  let resolvedFormat = format;
  let exportCanvas = canvas;

  if (options.autoFormat) {
    resolvedFormat = hasTransparency(context, targetWidth, targetHeight) ? "png" : "jpeg";

    if (resolvedFormat === "jpeg") {
      const flattenedCanvas = document.createElement("canvas");
      const flattenedContext = flattenedCanvas.getContext("2d");

      if (!flattenedContext) {
        throw new Error("Canvas context를 만들 수 없습니다.");
      }

      flattenedCanvas.width = targetWidth;
      flattenedCanvas.height = targetHeight;
      flattenedContext.fillStyle = options.backgroundColor || "#ffffff";
      flattenedContext.fillRect(0, 0, targetWidth, targetHeight);
      flattenedContext.drawImage(canvas, 0, 0);
      exportCanvas = flattenedCanvas;
    }
  }

  const blob = await canvasToBlob(
    exportCanvas,
    resolvedFormat === "png" ? "image/png" : "image/jpeg",
    options.quality || 0.92
  );

  return {
    blob,
    format: resolvedFormat,
  };
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Blob 생성에 실패했습니다."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality
    );
  });
}

function hasTransparency(context, width, height) {
  const sampleStepX = Math.max(1, Math.floor(width / 48));
  const sampleStepY = Math.max(1, Math.floor(height / 48));
  const { data } = context.getImageData(0, 0, width, height);

  for (let y = 0; y < height; y += sampleStepY) {
    for (let x = 0; x < width; x += sampleStepX) {
      const alphaIndex = (y * width + x) * 4 + 3;

      if (data[alphaIndex] < 255) {
        return true;
      }
    }
  }

  return false;
}

async function createZipBlob(results) {
  if (!window.JSZip) {
    throw new Error("JSZip 라이브러리를 불러오지 못했습니다.");
  }

  const zip = new window.JSZip();

  results.forEach((result) => {
    zip.file(result.fileName, result.blob);
  });

  return zip.generateAsync({ type: "blob" });
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

function stripExtension(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function sanitizeFileNameSegment(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildOutputFileName(settings, options) {
  const extension = String(options.extension || "").replace(/^\./, "");
  const mode = settings.outputNameMode || "original";
  const prefix = sanitizeFileNameSegment(settings.outputPrefix || "");
  const suffix = sanitizeFileNameSegment(settings.outputSuffix || "");
  const overrideBase = sanitizeFileNameSegment(settings.outputBaseName || "");
  const fallbackBase = sanitizeFileNameSegment(options.defaultBaseName || options.originalName || "export");
  let baseName = overrideBase || fallbackBase;

  if (mode === "numbered" && !options.singleFile) {
    const startNumber = Math.max(1, Number(settings.outputStartNumber || 1));
    const width = Math.max(2, String(startNumber + Math.max((options.total || 1) - 1, 0)).length);
    const numberedBase = overrideBase || sanitizeFileNameSegment(options.defaultBaseName || "export");
    baseName = `${numberedBase}-${String(startNumber + (options.index || 0)).padStart(width, "0")}`;
  }

  const joinedBase = `${prefix}${baseName}${suffix}`.trim();
  return `${joinedBase || "export"}.${extension}`;
}

function buildBundleFileName(settings, defaultBaseName, extension) {
  return buildOutputFileName(settings, {
    defaultBaseName,
    extension,
    total: 1,
    index: 0,
    singleFile: true,
  });
}

function resolvePageImageOutput(settings) {
  const format = settings.pageImageFormat === "jpeg" || settings.pageImageFormat === "webp" ? settings.pageImageFormat : "png";
  const outputMap = {
    png: { extension: "png", mimeType: "image/png" },
    jpeg: { extension: "jpg", mimeType: "image/jpeg" },
    webp: { extension: "webp", mimeType: "image/webp" },
  };

  return {
    format,
    extension: outputMap[format].extension,
    mimeType: outputMap[format].mimeType,
    quality: Number(settings.pageImageQuality || 0.92),
    backgroundColor: settings.pageImageBackground || "#ffffff",
  };
}

async function createCanvasImageResult(canvas, output, settings, options) {
  const blob = await canvasToBlob(canvas, output.mimeType, output.quality);

  return {
    blob,
    previewDataUrl: await blobToDataUrl(blob),
    width: canvas.width,
    height: canvas.height,
    fileName: buildDocumentImageFileName(settings, {
      ...options,
      extension: output.extension,
    }),
  };
}

function buildDocumentImageFileName(settings, options) {
  const extension = String(options.extension || "png").replace(/^\./, "");
  const prefix = sanitizeFileNameSegment(settings.outputPrefix || "");
  const suffix = sanitizeFileNameSegment(settings.outputSuffix || "");
  const overrideBase = sanitizeFileNameSegment(settings.outputBaseName || "");
  const defaultBase = sanitizeFileNameSegment(options.defaultBaseName || stripExtension(options.sourceName || "") || "export");
  const total = Math.max(1, Number(options.total || 1));
  const startNumber = Math.max(1, Number(settings.outputStartNumber || 1));
  const width = Math.max(2, String(startNumber + total - 1).length);
  const number = String(startNumber + Number(options.index || 0)).padStart(width, "0");
  const partName = sanitizeFileNameSegment(options.partName || number);
  const baseName =
    settings.outputNameMode === "numbered" ? `${overrideBase || defaultBase}-${number}` : `${overrideBase || defaultBase}-${partName}`;
  const joinedBase = `${prefix}${baseName}${suffix}`.trim();
  return `${joinedBase || "export"}.${extension}`;
}

function ensureUniqueResultFileNames(results) {
  const seen = new Set();

  return results.map((result) => {
    const uniqueName = createUniqueFileName(result.fileName, seen);
    return uniqueName === result.fileName ? result : { ...result, fileName: uniqueName };
  });
}

function createUniqueFileName(fileName, seen) {
  const normalizedName = String(fileName || "export").trim() || "export";
  const extensionMatch = normalizedName.match(/(\.[^.]+)$/);
  const extension = extensionMatch ? extensionMatch[1] : "";
  const baseName = extension ? normalizedName.slice(0, -extension.length) : normalizedName;
  let candidate = normalizedName;
  let suffix = 2;

  while (seen.has(candidate.toLowerCase())) {
    candidate = `${baseName}-${suffix}${extension}`;
    suffix += 1;
  }

  seen.add(candidate.toLowerCase());
  return candidate;
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fitWithinBox(sourceWidth, sourceHeight, boxWidth, boxHeight) {
  const ratio = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);

  return {
    width: sourceWidth * ratio,
    height: sourceHeight * ratio,
  };
}

function coverWithinBox(sourceWidth, sourceHeight, boxWidth, boxHeight) {
  const sourceRatio = sourceWidth / sourceHeight;
  const boxRatio = boxWidth / boxHeight;

  if (sourceRatio > boxRatio) {
    const cropWidth = sourceHeight * boxRatio;
    return {
      width: boxWidth,
      height: boxHeight,
      sourceWidth: cropWidth,
      sourceHeight,
      sourceX: (sourceWidth - cropWidth) / 2,
      sourceY: 0,
    };
  }

  const cropHeight = sourceWidth / boxRatio;
  return {
    width: boxWidth,
    height: boxHeight,
    sourceWidth,
    sourceHeight: cropHeight,
    sourceX: 0,
    sourceY: (sourceHeight - cropHeight) / 2,
  };
}

function normalizeHexColor(color) {
  return String(color).replace("#", "").toUpperCase();
}

function createPreviewRecord(file) {
  return {
    url: URL.createObjectURL(file),
    fileName: file.name,
  };
}

function getAcceptedFiles(nextFiles, existingFiles = []) {
  const seen = new Set(existingFiles.map((file) => getFileSignature(file)));
  const acceptedFiles = [];
  let duplicateCount = 0;

  nextFiles.forEach((file) => {
    const signature = getFileSignature(file);

    if (seen.has(signature)) {
      duplicateCount += 1;
      return;
    }

    seen.add(signature);
    acceptedFiles.push(file);
  });

  return {
    files: acceptedFiles,
    duplicateCount,
  };
}

function validateFilesForConfig(files, config) {
  return typeof config.validateFiles === "function" ? config.validateFiles(files) || "" : "";
}

function getFileSignature(file) {
  return [file.name, file.size, file.lastModified, file.type].join("::");
}

function revokePreviewUrls(previews) {
  previews.forEach((preview) => {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }
  });
}

function createFrameSettings(files, defaultDelay) {
  return files.map(() => ({
    delay: Number(defaultDelay || 180),
    isCustom: false,
  }));
}

function createFileSettings(files, state) {
  return files.map((file, index) =>
    typeof state.config.createFileSettings === "function"
      ? state.config.createFileSettings({ file, index, state, api: ToolPage }) || {}
      : {}
  );
}

function createFilePreview(previewRecord, fileName, options = {}) {
  const frame = document.createElement("div");
  frame.className = "file-preview-frame";

  if (!previewRecord?.url) {
    frame.classList.add("is-empty");
    return frame;
  }

  const image = document.createElement("img");
  image.className = "file-preview-image";
  image.src = previewRecord.url;
  image.alt = `${fileName} 썸네일`;
  image.loading = "lazy";
  frame.append(image);

  if (options.captionText || options.badgeText) {
    const chrome = document.createElement("div");
    chrome.className = "file-preview-chrome";

    if (options.captionText) {
      const caption = document.createElement("span");
      caption.className = "file-preview-caption";
      caption.textContent = options.captionText;
      chrome.append(caption);
    }

    if (options.badgeText) {
      const stack = document.createElement("div");
      stack.className = "file-preview-stack";

      const badge = document.createElement("span");
      badge.className = "file-preview-badge";
      badge.textContent = options.badgeText;
      stack.append(badge);

      if (options.deleteAction) {
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "file-preview-delete";
        deleteButton.textContent = "X";
        deleteButton.setAttribute("aria-label", options.deleteLabel || `${fileName} 삭제`);
        deleteButton.addEventListener("click", options.deleteAction);
        stack.append(deleteButton);
      }

      chrome.append(stack);
    } else if (options.deleteAction) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "file-preview-delete";
      deleteButton.textContent = "X";
      deleteButton.setAttribute("aria-label", options.deleteLabel || `${fileName} 삭제`);
      deleteButton.addEventListener("click", options.deleteAction);
      chrome.append(deleteButton);
    }

    frame.append(chrome);
  }

  return frame;
}

function createDocumentPreview(label, badgeText) {
  const frame = document.createElement("div");
  frame.className = "file-preview-frame document-preview-frame";

  const chrome = document.createElement("div");
  chrome.className = "file-preview-chrome";

  const badge = document.createElement("span");
  badge.className = "file-preview-badge";
  badge.textContent = badgeText;

  const title = document.createElement("span");
  title.className = "document-preview-title";
  title.textContent = label;

  chrome.append(badge);
  frame.append(title, chrome);
  return frame;
}

function createRenderedImagePreview(result, label) {
  const frame = document.createElement("div");
  frame.className = "file-preview-frame";

  if (!result.previewDataUrl) {
    frame.classList.add("is-empty");
    return frame;
  }

  const image = document.createElement("img");
  image.className = "file-preview-image result-preview-image";
  image.src = result.previewDataUrl;
  image.alt = `${label} 미리보기`;
  image.loading = "lazy";
  frame.append(image);

  const chrome = document.createElement("div");
  chrome.className = "file-preview-chrome";

  const badge = document.createElement("span");
  badge.className = "file-preview-badge";
  badge.textContent = label;

  chrome.append(badge);
  frame.append(chrome);
  return frame;
}

function createRemoveButton(state, index, fileName) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "remove-file-button";
  button.textContent = "REMOVE";
  button.setAttribute("aria-label", `${fileName} 파일 제거`);
  button.addEventListener("click", () => removeFileAtIndex(state, index));
  return button;
}
