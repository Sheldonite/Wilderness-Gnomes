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

## Publishing a release

1. Bump `version` in `package.json` (for example `0.2.0`). The updater compares this number.
2. Commit, then tag and push the tag:

   ```bash
   git tag v0.2.0 && git push origin main v0.2.0
   ```

3. The `Desktop release` workflow (`.github/workflows/release.yml`) builds on a Windows runner,
   runs the tests, and publishes a GitHub Release with the installer plus `latest.yml`, the
   manifest the updater reads.

Installed copies show a version badge in the bottom-right of the title screen with a
**Check for updates** button. Finding a newer release offers **Download update**, then
**Restart to update**. Updates only work in the installed app; the dev shell reports that.

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
