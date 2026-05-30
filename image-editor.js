document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "image-editor") {
    initializeImageEditorPage();
  }
});

function initializeImageEditorPage() {
  const panel = document.querySelector("[data-image-editor]");

  if (!panel) {
    return;
  }

  const elements = {
    input: panel.querySelector('input[type="file"]'),
    dropzone: panel.querySelector('[data-role="dropzone"]'),
    status: panel.querySelector('[data-role="status"]'),
    fileName: panel.querySelector('[data-role="file-name"]'),
    imageMeta: panel.querySelector('[data-role="image-meta"]'),
    zoomLabel: panel.querySelector('[data-role="zoom-label"]'),
    zoomRange: panel.querySelector('[data-role="zoom-range"]'),
    canvasShell: panel.querySelector('[data-role="canvas-shell"]'),
    canvas: panel.querySelector('[data-role="canvas"]'),
    canvasEmpty: panel.querySelector('[data-role="canvas-empty"]'),
    undoButton: panel.querySelector('[data-action="undo"]'),
    resetButton: panel.querySelector('[data-action="reset"]'),
    downloadButton: panel.querySelector('[data-action="download"]'),
    zoomOutButton: panel.querySelector('[data-action="zoom-out"]'),
    zoomInButton: panel.querySelector('[data-action="zoom-in"]'),
    rotateLeftButton: panel.querySelector('[data-action="rotate-left"]'),
    rotateRightButton: panel.querySelector('[data-action="rotate-right"]'),
    textInput: panel.querySelector('[data-role="text-input"]'),
    textColor: panel.querySelector('[data-role="text-color"]'),
    textSize: panel.querySelector('[data-role="text-size"]'),
    placeTextButton: panel.querySelector('[data-action="place-text"]'),
    startCropButton: panel.querySelector('[data-action="start-crop"]'),
    applyCropButton: panel.querySelector('[data-action="apply-crop"]'),
    cancelCropButton: panel.querySelector('[data-action="cancel-crop"]'),
    cropMeta: panel.querySelector('[data-role="crop-meta"]'),
  };

  if (Object.values(elements).some((element) => !element)) {
    return;
  }

  const state = {
    elements,
    file: null,
    workingCanvas: null,
    originalSnapshot: null,
    history: [],
    zoom: 1,
    minZoom: 0.5,
    maxZoom: 3,
    panX: 0,
    panY: 0,
    lastView: null,
    dragDepth: 0,
    activePointer: null,
    cropMode: false,
    cropRect: null,
    pendingTextPlacement: false,
    suppressNextClick: false,
    isBusy: false,
  };

  bindImageEditorEvents(state);
  updateImageEditorUI(state);
  renderImageEditorCanvas(state);
}

