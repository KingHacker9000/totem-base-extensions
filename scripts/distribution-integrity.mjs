import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_EXTENSION_IDS = [
  "clock",
  "github",
  "spotify",
  "system-control",
  "system-status",
  "timer",
  "weather",
];

const ALLOWED_EXTENSION_FILES = new Set([
  "README.md",
  "backend/index.js",
  "totem-extension.json",
]);

const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertPortableRelativePath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) {
    throw new Error("distribution path must be a non-empty string");
  }
  if (relativePath.includes("\\") || path.posix.isAbsolute(relativePath)) {
    throw new Error(`unsafe distribution path: ${relativePath}`);
  }

  const parts = relativePath.split("/");
  for (const part of parts) {
    if (part === "" || part === "." || part === "..") {
      throw new Error(`unsafe distribution path component: ${relativePath}`);
    }
    if (/[\u0000-\u001f<>:"|?*]/u.test(part)) {
      throw new Error(`non-portable distribution path component: ${relativePath}`);
    }
    if (/[. ]$/u.test(part) || WINDOWS_RESERVED.test(part)) {
      throw new Error(`Windows-incompatible distribution path component: ${relativePath}`);
    }
  }
  return relativePath;
}

async function discoverExtensionDirectories(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const discovered = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(rootDir, entry.name, "totem-extension.json");
    try {
      const stat = await fs.lstat(manifestPath);
      if (stat.isFile() || stat.isSymbolicLink()) discovered.push(entry.name);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return discovered.sort();
}

async function walkExtension(rootDir, extensionId) {
  const extensionRoot = path.join(rootDir, extensionId);
  const files = [];

  async function walk(currentDir, prefix = "") {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, "en"));

    const collisionKeys = new Map();
    for (const entry of entries) {
      const key = entry.name.normalize("NFC").toLowerCase();
      if (collisionKeys.has(key)) {
        throw new Error(`case/Unicode path collision in ${extensionId}: ${collisionKeys.get(key)} vs ${entry.name}`);
      }
      collisionKeys.set(key, entry.name);

      const relativeWithinExtension = prefix ? `${prefix}/${entry.name}` : entry.name;
      assertPortableRelativePath(relativeWithinExtension);
      const absolutePath = path.join(currentDir, entry.name);
      const stat = await fs.lstat(absolutePath);

      if (stat.isSymbolicLink()) {
        throw new Error(`symlinks are not allowed in extension distribution: ${extensionId}/${relativeWithinExtension}`);
      }
      if (stat.isDirectory()) {
        await walk(absolutePath, relativeWithinExtension);
        continue;
      }
      if (!stat.isFile()) {
        throw new Error(`special files are not allowed in extension distribution: ${extensionId}/${relativeWithinExtension}`);
      }
      if (!ALLOWED_EXTENSION_FILES.has(relativeWithinExtension)) {
        throw new Error(`unexpected extension distribution file: ${extensionId}/${relativeWithinExtension}`);
      }

      const bytes = await fs.readFile(absolutePath);
      files.push({
        path: `${extensionId}/${relativeWithinExtension}`,
        bytes: bytes.length,
        sha256: sha256(bytes),
      });
    }
  }

  await walk(extensionRoot);
  files.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return files;
}

export async function buildDistributionReport(rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)))) {
  const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, "package.json"), "utf8"));
  if (packageJson.name !== "@totem/base-extensions") {
    throw new Error(`unexpected package identity: ${packageJson.name ?? "<missing>"}`);
  }

  const discovered = await discoverExtensionDirectories(rootDir);
  if (JSON.stringify(discovered) !== JSON.stringify(EXPECTED_EXTENSION_IDS)) {
    throw new Error(`extension directory set mismatch: expected ${EXPECTED_EXTENSION_IDS.join(", ")}; got ${discovered.join(", ")}`);
  }

  const manifestIds = new Set();
  const extensions = [];
  const files = [];

  for (const extensionId of EXPECTED_EXTENSION_IDS) {
    const manifestPath = path.join(rootDir, extensionId, "totem-extension.json");
    const manifestStat = await fs.lstat(manifestPath);
    if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) {
      throw new Error(`manifest must be a regular file: ${extensionId}/totem-extension.json`);
    }
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (manifest.id !== extensionId) {
      throw new Error(`manifest id mismatch for ${extensionId}: ${manifest.id ?? "<missing>"}`);
    }
    if (manifestIds.has(manifest.id)) {
      throw new Error(`duplicate extension id: ${manifest.id}`);
    }
    manifestIds.add(manifest.id);

    const backendEntrypoint = manifest.entrypoints?.backend;
    if (backendEntrypoint !== "./backend/index.js") {
      throw new Error(`unexpected backend entrypoint for ${extensionId}: ${backendEntrypoint ?? "<missing>"}`);
    }
    const entrypointStat = await fs.lstat(path.join(rootDir, extensionId, "backend", "index.js"));
    if (entrypointStat.isSymbolicLink() || !entrypointStat.isFile()) {
      throw new Error(`backend entrypoint must be a regular file: ${extensionId}/backend/index.js`);
    }

    const extensionFiles = await walkExtension(rootDir, extensionId);
    files.push(...extensionFiles);
    extensions.push({ id: manifest.id, version: manifest.version });
  }

  files.sort((a, b) => a.path.localeCompare(b.path, "en"));
  extensions.sort((a, b) => a.id.localeCompare(b.id, "en"));

  const payload = {
    schema: "totem.extension-distribution/v1",
    package: { name: packageJson.name, version: packageJson.version },
    extensionIds: [...EXPECTED_EXTENSION_IDS],
    extensions,
    files,
  };

  return {
    ...payload,
    aggregateSha256: sha256(Buffer.from(JSON.stringify(payload), "utf8")),
  };
}

async function main() {
  const report = await buildDistributionReport();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
