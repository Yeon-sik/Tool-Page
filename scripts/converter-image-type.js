const IMAGE_TYPE_OUTPUTS = {
  jpg: {
    extension: "jpg",
    format: "jpeg",
    mimeType: "image/jpeg",
  },
  png: {
    extension: "png",
    format: "png",
    mimeType: "image/png",
  },
  webp: {
    extension: "webp",
    format: "webp",
    mimeType: "image/webp",
  },
};

const IMAGE_TYPE_INPUT_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "svg", "tif", "tiff"]);
const IMAGE_TYPE_MAX_PIXELS = 80_000_000;
const IMAGE_TYPE_MAX_DIMENSION = 16_384;

ToolPage.registerTool("converter-image-type", {
  mode: "image",
  outputExtension: "png",
  mimeType: "image/png",
  quality: 0.92,
  statusReady: "이미지 타입 변환 준비가 완료되었습니다.",
  statusDone: "이미지 타입 변환이 완료되었습니다.",
  downloadAllLabel: "ZIP 다운로드",
  useResultPreviewAsFilePreview: true,
  settings: [
    {
      key: "imageOutputMode",
      label: "변환 방식",
      description: "한 가지 형식으로 통일하거나 파일마다 출력 형식을 지정합니다.",
      type: "select",
      defaultValue: "same",
      options: [
        { value: "same", label: "옵션1 · 모두 같은 형식" },
        { value: "individual", label: "옵션2 · 파일별 형식 지정" },
      ],
    },
    {
      key: "imageOutputFormat",
      label: "공통 출력 형식",
      description: "옵션1에서 선택한 모든 이미지를 같은 형식으로 내보냅니다.",
      type: "select",
      defaultValue: "png",
      options: [
        { value: "jpg", label: "JPG" },
        { value: "png", label: "PNG" },
        { value: "webp", label: "WEBP" },
      ],
    },
    {
      key: "imageOutputQuality",
      label: "압축 품질",
      description: "JPG 또는 WEBP로 저장할 때 적용되는 품질입니다.",
      type: "range",
      min: 0.6,
      max: 1,
      step: 0.01,
      defaultValue: 0.92,
      valueLabel: (value) => `${Math.round(value * 100)}%`,
    },
    {
      key: "imageOutputBackground",
      label: "배경색",
      description: "JPG로 저장할 때 투명 영역에 채워질 색상입니다.",
      type: "color",
      defaultValue: "#ffffff",
    },
  ],
  validateFiles: (files) => {
    const unsupportedFile = files.find((file) => !IMAGE_TYPE_INPUT_EXTENSIONS.has(getFileExtension(file.name)));
    return unsupportedFile
      ? `${unsupportedFile.name} 파일 형식은 지원하지 않습니다. JPG, PNG, WEBP, SVG, TIFF 파일을 선택해 주세요.`
      : "";
  },
  onReady: ({ state }) => syncImageTypeModeUi(state),
  onSettingChange: ({ state, setting, api }) => {
    if (setting.key !== "imageOutputMode") {
      return;
    }

    syncImageTypeModeUi(state);

    if (state.files.length > 0) {
      state.fileSettings = state.files.map((file, index) => ({
        ...state.fileSettings[index],
        outputFormat: state.fileSettings[index]?.outputFormat || getAutoImageTypeOutputFormat(file),
      }));
      api.renderState(state);
      state.status.textContent =
        state.settings.imageOutputMode === "individual"
          ? "파일별 출력 형식을 지정할 수 있습니다. 기본값은 PNG/JPG로 자동 설정되었습니다."
          : "모든 이미지를 공통 출력 형식으로 변환합니다.";
    }
  },
  createFileSettings: ({ file }) => ({
    outputFormat: getAutoImageTypeOutputFormat(file),
  }),
  createImageFileControls: ({ state, file, index, result, api }) => {
    if (state.settings.imageOutputMode !== "individual") {
      return null;
    }

    return createImageTypeFileControls({ state, file, index, result, api });
  },
  createResults: ({ files, settings, fileSettings, jobToken, state, api }) =>
    createImageTypeResults(files, settings, fileSettings, jobToken, state, api),
});

async function createImageTypeResults(files, settings, fileSettings, jobToken, state, api) {
  const baseNameCounts = countSourceBaseNames(files, api);
  const results = [];

  for (const [index, file] of files.entries()) {
    api.assertJobActive(state, jobToken);
    state.status.textContent = `${index + 1}/${files.length} 이미지 타입을 변환하고 있습니다.`;

    const outputFormat = resolveImageTypeOutputFormat(file, settings, fileSettings[index]);
    const output = IMAGE_TYPE_OUTPUTS[outputFormat] || IMAGE_TYPE_OUTPUTS.png;
    const sourceCanvas = await renderInputFileToCanvas(file, api);
    const blob = await canvasToRequestedImageBlob(sourceCanvas, {
      backgroundColor: settings.imageOutputBackground || "#ffffff",
      mimeType: output.mimeType,
      outputFormat: output.format,
      quality: Number(settings.imageOutputQuality || 0.92),
    });

    results.push({
      blob,
      fileName: api.buildOutputFileName(settings, {
        originalName: file.name,
        defaultBaseName: getOutputBaseName(file, baseNameCounts, api),
        extension: output.extension,
        index,
        total: files.length,
      }),
      previewDataUrl: await api.blobToDataUrl(blob),
      width: sourceCanvas.width,
      height: sourceCanvas.height,
    });
  }

  return results;
}

