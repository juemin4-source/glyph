use std::sync::{Arc, Mutex};

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use tower_http::cors::CorsLayer;

use crate::db::Database;
use crate::models::{Project, WorldObject};

// ── Request / Response types ──

#[derive(serde::Deserialize)]
struct CreateProjectPayload {
    name: String,
    #[serde(default)]
    genre: String,
    #[serde(default)]
    status: String,
    #[serde(default)]
    word_count: i64,
    #[serde(default)]
    gradient: String,
}

#[derive(serde::Serialize)]
struct DeleteResponse {
    deleted: bool,
}

#[derive(serde::Serialize)]
struct PingResponse {
    status: String,
}

#[derive(serde::Serialize)]
struct ErrorResponse {
    error: String,
}

// ── Start API server ──

/// Start the HTTP API server on 127.0.0.1:{port}.
/// Port defaults to 21778, overridable via `GLYPH_API_PORT` env var.
/// Runs on the existing Tauri tokio runtime via `tokio::spawn`.
pub fn start_api_server(db: Database) {
    let port: u16 = std::env::var("GLYPH_API_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(21778);

    let state = Arc::new(Mutex::new(db));

    let app = Router::new()
        // Health check
        .route("/api/ping", get(ping_handler))
        // Project CRUD
        .route(
            "/api/projects",
            get(list_projects_handler).post(create_project_handler),
        )
        .route(
            "/api/projects/{id}",
            get(get_project_handler)
                .put(update_project_handler)
                .delete(delete_project_handler),
        )
        .route("/api/projects/{id}/objects", get(list_objects_handler))
        // WorldObject CRUD
        .route("/api/objects", post(create_object_handler))
        .route(
            "/api/objects/{id}",
            get(get_object_handler)
                .put(update_object_handler)
                .delete(delete_object_handler),
        )
        .layer(CorsLayer::permissive())
        .with_state(state);

    tokio::spawn(async move {
        let addr = format!("127.0.0.1:{}", port);
        eprintln!("[glyph-api] Listening on http://{}", addr);
        let listener = tokio::net::TcpListener::bind(&addr)
            .await
            .expect("Failed to bind API server");
        axum::serve(listener, app)
            .await
            .expect("API server exited with error");
    });
}

// ── Handler helpers ──

fn internal_error<E: std::fmt::Display>(e: E) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: e.to_string(),
        }),
    )
}

fn not_found(msg: &str) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::NOT_FOUND,
        Json(ErrorResponse {
            error: msg.to_string(),
        }),
    )
}

// ── Handlers ──

async fn ping_handler() -> Json<PingResponse> {
    Json(PingResponse {
        status: "ok".to_string(),
    })
}

// ── Project handlers ──

async fn list_projects_handler(
    State(db): State<Arc<Mutex<Database>>>,
) -> impl IntoResponse {
    let db = db.lock().unwrap();
    match db.list_projects() {
        Ok(projects) => (StatusCode::OK, Json(projects)).into_response(),
        Err(e) => internal_error(e).into_response(),
    }
}

async fn create_project_handler(
    State(db): State<Arc<Mutex<Database>>>,
    Json(payload): Json<CreateProjectPayload>,
) -> impl IntoResponse {
    let db = db.lock().unwrap();
    match db.create_project(
        &payload.name,
        &payload.genre,
        &payload.status,
        payload.word_count,
        &payload.gradient,
    ) {
        Ok(project) => (StatusCode::CREATED, Json(project)).into_response(),
        Err(e) => internal_error(e).into_response(),
    }
}

async fn get_project_handler(
    State(db): State<Arc<Mutex<Database>>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = db.lock().unwrap();
    match db.get_project(&id) {
        Ok(Some(project)) => (StatusCode::OK, Json(project)).into_response(),
        Ok(None) => not_found("project not found").into_response(),
        Err(e) => internal_error(e).into_response(),
    }
}

async fn update_project_handler(
    State(db): State<Arc<Mutex<Database>>>,
    Path(id): Path<String>,
    Json(payload): Json<Project>,
) -> impl IntoResponse {
    let db = db.lock().unwrap();
    let mut project = payload;
    project.id = id;
    match db.update_project(&project) {
        Ok(_) => (StatusCode::OK, Json(project)).into_response(),
        Err(e) => internal_error(e).into_response(),
    }
}

async fn delete_project_handler(
    State(db): State<Arc<Mutex<Database>>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = db.lock().unwrap();
    match db.delete_project(&id) {
        Ok(_) => (StatusCode::OK, Json(DeleteResponse { deleted: true })).into_response(),
        Err(e) => internal_error(e).into_response(),
    }
}

// ── WorldObject handlers ──

async fn list_objects_handler(
    State(db): State<Arc<Mutex<Database>>>,
    Path(project_id): Path<String>,
) -> impl IntoResponse {
    let db = db.lock().unwrap();
    match db.list_world_objects(&project_id) {
        Ok(objects) => (StatusCode::OK, Json(objects)).into_response(),
        Err(e) => internal_error(e).into_response(),
    }
}

async fn create_object_handler(
    State(db): State<Arc<Mutex<Database>>>,
    Json(payload): Json<WorldObject>,
) -> impl IntoResponse {
    let db = db.lock().unwrap();
    match db.create_world_object(&payload) {
        Ok(obj) => (StatusCode::CREATED, Json(obj)).into_response(),
        Err(e) => internal_error(e).into_response(),
    }
}

async fn get_object_handler(
    State(db): State<Arc<Mutex<Database>>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = db.lock().unwrap();
    match db.get_world_object(&id) {
        Ok(Some(obj)) => (StatusCode::OK, Json(obj)).into_response(),
        Ok(None) => not_found("object not found").into_response(),
        Err(e) => internal_error(e).into_response(),
    }
}

async fn update_object_handler(
    State(db): State<Arc<Mutex<Database>>>,
    Path(id): Path<String>,
    Json(payload): Json<WorldObject>,
) -> impl IntoResponse {
    let db = db.lock().unwrap();
    let mut obj = payload;
    obj.id = id;
    match db.update_world_object(&obj) {
        Ok(_) => (StatusCode::OK, Json(obj)).into_response(),
        Err(e) => internal_error(e).into_response(),
    }
}

async fn delete_object_handler(
    State(db): State<Arc<Mutex<Database>>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = db.lock().unwrap();
    match db.delete_world_object(&id) {
        Ok(_) => (StatusCode::OK, Json(DeleteResponse { deleted: true })).into_response(),
        Err(e) => internal_error(e).into_response(),
    }
}
