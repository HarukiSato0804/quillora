use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

use tauri::Manager;

pub struct PendingOpen(pub Mutex<Option<String>>);

#[tauri::command]
pub fn take_pending_open_path(state: tauri::State<'_, PendingOpen>) -> Option<String> {
    state.0.lock().unwrap().take()
}

const MAX_RECENT_FILES: usize = 10;

fn push_recent(mut list: Vec<String>, path: String) -> Vec<String> {
    list.retain(|existing| existing != &path);
    list.insert(0, path);
    list.truncate(MAX_RECENT_FILES);
    list
}

fn recent_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| err.to_string())?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir.join("recent.json"))
}

fn read_recent(app: &tauri::AppHandle) -> Vec<String> {
    recent_store_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_recent_files(app: tauri::AppHandle) -> Vec<String> {
    read_recent(&app)
}

#[tauri::command]
pub fn record_recent_file(
    app: tauri::AppHandle,
    path: String,
) -> Result<Vec<String>, String> {
    let store = recent_store_path(&app)?;
    let list = push_recent(read_recent(&app), path);
    let json = serde_json::to_string_pretty(&list).map_err(|err| err.to_string())?;
    fs::write(&store, json).map_err(|err| err.to_string())?;
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::push_recent;

    #[test]
    fn push_recent_prepends_new_paths() {
        let list = push_recent(vec!["/a.md".into()], "/b.md".into());
        assert_eq!(list, vec!["/b.md".to_string(), "/a.md".to_string()]);
    }

    #[test]
    fn push_recent_moves_duplicates_to_front() {
        let list = push_recent(
            vec!["/a.md".into(), "/b.md".into()],
            "/b.md".into(),
        );
        assert_eq!(list, vec!["/b.md".to_string(), "/a.md".to_string()]);
    }

    #[test]
    fn push_recent_caps_the_list() {
        let seed: Vec<String> = (0..10).map(|i| format!("/{i}.md")).collect();
        let list = push_recent(seed, "/new.md".into());
        assert_eq!(list.len(), 10);
        assert_eq!(list[0], "/new.md");
        assert!(!list.contains(&"/9.md".to_string()));
    }
}

fn is_allowed_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let ext = ext.to_ascii_lowercase();
            matches!(ext.as_str(), "md" | "markdown" | "txt")
        })
        .unwrap_or(false)
}

#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);

    if !is_allowed_markdown_path(&path) {
        return Err("Only .md, .markdown, and .txt files are supported.".to_string());
    }

    fs::read_to_string(&path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn write_markdown_file(path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(path);

    if !is_allowed_markdown_path(&path) {
        return Err("Only .md, .markdown, and .txt files are supported.".to_string());
    }

    fs::write(&path, contents).map_err(|err| err.to_string())
}