function bindImageEditorEvents(state) {
  const { elements } = state;

  elements.input.addEventListener("change", () => {
    void loadImageFile(state, Array.from(elements.input.files || [])[0] || null);
  });

  elements.dropzone.addEventListener("dragenter", (event) => {
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth += 1;
    elements.dropzone.classList.add("is-drag-over");
  });

  elements.dropzone.addEventListener("dragover", (event) => {
    if (!hasDraggedFiles(event)) {
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
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth = 0;
    elements.dropzone.classList.remove("is-drag-over");
    void loadImageFile(state, Array.from(event.dataTransfer?.files || [])[0] || null);
  });

  elements.zoomRange.addEventListener("input", () => {
    if (!state.workingCanvas) {
      return;
    }

    state.zoom = clamp(Number(elements.zoomRange.value) || 1, state.minZoom, state.maxZoom);
    renderImageEditorCanvas(state);
    updateImageEditorUI(state);
  });

  elements.zoomInButton.addEventListener("click", () => {
    adjustZoom(state, 0.1);
  });

  elements.zoomOutButton.addEventListener("click", () => {
    adjustZoom(state, -0.1);
  });

  elements.rotateLeftButton.addEventListener("click", () => {
    rotateImage(state, -90);
  });

  elements.rotateRightButton.addEventListener("click", () => {
    rotateImage(state, 90);
  });

  elements.placeTextButton.addEventListener("click", () => {
    if (!state.workingCanvas || state.isBusy) {
      return;
    }

    const text = elements.textInput.value.trim();

    if (!text) {
      setStatus(state, "추가할 텍스트를 먼저 입력해 주세요.");
      return;
    }

    state.pendingTextPlacement = true;
    state.cropMode = false;
    state.cropRect = null;
    updateImageEditorUI(state);
    renderImageEditorCanvas(state);
    setStatus(state, "캔버스에서 텍스트를 넣을 위치를 클릭해 주세요.");
  });

  elements.startCropButton.addEventListener("click", () => {
    if (!state.workingCanvas || state.isBusy) {
      return;
    }

    state.cropMode = true;
    state.cropRect = null;
    state.pendingTextPlacement = false;
    updateImageEditorUI(state);
    renderImageEditorCanvas(state);
    setStatus(state, "자르고 싶은 영역을 캔버스에서 드래그해 선택해 주세요.");
  });

  elements.cancelCropButton.addEventListener("click", () => {
    if (!state.workingCanvas) {
      return;
    }

    state.cropMode = false;
    state.cropRect = null;
    updateImageEditorUI(state);
    renderImageEditorCanvas(state);
    setStatus(state, "자르기 선택이 취소되었습니다.");
  });

  elements.applyCropButton.addEventListener("click", () => {
    applyCrop(state);
  });

  elements.undoButton.addEventListener("click", () => {
    void undoLastEdit(state);
  });

  elements.resetButton.addEventListener("click", () => {
    void resetImageEditor(state);
  });

  elements.downloadButton.addEventListener("click", () => {
    void downloadEditedImage(state);
  });

  elements.canvas.addEventListener("pointerdown", (event) => {
    if (!state.workingCanvas || state.isBusy) {
      return;
    }

    const point = getImagePointFromPointer(state, event);

    if (!point) {
      return;
    }

    if (state.cropMode) {
      state.activePointer = {
        mode: "crop",
        startX: point.x,
        startY: point.y,
      };
      state.cropRect = { x: point.x, y: point.y, width: 0, height: 0 };
      elements.canvas.setPointerCapture(event.pointerId);
      renderImageEditorCanvas(state);
      return;
    }

    if (state.zoom > 1) {
      state.activePointer = {
        mode: "pan",
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: state.panX,
        startPanY: state.panY,
        moved: false,
      };
      elements.canvas.setPointerCapture(event.pointerId);
    }
  });

  elements.canvas.addEventListener("pointermove", (event) => {
    if (!state.activePointer || !state.workingCanvas || !state.lastView) {
      return;
    }

    if (state.activePointer.mode === "crop") {
      const point = getImagePointFromPointer(state, event);

      if (!point) {
        return;
      }

      state.cropRect = normalizeRect(state.activePointer.startX, state.activePointer.startY, point.x, point.y);
      updateImageEditorUI(state);
      renderImageEditorCanvas(state);
      return;
    }

    if (state.activePointer.mode === "pan") {
      const deltaX = event.clientX - state.activePointer.startClientX;
      const deltaY = event.clientY - state.activePointer.startClientY;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        state.activePointer.moved = true;
        state.suppressNextClick = true;
      }

      state.panX = state.activePointer.startPanX + deltaX / state.lastView.scale;
      state.panY = state.activePointer.startPanY + deltaY / state.lastView.scale;
      renderImageEditorCanvas(state);
    }
  });

  elements.canvas.addEventListener("pointerup", (event) => {
    if (!state.activePointer) {
      return;
    }

    if (state.activePointer.mode === "crop" && state.cropRect) {
      const cropWidth = Math.round(state.cropRect.width);
      const cropHeight = Math.round(state.cropRect.height);

      if (cropWidth < 2 || cropHeight < 2) {
        state.cropRect = null;
        setStatus(state, "자르기 영역이 너무 작아서 선택을 취소했습니다.");
      } else {
        setStatus(state, `선택 영역 ${cropWidth} x ${cropHeight}px 준비 완료.`);
      }
    }

    state.activePointer = null;
    elements.canvas.releasePointerCapture?.(event.pointerId);
    updateImageEditorUI(state);
    renderImageEditorCanvas(state);
  });

  elements.canvas.addEventListener("pointerleave", () => {
    if (state.activePointer?.mode === "crop") {
      return;
    }

    if (state.activePointer?.mode === "pan") {
      state.activePointer = null;
    }
  });

  elements.canvas.addEventListener("click", (event) => {
    if (!state.workingCanvas || !state.pendingTextPlacement || state.isBusy) {
      return;
    }

    if (state.suppressNextClick) {
      state.suppressNextClick = false;
      return;
    }

    const point = getImagePointFromPointer(state, event);

    if (!point) {
      return;
    }

    addTextToImage(state, point);
  });

  window.addEventListener("resize", () => renderImageEditorCanvas(state));
}

