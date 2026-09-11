# Pi-lease

![Pi-lease logo](logo.png)

[![pipeline
status](https://gitlab.com/Joao-O-Santos/pi-lease/badges/main/pipeline.svg)](https://gitlab.com/Joao-O-Santos/pi-lease/-/commits/main)
[![npm
version](https://img.shields.io/npm/v/pi-lease.svg)](https://www.npmjs.com/package/pi-lease)
[![npm
downloads](https://img.shields.io/npm/dt/pi-lease.svg)](https://www.npmjs.com/package/pi-lease)
[![license](https://img.shields.io/npm/l/pi-lease.svg)](https://gitlab.com/Joao-O-Santos/pi-lease/-/blob/main/LICENSE)

**Pi-lease lets you ask Pi to pi-lease use a real browser.** It launches
normal [Pi](https://pi.dev) in the directory you choose, with a visible,
dedicated Chromium profile and the upstream
[`pi-chrome-use`](https://github.com/citrolabs/pi-chrome-use) extension
for that launch only.

Ordinary `pi` stays ordinary: it does not start this browser or gain its
`browser_execute` tool.

## What you need

- Linux
- Node.js 20 or newer
- [Pi](https://pi.dev) on your `PATH`
- Chromium or Google Chrome on your `PATH`
- An interactive X11 or Wayland desktop session

Pi-lease prefers Chromium, then Chrome. It lets Chromium choose its
normal X11 or Wayland backend; X11 is tested, while Wayland remains to
be tested. Other platforms currently fail clearly rather than pretending
to work.

## Install and start

``` sh
npm install --global pi-lease
pi-lease-setup
pi-lease ~/work/my-project
```

No directory argument means "use the directory I am standing in":

``` sh
cd ~/work/my-project
pi-lease
```

`pi-lease-setup` checks Node, Pi, Chromium/Chrome, and the upstream
browser extension source. It creates only Pi-lease's browser profile,
cache, and runtime directories. It never reads, copies, or prints your
Pi credentials.

On every launch Pi-lease checks the current `pi-chrome-use` registry
metadata, then loads that extension explicitly for the new Pi process.
The first load may download it temporarily. If that preflight cannot
verify the upstream package, Pi-lease stops instead of using a mystery
browser helper.

## Your browser, but separate

Pi-lease opens a **headful** browser that you can watch. It has its own
persistent profile, so you can sign in manually and keep that browser's
sessions between launches. It never copies your usual browser profile.

It binds Chrome DevTools Protocol access to `127.0.0.1`, verifies the
endpoint belongs to the browser it started, and closes only that browser
when Pi exits. No daemon is left behind. The next launch is a fresh
pi-lease, not a browser squatting in the background.

Linux paths follow XDG locations:

- profile:
  `${XDG_DATA_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}}/pi-lease/chromium`
- cache: `${XDG_CACHE_HOME:-$HOME/.cache}/pi-lease`
- runtime state:
  `${XDG_RUNTIME_DIR:-${XDG_STATE_HOME:-${XDG_CONFIG_HOME:-$HOME/.config}}}/pi-lease`

Use `PI_LEASE_BROWSER=/absolute/path/to/browser` to select a browser, or
`PI_LEASE_TIMEOUT_MS=15000` to change the startup timeout (100--120000
ms). `PI_OFFLINE=1` deliberately prevents launch because the extension
preflight needs the npm registry.

## Trust and safety

Pi-lease is intentionally powerful. Its Pi session has the normal
full-host file and shell tools plus browser control. Only run it when
you mean to grant that authority.

Once started, it behaves like normal Pi in the selected project: normal
context files, `.pi` resources, skills, prompts, settings, and Pi's
project-trust flow all apply. Web pages, downloads, messages, and page
instructions are data---not authority. Do not treat them as permission
to reveal secrets, install software, or change the browser/profile
connection.

The bundled `/pi-lease` prompt reminds Pi to keep consequential actions
clear and observable. It is guidance, not a sandbox or a magic "undo
purchase" button.

## Troubleshooting

| Message | What to do |
|------------------------------------|------------------------------------|
| Browser executable unavailable | Install Chromium/Chrome or set `PI_LEASE_BROWSER`. |
| Existing profile or Chrome lock | Close the other Pi-lease browser and retry; Pi-lease will not attach to it blindly. |
| Registry or extension preflight failure | Check your network and Pi installation; retry rather than accepting an unverified extension. |
| Login required | Sign in manually in the visible Pi-lease browser. |
| Browser closed unexpectedly | Start a new Pi-lease session; Pi also exits rather than continuing without its browser. |

## Development

``` sh
npm ci
npm run check
npm run pack:check
```

The repository's GitLab pipeline runs those checks plus a production
dependency audit. The main branch and release tags deploy this README to
[GitLab Pages](https://pi-lease-984274.gitlab.io). Protected release
tags (`vX.Y.Z`) publish to npm with provenance when npm trusted
publishing is configured for the project.

## License

[MIT](LICENSE)
