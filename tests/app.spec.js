import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  "/",
  "/tools/converter.html",
  "/tools/images-to-gif.html",
  "/tools/pdf.html",
  "/tools/ppt.html",
  "/tools/mp3-editor.html",
  "/tools/image-editor.html",
];

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xv0JAAAAAElFTkSuQmCC",
  "base64"
);

function watchRuntimeErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  return errors;
}

for (const route of routes) {
  test(`${route} 기본 렌더와 접근성`, async ({ page }) => {
    const runtimeErrors = watchRuntimeErrors(page);
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toBeVisible();

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations, JSON.stringify(accessibility.violations, null, 2)).toEqual([]);
    expect(runtimeErrors).toEqual([]);
  });

  test(`${route} 360px 가로 overflow 없음`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  });
}

test("홈 검색과 카테고리 필터", async ({ page }) => {
  await page.goto("/");
  const search = page.getByLabel("도구 이름, 형식, 사용 목적 검색");
  await search.fill("MP3");
  await expect(page.locator("[data-tool-card]:visible")).toHaveCount(1);
  await expect(page.locator("[data-tool-id=mp3-editor]")).toBeVisible();
  await search.fill("");
  await page.getByRole("button", { name: "문서", exact: true }).click();
  await expect(page.locator("[data-tool-card]:visible")).toHaveCount(2);
});

