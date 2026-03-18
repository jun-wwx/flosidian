use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct NoteInfo {
    pub name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize)]
pub struct NoteContent {
    pub name: String,
    pub content: String,
    pub path: String,
}

// Get notes directory path
fn get_notes_dir() -> PathBuf {
    let home = dirs::document_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join("NeuroNote")
}

// Ensure notes directory exists
fn ensure_notes_dir() -> Result<PathBuf, String> {
    let dir = get_notes_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(dir)
}

#[tauri::command]
fn list_notes() -> Result<Vec<NoteInfo>, String> {
    let dir = ensure_notes_dir()?;
    let mut notes = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().map_or(false, |ext| ext == "md") {
                if let Some(name) = path.file_stem() {
                    notes.push(NoteInfo {
                        name: name.to_string_lossy().to_string(),
                        path: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }
    
    Ok(notes)
}

#[tauri::command]
fn read_note(name: String) -> Result<NoteContent, String> {
    let dir = ensure_notes_dir()?;
    let path = dir.join(format!("{}.md", name));
    
    let content = if path.exists() {
        fs::read_to_string(&path).map_err(|e| e.to_string())?
    } else {
        String::new()
    };
    
    Ok(NoteContent {
        name,
        content,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn save_note(name: String, content: String) -> Result<(), String> {
    let dir = ensure_notes_dir()?;
    let path = dir.join(format!("{}.md", name));
    
    fs::write(&path, content).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn delete_note(name: String) -> Result<(), String> {
    let dir = get_notes_dir();
    let path = dir.join(format!("{}.md", name));
    
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
fn get_notes_dir_path() -> String {
    get_notes_dir().to_string_lossy().to_string()
}

#[tauri::command]
fn create_note(name: String) -> Result<NoteContent, String> {
    let dir = ensure_notes_dir()?;
    let path = dir.join(format!("{}.md", name));
    
    if path.exists() {
        return Err("Note already exists".to_string());
    }
    
    let content = format!("# {}\n\n", name);
    fs::write(&path, &content).map_err(|e| e.to_string())?;
    
    Ok(NoteContent {
        name,
        content,
        path: path.to_string_lossy().to_string(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_notes,
            read_note,
            save_note,
            delete_note,
            get_notes_dir_path,
            create_note
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
