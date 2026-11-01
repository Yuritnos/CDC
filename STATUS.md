# PMCO current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. Verify git/build state before continuing.

## Current milestone: right-edge timings, monthly User IDs and physical-music subtitle

- Profile work durations now sit at the far right. A one-line title places the info icon immediately before the duration. Wrapped titles place the icon at the top-right and duration at the bottom-right, sharing the same edge. Resize observation switches layouts without changing the reserved title width; removed headings are unobserved. Popups still use the whole heading. Works without durations/icons and physical track timing remain intact.
- Subtitle is **A home for your physical music collection.**, with Japanese/Chinese equivalents. CD remains the only implemented medium; LP, cassette, USB, SD and other media are future work. Brand/version remain **PMCO 0.3.0**.
- User IDs now use **6–20 ASCII letters, digits or underscores** for new/changed IDs. Existing shorter IDs survive unchanged. A **30-day/720-hour cooldown** is restored in client and hosted trigger, retaining timestamps from the relaxed period. No profile history is reset. Nickname/photo updates preserve ID history. The UI shows generic monthly copy only, without exact dates or the nickname sentence; live language changes refresh this notice/error.
- Hosted **profile_handle_monthly** migration is applied to ogpzmnaqybxybybooebi. Readback confirms 6–20 validation, 720-hour rejection, enabled trigger, server-owned timestamps, unchanged unique index and both RLS policies. No owner's rows were edited for verification. Local source: supabase/migrations/20261101120000_profile_handle_monthly.sql; full schema/docs match. Earlier relaxed migration is superseded.
- **47 checks passed:** 17 native Windows CI tests plus 30 focused checks: PostgreSQL rules 6 (including upgrade/fresh schema and the exact 720-hour boundary), mocked account UI 3, tooltips/timing geometry 6, rendering 6 and sections 9. Fixtures never touched real accounts/collections/drives. Screenshots reviewed under installers/qa-monthly-layout/.
- Windows build 40, push, staged verification and local installer replacement are complete; no requested implementation work remains. AGENTS.md reflects the new layout, media scope and ID policy. Hosted Auth email templates/sender/project name remain unchanged. CD-drive import remains local TOC/duration/audio copying only, with no speedup claimed.

## Windows build and installer replacement: PMCO 0.3.0 build 40 complete

- **Build 40 succeeded**, [Actions run 41301144241](https://github.com/Yuritnos/CDC/actions/runs/41301144241), exact app source 7e770103fd64ffad297ec277ece95e061a17071d. Native Windows CI: 17 passed, zero failed. Product/version in both packages is **PMCO 0.3.0**; build 39 is superseded. Subsequent handoff commits change documentation only.
- Downloaded **PMCO-windows** artifact 13081816158; archive SHA-256 24b8174db68a1d8107ac636c59b04fa50ad52267022a6d2815b5b910957a60ff matches GitHub's digest. Both installers passed integrity/extraction, x64 PE/product/version, preserved MSI upgrade code and normalized payload-equivalence checks. All nine bundled FLAC resource files match the pinned resources; both staged encoder runtimes report 1.5.0. Evidence: installers/staging-monthly-layout-41301144241/{artifact,verification,replacement}.json.
- Current NSIS: **installers/nsis/PMCO_0.3.0_x64-setup.exe**, 3,464,001 bytes, SHA-256 10E430290D220E7DA42180F338ABAD26A129E2CE8B66BDEB07AD067C943425C4. Current MSI: **installers/msi/PMCO_0.3.0_x64_en-US.msi**, 4,259,840 bytes, SHA-256 A1A347ACCAB7A676A3C9C53C2CC1501E86780087F53550DDB4EB441D32161A3F. Final copies match staged checksums.
- Verified build-39 installers, exact app source and checksums are saved in **installers/rollback-before-monthly-layout-20261101/**. Earlier rollback folders remain. Package rollback does not roll back the hosted account rules. No collection snapshots, app installation/launch against the owner's library, tags or releases were made.
- Identity retained: com.cdc.collection, storage/session keys, cdc.exe, repository Yuritnos/CDC, legacy NSIS registry keys and MSI upgrade code {A095093C-258B-5ED8-8E7E-48EA16A86CE9}. AGENTS.md records current layout, future-media scope and monthly 6–20-character ID rules.

## Remaining limitations

- Standard stereo audio CDs only; data/mixed-mode, pre-emphasis and four-channel discs are rejected. No secure-rip/AccurateRip verification, drive-offset correction or CD-Text. Broader hardware validation, damaged-disc recovery and extraction speed remain unverified beyond the owner's earlier test. Future physical QA requires an authorized isolated library.
- Original WebView2 role-picker STATUS_BREAKPOINT crash was not reproduced by browser stress tests; installed-app confirmation remains needed.

## Retained metadata/account state

- Existing collection/set/work/credit/fold/Undo behavior remains. Discogs 410 083-2 imports track 5a–5j as one **20:26** work/audio slot; Theme and variations inference is present. 028944443028 and 431780-2 regressions pass. Saved CDs are never silently rewritten: rerun lookup and Save.
- Earlier relaxed-ID policy is superseded by the hosted monthly migration above: new/changed IDs use 6–20 characters; changes require 30 days/720 hours. Existing timestamps and unique IDs/restrictive deletion remain.
- Owner confirmed hosted Email OTP length **6** on 2026-11-01. Auth API readback and new/existing-user email delivery were not independently verified. Preserve SMTP, expiration and both `{{ .Token }}` templates; client accepts 6–10 digits for already-issued codes. Never log codes, tokens, passwords or privileged keys.
- Other postponed features (AI photos, phone sign-in, domain email, signing, auto-update and other platforms) remain outside this task.
