# PMCO current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. Verify git/build state before continuing.

## Current milestone: PMCO branding, shelf FORM labels and relaxed User IDs

- App/project display name is **PMCO** in the page, native window/bundle metadata, exports, docs and future Windows workflow artifact names (PMCO-windows). Version remains **0.3.0**. Repository Yuritnos/CDC, com.cdc.collection, cdc.exe, storage/session keys, MSI upgrade code and legacy NSIS registry keys are unchanged. Existing collections and old JSON exports remain compatible; no saved records are rewritten.
- Home-page standalone/set cards now show **FORM / value** using label/value columns matching performer rows. This honors the selected card fields; hidden types stay hidden. Profile FORM rows and wrapped-title icon/duration alignment remain.
- Removed the nickname explanation. Exact User ID change dates and the nickname-change sentence are removed. The monthly cooldown is temporarily disabled (client HANDLE_COOLDOWN_DAYS = 0), so the monthly notice stays hidden. A legacy server cooldown error uses only generic monthly wording, with no timestamp.
- New/changed User IDs use **4–20 ASCII letters, numbers or underscores**; unchanged legacy shorter IDs survive nickname/photo edits. Hosted migration **profile_handle_relaxed** is applied to ogpzmnaqybxybybooebi. Catalog verification confirms 4–20 validation, no cooldown rejection, enabled trigger, server-owned timestamps, case-insensitive unique index, RLS and both existing policies. No profile rows were edited for deployment/verification. Local migration: supabase/migrations/20261101_profile_handle_relaxed.sql; full schema matches it.
- **41 checks passed across feature verification and Windows CI:** 17 native importer tests plus 24 feature checks: isolated PostgreSQL rule/upgrade/fresh-schema tests 6; mocked account UI 3; rendering 6; sections 9. Covers immediate repeated ID changes/clear/upsert, invalid IDs, legacy preservation, timestamp forgery, uniqueness/RLS, removed notes, localized hints/branding, shelf labels and selected-field behavior. Screenshots reviewed in installers/qa-pmco/. No test touched the owner's collection/account.
- Windows build 39 and verified installer replacement are complete; source is pushed to main. No requested implementation work remains. Hosted Auth email templates/sender/project display name were not changed; PMCO email-template examples in supabase/README.md are instructions only.
- CD-drive import remains in Audio, local TOC/duration reads and FLAC/WAV copying only. Draft ownership/recovery, entered metadata/grouping and existing-audio protection remain. Owner's earlier 40-minute FLAC test took 3 minutes or more; no extraction-speed optimization is claimed.

## Windows build and installer replacement: PMCO 0.3.0 build 39 complete

- **Build 39 succeeded**, [Actions run 41298451546](https://github.com/Yuritnos/CDC/actions/runs/41298451546), exact app source 9e5de81e01f1734150def428764785b396def7fa. Native Windows CI: 17 passed, zero failed. Product/version in both packages is **PMCO 0.3.0**. Later handoff commits change documentation only.
- Downloaded **PMCO-windows** artifact 13079979754, archive SHA-256 5d836367e7ba56ad32490f7a5c8665ae2f0f0801801d6499a35244fe6e73aea4, matches GitHub's digest. Both packages passed integrity/extraction, x64 PE/product/version, preserved MSI upgrade code and normalized app-payload-equivalence checks. Nine FLAC resource files match between packages and pinned official resources; both staged encoder runtimes report 1.5.0. Evidence: installers/staging-pmco-41298451546/{artifact,verification,replacement}.json.
- Current installers: **installers/nsis/PMCO_0.3.0_x64-setup.exe** (3,463,390 bytes, SHA-256 1624654FA6C189A1CA863AAB0418F926545DBEC4EA07136683AAE75A779A4C4A) and **installers/msi/PMCO_0.3.0_x64_en-US.msi** (4,263,936 bytes, SHA-256 2C2774B3DE81585FF66D0E1085D8F31ADE3D800FBCE62DC31102B87A3DAFD340). Final local copies match staged checksums. Old CDshelf filenames were removed after backups and new copies passed verification.
- Verified CDshelf/build-38 installers, exact app-source archive and hashes are in **installers/rollback-before-pmco-20261101/**. Earlier rollback folders remain. This backs up packages/source only; it does not roll back the hosted User ID policy. No collection snapshots, app installation/launch against the owner's library, tags or releases were made.
- Identity retained: com.cdc.collection, storage/session keys, Rust binary cdc.exe, repository Yuritnos/CDC, legacy NSIS registry keys and MSI upgrade code {A095093C-258B-5ED8-8E7E-48EA16A86CE9}. AGENTS.md records the current brand, shelf FORM layout and explicit-request requirement for restoring a cooldown.

## Remaining limitations

- Standard stereo audio CDs only; data/mixed-mode, pre-emphasis and four-channel discs are rejected. No secure-rip/AccurateRip verification, drive-offset correction or CD-Text. Broader hardware validation, damaged-disc recovery and extraction speed remain unverified beyond the owner's earlier test. Future physical QA requires an authorized isolated library.
- Original WebView2 role-picker STATUS_BREAKPOINT crash was not reproduced by browser stress tests; installed-app confirmation remains needed.

## Retained metadata/account state

- Existing collection/set/work/credit/fold/Undo behavior remains. Discogs 410 083-2 imports track 5a–5j as one **20:26** work/audio slot; Theme and variations inference is present. 028944443028 and 431780-2 regressions pass. Saved CDs are never silently rewritten: rerun lookup and Save.
- Historical 7–20/720-hour policy is superseded by the hosted relaxed-ID migration described above. Change timestamps, unique IDs and restrictive profile deletion remain; the monthly interval is temporarily suspended.
- Owner confirmed hosted Email OTP length **6** on 2026-11-01. Auth API readback and new/existing-user email delivery were not independently verified. Preserve SMTP, expiration and both `{{ .Token }}` templates; client accepts 6–10 digits for already-issued codes. Never log codes, tokens, passwords or privileged keys.
- Other postponed features (AI photos, phone sign-in, domain email, signing, auto-update and other platforms) remain outside this task.
