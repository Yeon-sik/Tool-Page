const toolConfigs = {
  "png-to-jpg": {
    mode: "image",
    outputExtension: "jpg",
    mimeType: "image/jpeg",
    quality: 0.92,
    statusReady: "PNG 파일 변환 준비가 완료되었습니다.",
    statusDone: "JPG 변환이 완료되었습니다.",
    downloadAllLabel: "ZIP 다운로드",
    settings: [
      {
        key: "jpegQuality",
        label: "JPG 품질",
        description: "값이 높을수록 선명하지만 파일 크기가 커집니다.",
        type: "range",
        min: 0.6,
        max: 1,
        step: 0.01,
        defaultValue: 0.92,
        valueLabel: (value) => `${Math.round(value * 100)}%`,
      },
      {
        key: "jpegBackground",
        label: "배경색",
        description: "투명한 PNG를 JPG로 바꿀 때 채워질 배경색입니다.",
        type: "color",
        defaultValue: "#ffffff",
      },
    ],
  },
  "jpg-to-png": {
    mode: "image",
    outputExtension: "png",
    mimeType: "image/png",
    quality: 1,
    statusReady: "JPG 파일 변환 준비가 완료되었습니다.",
    statusDone: "PNG 변환이 완료되었습니다.",
    downloadAllLabel: "ZIP 다운로드",
  },
  "webp-to-png": {
    mode: "image",
    outputExtension: "png",
    mimeType: "image/png",
    quality: 1,
    statusReady: "WEBP 파일 변환 준비가 완료되었습니다.",
    statusDone: "PNG 변환이 완료되었습니다.",
    downloadAllLabel: "ZIP 다운로드",
  },
  "images-to-pdf": {
    mode: "pdf",
    outputExtension: "pdf",
    mimeType: "application/pdf",
    statusReady: "카드를 드래그해 PDF 페이지 순서를 조정할 수 있습니다.",
    statusDone: "PDF 생성이 완료되었습니다.",
    downloadAllLabel: "PDF 다운로드",
    reorderable: true,
    settings: [
      {
        key: "pdfPageSize",
        label: "페이지 크기",
        description: "출력 문서의 기본 용지 크기를 선택합니다.",
        type: "select",
        defaultValue: "a4",
        options: [
          { value: "a4", label: "A4" },
          { value: "letter", label: "Letter" },
        ],
      },
      {
        key: "pdfOrientation",
        label: "페이지 방향",
        description: "자동은 이미지 비율에 맞춰 세로와 가로를 정합니다.",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "자동" },
          { value: "portrait", label: "세로" },
          { value: "landscape", label: "가로" },
        ],
      },
      {
        key: "pdfImageFormat",
        label: "이미지 인코딩",
        description: "PNG 유지는 투명을 살리고, JPG 압축은 용량을 줄입니다.",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "자동" },
          { value: "png", label: "PNG 유지" },
          { value: "jpeg", label: "JPG 압축" },
        ],
      },
      {
        key: "pdfJpegQuality",
        label: "JPG 품질",
        description: "PDF를 JPG로 압축할 때의 화질 수준입니다.",
        type: "range",
        min: 0.6,
        max: 1,
        step: 0.01,
        defaultValue: 0.92,
        valueLabel: (value) => `${Math.round(value * 100)}%`,
      },
      {
        key: "pdfDpi",
        label: "출력 해상도",
        description: "높을수록 더 선명하지만 생성 시간과 용량이 늘어납니다.",
        type: "select",
        defaultValue: "150",
        options: [
          { value: "96", label: "96 DPI" },
          { value: "150", label: "150 DPI" },
          { value: "200", label: "200 DPI" },
        ],
      },
      {
        key: "pdfBackground",
        label: "평탄화 배경",
        description: "투명 이미지를 JPG로 넣을 때 사용할 배경색입니다.",
        type: "color",
        defaultValue: "#ffffff",
      },
    ],
  },
  "images-to-pptx": {
    mode: "pptx",
    outputExtension: "pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    statusReady: "카드를 드래그해 PPTX 슬라이드 순서를 조정할 수 있습니다.",
    statusDone: "PPTX 생성이 완료되었습니다.",
    downloadAllLabel: "PPTX 다운로드",
    reorderable: true,
    settings: [
      {
        key: "pptxDpi",
        label: "슬라이드 해상도",
        description: "슬라이드에 배치할 이미지의 렌더링 해상도입니다.",
        type: "select",
        defaultValue: "144",
        options: [
          { value: "96", label: "96 DPI" },
          { value: "144", label: "144 DPI" },
          { value: "192", label: "192 DPI" },
        ],
      },
      {
        key: "pptxBackground",
        label: "슬라이드 배경",
        description: "슬라이드 바탕색과 꽉 채우기 모드의 빈 영역 색상입니다.",
        type: "color",
        defaultValue: "#000000",
      },
      {
        key: "pptxFileLabel",
        label: "파일명 표시",
        description: "각 슬라이드 하단에 원본 파일명을 함께 넣습니다.",
        type: "checkbox",
        defaultValue: true,
      },
      {
        key: "pptxFitMode",
        label: "배치 방식",
        description: "전체 맞춤은 잘림 없이 배치하고, 꽉 채우기는 화면을 가득 채웁니다.",
        type: "select",
        defaultValue: "contain",
        options: [
          { value: "contain", label: "전체 맞춤" },
          { value: "cover", label: "꽉 채우기" },
        ],
      },
    ],
  },
  "images-to-gif": {
    mode: "gif",
    outputExtension: "gif",
    mimeType: "image/gif",
    statusReady: "카드를 드래그해 GIF 프레임 순서를 조정할 수 있습니다.",
    statusDone: "GIF 생성이 완료되었습니다.",
    downloadAllLabel: "GIF 다운로드",
    reorderable: true,
    settings: [
      {
        key: "gifFrameDelay",
        label: "기본 프레임 지연",
        description: "각 프레임의 기본 재생 시간을 밀리초 단위로 정합니다.",
        type: "range",
        min: 60,
        max: 1200,
        step: 20,
        defaultValue: 180,
        valueLabel: (value) => `${value}ms`,
      },
      {
        key: "gifMaxWidth",
        label: "출력 너비",
        description: "첫 프레임 기준 캔버스 너비를 정해 용량과 선명도를 조절합니다.",
        type: "select",
        defaultValue: "720",
        options: [
          { value: "original", label: "원본 유지" },
          { value: "480", label: "480px" },
          { value: "720", label: "720px" },
          { value: "960", label: "960px" },
        ],
      },
      {
        key: "gifFitMode",
        label: "배치 방식",
        description: "전체 맞춤은 잘림 없이 배치하고, 꽉 채우기는 캔버스를 가득 채웁니다.",
        type: "select",
        defaultValue: "contain",
        options: [
          { value: "contain", label: "전체 맞춤" },
          { value: "cover", label: "꽉 채우기" },
        ],
      },
      {
        key: "gifRepeat",
        label: "반복 재생",
        description: "무한 반복 또는 지정 횟수만큼 재생되도록 설정합니다.",
        type: "select",
        defaultValue: "0",
        options: [
          { value: "0", label: "무한 반복" },
          { value: "1", label: "1회 재생" },
          { value: "3", label: "3회 반복" },
        ],
      },
      {
        key: "gifQualityProfile",
        label: "품질 프로필",
        description: "고품질일수록 계단 현상이 줄지만 생성 시간이 늘어납니다.",
        type: "select",
        defaultValue: "balanced",
        options: [
          { value: "smaller", label: "작은 파일" },
          { value: "balanced", label: "균형" },
          { value: "sharp", label: "고품질" },
        ],
      },
      {
        key: "gifBackground",
        label: "배경색",
        description: "여백이나 투명 영역을 채울 배경색입니다.",
        type: "color",
        defaultValue: "#000000",
      },
    ],
  },
};

