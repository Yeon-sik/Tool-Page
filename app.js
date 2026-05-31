const toolConfigs = {};

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
  document.querySelectorAll("[data-tool]").forEach((panel) => initializeToolPanel(panel));
}

function initializeToolPanel(panel) {
  const input = panel.querySelector('input[type="file"]');
  const list = panel.querySelector('[data-role="list"]');
  let status = panel.querySelector('[data-role="status"]');
  const downloadAllButton = panel.querySelector('[data-action="download-all"]');
  const convertButton = panel.querySelector('[data-action="convert"]');
  const clearButton = panel.querySelector('[data-action="clear"]');
  const uploaderBox = panel.querySelector(".uploader-box");
  const config = toolConfigs[panel.dataset.tool];

  if (!config || !input || !list || !downloadAllButton || !convertButton || !clearButton || !uploaderBox) {
    return;
  }

  if (!status) {
    status = createHiddenStatusRegion(panel, list);
  }

  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  downloadAllButton.textContent = config.downloadAllLabel;

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
    status,
    downloadAllButton,
    convertButton,
    clearButton,
    uploaderBox,
    config,
    settings: buildDefaultSettings(config),
    settingsRoot: null,
    actionToken: 0,
    activeJobToken: 0,
  };

  state.dropTarget = ensureDropTarget(state);
  state.settingsRoot = renderSettingsPanel(panel, state);
  setupDropzone(state);

  if (typeof config.onReady === "function") {
    config.onReady({ state, api: ToolPage });
  }

  input.addEventListener("change", () => {
    processSelectedFiles(state, Array.from(input.files || []));
    return;
    cancelActiveJob(state);
    const nextFiles = Array.from(input.files || []);

    if (nextFiles.length === 0) {
      status.textContent = "파일 선택이 취소되었습니다.";
      return;
    }

    const { files: acceptedFiles, duplicateCount } = getAcceptedFiles(
      nextFiles,
      shouldAppendFiles(config) ? state.files : []
    );

    if (acceptedFiles.length === 0) {
      input.value = "";
      status.textContent =
        duplicateCount > 0
          ? `중복된 파일 ${duplicateCount}개는 제외되었습니다. 다른 파일을 선택해 주세요.`
          : "파일 선택이 취소되었습니다.";
      return;
    }

    const nextPreviews = acceptedFiles.map((file) => createPreviewRecord(file));
    const nextFrameSettings = createFrameSettings(acceptedFiles, state.settings.gifFrameDelay);

    if (shouldAppendFiles(config)) {
      state.files = [...state.files, ...acceptedFiles];
      state.previews = [...state.previews, ...nextPreviews];
      state.frameSettings = [...state.frameSettings, ...nextFrameSettings];
    } else {
      revokePreviewUrls(state.previews);
      state.files = acceptedFiles;
      state.previews = nextPreviews;
      state.frameSettings = nextFrameSettings;
    }

    state.results = [];
    state.downloadAllButton.disabled = true;
    renderState(state);
    input.value = "";
    status.textContent = `${state.files.length}개 파일이 준비되었습니다. ${config.statusReady}${
      duplicateCount > 0 ? ` 중복 ${duplicateCount}개는 제외되었습니다.` : ""
    }`;
  });

  convertButton.addEventListener("click", async () => {
    if (state.files.length === 0) {
      status.textContent = "먼저 파일을 선택해 주세요.";
      return;
    }

    const jobToken = ++state.actionToken;
    const jobSettings = { ...state.settings };
    const jobFrameSettings = state.frameSettings.map((frameSetting) => ({ ...frameSetting }));
    const jobFileSettings = state.fileSettings.map((fileSetting) => ({ ...fileSetting }));
    state.activeJobToken = jobToken;
    state.status.textContent = "변환 중입니다. 잠시만 기다려 주세요.";
    state.convertButton.disabled = true;
    state.downloadAllButton.disabled = true;
    state.clearButton.disabled = true;
    state.input.disabled = true;
    setSettingsDisabled(state, true);

    try {
      const results = await createResults(state.files, config, jobSettings, jobFrameSettings, jobFileSettings, jobToken, state);

      if (!isJobActive(state, jobToken)) {
        return;
      }

      state.results = results;
      renderState(state);
      state.downloadAllButton.disabled = state.results.length === 0;
      status.textContent = `${state.results.length}개 결과 생성 완료. ${config.statusDone}`;
    } catch (error) {
      if (!isJobActive(state, jobToken)) {
        return;
      }

      console.error(error);
      state.results = [];
      state.downloadAllButton.disabled = true;
      renderState(state);
      status.textContent = error instanceof Error ? error.message : "변환 중 오류가 발생했습니다.";
    } finally {
      if (state.activeJobToken === jobToken) {
        state.activeJobToken = 0;
      }

      if (state.actionToken === jobToken) {
        state.convertButton.disabled = false;
        state.clearButton.disabled = false;
        state.input.disabled = false;
        setSettingsDisabled(state, false);
      }
    }
  });

  downloadAllButton.addEventListener("click", async () => {
    if (state.results.length === 0) {
      return;
    }

    try {
      if (config.mode === "image" || config.bundleResults) {
        state.status.textContent = "ZIP 파일을 준비하고 있습니다.";
        const blob = await createZipBlob(state.results);
        downloadBlob(blob, buildBundleFileName(state.settings, panel.dataset.tool, "zip"));
      } else {
        const result = state.results[0];
        downloadBlob(result.blob, result.fileName);
      }

      state.status.textContent = "다운로드가 시작되었습니다.";
    } catch (error) {
      console.error(error);
      state.status.textContent = "다운로드 준비 중 오류가 발생했습니다.";
    }
  });

  clearButton.addEventListener("click", () => {
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
    state.input.disabled = false;
    state.convertButton.disabled = false;
    state.clearButton.disabled = false;
    setSettingsDisabled(state, false);
    state.downloadAllButton.disabled = true;
    renderState(state);
    state.status.textContent = "목록이 초기화되었습니다.";
  });
}

