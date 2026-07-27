import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "dist");
const clientRoot = path.join(outputRoot, "client");
const serverRoot = path.join(outputRoot, "server");

const runtimeScripts = [
  "converter-image-type.js",
  "converter-images-to-gif.js",
  "converter-images-to-pdf.js",
  "converter-images-to-pptx.js",
  "converter-pdf-to-images.js",
  "converter-ppt-to-images.js",
  "editor-image.js",
  "editor-mp3.js",
  "home.js",
];

const workerSource = String.raw`const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob: data:; media-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self'; form-action 'self'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

async function applySecurityHeaders(response, origin) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  let body = response.body;

  if ((headers.get("Content-Type") || "").includes("text/html") && body) {
    body = (await response.text()).replaceAll("__TOOL_PAGE_ORIGIN__", origin);
    headers.delete("Content-Length");
  }

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function fetchAsset(request, env, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return env.ASSETS.fetch(new Request(assetUrl, request));
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return applySecurityHeaders(
        new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" },
        }),
        new URL(request.url).origin,
      );
    }

    const url = new URL(request.url);
    const pathname = url.pathname.endsWith("/")
      ? url.pathname + "index.html"
      : url.pathname;
    let response = await fetchAsset(request, env, pathname);

    if (
      response.status === 404 &&
      !pathname.slice(pathname.lastIndexOf("/") + 1).includes(".")
    ) {
      response = await fetchAsset(request, env, pathname + ".html");
    }

    if (response.status === 404) {
      response = new Response("요청한 도구 페이지를 찾을 수 없습니다.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return applySecurityHeaders(response, url.origin);
  },
};
`;

const indexSource = await readFile(path.join(projectRoot, "index.html"), "utf8");
const sitesIndexSource = indexSource.replaceAll(
  "https://yeon-sik.github.io/Tool-Page",
  "__TOOL_PAGE_ORIGIN__",
);

await rm(outputRoot, { recursive: true, force: true });
await Promise.all([
  mkdir(path.join(clientRoot, "scripts"), { recursive: true }),
  mkdir(serverRoot, { recursive: true }),
]);

await Promise.all([
  writeFile(path.join(clientRoot, "index.html"), sitesIndexSource, "utf8"),
  cp(path.join(projectRoot, "styles.css"), path.join(clientRoot, "styles.css")),
  cp(path.join(projectRoot, "app.js"), path.join(clientRoot, "app.js")),
  cp(path.join(projectRoot, "tools"), path.join(clientRoot, "tools"), {
    recursive: true,
  }),
  cp(path.join(projectRoot, "assets"), path.join(clientRoot, "assets"), {
    recursive: true,
  }),
  ...runtimeScripts.map((fileName) =>
    cp(
      path.join(projectRoot, "scripts", fileName),
      path.join(clientRoot, "scripts", fileName),
    ),
  ),
  writeFile(path.join(serverRoot, "index.js"), workerSource, "utf8"),
]);

console.log(
  `Sites 빌드 완료: ${runtimeScripts.length}개 런타임 스크립트와 정적 자산`,
);
