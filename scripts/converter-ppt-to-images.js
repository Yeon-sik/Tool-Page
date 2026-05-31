const PPTX_EMU_PER_INCH = 914400;
const PPTX_DEFAULT_SLIDE_SIZE = {
  width: 12192000,
  height: 6858000,
};

ToolPage.registerTool("ppt-to-images", {
  mode: "ppt-images",
  outputExtension: "png",
  mimeType: "image/png",
  statusReady: "PowerPoint 슬라이드를 이미지로 변환할 준비가 완료되었습니다.",
  statusDone: "PowerPoint 슬라이드 이미지 변환이 완료되었습니다.",
  downloadAllLabel: "ZIP 다운로드",
  bundleResults: true,
  sourceLabel: "PowerPoint 문서",
  resultLabel: "슬라이드",
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
      key: "pptImageWidth",
      label: "슬라이드 너비",
      description: "각 슬라이드를 이미지로 렌더링할 때 사용할 픽셀 너비입니다.",
      type: "select",
      defaultValue: "1920",
      options: [
        { value: "1280", label: "1280px" },
        { value: "1920", label: "1920px" },
        { value: "2560", label: "2560px" },
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
      label: "기본 배경색",
      description: "슬라이드 배경을 찾지 못했거나 투명 영역이 있을 때 사용할 색상입니다.",
      type: "color",
      defaultValue: "#ffffff",
    },
  ],
  validateFiles: (files) => {
    if (files.length > 1) {
      return "문서 변환은 한 번에 파일 하나만 선택해 주세요.";
    }

    return files[0]?.name.toLowerCase().endsWith(".pptx")
      ? ""
      : "현재 브라우저 변환은 PPTX 파일을 지원합니다. PPT 파일은 PowerPoint에서 PPTX로 저장한 뒤 다시 시도해 주세요.";
  },
  createResults: ({ files, settings, jobToken, state, api }) => createPptImageResults(files, settings, jobToken, state, api),
});

async function createPptImageResults(files, settings, jobToken, state, api) {
  if (!window.JSZip) {
    throw new Error("JSZip 라이브러리를 불러오지 못했습니다.");
  }

  const file = files[0];

  if (!file.name.toLowerCase().endsWith(".pptx")) {
    throw new Error("현재 브라우저 변환은 PPTX 파일을 지원합니다. PPT 파일은 PowerPoint에서 PPTX로 저장한 뒤 다시 시도해 주세요.");
  }

  let deck;

  try {
    const zip = await window.JSZip.loadAsync(file);
    deck = await readPptxDeck(zip);
  } catch (error) {
    console.error(error);
    throw new Error("PPTX 파일을 읽지 못했습니다. 암호화되었거나 손상된 파일인지 확인해 주세요.");
  }

  const output = api.resolvePageImageOutput(settings);
  const targetWidth = Math.max(320, Number(settings.pptImageWidth || 1920));
  const targetHeight = Math.max(1, Math.round((deck.slideSize.height / deck.slideSize.width) * targetWidth));
  const results = [];

  for (let index = 0; index < deck.slidePaths.length; index += 1) {
    api.assertJobActive(state, jobToken);
    state.status.textContent = `PowerPoint ${index + 1}/${deck.slidePaths.length} 슬라이드를 이미지로 렌더링하고 있습니다.`;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
      throw new Error("Canvas context를 만들 수 없습니다.");
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.fillStyle = output.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    await renderPptxSlide(deck, deck.slidePaths[index], canvas, context, output.backgroundColor, api);

    results.push(
      await api.createCanvasImageResult(canvas, output, settings, {
        sourceName: file.name,
        defaultBaseName: api.stripExtension(file.name),
        partName: `slide-${String(index + 1).padStart(2, "0")}`,
        index,
        total: deck.slidePaths.length,
      })
    );
  }

  return results;
}