async function loadImageFile(state, file) {
  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    setStatus(state, "이미지 파일만 업로드할 수 있습니다.");
    return;
  }

  try {
    setBusy(state, true, "이미지를 불러오는 중입니다...");
    const image = await loadImageFromFile(file);
    state.file = file;
    state.workingCanvas = drawImageToCanvas(image);
    state.originalSnapshot = captureCanvasSnapshot(state.workingCanvas);
    state.history = [];
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    state.cropMode = false;
    state.cropRect = null;
    state.pendingTextPlacement = false;
    updateImageEditorUI(state);
    renderImageEditorCanvas(state);
    setStatus(state, `${file.name} 이미지를 불러왔습니다. 편집을 시작해 보세요.`);
  } catch (error) {
    console.error(error);
    setStatus(state, "이미지를 열지 못했습니다. 다른 파일로 다시 시도해 주세요.");
  } finally {
    state.elements.input.value = "";
    setBusy(state, false);
  }
}

function adjustZoom(state, delta) {
  if (!state.workingCanvas || state.isBusy) {
    return;
  }

  state.zoom = clamp(roundNumber(state.zoom + delta, 1), state.minZoom, state.maxZoom);
  updateImageEditorUI(state);
  renderImageEditorCanvas(state);
}

function rotateImage(state, degrees) {
  if (!state.workingCanvas || state.isBusy) {
    return;
  }

  pushHistoryState(state);
  const current = state.workingCanvas;
  const radians = (degrees * Math.PI) / 180;
  const nextCanvas = document.createElement("canvas");
  const swapSides = Math.abs(degrees) % 180 === 90;

  nextCanvas.width = swapSides ? current.height : current.width;
  nextCanvas.height = swapSides ? current.width : current.height;

  const context = nextCanvas.getContext("2d");

  if (!context) {
    return;
  }

  context.translate(nextCanvas.width / 2, nextCanvas.height / 2);
  context.rotate(radians);
  context.drawImage(current, -current.width / 2, -current.height / 2);

  state.workingCanvas = nextCanvas;
  resetViewState(state);
  updateImageEditorUI(state);
  renderImageEditorCanvas(state);
  setStatus(state, degrees > 0 ? "이미지를 오른쪽으로 회전했습니다." : "이미지를 왼쪽으로 회전했습니다.");
}

