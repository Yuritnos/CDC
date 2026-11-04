# PMCO current status

Updated: 2026-11-04 (Asia/Shanghai). Read `AGENTS.md` for project rules. Verify git/build state before continuing.

## Current milestone: editor control refinements implemented; Windows build pending

- Implemented all eight latest screenshot requests. Vinyl A/B buttons fill a full row; each side owns edit/delete controls, renaming opens an inline field on demand, and the last side cannot be deleted. Existing staged deletion/audio remapping remains. Vinyl colour suggestions consistently identify the carrier (Black/Coloured/Clear/Red/Blue vinyl in English).
- Sets use the top Title for the whole release. Separate Set name and media-checkbox controls are removed. Each item-selection button has an inline edit control for its own medium and optional name, saved as set.subtitle. Opening/switching alone is clean. Save synchronizes component titles and set.title; former distinct component titles survive as item names. Works, audio, physical details and set extensions remain independent and preserved.
- Undivided cassette/DVD/Blu-ray/Other works have a printed-position field before the work title (`work.position`). The position and duration transfer to the first track and back when its last track is removed; profiles/audio assignments keep the label and global numeric slots. CD/SACD/Vinyl continue their existing number/side behavior.
- Catalogue number now sits immediately above Barcode/Matrix for every medium and uses UCCS-50032/3 as its example. Matrix uses 410 084-2. Recording venue and Audio technology share one row; the SPARS explanation is removed. Other physical-detail fields and custom-medium/item names have localized examples and remain free input.
- Medium filtering exists only in All music. Collection/Favorites retain composer, performer and work-type filters, with media chosen in the sidebar. Statistics media links navigate to the matching sidebar view. Music filtering still preserves queue, playback and playlists.
- **130 unique browser checks passed:** collection integration 38, physical media 17, media editor 18, lookup normalization 17, form sections 9, audio drafts 7, unsaved forms 8, work inheritance 10, rendering 6. Updated old expectations for shared titles/inline controls and retained metadata checks. Tests use isolated fixtures and mocked account/native services, never the owner’s collection/account/drives. Visual/geometry checks cover en/ja/zh, light/dark and 1280/375px; evidence: installers/qa-editor-controls/.
- User authorized Windows build. Version remains 0.3.0; build/download/verification follows. Current delivered installers are build 43 below. AGENTS.md records the new title/item/side/filter rules. No hosted/account/schema changes.

## Windows build and installer replacement: PMCO 0.3.0 build 43 complete

- **Build 43 succeeded**, [Actions run 41831340177](https://github.com/Yuritnos/CDC/actions/runs/41831340177), source **d08512db673f9d0649377554afae22e6006fdc3b**. Native Windows CI: **21 passed, zero failed**. Both packages retain PMCO 0.3.0, x64 architecture and legacy upgrade identity.
- Downloaded **PMCO-windows** artifact **13323680339**, ZIP **7,543,687 bytes**, SHA-256 **94372f1269cccf4351c50315fb7bcc38fafabe374386fd81d335bc3059e52599**, matching GitHub’s digest. Both installers passed integrity/extraction, x64 PE/product/version, MSI upgrade-code and normalized payload-equivalence checks. All nine FLAC resources match between packages; encoder/DLL/source archive match the pinned originals. Both staged FLAC runtimes report 1.5.0. Evidence: installers/staging-request-3.1-41831340177/{artifact,verification,replacement}.json and build.log.
- Current NSIS: **installers/nsis/PMCO_0.3.0_x64-setup.exe**, **3,479,793 bytes**, SHA-256 **9C49B29C8B1CC9FA7D39E58EF5DD168C55F5D9BBCD4BE9C6FBDA62E67A938E17**. Current MSI: **installers/msi/PMCO_0.3.0_x64_en-US.msi**, **4,284,416 bytes**, SHA-256 **1F08E9B66E5FD9F1D1F0215BA63BA40CA6A09E241EB61BF816FC14A6026B2529**. Final copies match staging.
- Verified build-42 installers, checksums and exact app-source ZIP (**2b36e919cafc1355df53dc9ac7b0d9f09e7ea322**) are preserved in **installers/rollback-before-request-3.1-20261104/**. Earlier rollback folders remain. No collection snapshots, app installation, tags or releases were made.
- Identity retained: com.cdc.collection, storage/session keys, cdc.exe, repository Yuritnos/CDC, legacy NSIS registry keys and MSI upgrade code **{A095093C-258B-5ED8-8E7E-48EA16A86CE9}**. Native folder import, CD extraction and metadata-only account sync are unchanged. Final app HTML SHA-256: **E7D4390AAF7875FD828856C1878A9AF506ED6F1D6BC8C385E1DE31559ADEFD72**.

## Remaining limitations

- Playback uses the existing supported local audio formats (MP3/FLAC/WAV/M4A/AAC/Ogg/Opus) and WebView codecs. SACD extraction, DSD decoding, new multichannel decoding and DVD/Blu-ray video playback were not requested in the selected audio scope and are not added. Folder import is not a live link to a removable device. Ambiguous Discogs component/USB/SD descriptions still require review.
- Native drive extraction supports standard stereo audio CDs only; data/mixed-mode, pre-emphasis and four-channel discs are rejected. No secure-rip/AccurateRip verification, drive-offset correction or CD-Text. Broader hardware validation, damaged-disc recovery and extraction speed remain unverified beyond the owner's earlier test. Future physical QA requires an authorized isolated library.
- Original WebView2 role-picker STATUS_BREAKPOINT crash was not reproduced by browser stress tests; installed-app confirmation remains needed.

## Retained metadata/account state

- Existing collection/set/work/credit/fold/Undo behavior remains. Discogs 410 083-2 imports track 5a–5j as one **20:26** work/audio slot; Theme and variations inference is present. 028944443028 and 431780-2 regressions pass. Saved CDs are never silently rewritten: rerun lookup and Save.
- Earlier relaxed-ID policy is superseded by the hosted monthly policy: new/changed IDs use 6–20 characters; changes require 30 days/720 hours. Existing timestamps and unique IDs/restrictive deletion remain.
- Owner confirmed hosted Email OTP length **6** on 2026-11-01. Auth API readback and new/existing-user email delivery were not independently verified. Preserve SMTP, expiration and both `{{ .Token }}` templates; client accepts 6–10 digits for already-issued codes. Never log codes, tokens, passwords or privileged keys.
- Other postponed features (AI photos, phone sign-in, domain email, signing, auto-update and other platforms) remain outside this task.
