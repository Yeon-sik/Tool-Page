import assert from "node:assert/strict";
import test from "node:test";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

test("루트 요청을 index.html로 보내고 배포 호스트 메타데이터를 주입함", async () => {
  const worker = await loadWorker();
  const requestedPaths = [];
  const response = await worker.fetch(
    new Request("https://deployed.example/"),
    {
      ASSETS: {
        fetch: async (request) => {
          requestedPaths.push(new URL(request.url).pathname);
          return new Response(
            '<!doctype html><link rel="canonical" href="__TOOL_PAGE_ORIGIN__/" />',
            { headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(requestedPaths, ["/index.html"]);
  assert.match(await response.text(), /https:\/\/deployed\.example\//);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
});

test("확장자 없는 도구 경로는 대응하는 HTML 자산으로 한 번 보정함", async () => {
  const worker = await loadWorker();
  const requestedPaths = [];
  const response = await worker.fetch(
    new Request("https://deployed.example/tools/pdf"),
    {
      ASSETS: {
        fetch: async (request) => {
          const pathname = new URL(request.url).pathname;
          requestedPaths.push(pathname);
          return pathname.endsWith(".html")
            ? new Response("<!doctype html><title>PDF</title>", {
                headers: { "Content-Type": "text/html; charset=utf-8" },
              })
            : new Response("Not found", { status: 404 });
        },
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(requestedPaths, ["/tools/pdf", "/tools/pdf.html"]);
});

test("정적 사이트는 상태 변경 메서드를 거부함", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("https://deployed.example/", { method: "POST" }),
    { ASSETS: { fetch: async () => new Response("unexpected") } },
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("Allow"), "GET, HEAD");
});
