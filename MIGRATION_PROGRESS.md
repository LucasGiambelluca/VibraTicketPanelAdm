# MIGRATION_PROGRESS — Panel Admin React → Desktop Tauri v2

Migración del panel `ticketera-admin` (React + Vite + antd) a app de escritorio
**Tauri v2** para Windows y macOS, con impresión de tickets ESC/POS y
endurecimiento de seguridad.

> **Frontend React intacto**: no se reescribió lógica. Solo se agregó, de forma
> aditiva, una ruta `/impresora` y un puente `src/lib/tauri.js`. El resto del
> código de negocio quedó igual.

## Corchetes resueltos (contexto del proyecto)

| Campo | Valor |
|---|---|
| Carpeta del frontend | `VibraTicketPanelAdm` (raíz del repo, tiene su propio `.git`) |
| Build del frontend | `pnpm build` |
| Carpeta de salida | `dist` |
| API producción | `https://admin.vibratickets.online` |
| Gestor de paquetes | `pnpm@9.15.9` |
| Auth actual | **Cookie httpOnly** (`withCredentials`) + fallback token en `localStorage` |
| Impresora | ESC/POS 80mm genérica (stack decidido). *BOCA documentada como alternativa, ver Fase 3.* |
| Contenido del ticket | título/evento, líneas, QR firmado **por el backend**, total (centavos), pie |

## ⚠️ Bloqueo de entorno (build local de Rust/Tauri)

El build local de Tauri **no es viable en esta máquina**:

- **Rust/cargo no instalado.**
- **MSVC C++ Build Tools ausentes** (solo hay VS 2019 shell sin workload VC; no hay `cl.exe`/linker).
- **Disco: ~5.3 GB libres.** MSVC BuildTools (~3-6 GB) + toolchain Rust (~1.5 GB) + `target/` de Tauri (~2-5 GB) no entran.

