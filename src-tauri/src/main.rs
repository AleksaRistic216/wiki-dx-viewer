#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

struct ServerProcess(Mutex<Option<Child>>);

#[cfg(target_os = "windows")]
fn show_error(msg: &str) {
    use std::ffi::OsStr;
    use std::iter::once;
    use std::os::windows::ffi::OsStrExt;

    extern "system" {
        fn MessageBoxW(hwnd: *mut std::ffi::c_void, text: *const u16, caption: *const u16, utype: u32) -> i32;
    }

    let text: Vec<u16> = OsStr::new(msg).encode_wide().chain(once(0)).collect();
    let caption: Vec<u16> = OsStr::new("Wiki DX Viewer - Error").encode_wide().chain(once(0)).collect();
    unsafe { MessageBoxW(std::ptr::null_mut(), text.as_ptr(), caption.as_ptr(), 0x10); }
}

#[cfg(not(target_os = "windows"))]
fn show_error(msg: &str) {
    // On non-Windows, just print to stderr (console is visible on macOS/Linux)
    eprintln!("Wiki DX Viewer Error: {}", msg);
}

fn get_node_path(resource_dir: &PathBuf) -> PathBuf {
    if cfg!(target_os = "windows") {
        resource_dir.join("resources").join("node").join("node.exe")
    } else {
        resource_dir.join("resources").join("node").join("bin").join("node")
    }
}

fn get_server_path(resource_dir: &PathBuf) -> PathBuf {
    resource_dir.join("resources").join("server").join("server.js")
}

fn get_server_dir(resource_dir: &PathBuf) -> PathBuf {
    resource_dir.join("resources").join("server")
}

fn start_server(resource_dir: &PathBuf) -> Result<Child, String> {
    let node_path = get_node_path(resource_dir);
    let server_path = get_server_path(resource_dir);
    let server_dir = get_server_dir(resource_dir);

    if !node_path.exists() {
        return Err(format!("Node.js binary not found at: {}", node_path.display()));
    }
    if !server_path.exists() {
        return Err(format!("Server script not found at: {}", server_path.display()));
    }

    let next_dir = server_dir.join(".next");
    if !next_dir.exists() || !next_dir.join("BUILD_ID").exists() {
        return Err(format!(
            "Next.js build not found at: {}\nThe .next directory is missing or incomplete.",
            next_dir.display()
        ));
    }

    let mut child = Command::new(&node_path)
        .arg(&server_path)
        .current_dir(&server_dir)
        .env("PORT", "4000")
        .env("HOSTNAME", "localhost")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start Node.js server: {}", e))?;

    // Wait for server to be ready by watching stdout
    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(l) => {
                    println!("[server] {}", l);
                    if l.contains("Ready") || l.contains("started") || l.contains("localhost:4000")
                    {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    }

    // Give it a moment to fully initialize
    std::thread::sleep(Duration::from_millis(500));
    Ok(child)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // In dev mode, Next.js dev server is already running on port 4000
            if cfg!(debug_assertions) {
                app.manage(ServerProcess(Mutex::new(None)));
            } else {
                let resource_dir = app
                    .path()
                    .resource_dir()
                    .expect("failed to resolve resource dir");

                match start_server(&resource_dir) {
                    Ok(child) => {
                        app.manage(ServerProcess(Mutex::new(Some(child))));
                    }
                    Err(e) => {
                        eprintln!("Server startup error: {}", e);
                        show_error(&e);
                        std::process::exit(1);
                    }
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app.state::<ServerProcess>();
                let mut guard = state.0.lock().unwrap();
                if let Some(mut child) = guard.take() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });
}
