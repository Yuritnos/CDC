//! A computer-local audio location. Absolute paths never enter collection metadata or sync.
use std::{fs, io::Read, path::{Component, Path, PathBuf}, time::{SystemTime, UNIX_EPOCH}};
use serde_json::json;
const CONFIG: &str = "audio-location.json";

fn linked(meta: &fs::Metadata) -> bool {
    if meta.file_type().is_symlink() { return true; }
    #[cfg(windows)] {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 { return true; }
    }
    false
}

fn regular_path(path: &Path) -> Result<(), String> {
    for part in path.ancestors() {
        match fs::symlink_metadata(part) {
            Ok(meta) if linked(&meta) => return Err("Choose a folder without links or junctions.".into()),
            Ok(_) => {},
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {},
            Err(_) => return Err("The audio folder is unavailable.".into()),
        }
    }
    Ok(())
}

pub fn root(data: &Path) -> Result<PathBuf, String> {
    let path = match fs::read(data.join(CONFIG)) {
        Ok(bytes) => {
            let doc: serde_json::Value = serde_json::from_slice(&bytes).map_err(|_| "The audio folder setting could not be read.")?;
            let path = PathBuf::from(doc["path"].as_str().ok_or("The audio folder setting could not be read.")?);
            // Never recreate an unavailable external location as an empty library.
            if !path.is_absolute() || !path.is_dir() { return Err("The audio folder is unavailable. Reconnect the drive and try again.".into()); }
            path
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            let path = data.join("audio"); regular_path(&path)?;
            fs::create_dir_all(&path).map_err(|_| "Could not create the audio folder.")?; path
        },
        Err(_) => return Err("The audio folder setting could not be read.".into()),
    };
    regular_path(&path)?;
    path.canonicalize().map_err(|_| "The audio folder is unavailable.".into())
}

pub fn join(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let rel = Path::new(relative);
    if rel.as_os_str().is_empty() || !rel.components().all(|c| matches!(c, Component::Normal(_))) || relative.contains(':') {
        return Err("That is not a file in the audio library.".into());
    }
    let path = root.join(rel); regular_path(&path)?; Ok(path)
}

fn identical(a: &Path, b: &Path) -> Result<bool, String> {
    let mut a = fs::File::open(a).map_err(|_| "Could not verify the audio copy.")?;
    let mut b = fs::File::open(b).map_err(|_| "Could not verify the audio copy.")?;
    let mut left = [0u8; 65536]; let mut right = [0u8; 65536];
    loop {
        let n = a.read(&mut left).map_err(|_| "Could not verify the audio copy.")?;
        // read_exact avoids assuming matching read chunk sizes.
        b.read_exact(&mut right[..n]).map_err(|_| "Could not verify the audio copy.")?;
        if left[..n] != right[..n] { return Ok(false); }
        if n == 0 { return b.read(&mut right[..1]).map(|n| n == 0).map_err(|_| "Could not verify the audio copy.".into()); }
    }
}

pub fn copy_file(source: &Path, target: &Path) -> Result<(), String> {
    regular_path(source)?; regular_path(target)?;
    let mut input = fs::File::open(source).map_err(|_| "Could not read the audio file.")?;
    let mut output = fs::OpenOptions::new().write(true).create_new(true).open(target).map_err(|_| "Could not create the audio copy.")?;
    let result = std::io::copy(&mut input, &mut output).and_then(|_| output.sync_all());
    drop(output);
    if result.is_err() || !identical(source, target).unwrap_or(false) {
        let _ = fs::remove_file(target); return Err("Could not verify the audio copy.".into());
    }
    Ok(())
}

