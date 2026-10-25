# CDC

CDC is an app for cataloguing the CDs on your shelf. For each CD you can record a cover image, title, composer, performers, label, issuing corporation, recording year and release year. You can group CDs into favorites, and the app is available in English, Japanese and Simplified Chinese.

It is built with [Tauri 2](https://tauri.app). The screens are a single web page (`src/index.html`) shown in the system's own web view. A small Rust program (`src-tauri/`) keeps the collection in a file on the computer. The same project can later be built for macOS, iPhone and Android.

## Getting the Windows installer (no setup needed on your PC)

GitHub builds the installer on its own Windows machines.

1. Create a repository on GitHub. It can be private.
2. Upload this whole folder to it, keeping the folder structure. The hidden `.github` folder must be included, because it holds the build instructions.
3. Open the repository's **Actions** tab, select **Build Windows app**, then select **Run workflow**.
4. Wait about 10–15 minutes, then open the finished run. Under **Artifacts**, download **CDC-windows**. It contains:
   - `CDC_0.1.0_x64-setup.exe`, the installer to give people. It installs for the current user, so no administrator rights are needed.
   - `CDC_0.1.0_x64_en-US.msi`, an alternative installer for company IT departments.

### Publishing a release for others to download

Push a tag that starts with `v`, for example `v0.1.0`. You can also create one on GitHub under **Releases → Draft a new release → Choose a tag**. The same workflow then attaches the installers to a **draft release**. Check it, then select **Publish release**. Anyone can download the installer from the Releases page.

To publish a new version:

1. Raise `version` in **both** `src-tauri/tauri.conf.json` and `package.json`.
2. Tag the new version, for example `v0.1.1`.

## Where the collection is saved

- **Windows:** `%APPDATA%\com.cdc.collection\collection.json`, with the previous save kept as `collection.backup.json`.
- **macOS:** `~/Library/Application Support/com.cdc.collection/`.

On first launch, a collection saved by the earlier trial `CDC.exe` (`%APPDATA%\CDC\collection.json`) is copied over automatically.

## Working on it locally

You need [Node.js](https://nodejs.org) 20 or later and [Rust](https://rustup.rs). On Windows, you also need the "Desktop development with C++" tools from Visual Studio Build Tools.

```
npm install
npm run dev      # opens the app with live reload of src/index.html
npm run build    # makes the installer in src-tauri/target/release/bundle/
```

## How it is organised

| Path | What it is |
|---|---|
| `src/index.html` | The entire app UI: layout, translations and logic |
| `src-tauri/src/lib.rs` | `load_data` and `save_data`, which read and write the collection file |
| `src-tauri/tauri.conf.json` | App name, version, window size and installer settings |
| `src-tauri/icons/` | App icons, made from `app-icon.png` (the 1024 px source in the main folder) |
| `.github/workflows/build-windows.yml` | The GitHub build |

### Storage layer, for adding sharing later

All saving and loading in the page goes through one object, `Store` in `src/index.html`, which has `load()` and `save()`. To add accounts, sync or sharing:

1. Set up an online backend, for example Supabase or Firebase.
2. Write a second `Store` with the same two functions.
3. Switch the page to it.

The rest of the app does not need to change.

## Still to do before a public release

- **Code signing.** Unsigned installers trigger Windows SmartScreen's "Windows protected your PC" warning. A code-signing certificate removes it. Tauri's signing guide covers the setup: https://v2.tauri.app/distribute/sign/windows/
- **macOS build.** Add a `macos-latest` job to the workflow. A signed and notarised Mac app needs an Apple Developer account.
- **Phone apps.** Run `npm run tauri android init` / `ios init` and adapt the layout where needed.