async function readPptxDeck(zip) {
  const presentationDoc = await readXmlFromZip(zip, "ppt/presentation.xml");
  const slideSizeNode = getFirstByLocalName(presentationDoc, "sldSz");
  const slideSize = {
    width: Number(slideSizeNode?.getAttribute("cx")) || PPTX_DEFAULT_SLIDE_SIZE.width,
    height: Number(slideSizeNode?.getAttribute("cy")) || PPTX_DEFAULT_SLIDE_SIZE.height,
  };
  const presentationRelationships = parseRelationships(await readXmlFromZip(zip, "ppt/_rels/presentation.xml.rels"), "ppt");
  const slidePaths = getElementsByLocalName(presentationDoc, "sldId")
    .map((slideId) => getRelationshipId(slideId))
    .map((relationshipId) => presentationRelationships[relationshipId]?.target)
    .filter(Boolean);

  if (slidePaths.length === 0) {
    zip.forEach((path, entry) => {
      const normalizedPath = path.replace(/\\/g, "/");

      if (!entry.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(normalizedPath)) {
        slidePaths.push(normalizedPath);
      }
    });
    slidePaths.sort((left, right) => Number(left.match(/\d+/)?.[0] || 0) - Number(right.match(/\d+/)?.[0] || 0));
  }

  if (slidePaths.length === 0) {
    throw new Error("PPTX 안에서 슬라이드를 찾지 못했습니다.");
  }

  return {
    zip,
    slideSize,
    slidePaths,
  };
}

async function renderPptxSlide(deck, slidePath, canvas, context, fallbackBackground, api) {
  const slideDoc = await readXmlFromZip(deck.zip, slidePath);
  const relationships = await readPptxSlideRelationships(deck.zip, slidePath);
  const scaleX = canvas.width / deck.slideSize.width;
  const scaleY = canvas.height / deck.slideSize.height;
  const backgroundColor = extractPptxBackgroundColor(slideDoc) || fallbackBackground;

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const shapeTree = getFirstByLocalName(slideDoc, "spTree");

  if (!shapeTree) {
    return;
  }

  for (const element of Array.from(shapeTree.children)) {
    await renderPptxElement(element, {
      zip: deck.zip,
      relationships,
      context,
      scaleX,
      scaleY,
      canvas,
      slideSize: deck.slideSize,
      api,
    });
  }
}

async function readPptxSlideRelationships(zip, slidePath) {
  const directory = getDirectoryName(slidePath);
  const relsPath = `${directory}/_rels/${getBaseName(slidePath)}.rels`;
  const relsFile = getZipFile(zip, relsPath);

  if (!relsFile) {
    return {};
  }

  return parseRelationships(parseXml(await relsFile.async("text")), directory);
}

async function renderPptxElement(element, contextInfo) {
  const name = getLocalName(element);

  if (name === "pic") {
    await renderPptxPicture(element, contextInfo);
    return;
  }

  if (name === "sp") {
    renderPptxShape(element, contextInfo);
    return;
  }

  if (name === "grpSp") {
    for (const child of Array.from(element.children)) {
      await renderPptxElement(child, contextInfo);
    }
  }
}

async function renderPptxPicture(element, contextInfo) {
  const { zip, relationships, context, api } = contextInfo;
  const box = getPptxElementBox(element, contextInfo);

  if (!box) {
    return;
  }

  const blip = getFirstByLocalName(element, "blip");
  const relationshipId = blip ? getRelationshipId(blip, "embed") : "";
  const relationship = relationships[relationshipId];
  const imageFile = relationship?.target ? getZipFile(zip, relationship.target) : null;

  if (!imageFile) {
    drawPptxMissingBox(context, box, "Image missing");
    return;
  }

  try {
    const blob = await imageFile.async("blob");
    const image = await api.loadImageFromDataUrl(await api.blobToDataUrl(blob));
    const crop = getPptxImageCrop(element, image);
    context.drawImage(image, crop.x, crop.y, crop.width, crop.height, box.x, box.y, box.width, box.height);
  } catch (error) {
    console.error(error);
    drawPptxMissingBox(context, box, "Unsupported image");
  }
}

