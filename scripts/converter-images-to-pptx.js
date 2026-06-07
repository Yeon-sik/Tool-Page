const pptxPageFormats = {
  slide: {
    layout: "LAYOUT_WIDE",
    width: 13.333,
    height: 7.5,
  },
  a4: {
    layout: "LAYOUT_A4_PORTRAIT",
    width: 8.27,
    height: 11.69,
  },
  a3: {
    layout: "LAYOUT_A3_PORTRAIT",
    width: 11.69,
    height: 16.54,
  },
};

ToolPage.registerTool("images-to-pptx", {
  mode: "pptx",
  appendFiles: true,
  outputExtension: "pptx",
  mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  statusReady: "카드를 드래그해 PPTX 슬라이드 순서를 조정할 수 있습니다.",
  statusDone: "PPTX 생성이 완료되었습니다.",
  downloadAllLabel: "PPTX 다운로드",
  resultDownloadLabel: "PPTX 다운로드",
  resultTypeLabel: "PowerPoint 문서",
  reorderable: true,
  settings: [
    {
      key: "pptxPageFormat",
      label: "슬라이드 비율",
      description: "PPTX로 만들 슬라이드의 기본 크기와 비율을 선택합니다.",
      type: "select",
      defaultValue: "slide",
      options: [
        { value: "slide", label: "기본 슬라이드" },
        { value: "a4", label: "A4 용지" },
        { value: "a3", label: "A3 용지" },
      ],
    },
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
      description: "켜면 각 슬라이드 하단 위에 원본 파일명을 겹쳐 넣습니다.",
      type: "checkbox",
      defaultValue: false,
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
  createResults: async ({ files, settings, jobToken, state, api }) => [await createPptxResult(files, settings, jobToken, state, api)],
});

async function createPptxResult(files, settings, jobToken, state, api) {
  if (!window.PptxGenJS) {
    throw new Error("PptxGenJS 라이브러리를 불러오지 못했습니다.");
  }

  const pptx = new window.PptxGenJS();
  const pageFormat = resolvePptxPageFormat(settings.pptxPageFormat);

  if (pageFormat.layout !== "LAYOUT_WIDE") {
    pptx.defineLayout({
      name: pageFormat.layout,
      width: pageFormat.width,
      height: pageFormat.height,
    });
  }

  pptx.layout = pageFormat.layout;
  pptx.author = "Tool Page";
  pptx.company = "Tool Page";
  pptx.subject = "Image to PowerPoint Conversion";
  pptx.title = "Images to PPTX";

  const slideWidth = pageFormat.width;
  const slideHeight = pageFormat.height;
  const margin = 0;
  const labelHeight = 0.28;
  const labelInset = 0.18;
  const usableWidth = slideWidth - margin * 2;
  const usableHeight = slideHeight - margin * 2;
  const dpi = Number(settings.pptxDpi || 144);
  const backgroundColor = api.normalizeHexColor(settings.pptxBackground || "#000000");

  for (const file of files) {
    api.assertJobActive(state, jobToken);

    const image = await api.loadImage(file);
    const slide = pptx.addSlide();
    const placement =
      settings.pptxFitMode === "cover"
        ? api.coverWithinBox(image.naturalWidth, image.naturalHeight, usableWidth, usableHeight)
        : api.fitWithinBox(image.naturalWidth, image.naturalHeight, usableWidth, usableHeight);
    const renderWidthPx = Math.max(1, Math.round(placement.width * dpi));
    const renderHeightPx = Math.max(1, Math.round(placement.height * dpi));
    const rendered = await api.renderImageToBlob(image, {
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
    const dataUrl = await api.blobToDataUrl(rendered.blob);

    slide.background = { color: backgroundColor };

    if (settings.pptxFileLabel) {
      slide.addText(file.name, {
        x: labelInset,
        y: slideHeight - labelHeight - labelInset,
        w: slideWidth - labelInset * 2,
        h: labelHeight,
        color: "FF00FF",
        fontFace: "Aptos",
        fontSize: 9,
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

  api.assertJobActive(state, jobToken);

  return {
    blob: await pptx.write({ outputType: "blob" }),
    fileName: api.buildBundleFileName(settings, "images-to-pptx", "pptx"),
  };
}

function resolvePptxPageFormat(formatKey) {
  return pptxPageFormats[formatKey] || pptxPageFormats.slide;
}