pub fn relocate<F: FnOnce(&Path) -> Result<(), String>>(data: &Path, parent: &Path, allow: F) -> Result<PathBuf, String> {
    regular_path(parent)?;
    let parent = parent.canonicalize().map_err(|_| "Choose an available folder.")?;
    let source = root(data)?;
    let target = parent.join("PMCO Audio"); regular_path(&target)?;
    if source == target { return Ok(source); }
    let data = data.canonicalize().map_err(|_| "Could not read the app folder.")?;
    if target.starts_with(&source) || source.starts_with(&target) || target.starts_with(&data) || data.starts_with(&target) {
        return Err("Choose a folder outside the current library and app data.".into());
    }
    if target.exists() {
        let mut entries = fs::read_dir(&target).map_err(|_| "Choose a folder with an empty PMCO Audio subfolder.")?;
        if entries.next().is_some() { return Err("Choose a folder with an empty PMCO Audio subfolder.".into()); }
    }
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|_| "Could not change the audio folder.")?.as_nanos();
    let stage = parent.join(format!(".pmco-audio-{stamp}"));
    fs::create_dir(&stage).map_err(|_| "Could not create the audio folder.")?;
    let result = (|| {
        let mut pending = vec![(source.clone(), PathBuf::new(), 0usize)]; let mut count = 0usize;
        while let Some((dir, rel, depth)) = pending.pop() {
            for entry in fs::read_dir(dir).map_err(|_| "Could not read the audio library.")? {
                let entry = entry.map_err(|_| "Could not read the audio library.")?;
                count += 1; if count > 500_000 { return Err("The audio library has too many files.".into()); }
                let meta = fs::symlink_metadata(entry.path()).map_err(|_| "Could not read the audio library.")?;
                if linked(&meta) { return Err("The audio library contains a link or junction.".into()); }
                let next = rel.join(entry.file_name()); let destination = stage.join(&next);
                if meta.is_dir() {
                    if depth >= 16 { return Err("The audio library has too many nested folders.".into()); }
                    fs::create_dir(&destination).map_err(|_| "Could not copy the audio library.")?;
                    pending.push((entry.path(), next, depth + 1));
                } else if meta.is_file() { copy_file(&entry.path(), &destination)?; }
                else { return Err("The audio library contains an unsupported file.".into()); }
            }
        }
        if target.exists() { fs::remove_dir(&target).map_err(|_| "The destination folder is no longer empty.")?; }
        fs::rename(&stage, &target).map_err(|_| "Could not finish the audio copy.")?;
        allow(&target)?;
        // The complete verified copy exists before changing the local setting.
        super::storage::atomic_write(&data.join(CONFIG), &json!({"path": target}))?;
        Ok(target.clone())
    })();
    if stage.exists() && stage.parent() == Some(parent.as_path()) && regular_path(&stage).is_ok() {
        let _ = fs::remove_dir_all(&stage); // Only this invocation's newly-created staging tree.
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn relocation_preserves_originals_and_relative_paths_and_rejects_unsafe_destinations() {
        let base = std::env::temp_dir().join(format!("pmco-location-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        let data = base.join("data"); let dest = base.join("chosen"); fs::create_dir_all(&data).unwrap(); fs::create_dir(&dest).unwrap();
        let old = root(&data).unwrap(); fs::create_dir(old.join("disc")).unwrap(); fs::write(old.join("disc/test.flac"), b"audio fixture").unwrap();
        assert!(relocate(&data, &old, |_| Ok(())).is_err());
        let new = relocate(&data, &dest, |_| Ok(())).unwrap(); assert_eq!(root(&data).unwrap(), new.canonicalize().unwrap());
        assert_eq!(fs::read(new.join("disc/test.flac")).unwrap(), b"audio fixture"); assert!(old.join("disc/test.flac").is_file());
        assert!(join(&new, "../outside").is_err()); assert!(join(&new, "disc/file:stream").is_err());
        fs::remove_dir_all(&new).unwrap(); assert!(root(&data).is_err()); // no fallback/recreation on disconnected drive
        fs::remove_dir_all(base).unwrap();
    }
    #[test]
    fn existing_destination_and_failed_copy_do_not_switch_or_overwrite() {
        let base = std::env::temp_dir().join(format!("pmco-location-fail-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        let data = base.join("data"); let dest = base.join("chosen"); fs::create_dir_all(&data).unwrap(); fs::create_dir_all(dest.join("PMCO Audio")).unwrap();
        let old = root(&data).unwrap(); fs::write(dest.join("PMCO Audio/keep"), b"keep").unwrap();
        assert!(relocate(&data, &dest, |_| Ok(())).is_err()); assert_eq!(root(&data).unwrap(), old);
        assert_eq!(fs::read(dest.join("PMCO Audio/keep")).unwrap(), b"keep");
        let target = base.join("target.flac"); assert!(copy_file(&base.join("missing"), &target).is_err()); assert!(!target.exists());
        fs::remove_dir_all(base).unwrap();
    }
}
