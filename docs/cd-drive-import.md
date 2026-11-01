# CD-drive audio import: 0.3.0

The Windows CD editor's **Audio** section includes **Add from CD drive**.
Read disc shows physical track count and durations. Choose FLAC (default) or WAV,
then Copy audio and Save the CD. The drive does not identify releases, titles,
composers, performers, artwork or other metadata; no online request is made.
Manual editing and the separate Discogs lookup remain available.

Copying preserves entered CD details, work titles, movement titles and credits.
If the editor already has works, their audio-slot count must match the physical
disc before copying; work-only entries count as one slot. Successful copying
updates physical durations in the existing layout. An empty Works section gets
numbered tracks. Reading, cancellation and copying failures do not overwrite the
editor's works or durations. Existing audio is protected from replacement.

## Implementation and safety

- The native CD-drive module enumerates optical drive letters, validates the
  table of contents and uses a layout fingerprint to detect disc changes.
- Standard stereo audio CDs only. Data/mixed-mode, pre-emphasis and four-channel
  discs are rejected. Bounded CDDA reads, retries, media locking/change checks,
  cancellation, free-space checks and FLAC verification are retained.
- FLAC 1.5.0 encoder, corresponding source and license notices are bundled from
  checksum-pinned official Xiph archives. npm run prepare:windows prepares
  resources locally; Windows CI prepares them before native tests and packaging.
- Jobs stage in their own folders. Completed files are adopted into the existing
  editor's audio draft. Save failure retains the draft for retry; Discard removes
  only newly copied files. Restart recovery checks current/previous/daily backups
  before deleting validated importer-owned unreferenced files. Audio stays local.
- No secure-rip/AccurateRip verification, drive-offset correction or CD-Text.
  Read-error recovery and speed vary by drive and disc.

## Verification and hardware baseline

Automated tests use isolated collections and mocked devices/network services;
they never enumerate real drives or touch the owner's collection/account.
Native tests cover TOC timings/fingerprints, exact PCM boundaries, retries,
cancellation, safe recovery and FLAC encode/decode equality. UI tests cover
metadata preservation, physical-slot mapping, mismatched counts, save/discard,
late responses, cancellation, failures and all three locales.

The owner confirmed physical-drive import succeeded on 2026-11-01: roughly
40 minutes of audio takes about 3 minutes or more in FLAC (about 13.3× real-time
at 3 minutes). Drive model/exact timing and broader hardware validation remain
unknown. No extraction-speed optimization is included in this simplification;
the online recognition step has been removed. Future hardware QA should use an
authorized isolated library and cover multiple drives, ejection/unplugging,
disc replacement, damaged media, low disk space and restart cleanup.
