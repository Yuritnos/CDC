# Windows installer identity

`installer.nsi` is Tauri CLI 2.12.4's upstream NSIS template from
[commit 993038c](https://github.com/tauri-apps/tauri/blob/993038c49185307dfc895ab7657d77ca0d5ed7c7/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi).
It retains the upstream Apache-2.0/MIT licensing.

Only two definitions differ: `UNINSTKEY` and `MANUPRODUCTKEY` keep the original
`CDC` registry keys. The visible product name, shortcuts and installer remain
**PMCO**. Keeping these keys lets the normal installer detect/uninstall the
previous CDC version and restore its installation directory, including custom
paths. It also avoids a duplicate entry in Windows Installed apps. The executable
remains `cdc.exe`; the library stays under `com.cdc.collection`.

The CLI version is pinned in `package.json` so the template matches its bundler.
When upgrading the CLI, refresh this template from the matching upstream source,
retain only these two registry definitions, and verify NSIS/MSI packages in staging.
The MSI upgrade code is separately pinned in `tauri.conf.json`.
