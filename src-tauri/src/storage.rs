//! File-only persistence helpers, tested against disposable directories.
use std::{fs, io::Write, path::Path, time::{SystemTime, UNIX_EPOCH}};
use serde_json::{json, Value};

pub fn validate(doc: Value) -> Result<Value, String> {
    if !doc.is_object() || !doc.get("cds").map(Value::is_array).unwrap_or(false) {
        return Err("collection_unreadable".into());
    }
    Ok(doc)
}

pub fn read(path: &Path) -> Result<Value, String> {
    match fs::read(path) {
        Ok(bytes) => validate(serde_json::from_slice(&bytes).map_err(|_| "collection_unreadable")?),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(json!({"cds": []})),
        Err(_) => Err("collection_unreadable".into()),
    }
}

pub fn atomic_write(path: &Path, doc: &Value) -> Result<(), String> {
    let bytes = serde_json::to_vec(doc).map_err(|_| "Could not save the collection.")?;
    let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|_| "Could not save the collection.")?.as_nanos();
    let tmp = path.with_file_name(format!("{}.{}.tmp", path.file_name().unwrap_or_default().to_string_lossy(), stamp));
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&tmp).map_err(|_| "Could not save the collection.")?;
    let result = file.write_all(&bytes).and_then(|_| file.sync_all());
    drop(file);
    let result = result.and_then(|_| fs::rename(&tmp, path));
    if result.is_err() { let _ = fs::remove_file(&tmp); }
    result.map_err(|_| "Could not save the collection.".into())
}

/// Keep the damaged bytes before replacing them. A failed copy prevents replacement.
pub fn recover(path: &Path, doc: &Value) -> Result<(), String> {
    validate(doc.clone())?;
    match fs::File::open(path) {
        Ok(mut source) => {
            let stamp = SystemTime::now().duration_since(UNIX_EPOCH).map_err(|_| "Could not preserve the collection.")?.as_nanos();
            let copy = path.with_file_name(format!("collection.unreadable-{stamp}.json"));
            let mut target = fs::OpenOptions::new().write(true).create_new(true).open(copy).map_err(|_| "Could not preserve the collection.")?;
            std::io::copy(&mut source, &mut target).and_then(|_| target.sync_all()).map_err(|_| "Could not preserve the collection.")?;
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {},
        Err(_) => return Err("Could not preserve the collection.".into()),
    }
    atomic_write(path, doc)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_is_first_run_but_corrupt_and_wrong_shape_are_errors() {
        let dir = std::env::temp_dir().join(format!("pmco-storage-{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir(&dir).unwrap(); let path = dir.join("collection.json");
        assert_eq!(read(&path).unwrap()["cds"], json!([]));
        for text in ["{broken", "null", "[]", "{}", "{\"cds\":{}}"] {
            fs::write(&path, text).unwrap(); assert!(read(&path).is_err());
        }
        let doc = json!({"cds":[{"id":"fixture","title":"Keep"}],"legacy":{"keep":true}});
        fs::write(&path, "damaged original").unwrap();
        recover(&path, &doc).unwrap(); assert_eq!(read(&path).unwrap(), doc);
        let preserved = fs::read_dir(&dir).unwrap().flatten().find(|e| e.file_name().to_string_lossy().starts_with("collection.unreadable-")).unwrap();
        assert_eq!(fs::read_to_string(preserved.path()).unwrap(), "damaged original");
        assert!(recover(&path, &json!({})).is_err()); assert_eq!(read(&path).unwrap(), doc);
        fs::remove_dir_all(dir).unwrap();
    }
}
