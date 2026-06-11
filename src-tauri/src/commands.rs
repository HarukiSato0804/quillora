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
    use super::{push_recent, read_markdown_files};

    #[test]
    fn read_markdown_files_reports_unsupported_extensions() {
        let result = read_markdown_files(vec!["/tmp/image.png".into()]).unwrap();
        assert!(result.files.is_empty());
        assert_eq!(result.errors.len(), 1);
        assert_eq!(result.errors[0].path, "/tmp/image.png");
    }

    #[test]
    fn read_markdown_files_reads_existing_files_and_reports_missing_ones() {
        let dir = std::env::temp_dir().join("markflow-test");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("read-files-test.md");
        std::fs::write(&file, "# hello").unwrap();

        let missing = dir.join("missing.md");
        let result = read_markdown_files(vec![
            file.to_string_lossy().into_owned(),
            missing.to_string_lossy().into_owned(),
        ])
        .unwrap();

        assert_eq!(result.files.len(), 1);
        assert_eq!(result.files[0].contents, "# hello");
        assert!(result.files[0].mtime_ms.is_some());
        assert_eq!(result.errors.len(), 1);

        std::fs::remove_file(&file).ok();
    }

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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownFile {
    pub requested_path: String,
    pub path: String,
    pub contents: String,
    pub mtime_ms: Option<f64>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileReadError {
    pub path: String,
    pub message: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadMarkdownFilesResult {
    pub files: Vec<MarkdownFile>,
    pub errors: Vec<FileReadError>,
}

fn file_mtime_ms(path: &Path) -> Option<f64> {
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as f64)
}

#[tauri::command]
pub fn read_markdown_files(paths: Vec<String>) -> Result<ReadMarkdownFilesResult, String> {
    let mut files = Vec::new();
    let mut errors = Vec::new();

    for requested in paths {
        let path = PathBuf::from(&requested);
        if !is_allowed_markdown_path(&path) {
            errors.push(FileReadError {
                path: requested,
                message: "Only .md, .markdown, and .txt files are supported.".to_string(),
            });
            continue;
        }
        let canonical = fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
        match fs::read_to_string(&canonical) {
            Ok(contents) => files.push(MarkdownFile {
                requested_path: requested,
                path: canonical.to_string_lossy().into_owned(),
                contents,
                mtime_ms: file_mtime_ms(&canonical),
            }),
            Err(err) => errors.push(FileReadError {
                path: requested,
                message: err.to_string(),
            }),
        }
    }

    Ok(ReadMarkdownFilesResult { files, errors })
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
