use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri::Emitter;
use std::sync::Mutex;
use std::net::TcpStream;
use std::time::Duration;
use std::{fs, io::{BufRead, BufReader}, path::PathBuf};
use serde::{Serialize, Deserialize};

#[cfg(target_os = "macos")]
use core_graphics::event::{CGEvent, CGEventFlags};
#[cfg(target_os = "macos")]
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

#[derive(Default)]
struct AppState {
    is_visible: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct FileMetadata {
    id: String,
    filename: String,
    saved_path: String,
    total_words: usize,
    current_word_index: usize,
    created_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct ProjectSettings {
    time_per_word: f64,
    time_per_character: f64,
    highlight_orp: bool,
    letter_spacing: f64,
    punctuation_delay: f64,
    trail_words_count: i32,
    chunk_size: i32,
    skill_level: i32,
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            time_per_word: 35.0, // Word delay: 35ms default
            time_per_character: 25.0, // Character delay: 25ms default
            highlight_orp: true,
            letter_spacing: 3.5,
            punctuation_delay: 50.0, // Punctuation delay: 50ms default
            trail_words_count: 5,
            chunk_size: 1,
            skill_level: 1,
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
struct ProjectSession {
    session_id: String,
    project_id: String,
    current_word_index: usize,
    last_read_date: String,
    settings: ProjectSettings,
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
async fn import_file(app: tauri::AppHandle, original_path: String) -> Result<FileMetadata, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut target_dir = PathBuf::from(app_dir);
    target_dir.push("files");

    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let filename = PathBuf::from(&original_path)
        .file_name()
        .ok_or("Invalid file name")?
        .to_string_lossy()
        .to_string();

    // Generate unique filename to avoid conflicts
    let project_id = uuid::Uuid::new_v4().to_string();
    let safe_filename = format!("{}_{}", project_id, filename);

    let mut saved_path = target_dir.clone();
    saved_path.push(&safe_filename);
    fs::copy(&original_path, &saved_path).map_err(|e| e.to_string())?;

    // Count total words efficiently
    let file = fs::File::open(&saved_path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);
    let mut word_count = 0;

    for line in reader.lines() {
        if let Ok(line) = line {
            word_count += line.split_whitespace().count();
        }
    }

    let meta = FileMetadata {
        id: project_id,
        filename,
        saved_path: saved_path.to_string_lossy().to_string(),
        total_words: word_count,
        current_word_index: 0,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    Ok(meta)
}

#[tauri::command]
async fn load_word_buffer(path: String, start_index: usize, buffer_size: usize) -> Result<Vec<String>, String> {
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let reader = BufReader::new(file);

    let mut words = Vec::new();
    let mut current_index = 0;

    for line in reader.lines() {
        if let Ok(line) = line {
            for word in line.split_whitespace() {
                if current_index >= start_index && words.len() < buffer_size {
                    words.push(word.to_string());
                }
                current_index += 1;

                if words.len() >= buffer_size {
                    break;
                }
            }
            if words.len() >= buffer_size {
                break;
            }
        }
    }

    Ok(words)
}

#[tauri::command]
async fn save_project_metadata(app: tauri::AppHandle, metadata: FileMetadata) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut projects_file = PathBuf::from(app_dir);
    projects_file.push("projects.json");

    // Load existing projects
    let mut projects: Vec<FileMetadata> = if projects_file.exists() {
        let content = fs::read_to_string(&projects_file).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    // Update or add project
    if let Some(existing) = projects.iter_mut().find(|p| p.id == metadata.id) {
        *existing = metadata;
    } else {
        projects.push(metadata);
    }

    // Save back to file
    let json = serde_json::to_string_pretty(&projects).map_err(|e| e.to_string())?;
    fs::write(projects_file, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn load_projects(app: tauri::AppHandle) -> Result<Vec<FileMetadata>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut projects_file = PathBuf::from(app_dir);
    projects_file.push("projects.json");

    if !projects_file.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&projects_file).map_err(|e| e.to_string())?;
    let projects: Vec<FileMetadata> = serde_json::from_str(&content).unwrap_or_default();

    Ok(projects)
}

#[tauri::command]
async fn save_session_progress(app: tauri::AppHandle, project_id: String, word_index: usize) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut sessions_file = PathBuf::from(app_dir);
    sessions_file.push("sessions.json");

    // Load existing sessions
    let mut sessions: Vec<ProjectSession> = if sessions_file.exists() {
        let content = fs::read_to_string(&sessions_file).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    let session_id = format!("{}_session", project_id);

    // Update or add session
    if let Some(existing) = sessions.iter_mut().find(|s| s.project_id == project_id) {
        existing.current_word_index = word_index;
        existing.last_read_date = chrono::Utc::now().to_rfc3339();
    } else {
        sessions.push(ProjectSession {
            session_id,
            project_id,
            current_word_index: word_index,
            last_read_date: chrono::Utc::now().to_rfc3339(),
            settings: ProjectSettings::default(),
        });
    }

    // Save back to file
    let json = serde_json::to_string_pretty(&sessions).map_err(|e| e.to_string())?;
    fs::write(sessions_file, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn save_project_settings(app: tauri::AppHandle, project_id: String, settings: ProjectSettings) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut sessions_file = PathBuf::from(app_dir);
    sessions_file.push("sessions.json");

    // Load existing sessions
    let mut sessions: Vec<ProjectSession> = if sessions_file.exists() {
        let content = fs::read_to_string(&sessions_file).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Vec::new()
    };

    // Update or add session with new settings
    if let Some(existing) = sessions.iter_mut().find(|s| s.project_id == project_id) {
        existing.settings = settings;
        existing.last_read_date = chrono::Utc::now().to_rfc3339();
    } else {
        let session_id = format!("{}_session", project_id);
        sessions.push(ProjectSession {
            session_id,
            project_id,
            current_word_index: 0,
            last_read_date: chrono::Utc::now().to_rfc3339(),
            settings,
        });
    }

    // Save back to file
    let json = serde_json::to_string_pretty(&sessions).map_err(|e| e.to_string())?;
    fs::write(sessions_file, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn load_project_settings(app: tauri::AppHandle, project_id: String) -> Result<Option<ProjectSettings>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut sessions_file = PathBuf::from(app_dir);
    sessions_file.push("sessions.json");

    if !sessions_file.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&sessions_file).map_err(|e| e.to_string())?;
    let sessions: Vec<ProjectSession> = serde_json::from_str(&content).unwrap_or_default();

    Ok(sessions.iter()
        .find(|s| s.project_id == project_id)
        .map(|s| s.settings.clone()))
}

#[tauri::command]
async fn load_session_progress(app: tauri::AppHandle, project_id: String) -> Result<Option<usize>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut sessions_file = PathBuf::from(app_dir);
    sessions_file.push("sessions.json");

    if !sessions_file.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&sessions_file).map_err(|e| e.to_string())?;
    let sessions: Vec<ProjectSession> = serde_json::from_str(&content).unwrap_or_default();

    Ok(sessions.iter()
        .find(|s| s.project_id == project_id)
        .map(|s| s.current_word_index))
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
        .plugin(tauri_plugin_store::Builder::new().build())
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
        .invoke_handler(tauri::generate_handler![
            import_file,
            load_word_buffer,
            save_project_metadata,
            load_projects,
            save_session_progress,
            load_session_progress,
            save_project_settings,
            load_project_settings,
            toggle_window,
            show_window,
            hide_window
        ])
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
