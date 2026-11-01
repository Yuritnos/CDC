# CDshelf current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. This is a compact handoff; verify git/build state before continuing.

## Current milestone

- App branding is now **CDshelf** in the UI, all three translations, Windows product/window metadata, JSON/CSV exports, documentation and workflow artifact (`CDshelf-windows`). Version remains 0.2.0. Kept `com.cdc.collection`, legacy storage/session keys, Rust binary `cdc.exe`, repository `Yuritnos/CDC` previous NSIS registry keys via the matching upstream template (two definitions only; CLI pinned to 2.12.4), and previous MSI upgrade code `{A095093C-258B-5ED8-8E7E-48EA16A86CE9}` to preserve existing collections and upgrade identity.
- Fixed Discogs 410 083-2 using public release 2332538: ten `5a`–`5j` sections belong to physical track 5, with parent duration **20:26**. Lookup produces one work-only duration/audio slot; Symphony No. 3 keeps four movement tracks. Genuinely separate numbered variation tracks remain separate. Added localized **Theme and variations** type, suggestions and title inference. Existing CDs are never silently rewritten: rerun lookup and Save.
- Added `supabase/migrations/20261101_profile_handle_rules.sql`. New/changed User IDs require 7–20 ASCII letters, digits or underscores. Server enforces 30 days (720 hours) between changes, including clearing the ID; clients cannot forge the timestamp or delete/recreate the profile to bypass the rule. Existing shorter IDs survive unchanged and allow nickname/photo edits. Initial assignment starts the cooldown; older IDs with no known timestamp get one grandfathered change.
- **Hosted profile migration applied** to `ogpzmnaqybxybybooebi` through Supabase on 2026-11-01. Live catalog verification confirms the timestamp column, enabled trigger, format rule, 720-hour interval and restrictive delete policy. The persistent server-update reminder now clears on profile refresh. No owner's profile or collection was used for testing. Existing unrelated advisory: password leaked-password protection disabled (app uses email OTP); no new schema security advisories.
- **67 checks passed:** collection integration 38, lookup normalization 17, isolated PostgreSQL profile rules 5, mocked account UI 3 and rendering 4. Includes lookup/form/save for 410 083-2, 028944443028/431780-2 regressions, legacy-ID preservation, cooldown, forged timestamps, upserts, uniqueness, RLS, schema refresh and en/ja/zh hints. PostgreSQL tests use in-memory PGlite (`npm install` dev dependency, or `CDSHELF_PGLITE_MODULE`); no hosted fixture writes. Visual QA: `installers/qa-cdshelf/410083-2-lookup.png`.

## Windows build

- New Windows build and verified installer replacement are authorized. Build 33 is running; the final source adds NSIS registry compatibility for the rename and requires a fresh run. Owner completed GitHub CLI sign-in. Do not claim replacement until both packages pass staging integrity, extraction, x64 PE, product/version, preserved MSI upgrade code and payload-equivalence checks.
- Current verified installers remain build 32, version 0.2.0, app source `9e3f5f335a33e6e75a33d8a2434b858277c8bd54`, [Actions run 41267870310](https://github.com/Yuritnos/CDC/actions/runs/41267870310). Evidence: `installers/staging-work-info-placement-41267870310/verification.json`. NSIS SHA-256 `5DD2458866D77C87DBB1CFEE9C56DCEFFDB10461ADAF597BB2A254638DCE1B1D`; MSI `DEF8BE1FF27006CEB8742F018B17A36D1CC0D33E90630EC261470CDC72E74903`. Existing rollback folders/branches remain; never restore earlier private collection snapshots over later changes.

## Email OTP: owner configured

- Owner confirmed on 2026-11-01 that **Email OTP length** was set to **6** and saved in the hosted dashboard, after receiving the direct Auth Providers page and control location. Connected Supabase tools do not expose Auth configuration, so API readback and actual new/existing-user email delivery were not independently verified. Do not claim an end-to-end sign-in test.
- Preserve SMTP, expiration and `{{ .Token }}` in Magic link/OTP and Confirm sign up templates. Client still accepts 6–10 digits so previously issued codes remain usable; never truncate codes. Never log codes, tokens, passwords or privileged keys.
## Retained behavior / limits

- Always-grouped albums, one set cover, independent disc defaults/audio, free-text years/manufacturing/type, scoped Discogs credits, far-right work info icons with disc-style popups, Alt+drag/Alt+arrows performer row ordering and retained manual folds remain unchanged. Works opens for saved/imported content and folds when empty; Audio starts folded.
- Original WebView2 role-picker STATUS_BREAKPOINT crash was not reproduced by browser stress tests; installed-app confirmation remains needed. No installation or launch against the owner's collection is authorized for testing. Existing saved CDs need lookup rerun and Save for metadata corrections.
- No version bump, tags/releases, repository/database renames or collection migrations. Postponed features (ripping, AI photos, phone sign-in, domain email, signing, auto-update, other platforms) are outside this task.
