document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page !== "image-editor") {
    return;
  }

  initializeImageEditorModeSwitcher();
  initializeBatchImageEditor();
});

const BATCH_IMAGE_MAX_FILES = 50;
const BATCH_IMAGE_MAX_TOTAL_BYTES = 250 * 1024 * 1024;
const BATCH_IMAGE_MAX_DIMENSION = 8192;
const BATCH_IMAGE_MAX_TOTAL_OUTPUT_PIXELS = 150_000_000;

function initializeImageEditorModeSwitcher() {
  const switcher = document.querySelector('[data-role="image-editor-mode-switcher"]');
  const buttons = Array.from(switcher?.querySelectorAll("[data-editor-mode-target]") || []);
  const panels = Array.from(document.querySelectorAll("[data-editor-mode-panel]"));

  if (!switcher || buttons.length === 0 || panels.length === 0) {
    return;
  }

  const activateMode = (requestedMode, updateUrl = false) => {
    const mode = buttons.some((button) => button.dataset.editorModeTarget === requestedMode)
      ? requestedMode
      : "single";

    buttons.forEach((button) => {
      const isActive = button.dataset.editorModeTarget === mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.editorModePanel !== mode;
    });

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("mode", mode);
      window.history.replaceState(null, "", url);
    }
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => activateMode(button.dataset.editorModeTarget, true));
  });

  activateMode(new URLSearchParams(window.location.search).get("mode") || "single");
}

function initializeBatchImageEditor() {
  const core = window.ImageEditorCore;
  const panel = document.querySelector("[data-image-batch-editor]");

  if (!core || !panel || !window.JSZip) {
    return;
  }

  const elements = {
    panel,
    input: panel.querySelector('[data-role="batch-input"]'),
    dropzone: panel.querySelector('[data-role="batch-dropzone"]'),
    status: panel.querySelector('[data-role="batch-status"]'),
    list: panel.querySelector('[data-role="batch-list"]'),
    summary: panel.querySelector('[data-role="batch-summary"]'),
    preset: panel.querySelector('[data-role="batch-size-preset"]'),
    width: panel.querySelector('[data-role="batch-width"]'),
    height: panel.querySelector('[data-role="batch-height"]'),
    fitMode: panel.querySelector('[data-role="batch-fit-mode"]'),
    background: panel.querySelector('[data-role="batch-background"]'),
    format: panel.querySelector('[data-role="batch-format"]'),
    quality: panel.querySelector('[data-role="batch-quality"]'),
    qualityLabel: panel.querySelector('[data-role="batch-quality-label"]'),
    qualityField: panel.querySelector('[data-role="batch-quality-field"]'),
    clearButton: panel.querySelector('[data-action="batch-clear"]'),
    cancelButton: panel.querySelector('[data-action="batch-cancel"]'),
    downloadButton: panel.querySelector('[data-action="batch-download"]'),
    modeButtons: Array.from(document.querySelectorAll("[data-editor-mode-target]")),
  };

  if (Object.entries(elements).some(([key, element]) => key !== "modeButtons" && !element)) {
    return;
  }

  const state = {
    core,
    elements,
    records: [],
    actionToken: 0,
    activeJobToken: 0,
    isBusy: false,
    cancelRequested: false,
    dragDepth: 0,
  };

  bindBatchImageEditorEvents(state);
  renderBatchImageList(state);
  updateBatchImageControls(state);

  window.addEventListener("pagehide", () => {
    state.actionToken += 1;
    revokeBatchPreviewUrls(state.records);
  });
}

