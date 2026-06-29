//! Impresión nativa en impresoras BOCA (lenguaje FGL), sin agente externo.
//!
//! Replica los transportes del `boca-print-agent`:
//!   - **windows**: copia binaria (`copy /B`) del FGL al share del spooler
//!     (ej. `\\localhost\BOCA`). Es la vía RAW probada para USB con driver BOCA.
//!   - **tcp**: socket crudo a `host:9100` (BOCA Ethernet, estilo Jetdirect).
//!
//! El **FGL lo genera el backend** (`/boxoffice/tickets/.../fgl`); acá solo se
//! decodifica el base64 y se manda a la impresora. Sin claves ni secretos.

use base64::Engine;
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

// Ticket de prueba embebido (mismo FGL que el agente, marcado como desktop).
const TEST_TICKET: &str =
    "<RC30,30><F12><HW2,2>VIBRATICKETS\n<RC120,30><F8>Ticket de prueba (desktop)\n<RC60,800><QR5>{TEST-DESKTOP}\n<p>";

const MAX_FGL_BYTES: usize = 1024 * 1024; // 1 MB, igual que el agente

#[derive(Debug, thiserror::Error)]
pub enum BocaError {
    #[error("input inválido: {0}")]
    InvalidInput(String),
    #[error("error de impresión: {0}")]
    PrintFailed(String),
    #[error("impresora no accesible: {0}")]
    Unreachable(String),
}

impl Serialize for BocaError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Deserialize)]
pub struct BocaConfig {
    /// "windows" | "tcp"
    pub transport: String,
    /// Para "windows": share UNC del spooler, ej. `\\localhost\BOCA`.
    #[serde(default)]
    pub printer_share: Option<String>,
    /// Para "tcp": host/IP de la impresora.
    #[serde(default)]
    pub host: Option<String>,
    /// Para "tcp": puerto (default 9100).
    #[serde(default)]
    pub port: Option<u16>,
}

#[derive(Debug, Serialize)]
pub struct BocaStatus {
    pub ok: bool,
    pub transport: String,
    pub printer_reachable: bool,
    pub version: String,
}

// --- Validación --------------------------------------------------------------

/// Valida un share UNC `\\host\share` con el mismo criterio que el agente.
fn valid_share(s: &str) -> bool {
    if !s.starts_with("\\\\") {
        return false;
    }
    let rest = &s[2..];
    let mut parts = rest.splitn(2, '\\');
    let host = parts.next().unwrap_or("");
    let share = match parts.next() {
        Some(v) => v,
        None => return false,
    };
    if host.is_empty() || share.is_empty() {
        return false;
    }
    host.chars().all(|c| c.is_ascii_alphanumeric() || "_.-".contains(c))
        && share.chars().all(|c| c.is_ascii_alphanumeric() || "_ .-".contains(c))
}

fn decode_fgl(fgl_base64: &str) -> Result<Vec<u8>, BocaError> {
    // Pre-chequeo de charset base64 (mismo patrón que el agente).
    if fgl_base64.is_empty()
        || !fgl_base64
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '/' | '=' | '\r' | '\n' | ' '))
    {
        return Err(BocaError::InvalidInput("fgl base64 inválido".into()));
    }
    let cleaned: String = fgl_base64.chars().filter(|c| !c.is_whitespace()).collect();
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(cleaned.as_bytes())
        .map_err(|e| BocaError::InvalidInput(format!("base64: {e}")))?;
    if bytes.is_empty() {
        return Err(BocaError::InvalidInput("fgl vacío".into()));
    }
    if bytes.len() > MAX_FGL_BYTES {
        return Err(BocaError::InvalidInput("fgl demasiado grande".into()));
    }
    Ok(bytes)
}

// --- Transportes -------------------------------------------------------------

static SEQ: AtomicU64 = AtomicU64::new(0);

fn print_windows(share: &str, bytes: &[u8]) -> Result<(), BocaError> {
    if !valid_share(share) {
        return Err(BocaError::InvalidInput(format!("share inválido: {share}")));
    }
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    let mut tmp = std::env::temp_dir();
    tmp.push(format!("boca-{}-{}.fgl", std::process::id(), seq));
    std::fs::write(&tmp, bytes).map_err(|e| BocaError::PrintFailed(e.to_string()))?;

    // `copy /B <tmp> <share>`: copia binaria RAW al spooler, sin que el shell
    // interprete los datos (van como argumentos, no por stdin).
    let tmp_str = tmp
        .to_str()
        .ok_or_else(|| BocaError::PrintFailed("ruta temp inválida".into()))?;
    let out = std::process::Command::new("cmd")
        .args(["/c", "copy", "/B", tmp_str, share])
        .output();
    let _ = std::fs::remove_file(&tmp);

    match out {
        Ok(o) if o.status.success() => Ok(()),
        Ok(o) => {
            let err = String::from_utf8_lossy(&o.stderr);
            let err = if err.trim().is_empty() {
                String::from_utf8_lossy(&o.stdout).to_string()
            } else {
                err.to_string()
            };
            Err(BocaError::PrintFailed(format!("spooler: {}", err.trim())))
        }
        Err(e) => Err(BocaError::PrintFailed(e.to_string())),
    }
}