function syncImageTypeModeUi(state) {
  const commonFormatField = state.settingsRoot?.querySelector('[data-setting-key="imageOutputFormat"]');

  if (commonFormatField) {
    commonFormatField.hidden = state.settings.imageOutputMode === "individual";
  }
}

function createImageTypeFileControls({ state, file, index, result, api }) {
  const currentFormat = state.fileSettings[index]?.outputFormat || getAutoImageTypeOutputFormat(file);
  state.fileSettings[index] = {
    ...state.fileSettings[index],
    outputFormat: currentFormat,
  };

  const field = document.createElement("label");
  field.className = "file-output-control";

  const label = document.createElement("span");
  label.className = "file-output-label";
  label.textContent = "출력 형식";

  const select = document.createElement("select");
  select.dataset.fileSettingInput = "imageOutputFormat";
  select.disabled = Boolean(state.activeJobToken);

  Object.entries(IMAGE_TYPE_OUTPUTS).forEach(([value, output]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = output.extension.toUpperCase();
    select.append(option);
  });
  select.value = currentFormat;

  const note = document.createElement("span");
  note.className = "file-output-note";
  note.textContent = result ? `${result.fileName}` : `기본 ${currentFormat.toUpperCase()}`;

  select.addEventListener("change", () => {
    state.fileSettings[index] = {
      ...state.fileSettings[index],
      outputFormat: select.value,
    };

    if (state.results.length > 0) {
      state.results = [];
      state.downloadAllButton.disabled = true;
      api.renderState(state);
    }

    state.status.textContent = `${file.name} 출력 형식이 ${select.value.toUpperCase()}로 설정되었습니다.`;
  });

  field.append(label, select, note);
  return field;
}

function resolveImageTypeOutputFormat(file, settings, fileSetting) {
  if (settings.imageOutputMode === "individual") {
    return fileSetting?.outputFormat || getAutoImageTypeOutputFormat(file);
  }

  return settings.imageOutputFormat || "png";
}

function getAutoImageTypeOutputFormat(file) {
  const extension = getFileExtension(file.name);

  if (extension === "png") {
    return "jpg";
  }

  return "png";
}

function countSourceBaseNames(files, api) {
  return files.reduce((counts, file) => {
    const baseName = api.stripExtension(file.name).toLowerCase();
    counts.set(baseName, (counts.get(baseName) || 0) + 1);
    return counts;
  }, new Map());
}

function getOutputBaseName(file, baseNameCounts, api) {
  const baseName = api.stripExtension(file.name);
  const extension = getFileExtension(file.name);

  return baseNameCounts.get(baseName.toLowerCase()) > 1 ? `${baseName}-${extension}` : baseName;
}

async function renderInputFileToCanvas(file, api) {
  const extension = getFileExtension(file.name);

  if (extension === "tif" || extension === "tiff") {
    return renderTiffToCanvas(file);
  }

  const image = await api.loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    throw new Error(`${file.name} 이미지 크기를 읽을 수 없습니다.`);
  }

  assertSafeImageDimensions(width, height, file.name);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas context를 만들 수 없습니다.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

async function renderTiffToCanvas(file) {
  if (!window.UTIF) {
    throw new Error("TIFF 디코더를 불러오지 못했습니다.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const ifds = window.UTIF.decode(arrayBuffer);
  const firstImage = ifds[0];

  if (!firstImage) {
    throw new Error(`${file.name} TIFF 이미지를 읽을 수 없습니다.`);
  }

  if (ifds.length > 1) {
    throw new Error(
      `${file.name} 파일은 ${ifds.length}페이지 TIFF입니다. 데이터 누락을 막기 위해 단일 페이지 TIFF만 변환할 수 있습니다.`
    );
  }

  window.UTIF.decodeImage(arrayBuffer, firstImage);

  const rgba = window.UTIF.toRGBA8(firstImage);
  const width = firstImage.width;
  const height = firstImage.height;
  assertSafeImageDimensions(width, height, file.name);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas context를 만들 수 없습니다.");
  }

  canvas.width = width;
  canvas.height = height;
  context.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  return canvas;
}

async function canvasToRequestedImageBlob(sourceCanvas, options) {
  const exportCanvas = document.createElement("canvas");
  const context = exportCanvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas context를 만들 수 없습니다.");
  }

  exportCanvas.width = sourceCanvas.width;
  exportCanvas.height = sourceCanvas.height;

  if (options.outputFormat === "jpeg") {
    context.fillStyle = options.backgroundColor || "#ffffff";
    context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  }

  context.drawImage(sourceCanvas, 0, 0);
  const blob = await ToolPage.canvasToBlob(exportCanvas, options.mimeType, options.quality);

  if (blob.type && blob.type !== options.mimeType) {
    throw new Error(
      `이 브라우저는 ${options.outputFormat.toUpperCase()} 저장을 지원하지 않습니다. PNG 또는 JPG로 다시 시도해 주세요.`
    );
  }

  return blob;
}

function assertSafeImageDimensions(width, height, fileName) {
  if (width > IMAGE_TYPE_MAX_DIMENSION || height > IMAGE_TYPE_MAX_DIMENSION || width * height > IMAGE_TYPE_MAX_PIXELS) {
    throw new Error(
      `${fileName} 해상도가 브라우저 안전 한도를 넘습니다. 한 변 ${IMAGE_TYPE_MAX_DIMENSION.toLocaleString()}px, 총 ${(
        IMAGE_TYPE_MAX_PIXELS / 1_000_000
      ).toFixed(0)}MP 이하 이미지를 사용해 주세요.`
    );
  }
}

function getFileExtension(fileName) {
  return String(fileName || "").split(".").pop().toLowerCase();
}
