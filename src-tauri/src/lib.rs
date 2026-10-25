//! CDC desktop app. The page (src/index.html) does all the work on screen; this side keeps the
//! collection in a JSON file in the app's data folder and hands it to the page on request. It also
//! keeps the audio library: copies of the audio files people add to their CDs, which the page plays
//! through Tauri's asset protocol (allowed for the audio folder only, see tauri.conf.json).

use std::fs;
use std::path::{Component, Path, PathBuf};

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

const DATA_FILE: &str = "collection.json";
const BACKUP_FILE: &str = "collection.backup.json";
/// Audio library: <app data dir>/audio/<CD id>/<file>.
const AUDIO_DIR: &str = "audio";
/// Formats the app's web view can play.
const AUDIO_TYPES: [&str; 8] = ["mp3", "flac", "wav", "m4a", "aac", "ogg", "oga", "opus"];

/// The app's own data folder, created if needed.
/// Windows: %APPDATA%\com.cdc.collection   macOS: ~/Library/Application Support/com.cdc.collection
fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not find the data folder: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    Ok(dir)
}

/// Bring over a collection saved by the earlier CDC.exe trial (%APPDATA%\CDC\collection.json).
fn migrate_trial_data(app: &AppHandle, target: &PathBuf) {
    if target.exists() {
        return;
    }
    if let Ok(roaming) = app.path().data_dir() {
        let old = roaming.join("CDC").join(DATA_FILE);
        if old.is_file() {
            let _ = fs::copy(&old, target);
        }
    }
}

fn user_name() -> String {
    for key in ["USERNAME", "USER"] {
        if let Ok(v) = std::env::var(key) {
            if !v.is_empty() {
                return v;
            }
        }
    }
    String::new()
}

/// Return the saved collection: { cds: [...], meta: {...}, user: "..." }.
#[tauri::command]
async fn load_data(app: AppHandle) -> Result<Value, String> {
    let path = data_dir(&app)?.join(DATA_FILE);
    migrate_trial_data(&app, &path);
    let mut doc = match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str::<Value>(&text).unwrap_or_else(|_| json!({})),
        Err(_) => json!({}),
    };
    if !doc.is_object() {
        doc = json!({});
    }
    doc["user"] = Value::String(user_name());
    Ok(doc)
}

/// Save the whole collection. The previous file is kept as a backup, and the new one is written
/// to a temporary file first so a crash mid-save cannot leave a half-written collection.
#[tauri::command]
async fn save_data(app: AppHandle, data: Value) -> Result<(), String> {
    let cds_ok = data.get("cds").map(|v| v.is_array()).unwrap_or(false);
    if !data.is_object() || !cds_ok {
        return Err("The collection is not in the expected shape.".into());
    }
    let dir = data_dir(&app)?;
    let path = dir.join(DATA_FILE);
    if path.is_file() {
        let _ = fs::copy(&path, dir.join(BACKUP_FILE));
    }
    let text = serde_json::to_string(&data).map_err(|e| e.to_string())?;
    let tmp = dir.join("collection.json.tmp");
    fs::write(&tmp, text).map_err(|e| format!("Could not save: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("Could not save: {e}"))?;
    Ok(())
}

/// Largest cover picture fetch_cover will download.
const MAX_COVER_BYTES: u64 = 5 * 1024 * 1024;

/// Download a release's cover picture for "Find this CD online". Discogs does not let web pages load
/// its pictures, so the app fetches them here and hands the bytes to the page. Only https addresses
/// on Discogs' picture server are accepted, and only pictures up to MAX_COVER_BYTES.
#[tauri::command]
async fn fetch_cover(url: String) -> Result<tauri::ipc::Response, String> {
    let address = reqwest::Url::parse(&url).map_err(|_| "That is not a web address.".to_string())?;
    let host = address.host_str().unwrap_or("");
    if address.scheme() != "https" || !(host == "i.discogs.com" || host == "img.discogs.com") {
        return Err("Only Discogs cover pictures can be downloaded.".into());
    }
    let client = reqwest::Client::builder()
        .user_agent(concat!("CDC/", env!("CARGO_PKG_VERSION"), " +https://github.com/Yuritnos/CDC"))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let reply = client
        .get(address)
        .send()
        .await
        .map_err(|e| format!("Could not download the cover: {e}"))?;
    if !reply.status().is_success() {
        return Err(format!("Could not download the cover ({}).", reply.status()));
    }
    let is_picture = reply
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .map(|v| v.starts_with("image/"))
        .unwrap_or(false);
    if !is_picture {
        return Err("That address is not a picture.".into());
    }
    if reply.content_length().unwrap_or(0) > MAX_COVER_BYTES {
        return Err("The picture is too large.".into());
    }
    let bytes = reply
        .bytes()
        .await
        .map_err(|e| format!("Could not download the cover: {e}"))?;
    if bytes.len() as u64 > MAX_COVER_BYTES {
        return Err("The picture is too large.".into());
    }
    Ok(tauri::ipc::Response::new(bytes.to_vec()))
}

/// An audio file in the library, as the page stores it with its CD.
#[derive(serde::Serialize)]
struct AudioFile {
    /// Path inside the audio library, "<CD id>/<file name>".
    file: String,
    /// The original file name, for showing.
    name: String,
    size: u64,
}

fn audio_root(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join(AUDIO_DIR);
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    Ok(dir)
}

/// CD ids are made by the page from letters and digits; anything else is refused.
fn check_cd_id(id: &str) -> Result<(), String> {
    let ok = !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if ok { Ok(()) } else { Err("That is not a CD id.".into()) }
}

/// The full path of a library file, refusing anything that would point outside the library.
fn library_path(app: &AppHandle, file: &str) -> Result<PathBuf, String> {
    let rel = Path::new(file);
    let plain = !rel.as_os_str().is_empty() && rel.components().all(|c| matches!(c, Component::Normal(_)));
    if !plain {
        return Err("That is not a file in the audio library.".into());
    }
    Ok(audio_root(app)?.join(rel))
}

/// A file name that is safe on Windows and not yet used in `dir`.
fn free_name(dir: &Path, original: &str) -> String {
    let cleaned: String = original
        .chars()
        .map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c })
        .collect();
    let cleaned = cleaned.trim().trim_end_matches('.').to_string();
    let base = if cleaned.is_empty() { "audio".to_string() } else { cleaned };
    let (stem, ext) = match base.rfind('.') {
        Some(i) if i > 0 => (base[..i].to_string(), base[i..].to_string()),
        _ => (base.clone(), String::new()),
    };
    let mut name = base.clone();
    let mut n = 2;
    while dir.join(&name).exists() {
        name = format!("{stem} ({n}){ext}");
        n += 1;
    }
    name
}

