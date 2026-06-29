//! Impresión de tickets ESC/POS.
//!
//! - `list_printers`  -> impresoras del sistema.
//! - `print_test`     -> ticket de prueba (formato + QR + corte).
//! - `print_ticket`   -> ticket real desde un payload validado.
//!
//! El envío de bytes RAW es cross-platform vía el crate `printers`
//! (datatype RAW en Windows; `lp`/CUPS en macOS/Linux).
//!
//! SEGURIDAD: la clave HMAC que firma el QR NO vive acá. El backend firma el
//! payload y el desktop solo recibe `qr_data` ya firmado y lo imprime.

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

#[derive(Debug, thiserror::Error)]
pub enum PrintError {
    #[error("impresora no encontrada: {0}")]
    PrinterNotFound(String),
    #[error("input inválido: {0}")]
    InvalidInput(String),
    #[error("fallo al imprimir: {0}")]
    PrintFailed(String),
}

// El error se serializa como string para que el frontend lo muestre tal cual.
impl Serialize for PrintError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// ---------------------------------------------------------------------------
// Tipos de datos cruzando el puente JS <-> Rust
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct PrinterInfo {
    pub name: String,
    pub system_name: String,
    pub is_default: bool,
}

/// Una línea del cuerpo del ticket.
#[derive(Debug, Deserialize)]
pub struct TicketLine {
    pub text: String,
    #[serde(default)]
    pub bold: bool,
    /// "left" | "center" | "right"
    #[serde(default = "default_align")]
    pub align: String,
    /// duplica ancho y alto del glifo
    #[serde(default)]
    pub big: bool,
}

fn default_align() -> String {
    "left".to_string()
}

/// Payload de un ticket. Los montos llegan en CENTAVOS (entero), nunca float.
#[derive(Debug, Deserialize)]
pub struct TicketData {
    pub printer: String,
    /// Encabezado (nombre del evento / negocio).
    pub title: String,
    /// Líneas del cuerpo.
    #[serde(default)]
    pub lines: Vec<TicketLine>,
    /// Contenido del QR ya firmado por el backend (opcional).
    #[serde(default)]
    pub qr_data: Option<String>,
    /// Total en centavos (entero). Se formatea como dinero al imprimir.
    #[serde(default)]
    pub total_cents: Option<i64>,
    /// Pie de página (opcional).
    #[serde(default)]
    pub footer: Option<String>,
}

// Límites de validación (defensa en profundidad en el lado Rust).
const MAX_NAME_LEN: usize = 256;
const MAX_TEXT_LEN: usize = 4096;
const MAX_LINES: usize = 200;
const MAX_QR_LEN: usize = 1024; // QR model 2 admite mucho, pero acotamos.

// ---------------------------------------------------------------------------
// ESC/POS: builder de bytes
// ---------------------------------------------------------------------------

const ESC: u8 = 0x1B;
const GS: u8 = 0x1D;

struct EscPos {
    buf: Vec<u8>,
}

impl EscPos {
    fn new() -> Self {
        let mut e = EscPos { buf: Vec::new() };
        // ESC @  -> init / reset
        e.buf.extend_from_slice(&[ESC, b'@']);
        e
    }

    fn align(&mut self, a: &str) -> &mut Self {
        let n = match a {
            "center" => 1,
            "right" => 2,
            _ => 0,
        };
        self.buf.extend_from_slice(&[ESC, b'a', n]);
        self
    }

    fn bold(&mut self, on: bool) -> &mut Self {
        self.buf.extend_from_slice(&[ESC, b'E', on as u8]);
        self
    }

    /// GS ! n  -> tamaño (bit4 = doble alto, bit0..3 doble ancho).
    fn size(&mut self, big: bool) -> &mut Self {
        let n = if big { 0x11 } else { 0x00 };
        self.buf.extend_from_slice(&[GS, b'!', n]);
        self
    }