function addTextToImage(state, point) {
  if (!state.workingCanvas || state.isBusy) {
    return;
  }

  const text = state.elements.textInput.value.trim();

  if (!text) {
    setStatus(state, "추가할 텍스트를 입력해 주세요.");
    return;
  }

  pushHistoryState(state);

  const context = state.workingCanvas.getContext("2d");

  if (!context) {
    return;
  }

  const fontSize = clamp(Number(state.elements.textSize.value) || 42, 12, 160);
  const color = state.elements.textColor.value || "#ffffff";
  const lineHeight = Math.round(fontSize * 1.2);

  context.save();
  context.font = `700 ${fontSize}px "Noto Sans KR", sans-serif`;
  context.textBaseline = "top";
  context.fillStyle = color;
  context.strokeStyle = "rgba(0, 0, 0, 0.55)";
  context.lineJoin = "round";
  context.lineWidth = Math.max(2, Math.round(fontSize * 0.14));

  text.split(/\r?\n/).forEach((line, index) => {
    const y = point.y + index * lineHeight;
    context.strokeText(line, point.x, y);
    context.fillText(line, point.x, y);
  });

  context.restore();

  state.pendingTextPlacement = false;
  updateImageEditorUI(state);
  renderImageEditorCanvas(state);
  setStatus(state, "텍스트를 이미지에 추가했습니다.");
}

function applyCrop(state) {
  if (!state.workingCanvas || !state.cropRect || state.isBusy) {
    return;
  }

  const cropRect = {
    x: Math.max(0, Math.floor(state.cropRect.x)),
    y: Math.max(0, Math.floor(state.cropRect.y)),
    width: Math.min(state.workingCanvas.width, Math.max(1, Math.floor(state.cropRect.width))),
    height: Math.min(state.workingCanvas.height, Math.max(1, Math.floor(state.cropRect.height))),
  };

  if (cropRect.width < 2 || cropRect.height < 2) {
    setStatus(state, "자르기 영역이 너무 작습니다.");
    return;
  }

  pushHistoryState(state);

  const nextCanvas = document.createElement("canvas");
  nextCanvas.width = cropRect.width;
  nextCanvas.height = cropRect.height;

  const context = nextCanvas.getContext("2d");

  if (!context) {
    return;
  }

  context.drawImage(
    state.workingCanvas,
    cropRect.x,
    cropRect.y,
    cropRect.width,
    cropRect.height,
    0,
    0,
    cropRect.width,
    cropRect.height
  );

  state.workingCanvas = nextCanvas;
  state.cropMode = false;
  state.cropRect = null;
  resetViewState(state);
  updateImageEditorUI(state);
  renderImageEditorCanvas(state);
  setStatus(state, `이미지를 ${cropRect.width} x ${cropRect.height}px로 잘랐습니다.`);
}

async function undoLastEdit(state) {
  if (!state.history.length || state.isBusy) {
    return;
  }

  try {
    setBusy(state, true, "이전 편집 상태로 되돌리는 중입니다...");
    const snapshot = state.history.pop();
    await restoreSnapshotToState(state, snapshot);
    state.cropMode = false;
    state.cropRect = null;
    state.pendingTextPlacement = false;
    updateImageEditorUI(state);
    renderImageEditorCanvas(state);
    setStatus(state, "마지막 편집을 되돌렸습니다.");
  } catch (error) {
    console.error(error);
    setStatus(state, "되돌리기 중 문제가 발생했습니다.");
  } finally {
    setBusy(state, false);
  }
}

async function resetImageEditor(state) {
  if (!state.originalSnapshot || state.isBusy) {
    return;
  }

  try {
    setBusy(state, true, "원본 이미지로 초기화하는 중입니다...");
    pushHistoryState(state);
    await restoreSnapshotToState(state, state.originalSnapshot);
    state.cropMode = false;
    state.cropRect = null;
    state.pendingTextPlacement = false;
    updateImageEditorUI(state);
    renderImageEditorCanvas(state);
    setStatus(state, "원본 이미지 상태로 초기화했습니다.");
  } catch (error) {
    console.error(error);
    setStatus(state, "초기화 중 문제가 발생했습니다.");
  } finally {
    setBusy(state, false);
  }
}

