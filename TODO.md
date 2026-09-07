# Pi-lease TODO

## Completed

- Implemented ESM Node 20+ foreground launcher, explicit upstream extension preflight, loopback browser handoff, owned-browser cleanup, setup command, package metadata, CI, and builtins-only unit tests.
- Updated the user decision: an explicit Pi-lease launch is regular Pi in its target directory; no `PI_CODING_AGENT_DIR` override or resource-discovery isolation is applied.
- Added purchase guidance defaults (enabled; confirm >=20 USD/EUR/GBP; unknown currency/amount confirm or refuse) and documented that arbitrary `browser_execute` cannot be technically intercepted.

## Validation completed

- `npm test` — 11 tests passed.
- `npm run check` — syntax checks and all tests passed.
- `npm run pack:check` — package contents inspected; 11 files included.
- `npm audit --omit=dev` — 0 vulnerabilities.
- `node bin/pi-lease-setup --check` — Node, Pi, browser, and upstream registry source validated without creating paths.
- `node bin/pi-lease-setup` — documented profile/cache/runtime directories created with setup guidance.
- Disposable Chromium lifecycle smoke — Chromium 152 launched headfully under X11 (`DISPLAY=:0`), loopback CDP identity and page target verified, and the owned process exited cleanly.
- Disposable persistence smoke — the dedicated profile's `Default/Preferences` survived close/relaunch and `DevToolsActivePort` was removed as transient state.
- End-to-end launcher smoke — latest package preflight completed, regular Pi started with the explicit extension and bundled prompt, then exited cleanly in a non-interactive harness; no Chromium process remained.

## Remaining validation

- Use the manual matrix in PLAN.md for local-page interaction through `browser_execute`, harmless-site navigation/screenshots, profile persistence, ordinary-Pi/Pi Sych tool separation, browser-exit handling, profile locking, and interrupted shutdown.
- Run the same visible lifecycle checks in a Wayland session; the launcher deliberately leaves Chromium's display backend automatic but Wayland is not tested here.
- Configure npm trusted publishing on npmjs for the GitLab project, then verify protected matching-tag OIDC/provenance release CI after the repository is pushed.
- Non-Linux browser support remains deferred: browser startup currently fails diagnostically outside Linux.
