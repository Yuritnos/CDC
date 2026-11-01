# PMCO current status

Updated: 2026-11-01 (Asia/Shanghai). Read `AGENTS.md` for project rules. Verify git/build state before continuing.

## Current milestone: right-edge timings, monthly User IDs and physical-music subtitle

- Profile work durations now sit at the far right. A one-line title places the info icon immediately before the duration. Wrapped titles place the icon at the top-right and duration at the bottom-right, sharing the same edge. Resize observation switches layouts without changing the reserved title width; removed headings are unobserved. Popups still use the whole heading. Works without durations/icons and physical track timing remain intact.
- Subtitle is **A home for your physical music collection.**, with Japanese/Chinese equivalents. CD remains the only implemented medium; LP, cassette, USB, SD and other media are future work. Brand/version remain **PMCO 0.3.0**.
- User IDs now use **6–20 ASCII letters, digits or underscores** for new/changed IDs. Existing shorter IDs survive unchanged. A **30-day/720-hour cooldown** is restored in client and hosted trigger, retaining timestamps from the relaxed period. No profile history is reset. Nickname/photo updates preserve ID history. The UI shows generic monthly copy only, without exact dates or the nickname sentence; live language changes refresh this notice/error.
- Hosted **profile_handle_monthly** migration is applied to ogpzmnaqybxybybooebi. Readback confirms 6–20 validation, 720-hour rejection, enabled trigger, server-owned timestamps, unchanged unique index and both RLS policies. No owner's rows were edited for verification. Local source: supabase/migrations/20261101120000_profile_handle_monthly.sql; full schema/docs match. Earlier relaxed migration is superseded.
- **30 focused checks passed:** PostgreSQL rules 6 (including upgrade/fresh schema and the exact 720-hour boundary), mocked account UI 3, tooltips/timing geometry 6, rendering 6 and sections 9. Fixtures never touched real accounts/collections/drives. Screenshots reviewed under installers/qa-monthly-layout/; an initial resize-test title fit on one line at the assumed breakpoint, so that fixture was lengthened to exercise an actual wrap transition.
- Authorized Windows build/push/staged verification/replacement is pending; current installer details below are the previous build. AGENTS.md reflects the new layout, media scope and ID policy. Hosted Auth email templates/sender/project name remain unchanged. CD-drive import remains local TOC/duration/audio copying only, with no speedup claimed.

## Previous packaged build: PMCO 0.3.0 build 39 (replacement pending)

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
- Earlier relaxed-ID policy is superseded by the hosted monthly migration above: new/changed IDs use 6–20 characters; changes require 30 days/720 hours. Existing timestamps and unique IDs/restrictive deletion remain.
- Owner confirmed hosted Email OTP length **6** on 2026-11-01. Auth API readback and new/existing-user email delivery were not independently verified. Preserve SMTP, expiration and both `{{ .Token }}` templates; client accepts 6–10 digits for already-issued codes. Never log codes, tokens, passwords or privileged keys.
- Other postponed features (AI photos, phone sign-in, domain email, signing, auto-update and other platforms) remain outside this task.