async function downloadEditedImage(state) {
  if (!state.workingCanvas || state.isBusy) {
    return;
  }

  try {
    setBusy(state, true, "편집한 이미지를 PNG로 저장하는 중입니다...");
    const blob = await canvasToBlob(state.workingCanvas, "image/png");
    downloadBlob(blob, buildEditedFileName(state.file));
    setStatus(state, "편집한 이미지를 PNG로 저장했습니다.");
  } catch (error) {
    console.error(error);
    setStatus(state, "이미지 저장에 실패했습니다.");
  } finally {
    setBusy(state, false);
  }
}

function renderImageEditorCanvas(state) {
  const { canvas, canvasShell, canvasEmpty } = state.elements;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const shellRect = canvasShell.getBoundingClientRect();
  const width = Math.max(320, Math.round(shellRect.width || canvasShell.clientWidth || 860));
  const height = Math.max(260, Math.round(shellRect.height || canvasShell.clientHeight || 540));
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#050005";
  context.fillRect(0, 0, width, height);

  canvasEmpty.hidden = Boolean(state.workingCanvas);

  if (!state.workingCanvas) {
    state.lastView = null;
    return;
  }

  const view = getRenderView(state, width, height);
  state.lastView = view;

  context.drawImage(state.workingCanvas, view.drawX, view.drawY, view.drawWidth, view.drawHeight);

  if (state.cropRect) {
    drawCropOverlay(context, state.cropRect, view, width, height);
  }
}

function getRenderView(state, viewportWidth, viewportHeight) {
  const imageWidth = state.workingCanvas.width;
  const imageHeight = state.workingCanvas.height;
  const baseScale = Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight);
  const scale = baseScale * state.zoom;
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const maxPanX = Math.max(0, (drawWidth - viewportWidth) / (2 * scale));
  const maxPanY = Math.max(0, (drawHeight - viewportHeight) / (2 * scale));

  state.panX = clamp(state.panX, -maxPanX, maxPanX);
  state.panY = clamp(state.panY, -maxPanY, maxPanY);

  const drawX = (viewportWidth - drawWidth) / 2 + state.panX * scale;
  const drawY = (viewportHeight - drawHeight) / 2 + state.panY * scale;

  return {
    scale,
    drawX,
    drawY,
    drawWidth,
    drawHeight,
    imageWidth,
    imageHeight,
  };
}

function drawCropOverlay(context, cropRect, view, viewportWidth, viewportHeight) {
  const x = view.drawX + cropRect.x * view.scale;
  const y = view.drawY + cropRect.y * view.scale;
  const width = cropRect.width * view.scale;
  const height = cropRect.height * view.scale;

  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.45)";
  context.fillRect(0, 0, viewportWidth, viewportHeight);
  context.clearRect(x, y, width, height);
  context.strokeStyle = "#ff65ff";
  context.lineWidth = 2;
  context.setLineDash([10, 8]);
  context.strokeRect(x, y, width, height);
  context.fillStyle = "rgba(255, 101, 255, 0.16)";
  context.fillRect(x, y, width, height);
  context.restore();
}

