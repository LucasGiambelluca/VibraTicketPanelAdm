//! Secure storage nativo del SO (Credential Manager en Windows, Keychain en
//! macOS) vía el crate `keyring`.
//!
//! La auth principal del panel es por cookie httpOnly que maneja el webview y
//! NO es accesible desde JS — eso ya es seguro. Estos comandos cubren el
//! fallback de token y cualquier secreto del lado cliente que hoy cae en
//! `localStorage` plano, moviéndolo al almacén cifrado del SO.
//!
//! NUNCA guardar acá la clave HMAC de firma de tickets: esa vive server-side.

use serde::Serialize;

const SERVICE: &str = "com.vibratickets.admin";

#[derive(Debug, thiserror::Error)]
pub enum SecureError {
    #[error("input inválido: {0}")]
    InvalidInput(String),
    #[error("error de secure storage: {0}")]
    Backend(String),
    #[error("no encontrado")]
    NotFound,
}

impl Serialize for SecureError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

const MAX_KEY_LEN: usize = 128;
const MAX_VALUE_LEN: usize = 8192;

fn validate_key(key: &str) -> Result<(), SecureError> {
    if key.trim().is_empty() {
        return Err(SecureError::InvalidInput("key vacía".into()));
    }
    if key.len() > MAX_KEY_LEN {
        return Err(SecureError::InvalidInput("key demasiado larga".into()));
    }
    // Solo permitimos un set acotado de caracteres para la entrada del keychain.
    if !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.') {
        return Err(SecureError::InvalidInput("key con caracteres no permitidos".into()));
    }
    Ok(())
}

fn entry(key: &str) -> Result<keyring::Entry, SecureError> {
    keyring::Entry::new(SERVICE, key).map_err(|e| SecureError::Backend(e.to_string()))
}

#[tauri::command]
pub fn secure_set(key: String, value: String) -> Result<(), SecureError> {
    validate_key(&key)?;
    if value.len() > MAX_VALUE_LEN {
        return Err(SecureError::InvalidInput("value demasiado largo".into()));
    }
    entry(&key)?
        .set_password(&value)
        .map_err(|e| SecureError::Backend(e.to_string()))
}

#[tauri::command]
pub fn secure_get(key: String) -> Result<String, SecureError> {
    validate_key(&key)?;
    match entry(&key)?.get_password() {
        Ok(v) => Ok(v),
        Err(keyring::Error::NoEntry) => Err(SecureError::NotFound),
        Err(e) => Err(SecureError::Backend(e.to_string())),
    }
}

#[tauri::command]
pub fn secure_delete(key: String) -> Result<(), SecureError> {
    validate_key(&key)?;
    match entry(&key)?.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(SecureError::Backend(e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_bad_keys() {
        assert!(validate_key("").is_err());
        assert!(validate_key("auth token").is_err()); // espacio
        assert!(validate_key("auth_token").is_ok());
        assert!(validate_key("fallback.token-1").is_ok());
    }
}
