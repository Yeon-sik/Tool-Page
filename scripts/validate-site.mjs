import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ignoredDirectories = new Set([
  ".git",
  ".understand-anything",
  "blob-report",
  "build",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const failures = [];

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) {
      return [];
    }

    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(fullPath) : [fullPath];
  });
}

const files = collectFiles(projectRoot);
const htmlFiles = files.filter((file) => extname(file).toLowerCase() === ".html");
const scriptFiles = files.filter((file) => [".js", ".mjs"].includes(extname(file).toLowerCase()));

for (const file of scriptFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });

  if (result.status !== 0) {
    failures.push(`${relative(projectRoot, file)}: JavaScript 구문 오류\n${result.stderr.trim()}`);
  }
}

for (const file of htmlFiles) {
  const source = readFileSync(file, "utf8");
  const fileLabel = relative(projectRoot, file);

  for (const [label, pattern] of [
    ["한국어 문서 언어", /<html\b[^>]*\blang=["']ko["']/i],
    ["UTF-8 문자셋", /<meta\b[^>]*\bcharset=["']?utf-8/i],
    ["반응형 viewport", /<meta\b[^>]*\bname=["']viewport["']/i],
    ["문서 제목", /<title>[^<]+<\/title>/i],
    ["주 제목", /<h1\b/i],
  ]) {
    if (!pattern.test(source)) {
      failures.push(`${fileLabel}: ${label}이(가) 없습니다.`);
    }
  }

  const ids = Array.from(source.matchAll(/\bid=["']([^"']+)["']/gi), (match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);

  if (duplicateIds.length > 0) {
    failures.push(`${fileLabel}: 중복 id ${Array.from(new Set(duplicateIds)).join(", ")}`);
  }

  const localReferences = Array.from(source.matchAll(/\b(?:href|src)=["']([^"'#]+)["']/gi), (match) => match[1]).filter(
    (reference) => !/^(?:[a-z]+:|\/\/|data:)/i.test(reference)
  );

  for (const reference of localReferences) {
    const cleanReference = reference.split(/[?#]/)[0];

    if (!cleanReference) {
      continue;
    }

    const target = resolve(join(resolve(file, ".."), cleanReference));

    if (!existsSync(target)) {
      failures.push(`${fileLabel}: 로컬 참조 대상이 없습니다. ${reference}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`정적 검증 실패 (${failures.length}건)\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log(`정적 검증 통과: HTML ${htmlFiles.length}개, JavaScript ${scriptFiles.length}개`);
