import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverBrowser } from "../src/platform.js";

test("discovery prefers chromium and validates override", async () => {
	const dir = await mkdtemp(path.join(tmpdir(), "lease-platform-"));
	for (const name of ["chromium", "google-chrome"]) {
		const p = path.join(dir, name);
		await writeFile(p, "#!/bin/sh\n");
		await chmod(p, 0o755);
	}
	assert.equal(
		await discoverBrowser(undefined, { platform: "linux", env: { PATH: dir } }),
		path.join(dir, "chromium"),
	);
	assert.equal(
		await discoverBrowser(path.join(dir, "google-chrome"), { platform: "linux", env: {} }),
		path.join(dir, "google-chrome"),
	);
	await assert.rejects(discoverBrowser(undefined, { platform: "win32", env: {} }), /unsupported/);
});