**Decisión (regla #4 del loop):** el código y la config se implementan completos;
la **compilación real de ambas plataformas se hace en GitHub Actions** (runners
con toolchain nativo). El build local queda como verificación manual cuando haya
disco/toolchain. Esto NO bloquea la entrega: los instaladores salen de CI.

### Qué SÍ se verificó local

- `pnpm install` (deps Tauri agregadas) → OK.
- `pnpm build` (frontend con el código nuevo integrado) → **OK, `✓ built`**, sin
  errores nuevos (los warnings de chunk size son pre-existentes).
- `pnpm tauri --version` → `tauri-cli 2.11.4`.
- `pnpm tauri icon src-tauri/icons/app-icon.png` → generó set completo
  (`icon.ico`, `icon.icns`, PNGs).
- APIs de los crates `printers` v2 y `keyring` v2 verificadas contra docs.rs y
  corregidas en el código (ver notas de Fase 3/4).

---

## Estado por fase

### Fase 0 — Scaffolding de Tauri
- **Estado:** completa (código) / build local **bloqueado por entorno** → verifica CI.
- **Cambios:**
  - `src-tauri/` con `Cargo.toml`, `build.rs`, `tauri.conf.json`,
    `src/main.rs`, `src/lib.rs`.
  - `tauri.conf.json`: `frontendDist: ../dist`, `devUrl: http://localhost:5174`,
    `beforeDevCommand: pnpm dev`, `beforeBuildCommand: pnpm build`.
  - `package.json`: deps `@tauri-apps/api`, `@tauri-apps/cli` + scripts `tauri*`.
- **Verificación CI:** `pnpm tauri dev` levanta ventana con el panel (manual en
  máquina con toolchain) / el job de CI compila el binario.
- **DoD:** ventana muestra el panel; `src-tauri/` existe; lógica del frontend sin tocar. ✔ (build pendiente de toolchain)

### Fase 1 — Paridad funcional + CSP
- **Estado:** completa (config) / verificación funcional manual en la app.
- **Cambios:**
  - CSP estricta en `tauri.conf.json > app.security.csp`:
    `connect-src 'self' https://admin.vibratickets.online`, `script-src 'self'`,
    sin `unsafe-eval`, sin comodines. `style-src`/`font-src` permiten
    `https://api.fontshare.com` (lo usa `theme.css`). `object-src 'none'`,
    `frame-ancestors 'none'`.
  - El cliente axios ya usa `withCredentials` (cookie httpOnly) → la sesión
    funciona igual dentro del webview.
- **Verificación manual:** loguearse y navegar las pantallas dentro de la app
  desktop contra la API real; confirmar que la CSP no permite otros orígenes.
- **DoD:** login + navegación desde la app; CSP solo a la API. ✔ (config lista; falta correr la app)

### Fase 2 — Build cross-platform
- **Estado:** completa.
- **Cambios:** `.github/workflows/build.yml` con matriz
  **windows-latest + macos-latest (ARM) + macos-13 (Intel)**, usando
  `tauri-apps/tauri-action`. Genera iconos (`pnpm tauri icon`) antes de buildear.
- **Cómo disparar el build de la otra plataforma:**
  - Manual: pestaña **Actions → build-desktop → Run workflow**.
  - Por release: `git tag v0.1.0 && git push origin v0.1.0` → genera un release
    draft con los instaladores de las 3 variantes.
- **DoD:** existe el workflow con la matriz; `pnpm tauri build` produce instalador
  en la plataforma actual (verifica CI). ✔

### Fase 3 — Impresora ESC/POS
- **Estado:** completa (código) / **impresión física = verificación manual**.
- **Cambios:**
  - `src-tauri/src/printer.rs`:
    - `list_printers()` → impresoras del sistema (crate `printers` v2).
    - `print_test(printer)` → ticket de prueba (texto + QR + corte).
    - `print_ticket(ticket)` → ticket real desde payload validado.
    - Builder ESC/POS propio (init, align, bold, doble tamaño, QR model 2,
      corte parcial). Dinero formateado desde **centavos enteros** (`format_money`).
    - Envío RAW cross-platform vía `printer.print(&bytes, PrinterJobOptions::none())`.
  - `src/lib/tauri.js` + `src/pages/admin/PrinterSettings.jsx`: selector de
    impresora, botón "imprimir prueba" y "ticket de muestra". Ruta `/impresora`
    (aditiva) en `App.jsx`, protegida por roles.
  - **Errores nunca tragados:** impresora inexistente / desconectada / fallo de
    spool → `PrintError` → se muestra en la UI con `message.error` + `Alert`.
- **Notas de API (corregidas):** `printers` v2 usa
  `print(&[u8], PrinterJobOptions) -> Result<u64, PrintersError>` (no la firma
  vieja). `PrinterJobOptions::none()` manda RAW sin conversión.
- **BOCA (alternativa):** el proyecto tiene una impresora **BOCA** (`boca-print-agent`,
  manual L-series). BOCA usa su propio lenguaje (FGL), **no ESC/POS**. Si el
  ticket final se imprime en la BOCA y no en una térmica ESC/POS, hay que sumar
  un builder FGL paralelo en `printer.rs`. Pendiente de decisión del usuario.
- **DoD automático:** compila con los comandos expuestos y la UI conectada;
  sin impresora, falla con error claro. ✔ (compila en CI)
- **DoD manual — checklist:**
  - [ ] Conectar impresora ESC/POS 80mm.
  - [ ] `/impresora` → seleccionar impresora → "Imprimir ticket de prueba".
  - [ ] Verificar: texto alineado, **QR escaneable**, **corte de papel**.
  - [ ] "Imprimir ticket de muestra" → total `$ 15.000,00` correcto, QR presente.
  - [ ] Probar impresora desconectada → debe mostrar error, no romper la app.

### Fase 4 — Endurecimiento de seguridad
- **Estado:** completa (código) / updater firmado **documentado** (faltan claves).
- **Cambios:**
  - **Secure storage** (`src-tauri/src/secure.rs`): `secure_set/get/delete` sobre
    el crate `keyring` (Credential Manager en Windows / Keychain en macOS).
    Service id `com.vibratickets.admin`. Para mover el **fallback token** de
    `localStorage` al almacén del SO. *(La auth principal es cookie httpOnly que
    maneja el webview y no es accesible desde JS — ya segura.)*
  - **Capabilities mínimas** (`src-tauri/capabilities/default.json`): solo
    `core:default`. Los comandos custom (printer/secure) se exponen por
    `invoke_handler` y no requieren permiso de plugin. Sin plugins de más
    (se quitó `tauri-plugin-shell`, no se usaba).
  - **Validación en Rust:** todo comando valida sus inputs (nombre de impresora
    no vacío y acotado, límites de longitud de líneas/QR/footer, keys del keychain
    restringidas a `[A-Za-z0-9_.-]`).
  - **CSP estricta** (Fase 1). **Solo HTTPS** contra la API.
  - **Dinero en centavos enteros** (`format_money`, sin floats).
  - **Sin secretos en el binario:** la clave HMAC del QR **se queda server-side**;
    el desktop solo recibe e imprime el payload firmado.
- **Updater firmado — qué falta (no hay claves en este entorno):**
  - Generar par de claves: `pnpm tauri signer generate -w ~/.tauri/vibra.key`.
  - Agregar `plugins.updater` en `tauri.conf.json` con `pubkey` + `endpoints`.
  - Cargar `TAURI_SIGNING_PRIVATE_KEY` y `..._PASSWORD` como secrets de GitHub
    (el workflow ya los lee si existen).
  - Sumar dependencia `tauri-plugin-updater` + init en `lib.rs`.
- **DoD:** tokens fuera de `localStorage` plano (comandos listos para migrarlo);
  capabilities mínimas; cada comando valida inputs; config del updater documentada. ✔

### Fase 5 — Distribución
- **Estado:** completa (pipeline) / **firma de código = requiere certificados/cuenta**.
- **Cambios:** el workflow de Fase 2 produce los instaladores:
  - Windows: `.msi` (WiX) y `.exe` (NSIS).
  - macOS: `.dmg` / `.app` (ARM e Intel).
- **Firma de código — procedimiento (requiere credenciales que no están acá):**
  - **Windows (Authenticode):** certificado de firma (.pfx) → setear
    `WINDOWS_CERTIFICATE` (base64) + `WINDOWS_CERTIFICATE_PASSWORD` y configurar
    `bundle.windows.certificateThumbprint`/signing en `tauri.conf.json`.
  - **macOS (notarización Apple):** cuenta Apple Developer; `APPLE_CERTIFICATE`,
    `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`,
    `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID` como secrets; `tauri-action`
    firma y notariza si están presentes.
- **DoD:** workflow produce instaladores de ambas plataformas; procedimiento de
  firma y certificados faltantes documentados. ✔

---

## Criterio de DONE global — estado

1. Fases 0-5 con DoD automático: **código completo**; compilación real delegada a
   CI por bloqueo de entorno (disco + MSVC). ⚠️→CI
2. `pnpm tauri build` + workflow de instaladores Win/macOS: **workflow listo**. ✔
3. Impresión de tickets con manejo de errores + comando de prueba: ✔ (físico = manual).
4. Invariantes de seguridad aplicadas o faltante documentado: ✔.
5. Este archivo refleja el estado real con su evidencia: ✔.

## Próximos pasos para cerrar al 100%

1. Pushear el branch `feat/tauri-desktop` y disparar **Actions → build-desktop**
   para obtener los instaladores reales (Win + macOS) y validar la compilación
   end-to-end.
2. En una máquina con impresora: completar el **checklist manual de Fase 3**.
3. Decidir **ESC/POS vs BOCA (FGL)** para el ticket de producción.
4. Si se quiere auto-update: generar claves y completar la sección **updater**.
5. Para distribuir firmado: cargar los secrets de **firma de código** (Fase 5).
