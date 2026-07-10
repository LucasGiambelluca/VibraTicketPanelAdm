//! Cliente HTTP del core. El frontend (axios) enruta sus llamadas a la API por
//! acá vía `invoke`, en lugar de hacerlas desde el webview. Beneficios:
//!   - **Sin CORS**: reqwest no es un navegador; el backend no ve un Origin raro.
//!   - **Cookie de sesión persistente**: el cookie jar nativo guarda la cookie
//!     httpOnly de login y la reenvía en cada request (sin third-party cookie
//!     blocking del WebView2).
//!
//! Hardening: solo se permiten requests al host de la API.

use std::collections::HashMap;
use std::time::Duration;

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::State;

// Único host permitido para salir. Evita que un comando se use como proxy SSRF.
const API_HOST: &str = "admin.vibratickets.online";

pub struct ApiState {
    pub client: reqwest::Client,
}

impl ApiState {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .cookie_store(true)
            .user_agent("VibraTicketsAdmin/0.1 (desktop)")
            .timeout(Duration::from_secs(30))
            .build()
            .expect("no se pudo construir el cliente HTTP");
        ApiState { client }
    }
}

#[derive(Serialize)]
pub struct ApiResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
}

#[tauri::command]
pub async fn api_fetch(
    state: State<'_, ApiState>,
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: Option<String>,
) -> Result<ApiResponse, String> {
    // Validar host: solo la API.
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("URL inválida: {e}"))?;
    if parsed.host_str() != Some(API_HOST) || parsed.scheme() != "https" {
        return Err(format!("host no permitido: {}", parsed.host_str().unwrap_or("")));
    }

    let m = reqwest::Method::from_bytes(method.to_uppercase().as_bytes())
        .map_err(|_| format!("método inválido: {method}"))?;

    let mut req = state.client.request(m, parsed);
    for (k, v) in headers {
        // Saltear headers que reqwest maneja solo / que no deben reenviarse.
        let kl = k.to_ascii_lowercase();
        if kl == "host" || kl == "content-length" || kl == "connection" {
            continue;
        }
        req = req.header(k, v);
    }
    if let Some(b) = body {
        req = req.body(b);
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();

    let mut out_headers = HashMap::new();
    for (k, v) in resp.headers().iter() {
        if let Ok(s) = v.to_str() {
            out_headers.insert(k.as_str().to_string(), s.to_string());
        }
    }

    let text = resp.text().await.map_err(|e| e.to_string())?;

    Ok(ApiResponse {
        status,
        headers: out_headers,
        body: text,
    })
}

// --- Subida de archivos (multipart/form-data) --------------------------------
//
// `api_fetch` no sirve para esto: su `body` es un `Option<String>`, así que un
// FormData del lado JS terminaba serializado como el string literal "{}". Este
// comando arma el multipart nativo con reqwest (boundary incluido) a partir de
// campos de texto + archivos en base64 (el JS no puede mandar bytes crudos por
// `invoke`, así que viajan codificados y se decodifican acá).

/// Un archivo a subir. `data_base64` llega desde JS como `dataBase64`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadFile {
    pub filename: String,
    pub mime: String,
    pub data_base64: String,
}

fn decode_base64(s: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| format!("base64 inválido: {e}"))
}

#[tauri::command]
pub async fn api_upload(
    state: State<'_, ApiState>,
    method: String,
    url: String,
    headers: HashMap<String, String>,
    fields: HashMap<String, String>,
    files: HashMap<String, UploadFile>,
) -> Result<ApiResponse, String> {
    // Mismo guard de host que api_fetch: solo la API.
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("URL inválida: {e}"))?;
    if parsed.host_str() != Some(API_HOST) || parsed.scheme() != "https" {
        return Err(format!("host no permitido: {}", parsed.host_str().unwrap_or("")));
    }

    let m = reqwest::Method::from_bytes(method.to_uppercase().as_bytes())
        .map_err(|_| format!("método inválido: {method}"))?;

    let mut form = reqwest::multipart::Form::new();
    for (k, v) in fields {
        form = form.text(k, v);
    }
    for (k, f) in files {
        let bytes = decode_base64(&f.data_base64)?;
        let part = reqwest::multipart::Part::bytes(bytes)
            .file_name(f.filename)
            .mime_str(&f.mime)
            .map_err(|e| format!("mime inválido para {k}: {e}"))?;
        form = form.part(k, part);
    }

    // `.multipart(form)` fija el Content-Type con boundary; los headers de
    // abajo NO deben pisarlo (por eso se saltea content-type acá también,
    // aunque el adapter JS ya lo remueve antes de invocar este comando).
    let mut req = state.client.request(m, parsed).multipart(form);
    for (k, v) in headers {
        let kl = k.to_ascii_lowercase();
        if kl == "host" || kl == "content-length" || kl == "connection" || kl == "content-type" {
            continue;
        }
        req = req.header(k, v);
    }

    let resp = req.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();

    let mut out_headers = HashMap::new();
    for (k, v) in resp.headers().iter() {
        if let Ok(s) = v.to_str() {
            out_headers.insert(k.as_str().to_string(), s.to_string());
        }
    }

    let text = resp.text().await.map_err(|e| e.to_string())?;

    Ok(ApiResponse {
        status,
        headers: out_headers,
        body: text,
    })
}