/// The audio library's folder, so the page can turn library paths into playable addresses.
#[tauri::command]
async fn audio_root_dir(app: AppHandle) -> Result<String, String> {
    Ok(audio_root(&app)?.to_string_lossy().into_owned())
}

/// Let the person choose audio files for a CD and copy them into the library. Returns the copies,
/// or an empty list if they cancelled.
#[tauri::command]
async fn add_audio(app: AppHandle, cd_id: String) -> Result<Vec<AudioFile>, String> {
    check_cd_id(&cd_id)?;
    let picked = app.dialog().file().add_filter("Audio", &AUDIO_TYPES).blocking_pick_files();
    let Some(picked) = picked else { return Ok(Vec::new()) };
    let dir = audio_root(&app)?.join(&cd_id);
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create {}: {e}", dir.display()))?;
    let mut added = Vec::new();
    for chosen in picked {
        let source = chosen.into_path().map_err(|e| format!("Could not read that file: {e}"))?;
        let name = source.file_name().and_then(|n| n.to_str()).unwrap_or("audio").to_string();
        let target = free_name(&dir, &name);
        let dest = dir.join(&target);
        let (from, to) = (source.clone(), dest.clone());
        tauri::async_runtime::spawn_blocking(move || fs::copy(&from, &to))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|e| format!("Could not copy {name}: {e}"))?;
        let size = fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);
        added.push(AudioFile { file: format!("{cd_id}/{target}"), name, size });
    }
    Ok(added)
}

/// Which of these library files are on this computer (audio is not synced between computers).
#[tauri::command]
async fn audio_present(app: AppHandle, files: Vec<String>) -> Result<Vec<bool>, String> {
    Ok(files.iter().map(|f| library_path(&app, f).map(|p| p.is_file()).unwrap_or(false)).collect())
}

/// Delete library copies. Files already gone are fine.
#[tauri::command]
async fn remove_audio(app: AppHandle, files: Vec<String>) -> Result<(), String> {
    for f in &files {
        let path = library_path(&app, f)?;
        if let Err(e) = fs::remove_file(&path) {
            if e.kind() != std::io::ErrorKind::NotFound {
                return Err(format!("Could not remove {f}: {e}"));
            }
        }
        if let Some(parent) = path.parent() {
            let _ = fs::remove_dir(parent); // only succeeds once the CD's folder is empty
        }
    }
    Ok(())
}

/// Delete all audio of a removed CD.
#[tauri::command]
async fn remove_cd_audio(app: AppHandle, cd_id: String) -> Result<(), String> {
    check_cd_id(&cd_id)?;
    let dir = audio_root(&app)?.join(&cd_id);
    if dir.is_dir() {
        fs::remove_dir_all(&dir).map_err(|e| format!("Could not remove the audio of that CD: {e}"))?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            fetch_cover,
            audio_root_dir,
            add_audio,
            audio_present,
            remove_audio,
            remove_cd_audio
        ])
        .run(tauri::generate_context!())
        .expect("error while running CDC");
}
