# PMCO current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. Verify git/build state before continuing.

## Current milestone: PMCO branding, shelf FORM labels and relaxed User IDs

- App/project display name is **PMCO** in the page, native window/bundle metadata, exports, docs and future Windows workflow artifact names (PMCO-windows). Version remains **0.3.0**. Repository Yuritnos/CDC, com.cdc.collection, cdc.exe, storage/session keys, MSI upgrade code and legacy NSIS registry keys are unchanged. Existing collections and old JSON exports remain compatible; no saved records are rewritten.
- Home-page standalone/set cards now show **FORM / value** using label/value columns matching performer rows. This honors the selected card fields; hidden types stay hidden. Profile FORM rows and wrapped-title icon/duration alignment remain.
- Removed the nickname explanation. Exact User ID change dates and the nickname-change sentence are removed. The monthly cooldown is temporarily disabled (client HANDLE_COOLDOWN_DAYS = 0), so the monthly notice stays hidden. A legacy server cooldown error uses only generic monthly wording, with no timestamp.
- New/changed User IDs use **4–20 ASCII letters, numbers or underscores**; unchanged legacy shorter IDs survive nickname/photo edits. Hosted migration **profile_handle_relaxed** is applied to ogpzmnaqybxybybooebi. Catalog verification confirms 4–20 validation, no cooldown rejection, enabled trigger, server-owned timestamps, case-insensitive unique index, RLS and both existing policies. No profile rows were edited for deployment/verification. Local migration: supabase/migrations/20261101_profile_handle_relaxed.sql; full schema matches it.
- **24 checks passed:** isolated PostgreSQL rule/upgrade/fresh-schema tests 6; mocked account UI 3; rendering 6; sections 9. Covers immediate repeated ID changes/clear/upsert, invalid IDs, legacy preservation, timestamp forgery, uniqueness/RLS, removed notes, localized hints/branding, shelf labels and selected-field behavior. Screenshots reviewed in installers/qa-pmco/. No test touched the owner's collection/account.
- Windows build, push and verified local installer replacement are now authorized. PMCO source is ready for the manual workflow; the packages below remain CDshelf/build 38 until staging verification/replacement completes. Hosted Auth email templates/sender/project display name were not changed; PMCO email-template examples in supabase/README.md are instructions only.
- CD-drive import remains in Audio, local TOC/duration reads and FLAC/WAV copying only. Draft ownership/recovery, entered metadata/grouping and existing-audio protection remain. Owner's earlier 40-minute FLAC test took 3 minutes or more; no extraction-speed optimization is claimed.

## Last packaged build: CDshelf build 38 (before current PMCO changes)

- **Build 38 succeeded**, [Actions run 41294330366](https://github.com/Yuritnos/CDC/actions/runs/41294330366), source f1b88880bae79009b73314edacdd82b44d6e2162. Native CI: 17 passed, zero failed. Version remains **0.3.0**; build 37 is superseded.
- Downloaded CDshelf-windows artifact archive SHA-256 d9813de7704cf2e80aae411cd5d5cc79585d40dd75f90ff33e8ebad2dc45e49c matches GitHub's digest. Both installers passed integrity/extraction, x64/product/version, preserved MSI upgrade code and app payload equivalence checks. All nine FLAC resources match between packages and pinned official archives; both staged encoder runtimes report 1.5.0. Evidence: installers/staging-drive-audio-41294330366/{artifact,verification,replacement}.json.
- Replaced current packages: installers/nsis/CDshelf_0.3.0_x64-setup.exe (3,463,586 bytes, SHA-256 03EBCF0BD2F3BD6847ECA348F7F2159FCF1728432E2AE9E26ED57D618B9FFBCE) and installers/msi/CDshelf_0.3.0_x64_en-US.msi (4,259,840 bytes, SHA-256 4747E06949BE0BC9355187B29384219EA6ADFDBBEAE4E2BD9A6240652FA9396B). Current copies match staged verification.
- Verified build-37 packages, exact app source archive and checksums are saved in installers/rollback-before-drive-audio-20261101/. Older rollback folders remain. No collection snapshots, installed-app launch, tags or releases were made for this update.
- Identity retained: com.cdc.collection, existing storage/session keys, Rust binary cdc.exe, repository Yuritnos/CDC, legacy NSIS registry keys and MSI upgrade code {A095093C-258B-5ED8-8E7E-48EA16A86CE9}.

## Remaining limitations

- Standard stereo audio CDs only; data/mixed-mode, pre-emphasis and four-channel discs are rejected. No secure-rip/AccurateRip verification, drive-offset correction or CD-Text. Broader hardware validation, damaged-disc recovery and extraction speed remain unverified beyond the owner's earlier test. Future physical QA requires an authorized isolated library.
- Original WebView2 role-picker STATUS_BREAKPOINT crash was not reproduced by browser stress tests; installed-app confirmation remains needed.

## Retained metadata/account state

- Existing collection/set/work/credit/fold/Undo behavior remains. Discogs 410 083-2 imports track 5a–5j as one **20:26** work/audio slot; Theme and variations inference is present. 028944443028 and 431780-2 regressions pass. Saved CDs are never silently rewritten: rerun lookup and Save.
- Historical 7–20/720-hour policy is superseded by the hosted relaxed-ID migration described above. Change timestamps, unique IDs and restrictive profile deletion remain; the monthly interval is temporarily suspended.
- Owner confirmed hosted Email OTP length **6** on 2026-11-01. Auth API readback and new/existing-user email delivery were not independently verified. Preserve SMTP, expiration and both `{{ .Token }}` templates; client accepts 6–10 digits for already-issued codes. Never log codes, tokens, passwords or privileged keys.
- Other postponed features (AI photos, phone sign-in, domain email, signing, auto-update and other platforms) remain outside this task.