    fn text(&mut self, s: &str) -> &mut Self {
        // ESC/POS clásico es de 1 byte; degradamos no-ASCII a '?' para evitar
        // basura en impresoras que no tienen la codepage cargada.
        for ch in s.chars() {
            if ch as u32 <= 0x7F {
                self.buf.push(ch as u8);
            } else {
                self.buf.push(b'?');
            }
        }
        self
    }

    fn feed(&mut self, n: u8) -> &mut Self {
        // ESC d n -> avanza n líneas
        self.buf.extend_from_slice(&[ESC, b'd', n]);
        self
    }

    fn newline(&mut self) -> &mut Self {
        self.buf.push(b'\n');
        self
    }

    /// QR code model 2 (GS ( k).
    fn qr(&mut self, data: &str) -> &mut Self {
        let bytes = data.as_bytes();
        // Tamaño de módulo (1..16). 6 = legible en 80mm.
        self.buf
            .extend_from_slice(&[GS, b'(', b'k', 0x03, 0x00, 0x31, 0x43, 0x06]);
        // Nivel de corrección de error: 48=L 49=M 50=Q 51=H. M es buen balance.
        self.buf
            .extend_from_slice(&[GS, b'(', b'k', 0x03, 0x00, 0x31, 0x45, 0x31]);
        // Guardar datos en el buffer de símbolo.
        let len = bytes.len() + 3;
        let pl = (len & 0xFF) as u8;
        let ph = ((len >> 8) & 0xFF) as u8;
        self.buf
            .extend_from_slice(&[GS, b'(', b'k', pl, ph, 0x31, 0x50, 0x30]);
        self.buf.extend_from_slice(bytes);
        // Imprimir el símbolo almacenado.
        self.buf
            .extend_from_slice(&[GS, b'(', b'k', 0x03, 0x00, 0x31, 0x51, 0x30]);
        self
    }

    /// GS V 66 n -> corte parcial con avance.
    fn cut(&mut self) -> &mut Self {
        self.buf.extend_from_slice(&[GS, b'V', 66, 0x00]);
        self
    }

    fn into_bytes(self) -> Vec<u8> {
        self.buf
    }
}

/// Formatea centavos como "$ 1.234,56" (es-AR).
fn format_money(cents: i64) -> String {
    let sign = if cents < 0 { "-" } else { "" };
    let cents = cents.abs();
    let whole = cents / 100;
    let frac = cents % 100;
    // Separador de miles con punto.
    let whole_str = {
        let s = whole.to_string();
        let bytes = s.as_bytes();
        let mut out = String::new();
        let n = bytes.len();
        for (i, b) in bytes.iter().enumerate() {
            if i > 0 && (n - i) % 3 == 0 {
                out.push('.');
            }
            out.push(*b as char);
        }
        out
    };
    format!("{}$ {},{:02}", sign, whole_str, frac)
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

fn validate_printer_name(name: &str) -> Result<(), PrintError> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(PrintError::InvalidInput("nombre de impresora vacío".into()));
    }
    if name.len() > MAX_NAME_LEN {
        return Err(PrintError::InvalidInput("nombre de impresora demasiado largo".into()));
    }
    Ok(())
}

