#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use std::io::Read;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
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
    eprintln!("Wiki DX Viewer Error: {}", msg);
}

fn get_node_path(resource_dir: &PathBuf) -> PathBuf {
    if cfg!(target_os = "windows") {
        resource_dir.join("resources").join("node").join("node.exe")
    } else {
        resource_dir.join("resources").join("node").join("bin").join("node")
    }
}

fn get_server_dir(resource_dir: &PathBuf) -> PathBuf {
    resource_dir.join("resources").join("server")
}

fn spawn_server(resource_dir: &PathBuf) -> Result<Child, String> {
    let node_path = get_node_path(resource_dir);
    let server_dir = get_server_dir(resource_dir);
    let server_path = server_dir.join("server.js");

    if !node_path.exists() {
        return Err(format!("Node.js not found at: {}", node_path.display()));
    }
    if !server_path.exists() {
        return Err(format!("Server not found at: {}", server_path.display()));
    }
    let next_dir = server_dir.join(".next");
    if !next_dir.exists() || !next_dir.join("BUILD_ID").exists() {
        return Err(format!(
            "Next.js build not found at: {}\nThe .next directory is missing or incomplete.",
            next_dir.display()
        ));
    }

    let mut cmd = Command::new(&node_path);
    cmd.arg(&server_path)
        .current_dir(&server_dir)
        .env("PORT", "4000")
        .env("HOSTNAME", "localhost")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    cmd.spawn()
        .map_err(|e| format!("Failed to start Node.js server: {}", e))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.manage(ServerProcess(Mutex::new(None)));
                return Ok(());
            }

            let resource_dir = app
                .path()
                .resource_dir()
                .expect("failed to resolve resource dir");

            let child = match spawn_server(&resource_dir) {
                Ok(c) => c,
                Err(e) => {
                    show_error(&e);
                    std::process::exit(1);
                }
            };

            app.manage(ServerProcess(Mutex::new(Some(child))));

            // Wait for server in a background thread, then show the window
            let window = app.get_webview_window("main")
                .expect("failed to get main window");

            std::thread::spawn(move || {
                // Poll until server is accepting connections
                let start = Instant::now();
                let timeout = Duration::from_secs(30);
                loop {
                    if start.elapsed() > timeout {
                        show_error("Server took too long to start.\nPlease try again.");
                        std::process::exit(1);
                    }
                    if let Ok(mut stream) = TcpStream::connect("127.0.0.1:4000") {
                        use std::io::Write;
                        let _ = stream.write_all(b"GET / HTTP/1.0\r\nHost: localhost\r\n\r\n");
                        let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
                        let mut buf = [0u8; 32];
                        if let Ok(n) = stream.read(&mut buf) {
                            if n > 0 {
                                break;
                            }
                        }
                    }
                    std::thread::sleep(Duration::from_millis(200));
                }

                // Server is ready — reload and show
                let _ = window.eval("window.location.reload()");
                std::thread::sleep(Duration::from_millis(300));
                let _ = window.show();
            });

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