function shouldAppendFiles(config) {
  return Boolean(config.appendFiles);
}

function isDocumentImageMode(config) {
  return config.mode === "pdf-images" || config.mode === "ppt-images";
}

function createHiddenStatusRegion(panel, list) {
  const status = document.createElement("p");
  status.className = "visually-hidden";
  status.setAttribute("data-role", "status");
  panel.insertBefore(status, list);
  return status;
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
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    state.dragDepth += 1;
    state.uploaderBox.classList.add("is-drag-over");
    state.dropTarget?.classList.add("is-drag-over");
  };

  const leaveDropState = (event) => {
    if (!hasDraggedFiles(event)) {
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
    if (!hasDraggedFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    state.uploaderBox.classList.add("is-drag-over");
    state.dropTarget?.classList.add("is-drag-over");
  });
  state.uploaderBox.addEventListener("dragleave", leaveDropState);
  state.uploaderBox.addEventListener("drop", (event) => {
    if (!hasDraggedFiles(event)) {
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
    return existingTarget;
  }

  const dropTarget = document.createElement("div");
  dropTarget.className = "uploader-drop-target";
  dropTarget.textContent = "이곳에 파일을 올려보세요";
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
  cancelActiveJob(state);

  if (nextFiles.length === 0) {
    state.status.textContent = "No files were added.";
    return;
  }

  const invalidReason = validateFilesForConfig(nextFiles, state.config);

  if (invalidReason) {
    state.input.value = "";
    state.status.textContent = invalidReason;
    return;
  }

  const { files: acceptedFiles, duplicateCount } = getAcceptedFiles(
    nextFiles,
    shouldAppendFiles(state.config) ? state.files : []
  );

  if (acceptedFiles.length === 0) {
    state.input.value = "";
    state.status.textContent =
      duplicateCount > 0 ? `Skipped ${duplicateCount} duplicate file(s).` : "No files were added.";
    return;
  }

  const nextPreviews = acceptedFiles.map((file) => createPreviewRecord(file));
  const nextFrameSettings = createFrameSettings(acceptedFiles, state.settings.gifFrameDelay);
  const nextFileSettings = createFileSettings(acceptedFiles, state);

  if (shouldAppendFiles(state.config)) {
    state.files = [...state.files, ...acceptedFiles];
    state.previews = [...state.previews, ...nextPreviews];
    state.frameSettings = [...state.frameSettings, ...nextFrameSettings];
    state.fileSettings = [...state.fileSettings, ...nextFileSettings];
  } else {
    revokePreviewUrls(state.previews);
    state.files = acceptedFiles;
    state.previews = nextPreviews;
    state.frameSettings = nextFrameSettings;
    state.fileSettings = nextFileSettings;
  }

  state.results = [];
  state.downloadAllButton.disabled = true;
  renderState(state);
  state.input.value = "";
  state.status.textContent = `${state.files.length} file(s) ready. ${state.config.statusReady}${
    duplicateCount > 0 ? ` Skipped ${duplicateCount} duplicate file(s).` : ""
  }`;
}

function getSettingsDefinitions(config) {
  return [...(config.settings || []), ...sharedOutputSettings];
}

function renderSettingsPanel(panel, state) {
  const settingsDefinitions = getSettingsDefinitions(state.config);

  if (!settingsDefinitions.length) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "settings-panel";
  section.setAttribute("aria-label", "출력 설정");

  const heading = document.createElement("div");
  heading.className = "settings-heading";

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "SETTINGS";

  const title = document.createElement("h3");
  title.textContent = "출력 설정";

  const description = document.createElement("p");
  description.textContent = "변환 전에 품질, 배경, 문서 출력 옵션을 조정할 수 있습니다.";

  heading.append(eyebrow, title, description);

  const grid = document.createElement("div");
  grid.className = "settings-grid";

  settingsDefinitions.forEach((setting) => {
    grid.append(createSettingField(setting, state));
  });

  section.append(heading, grid);
  panel.insertBefore(section, panel.querySelector(".uploader-box"));
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

  field.append(labelRow, description, input);
  bindSettingInput(input, setting, state, valuePreview);
  return field;
}

function bindSettingInput(input, setting, state, valuePreview) {
  const update = () => {
    const nextValue =
      setting.type === "checkbox"
        ? input.checked
        : setting.type === "range" || setting.type === "number"
          ? Number(input.value)
          : input.value;

    state.settings[setting.key] = nextValue;

    if (valuePreview) {
      valuePreview.textContent = formatSettingValue(setting, nextValue);
    }

    if (typeof state.config.onSettingChange === "function") {
      state.config.onSettingChange({ state, setting, value: nextValue, api: ToolPage });
    }

    if (state.results.length > 0) {
      state.results = [];
      state.downloadAllButton.disabled = true;
      renderState(state);
      state.status.textContent = "설정이 변경되었습니다. 현재 파일로 다시 생성해 주세요.";
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
  state.actionToken += 1;
  state.activeJobToken = 0;
}

function setSettingsDisabled(state, disabled) {
  state.settingsRoot?.querySelectorAll("input, select").forEach((element) => {
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
      "DRAG 핸들을 잡고 원하는 위치로 옮겨 순서를 바꾸세요. 키보드에서는 핸들을 선택한 뒤 방향키, Home, End로 이동할 수 있습니다.";
    state.list.append(guide);
    guide.textContent = "DRAG 핸들을 잡고 원하는 위치로 끌어 순서를 바꿔보세요.";
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
        `${file.name} 순서 이동. 현재 ${index + 1}번째입니다. 방향키, Home, End 또는 드래그로 이동하세요.`
      );
      handle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown Home End");
      handle.addEventListener("click", () => {
        state.status.textContent = "핸들을 드래그하거나 방향키로 파일 순서를 바꿔 주세요.";
      });
      handle.addEventListener("keydown", (event) => handleQueueKeydown(event, state, index));
      handle.addEventListener("pointerdown", (event) => startPointerQueueDrag(event, state, index, card, handle));
      handle.addEventListener("pointermove", (event) => updatePointerQueueDrag(event, state));
      handle.addEventListener("pointerup", (event) => finishPointerQueueDrag(event, state));
      handle.addEventListener("pointercancel", () => cancelPointerQueueDrag(state));
      handle.addEventListener("dragstart", (event) => startQueueDrag(event, state, index, card));
      handle.addEventListener("dragend", () => endQueueDrag(state));
      handle.setAttribute("aria-label", `${file.name} 순서 이동. 현재 ${index + 1}번째입니다. 드래그로 이동하세요.`);
      handle.removeAttribute("aria-keyshortcuts");
      handle.addEventListener(
        "keydown",
        (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
        },
        true
      );
      handle.addEventListener("click", () => {
        state.status.textContent = "DRAG 핸들을 끌어서 파일 순서를 바꿔주세요.";
      });

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
  if (state.dragIndex === null) {
    return;
  }

  event.preventDefault();
  previewQueueMove(state, getQueueMovePlanFromPoint(state, state.dragIndex, event.clientX, event.clientY));

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function finishQueueDrop(event, state, index, card) {
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
  const movementByKey = {
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
  if (event.isPrimary === false || state.files.length <= 1) {
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
  if (!state.pointerDrag || state.pointerDrag.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  previewQueueMove(state, getQueueMovePlanFromPoint(state, state.pointerDrag.fromIndex, event.clientX, event.clientY));
}

function finishPointerQueueDrag(event, state) {
  if (!state.pointerDrag || state.pointerDrag.pointerId !== event.pointerId) {
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
    state.status.textContent = describeQueueMovePlan(state, movePlan);
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
  state.downloadAllButton.disabled = true;
  renderState(state);
  state.status.textContent = describeQueueMoveResult(moved, target, movePlan);

  if (options.focusMoved) {
    state.list.querySelector(`.queue-card[data-index="${movePlan.targetIndex}"] .queue-drag-handle`)?.focus({ preventScroll: true });
  }
}

function removeFileAtIndex(state, index, options = {}) {
  const normalizedIndex = Number(index);

  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= state.files.length) {
    return;
  }

  if (options.confirmMessage && !window.confirm(options.confirmMessage)) {
    state.status.textContent = "삭제가 취소되었습니다.";
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
  state.downloadAllButton.disabled = state.results.length === 0;
  renderState(state);

  if (options.successMessage) {
    state.status.textContent = options.successMessage;
    return;
  }

  if (state.files.length === 0) {
    state.status.textContent = `${removedFile.name} 파일이 제거되었습니다. 목록이 비어 있습니다.`;
    return;
  }

  state.status.textContent =
    state.config.mode === "image" && state.results.length > 0
      ? `${removedFile.name} 파일이 제거되었습니다. 남은 ${state.files.length}개 파일은 바로 다운로드할 수 있습니다.`
      : `${removedFile.name} 파일이 제거되었습니다. 현재 ${state.files.length}개 파일이 준비되었습니다.`;
}

async function createResults(files, config, settings, frameSettings, fileSettings, jobToken, state) {
  if (typeof config.createResults !== "function") {
    throw new Error("이 페이지의 변환 스크립트를 찾지 못했습니다.");
  }

  return config.createResults({
    files,
    config,
    settings,
    frameSettings,
    fileSettings,
    jobToken,
    state,
    api: ToolPage,
  });
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

  setTimeout(() => URL.revokeObjectURL(url), 0);
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
