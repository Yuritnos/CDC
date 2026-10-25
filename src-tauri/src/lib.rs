//! CDC desktop app. The page (src/index.html) does all the work on screen; this side keeps the
//! collection in a JSON file in the app's data folder and hands it to the page on request.

use std::fs;
use std::path::PathBuf;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

const DATA_FILE: &str = "collection.json";
const BACKUP_FILE: &str = "collection.backup.json";

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![load_data, save_data, fetch_cover])
        .run(tauri::generate_context!())
        .expect("error while running CDC");
}
