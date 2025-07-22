use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri::Emitter;
use std::sync::Mutex;

#[derive(Default)]
struct AppState {
    is_visible: bool,
}

#[tauri::command]
async fn toggle_window(app: tauri::AppHandle, state: tauri::State<'_, Mutex<AppState>>) -> Result<bool, String> {
    let window = app.get_webview_window("main").unwrap();
    let mut app_state = state.lock().unwrap();

    if app_state.is_visible {
        window.set_always_on_top(false).unwrap();
        app.hide().unwrap();
        app_state.is_visible = false;
        Ok(false)
    } else {
        app.show().unwrap();
        window.show().unwrap();
        window.set_focus().unwrap();
        window.set_always_on_top(true).unwrap();
        app_state.is_visible = true;
        Ok(true)
    }
}

#[tauri::command]
async fn show_window(app: tauri::AppHandle, state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    let window = app.get_webview_window("main").unwrap();
    app.show().unwrap();
    window.show().unwrap();
    window.set_focus().unwrap();
    window.set_always_on_top(true).unwrap();
    let mut app_state = state.lock().unwrap();
    app_state.is_visible = true;
    Ok(())
}

#[tauri::command]
async fn hide_window(app: tauri::AppHandle, state: tauri::State<'_, Mutex<AppState>>) -> Result<(), String> {
    let window = app.get_webview_window("main").unwrap();
    window.set_always_on_top(false).unwrap();
    app.hide().unwrap();
    let mut app_state = state.lock().unwrap();
    app_state.is_visible = false;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                                .with_handler(move |app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let app_handle = app.app_handle().clone();
                        let state = app_handle.state::<Mutex<AppState>>();
                        let window = app_handle.get_webview_window("main").unwrap();
                        let mut app_state = state.lock().unwrap();

                        if app_state.is_visible {
                            window.set_always_on_top(false).unwrap();
                            app_handle.hide().unwrap();
                            app_state.is_visible = false;
                            app_handle.emit("window-toggled", serde_json::json!({ "isVisible": false })).unwrap();
                        } else {
                            app_handle.show().unwrap();
                            window.show().unwrap();
                            window.set_focus().unwrap();
                            window.set_always_on_top(true).unwrap();
                            app_state.is_visible = true;
                            app_handle.emit("window-toggled", serde_json::json!({ "isVisible": true })).unwrap();
                        }
                    }
                })
                .build(),
        )
        .manage(Mutex::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![toggle_window, show_window, hide_window])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);

            let window = app.get_webview_window("main").unwrap();

            if let Ok(Some(monitor)) = app.primary_monitor() {
                window.set_size(monitor.size().clone()).unwrap();
                window.set_position(monitor.position().clone()).unwrap();
            }

            // Register the global shortcut for Option+C only
            app.global_shortcut().register("Option+C").unwrap();

            // Ensure window is always on top when visible
            window.set_always_on_top(true).unwrap();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
