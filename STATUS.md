# CDshelf current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. Verify git/build state before continuing.

## Current milestone: simplified CD-drive audio import

- Version remains **0.3.0**. CD-drive controls are now inside the editor's folded **Audio** section. Read disc shows physical track counts/durations; Copy audio supports FLAC/default or WAV. Removed the release selector, drive metadata/artwork requests, native MusicBrainz commands and Trial labels. The separate manual/Discogs lookup remains available.
- Copying preserves entered CD details, work/movement names, composer/type/performer overrides and grouping. Existing layouts must have the same audio-slot count as the disc; a work without movements counts as one slot. Successful copying updates physical durations; an empty Works section gets numbered tracks. Read/cancel/failure leaves existing works/durations untouched. Existing audio, staging/recovery and Save/Discard ownership are preserved.
- Standalone/set profiles show **FORM / value** in the same facts layout as performers (localized in Japanese/Chinese). Wrapped profile work titles align the info icon with the first line and duration with the last line; popup placement still uses the entire heading.
- **51 focused browser checks passed:** drive import 15, rendering 5, work tooltips 6, audio drafts 7, unsaved forms 8, sections 9 and set-profile integration 1. Tests use isolated fixtures/mocked services and never touch real drives or the owner's collection/account. Screenshots reviewed in installers/qa-drive-audio/. Native checks will run in Windows CI; local Rust/MSVC is unavailable.
- Owner's earlier physical-drive test succeeded: roughly 40 minutes of audio imports as FLAC in 3 minutes or more (about 13.3× at 3 minutes). Drive model/exact timing remain unknown. This change removes recognition latency but does not change extraction block sizes or claim a measured ripping speedup. See docs/cd-drive-import.md.

## Windows build and installer replacement: requested update pending

- New source is ready for an authorized manual Windows build and staged installer verification/replacement. The packages below remain the previous build until replacement finishes.

- **Build 37 succeeded**, [Actions run 41275102283](https://github.com/Yuritnos/CDC/actions/runs/41275102283), source `5be7140e431af892e434b00b0ff024d9a80617eb`. Final Windows CI reports 18 native tests passed, zero failed. Intermediate builds 35/36 are superseded.
- Downloaded `CDshelf-windows` archive SHA-256 `79081696dd7d6a5d9f043ff5444b0fd5432e8bc355924949cd60dd87ade8a168` matches GitHub's artifact digest. Both installers passed integrity/extraction, x64 PE/product/version, preserved MSI upgrade-code and app-payload-equivalence checks. All nine FLAC resource files matched between packages, official binary/source hashes matched, and both staged encoder runtimes reported 1.5.0. Evidence: `installers/staging-drive-trial-41275102283/{artifact,verification,replacement}.json`.
- Replaced current local packages: `installers/nsis/CDshelf_0.3.0_x64-setup.exe` (3,496,746 bytes, SHA-256 `DED47D2C12375DD1E524412EED6593DD716E082802F1FAB8BED72F262C90F803`) and `installers/msi/CDshelf_0.3.0_x64_en-US.msi` (4,300,800 bytes, SHA-256 `C9B432C652D33A59D10184055AE263F7E27E34A6974291BCB0C94FDD3888F8B0`). Old package filenames were removed only after new copies and rollback copies passed checksums.
- Verified 0.2.0/build-34 installers, source archive and hashes remain in `installers/rollback-before-drive-trial-20261101/`. Earlier rollback folders remain. No owner collection snapshots were created/restored; no application installation or launch against the owner's library, tags or releases.
- Identity retained: `com.cdc.collection`, existing storage/session keys, Rust binary `cdc.exe`, repository `Yuritnos/CDC`, legacy NSIS registry keys and MSI upgrade code `{A095093C-258B-5ED8-8E7E-48EA16A86CE9}`.

## Remaining limitations

- Standard stereo audio CDs only; data/mixed-mode, pre-emphasis and four-channel discs are rejected. No secure-rip/AccurateRip verification, drive-offset correction or CD-Text. Broader hardware validation, damaged-disc recovery and extraction speed remain unverified beyond the owner's earlier test. Future physical QA requires an authorized isolated library.
- Original WebView2 role-picker STATUS_BREAKPOINT crash was not reproduced by browser stress tests; installed-app confirmation remains needed.

## Retained metadata/account state

- Existing collection/set/work/credit/fold/Undo behavior remains. Discogs 410 083-2 imports track 5a–5j as one **20:26** work/audio slot; Theme and variations inference is present. 028944443028 and 431780-2 regressions pass. Saved CDs are never silently rewritten: rerun lookup and Save.
- Hosted `20261101_profile_handle_rules.sql` is applied to Supabase `ogpzmnaqybxybybooebi`: 7–20 ASCII letters/digits/underscores for new/changed IDs, 30 days/720 hours between changes, server timestamp and restrictive delete policy. Legacy shorter IDs survive nickname/photo edits. No additional database changes in 0.3.0.
- Owner confirmed hosted Email OTP length **6** on 2026-11-01. Auth API readback and new/existing-user email delivery were not independently verified. Preserve SMTP, expiration and both `{{ .Token }}` templates; client accepts 6–10 digits for already-issued codes. Never log codes, tokens, passwords or privileged keys.
- Other postponed features (AI photos, phone sign-in, domain email, signing, auto-update and other platforms) remain outside this task.