function renderPptxShape(element, contextInfo) {
  const { context } = contextInfo;
  const box = getPptxElementBox(element, contextInfo);

  if (!box) {
    return;
  }

  const shapeProperties = getFirstChildByLocalName(element, "spPr");
  const fillColor = extractPptxSolidFillColor(shapeProperties);
  const lineColor = extractPptxLineColor(shapeProperties);
  const geometry = getPptxShapeGeometry(shapeProperties);

  if (fillColor || lineColor) {
    context.save();
    context.beginPath();

    if (geometry === "ellipse") {
      context.ellipse(box.x + box.width / 2, box.y + box.height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2);
    } else {
      context.rect(box.x, box.y, box.width, box.height);
    }

    if (fillColor) {
      context.fillStyle = fillColor;
      context.fill();
    }

    if (lineColor) {
      context.strokeStyle = lineColor;
      context.lineWidth = 1;
      context.stroke();
    }

    context.restore();
  }

  const textBody = getFirstChildByLocalName(element, "txBody");

  if (textBody) {
    drawPptxText(contextInfo, textBody, box);
  }
}

function drawPptxText(contextInfo, textBody, box) {
  const { context, canvas, slideSize } = contextInfo;
  const bodyProperties = getFirstChildByLocalName(textBody, "bodyPr");
  const insetLeft = emuAttributeToPx(bodyProperties, "lIns", contextInfo.scaleX, 91440);
  const insetRight = emuAttributeToPx(bodyProperties, "rIns", contextInfo.scaleX, 91440);
  const insetTop = emuAttributeToPx(bodyProperties, "tIns", contextInfo.scaleY, 45720);
  const insetBottom = emuAttributeToPx(bodyProperties, "bIns", contextInfo.scaleY, 45720);
  const textX = box.x + insetLeft;
  const maxWidth = Math.max(1, box.width - insetLeft - insetRight);
  const maxY = box.y + box.height - insetBottom;
  let cursorY = box.y + insetTop;

  context.save();

  for (const paragraph of getChildElementsByLocalName(textBody, "p")) {
    const text = extractPptxParagraphText(paragraph);

    if (!text) {
      cursorY += 12;
      continue;
    }

    const style = getPptxTextStyle(paragraph, canvas, slideSize);
    context.font = `${style.bold ? "700 " : ""}${style.fontSize}px ${style.fontFamily}`;
    context.fillStyle = style.color;
    context.textBaseline = "top";
    context.textAlign = style.align;

    const lines = wrapCanvasText(context, text, maxWidth);
    const lineHeight = style.fontSize * 1.24;
    const alignedX = style.align === "center" ? textX + maxWidth / 2 : style.align === "right" ? textX + maxWidth : textX;

    for (const line of lines) {
      if (cursorY + lineHeight > maxY) {
        break;
      }

      context.fillText(line, alignedX, cursorY);
      cursorY += lineHeight;
    }

    cursorY += Math.max(2, style.fontSize * 0.28);
  }

  context.restore();
}

function getPptxTextStyle(paragraph, canvas, slideSize) {
  const runProperties =
    getFirstByLocalName(paragraph, "rPr") ||
    getFirstByLocalName(paragraph, "defRPr") ||
    getFirstByLocalName(paragraph, "endParaRPr");
  const paragraphProperties = getFirstChildByLocalName(paragraph, "pPr");
  const fontSizePoints = Math.max(6, Number(runProperties?.getAttribute("sz") || 1800) / 100);
  const slideWidthInches = slideSize.width / PPTX_EMU_PER_INCH;
  const canvasDpi = canvas.width / slideWidthInches;
  const fontSize = Math.max(8, Math.round((fontSizePoints * canvasDpi) / 72));
  const alignValue = paragraphProperties?.getAttribute("algn") || "";
  const fontFamily = getFirstByLocalName(runProperties, "latin")?.getAttribute("typeface") || "Arial";

  return {
    fontSize,
    fontFamily: `"${fontFamily}", "Noto Sans KR", sans-serif`,
    bold: runProperties?.getAttribute("b") === "1",
    color: extractPptxSolidFillColor(runProperties) || "#111111",
    align: alignValue === "ctr" ? "center" : alignValue === "r" ? "right" : "left",
  };
}

