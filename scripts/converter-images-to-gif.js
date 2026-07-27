const GIF_WORKER_URL = new URL("../assets/vendor/gif-0.2.0.worker.js", document.baseURI).href;

ToolPage.registerTool("images-to-gif", {
  mode: "gif",
  appendFiles: true,
  outputExtension: "gif",
  mimeType: "image/gif",
  statusReady: "카드를 드래그해 GIF 프레임 순서를 조정할 수 있습니다.",
  statusDone: "GIF 생성이 완료되었습니다.",
  downloadAllLabel: "GIF 다운로드",
  resultDownloadLabel: "GIF 다운로드",
  reorderable: true,
  hideDefaultRemoveAction: true,
  showResultPreview: true,
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
        { value: "-1", label: "1회 재생" },
        { value: "1", label: "2회 재생" },
        { value: "3", label: "4회 재생" },
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
  onSettingChange: ({ state, setting, value }) => {
    if (setting.key !== "gifFrameDelay" || state.frameSettings.length === 0) {
      return;
    }

    state.frameSettings = state.frameSettings.map((frameSetting) => ({
      ...frameSetting,
      delay: frameSetting.isCustom ? frameSetting.delay : Number(value),
    }));
  },
  createQueueUtilityBar: ({ state, api }) => createGifQueueUtilityBar(state, api),
  getQueueCaptionText: () => "FRAME",
  createPreviewDeleteAction:
    ({ state, file, index, api }) =>
    () =>
      api.removeFileAtIndex(state, index, {
        confirmMessage: `${file.name} 프레임을 삭제할까요?`,
        successMessage: `${file.name} 프레임이 삭제되었습니다.`,
      }),
  getPreviewDeleteLabel: ({ file }) => `${file.name} 프레임 삭제`,
  renderAdditionalFileActions: ({ state, file, index, actions, api }) => {
    actions.append(createGifDuplicateButton(state, index, file.name, api));
    actions.append(createGifFrameEditor(state, index, api));
  },
  describeResult: ({ result, api }) => `완료 · ${api.formatFileSize(result.blob.size)} · ${result.summary}`,
  createResults: async ({ files, settings, frameSettings, jobToken, state, api }) => [
    await createGifResult(files, settings, frameSettings, jobToken, state, api),
  ],
});

async function createGifResult(files, settings, frameSettings, jobToken, state, api) {
  if (!window.GIF) {
    throw new Error("GIF 라이브러리를 불러오지 못했습니다.");
  }

  const images = [];

  for (const file of files) {
    api.assertJobActive(state, jobToken);
    images.push(await api.loadImage(file));
  }

  const canvasSize = resolveGifCanvasSize(images[0], settings.gifMaxWidth || "720");
  const qualityProfile = getGifQualityProfile(settings.gifQualityProfile || "balanced");
  const frameDelay = Number(settings.gifFrameDelay || 180);
  const repeat = Number(settings.gifRepeat || 0);
  const gif = new window.GIF({
    workers: 2,
    workerScript: GIF_WORKER_URL,
    width: canvasSize.width,
    height: canvasSize.height,
    quality: qualityProfile.quality,
    repeat,
    background: settings.gifBackground || "#000000",
  });
  api.setJobCancellation(state, jobToken, () => {
    if (typeof gif.abort === "function") {
      gif.abort();
    }
  });

  images.forEach((image, index) => {
    api.assertJobActive(state, jobToken);
    const canvas = renderImageFrameCanvas(image, {
      width: canvasSize.width,
      height: canvasSize.height,
      fitMode: settings.gifFitMode || "contain",
      backgroundColor: settings.gifBackground || "#000000",
      api,
    });

    gif.addFrame(canvas, { delay: Number(frameSettings[index]?.delay || frameDelay), copy: true });

    if (api.isJobActive(state, jobToken)) {
      state.status.textContent = `${index + 1}/${images.length} 프레임을 준비했습니다. GIF를 렌더링하는 중입니다.`;
    }
  });

  const blob = await new Promise((resolve, reject) => {
    gif.on("finished", resolve);
    gif.on("progress", (progress) => {
      if (api.isJobActive(state, jobToken)) {
        state.status.textContent = `GIF 렌더링 중입니다. ${Math.round(progress * 100)}%`;
      }
    });
    gif.on("abort", () => reject(new Error("GIF 생성이 중단되었습니다.")));
    gif.render();
  });

  api.assertJobActive(state, jobToken);

  return {
    blob,
    previewDataUrl: await api.blobToDataUrl(blob),
    fileName: api.buildBundleFileName(settings, "images-to-gif", "gif"),
    summary: `${files.length}프레임 · ${summarizeFrameDelays(frameSettings, frameDelay)} · ${describeLoopCount(repeat)} · ${canvasSize.width}x${canvasSize.height}`,
  };
}

