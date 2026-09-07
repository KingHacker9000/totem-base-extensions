import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EXPECTED_EXTENSION_IDS,
  assertPortableRelativePath,
  buildDistributionReport,
} from "../scripts/distribution-integrity.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

async function createFixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "totem-base-extensions-integrity-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.copyFile(path.join(REPO_ROOT, "package.json"), path.join(root, "package.json"));
  for (const extensionId of EXPECTED_EXTENSION_IDS) {
    await fs.cp(path.join(REPO_ROOT, extensionId), path.join(root, extensionId), { recursive: true });
  }
  return root;
}

test("distribution report is deterministic and covers every expected extension", async (t) => {
  const root = await createFixture(t);
  const first = await buildDistributionReport(root);
  const second = await buildDistributionReport(root);

  assert.deepEqual(second, first);
  assert.equal(first.schema, "totem.extension-distribution/v1");
  assert.deepEqual(first.extensionIds, EXPECTED_EXTENSION_IDS);
  assert.equal(first.extensions.length, EXPECTED_EXTENSION_IDS.length);
  assert.match(first.aggregateSha256, /^[a-f0-9]{64}$/u);
  for (const extensionId of EXPECTED_EXTENSION_IDS) {
    assert(first.files.some((file) => file.path === `${extensionId}/totem-extension.json`));
    assert(first.files.some((file) => file.path === `${extensionId}/backend/index.js`));
  }
});

test("unexpected distribution files fail closed", async (t) => {
  const root = await createFixture(t);
  await fs.writeFile(path.join(root, "clock", "backend", "surprise.js"), "export default 1;\n");
  await assert.rejects(() => buildDistributionReport(root), /unexpected extension distribution file/u);
});

test("unexpected extension directories fail closed", async (t) => {
  const root = await createFixture(t);
  const extra = path.join(root, "extra-extension");
  await fs.mkdir(extra);
  await fs.writeFile(path.join(extra, "totem-extension.json"), "{}\n");
  await assert.rejects(() => buildDistributionReport(root), /extension directory set mismatch/u);
});

test("duplicate or mismatched manifest ids fail closed", async (t) => {
  const root = await createFixture(t);
  const manifestPath = path.join(root, "weather", "totem-extension.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  manifest.id = "clock";
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await assert.rejects(() => buildDistributionReport(root), /manifest id mismatch/u);
});

test("missing backend entrypoints fail closed", async (t) => {
  const root = await createFixture(t);
  await fs.rm(path.join(root, "timer", "backend", "index.js"));
  await assert.rejects(() => buildDistributionReport(root), /backend entrypoint must be a regular file|ENOENT/u);
});

test("portable path checks reject traversal and Windows-unsafe names", () => {
  for (const unsafe of ["../secret", "backend\\index.js", "CON", "trailing. ", "bad:name.js", "/absolute"]) {
    assert.throws(() => assertPortableRelativePath(unsafe));
  }
  assert.equal(assertPortableRelativePath("backend/index.js"), "backend/index.js");
});

test("symlinked distribution files fail closed", { skip: process.platform === "win32" }, async (t) => {
  const root = await createFixture(t);
  const backendPath = path.join(root, "clock", "backend", "index.js");
  await fs.rm(backendPath);
  await fs.symlink(path.join(root, "weather", "backend", "index.js"), backendPath);
  await assert.rejects(() => buildDistributionReport(root), /backend entrypoint must be a regular file|symlinks are not allowed/u);
});