function bindBatchImageEditorEvents(state) {
  const { elements } = state;

  elements.input.addEventListener("change", () => {
    const files = Array.from(elements.input.files || []);
    elements.input.value = "";
    void replaceBatchImageFiles(state, files);
  });

  elements.dropzone.addEventListener("click", () => {
    if (!state.isBusy) {
      elements.input.click();
    }
  });

  elements.dropzone.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();

    if (!state.isBusy) {
      elements.input.click();
    }
  });

  elements.dropzone.addEventListener("dragenter", (event) => {
    if (!hasBatchDraggedFiles(event) || state.isBusy) {
      return;
    }

    event.preventDefault();
    state.dragDepth += 1;
    elements.dropzone.classList.add("is-drag-over");
  });

  elements.dropzone.addEventListener("dragover", (event) => {
    if (!hasBatchDraggedFiles(event) || state.isBusy) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    elements.dropzone.classList.add("is-drag-over");
  });

  elements.dropzone.addEventListener("dragleave", (event) => {
    if (!hasBatchDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth = Math.max(0, state.dragDepth - 1);

    if (state.dragDepth === 0) {
      elements.dropzone.classList.remove("is-drag-over");
    }
  });

  elements.dropzone.addEventListener("drop", (event) => {
    if (!hasBatchDraggedFiles(event) || state.isBusy) {
      return;
    }

    event.preventDefault();
    state.dragDepth = 0;
    elements.dropzone.classList.remove("is-drag-over");
    void replaceBatchImageFiles(state, Array.from(event.dataTransfer?.files || []));
  });

  elements.preset.addEventListener("change", () => {
    applyBatchSizePreset(state);
    updateBatchImageControls(state);
  });

  [elements.width, elements.height].forEach((input) => {
    input.addEventListener("input", () => {
      elements.preset.value = "custom";
      updateBatchImageControls(state);
    });
  });

  elements.format.addEventListener("change", () => updateBatchImageControls(state));
  elements.quality.addEventListener("input", () => updateBatchImageControls(state));

  elements.clearButton.addEventListener("click", () => {
    if (state.isBusy) {
      return;
    }

    revokeBatchPreviewUrls(state.records);
    state.records = [];
    renderBatchImageList(state);
    updateBatchImageControls(state);
    setBatchStatus(state, "목록을 비웠습니다. 여러 이미지를 새로 선택해 주세요.", "info");
  });

  elements.cancelButton.addEventListener("click", () => cancelBatchImageJob(state));
  elements.downloadButton.addEventListener("click", () => void exportBatchImages(state));

  elements.list.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-batch-remove-index]");

    if (!removeButton || state.isBusy) {
      return;
    }

    removeBatchImageAtIndex(state, Number(removeButton.dataset.batchRemoveIndex));
  });
}

async function replaceBatchImageFiles(state, selectedFiles) {
  if (state.isBusy || selectedFiles.length === 0) {
    return;
  }

  const validation = validateBatchImageSelection(state, selectedFiles);

  if (validation.error) {
    setBatchStatus(state, validation.error, "error");
    return;
  }

  const token = ++state.actionToken;
  state.activeJobToken = token;
  const nextRecords = [];
  let dimensionSkipCount = 0;
  setBatchBusy(state, true, `이미지 ${validation.files.length}장의 크기를 확인하고 있습니다...`);

  try {
    for (let index = 0; index < validation.files.length; index += 1) {
      if (token !== state.actionToken) {
        revokeBatchPreviewUrls(nextRecords);
        setBatchStatus(state, "이미지 준비를 취소했습니다. 기존 목록과 설정은 유지됩니다.", "info");
        return;
      }

      const file = validation.files[index];
      setBatchStatus(state, `${index + 1}/${validation.files.length} · ${file.name} 크기를 확인하는 중입니다...`, "info");

      try {
        const image = await state.core.loadImageFromFile(file);
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;

        if (!state.core.isImageEditorDimensionAllowed(width, height)) {
          dimensionSkipCount += 1;
          continue;
        }

        nextRecords.push({
          file,
          width,
          height,
          previewUrl: URL.createObjectURL(file),
        });
      } catch (error) {
        console.error(error);
        dimensionSkipCount += 1;
      }

      await yieldBatchImageThread();
    }

    if (token !== state.actionToken) {
      revokeBatchPreviewUrls(nextRecords);
      setBatchStatus(state, "이미지 준비를 취소했습니다. 기존 목록과 설정은 유지됩니다.", "info");
      return;
    }

    if (nextRecords.length === 0) {
      setBatchStatus(state, "안전한 해상도 범위에서 열 수 있는 이미지가 없습니다.", "error");
      return;
    }

    revokeBatchPreviewUrls(state.records);
    state.records = nextRecords;
    renderBatchImageList(state);
    setBatchStatus(
      state,
      `${state.records.length}장을 준비했습니다.${
        validation.skipCount + dimensionSkipCount > 0
          ? ` 형식·중복·해상도 제한에 맞지 않는 ${validation.skipCount + dimensionSkipCount}장은 제외했습니다.`
          : ""
      }`,
      "success"
    );
  } finally {
    if (state.activeJobToken === token) {
      state.activeJobToken = 0;
      setBatchBusy(state, false);
    }
  }
}

