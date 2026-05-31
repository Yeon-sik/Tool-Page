const PDFJS_WORKER_CDN_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

ToolPage.registerTool("pdf-to-images", {
  mode: "pdf-images",
  outputExtension: "png",
  mimeType: "image/png",
  statusReady: "PDF 페이지를 이미지로 변환할 준비가 완료되었습니다.",
  statusDone: "PDF 페이지 이미지 변환이 완료되었습니다.",
  downloadAllLabel: "ZIP 다운로드",
  bundleResults: true,
  sourceLabel: "PDF 문서",
  resultLabel: "페이지",
  settings: [
    {
      key: "pageImageFormat",
      label: "이미지 형식",
      description: "변환 결과를 PNG, JPG, WEBP 중 원하는 형식으로 저장합니다.",
      type: "select",
      defaultValue: "png",
      options: [
        { value: "png", label: "PNG" },
        { value: "jpeg", label: "JPG" },
        { value: "webp", label: "WEBP" },
      ],
    },
    {
      key: "pdfImageScale",
      label: "렌더링 배율",
      description: "높을수록 선명하지만 변환 시간과 파일 크기가 늘어납니다.",
      type: "select",
      defaultValue: "2",
      options: [
        { value: "1", label: "1x" },
        { value: "1.5", label: "1.5x" },
        { value: "2", label: "2x" },
        { value: "3", label: "3x" },
      ],
    },
    {
      key: "pageImageQuality",
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
      key: "pageImageBackground",
      label: "배경색",
      description: "투명 영역이 있는 페이지를 JPG/WEBP로 저장할 때 채워질 색상입니다.",
      type: "color",
      defaultValue: "#ffffff",
    },
  ],
  validateFiles: (files) => {
    if (files.length > 1) {
      return "문서 변환은 한 번에 파일 하나만 선택해 주세요.";
    }

    return files[0]?.name.toLowerCase().endsWith(".pdf") ? "" : "PDF 파일만 선택할 수 있습니다.";
  },
  createResults: ({ files, settings, jobToken, state, api }) => createPdfImageResults(files, settings, jobToken, state, api),
});

async function createPdfImageResults(files, settings, jobToken, state, api) {
  configurePdfJs();

  if (!window.pdfjsLib?.getDocument) {
    throw new Error("PDF.js 라이브러리를 불러오지 못했습니다.");
  }

  const file = files[0];
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await window.pdfjsLib.getDocument({ data }).promise;
  const scale = Math.max(0.5, Number(settings.pdfImageScale || 2));
  const output = api.resolvePageImageOutput(settings);
  const results = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    api.assertJobActive(state, jobToken);
    state.status.textContent = `PDF ${pageNumber}/${pdf.numPages} 페이지를 이미지로 렌더링하고 있습니다.`;

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("Canvas context를 만들 수 없습니다.");
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    context.fillStyle = output.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;
    page.cleanup();

    results.push(
      await api.createCanvasImageResult(canvas, output, settings, {
        sourceName: file.name,
        defaultBaseName: api.stripExtension(file.name),
        partName: `page-${String(pageNumber).padStart(2, "0")}`,
        index: pageNumber - 1,
        total: pdf.numPages,
      })
    );
  }

  return results;
}

function configurePdfJs() {
  if (window.pdfjsLib?.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN_URL;
  }
}