const pageFormats = {
  a4: { jsPdfFormat: "a4" },
  letter: { jsPdfFormat: "letter" },
};

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

const GIF_WORKER_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js";
let gifWorkerScriptUrlPromise = null;

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "tool") {
    initializeToolPage();
  }
});

function initializeToolPage() {
  const panel = document.querySelector("[data-tool]");

  if (!panel) {
    return;
  }

  const input = panel.querySelector('input[type="file"]');
  const list = panel.querySelector('[data-role="list"]');
  const status = panel.querySelector('[data-role="status"]');
  const downloadAllButton = panel.querySelector('[data-action="download-all"]');
  const convertButton = panel.querySelector('[data-action="convert"]');
  const clearButton = panel.querySelector('[data-action="clear"]');
  const uploaderBox = panel.querySelector(".uploader-box");
  const config = toolConfigs[panel.dataset.tool];

  if (!config || !input || !list || !status || !downloadAllButton || !convertButton || !clearButton || !uploaderBox) {
    return;
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
    dragIndex: null,
    dropInsertionIndex: null,
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
    state.activeJobToken = jobToken;
    state.status.textContent = "변환 중입니다. 잠시만 기다려 주세요.";
    state.convertButton.disabled = true;
    state.downloadAllButton.disabled = true;
    state.clearButton.disabled = true;
    state.input.disabled = true;
    setSettingsDisabled(state, true);

    try {
      const results = await createResults(state.files, config, jobSettings, jobFrameSettings, jobToken, state);

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
      if (config.mode === "image") {
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
    state.dragIndex = null;
    state.pointerDrag = null;
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
  return config.mode === "pdf" || config.mode === "pptx" || config.mode === "gif";
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

  if (shouldAppendFiles(state.config)) {
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

    if (state.config.mode === "gif" && setting.key === "gifFrameDelay" && state.frameSettings.length > 0) {
      state.frameSettings = state.frameSettings.map((frameSetting) => ({
        ...frameSetting,
        delay: frameSetting.isCustom ? frameSetting.delay : Number(nextValue),
      }));
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

  renderQueueState(state);
}

function renderImageState(state) {
  state.files.forEach((file, index) => {
    const result = state.results[index];
    const card = document.createElement("article");
    card.className = "file-card media-card uploaded-card";

    const preview = createFilePreview(state.previews[index], file.name, {
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

function renderQueueState(state) {
  const isReorderable = Boolean(state.config.reorderable) && state.files.length > 1;
  state.list.classList.toggle("is-reorderable", isReorderable && state.files.length > 1);

  if (state.config.mode === "gif" && state.files.length > 1) {
    state.list.append(createGifQueueUtilityBar(state));
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
      captionText: state.config.mode === "gif" ? "FRAME" : "ORDER",
      deleteAction:
        state.config.mode === "gif"
          ? () =>
              removeFileAtIndex(state, index, {
                confirmMessage: `${file.name} 프레임을 삭제할까요?`,
                successMessage: `${file.name} 프레임이 삭제되었습니다.`,
              })
          : null,
      deleteLabel: `${file.name} 프레임 삭제`,
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

    actions.append(createRemoveButton(state, index, file.name));

    if (state.config.mode === "gif") {
      actions.querySelector(".remove-file-button")?.remove();
      actions.append(createGifDuplicateButton(state, index, file.name));
      actions.append(createGifFrameEditor(state, index));
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
    state.config.mode === "gif"
      ? `완료 · ${formatFileSize(result.blob.size)} · ${result.summary}`
      : `완료 · ${formatFileSize(result.blob.size)} · ${
          state.config.mode === "pdf" ? "PDF 문서" : "PowerPoint 문서"
        }`;

  resultMeta.append(resultTitle, resultInfo);

  if (state.config.mode === "gif" && result.previewDataUrl) {
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
  downloadButton.textContent =
    state.config.mode === "pdf" ? "PDF 다운로드" : state.config.mode === "gif" ? "GIF 다운로드" : "PPTX 다운로드";
  downloadButton.addEventListener("click", () => downloadBlob(result.blob, result.fileName));
  resultActions.append(downloadButton);

  resultCard.append(resultMeta, resultActions);
  state.list.append(resultCard);
}

function startQueueDrag(event, state, index, card) {
  state.dragIndex = index;
  state.dropInsertionIndex = index;
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
  const dropIndex = getInsertionIndexFromPoint(state, event.clientX, event.clientY);
  state.dropInsertionIndex = dropIndex;
  clearQueueDropIndicators(state);
  showDropIndicator(state, dropIndex);
  updateQueuePreview(state, dropIndex);

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
}

function finishQueueDrop(event, state, index, card) {
  event.preventDefault();

  const rawIndex = event.dataTransfer?.getData("text/plain");
  const fromIndex = state.dragIndex ?? Number(rawIndex);
  const dropIndex = state.dropInsertionIndex ?? getInsertionIndexFromPoint(state, event.clientX, event.clientY);

  reorderFile(state, fromIndex, dropIndex);
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
  resetQueuePreview(state);
  state.list.querySelectorAll(".queue-card").forEach((card) => {
    card.classList.remove("is-dragging", "drop-before", "drop-after");
  });
}

function handleQueueKeydown(event, state, index) {
  const movementByKey = {
    ArrowUp: index - 1,
    ArrowDown: index + 2,
    Home: 0,
    End: state.files.length,
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
  card.classList.add("is-dragging");
  handle.setPointerCapture?.(event.pointerId);
}

function updatePointerQueueDrag(event, state) {
  if (!state.pointerDrag || state.pointerDrag.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  const insertionIndex = getInsertionIndexFromPoint(state, event.clientX, event.clientY);
  state.dropInsertionIndex = insertionIndex;
  clearQueueDropIndicators(state);
  showDropIndicator(state, insertionIndex);
  updateQueuePreview(state, insertionIndex);
}

function finishPointerQueueDrag(event, state) {
  if (!state.pointerDrag || state.pointerDrag.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  const { fromIndex, handle, pointerId } = state.pointerDrag;
  const insertionIndex = getPointerInsertionIndex(state, event.clientY);

  if (handle.hasPointerCapture?.(pointerId)) {
    handle.releasePointerCapture(pointerId);
  }

  state.pointerDrag = null;
  reorderFile(state, fromIndex, state.dropInsertionIndex ?? insertionIndex, { focusMoved: true });
  endQueueDrag(state);
}

function cancelPointerQueueDrag(state) {
  state.pointerDrag = null;
  endQueueDrag(state);
}

function getPointerInsertionIndex(state, clientY) {
  const cards = Array.from(state.list.querySelectorAll(".queue-card"));

  for (const card of cards) {
    const rect = card.getBoundingClientRect();
    const index = Number(card.dataset.index);

    if (clientY < rect.top + rect.height / 2) {
      return index;
    }
  }

  return state.files.length;
}

function showDropIndicator(state, insertionIndex) {
  const targetIndex = Math.min(insertionIndex, state.files.length - 1);
  const card = state.list.querySelector(`.queue-card[data-index="${targetIndex}"]`);

  if (!card) {
    return;
  }

  card.classList.add(insertionIndex >= state.files.length ? "drop-after" : "drop-before");
}

function getInsertionIndexFromPoint(state, clientX, clientY) {
  const cards = Array.from(state.list.querySelectorAll(".queue-card")).map((card) => ({
    card,
    index: Number(card.dataset.index),
    rect: card.getBoundingClientRect(),
  }));

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

  return state.files.length;
}

function buildPreviewOrder(length, fromIndex, insertionIndex) {
  const indexes = Array.from({ length }, (_, index) => index);
  const normalizedFrom = Number(fromIndex);
  const normalizedInsertion = Math.max(0, Math.min(Number(insertionIndex), length));

  if (
    !Number.isInteger(normalizedFrom) ||
    normalizedFrom < 0 ||
    normalizedFrom >= length ||
    normalizedFrom === normalizedInsertion ||
    normalizedFrom + 1 === normalizedInsertion
  ) {
    return indexes;
  }

  const [moved] = indexes.splice(normalizedFrom, 1);
  const targetIndex = normalizedFrom < normalizedInsertion ? normalizedInsertion - 1 : normalizedInsertion;
  indexes.splice(targetIndex, 0, moved);
  return indexes;
}

function updateQueuePreview(state, insertionIndex) {
  if (state.dragIndex === null) {
    return;
  }

  const previewOrder = buildPreviewOrder(state.files.length, state.dragIndex, insertionIndex);

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

function reorderFile(state, fromIndex, insertionIndex, options = {}) {
  const normalizedFrom = Number(fromIndex);
  const normalizedInsertion = Math.max(0, Math.min(Number(insertionIndex), state.files.length));

  if (
    !Number.isInteger(normalizedFrom) ||
    normalizedFrom < 0 ||
    normalizedFrom >= state.files.length ||
    normalizedFrom === normalizedInsertion ||
    normalizedFrom + 1 === normalizedInsertion
  ) {
    return;
  }

  const files = [...state.files];
  const previews = [...state.previews];
  const frameSettings = [...state.frameSettings];
  const [moved] = files.splice(normalizedFrom, 1);
  const [movedPreview] = previews.splice(normalizedFrom, 1);
  const [movedFrameSetting] = frameSettings.splice(normalizedFrom, 1);
  const targetIndex = normalizedFrom < normalizedInsertion ? normalizedInsertion - 1 : normalizedInsertion;
  files.splice(targetIndex, 0, moved);
  previews.splice(targetIndex, 0, movedPreview);
  frameSettings.splice(targetIndex, 0, movedFrameSetting);

  state.files = files;
  state.previews = previews;
  state.frameSettings = frameSettings;
  state.results = [];
  state.downloadAllButton.disabled = true;
  renderState(state);
  state.status.textContent = `${moved.name} 파일이 ${targetIndex + 1}번째로 이동했습니다. 현재 순서로 다시 생성해 주세요.`;

  if (options.focusMoved) {
    state.list.querySelector(`.queue-card[data-index="${targetIndex}"] .queue-drag-handle`)?.focus({ preventScroll: true });
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
  state.results =
    state.config.mode === "image"
      ? state.results.filter((_, resultIndex) => resultIndex !== normalizedIndex)
      : [];
  state.dragIndex = null;
  state.dropInsertionIndex = null;
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

function duplicateGifFrameAtIndex(state, index) {
  const normalizedIndex = Number(index);

  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= state.files.length) {
    return;
  }

  cancelActiveJob(state);

  const sourceFile = state.files[normalizedIndex];
  const sourceFrameSetting = state.frameSettings[normalizedIndex] || {
    delay: Number(state.settings.gifFrameDelay || 180),
    isCustom: false,
  };
  const insertIndex = normalizedIndex + 1;

  state.files = [...state.files.slice(0, insertIndex), sourceFile, ...state.files.slice(insertIndex)];
  state.previews = [
    ...state.previews.slice(0, insertIndex),
    createPreviewRecord(sourceFile),
    ...state.previews.slice(insertIndex),
  ];
  state.frameSettings = [
    ...state.frameSettings.slice(0, insertIndex),
    { ...sourceFrameSetting },
    ...state.frameSettings.slice(insertIndex),
  ];
  state.results = [];
  state.downloadAllButton.disabled = true;
  renderState(state);
  state.status.textContent = `${sourceFile.name} frame duplicated at position ${insertIndex + 1}.`;
}

function reverseGifFrames(state) {
  if (state.files.length <= 1) {
    return;
  }

  cancelActiveJob(state);
  state.files = [...state.files].reverse();
  state.previews = [...state.previews].reverse();
  state.frameSettings = [...state.frameSettings].reverse();
  state.results = [];
  state.dragIndex = null;
  state.dropInsertionIndex = null;
  state.pointerDrag = null;
  state.downloadAllButton.disabled = true;
  renderState(state);
  state.status.textContent = "GIF frame order reversed.";
}

async function createResults(files, config, settings, frameSettings, jobToken, state) {
  if (config.mode === "pdf") {
    return [await createPdfResult(files, settings, jobToken, state)];
  }

  if (config.mode === "pptx") {
    return [await createPptxResult(files, settings, jobToken, state)];
  }

  if (config.mode === "gif") {
    return [await createGifResult(files, settings, frameSettings, jobToken, state)];
  }

  return createImageResults(files, config, settings, jobToken, state);
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

async function createPdfResult(files, settings, jobToken, state) {
  if (!window.jspdf?.jsPDF) {
    throw new Error("jsPDF 라이브러리를 불러오지 못했습니다.");
  }

  const formatKey = settings.pdfPageSize || "a4";
  const pageFormat = pageFormats[formatKey] || pageFormats.a4;
  const initialOrientation = settings.pdfOrientation === "landscape" ? "landscape" : "portrait";
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    unit: "pt",
    format: pageFormat.jsPdfFormat,
    orientation: initialOrientation,
  });

  const dpi = Number(settings.pdfDpi || 150);
  const forcedFormat = settings.pdfImageFormat || "auto";
  const jpegQuality = Number(settings.pdfJpegQuality || 0.92);
  const flattenBackground = settings.pdfBackground || "#ffffff";

  for (let index = 0; index < files.length; index += 1) {
    assertJobActive(state, jobToken);

    const file = files[index];
    const image = await loadImage(file);
    const orientation = resolvePdfOrientation(image, settings.pdfOrientation);

    if (index > 0) {
      pdf.addPage(pageFormat.jsPdfFormat, orientation);
    } else if (orientation !== initialOrientation) {
      pdf.deletePage(1);
      pdf.addPage(pageFormat.jsPdfFormat, orientation);
    }

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const fitted = fitWithinBox(image.naturalWidth, image.naturalHeight, pageWidth, pageHeight);
    const renderWidthPx = Math.max(1, Math.round((fitted.width * dpi) / 72));
    const renderHeightPx = Math.max(1, Math.round((fitted.height * dpi) / 72));
    const rendered = await renderImageToBlob(image, {
      width: renderWidthPx,
      height: renderHeightPx,
      format: forcedFormat === "png" ? "png" : "jpeg",
      quality: jpegQuality,
      backgroundColor: flattenBackground,
      autoFormat: forcedFormat === "auto",
    });

    const offsetX = (pageWidth - fitted.width) / 2;
    const offsetY = (pageHeight - fitted.height) / 2;
    const dataUrl = await blobToDataUrl(rendered.blob);

    assertJobActive(state, jobToken);
    pdf.addImage(
      dataUrl,
      rendered.format === "png" ? "PNG" : "JPEG",
      offsetX,
      offsetY,
      fitted.width,
      fitted.height,
      undefined,
      "FAST"
    );
  }

  return {
    blob: pdf.output("blob"),
    fileName: buildBundleFileName(settings, "images-to-pdf", "pdf"),
  };
}

async function createPptxResult(files, settings, jobToken, state) {
  if (!window.PptxGenJS) {
    throw new Error("PptxGenJS 라이브러리를 불러오지 못했습니다.");
  }

  const pptx = new window.PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Tool Page";
  pptx.company = "Tool Page";
  pptx.subject = "Image to PowerPoint Conversion";
  pptx.title = "Images to PPTX";

  const slideWidth = 13.333;
  const slideHeight = 7.5;
  const margin = 0.35;
  const labelHeight = settings.pptxFileLabel ? 0.35 : 0;
  const usableWidth = slideWidth - margin * 2;
  const usableHeight = slideHeight - margin * 2 - labelHeight;
  const dpi = Number(settings.pptxDpi || 144);
  const backgroundColor = normalizeHexColor(settings.pptxBackground || "#000000");

  for (const file of files) {
    assertJobActive(state, jobToken);

    const image = await loadImage(file);
    const slide = pptx.addSlide();
    const placement =
      settings.pptxFitMode === "cover"
        ? coverWithinBox(image.naturalWidth, image.naturalHeight, usableWidth, usableHeight)
        : fitWithinBox(image.naturalWidth, image.naturalHeight, usableWidth, usableHeight);
    const renderWidthPx = Math.max(1, Math.round(placement.width * dpi));
    const renderHeightPx = Math.max(1, Math.round(placement.height * dpi));
    const rendered = await renderImageToBlob(image, {
      width: renderWidthPx,
      height: renderHeightPx,
      format: "png",
      backgroundColor: settings.pptxFitMode === "cover" ? settings.pptxBackground || "#000000" : null,
      crop: settings.pptxFitMode === "cover",
      cropBox: {
        width: placement.sourceWidth,
        height: placement.sourceHeight,
        x: placement.sourceX,
        y: placement.sourceY,
      },
    });
    const dataUrl = await blobToDataUrl(rendered.blob);

    slide.background = { color: backgroundColor };

    if (settings.pptxFileLabel) {
      slide.addText(file.name, {
        x: margin,
        y: slideHeight - margin - 0.15,
        w: slideWidth - margin * 2,
        h: labelHeight,
        color: "FF00FF",
        fontFace: "Aptos",
        fontSize: 10,
        bold: true,
        align: "center",
        margin: 0,
      });
    }

    slide.addImage({
      data: dataUrl,
      x: (slideWidth - placement.width) / 2,
      y: margin + (usableHeight - placement.height) / 2,
      w: placement.width,
      h: placement.height,
    });
  }

  assertJobActive(state, jobToken);

  return {
    blob: await pptx.write({ outputType: "blob" }),
    fileName: buildBundleFileName(settings, "images-to-pptx", "pptx"),
  };
}

async function createGifResult(files, settings, frameSettings, jobToken, state) {
  if (!window.GIF) {
    throw new Error("GIF 라이브러리를 불러오지 못했습니다.");
  }

  const images = [];

  for (const file of files) {
    assertJobActive(state, jobToken);
    images.push(await loadImage(file));
  }

  const canvasSize = resolveGifCanvasSize(images[0], settings.gifMaxWidth || "720");
  const qualityProfile = getGifQualityProfile(settings.gifQualityProfile || "balanced");
  const frameDelay = Number(settings.gifFrameDelay || 180);
  const repeat = Number(settings.gifRepeat || 0);
  const workerScript = await resolveGifWorkerScriptUrl();
  const gif = new window.GIF({
    workers: 2,
    workerScript,
    width: canvasSize.width,
    height: canvasSize.height,
    quality: qualityProfile.quality,
    repeat,
    background: settings.gifBackground || "#000000",
  });

  images.forEach((image, index) => {
    assertJobActive(state, jobToken);
    const canvas = renderImageFrameCanvas(image, {
      width: canvasSize.width,
      height: canvasSize.height,
      fitMode: settings.gifFitMode || "contain",
      backgroundColor: settings.gifBackground || "#000000",
    });

    gif.addFrame(canvas, { delay: Number(frameSettings[index]?.delay || frameDelay), copy: true });

    if (isJobActive(state, jobToken)) {
      state.status.textContent = `${index + 1}/${images.length} 프레임을 준비했습니다. GIF를 렌더링하는 중입니다.`;
    }
  });

  const blob = await new Promise((resolve, reject) => {
    gif.on("finished", resolve);
    gif.on("progress", (progress) => {
      if (isJobActive(state, jobToken)) {
        state.status.textContent = `GIF 렌더링 중입니다. ${Math.round(progress * 100)}%`;
      }
    });
    gif.on("abort", () => reject(new Error("GIF 생성이 중단되었습니다.")));
    gif.render();
  });

  assertJobActive(state, jobToken);

  return {
    blob,
    previewDataUrl: await blobToDataUrl(blob),
    fileName: buildBundleFileName(settings, "images-to-gif", "gif"),
    summary: `${files.length}프레임 · ${summarizeFrameDelays(frameSettings, frameDelay)} · ${describeLoopCount(repeat)} · ${canvasSize.width}x${canvasSize.height}`,
  };
}

async function resolveGifWorkerScriptUrl() {
  if (gifWorkerScriptUrlPromise) {
    return gifWorkerScriptUrlPromise;
  }

  gifWorkerScriptUrlPromise = fetchGifWorkerScriptUrl();
  return gifWorkerScriptUrlPromise;
}

async function fetchGifWorkerScriptUrl() {
  try {
    const response = await fetch(GIF_WORKER_CDN_URL, {
      mode: "cors",
      cache: "force-cache",
    });

    if (!response.ok) {
      throw new Error(`GIF worker request failed with ${response.status}`);
    }

    const source = await response.text();
    const blob = new Blob([source], { type: "text/javascript" });
    return URL.createObjectURL(blob);
  } catch (error) {
    gifWorkerScriptUrlPromise = null;
    console.error(error);
    throw new Error("GIF worker 스크립트를 준비하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
  }
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

function resolvePdfOrientation(image, setting) {
  if (setting === "portrait" || setting === "landscape") {
    return setting;
  }

  return image.naturalWidth > image.naturalHeight ? "landscape" : "portrait";
}

function normalizeHexColor(color) {
  return String(color).replace("#", "").toUpperCase();
}

function resolveGifCanvasSize(firstImage, maxWidthSetting) {
  const targetWidth =
    maxWidthSetting === "original" ? firstImage.naturalWidth : Math.min(firstImage.naturalWidth, Number(maxWidthSetting || 720));
  const targetHeight = Math.max(1, Math.round((firstImage.naturalHeight / firstImage.naturalWidth) * targetWidth));

  return {
    width: Math.max(1, Math.round(targetWidth)),
    height: targetHeight,
  };
}

function getGifQualityProfile(profile) {
  const profiles = {
    smaller: { quality: 20 },
    balanced: { quality: 10 },
    sharp: { quality: 5 },
  };

  return profiles[profile] || profiles.balanced;
}

function renderImageFrameCanvas(image, options) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas context를 만들 수 없습니다.");
  }

  canvas.width = options.width;
  canvas.height = options.height;
  context.fillStyle = options.backgroundColor || "#000000";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (options.fitMode === "cover") {
    const cropBox = coverWithinBox(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);
    context.drawImage(
      image,
      cropBox.sourceX,
      cropBox.sourceY,
      cropBox.sourceWidth,
      cropBox.sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height
    );
    return canvas;
  }

  const fitted = fitWithinBox(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);
  const offsetX = (canvas.width - fitted.width) / 2;
  const offsetY = (canvas.height - fitted.height) / 2;
  context.drawImage(image, offsetX, offsetY, fitted.width, fitted.height);
  return canvas;
}

function describeLoopCount(repeat) {
  if (repeat === 0) {
    return "무한 반복";
  }

  return `${repeat}회 재생`;
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

function createRemoveButton(state, index, fileName) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "remove-file-button";
  button.textContent = "REMOVE";
  button.setAttribute("aria-label", `${fileName} 파일 제거`);
  button.addEventListener("click", () => removeFileAtIndex(state, index));
  return button;
}

function createGifDuplicateButton(state, index, fileName) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "duplicate-file-button";
  button.textContent = "COPY";
  button.setAttribute("aria-label", `${fileName} frame duplicate`);
  button.addEventListener("click", () => duplicateGifFrameAtIndex(state, index));
  return button;
}

function createGifQueueUtilityBar(state) {
  const toolbar = document.createElement("div");
  toolbar.className = "queue-utility-bar";

  const reverseButton = document.createElement("button");
  reverseButton.type = "button";
  reverseButton.className = "queue-utility-button";
  reverseButton.textContent = "REVERSE";
  reverseButton.addEventListener("click", () => reverseGifFrames(state));

  toolbar.append(reverseButton);
  return toolbar;
}

function createGifFrameEditor(state, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "frame-setting";

  const label = document.createElement("span");
  label.className = "frame-setting-label";
  label.textContent = index === state.files.length - 1 ? "마지막 프레임 지연" : "다음 프레임 전 지연";

  const input = document.createElement("input");
  input.type = "number";
  input.className = "frame-setting-input";
  input.min = "60";
  input.max = "1200";
  input.step = "10";
  input.value = String(state.frameSettings[index]?.delay || state.settings.gifFrameDelay || 180);
  const commitDelay = () => {
    const nextValue = Math.max(60, Math.min(1200, Number(input.value) || Number(state.settings.gifFrameDelay || 180)));
    state.frameSettings[index] = {
      delay: nextValue,
      isCustom: true,
    };
    input.value = String(nextValue);

    if (state.results.length > 0) {
      state.results = [];
      state.downloadAllButton.disabled = true;
      state.status.textContent = "프레임 지연이 변경되었습니다. 현재 순서로 다시 생성해 주세요.";
      renderState(state);
    }
  };
  input.addEventListener("change", commitDelay);
  input.addEventListener("blur", commitDelay);

  wrapper.append(label, input);
  return wrapper;
}

function summarizeFrameDelays(frameSettings, fallbackDelay) {
  if (!frameSettings.length) {
    return `${fallbackDelay}ms`;
  }

  const uniqueDelays = [...new Set(frameSettings.map((frameSetting) => Number(frameSetting.delay || fallbackDelay)))];
  return uniqueDelays.length === 1 ? `${uniqueDelays[0]}ms` : "개별 지연";
}