function extractPptxParagraphText(paragraph) {
  return Array.from(paragraph.children)
    .map((child) => {
      const name = getLocalName(child);

      if (name === "br") {
        return "\n";
      }

      if (name !== "r" && name !== "fld") {
        return "";
      }

      return getChildElementsByLocalName(child, "t")
        .map((textNode) => textNode.textContent || "")
        .join("");
    })
    .join("")
    .trim();
}

function wrapCanvasText(context, text, maxWidth) {
  const lines = [];

  text.split(/\n+/).forEach((sourceLine) => {
    const words = sourceLine.split(/\s+/).filter(Boolean);
    let line = "";

    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;

      if (context.measureText(candidate).width <= maxWidth) {
        line = candidate;
        return;
      }

      if (line) {
        lines.push(line);
      }

      if (context.measureText(word).width <= maxWidth) {
        line = word;
        return;
      }

      let chunk = "";
      Array.from(word).forEach((character) => {
        const nextChunk = `${chunk}${character}`;

        if (context.measureText(nextChunk).width <= maxWidth) {
          chunk = nextChunk;
          return;
        }

        if (chunk) {
          lines.push(chunk);
        }

        chunk = character;
      });
      line = chunk;
    });

    if (line) {
      lines.push(line);
    }
  });

  return lines;
}

function getPptxElementBox(element, contextInfo) {
  const properties = getFirstChildByLocalName(element, "spPr") || element;
  const transform = getFirstByLocalName(properties, "xfrm");
  const offset = getFirstByLocalName(transform, "off");
  const extent = getFirstByLocalName(transform, "ext");

  if (!offset || !extent) {
    return null;
  }

  return {
    x: Number(offset.getAttribute("x") || 0) * contextInfo.scaleX,
    y: Number(offset.getAttribute("y") || 0) * contextInfo.scaleY,
    width: Number(extent.getAttribute("cx") || 0) * contextInfo.scaleX,
    height: Number(extent.getAttribute("cy") || 0) * contextInfo.scaleY,
  };
}

function getPptxImageCrop(element, image) {
  const sourceRect = getFirstByLocalName(element, "srcRect");
  const left = Number(sourceRect?.getAttribute("l") || 0) / 100000;
  const right = Number(sourceRect?.getAttribute("r") || 0) / 100000;
  const top = Number(sourceRect?.getAttribute("t") || 0) / 100000;
  const bottom = Number(sourceRect?.getAttribute("b") || 0) / 100000;
  const width = image.naturalWidth * Math.max(0.01, 1 - left - right);
  const height = image.naturalHeight * Math.max(0.01, 1 - top - bottom);

  return {
    x: image.naturalWidth * left,
    y: image.naturalHeight * top,
    width,
    height,
  };
}

function drawPptxMissingBox(context, box, label) {
  context.save();
  context.fillStyle = "rgba(255, 0, 255, 0.08)";
  context.strokeStyle = "rgba(255, 0, 255, 0.65)";
  context.lineWidth = 2;
  context.fillRect(box.x, box.y, box.width, box.height);
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.fillStyle = "#ff00ff";
  context.font = "700 14px Arial, sans-serif";
  context.textBaseline = "middle";
  context.textAlign = "center";
  context.fillText(label, box.x + box.width / 2, box.y + box.height / 2);
  context.restore();
}

function extractPptxBackgroundColor(slideDoc) {
  const backgroundProperties = getFirstByLocalName(slideDoc, "bgPr");
  return extractPptxSolidFillColor(backgroundProperties);
}

function extractPptxSolidFillColor(root) {
  if (!root || getFirstChildByLocalName(root, "noFill")) {
    return "";
  }

  const solidFill = getLocalName(root) === "solidFill" ? root : getFirstChildByLocalName(root, "solidFill");

  if (!solidFill) {
    return "";
  }

  const srgbColor = getFirstByLocalName(solidFill, "srgbClr")?.getAttribute("val");

  if (srgbColor) {
    return `#${srgbColor}`;
  }

  const schemeColor = getFirstByLocalName(solidFill, "schemeClr")?.getAttribute("val");

  if (schemeColor) {
    return getPptxSchemeColor(schemeColor);
  }

  const presetColor = getFirstByLocalName(solidFill, "prstClr")?.getAttribute("val");
  return getPptxPresetColor(presetColor);
}