function updateImageEditorUI(state) {
  const { elements } = state;
  const hasImage = Boolean(state.workingCanvas);
  const canEdit = hasImage && !state.isBusy;
  const hasCropRect = Boolean(state.cropRect);

  elements.fileName.textContent = hasImage && state.file ? state.file.name : "No image loaded";
  elements.imageMeta.textContent = hasImage ? `${state.workingCanvas.width} x ${state.workingCanvas.height}` : "0 x 0";
  elements.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  elements.zoomRange.value = String(state.zoom);

  elements.canvas.classList.toggle("is-crop-mode", state.cropMode);
  elements.canvas.classList.toggle("is-text-mode", state.pendingTextPlacement);
  elements.canvas.classList.toggle("is-pan-mode", hasImage && state.zoom > 1 && !state.cropMode && !state.pendingTextPlacement);

  elements.undoButton.disabled = !state.history.length || state.isBusy;
  elements.resetButton.disabled = !hasImage || state.isBusy;
  elements.downloadButton.disabled = !hasImage || state.isBusy;
  elements.zoomOutButton.disabled = !canEdit;
  elements.zoomInButton.disabled = !canEdit;
  elements.rotateLeftButton.disabled = !canEdit;
  elements.rotateRightButton.disabled = !canEdit;
  elements.zoomRange.disabled = !canEdit;
  elements.placeTextButton.disabled = !canEdit;
  elements.startCropButton.disabled = !canEdit;
  elements.applyCropButton.disabled = !hasCropRect || state.isBusy;
  elements.cancelCropButton.disabled = (!state.cropMode && !hasCropRect) || state.isBusy;
  elements.textInput.disabled = !canEdit;
  elements.textColor.disabled = !canEdit;
  elements.textSize.disabled = !canEdit;

  if (!hasCropRect) {
    elements.cropMeta.textContent = state.cropMode
      ? "드래그해서 자를 영역을 선택해 주세요."
      : "선택된 영역이 없습니다.";
  } else {
    elements.cropMeta.textContent = `${Math.round(state.cropRect.width)} x ${Math.round(state.cropRect.height)} px 선택됨`;
  }
}

function getImagePointFromPointer(state, event) {
  if (!state.lastView) {
    return null;
  }

  const rect = state.elements.canvas.getBoundingClientRect();
  const canvasX = event.clientX - rect.left;
  const canvasY = event.clientY - rect.top;
  const imageX = (canvasX - state.lastView.drawX) / state.lastView.scale;
  const imageY = (canvasY - state.lastView.drawY) / state.lastView.scale;

  if (
    imageX < 0 ||
    imageY < 0 ||
    imageX > state.lastView.imageWidth ||
    imageY > state.lastView.imageHeight
  ) {
    return null;
  }

  return {
    x: clamp(imageX, 0, state.lastView.imageWidth),
    y: clamp(imageY, 0, state.lastView.imageHeight),
  };
}

function normalizeRect(startX, startY, endX, endY) {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const right = Math.max(startX, endX);
  const bottom = Math.max(startY, endY);

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function pushHistoryState(state) {
  if (!state.workingCanvas) {
    return;
  }

  state.history.push(captureCanvasSnapshot(state.workingCanvas));

  if (state.history.length > 24) {
    state.history.shift();
  }
}

async function restoreSnapshotToState(state, snapshot) {
  if (!snapshot) {
    return;
  }

  const image = await loadImageFromSource(snapshot.dataUrl);
  state.workingCanvas = drawImageToCanvas(image, snapshot.width, snapshot.height);
  resetViewState(state);
}

function resetViewState(state) {
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
}

function captureCanvasSnapshot(canvas) {
  return {
    width: canvas.width,
    height: canvas.height,
    dataUrl: canvas.toDataURL("image/png"),
  };
}

function drawImageToCanvas(image, width = image.naturalWidth || image.width, height = image.naturalHeight || image.height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (context) {
    context.drawImage(image, 0, 0, width, height);
  }

  return canvas;
}

function loadImageFromFile(file) {
  const url = URL.createObjectURL(file);
  return loadImageFromSource(url).finally(() => {
    URL.revokeObjectURL(url);
  });
}

function loadImageFromSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = source;
  });
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas export failed"));
        return;
      }

      resolve(blob);
    }, mimeType);
  });
}

function buildEditedFileName(file) {
  const baseName = String(file?.name || "image")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `${baseName || "image"}-edited.png`;
}

function setBusy(state, isBusy, message = "") {
  state.isBusy = isBusy;

  if (message) {
    setStatus(state, message);
  }

  updateImageEditorUI(state);
}

function setStatus(state, message) {
  state.elements.status.textContent = message;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function roundNumber(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
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
