# PMCO current status

Updated: 2026-11-04 (Asia/Shanghai). Read `AGENTS.md` for project rules. Verify git/build state before continuing.

## Current milestone: request 3.1 implemented and validated; Windows build pending

- Implemented the 16 requests in the owner’s PMCO改进建议3.1 document. Mixed vinyl/CD lookup now resolves plain numeric and CD-prefixed tracks to the CD component instead of inheriting the previous vinyl item. The reported barcode 9787884182411 is covered by a representative mocked regression; its live Discogs response was not independently retrieved. Existing lookup/credit regressions remain intact.
- Catalogue number and matrix/runout are independent fields for every medium; vinyl’s matrix/runout sits to the right of Barcode. Existing combined catalogue values are not guessed or split automatically. Condition and capacity controls/facts are removed while historical saved values survive unrelated edits and JSON roundtrips. Audio technology (formerly Production technique) is available for all media; Audio programs is renamed Audio channels.
- Membership precedes medium. Standalone has one format; sets offer multiple media below Set name, Add item starts with an unused selected format, and each item retains its exact format. Information/detail headings follow the format or custom Other name. Vinyl size/speed/colour and cassette type/noise reduction offer common suggestions plus free input; old printed-position hint is removed.
- Vinyl has editable A/B side tabs, staged side deletion and Add second side. Works/tracks belong to a side; numbering starts at 1 on each side and undivided works count as a track without a visible work number. Audio retains global numeric slots. Removing a side retains files, unassigns its audio and remaps surviving slots. Side/item switches preserve drafts and do not count as edits. Legacy printed positions are interpreted for editing/display only until Save; C/D on a second record becomes local A/B, preserving audio and credits.
- Composer filter sorts by initial letter and work types by localized displayed name; medium/performer ordering is unchanged. Custom ordering now works within every medium view and moves complete mixed releases in All media while preserving hidden releases’ relative order. Search/filter still disables arranging.
- Browser validation: collection integration 38, lookup normalization 17, physical media 17, new media editor 13, form sections 9, audio drafts 7, rendering 6, work form 8, unsaved form 8: **123 passed**. Isolated fixtures/mocked accounts/native files only; no owner library/account/drives touched. Screenshots and final source evidence are in installers/qa-request-3.1/.
- Version remains 0.3.0. User authorized Windows build and download; code review/checks are complete, build/installer verification follows. Build 42 below remains installed-package delivery until replacement succeeds.

## Windows build and installer replacement: PMCO 0.3.0 build 42 complete

- **Build 42 succeeded**, [Actions run 41481474438](https://github.com/Yuritnos/CDC/actions/runs/41481474438), exact app source **2b36e919cafc1355df53dc9ac7b0d9f09e7ea322**. Native Windows CI: **21 passed, zero failed**. Product/version in both packages remains **PMCO 0.3.0**; build 41 is superseded.
- Downloaded **PMCO-windows** artifact **13160357075**. ZIP SHA-256 **1886ce6d99faf3bec6e9948ac5c38e43d028a3e544edb8791d93854c9becb94c** matches GitHub's digest. Both installers passed integrity/extraction, x64 PE/product/version, MSI upgrade-code and normalized payload-equivalence checks. All nine FLAC resources match between packages; encoder/DLL/source archive match the pinned originals. Both staged FLAC runtimes report 1.5.0. Evidence: installers/staging-media-refinements-41481474438/{artifact,verification,replacement}.json and build.log.
- Current NSIS: **installers/nsis/PMCO_0.3.0_x64-setup.exe**, **3,476,957 bytes**, SHA-256 **117E790D09EE143F0163D26119B5079A71EF6CFD066598E46F587B131DA17CEB**. Current MSI: **installers/msi/PMCO_0.3.0_x64_en-US.msi**, **4,280,320 bytes**, SHA-256 **B7556BFA50EBE090D32A9D1744102F441E8359DF8B7762F51C2E69F1F0DF6F29**. Final copies match staging.
- Verified build-41 installers, checksums and exact app-source ZIP (**50368d5fd9378c6fca10d86b110a4b20cce099cc**) are preserved in **installers/rollback-before-media-refinements-20261103/**. Earlier rollback folders remain. No collection snapshots, app installation, tags or releases were made.
- Identity retained: com.cdc.collection, storage/session keys, cdc.exe, repository Yuritnos/CDC, legacy NSIS registry keys and MSI upgrade code **{A095093C-258B-5ED8-8E7E-48EA16A86CE9}**. Native folder import, CD extraction and metadata-only account sync behavior are unchanged from build 41. AGENTS.md records the current navigation, filters, Statistics and queue-tip rules.

## Remaining limitations

- Playback uses the existing supported local audio formats (MP3/FLAC/WAV/M4A/AAC/Ogg/Opus) and WebView codecs. SACD extraction, DSD decoding, new multichannel decoding and DVD/Blu-ray video playback were not requested in the selected audio scope and are not added. Folder import is not a live link to a removable device. Ambiguous Discogs component/USB/SD descriptions still require review.
- Native drive extraction supports standard stereo audio CDs only; data/mixed-mode, pre-emphasis and four-channel discs are rejected. No secure-rip/AccurateRip verification, drive-offset correction or CD-Text. Broader hardware validation, damaged-disc recovery and extraction speed remain unverified beyond the owner's earlier test. Future physical QA requires an authorized isolated library.
- Original WebView2 role-picker STATUS_BREAKPOINT crash was not reproduced by browser stress tests; installed-app confirmation remains needed.

## Retained metadata/account state

- Existing collection/set/work/credit/fold/Undo behavior remains. Discogs 410 083-2 imports track 5a–5j as one **20:26** work/audio slot; Theme and variations inference is present. 028944443028 and 431780-2 regressions pass. Saved CDs are never silently rewritten: rerun lookup and Save.
- Earlier relaxed-ID policy is superseded by the hosted monthly policy: new/changed IDs use 6–20 characters; changes require 30 days/720 hours. Existing timestamps and unique IDs/restrictive deletion remain.
- Owner confirmed hosted Email OTP length **6** on 2026-11-01. Auth API readback and new/existing-user email delivery were not independently verified. Preserve SMTP, expiration and both `{{ .Token }}` templates; client accepts 6–10 digits for already-issued codes. Never log codes, tokens, passwords or privileged keys.
- Other postponed features (AI photos, phone sign-in, domain email, signing, auto-update and other platforms) remain outside this task.
