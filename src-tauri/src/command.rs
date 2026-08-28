use std::time::Duration;
use tauri_plugin_http::reqwest;

#[tauri::command]
pub async fn is_online() -> bool {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build();

    match client {
        Ok(c) => c.head("https://www.google.com").send().await.is_ok(),
        Err(_) => false,
    }
}
