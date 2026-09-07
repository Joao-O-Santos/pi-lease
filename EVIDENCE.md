# Validation evidence

Recorded 2026-09-07 in the development environment. No credentials, cookies, page contents, or CDP tokens are recorded here.

| Check | Result |
| --- | --- |
| `node --version` | `v26.8.1` |
| `npm --version` | `12.0.2` |
| `pi --version` | `0.85.1` |
| `chromium --version` | `Chromium 152.0.7977.82` |
| `xdpyinfo` | X.Org display `:0` available; X11 smoke environment |
| `npm ci --ignore-scripts` | passed; 0 production vulnerabilities |
| `npm run check` | passed; 11 tests passed |
| `npm pack --dry-run` | passed; 11 runtime/package files listed |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `node bin/pi-lease-setup --check` | passed; upstream `pi-chrome-use` source/version verified |
| `node bin/pi-lease-setup` | passed; profile/cache/runtime directories created |
| disposable browser lifecycle | passed; loopback CDP, process ownership, page target, clean close |
| disposable persistence | passed; profile preference survived relaunch; transient port state removed |
| launcher smoke | passed; explicit extension preflight and regular Pi child startup/cleanup |
| GitLab CI lint | passed |
| GitLab pipeline `2827162874` | passed (`check` job) |

Wayland, `browser_execute` interaction with a local form, harmless-site navigation, full project trust/resource behavior, interrupted shutdown, and Pi Sych worker separation remain manual checks. The launcher leaves Chromium's display backend automatic for both X11 and Wayland, but Wayland has not been run here.

The npm package is not yet published. npm trusted publishing must be configured for this GitLab project on npmjs; the local npm session is not authenticated, so no publish was attempted.