test("GIF 큐는 키보드로 순서를 바꿀 수 있음", async ({ page }) => {
  await page.goto("/tools/images-to-gif.html", { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles([
    { name: "first.png", mimeType: "image/png", buffer: tinyPng },
    { name: "second.png", mimeType: "image/png", buffer: tinyPng },
  ]);
  await expect(page.locator(".queue-card")).toHaveCount(2);

  const firstHandle = page.locator(".queue-drag-handle").first();
  await firstHandle.focus();
  await firstHandle.press("ArrowDown");
  await expect(page.locator(".queue-card").first().locator(".file-meta strong")).toHaveText("second.png");
  await expect(page.locator("[data-role=status]")).toContainText("이동");
});

test("여러 파일은 이름순으로 정렬하고 정렬 방향을 즉시 바꿀 수 있음", async ({ page }) => {
  await page.goto("/tools/images-to-gif.html", { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles([
    { name: "frame-10.png", mimeType: "image/png", buffer: tinyPng },
    { name: "frame-2.png", mimeType: "image/png", buffer: tinyPng },
  ]);

  const fileNames = page.locator(".queue-card .file-meta strong");
  await expect(fileNames).toHaveText(["frame-2.png", "frame-10.png"]);
  await page.getByRole("button", { name: "파일 이름 내림차순" }).click();
  await expect(fileNames).toHaveText(["frame-10.png", "frame-2.png"]);
  await expect(page.locator("[data-role=status]")).toContainText("내림차순");
});

test("이미지 변환은 실제 PNG를 다운로드함", async ({ page }) => {
  await page.goto("/tools/converter.html", { waitUntil: "networkidle" });
  const convertButton = page.locator('[data-action="convert"]');
  await expect(convertButton).toBeDisabled();
  await page.locator('input[type="file"]').setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await expect(convertButton).toBeEnabled();
  await convertButton.click();

  const downloadButton = page.getByRole("button", { name: "개별 다운로드" });
  await expect(downloadButton).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await downloadButton.click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(download.suggestedFilename()).toMatch(/\.png$/i);
});

test("파일 안전 한도를 넘으면 목록에 추가하지 않음", async ({ page }) => {
  await page.goto("/tools/converter.html");

  await page.locator('input[type="file"]').evaluate((input) => {
    const oversized = new File(["x"], "oversized.png", { type: "image/png" });
    Object.defineProperty(oversized, "size", { value: 121 * 1024 * 1024 });
    const transfer = new DataTransfer();
    transfer.items.add(oversized);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });

  await expect(page.locator("[data-role=status]")).toContainText("120MB");
  await expect(page.locator(".queue-card")).toHaveCount(0);
  await expect(page.locator('[data-action="convert"]')).toBeDisabled();
});

test("같은 기본 이름의 결과 파일은 덮어쓰지 않도록 고유 이름을 사용함", async ({ page }) => {
  await page.goto("/tools/converter.html");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "sample.png", mimeType: "image/png", buffer: tinyPng },
    { name: "sample.png", mimeType: "image/png", buffer: Buffer.concat([tinyPng, Buffer.from([0])]) },
  ]);
  await page.locator('[data-action="convert"]').click();

  const resultInfo = page.locator(".uploaded-card .file-meta > span");
  await expect(resultInfo).toHaveCount(2);
  await expect(page.locator("[data-role=status]")).toContainText("2개 결과 파일");
  await expect(resultInfo.first()).toContainText("완료");
  const names = (await resultInfo.allTextContents()).map((text) => text.split(" · ").at(-1));
  expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(2);
});

test("GIF 변환 취소는 worker 작업도 중단하고 파일은 유지함", async ({ page }) => {
  await page.goto("/tools/images-to-gif.html");
  await page.evaluate(() => {
    window.__gifAborted = false;
    window.__gifCreated = false;
    window.GIF = class FakeGif {
      constructor() {
        this.listeners = {};
        window.__gifCreated = true;
      }

      addFrame() {}

      on(eventName, callback) {
        this.listeners[eventName] = callback;
      }

      render() {
        this.timer = setTimeout(() => {
          this.listeners.finished?.(new Blob(["GIF89a"], { type: "image/gif" }));
        }, 10_000);
      }

      abort() {
        clearTimeout(this.timer);
        window.__gifAborted = true;
        this.listeners.abort?.();
      }
    };
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: "frame.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page.locator('[data-action="convert"]').click();
  await expect.poll(() => page.evaluate(() => window.__gifCreated)).toBe(true);
  await page.locator('[data-action="cancel"]').click();

  await expect(page.locator("[data-role=status]")).toContainText("취소");
  await expect.poll(() => page.evaluate(() => window.__gifAborted)).toBe(true);
  await expect(page.locator(".queue-card")).toHaveCount(1);
  await expect(page.locator('[data-action="convert"]')).toBeEnabled();
});

test("PDF와 PPT 방향 전환은 패널과 접근성 상태를 함께 갱신함", async ({ page }) => {
  for (const [route, targetName, visiblePanel, hiddenPanel] of [
    ["/tools/pdf.html", "PDF → 이미지", "#pdf-to-images-panel", "#images-to-pdf-panel"],
    ["/tools/ppt.html", "PPTX → 이미지", "#ppt-to-images-panel", "#images-to-pptx-panel"],
  ]) {
    await page.goto(route);
    const switchButton = page.getByRole("button", { name: targetName });
    await switchButton.click();
    await expect(switchButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(visiblePanel)).toBeVisible();
    await expect(page.locator(hiddenPanel)).toBeHidden();
  }
});

test("PPTX 페이지 비율과 파일명 레이어를 생성 설정에 반영함", async ({ page }) => {
  await page.goto("/tools/ppt.html", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    window.__pptxLayout = null;
    window.__pptxLayoutDefinition = null;
    window.__pptxSlideCalls = [];
    window.PptxGenJS = class FakePptxGenJs {
      set layout(value) {
        window.__pptxLayout = value;
      }

      defineLayout(value) {
        window.__pptxLayoutDefinition = value;
      }

      addSlide() {
        return {
          addImage() {
            window.__pptxSlideCalls.push("image");
          },
          addText() {
            window.__pptxSlideCalls.push("text");
          },
        };
      }

      async write() {
        return new Blob(["pptx"], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        });
      }
    };
  });

  await page.getByLabel("슬라이드 비율").selectOption("a4");
  await page.getByLabel("파일명 표시").check();
  await page.locator('#images-to-pptx-panel input[type="file"]').setInputFiles({
    name: "page.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await page.locator('#images-to-pptx-panel [data-action="convert"]').click();
  await expect(page.locator("#images-to-pptx-panel [data-role=status]")).toContainText("1개 결과 파일");

  const pptxState = await page.evaluate(() => ({
    layout: window.__pptxLayout,
    definition: window.__pptxLayoutDefinition,
    calls: window.__pptxSlideCalls,
  }));
  expect(pptxState.layout).toBe("LAYOUT_A4_PORTRAIT");
  expect(pptxState.definition).toMatchObject({ width: 8.27, height: 11.69 });
  expect(pptxState.calls).toEqual(["image", "text"]);
});

test("이미지 편집기는 JPG 형식으로 실제 다운로드함", async ({ page }) => {
  await page.goto("/tools/image-editor.html");
  await page.locator('input[type="file"]').setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: tinyPng,
  });
  await expect(page.locator("[data-role=status]")).toContainText("불러왔습니다");
  await page.locator("[data-role=export-format]").selectOption("jpeg");

  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-action="download"]').click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  expect(Array.from(bytes.subarray(0, 3))).toEqual([255, 216, 255]);
  expect(download.suggestedFilename()).toMatch(/-edited\.jpg$/i);
});
