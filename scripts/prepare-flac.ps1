$ErrorActionPreference = 'Stop'
# Official Xiph release, pinned archive. Includes runtime DLL and redistribution texts.
$archiveHash = '53F1500F0D6E7C61379D7FEE50D4A9F7F504C650009506D9BA015530D76C0DDE'
$taskRoot = Join-Path ([IO.Path]::GetTempPath()) ('cdshelf-flac-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $taskRoot | Out-Null
try {
  $archive = Join-Path $taskRoot 'flac.zip'
  Invoke-WebRequest 'https://github.com/xiph/flac/releases/download/1.5.0/flac-1.5.0-win.zip' -OutFile $archive
  if ((Get-FileHash -LiteralPath $archive).Hash -ne $archiveHash) { throw 'FLAC archive checksum mismatch.' }
  Expand-Archive -LiteralPath $archive -DestinationPath $taskRoot
  $source = Join-Path $taskRoot 'flac-1.5.0-win'
  $target = Join-Path $PSScriptRoot '../src-tauri/resources/flac'
  New-Item -ItemType Directory -Force -Path $target | Out-Null
  foreach ($file in @('flac.exe', 'libFLAC.dll')) { Copy-Item -LiteralPath (Join-Path $source "Win64/$file") -Destination $target -Force }
  foreach ($file in @('AUTHORS','COPYING.GPL','COPYING.LGPL','COPYING.Xiph','README-for-these-builds.txt')) { Copy-Item -LiteralPath (Join-Path $source $file) -Destination $target -Force }
  $sourceArchive = Join-Path $taskRoot 'flac-1.5.0.tar.xz'
  Invoke-WebRequest 'https://github.com/xiph/flac/releases/download/1.5.0/flac-1.5.0.tar.xz' -OutFile $sourceArchive
  if ((Get-FileHash -LiteralPath $sourceArchive).Hash -ne 'F2C1C76592A82FFFF8413BA3C4A1299B6C7AB06C734DEE03FD88630485C2B920') { throw 'FLAC source checksum mismatch.' }
  Copy-Item -LiteralPath $sourceArchive -Destination $target -Force
  # The pinned release source remains available with the distributed license notices.
  @'
FLAC 1.5.0 by Xiph.Org, bundled unchanged from the official Windows release.
Source (same version): https://github.com/xiph/flac/releases/download/1.5.0/flac-1.5.0.tar.xz
Release: https://github.com/xiph/flac/releases/tag/1.5.0
See COPYING.GPL, COPYING.LGPL, COPYING.Xiph and AUTHORS in this folder.
'@ | Set-Content -LiteralPath (Join-Path $target 'SOURCE.txt') -Encoding utf8
  & (Join-Path $target 'flac.exe') --version
  if ($LASTEXITCODE -ne 0) { throw 'Bundled FLAC could not run.' }
} finally {
  $resolved = [IO.Path]::GetFullPath($taskRoot)
  $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  if (-not $resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or -not (Split-Path $resolved -Leaf).StartsWith('cdshelf-flac-')) { throw 'Unexpected temporary directory.' }
  Remove-Item -LiteralPath $resolved -Recurse -Force
}
