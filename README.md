# Pi-lease

**Ask Pi to pi-lease do browser work explicitly.** Pi-lease launches regular Pi in a chosen directory, plus a visible dedicated Chromium profile and the upstream `pi-chrome-use` extension for that invocation only. Ordinary `pi` is unchanged and browser-free.

## Status

Implemented launcher and deterministic unit tests. Manual browser, Pi, registry, profile-persistence, and signal validation remain to be performed on a Linux workstation.

## Usage

```sh
npm install
pi-lease-setup        # creates only browser profile/cache/runtime directories
pi-lease [working-directory]
```

`pi-lease-setup --check` validates Node, Pi, and browser without creating directories. It never reads, copies, or prints Pi authentication; sign in manually in the visible dedicated browser. `PI_LEASE_BROWSER=/absolute/browser` overrides discovery. `PI_LEASE_TIMEOUT_MS` accepts 100–120000 milliseconds. `PI_OFFLINE=1` deliberately fails because each launch checks the latest npm registry metadata and visibly loads `npm:pi-chrome-use` with `pi -e`.

The launch uses normal Pi project context files, `.pi` resources, skills, prompts, themes, settings, and project trust behavior. It passes only `-e npm:pi-chrome-use --prompt-template <absolute bundled prompt>` and `BU_CDP_WS` for its verified browser. It does **not** set `PI_CODING_AGENT_DIR`, install into persistent Pi settings, or expose a browser to ordinary Pi.

## Lifecycle and security

Chromium is headful, uses loopback CDP, a persistent dedicated profile, and is owned/closed by the foreground launcher. Linux discovery prefers Chromium then Chrome; `src/browser.js` currently diagnoses unsupported non-Linux platforms. The banner shows the privileged mode, working directory, profile, and browser PID, but not the CDP endpoint.

Browser page content is untrusted. `browser_execute` can execute arbitrary JavaScript/Node-side code, so Pi-lease is not a sandbox and cannot enforce purchase policy against arbitrary tool use. The bundled guidance enables purchases by default: confirm numeric USD/EUR/GBP purchases at or above 20; confirm or refuse unknown amounts and other currencies. Inspect page state before claiming consequential success.

Linux paths are `${XDG_DATA_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}}/pi-lease/chromium`, `${XDG_CACHE_HOME:-$HOME/.cache}/pi-lease`, and `${XDG_RUNTIME_DIR:-${XDG_STATE_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}}}/pi-lease`. macOS uses `~/Library/Application Support/pi-lease` and `~/Library/Caches/pi-lease`.

## Architecture

`bin/pi-lease` validates/preflights, starts `src/browser.js`, and supervises Pi. `src/platform.js` discovers browsers; upstream `pi-chrome-use` owns browser tool/CDP-session mechanics. `prompts/pi-lease.md` supplies guidance, while `config/pi-lease-settings.json` records reviewed defaults. No daemon, MCP layer, or browser wrapper is added.

## Development and release

Run `npm test`, `npm run check`, and `npm run pack:check`. GitLab CI runs `npm ci`, checks, pack dry-run, and production-only audit. Publishing requires a protected `vX.Y.Z` tag exactly matching `package.json`; it uses npm 11, GitLab OIDC `NPM_ID_TOKEN` with npm-registry audience, provenance, and public access. A maintainer must configure npm trusted publishing for this GitLab project first—this repository does not fabricate npm secrets or that external configuration. After checks and configuration, create/protect the matching version tag and let CI publish; do not publish manually.

See [PLAN.md](PLAN.md) for the manual validation matrix and limitations, and [EVIDENCE.md](EVIDENCE.md) for recorded automated/host validation results.
