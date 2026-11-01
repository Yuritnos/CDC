# CD-drive import: implementation proposal

Assessment: 2026-11-01. This is a design proposal; drive detection and ripping are
not implemented by the profile Form-label change.

## What can be implemented

A Windows-first import flow can enumerate optical drives, detect an audio disc,
read its table of contents (track count, start sectors and durations), identify
candidate releases, extract the digital audio, and save a CD with its local audio
already linked to physical track numbers. Metadata review fits the existing CD
editor and lookup confirmation behavior. Playback and local audio storage already
exist in CDshelf; reading and encoding audio from an optical drive do not.

Windows provides
[TOC queries](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddcdrm/ni-ntddcdrm-ioctl_cdrom_read_toc_ex)
and [raw CDDA reads](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddcdrm/ni-ntddcdrm-ioctl_cdrom_raw_read).
[MusicBrainz disc-ID/TOC lookup](https://musicbrainz.org/doc/MusicBrainz_API#discid)
returns candidate releases, including fuzzy TOC matches. It does not guarantee one
exact edition. Artwork, composers, work groupings, performers and physical-edition
details depend on available metadata. Optional CD-Text can supplement the lookup;
absence of text must still allow a draft with numbered tracks and measured times.
Do not infer a printed matrix code or exact pressing from track layout alone.

## Suggested first version

1. Add **Add from CD drive** to the Add a CD flow. List drives and show no-drive,
   empty-tray, unsupported-disc and read-error states. Disc insertion can update
   the UI, but copying begins only after the user chooses Import.
2. Read the TOC, calculate a MusicBrainz disc ID, then show release candidates with
   disc number, track layout and cover. Keep manual/Discogs lookup available.
   Cache responses and honor MusicBrainz's proper User-Agent and one-request-per-
   second policy. Standard public lookups do not require a user account.
3. Let the user review works, movement boundaries, credits and set membership.
   Preserve one extracted file per physical CD track even when a track contains
   multiple variations or metadata work boundaries differ.
4. Extract audio to a job-specific staging directory. Recommend
   [FLAC](https://xiph.org/flac/) as the default lossless format, with WAV optional.
   Bundle the selected encoder/native library after reviewing its distribution
   requirements; users should not need a separate ripper or a PATH setup.
5. Show track/disc progress, cancel, retry and actionable read failures. Detect
   ejection/disconnection/disc replacement. Never continue using an old TOC after
   the media changes. Move completed files into the existing audio library only
   when the CD is saved; cleanup must respect drafts, Undo and existing files.
6. Save through Store/native atomic persistence. Only metadata syncs; extracted
   audio stays local. An offline import can use numbered tracks and be enriched
   by a later lookup.

## Backend and quality work

- Add a Windows-only Rust module, narrowly scoped Tauri commands for drive/TOC
  discovery, and a background import job with progress/cancellation. Accept an
  enumerated device ID and validated track selections; never a caller-supplied
  arbitrary device path, shell command or output path.
- Bound reads to the selected audio track sectors. Reject data tracks. Validate
  sector counts, output sizes and free space. Handle partial reads and use
  temporary files plus atomic completion. Keep the UI responsive.
- Pick and validate the extraction backend and FLAC encoder before presenting
  the feature as ready. Windows raw reads alone do not establish secure-ripping
  quality. Read-error retries, jitter/overlap handling and drive offsets need
  explicit treatment; AccurateRip-style independent verification can follow.
- Preserve current saved-data compatibility. No change to the collection/account
  identity or cloud audio policy is needed. Keep operational drive/job state out
  of synced collection metadata.

## Preparation and verification

For hardware validation, use a Windows computer with a working USB or internal
CD/DVD drive that reads audio CDs, and permission to import test discs into an
isolated library. Use ordinary multi-track and classical discs, an unmatched
disc, a data/mixed-mode disc, and damaged media if available. Exercise multiple
drives, no disc, ejection, USB unplugging, disc replacement, cancellation, low
disk space, failed encoding, save failure and restart cleanup. Do not test writes
against the owner's collection/account.

Check sector-to-duration calculations, disc-ID fixtures, track mapping and cleanup
with mocked devices first; then compare extracted PCM/checksums with a trusted
reference on physical hardware. Exact pressing identification, reliable recovery
of every damaged disc and independently verified secure rips are separate from
the initial functional importer. Extraction speed varies by drive and disc and
should be measured rather than promised.

User preparation is a compatible drive, test discs and local disk space; internet
is needed for online identification/artwork, but not raw audio extraction.
FLAC is the proposed default; final secure-ripping guarantees depend on backend
selection and hardware verification.
