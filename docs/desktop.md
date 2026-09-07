# Desktop build and updates

The game ships two ways from the same Vite build: the GitHub Pages site and a Windows
desktop app. The desktop app is an Electron shell (`electron/main.cjs`) around `dist/`.

## Running locally

```bash
npm run dist
```

Builds the web bundle and then `release/Wilderness Gnomes-Setup-<version>.exe`, a one-click
installer that adds a desktop shortcut. `release/win-unpacked/Wilderness Gnomes.exe` runs
without installing.

`npm run desktop` opens the Electron shell on the current `dist/` without packaging.
`npm run desktop:dev` opens it against the Vite dev server (`npm run dev` first).

## Getting game updates (no release needed)

Every push to `main` already builds the game and publishes it to GitHub Pages, together with
`bundle-manifest.json` (written by `scripts/write-bundle-manifest.cjs` at the end of
`npm run build`): the commit, and every file with its size and SHA-256.

The title screen's **Check for updates** button compares the commit of the build currently
loaded with that manifest. If main is newer it offers **Download update**, fetches the
changed files from Pages into `%APPDATA%\wilderness-gnomesundles\<commit>\`, verifies
each checksum, then **Reload with update** switches to it. Unchanged files are copied from the
previous bundle instead of re-downloaded, and only the newest bundle is kept. The exe ships
with the `dist/` it was built from and falls back to it if no bundle has been pulled.

The badge reads `build <commit> · app v<version>`: the first is the game bundle, the second
the shell.

## Publishing the app itself

The installer only needs a new release when `electron/` or the packaging changes. Bump
`version` in `package.json`, commit, then tag and push:

```bash
git tag v0.2.0 && git push origin main v0.2.0
```

The `Desktop release` workflow (`.github/workflows/release.yml`) builds on a Windows runner,
runs the tests, and publishes a GitHub Release with the installer plus `latest.yml`. The
small **Check app update** link under the main button reads that release feed and offers
**Download app update** then **Restart to update**. In the dev shell it reports that shell
updates need the installed app.

Windows SmartScreen warns on the unsigned installer the first time. Choose "More info" then
"Run anyway". Code signing would remove the warning but costs a yearly certificate.

## Progress survives updates

Progress (Market Day gold, rocks, unlocks, equipped gear) lives in the browser storage of
the app's profile folder, `%APPDATA%\wilderness-gnomes`, which the installer never touches
during an update or uninstall (`deleteAppDataOnUninstall: false`).

As a second copy, `src/desktop/saves.ts` mirrors every `wilderness-gnomes*` storage key to
`%APPDATA%\wilderness-gnomes\saves\progress.json` a few seconds after any change and on
exit, keeping the previous version in `progress.previous.json`. On launch, any key missing
from browser storage is restored from that file before the game reads it. Copying the
`saves` folder to another machine moves progress with it.

Both mechanisms are keyed to `appId` in `electron-builder.yml`; changing it would start a new
profile folder, so leave it alone.

## Local build note

On this machine `npm run dist` can fail with `EPERM ... rename release\win-unpacked.tmp` while
Windows still holds files in the freshly extracted folder. Building to another drive works:

```bash
npx electron-builder --win --publish never --config.directories.output=C:/Temp/wg-release
```

The GitHub workflow is unaffected.
