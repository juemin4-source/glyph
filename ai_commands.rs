use std::time::Instant;
use tauri::State;
use reqwest::Client;
use serde_json::json;
use crate::db::Database;
use crate::models::{
    SaveProviderConfigInput, DeleteProviderConfigInput,
    TestProviderConnectionInput, ProviderConnectionTestResult,
    ProviderConfigSummary, ResolveProviderCredentialInput, ResolveProviderCredentialOutput,
};

// ===== AI Provider Management (v2) =====

/// List all AI provider configurations (without exposing api keys)
#[tauri::command]
pub fn list_providers_v2(
    db: State<'_, Database>,
) -> Result<Vec<ProviderConfigSummary>, String> {
    let configs = db.list_ai_provider_configs()
        .map_err(|e| format!("DB_ERROR: {}", e))?;
    Ok(configs.iter().map(|c| c.to_summary()).collect())
}

/// Save or update an AI provider configuration
#[tauri::command]
pub fn save_provider_config(
    db: State<'_, Database>,
    input: SaveProviderConfigInput,
) -> Result<ProviderConfigSummary, String> {
    let config = db.save_ai_provider_config(&input)
        .map_err(|e| format!("DB_ERROR: {}", e))?;
    Ok(config.to_summary())
}

/// Delete an AI provider configuration
#[tauri::command]
pub fn delete_provider_config(
    db: State<'_, Database>,
    input: DeleteProviderConfigInput,
) -> Result<(), String> {
    db.delete_ai_provider_config(&input.id)
        .map_err(|e| format!("DB_ERROR: {}", e))
}

/// Resolve a provider credential for runtime API calls.
/// This is the only way Router should obtain a provider's API key.
#[tauri::command]
pub fn resolve_provider_credential(
    db: State<'_, Database>,
    input: ResolveProviderCredentialInput,
) -> Result<ResolveProviderCredentialOutput, String> {
    let api_key = db.resolve_ai_provider_credential(&input.provider_id)?;
    Ok(ResolveProviderCredentialOutput { api_key })
}

/// Test an AI provider connection by sending a lightweight request
#[tauri::command]
pub async fn test_provider_connection(
    db: State<'_, Database>,
    input: TestProviderConnectionInput,
) -> Result<ProviderConnectionTestResult, String> {
    let start = Instant::now();

    let base_url = input.endpoint.trim_end_matches('/').to_string();
    let models_url = format!("{}/models", base_url);

    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client
        .get(&models_url)
        .header("Authorization", format!("Bearer {}", input.api_key))
        .send()
        .await;

    let latency_ms = start.elapsed().as_millis() as i64;

    match response {
        Ok(resp) => {
            if resp.status().is_success() {
                let body: serde_json::Value = resp.json().await.unwrap_or(json!({}));
                let models = extract_model_ids(&body);
                Ok(ProviderConnectionTestResult {
                    success: true,
                    message: format!("Connected — {}ms, {} models available", latency_ms, models.len()),
                    latency_ms,
                    models,
                })
            } else {
                let status = resp.status().as_u16();
                let error_text = resp.text().await.unwrap_or_default();
                let msg = if error_text.len() > 200 {
                    format!("{}...", &error_text[..200])
                } else {
                    error_text
                };
                Ok(ProviderConnectionTestResult {
                    success: false,
                    message: format!("HTTP {}: {}", status, msg),
                    latency_ms,
                    models: vec![],
                })
            }
        }
        Err(e) => {
            Ok(ProviderConnectionTestResult {
                success: false,
                message: format!("Connection failed: {}", e),
                latency_ms,
                models: vec![],
            })
        }
    }
}

/// Extract model IDs from various API response shapes
fn extract_model_ids(body: &serde_json::Value) -> Vec<String> {
    // OpenAI: { data: [{ id: "gpt-4", ... }] }
    if let Some(data) = body.get("data").and_then(|d| d.as_array()) {
        let ids: Vec<String> = data.iter()
            .filter_map(|item| item.get("id").and_then(|id| id.as_str()))
            .map(|s| s.to_string())
            .collect();
        if !ids.is_empty() { return ids; }
    }
    // DeepSeek / simple: { data: ["deepseek-chat", ...] }
    if let Some(data) = body.get("data").and_then(|d| d.as_array()) {
        let ids: Vec<String> = data.iter()
            .filter_map(|item| item.as_str())
            .map(|s| s.to_string())
            .collect();
        if !ids.is_empty() { return ids; }
    }
    // Fallback: { models: [{ id: "..." }] }
    if let Some(models) = body.get("models").and_then(|m| m.as_array()) {
        let ids: Vec<String> = models.iter()
            .filter_map(|item| item.get("id").and_then(|id| id.as_str()))
            .map(|s| s.to_string())
            .collect();
        if !ids.is_empty() { return ids; }
    }
    vec![]
}