function validateBatchImageSelection(state, selectedFiles) {
  const seen = new Set();
  const files = [];
  let skipCount = 0;

  selectedFiles.forEach((file) => {
    const key = `${file.name.toLocaleLowerCase()}::${file.size}::${file.lastModified}`;

    if (seen.has(key) || state.core.getImageEditorFileValidationError(file)) {
      skipCount += 1;
      return;
    }

    seen.add(key);
    files.push(file);
  });

  if (files.length === 0) {
    return { error: "PNG, JPG, WEBP 이미지 파일을 선택해 주세요.", files: [], skipCount };
  }

  if (files.length > BATCH_IMAGE_MAX_FILES) {
    return {
      error: `한 번에 최대 ${BATCH_IMAGE_MAX_FILES}장까지 처리할 수 있습니다. 현재 유효한 선택은 ${files.length}장입니다.`,
      files: [],
      skipCount,
    };
  }

  const totalBytes = files.reduce((total, file) => total + file.size, 0);

  if (totalBytes > BATCH_IMAGE_MAX_TOTAL_BYTES) {
    return {
      error: `선택한 이미지의 총 용량 ${state.core.formatFileSize(totalBytes)}가 250MB 제한을 넘었습니다.`,
      files: [],
      skipCount,
    };
  }

  return { error: "", files, skipCount };
}

function applyBatchSizePreset(state) {
  const match = /^(\d+)x(\d+)$/.exec(state.elements.preset.value);

  if (!match) {
    return;
  }

  state.elements.width.value = match[1];
  state.elements.height.value = match[2];
}

function getBatchImageOptions(state) {
  const width = Math.round(Number(state.elements.width.value));
  const height = Math.round(Number(state.elements.height.value));

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > BATCH_IMAGE_MAX_DIMENSION ||
    height > BATCH_IMAGE_MAX_DIMENSION
  ) {
    return { error: `너비와 높이는 1px 이상 ${BATCH_IMAGE_MAX_DIMENSION}px 이하로 입력해 주세요.` };
  }

  if (!state.core.isImageEditorDimensionAllowed(width, height)) {
    return { error: "결과 한 장의 가로×세로가 2,400만 픽셀을 넘지 않도록 크기를 줄여 주세요." };
  }

  if (width * height * state.records.length > BATCH_IMAGE_MAX_TOTAL_OUTPUT_PIXELS) {
    return { error: "현재 이미지 수와 결과 크기의 조합이 브라우저 일괄 처리 안전 한도를 넘습니다. 장수나 크기를 줄여 주세요." };
  }

  return {
    error: "",
    width,
    height,
    fitMode: ["cover", "stretch"].includes(state.elements.fitMode.value)
      ? state.elements.fitMode.value
      : "contain",
    background: state.elements.background.value || "#ffffff",
    format: ["png", "jpeg", "webp"].includes(state.elements.format.value)
      ? state.elements.format.value
      : "original",
    quality: clampBatchNumber(Number(state.elements.quality.value) || 0.92, 0.6, 1),
  };
}

