mod commands;
mod gdrive;

use std::sync::Mutex;

use commands::PendingOpen;
#[cfg(target_os = "macos")]
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(PendingOpen(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            commands::read_markdown_file,
            commands::read_markdown_files,
            commands::write_markdown_file,
            commands::take_pending_open_path,
            commands::get_recent_files,
            commands::record_recent_file,
            commands::reveal_in_finder,
            commands::copy_text_to_clipboard,
            commands::save_session,
            commands::load_session,
            commands::save_drafts,
            commands::load_drafts,
            commands::clear_drafts,
            commands::stat_files,
            commands::scan_workspace,
            gdrive::gdrive_begin_auth,
            gdrive::gdrive_store_tokens,
            gdrive::gdrive_load_tokens,
            gdrive::gdrive_clear_tokens
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            let path = urls
                .iter()
                .filter_map(|url| url.to_file_path().ok())
                .map(|path| path.to_string_lossy().into_owned())
                .next();
            if let Some(path) = path {
                // Stash the path so the frontend can fetch it even when the
                // event arrives before its listeners are registered (cold
                // launch via Finder), then ping any live listener.
                let state = app_handle.state::<PendingOpen>();
                *state.0.lock().unwrap() = Some(path);
                let _ = app_handle.emit("markflow://open-file", ());
            }
        }
        #[cfg(not(target_os = "macos"))]
        let _ = (&app_handle, &event);
    });
}
