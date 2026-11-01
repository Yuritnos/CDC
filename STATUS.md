# CDshelf current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. Verify git/build state before continuing.

## Current milestone: simplified CD-drive audio import

- Version remains **0.3.0**. CD-drive controls are now inside the editor's folded **Audio** section. Read disc shows physical track counts/durations; Copy audio supports FLAC/default or WAV. Removed the release selector, drive metadata/artwork requests, native MusicBrainz commands and Trial labels. The separate manual/Discogs lookup remains available.
- Copying preserves entered CD details, work/movement names, composer/type/performer overrides and grouping. Existing layouts must have the same audio-slot count as the disc; a work without movements counts as one slot. Successful copying updates physical durations; an empty Works section gets numbered tracks. Read/cancel/failure leaves existing works/durations untouched. Existing audio, staging/recovery and Save/Discard ownership are preserved.
- Standalone/set profiles show **FORM / value** in the same facts layout as performers (localized in Japanese/Chinese). Wrapped profile work titles align the info icon with the first line and duration with the last line; popup placement still uses the entire heading.
- **51 focused browser checks passed:** drive import 15, rendering 5, work tooltips 6, audio drafts 7, unsaved forms 8, sections 9 and set-profile integration 1. Tests use isolated fixtures/mocked services and never touch real drives or the owner's collection/account. Screenshots reviewed in installers/qa-drive-audio/. Windows CI also passed all 17 native tests (68 checks total across these suites); local Rust/MSVC is unavailable.
- Owner's earlier physical-drive test succeeded: roughly 40 minutes of audio imports as FLAC in 3 minutes or more (about 13.3× at 3 minutes). Drive model/exact timing remain unknown. This change removes recognition latency but does not change extraction block sizes or claim a measured ripping speedup. See docs/cd-drive-import.md.

## Windows build and installer replacement: complete

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
- Hosted `20261101_profile_handle_rules.sql` is applied to Supabase `ogpzmnaqybxybybooebi`: 7–20 ASCII letters/digits/underscores for new/changed IDs, 30 days/720 hours between changes, server timestamp and restrictive delete policy. Legacy shorter IDs survive nickname/photo edits. No additional database changes in 0.3.0.
- Owner confirmed hosted Email OTP length **6** on 2026-11-01. Auth API readback and new/existing-user email delivery were not independently verified. Preserve SMTP, expiration and both `{{ .Token }}` templates; client accepts 6–10 digits for already-issued codes. Never log codes, tokens, passwords or privileged keys.
- Other postponed features (AI photos, phone sign-in, domain email, signing, auto-update and other platforms) remain outside this task.