async function exportBatchImages(state) {
  if (state.isBusy || state.records.length === 0) {
    return;
  }

  const options = getBatchImageOptions(state);

  if (options.error) {
    setBatchStatus(state, options.error, "error");
    return;
  }

  const token = ++state.actionToken;
  state.activeJobToken = token;
  const zip = new window.JSZip();
  const usedFileNames = new Set();
  setBatchBusy(state, true, `${state.records.length}장 일괄 처리를 시작합니다...`);

  try {
    for (let index = 0; index < state.records.length; index += 1) {
      assertBatchImageJobActive(state, token);
      const record = state.records[index];
      setBatchStatus(state, `${index + 1}/${state.records.length} · ${record.file.name} 크기를 조정하는 중입니다...`, "info");

      const image = await state.core.loadImageFromFile(record.file);
      const resizedCanvas = renderBatchResizedCanvas(image, options);
      const output = resolveBatchImageOutput(record.file, options);
      const blob = await state.core.canvasToBlob(resizedCanvas, output.mimeType, output.quality);

      if (blob.type && blob.type !== output.mimeType) {
        throw new Error("UNSUPPORTED_EXPORT_FORMAT");
      }

      const fileName = buildBatchImageFileName(record.file, options, output.extension, usedFileNames);
      zip.file(fileName, blob, { binary: true });
      await yieldBatchImageThread();
    }

    assertBatchImageJobActive(state, token);
    setBatchStatus(state, "결과 파일을 ZIP으로 묶는 중입니다. 이 단계는 이미지 수에 따라 시간이 걸릴 수 있습니다.", "info");
    const zipBlob = await zip.generateAsync(
      { type: "blob", compression: "STORE" },
      (metadata) => {
        if (token === state.actionToken) {
          setBatchStatus(state, `ZIP 생성 ${Math.round(metadata.percent)}%`, "info");
        }
      }
    );
    assertBatchImageJobActive(state, token);

    state.core.downloadBlob(zipBlob, `images-${options.width}x${options.height}.zip`);
    setBatchStatus(state, `${state.records.length}장을 ${options.width} × ${options.height}px로 수정해 ZIP 다운로드를 시작했습니다.`, "success");
  } catch (error) {
    if (error instanceof Error && error.message === "BATCH_IMAGE_CANCELLED") {
      setBatchStatus(state, "일괄 처리를 취소했습니다. 선택한 이미지와 설정은 유지됩니다.", "info");
      return;
    }

    console.error(error);
    setBatchStatus(
      state,
      error instanceof Error && error.message === "UNSUPPORTED_EXPORT_FORMAT"
        ? "이 브라우저에서 선택한 출력 형식을 만들 수 없습니다. PNG 또는 JPG로 다시 시도해 주세요."
        : "일괄 이미지 처리 중 문제가 발생했습니다. 이미지 수나 결과 크기를 줄여 다시 시도해 주세요.",
      "error"
    );
  } finally {
    if (state.activeJobToken === token) {
      state.activeJobToken = 0;
      setBatchBusy(state, false);
    }
  }
}

function renderBatchResizedCanvas(image, options) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("CANVAS_CONTEXT_UNAVAILABLE");
  }

  context.fillStyle = options.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (options.fitMode === "stretch") {
    context.drawImage(image, 0, 0, options.width, options.height);
    return canvas;
  }

  const scale =
    options.fitMode === "cover"
      ? Math.max(options.width / sourceWidth, options.height / sourceHeight)
      : Math.min(options.width / sourceWidth, options.height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = (options.width - drawWidth) / 2;
  const drawY = (options.height - drawHeight) / 2;
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  return canvas;
}

function resolveBatchImageOutput(file, options) {
  const requestedFormat = options.format === "original" ? getBatchOriginalFormat(file) : options.format;

  if (requestedFormat === "jpeg") {
    return { extension: "jpg", mimeType: "image/jpeg", quality: options.quality };
  }

  if (requestedFormat === "webp") {
    return { extension: "webp", mimeType: "image/webp", quality: options.quality };
  }

  return { extension: "png", mimeType: "image/png", quality: 1 };
}

function getBatchOriginalFormat(file) {
  if (file.type === "image/jpeg" || /\.jpe?g$/i.test(file.name)) {
    return "jpeg";
  }

  if (file.type === "image/webp" || /\.webp$/i.test(file.name)) {
    return "webp";
  }

  return "png";
}

function buildBatchImageFileName(file, options, extension, usedFileNames) {
  const baseName = String(file.name || "image")
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "image";
  const stem = `${baseName}-${options.width}x${options.height}`;
  let fileName = `${stem}.${extension}`;
  let suffix = 2;

  while (usedFileNames.has(fileName.toLocaleLowerCase())) {
    fileName = `${stem}-${suffix}.${extension}`;
    suffix += 1;
  }

  usedFileNames.add(fileName.toLocaleLowerCase());
  return fileName;
}

