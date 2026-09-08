import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { leasePaths, main } from "../bin/pi-lease.js";

function child(code = 0) {
	const value = new EventEmitter();
	value.killed = false;
	value.kill = () => {
		value.killed = true;
		value.emit("exit", 0, null);
	};
	queueMicrotask(() => value.emit("exit", code, null));
	return value;
}
function dependencies(calls) {
	return {
		platform: "linux",
		paths: () => ({
			profile: "/profile",
			cache: path.join(tmpdir(), "lease-cache"),
			runtime: path.join(tmpdir(), "lease-run"),
		}),
		registry: async () => ({
			version: "1.2.3",
			repository: "https://github.com/citrolabs/pi-chrome-use",
		}),
		preflight: async () => {
			calls.preflight = true;
		},
		discoverBrowser: async (override) => {
			calls.override = override;
			return "/browser";
		},
		startBrowser: async (args) => {
			calls.browser = args;
			return {
				pid: 42,
				endpoint: "ws://127.0.0.1:9222/devtools/browser/x",
				exited: new Promise(() => {}),
				close: async () => {
					calls.closed = true;
				},
			};
		},
		piSpawn: (command, args, options) => {
			calls.spawn = { command, args, options };
			return child();
		},
		log: (value) => (calls.log = value),
	};
}
test("runs when invoked through a package-manager symlink", async () => {
	const root = await mkdtemp(path.join(tmpdir(), "lease-symlink-"));
	const launcher = path.join(root, "pi-lease");
	await symlink(fileURLToPath(new URL("../bin/pi-lease.js", import.meta.url)), launcher);
	const result = spawnSync(launcher, ["one", "two"], { encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /only one directory/);
});
test("launches regular Pi in requested directory with explicit extension and prompt", async () => {
	const cwd = await mkdtemp(path.join(tmpdir(), "lease-launch-")),
		calls = {};
	const code = await main(
		[cwd],
		{ HOME: tmpdir(), PI_LEASE_BROWSER: "/chosen" },
		dependencies(calls),
	);
	assert.equal(code, 0);
	assert.equal(calls.spawn.command, "pi");
	assert.equal(calls.spawn.options.cwd, cwd);
	assert.deepEqual(calls.spawn.args.slice(0, 2), ["-e", "npm:pi-chrome-use"]);
	assert.match(calls.spawn.args[3], /prompts\/pi-lease\.md$/);
	assert.equal(calls.spawn.options.env.BU_CDP_WS, "ws://127.0.0.1:9222/devtools/browser/x");
	assert.equal(calls.spawn.options.env.PI_CODING_AGENT_DIR, undefined);
	assert.equal(calls.override, "/chosen");
	assert.equal(calls.closed, true);
	assert.match(calls.log, /browser PID: 42/);
});
test("rejects extra, missing, and nondirectory arguments before preflight", async () => {
	const calls = {},
		deps = dependencies(calls),
		root = await mkdtemp(path.join(tmpdir(), "lease-invalid-"));
	await assert.rejects(main(["a", "b"], { HOME: tmpdir() }, deps), /only one/);
	await assert.rejects(main(["/does/not/exist"], { HOME: tmpdir() }, deps), /does not exist/);
	await writeFile(`${root}/file`, "x");
	await assert.rejects(main([`${root}/file`], { HOME: tmpdir() }, deps), /not a directory/);
	assert.equal(calls.preflight, undefined);
});
test("offline and bad timeout fail without browser startup", async () => {
	const cwd = await mkdtemp(path.join(tmpdir(), "lease-env-")),
		calls = {};
	await assert.rejects(
		main([cwd], { HOME: tmpdir(), PI_OFFLINE: "1" }, dependencies(calls)),
		/PI_OFFLINE/,
	);
	await assert.rejects(
		main([cwd], { HOME: tmpdir(), PI_LEASE_TIMEOUT_MS: "no" }, dependencies(calls)),
		/TIMEOUT/,
	);
	assert.equal(calls.browser, undefined);
});
test("XDG path contract preserves config fallback", () => {
	const result = leasePaths({ HOME: "/home/a", XDG_CONFIG_HOME: "/cfg" }, "linux");
	assert.equal(result.profile, "/cfg/pi-lease/chromium");
	assert.equal(result.runtime, "/cfg/pi-lease");
});
