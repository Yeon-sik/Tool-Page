import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const host = "127.0.0.1";
const port = 4179;
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webp": "image/webp",
};

function createStaticServer() {
  return createServer((request, response) => {
    let pathname;

    try {
      pathname = decodeURIComponent(new URL(request.url || "/", `http://${request.headers.host || host}`).pathname);
    } catch {
      response.writeHead(400).end("Bad Request");
      return;
    }

    const relativePath = normalize(pathname.replace(/^[/\\]+/, ""));
    let filePath = resolve(join(projectRoot, relativePath || "index.html"));
    const relativeToRoot = relative(projectRoot, filePath);

    if (isAbsolute(relativeToRoot) || relativeToRoot.startsWith("..")) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      if (statSync(filePath).isDirectory()) {
        filePath = join(filePath, "index.html");
      }

      const fileStat = statSync(filePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": fileStat.size,
        "Content-Type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
    }
  });
}

export default async function globalSetup() {
  const server = createStaticServer();

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, resolveListen);
  });

  return async () => {
    server.closeAllConnections?.();
    await new Promise((resolveClose) => server.close(resolveClose));
  };
}
