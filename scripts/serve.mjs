import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT || 4179);
const host = process.env.HOST || "127.0.0.1";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
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

const server = createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  let pathname;

  try {
    pathname = decodeURIComponent(new URL(request.url || "/", `http://${request.headers.host || host}`).pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad Request");
    return;
  }

  const relativePath = normalize(pathname.replace(/^[/\\]+/, ""));
  let filePath = resolve(join(projectRoot, relativePath || "index.html"));
  const relativeToRoot = relative(projectRoot, filePath);

  if (isAbsolute(relativeToRoot) || relativeToRoot.startsWith("..")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    if (statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }

    const fileStat = statSync(filePath);
    const headers = {
      "Cache-Control": "no-store",
      "Content-Length": fileStat.size,
      "Content-Type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    };
    response.writeHead(200, headers);

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    });
    response.end("Not Found");
  }
});

server.listen(port, host, () => {
  console.log(`Tool Page: http://${host}:${port}`);
});

let stopping = false;
const stop = () => {
  if (stopping) {
    return;
  }

  stopping = true;
  server.close(() => process.exit(0));
  server.closeAllConnections?.();
  setTimeout(() => process.exit(0), 1_000).unref();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("SIGBREAK", stop);