function createGifQueueUtilityBar(state, api) {
  const toolbar = document.createElement("div");
  toolbar.className = "queue-utility-bar";

  const reverseButton = document.createElement("button");
  reverseButton.type = "button";
  reverseButton.className = "queue-utility-button";
  reverseButton.textContent = "REVERSE";
  reverseButton.addEventListener("click", () => reverseGifFrames(state, api));

  toolbar.append(reverseButton);
  return toolbar;
}

function createGifDuplicateButton(state, index, fileName, api) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "duplicate-file-button";
  button.textContent = "COPY";
  button.setAttribute("aria-label", `${fileName} 프레임 복제`);
  button.addEventListener("click", () => duplicateGifFrameAtIndex(state, index, api));
  return button;
}

function createGifFrameEditor(state, index, api) {
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
      api.renderState(state);
    }
  };
  input.addEventListener("change", commitDelay);
  input.addEventListener("blur", commitDelay);

  wrapper.append(label, input);
  return wrapper;
}

function duplicateGifFrameAtIndex(state, index, api) {
  const normalizedIndex = Number(index);

  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0 || normalizedIndex >= state.files.length) {
    return;
  }

  state.actionToken += 1;
  state.activeJobToken = 0;

  const sourceFile = state.files[normalizedIndex];
  const sourceFrameSetting = state.frameSettings[normalizedIndex] || {
    delay: Number(state.settings.gifFrameDelay || 180),
    isCustom: false,
  };
  const insertIndex = normalizedIndex + 1;

  state.files.splice(insertIndex, 0, sourceFile);
  state.previews.splice(insertIndex, 0, {
    url: URL.createObjectURL(sourceFile),
    fileName: sourceFile.name,
  });
  state.frameSettings.splice(insertIndex, 0, { ...sourceFrameSetting });
  state.results = [];
  state.downloadAllButton.disabled = true;
  api.renderState(state);
  state.status.textContent = `${sourceFile.name} 프레임을 복제했습니다.`;
}

function reverseGifFrames(state, api) {
  if (state.files.length <= 1) {
    return;
  }

  state.actionToken += 1;
  state.activeJobToken = 0;
  state.files = [...state.files].reverse();
  state.previews = [...state.previews].reverse();
  state.frameSettings = [...state.frameSettings].reverse();
  state.results = [];
  state.dragIndex = null;
  state.dropInsertionIndex = null;
  state.pointerDrag = null;
  state.downloadAllButton.disabled = true;
  api.renderState(state);
  state.status.textContent = "GIF 프레임 순서를 뒤집었습니다. 현재 순서로 다시 생성해 주세요.";
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
    const cropBox = options.api.coverWithinBox(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);
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

  const fitted = options.api.fitWithinBox(image.naturalWidth, image.naturalHeight, canvas.width, canvas.height);
  const offsetX = (canvas.width - fitted.width) / 2;
  const offsetY = (canvas.height - fitted.height) / 2;
  context.drawImage(image, offsetX, offsetY, fitted.width, fitted.height);
  return canvas;
}

function describeLoopCount(repeat) {
  if (repeat === 0) {
    return "무한 반복";
  }

  return `${Math.max(1, repeat + 1)}회 재생`;
}

function summarizeFrameDelays(frameSettings, fallbackDelay) {
  if (!frameSettings.length) {
    return `${fallbackDelay}ms`;
  }

  const uniqueDelays = [...new Set(frameSettings.map((frameSetting) => Number(frameSetting.delay || fallbackDelay)))];
  return uniqueDelays.length === 1 ? `${uniqueDelays[0]}ms` : "개별 지연";
}