fn resolve_addr(host: &str, port: u16) -> Result<std::net::SocketAddr, BocaError> {
    format!("{host}:{port}")
        .to_socket_addrs()
        .map_err(|e| BocaError::InvalidInput(format!("host inválido: {e}")))?
        .next()
        .ok_or_else(|| BocaError::InvalidInput("el host no resuelve a ninguna dirección".into()))
}

fn print_tcp(host: &str, port: u16, bytes: &[u8]) -> Result<(), BocaError> {
    let addr = resolve_addr(host, port)?;
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_secs(5))
        .map_err(|e| BocaError::Unreachable(format!("{host}:{port}: {e}")))?;
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .ok();
    stream
        .write_all(bytes)
        .map_err(|e| BocaError::PrintFailed(e.to_string()))?;
    stream.flush().map_err(|e| BocaError::PrintFailed(e.to_string()))?;
    Ok(())
}

fn check_tcp(host: &str, port: u16) -> bool {
    match resolve_addr(host, port) {
        Ok(addr) => TcpStream::connect_timeout(&addr, Duration::from_secs(3)).is_ok(),
        Err(_) => false,
    }
}

fn dispatch(config: &BocaConfig, bytes: &[u8]) -> Result<(), BocaError> {
    match config.transport.as_str() {
        "windows" => {
            let share = config
                .printer_share
                .as_deref()
                .ok_or_else(|| BocaError::InvalidInput("falta printer_share".into()))?;
            print_windows(share, bytes)
        }
        "tcp" => {
            let host = config
                .host
                .as_deref()
                .ok_or_else(|| BocaError::InvalidInput("falta host".into()))?;
            let port = config.port.unwrap_or(9100);
            print_tcp(host, port, bytes)
        }
        other => Err(BocaError::InvalidInput(format!(
            "transport desconocido: {other}"
        ))),
    }
}

// --- Comandos Tauri ----------------------------------------------------------

#[tauri::command]
pub fn boca_status(config: BocaConfig) -> Result<BocaStatus, BocaError> {
    let reachable = match config.transport.as_str() {
        "tcp" => {
            let host = config
                .host
                .as_deref()
                .ok_or_else(|| BocaError::InvalidInput("falta host".into()))?;
            check_tcp(host, config.port.unwrap_or(9100))
        }
        // En spooler no hay chequeo barato; el error real aparece al imprimir.
        "windows" => config
            .printer_share
            .as_deref()
            .map(valid_share)
            .unwrap_or(false),
        other => {
            return Err(BocaError::InvalidInput(format!(
                "transport desconocido: {other}"
            )))
        }
    };
    Ok(BocaStatus {
        ok: true,
        transport: config.transport.clone(),
        printer_reachable: reachable,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[tauri::command]
pub fn boca_print(fgl_base64: String, config: BocaConfig) -> Result<(), BocaError> {
    let bytes = decode_fgl(&fgl_base64)?;
    dispatch(&config, &bytes)
}

#[tauri::command]
pub fn boca_test(config: BocaConfig) -> Result<(), BocaError> {
    dispatch(&config, TEST_TICKET.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn share_validation() {
        assert!(valid_share(r"\\localhost\BOCA"));
        assert!(valid_share(r"\\127.0.0.1\BOCA Lemur"));
        assert!(!valid_share(r"\localhost\BOCA")); // un solo backslash
        assert!(!valid_share(r"\\localhost")); // sin share
        assert!(!valid_share(r"\\localhost\")); // share vacío
        assert!(!valid_share(r"C:\temp\x")); // no es UNC
    }

    #[test]
    fn fgl_decode_roundtrip() {
        let raw = b"<RC30,30><F12>HOLA<p>";
        let b64 = base64::engine::general_purpose::STANDARD.encode(raw);
        assert_eq!(decode_fgl(&b64).unwrap(), raw);
        assert!(decode_fgl("").is_err());
        assert!(decode_fgl("!!!notbase64!!!").is_err());
    }
}
