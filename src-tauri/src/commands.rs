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

const MAX_RECENT_FILES: usize = 20;

fn push_recent(mut list: Vec<String>, path: String) -> Vec<String> {
    list.retain(|existing| existing != &path);
    list.insert(0, path);
    list.truncate(MAX_RECENT_FILES);
    list
}

fn recent_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
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
pub fn record_recent_file(app: tauri::AppHandle, path: String) -> Result<Vec<String>, String> {
    let store = recent_store_path(&app)?;
    // Canonicalize so the same file reached via different paths dedupes.
    let canonical = fs::canonicalize(&path)
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or(path);
    let list = push_recent(read_recent(&app), canonical);
    let json = serde_json::to_string_pretty(&list).map_err(|err| err.to_string())?;
    fs::write(&store, json).map_err(|err| err.to_string())?;
    Ok(list)
}

fn session_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|err| err.to_string())?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir.join("session.json"))
}

#[tauri::command]
pub fn save_session(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let store = session_store_path(&app)?;
    fs::write(&store, json).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn load_session(app: tauri::AppHandle) -> Option<String> {
    session_store_path(&app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStat {
    pub path: String,
    pub mtime_ms: Option<f64>,
}

#[tauri::command]
pub fn stat_files(paths: Vec<String>) -> Vec<FileStat> {
    paths
        .into_iter()
        .map(|path| {
            let mtime_ms = file_mtime_ms(Path::new(&path));
            FileStat { path, mtime_ms }
        })
        .collect()
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownFileEntry {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub size: u64,
    pub modified_at: u64,
    pub relative_path: String,
}

const EXCLUDED_WORKSPACE_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    "build",
    ".next",
    ".turbo",
    ".venv",
    "__pycache__",
];

#[tauri::command]
pub fn scan_workspace(root: String) -> Vec<MarkdownFileEntry> {
    let root_path = PathBuf::from(root);
    let canonical_root = fs::canonicalize(&root_path).unwrap_or(root_path);
    let mut files = Vec::new();
    scan_markdown_dir(&canonical_root, &canonical_root, &mut files);
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    files
}

fn scan_markdown_dir(root: &Path, dir: &Path, files: &mut Vec<MarkdownFileEntry>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };

        if metadata.is_dir() {
            if should_exclude_workspace_dir(&path) {
                continue;
            }
            scan_markdown_dir(root, &path, files);
            continue;
        }

        if !metadata.is_file() || !is_workspace_markdown_path(&path) {
            continue;
        }

        let relative_path = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string();
        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0);

        files.push(MarkdownFileEntry {
            path: path.to_string_lossy().into_owned(),
            name,
            kind: classify_markdown_file(&path, &relative_path),
            size: metadata.len(),
            modified_at,
            relative_path,
        });
    }
}

fn should_exclude_workspace_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| EXCLUDED_WORKSPACE_DIRS.contains(&name))
        .unwrap_or(false)
}

fn is_workspace_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let ext = ext.to_ascii_lowercase();
            matches!(ext.as_str(), "md" | "markdown" | "mdx")
        })
        .unwrap_or(false)
}

fn classify_markdown_file(path: &Path, relative_path: &str) -> String {
    if let Some(kind) = frontmatter_type(path) {
        return kind;
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let relative = relative_path.to_ascii_lowercase();
    let segments: Vec<&str> = relative.split('/').collect();

    let kind = if file_name == "skill.md" {
        "skill"
    } else if file_name == "agent.md" || segments.contains(&"agents") {
        "agent"
    } else if file_name == "readme.md" {
        "readme"
    } else if matches!(
        file_name.as_str(),
        "prompt.md" | "system.md" | "instructions.md"
    ) {
        "prompt"
    } else if matches!(file_name.as_str(), "design.md" | "architecture.md")
        || relative.starts_with("docs/design/")
        || relative.contains("/docs/design/")
    {
        "design"
    } else if matches!(file_name.as_str(), "todo.md" | "tasks.md" | "roadmap.md") {
        "task"
    } else if file_name == "runbook.md" {
        "runbook"
    } else if file_name == "adr.md" || segments.contains(&"adr") {
        "adr"
    } else if file_name == "changelog.md" {
        "changelog"
    } else {
        "unknown"
    };
    kind.to_string()
}

fn frontmatter_type(path: &Path) -> Option<String> {
    let bytes = fs::read(path).ok()?;
    let prefix = String::from_utf8_lossy(&bytes[..bytes.len().min(200)]);
    parse_frontmatter_type(&prefix)
}

fn parse_frontmatter_type(prefix: &str) -> Option<String> {
    let trimmed = prefix.strip_prefix("---")?;
    for line in trimmed.lines() {
        let line = line.trim();
        if line == "---" {
            break;
        }
        let Some(value) = line.strip_prefix("type:") else {
            continue;
        };
        let normalized = value.trim().trim_matches('"').trim_matches('\'');
        if matches!(
            normalized,
            "skill"
                | "agent"
                | "readme"
                | "prompt"
                | "design"
                | "task"
                | "runbook"
                | "adr"
                | "changelog"
                | "unknown"
        ) {
            return Some(normalized.to_string());
        }
    }
    None
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|err| err.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Err("Reveal in Finder is only available on macOS.".to_string())
    }
}

#[tauri::command]
pub fn copy_text_to_clipboard(text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::io::Write;
        let mut child = std::process::Command::new("pbcopy")
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|err| err.to_string())?;
        child
            .stdin
            .as_mut()
            .ok_or_else(|| "failed to open pbcopy stdin".to_string())?
            .write_all(text.as_bytes())
            .map_err(|err| err.to_string())?;
        child.wait().map_err(|err| err.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = text;
        Err("Clipboard copy is only implemented on macOS.".to_string())
    }
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
        let list = push_recent(vec!["/a.md".into(), "/b.md".into()], "/b.md".into());
        assert_eq!(list, vec!["/b.md".to_string(), "/a.md".to_string()]);
    }

    #[test]
    fn push_recent_caps_the_list() {
        let seed: Vec<String> = (0..20).map(|i| format!("/{i}.md")).collect();
        let list = push_recent(seed, "/new.md".into());
        assert_eq!(list.len(), 20);
        assert_eq!(list[0], "/new.md");
        assert!(!list.contains(&"/19.md".to_string()));
    }

    #[test]
    fn stat_files_returns_mtime_for_existing_and_none_for_missing() {
        let dir = std::env::temp_dir().join("markflow-test");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("stat-test.md");
        std::fs::write(&file, "x").unwrap();

        let stats = super::stat_files(vec![
            file.to_string_lossy().into_owned(),
            dir.join("nope.md").to_string_lossy().into_owned(),
        ]);
        assert_eq!(stats.len(), 2);
        assert!(stats[0].mtime_ms.is_some());
        assert!(stats[1].mtime_ms.is_none());

        std::fs::remove_file(&file).ok();
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
