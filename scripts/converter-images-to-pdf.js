const pageFormats = {
  a4: { jsPdfFormat: "a4" },
  letter: { jsPdfFormat: "letter" },
};

ToolPage.registerTool("images-to-pdf", {
  mode: "pdf",
  appendFiles: true,
  outputExtension: "pdf",
  mimeType: "application/pdf",
  statusReady: "카드를 드래그해 PDF 페이지 순서를 조정할 수 있습니다.",
  statusDone: "PDF 생성이 완료되었습니다.",
  downloadAllLabel: "PDF 다운로드",
  resultDownloadLabel: "PDF 다운로드",
  resultTypeLabel: "PDF 문서",
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
  createResults: async ({ files, settings, jobToken, state, api }) => [await createPdfResult(files, settings, jobToken, state, api)],
});

async function createPdfResult(files, settings, jobToken, state, api) {
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
    api.assertJobActive(state, jobToken);

    const file = files[index];
    const image = await api.loadImage(file);
    const orientation = resolvePdfOrientation(image, settings.pdfOrientation);

    if (index > 0) {
      pdf.addPage(pageFormat.jsPdfFormat, orientation);
    } else if (orientation !== initialOrientation) {
      pdf.deletePage(1);
      pdf.addPage(pageFormat.jsPdfFormat, orientation);
    }

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const fitted = api.fitWithinBox(image.naturalWidth, image.naturalHeight, pageWidth, pageHeight);
    const renderWidthPx = Math.max(1, Math.round((fitted.width * dpi) / 72));
    const renderHeightPx = Math.max(1, Math.round((fitted.height * dpi) / 72));
    const rendered = await api.renderImageToBlob(image, {
      width: renderWidthPx,
      height: renderHeightPx,
      format: forcedFormat === "png" ? "png" : "jpeg",
      quality: jpegQuality,
      backgroundColor: flattenBackground,
      autoFormat: forcedFormat === "auto",
    });

    const offsetX = (pageWidth - fitted.width) / 2;
    const offsetY = (pageHeight - fitted.height) / 2;
    const dataUrl = await api.blobToDataUrl(rendered.blob);

    api.assertJobActive(state, jobToken);
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
    fileName: api.buildBundleFileName(settings, "images-to-pdf", "pdf"),
  };
}

function resolvePdfOrientation(image, setting) {
  if (setting === "portrait" || setting === "landscape") {
    return setting;
  }

  return image.naturalWidth > image.naturalHeight ? "landscape" : "portrait";
}
