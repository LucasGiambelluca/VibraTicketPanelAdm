// src/components/admin/TicketDesigner.jsx
// Editor visual de la plantilla de ticket impreso (BOCA/FGL) con preview en
// vivo. No genera FGL: eso lo hace el backend (buildTicketFGL). Este
// componente solo edita `config` (posiciones/tamaños/visibilidad por zona),
// pide un preview renderizado como FGL de texto y lo dibuja con
// parseFgl + <canvas>/<div> puro (ver src/utils/fglSimulator.js).
import React, { useEffect, useRef, useState } from 'react';
import {
  Collapse,
  Slider,
  Switch,
  InputNumber,
  Checkbox,
  Input,
  Button,
  Space,
  Typography,
  Segmented,
  Alert,
  Upload,
  Spin,
  Tooltip,
  message,
} from 'antd';
import { UploadOutlined, PrinterOutlined } from '@ant-design/icons';
import {
  getTemplate,
  saveTemplate,
  deleteTemplate,
  previewTemplate,
  uploadLogo,
  getCalibration,
  saveCalibration,
  getCalibrationTicket,
} from '../../services/ticketTemplateService';
import { agentStatus, agentPrint } from '../../services/printAgentService';
import { parseFgl } from '../../utils/fglSimulator';
import TicketCanvas from './TicketCanvas';

const { Text } = Typography;
const { TextArea } = Input;

const DEFAULT_STUB_END_COL = 280;

// Talón derecho (talón de control, sin QR, rotado 180°). Default idéntico al
// del backend (fglConstants.js TALON2_START_COL): visible:false
// (retrocompatible), startCol:828 = PERF_2 nominal [CAL] (Joi 100..1112).
const TALON2_START_COL_DEFAULT = 828;

const FIXTURE_OPTIONS = [
  { label: 'Normal', value: 'normal' },
  { label: 'Invitación', value: 'invitacion' },
  { label: 'Textos largos', value: 'limite' },
];

// Fuentes disponibles, ordenadas por TAMAÑO FÍSICO REAL. Ojo: no es el orden
// de los números de fuente — F6 (34x48) es más grande que F3 (20x31), y F3 con
// multiplicador 2 es más grande que F6. Los tokens y el orden coinciden con
// SIZE_ORDER en ApiTickets/services/ticketLayout.js.
// El alto en mm sale de dots / 200 dpi * 25.4.
const FONT_OPTIONS = [
  { label: 'Chica (1,9 mm)', value: 'F2' },
  { label: 'Media (3,9 mm)', value: 'F3' },
  { label: 'Grande (6,1 mm)', value: 'F6' },
  { label: 'Enorme (7,9 mm)', value: 'F3x2' },
];

// Metadata de las zonas editables (coincide con las claves válidas de
// controllers/ticketTemplate.controller.js:configSchema en el backend).
// La zona `qr` tiene panel de posición (fila/columna) pero NO switch de
// visibilidad (noToggle): el motor SIEMPRE imprime el QR — un toggle acá
// sería un no-op engañoso.
// `fontDefault` es la fuente que aplica el motor cuando la zona no trae `font`
// explícito (services/ticketLayout.js:DEFAULT_FONTS, verificado ahí mismo — no
// en este archivo). hasFont va en TODA zona de texto: desde el refactor del
// motor de cajas la fuente elegida es el PRIMER escalón de la escalera de
// cualquier zona, no solo de evento/venue/fecha/precio (antes el resto tenía
// escalera hardcodeada y el control habría sido un no-op).
// Sin control de fuente quedan las zonas que no son texto de lectura: `qr`
// (gráfico), `logo` (bitmap) y `emision` (serial vertical de borde, único uso
// permitido de F1 — ver regla 1 de ticketLayout.js).
const ZONES = [
  { key: 'evento', label: 'Nombre del evento', hasFont: true, fontDefault: 'F3x2' },
  { key: 'venue', label: 'Venue', hasFont: true, fontDefault: 'F3' },
  { key: 'direccion', label: 'Dirección', hasFont: true, fontDefault: 'F2' },
  { key: 'fecha', label: 'Fecha y hora', hasFont: true, fontDefault: 'F3x2' },
  { key: 'sector', label: 'Sector / entrada', hasFont: true, fontDefault: 'F2' },
  { key: 'tipo', label: 'Tipo de entrada', hasFont: true, fontDefault: 'F2' },
  { key: 'precio', label: 'Precio', hasFont: true, fontDefault: 'F3' },
  { key: 'leyendas', label: 'Leyendas', hasFont: true, fontDefault: 'F2' },
  { key: 'qr', label: 'QR', hasFont: false, hasCol: true, noToggle: true },
  { key: 'marca', label: 'Marca talón', hasFont: true, hasCol: true, fontDefault: 'F2' },
  { key: 'codigo', label: 'Código talón', hasFont: true, hasCol: true, fontDefault: 'F2' },
  { key: 'emision', label: 'Fecha emisión talón', hasFont: false, hasCol: true },
  { key: 'logo', label: 'Logo', hasFont: false, hasCol: true },
];