function extractPptxLineColor(root) {
  const line = getFirstChildByLocalName(root, "ln");
  return extractPptxSolidFillColor(line);
}

function getPptxShapeGeometry(root) {
  return getFirstByLocalName(root, "prstGeom")?.getAttribute("prst") || "rect";
}

function getPptxSchemeColor(value) {
  const colorMap = {
    bg1: "#ffffff",
    tx1: "#000000",
    bg2: "#f2f2f2",
    tx2: "#1f1f1f",
    accent1: "#4472c4",
    accent2: "#ed7d31",
    accent3: "#a5a5a5",
    accent4: "#ffc000",
    accent5: "#5b9bd5",
    accent6: "#70ad47",
    hlink: "#0563c1",
    folHlink: "#954f72",
  };

  return colorMap[value] || "#111111";
}

function getPptxPresetColor(value) {
  const colorMap = {
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    gray: "#808080",
  };

  return colorMap[value] || "";
}

function emuAttributeToPx(element, attributeName, scale, fallback) {
  return Number(element?.getAttribute(attributeName) || fallback || 0) * scale;
}

async function readXmlFromZip(zip, path) {
  const file = getZipFile(zip, path);

  if (!file) {
    throw new Error(`${path} 파일을 찾지 못했습니다.`);
  }

  return parseXml(await file.async("text"));
}

function getZipFile(zip, path) {
  return zip.file(path) || zip.file(path.replace(/\//g, "\\"));
}

function parseXml(source) {
  return new DOMParser().parseFromString(source, "application/xml");
}

function parseRelationships(relsDoc, baseDirectory) {
  return getElementsByLocalName(relsDoc, "Relationship").reduce((relationships, relationship) => {
    const id = relationship.getAttribute("Id");

    if (id) {
      relationships[id] = {
        target: resolveZipTarget(baseDirectory, relationship.getAttribute("Target") || ""),
        type: relationship.getAttribute("Type") || "",
      };
    }

    return relationships;
  }, {});
}

function resolveZipTarget(baseDirectory, target) {
  const normalizedTarget = String(target || "").replace(/\\/g, "/");

  if (!normalizedTarget) {
    return "";
  }

  if (normalizedTarget.startsWith("/")) {
    return normalizedTarget.replace(/^\/+/, "");
  }

  const parts = `${baseDirectory}/${normalizedTarget}`.split("/");
  const resolvedParts = [];

  parts.forEach((part) => {
    if (!part || part === ".") {
      return;
    }

    if (part === "..") {
      resolvedParts.pop();
      return;
    }

    resolvedParts.push(part);
  });

  return resolvedParts.join("/");
}

function getElementsByLocalName(root, localName) {
  if (!root) {
    return [];
  }

  return Array.from(root.getElementsByTagName("*")).filter((element) => getLocalName(element) === localName);
}

function getChildElementsByLocalName(root, localName) {
  if (!root) {
    return [];
  }

  return Array.from(root.children).filter((element) => getLocalName(element) === localName);
}

function getFirstByLocalName(root, localName) {
  return getElementsByLocalName(root, localName)[0] || null;
}

function getFirstChildByLocalName(root, localName) {
  return getChildElementsByLocalName(root, localName)[0] || null;
}

function getLocalName(element) {
  return element?.localName || element?.nodeName?.split(":").pop() || "";
}

function getRelationshipId(element, attributeName = "id") {
  return (
    element.getAttribute(`r:${attributeName}`) ||
    element.getAttribute(attributeName) ||
    element.getAttributeNS?.("http://schemas.openxmlformats.org/officeDocument/2006/relationships", attributeName) ||
    ""
  );
}

function getDirectoryName(path) {
  return path.split("/").slice(0, -1).join("/");
}

function getBaseName(path) {
  return path.split("/").pop() || path;
}