function removeBatchImageAtIndex(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.records.length) {
    return;
  }

  URL.revokeObjectURL(state.records[index].previewUrl);
  state.records.splice(index, 1);
  renderBatchImageList(state);
  updateBatchImageControls(state);
  setBatchStatus(
    state,
    state.records.length > 0 ? `${state.records.length}장이 일괄 처리 목록에 남았습니다.` : "선택된 이미지를 모두 제거했습니다.",
    "info"
  );
}

function renderBatchImageList(state) {
  const { elements } = state;
  elements.list.innerHTML = "";

  state.records.forEach((record, index) => {
    const card = document.createElement("article");
    card.className = "batch-file-card";

    const image = document.createElement("img");
    image.className = "batch-file-preview";
    image.src = record.previewUrl;
    image.alt = "";

    const meta = document.createElement("div");
    meta.className = "batch-file-meta";

    const name = document.createElement("strong");
    name.textContent = record.file.name;

    const details = document.createElement("span");
    details.textContent = `${record.width} × ${record.height}px · ${state.core.formatFileSize(record.file.size)}`;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.dataset.batchRemoveIndex = String(index);
    removeButton.textContent = "목록에서 제거";
    removeButton.disabled = state.isBusy;

    meta.append(name, details, removeButton);
    card.append(image, meta);
    elements.list.append(card);
  });

  const totalBytes = state.records.reduce((total, record) => total + record.file.size, 0);
  elements.summary.textContent =
    state.records.length > 0
      ? `${state.records.length}장 · 총 ${state.core.formatFileSize(totalBytes)}`
      : "선택된 이미지가 없습니다.";
}

function updateBatchImageControls(state) {
  const { elements } = state;
  const hasFiles = state.records.length > 0;
  const options = getBatchImageOptions(state);
  const canProcess = hasFiles && !options.error;

  elements.panel.setAttribute("aria-busy", String(state.isBusy));
  elements.input.disabled = state.isBusy;
  elements.dropzone.setAttribute("aria-disabled", String(state.isBusy));
  elements.clearButton.disabled = state.isBusy || !hasFiles;
  elements.cancelButton.disabled = !state.isBusy || state.cancelRequested;
  elements.downloadButton.disabled = state.isBusy || !canProcess;
  [elements.preset, elements.width, elements.height, elements.fitMode, elements.background, elements.format, elements.quality].forEach(
    (control) => {
      control.disabled = state.isBusy;
    }
  );
  elements.modeButtons.forEach((button) => {
    button.disabled = state.isBusy;
  });
  elements.qualityLabel.textContent = `${Math.round((Number(elements.quality.value) || 0.92) * 100)}%`;
  elements.qualityField.hidden = elements.format.value === "png";
  elements.list.querySelectorAll("[data-batch-remove-index]").forEach((button) => {
    button.disabled = state.isBusy;
  });
}

function setBatchBusy(state, isBusy, message = "") {
  state.isBusy = isBusy;
  state.cancelRequested = false;

  if (message) {
    setBatchStatus(state, message, "info");
  }

  renderBatchImageList(state);
  updateBatchImageControls(state);
}

function cancelBatchImageJob(state) {
  if (!state.isBusy) {
    return;
  }

  state.actionToken += 1;
  state.cancelRequested = true;
  updateBatchImageControls(state);
  setBatchStatus(state, "취소를 요청했습니다. 현재 이미지 또는 ZIP 처리 단계가 끝나면 중단됩니다.", "info");
}

function assertBatchImageJobActive(state, token) {
  if (token !== state.actionToken) {
    throw new Error("BATCH_IMAGE_CANCELLED");
  }
}

function setBatchStatus(state, message, tone = "info") {
  state.elements.status.textContent = message;
  state.elements.status.dataset.tone = tone;
}

function revokeBatchPreviewUrls(records) {
  records.forEach((record) => {
    if (record.previewUrl) {
      URL.revokeObjectURL(record.previewUrl);
    }
  });
}

function yieldBatchImageThread() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function hasBatchDraggedFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

function clampBatchNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
