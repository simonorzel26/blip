use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri::Emitter;
use std::sync::Mutex;
use std::net::TcpStream;
use std::time::Duration;

#[cfg(target_os = "macos")]
use core_graphics::event::{CGEvent, CGEventFlags};
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

#[derive(Default)]
struct AppState {
    is_visible: bool,
}

#[cfg(target_os = "macos")]
fn simulate_cmd_c() {
    println!("Attempting to simulate Cmd+C using Core Graphics");

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState).unwrap();
    let c_keycode = 8u16; // Key code for 'c'

    // Create key down event with Command modifier
    if let Ok(key_down_event) = CGEvent::new_keyboard_event(source.clone(), c_keycode, true) {
        key_down_event.set_flags(CGEventFlags::CGEventFlagCommand);
        key_down_event.post(core_graphics::event::CGEventTapLocation::HID);
    }

    // Small delay
    std::thread::sleep(std::time::Duration::from_millis(10));

    // Create key up event with Command modifier
    if let Ok(key_up_event) = CGEvent::new_keyboard_event(source, c_keycode, false) {
        key_up_event.set_flags(CGEventFlags::CGEventFlagCommand);
        key_up_event.post(core_graphics::event::CGEventTapLocation::HID);
    }

    println!("Cmd+C simulation completed");
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
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
                            // First, copy any selected text to clipboard
                            #[cfg(target_os = "macos")]
                            simulate_cmd_c();

                            // Delay to ensure copy operation completes
                            std::thread::sleep(std::time::Duration::from_millis(200));

                            // Then show the app
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
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let window = app.get_webview_window("main").unwrap();
            let app_handle = app.app_handle().clone();

            // Development server health check
            #[cfg(debug_assertions)]
            {
                let app_handle_clone = app_handle.clone();
                std::thread::spawn(move || {
                    loop {
                        std::thread::sleep(Duration::from_secs(5));

                        // Check if development server is still running using TCP connection
                        if TcpStream::connect("localhost:3000").is_err() {
                            println!("Development server stopped, closing app");
                            app_handle_clone.exit(0);
                            break;
                        }
                    }
                });
            }

            if let Ok(Some(monitor)) = app.primary_monitor() {
                window.set_size(monitor.size().clone()).unwrap();
                window.set_position(monitor.position().clone()).unwrap();
            }

            app.global_shortcut().register("Option+C").unwrap();

            window.set_always_on_top(true).unwrap();

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