// La caja de las leyendas se llama `restriccion` en el motor (buildBoxes) pero
// sus overrides viven bajo la clave de config `leyendas`. `boxes` viene crudo
// del backend, así que hay que traducir antes de leerlo — sin esto el aviso de
// degradación mostraría "la caja tiene 0" y el botón de ensanchar no haría nada.
const BOX_OF_ZONE = { leyendas: 'restriccion' };

// Límites físicos del cartón (ticketLayout.js: CANVAS/SAFE/buildBoxes.bodyEnd).
const SAFE_COL_MAX = 1105;
const MIN_BOX_W = 40; // igual que MIN_BOX_W del motor y el Joi de zonaSchema
const GAP = 6; // aire mínimo que dejamos contra una perforación o una caja vecina

// Rectángulo (top/bottom/left/right) de una caja del motor, cualquiera sea su
// forma. Las cajas de texto traen row/maxHeight/colStart/colEnd; los seriales
// verticales rowTop/rowBottom; el logo row/col/maxW/maxH. El QR no expone
// ancho resuelto (depende del payload) => null: no participa del cálculo de
// vecinos, y no hace falta (comparte fila solo con el talón A, ya acotado por
// la perforación y por el corredor del serial).
const rectOfBox = (b) => {
  if (!b) return null;
  if (Number.isFinite(b.colStart) && Number.isFinite(b.colEnd)) {
    const top = Number.isFinite(b.row) ? b.row : b.rowTop;
    const height = Number.isFinite(b.maxHeight)
      ? b.maxHeight
      : (Number.isFinite(b.rowBottom) && Number.isFinite(b.rowTop) ? b.rowBottom - b.rowTop : NaN);
    if (!Number.isFinite(top) || !Number.isFinite(height)) return null;
    return { top, bottom: top + height, left: b.colStart, right: b.colEnd };
  }
  if (Number.isFinite(b.col) && Number.isFinite(b.maxW) && Number.isFinite(b.row)) {
    return { top: b.row, bottom: b.row + (b.maxH ?? 0), left: b.col, right: b.col + b.maxW };
  }
  return null;
};

// Tamaño default del logo cuando la zona no trae maxW/maxH explícito (dots,
// ver services/fglTemplate.js:DEFAULT_CONFIG.zonas.logo). Topes 16-400 / 16-200
// coinciden con el Joi de zonaSchema en ticketTemplate.controller.js.
const LOGO_MAXW_DEFAULT = 200;
const LOGO_MAXH_DEFAULT = 100;

// Garantiza `v: 1` sin tocar el resto del config (el backend rechaza claves
// desconocidas con Joi .unknown(false), así que nunca agregamos nada más).
const withV = (cfg) => (cfg && cfg.v ? cfg : { ...(cfg || {}), v: 1 });

// Sanitiza el texto crudo del textarea de leyendas SOLO en la frontera del
// payload (preview/save). El estado del textarea nunca pasa por acá, así el
// tipeo (Enter, espacios, líneas en blanco intermedias) no se pisa en el DOM.
// Joi rechaza strings vacíos y >60 chars; el array admite máx. 3 items.
const cleanLeyendas = (text) =>
  String(text)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => s.slice(0, 60));

// Config listo para el backend: v garantizado + leyendas derivadas del estado
// del textarea (ON → array limpio, incluso [] = "forzar ninguna"; OFF → null
// = usar los datos del evento). Las zonas sparse van tal cual. `talon2` (como
// `stubEndCol`) es una clave de nivel superior de cfg, NO vive dentro de
// `zonas` — el spread de `withV(cfg)` ya la incluye tal cual la dejó
// setTalon2, sin necesidad de tratamiento especial acá.
const buildPayload = (cfg, leyendasOn, leyendasText) => ({
  ...withV(cfg),
  leyendas: leyendasOn ? cleanLeyendas(leyendasText) : null,
});

const apiErrorDetail = (err) => err?.response?.data?.detail;

// Tamaño objetivo del logo antes de subirlo. El backend renderiza la zona
// logo a maxW/maxH en dots (default 200x100, tope configurable 400x200 —
// ver Joi de zona.logo y default en ApiTickets/services/fglLogo.js), así que
// 600px de ancho ya deja holgura de sobra para cualquier config. El límite
// del server es 1MB (routes/ticketTemplate.routes.js). El downscale es
// best-effort: si el browser no soporta createImageBitmap (p.ej. jsdom en
// los tests) devolvemos el archivo tal cual y el backend valida igual.
const LOGO_MAX_WIDTH = 600;
const LOGO_MAX_BYTES = 900 * 1024;

async function maybeDownscaleLogo(file) {
  if (!file) return file;
  let needsDownscale = file.size > LOGO_MAX_BYTES;
  let bitmap = null;
  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(file);
      if (bitmap.width > LOGO_MAX_WIDTH) needsDownscale = true;
    } catch {
      bitmap = null; // no se pudo decodificar; el backend valida el archivo original
    }
  }
  if (!needsDownscale || !bitmap) {
    bitmap?.close?.();
    return file;
  }
  const scale = LOGO_MAX_WIDTH / bitmap.width;
  const targetW = Math.max(1, Math.round(bitmap.width * scale));
  const targetH = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return file;
  const baseName = file.name ? file.name.replace(/\.\w+$/, '') : 'logo';
  return new File([blob], `${baseName}.png`, { type: 'image/png' });
}

