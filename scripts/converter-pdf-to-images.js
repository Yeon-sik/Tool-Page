const PDFJS_WORKER_URL = new URL("../assets/vendor/pdf-3.11.174.worker.min.js", document.baseURI).href;
const PDF_MAX_PAGES = 120;
const PDF_MAX_CANVAS_DIMENSION = 16384;
const PDF_MAX_CANVAS_PIXELS = 80_000_000;

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
  const loadingTask = window.pdfjsLib.getDocument({ data });
  api.setJobCancellation(state, jobToken, () => loadingTask.destroy());
  const pdf = await loadingTask.promise;
  api.assertJobActive(state, jobToken);

  if (pdf.numPages > PDF_MAX_PAGES) {
    await pdf.destroy();
    throw new Error(
      `이 브라우저 도구는 한 번에 최대 ${PDF_MAX_PAGES}페이지까지 변환합니다. PDF를 나눈 뒤 다시 시도해 주세요.`
    );
  }

  const scale = Math.max(0.5, Number(settings.pdfImageScale || 2));
  const output = api.resolvePageImageOutput(settings);
  const results = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    api.assertJobActive(state, jobToken);
    state.status.textContent = `PDF ${pageNumber}/${pdf.numPages} 페이지를 이미지로 렌더링하고 있습니다.`;

    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);

    if (
      width > PDF_MAX_CANVAS_DIMENSION ||
      height > PDF_MAX_CANVAS_DIMENSION ||
      width * height > PDF_MAX_CANVAS_PIXELS
    ) {
      page.cleanup();
      await pdf.destroy();
      throw new Error(
        `${pageNumber}페이지의 렌더링 크기(${width}×${height}px)가 브라우저 안전 한도를 넘습니다. 렌더링 배율을 낮춰 주세요.`
      );
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("Canvas context를 만들 수 없습니다.");
    }

    canvas.width = width;
    canvas.height = height;
    context.fillStyle = output.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderTask = page.render({
      canvasContext: context,
      viewport,
    });
    api.setJobCancellation(state, jobToken, () => {
      renderTask.cancel();
      void pdf.destroy();
    });
    await renderTask.promise;
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

  await pdf.destroy();
  return results;
}

function configurePdfJs() {
  if (window.pdfjsLib?.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  }
}