fn validate_ticket(t: &TicketData) -> Result<(), PrintError> {
    validate_printer_name(&t.printer)?;
    if t.title.len() > MAX_TEXT_LEN {
        return Err(PrintError::InvalidInput("title demasiado largo".into()));
    }
    if t.lines.len() > MAX_LINES {
        return Err(PrintError::InvalidInput("demasiadas líneas".into()));
    }
    for l in &t.lines {
        if l.text.len() > MAX_TEXT_LEN {
            return Err(PrintError::InvalidInput("línea demasiado larga".into()));
        }
    }
    if let Some(q) = &t.qr_data {
        if q.len() > MAX_QR_LEN {
            return Err(PrintError::InvalidInput("qr_data demasiado largo".into()));
        }
    }
    if let Some(f) = &t.footer {
        if f.len() > MAX_TEXT_LEN {
            return Err(PrintError::InvalidInput("footer demasiado largo".into()));
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Envío RAW al spooler
// ---------------------------------------------------------------------------

fn send_raw(printer_name: &str, bytes: Vec<u8>) -> Result<(), PrintError> {
    let printer = printers::get_printers()
        .into_iter()
        .find(|p| p.name == printer_name || p.system_name == printer_name)
        .ok_or_else(|| PrintError::PrinterNotFound(printer_name.to_string()))?;
    // `none()` = job sin conversión: manda los bytes ESC/POS RAW tal cual.
    printer
        .print(&bytes, printers::common::base::job::PrinterJobOptions::none())
        .map_err(|e| PrintError::PrintFailed(format!("{e:?}")))?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Comandos Tauri
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn list_printers() -> Result<Vec<PrinterInfo>, PrintError> {
    let printers = printers::get_printers();
    let out = printers
        .into_iter()
        .map(|p| PrinterInfo {
            name: p.name.clone(),
            system_name: p.system_name.clone(),
            is_default: p.is_default,
        })
        .collect();
    Ok(out)
}

#[tauri::command]
pub fn print_test(printer: String) -> Result<(), PrintError> {
    validate_printer_name(&printer)?;
    let mut e = EscPos::new();
    e.align("center")
        .size(true)
        .bold(true)
        .text("VIBRATICKETS")
        .newline()
        .bold(false)
        .size(false)
        .text("Ticket de prueba")
        .newline()
        .text("--------------------------------")
        .newline()
        .align("left")
        .text("Si lees esto, la impresora")
        .newline()
        .text("responde a comandos ESC/POS.")
        .newline()
        .align("center")
        .qr("VIBRATICKETS-TEST")
        .feed(2)
        .cut();
    send_raw(&printer, e.into_bytes())
}

#[tauri::command]
pub fn print_ticket(ticket: TicketData) -> Result<(), PrintError> {
    validate_ticket(&ticket)?;

    let mut e = EscPos::new();
    // Encabezado
    e.align("center").size(true).bold(true).text(&ticket.title).newline();
    e.size(false).bold(false);
    e.text("--------------------------------").newline();

    // Cuerpo
    e.align("left");
    for l in &ticket.lines {
        e.align(&l.align).bold(l.bold).size(l.big).text(&l.text).newline();
    }
    e.bold(false).size(false);

    // Total (entero en centavos)
    if let Some(cents) = ticket.total_cents {
        e.text("--------------------------------").newline();
        e.align("right").size(true).bold(true);
        e.text(&format!("TOTAL  {}", format_money(cents))).newline();
        e.size(false).bold(false);
    }

    // QR firmado por el backend
    if let Some(qr) = &ticket.qr_data {
        e.feed(1).align("center").qr(qr);
    }

    // Pie
    if let Some(footer) = &ticket.footer {
        e.feed(1).align("center").text(footer).newline();
    }

    e.feed(2).cut();
    send_raw(&ticket.printer, e.into_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn money_formats_cents_without_float() {
        assert_eq!(format_money(0), "$ 0,00");
        assert_eq!(format_money(5), "$ 0,05");
        assert_eq!(format_money(123456), "$ 1.234,56");
        assert_eq!(format_money(100000000), "$ 1.000.000,00");
        assert_eq!(format_money(-2550), "-$ 25,50");
    }

    #[test]
    fn empty_printer_name_is_rejected() {
        assert!(validate_printer_name("   ").is_err());
        assert!(validate_printer_name("EPSON TM-T20").is_ok());
    }

    #[test]
    fn escpos_starts_with_init() {
        let bytes = EscPos::new().into_bytes();
        assert_eq!(&bytes[0..2], &[ESC, b'@']);
    }
}