// agentPrint (agente HTTP local y comando Tauri boca_print) espera el FGL en
// base64 — mismo contrato que boxoffice.controller.js:getTicketFgl — pero
// /admin/ticket-template/preview devuelve el FGL como texto plano (lo
// consume fglSimulator.parseFgl tal cual para dibujar el preview). Por eso
// se codifica acá antes de imprimir; sin esto el ticket de prueba llegaría
// corrupto a la impresora. UTF-8 safe (nombres de evento con tildes/ñ).
function fglToBase64(fgl) {
  const bytes = new TextEncoder().encode(String(fgl || ''));
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export default function TicketDesigner({ eventId = null, onSaved }) {
  const [cfg, setCfg] = useState(null);
  const [logoFilename, setLogoFilename] = useState(null);
  const [source, setSource] = useState('default');
  const [fixture, setFixture] = useState('normal');
  const [elements, setElements] = useState([]);
  const [warnings, setWarnings] = useState([]);
  // Métricas de fuente efectivas y estado por zona: vienen del backend en cada
  // preview. No se hardcodean acá — antes vivían en fglSimulator.FONTS y se
  // desincronizaban después de calibrar la impresora, así que el preview
  // dibujaba con anchos viejos y mentía sobre el tamaño real.
  const [metrics, setMetrics] = useState(null);
  const [zoneState, setZoneState] = useState({});
  const [boxes, setBoxes] = useState({});
  // Errores del verificador de layout (solapes / cruces de perforación):
  // bloquean Guardar e Imprimir prueba (regla 5 del motor de cajas).
  const [layoutErrors, setLayoutErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [testPrinting, setTestPrinting] = useState(false);
  const [agentState, setAgentState] = useState({ checking: true, ok: false, printerReachable: false });
  // Leyendas: el textarea guarda el string CRUDO (typing-friendly, sin
  // sanitizar) y un boolean separado dice si la personalización está activa.
  // La sanitización ocurre solo en buildPayload (frontera preview/save).
  const [leyendasOn, setLeyendasOn] = useState(false);
  const [leyendasText, setLeyendasText] = useState('');
  // Calibración física global (Fase 5): valores medidos del ticket de
  // calibración. calVersion fuerza el refetch del preview tras guardar (la
  // calibración se aplica server-side, no viaja en el config).
  const [calInputs, setCalInputs] = useState({ perf1: null, perf2: null, f2w: null, f3w: null, f6w: null });
  const [calSaving, setCalSaving] = useState(false);
  const [calPrinting, setCalPrinting] = useState(false);
  const [calVersion, setCalVersion] = useState(0);
  // Secuencia anti-stale: solo la respuesta del preview más reciente puede
  // tocar el estado (una request lenta A no debe pisar a una más nueva B).
  const previewSeq = useRef(0);

  // Carga inicial / al cambiar de evento / al reintentar tras un error.
  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    getTemplate(eventId)
      .then(({ config, logoFilename: lf, source: src }) => {
        if (cancelled) return;
        setCfg(config || { v: 1, zonas: {}, leyendas: null });
        setLogoFilename(lf || null);
        setSource(src || 'default');
        setLeyendasOn(Array.isArray(config?.leyendas));
        setLeyendasText(config?.leyendas?.join('\n') ?? '');
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(apiErrorDetail(err) || 'No se pudo cargar la plantilla');
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, reloadTick]);

  // Estado del agente/impresora BOCA (mismo chequeo que BoxOffice.jsx) para
  // habilitar/deshabilitar el botón "Imprimir prueba" con motivo en tooltip.
  useEffect(() => {
    let cancelled = false;
    agentStatus()
      .then((st) => {
        if (cancelled) return;
        setAgentState({ checking: false, ok: true, printerReachable: !!st.printerReachable });
      })
      .catch(() => {
        if (cancelled) return;
        setAgentState({ checking: false, ok: false, printerReachable: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Preview en vivo: cualquier cambio de config/fixture/logo/leyendas/eventId
  // dispara un preview debounced 400ms contra el backend (única fuente de
  // verdad FGL). Con eventId, el controller arma el fixture desde datos
  // reales del evento (evento/venue/fecha/sector/precio; código/QR/emisión
  // siguen siendo del fixture elegido — el selector de fixtures queda como
  // override explícito, no se pisa). Si el evento no existe (404
  // EventNotFound — puede pasar si se borró el evento mientras el panel
  // estaba abierto) se avisa y se reintenta sin eventId para no dejar el
  // preview en blanco.
  useEffect(() => {
    if (!cfg) return undefined;
    const timer = setTimeout(() => {
      const seq = ++previewSeq.current;
      const applyPreview = ({
        fgl,
        elements: els,
        warnings: warns,
        errors,
        metrics: mets,
        zones,
        boxes: bxs,
      }) => {
        if (seq !== previewSeq.current) return; // respuesta vieja: ignorar
        if (Array.isArray(els)) {
          // Backend nuevo: elementos resueltos por el motor de cajas (misma
          // fuente de verdad que la impresión — el panel solo dibuja).
          setElements(els);
          setWarnings(warns || []);
          setLayoutErrors(errors || []);
          // metrics/zones/boxes pueden faltar en un backend intermedio: se
          // normalizan a null/{} en vez de dejar los de la respuesta anterior,
          // que describirían otro layout.
          setMetrics(mets || null);
          setZoneState(zones || {});
          setBoxes(bxs || {});
        } else {
          // Compat backend viejo: parsear el FGL con el simulador.
          const parsed = parseFgl(fgl);
          setElements(parsed.elements);
          setWarnings(parsed.warnings);
          setLayoutErrors([]);
          setMetrics(null);
          setZoneState({});
          setBoxes({});
        }
      };
      previewTemplate(buildPayload(cfg, leyendasOn, leyendasText), fixture, logoFilename, eventId)
        .then(applyPreview)
        .catch((err) => {
          if (seq !== previewSeq.current) return;
          if (eventId && err?.response?.data?.error === 'EventNotFound') {
            message.warning('El evento no tiene datos para la vista previa: se muestran datos de ejemplo');
            previewTemplate(buildPayload(cfg, leyendasOn, leyendasText), fixture, logoFilename)
              .then(applyPreview)
              .catch(() => {}); // ya se avisó arriba; sin más fallback razonable si esto también falla
            return;
          }
          message.error(apiErrorDetail(err) || 'No se pudo generar la vista previa');
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [cfg, fixture, logoFilename, leyendasOn, leyendasText, eventId, calVersion]);

  // Carga inicial de la calibración física (global, no depende del evento).
  useEffect(() => {
    let cancelled = false;
    getCalibration()
      .then(({ calibration }) => {
        if (cancelled || !calibration) return;
        setCalInputs({
          perf1: calibration.perf1 ?? null,
          perf2: calibration.perf2 ?? null,
          f2w: calibration.fonts?.F2?.w ?? null,
          f3w: calibration.fonts?.F3?.w ?? null,
          f6w: calibration.fonts?.F6?.w ?? null,
        });
      })
      .catch(() => {}); // backend viejo sin endpoint: la sección sigue usable para imprimir
    return () => { cancelled = true; };
  }, []);

  const handlePrintCalibration = async () => {
    setCalPrinting(true);
    try {
      const { fgl } = await getCalibrationTicket();
      await agentPrint(fglToBase64(fgl));
      message.success('Ticket de calibración enviado a la impresora');
    } catch (err) {
      message.error(err?.message || apiErrorDetail(err) || 'No se pudo imprimir la calibración');
    } finally {
      setCalPrinting(false);
    }
  };

  const handleSaveCalibration = async () => {
    const fonts = {};
    if (calInputs.f2w) fonts.F2 = { w: calInputs.f2w };
    if (calInputs.f3w) fonts.F3 = { w: calInputs.f3w };
    if (calInputs.f6w) fonts.F6 = { w: calInputs.f6w };
    const payload = {
      ...(calInputs.perf1 ? { perf1: calInputs.perf1 } : {}),
      ...(calInputs.perf2 ? { perf2: calInputs.perf2 } : {}),
      ...(Object.keys(fonts).length ? { fonts } : {}),
    };
    if (!Object.keys(payload).length) {
      message.warning('Cargá al menos un valor medido antes de guardar');
      return;
    }
    setCalSaving(true);
    try {
      await saveCalibration(payload);
      message.success('Calibración guardada — el diseño se ajusta automáticamente');
      setCalVersion((v) => v + 1); // refetch del preview con la calibración nueva
    } catch (err) {
      message.error(apiErrorDetail(err) || 'No se pudo guardar la calibración');
    } finally {
      setCalSaving(false);
    }
  };

  // Merge inmutable sobre cfg.zonas[key], preservando el resto del config
  // sparse tal cual vino del backend (solo se escriben los campos tocados).
  const setZona = (key, patch) => {
    setCfg((prev) => ({
      ...prev,
      zonas: {
        ...(prev.zonas || {}),
        [key]: { ...((prev.zonas || {})[key] || {}), ...patch },
      },
    }));
  };

  const setStubEndCol = (value) => {
    setCfg((prev) => ({ ...prev, stubEndCol: value }));
  };

  // Merge inmutable sobre cfg.talon2 (patrón de setStubEndCol: clave de nivel
  // superior, no una zona) preservando el campo no tocado (visible/startCol).
  const setTalon2 = (patch) => {
    setCfg((prev) => ({
      ...prev,
      talon2: { ...(prev.talon2 || {}), ...patch },
    }));
  };

  const handleSave = async () => {
    if (!cfg || layoutErrors.length) return;
    setSaving(true);
    try {
      await saveTemplate(eventId, buildPayload(cfg, leyendasOn, leyendasText));
      message.success('Plantilla guardada');
      onSaved?.();
    } catch (err) {
      message.error(apiErrorDetail(err) || 'No se pudo guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async () => {
    setReverting(true);
    try {
      await deleteTemplate(eventId);
      const { config, logoFilename: lf, source: src } = await getTemplate(eventId);
      setCfg(config || { v: 1, zonas: {}, leyendas: null });
      setLogoFilename(lf || null);
      setSource(src || 'default');
      setLeyendasOn(Array.isArray(config?.leyendas));
      setLeyendasText(config?.leyendas?.join('\n') ?? '');
      message.success('Ahora usa la plantilla global');
    } catch (err) {
      message.error(apiErrorDetail(err) || 'No se pudo revertir la plantilla');
    } finally {
      setReverting(false);
    }
  };

  const handleUploadLogo = async (file) => {
    try {
      const toUpload = await maybeDownscaleLogo(file);
      const res = await uploadLogo(eventId, toUpload);
      setLogoFilename(res?.logoFilename || null);
      // Si la zona logo estaba oculta, un logo recién subido no se vería en el
      // ticket impreso hasta activarla a mano — la activamos de una vez y lo
      // avisamos, para que "subir logo" no sea un no-op silencioso.
      // El logo recién subido arranca centrado en el cuerpo SEGÚN SU CAJA
      // actual (antes fila fija 140: con cajas altas tipo 300x150 pisaba
      // leyendas/fecha y el verificador tiraba solapes por todos lados,
      // bug 2026-07-13). Banda libre del cuerpo: filas ~75 (fin dirección)
      // a ~240 (inicio leyendas); centro horizontal del cuerpo: col 560.
      const zonaLogo = (cfg.zonas || {}).logo || {};
      const maxW = zonaLogo.maxW ?? LOGO_MAXW_DEFAULT;
      const maxH = zonaLogo.maxH ?? LOGO_MAXH_DEFAULT;
      const row = Math.max(75, Math.round((315 - maxH) / 2));
      const col = Math.max(310, Math.round(560 - maxW / 2));
      setZona('logo', { visible: true, row, col });
      message.success('Logo subido y centrado — movelo desde la zona Logo si hace falta');
    } catch (err) {
      const detail = apiErrorDetail(err);
      if (detail === 'LIMIT_FILE_SIZE') {
        message.error('La imagen supera 1 MB. Probá con una más liviana.');
      } else {
        message.error(detail || 'No se pudo subir el logo');
      }
    }
    return false; // evita que antd intente subir el archivo por su cuenta
  };

  const handleTestPrint = async () => {
    if (!cfg || layoutErrors.length) return;
    setTestPrinting(true);
    try {
      const { fgl } = await previewTemplate(
        buildPayload(cfg, leyendasOn, leyendasText),
        fixture,
        logoFilename,
        eventId
      );
      if (!fgl) throw new Error('El layout tiene errores: corregilos antes de imprimir');
      await agentPrint(fglToBase64(fgl));
      message.success('Ticket de prueba enviado a la impresora');
    } catch (err) {
      message.error(err?.message || apiErrorDetail(err) || 'No se pudo imprimir el ticket de prueba');
    } finally {
      setTestPrinting(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16, textAlign: 'left' }}
          message="No se pudo cargar la plantilla"
          description={loadError}
        />
        <Button onClick={() => setReloadTick((t) => t + 1)}>Reintentar</Button>
      </div>
    );
  }

  if (!cfg) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  const stubEndCol = cfg.stubEndCol ?? DEFAULT_STUB_END_COL;
  // Talón derecho: se derivan acá arriba (y no junto a su panel, más abajo)
  // porque el cálculo de cuánto se puede ensanchar una caja necesita saber
  // dónde cae la segunda perforación.
  const talon2 = cfg.talon2 || {};
  const talon2Visible = talon2.visible === true; // default false, retrocompatible
  const talon2StartCol = talon2.startCol ?? TALON2_START_COL_DEFAULT;

  const printerReady = agentState.ok && agentState.printerReachable;
  const printDisabledReason = agentState.checking
    ? 'Comprobando impresora…'
    : !agentState.ok
    ? 'Agente de impresión no disponible'
    : !agentState.printerReachable
    ? 'Impresora inaccesible'
    : '';

  // Zona con error del verificador => label en rojo con el motivo (los
  // errores nombran al elemento: "fecha: ...", 'solape: "fecha" pisa ...').
  const ERROR_ALIASES = { leyendas: ['leyendas', 'restriccion'], codigo: ['codigo', 'serialA'], emision: ['emision', 'serialA'] };
  const zoneErrors = (key) => {
    const names = ERROR_ALIASES[key] || [key];
    return layoutErrors.filter((e) => names.some((n) => e.includes(`"${n}"`) || e.startsWith(`${n}:`)));
  };

  // --- Ensanchar la caja de una zona degradada -------------------------------
  // Ensanchar a ciegas hasta `anchoNecesario` es una trampa: el verificador del
  // backend rechaza solapes y cruces de perforación, así que un botón "útil"
  // podría dejar el diseño en error bloqueante (Guardar/Imprimir deshabilitados)
  // justo después de tocarlo. Por eso se calcula ANTES hasta dónde se puede
  // llegar sin romper nada, y el botón solo se ofrece habilitado si con ese
  // margen la fuente pedida entra de verdad.
  //   - límite físico: la perforación de la derecha (talón A => perf1; cuerpo =>
  //     perf2-8, el mismo bodyEnd que usa buildBoxes) y el área segura.
  //   - límite por vecinos: la caja que comparte filas y arranca más a la
  //     derecha (incluye el corredor del serial vertical y el logo).
  const boxOfZone = (zoneKey) => boxes[BOX_OF_ZONE[zoneKey] || zoneKey];

  // Origen (fila/columna actual) de cada zona arrastrable, para que el lienzo
  // sepa desde DÓNDE mover. Se lee de `boxes`, que es lo que el motor resolvió
  // — no del elemento agarrado: una zona puede tener varios elementos (`codigo`
  // se parte en dos líneas) y tomar el origen del segundo escribiría la config
  // una línea más abajo de donde está la zona.
  //
  // La traducción de clave es obligatoria: `handleZoneChange` habla en claves
  // de CONFIG (`leyendas`) y `boxes` viene indexado por nombre de caja del
  // MOTOR (`restriccion`). Leer la clave cruda daría undefined, el arrastre
  // arrancaría desde {row:0, col:0} y el elemento se teletransportaría a la
  // esquina en el primer movimiento.
  // `ancho` sale SOLO de las cajas de texto, las únicas que tienen dos bordes
  // propios (colStart/colEnd). El QR y el logo son puntos posicionados, no
  // cajas: el logo tiene maxW, pero eso es un TAMAÑO de render, no un borde
  // derecho — escribirlo como colEnd lo pelearía con el slider de ancho. Sin
  // `ancho` el arrastre escribe solo {row, col}, que para un punto es la
  // traslación completa igual.
  const originOfZone = (zoneKey) => {
    const b = boxOfZone(zoneKey);
    if (!b) return null;
    const esCajaDeTexto = Number.isFinite(b.colStart) && Number.isFinite(b.colEnd);
    const r = rectOfBox(b);
    if (r) {
      return esCajaDeTexto
        ? { row: r.top, col: r.left, ancho: b.colEnd - b.colStart }
        : { row: r.top, col: r.left };
    }
    // El QR no expone ancho resuelto (depende del payload) y rectOfBox lo
    // descarta, pero su fila/columna sí están y es todo lo que el arrastre pide.
    if (Number.isFinite(b.row) && Number.isFinite(b.col)) return { row: b.row, col: b.col };
    return null;
  };

  const zoneOrigins = {};
  for (const zone of ZONES) {
    const o = originOfZone(zone.key);
    if (o) zoneOrigins[zone.key] = o;
  }

  // El lienzo avisa que una zona se movió. Escribimos la config y el efecto de
  // preview (con su debounce) pide el layout real: la posición definitiva la
  // decide siempre el backend.
  const handleZoneChange = (zoneId, cambios) => {
    setZona(zoneId, cambios);
  };

  const anchoDisponible = (zoneKey) => {
    const propio = rectOfBox(boxOfZone(zoneKey));
    if (!propio) return null;
    const limiteFisico = propio.left < stubEndCol
      ? stubEndCol - GAP
      : Math.min(SAFE_COL_MAX, talon2StartCol - 8);
    let limite = limiteFisico;
    let vecino = null;
    const propioKey = BOX_OF_ZONE[zoneKey] || zoneKey;
    for (const [k, b] of Object.entries(boxes)) {
      if (k === propioKey) continue;
      const r = rectOfBox(b);
      if (!r || r.left <= propio.left) continue;
      if (r.top >= propio.bottom || r.bottom <= propio.top) continue; // no comparten filas
      if (r.left - GAP < limite) {
        limite = r.left - GAP;
        vecino = k;
      }
    }
    return { colStart: propio.left, limite, limiteFisico, vecino };
  };

  // Ensancha la caja de una zona hasta que su texto entre en la fuente pedida.
  // anchoNecesario ya viene medido sobre el texto ORIGINAL (no el truncado), así
  // que ensanchar a ese valor alcanza de verdad — un botón que promete y no
  // cumple sería peor que no tener botón.
  const ensancharCaja = (zoneKey) => {
    const necesario = zoneState[zoneKey]?.anchoNecesario;
    const disp = anchoDisponible(zoneKey);
    if (!necesario || !disp) return;
    const colEnd = Math.min(disp.limite, disp.colStart + necesario + 4);
    // Guarda redundante (el botón ya se deshabilita en estos casos), pero barata:
    // una caja de menos de 40 dots la rechaza el Joi del backend y la descarta el
    // motor, así que nunca la escribimos.
    if (colEnd - disp.colStart < MIN_BOX_W) return;
    setZona(zoneKey, { col: disp.colStart, colEnd });
  };

  // Qué puede hacer el botón de ensanchar en esta zona, y si no puede, por qué.
  const estadoEnsanche = (zoneKey) => {
    const necesario = zoneState[zoneKey]?.anchoNecesario;
    const disp = anchoDisponible(zoneKey);
    if (!necesario || !disp) return { puede: false, motivo: null };
    const pedido = necesario + 4;
    if (pedido > disp.limiteFisico - disp.colStart) {
      return {
        puede: false,
        motivo: 'No entra ni a lo ancho del ticket — elegí una fuente más chica o acortá el texto.',
      };
    }
    if (pedido > disp.limite - disp.colStart) {
      return {
        puede: false,
        motivo: `No se puede ensanchar sin pisar "${disp.vecino}" — mové esa zona, o elegí una fuente más chica.`,
      };
    }
    return { puede: true, motivo: null };
  };

  const panelItems = ZONES.map((zone) => {
    const zona = (cfg.zonas || {})[zone.key] || {};
    const visible = zona.visible !== false;
    const errs = zoneErrors(zone.key);

    return {
      key: zone.key,
      label: errs.length
        ? (
          <Tooltip title={errs.join(' — ')}>
            <span style={{ color: '#E4574B', fontWeight: 600 }}>{zone.label} ⚠</span>
          </Tooltip>
        )
        : zone.label,
      extra: zone.noToggle ? null : (
        // stopPropagation en ambos handlers: el click en el Switch no debe
        // abrir/cerrar el panel del Collapse.
        <span onClick={(e) => e.stopPropagation()}>
          <Switch
            size="small"
            checked={visible}
            onClick={(next, e) => e.stopPropagation()}
            onChange={(checked) => setZona(zone.key, { visible: checked })}
          />
        </span>
      ),
      children: (
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <InputNumber
            addonBefore="Fila"
            min={0}
            max={379}
            style={{ width: '100%' }}
            value={zona.row}
            onChange={(v) => setZona(zone.key, { row: v ?? undefined })}
          />
          {zone.hasCol && (
            <InputNumber
              addonBefore="Columna"
              min={0}
              max={1112}
              style={{ width: '100%' }}
              value={zona.col}
              onChange={(v) => setZona(zone.key, { col: v ?? undefined })}
            />
          )}
          {zone.hasFont && (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Tamaño de letra</Text>
              <Segmented
                block
                options={FONT_OPTIONS}
                value={zona.font || zone.fontDefault}
                onChange={(v) => setZona(zone.key, { font: v })}
              />
              {zoneState[zone.key]?.degradado && (() => {
                const est = estadoEnsanche(zone.key);
                const caja = rectOfBox(boxOfZone(zone.key));
                return (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 8 }}
                    message={`Entró en ${zoneState[zone.key].fontUsado}, no en ${zoneState[zone.key].fontPedido}`}
                    description={(
                      <Space direction="vertical" size={4}>
                        <Text style={{ fontSize: 12 }}>
                          El texto necesita {zoneState[zone.key].anchoNecesario} dots y la caja tiene{' '}
                          {(caja?.right ?? 0) - (caja?.left ?? 0)}.
                        </Text>
                        {est.puede ? (
                          <Button size="small" onClick={() => ensancharCaja(zone.key)}>
                            Ensanchar la caja
                          </Button>
                        ) : (
                          <>
                            <Button size="small" disabled>
                              Ensanchar la caja
                            </Button>
                            {est.motivo && (
                              <Text type="secondary" style={{ fontSize: 12 }}>{est.motivo}</Text>
                            )}
                          </>
                        )}
                      </Space>
                    )}
                  />
                );
              })()}
            </div>
          )}
          {zone.key === 'leyendas' && (
            <>
              <Checkbox
                checked={leyendasOn}
                onChange={(e) => setLeyendasOn(e.target.checked)}
              >
                Usar leyendas propias
              </Checkbox>
              <TextArea
                rows={3}
                placeholder="Una leyenda por línea (máx. 3)"
                disabled={!leyendasOn}
                value={leyendasText}
                onChange={(e) => setLeyendasText(e.target.value)}
              />
            </>
          )}
          {zone.key === 'logo' && (
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Upload accept="image/png,image/jpeg" showUploadList={false} beforeUpload={handleUploadLogo}>
                <Button icon={<UploadOutlined />}>Subir logo</Button>
              </Upload>
              {logoFilename && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {logoFilename}
                </Text>
              )}
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Ancho: {zona.maxW ?? LOGO_MAXW_DEFAULT} dots
                </Text>
                <Slider
                  min={16}
                  max={400}
                  value={zona.maxW ?? LOGO_MAXW_DEFAULT}
                  onChange={(v) => setZona('logo', { maxW: v })}
                />
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Alto: {zona.maxH ?? LOGO_MAXH_DEFAULT} dots
                </Text>
                <Slider
                  min={16}
                  max={200}
                  value={zona.maxH ?? LOGO_MAXH_DEFAULT}
                  onChange={(v) => setZona('logo', { maxH: v })}
                />
              </div>
            </Space>
          )}
        </Space>
      ),
    };
  });

  // Talón derecho (segundo talón de control, sin QR, rotado 180° — feature
  // 2026-07-10): no es una "zona" (no tiene row/col/font individuales, el
  // layout interno de sus 6 campos es fijo en el backend), por eso vive
  // aparte de ZONES/panelItems.map en lugar de sumarse a la lista de zonas.
  // `talon2` es una clave de nivel superior de cfg (como stubEndCol), no una
  // entrada de cfg.zonas. (talon2/talon2Visible/talon2StartCol se derivan más
  // arriba: el cálculo de ensanche de cajas también los necesita.)
  panelItems.push({
    key: 'talon2',
    label: 'Talón derecho',
    extra: (
      <span onClick={(e) => e.stopPropagation()}>
        <Switch
          size="small"
          checked={talon2Visible}
          onClick={(next, e) => e.stopPropagation()}
          onChange={(checked) => setTalon2({ visible: checked })}
        />
      </span>
    ),
    children: (
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Columna de inicio: {talon2StartCol}
          </Text>
          <Slider
            min={100}
            max={1112}
            value={talon2StartCol}
            onChange={(v) => setTalon2({ startCol: v })}
          />
        </div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Talón de control sin QR, impreso rotado 180° (verificar legibilidad con Imprimir prueba).
        </Text>
      </Space>
    ),
  });

  // Calibración física global (Fase 5): imprimir la regla, medir, cargar acá.
  // Se guarda una sola vez por impresora/cartón y aplica a TODOS los diseños.
  panelItems.push({
    key: 'calibracion',
    label: 'Calibración impresora',
    children: (
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        <Tooltip title={printDisabledReason}>
          <span>
            <Button
              icon={<PrinterOutlined />}
              loading={calPrinting}
              disabled={!printerReady || calPrinting}
              onClick={handlePrintCalibration}
              block
            >
              Imprimir ticket de calibración
            </Button>
          </span>
        </Tooltip>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Del ticket impreso: leé en la regla la columna donde cae cada
          perforación, y medí el ancho de los 10 dígitos de cada fuente
          (÷10 = dots por carácter; 1 mm ≈ 7,9 dots).
        </Text>
        <InputNumber addonBefore="Perforación 1" min={100} max={500} style={{ width: '100%' }}
          value={calInputs.perf1} onChange={(v) => setCalInputs((p) => ({ ...p, perf1: v ?? null }))} />
        <InputNumber addonBefore="Perforación 2" min={600} max={1100} style={{ width: '100%' }}
          value={calInputs.perf2} onChange={(v) => setCalInputs((p) => ({ ...p, perf2: v ?? null }))} />
        <InputNumber addonBefore="F2 dots/char" min={4} max={80} style={{ width: '100%' }}
          value={calInputs.f2w} onChange={(v) => setCalInputs((p) => ({ ...p, f2w: v ?? null }))} />
        <InputNumber addonBefore="F3 dots/char" min={4} max={80} style={{ width: '100%' }}
          value={calInputs.f3w} onChange={(v) => setCalInputs((p) => ({ ...p, f3w: v ?? null }))} />
        <InputNumber addonBefore="F6 dots/char" min={4} max={80} style={{ width: '100%' }}
          value={calInputs.f6w} onChange={(v) => setCalInputs((p) => ({ ...p, f6w: v ?? null }))} />
        <Button type="primary" loading={calSaving} onClick={handleSaveCalibration} block>
          Guardar calibración
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Aplica globalmente (todos los diseños y la boletería). Un valor de
          perforación explícito de esta plantilla sigue teniendo prioridad.
        </Text>
      </Space>
    ),
  });

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ width: 340, flex: '0 0 340px', maxHeight: '80vh', overflowY: 'auto', paddingRight: 4 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>Perforación</Text>
            <Slider min={150} max={400} value={stubEndCol} onChange={setStubEndCol} />
          </div>

          <Collapse items={panelItems} />

          {layoutErrors.map((e, idx) => (
            <Alert key={`err-${e}-${idx}`} type="error" showIcon message={e} />
          ))}
          {warnings.map((w, idx) => (
            <Alert key={`${w}-${idx}`} type="warning" showIcon message={w} />
          ))}

          <Space wrap>
            <Tooltip title={layoutErrors.length ? 'Corregí los errores de layout antes de guardar' : ''}>
              <span>
                <Button type="primary" loading={saving} disabled={layoutErrors.length > 0} onClick={handleSave}>
                  Guardar
                </Button>
              </span>
            </Tooltip>
            {eventId && source === 'event' && (
              <Button loading={reverting} onClick={handleRevert}>
                Usar plantilla global
              </Button>
            )}
          </Space>
        </Space>
      </div>

      <div style={{ flex: 1, minWidth: 420 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Segmented options={FIXTURE_OPTIONS} value={fixture} onChange={setFixture} />
            <Tooltip title={layoutErrors.length ? 'El layout tiene errores: impresión bloqueada' : printDisabledReason}>
              <span>
                <Button
                  icon={<PrinterOutlined />}
                  loading={testPrinting}
                  disabled={!printerReady || testPrinting || layoutErrors.length > 0}
                  onClick={handleTestPrint}
                >
                  Imprimir prueba
                </Button>
              </span>
            </Tooltip>
          </Space>
          <TicketCanvas
            elements={elements}
            stubEndCol={stubEndCol}
            talon2StartCol={talon2Visible ? talon2StartCol : null}
            metrics={metrics}
            boxes={boxes}
            zoneOrigins={zoneOrigins}
            onZoneChange={handleZoneChange}
          />
        </Space>
      </div>
    </div>
  );
}
