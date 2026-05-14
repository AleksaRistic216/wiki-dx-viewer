#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

struct ServerProcess(Mutex<Option<Child>>);

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

fn start_server(resource_dir: &PathBuf) -> Child {
    let node_path = get_node_path(resource_dir);
    let server_path = get_server_path(resource_dir);

    let mut child = Command::new(&node_path)
        .arg(&server_path)
        .env("PORT", "4000")
        .env("HOSTNAME", "localhost")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to start Node.js server");

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
    child
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let resource_dir = app
                .path()
                .resource_dir()
                .expect("failed to resolve resource dir");

            let child = start_server(&resource_dir);
            app.manage(ServerProcess(Mutex::new(Some(child))));
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
