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
} from '../../services/ticketTemplateService';
import { agentStatus, agentPrint } from '../../services/printAgentService';
import { parseFgl, FONTS } from '../../utils/fglSimulator';

const { Text } = Typography;
const { TextArea } = Input;

// Dimensiones del ticket en dots de impresora (ver services/fglConstants.js
// en el backend: WIDTH_DOTS=384 alto, LENGTH_DOTS=1050 ancho).
const DOTS_W = 1050;
const DOTS_H = 384;
const DEFAULT_STUB_END_COL = 250;

// Talón derecho (segundo talón de control, sin QR, rotado 180° — feature
// 2026-07-10). Default idéntico al del backend (ver
// ApiTickets/services/fglTemplate.js:DEFAULT_CONFIG.talon2): visible:false
// (retrocompatible), startCol:880 (Joi 100..1049 en el controller).
const TALON2_START_COL_DEFAULT = 880;

const FIXTURE_OPTIONS = [
  { label: 'Normal', value: 'normal' },
  { label: 'Invitación', value: 'invitacion' },
  { label: 'Textos largos', value: 'limite' },
];

const SIZE_OPTIONS = [
  { label: 'Grande', value: 'G' },
  { label: 'Mediano', value: 'M' },
  { label: 'Chico', value: 'C' },
];

// Metadata de las zonas editables (coincide con las claves válidas de
// controllers/ticketTemplate.controller.js:configSchema en el backend).
// La zona `qr` no tiene panel propio (se posiciona junto con el logo/talón).
// `sizeDefault` es el tamaño que aplica el motor cuando la zona no trae
// `size` explícito (services/fglTemplate.js:DEFAULT_CONFIG.zonas, verificado
// ahí mismo — no en este archivo). codigo/emision/leyendas/pie siempre
// imprimen en F1 fijo (sin escalera de tamaño), por eso no llevan control.
const ZONES = [
  { key: 'evento', label: 'Nombre del evento', hasSize: true, hasCol: false, sizeDefault: 'G' },
  { key: 'venue', label: 'Venue y dirección', hasSize: true, hasCol: false, sizeDefault: 'M' },
  { key: 'fecha', label: 'Fecha y hora', hasSize: true, hasCol: false, sizeDefault: 'G' },
  { key: 'sector', label: 'Sector / entrada', hasSize: true, hasCol: false, sizeDefault: 'M' },
  { key: 'precio', label: 'Precio', hasSize: true, hasCol: false, sizeDefault: 'M' },
  { key: 'leyendas', label: 'Leyendas', hasSize: false, hasCol: true },
  { key: 'pie', label: 'Pie legal', hasSize: false, hasCol: false },
  { key: 'codigo', label: 'Código talón', hasSize: false, hasCol: true },
  { key: 'emision', label: 'Fecha emisión talón', hasSize: false, hasCol: true },
  { key: 'logo', label: 'Logo', hasSize: false, hasCol: true },
];

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

  // Preview en vivo: cualquier cambio de config/fixture/logo/leyendas dispara
  // un preview debounced 400ms contra el backend (única fuente de verdad FGL).
  useEffect(() => {
    if (!cfg) return undefined;
    const timer = setTimeout(() => {
      const seq = ++previewSeq.current;
      previewTemplate(buildPayload(cfg, leyendasOn, leyendasText), fixture, logoFilename)
        .then(({ fgl }) => {
          if (seq !== previewSeq.current) return; // respuesta vieja: ignorar
          const parsed = parseFgl(fgl);
          setElements(parsed.elements);
          setWarnings(parsed.warnings);
        })
        .catch((err) => {
          if (seq !== previewSeq.current) return;
          message.error(apiErrorDetail(err) || 'No se pudo generar la vista previa');
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [cfg, fixture, logoFilename, leyendasOn, leyendasText]);

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
    if (!cfg) return;
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
      const zonaLogo = (cfg.zonas || {}).logo || {};
      if (zonaLogo.visible === false) {
        setZona('logo', { visible: true });
        message.success('Logo subido — zona Logo activada en la plantilla');
      } else {
        message.success('Logo subido');
      }
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
    if (!cfg) return;
    setTestPrinting(true);
    try {
      const { fgl } = await previewTemplate(
        buildPayload(cfg, leyendasOn, leyendasText),
        fixture,
        logoFilename
      );
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

  const printerReady = agentState.ok && agentState.printerReachable;
  const printDisabledReason = agentState.checking
    ? 'Comprobando impresora…'
    : !agentState.ok
    ? 'Agente de impresión no disponible'
    : !agentState.printerReachable
    ? 'Impresora inaccesible'
    : '';

  const panelItems = ZONES.map((zone) => {
    const zona = (cfg.zonas || {})[zone.key] || {};
    const visible = zona.visible !== false;

    return {
      key: zone.key,
      label: zone.label,
      extra: (
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
            max={383}
            style={{ width: '100%' }}
            value={zona.row}
            onChange={(v) => setZona(zone.key, { row: v ?? undefined })}
          />
          {zone.hasCol && (
            <InputNumber
              addonBefore="Columna"
              min={0}
              max={1049}
              style={{ width: '100%' }}
              value={zona.col}
              onChange={(v) => setZona(zone.key, { col: v ?? undefined })}
            />
          )}
          {zone.hasSize && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tamaño
              </Text>
              <Segmented
                block
                options={SIZE_OPTIONS}
                value={zona.size ?? zone.sizeDefault}
                onChange={(v) => setZona(zone.key, { size: v })}
              />
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
  // 2026-07-10): no es una "zona" (no tiene row/col/size individuales, el
  // layout interno de sus 6 campos es fijo en el backend), por eso vive
  // aparte de ZONES/panelItems.map en lugar de sumarse a la lista de zonas.
  // `talon2` es una clave de nivel superior de cfg (como stubEndCol), no una
  // entrada de cfg.zonas.
  const talon2 = cfg.talon2 || {};
  const talon2Visible = talon2.visible === true; // default false, retrocompatible
  const talon2StartCol = talon2.startCol ?? TALON2_START_COL_DEFAULT;
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
            max={1049}
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

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ width: 340, flex: '0 0 340px', maxHeight: '80vh', overflowY: 'auto', paddingRight: 4 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>Perforación</Text>
            <Slider min={150} max={400} value={stubEndCol} onChange={setStubEndCol} />
          </div>

          <Collapse items={panelItems} />

          {warnings.map((w, idx) => (
            <Alert key={`${w}-${idx}`} type="warning" showIcon message={w} />
          ))}

          <Space wrap>
            <Button type="primary" loading={saving} onClick={handleSave}>
              Guardar
            </Button>
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
            <Tooltip title={printDisabledReason}>
              <span>
                <Button
                  icon={<PrinterOutlined />}
                  loading={testPrinting}
                  disabled={!printerReady || testPrinting}
                  onClick={handleTestPrint}
                >
                  Imprimir prueba
                </Button>
              </span>
            </Tooltip>
          </Space>
          <TicketCanvas elements={elements} stubEndCol={stubEndCol} />
        </Space>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TicketCanvas: dibuja los elementos de parseFgl() sobre un lienzo de
// 1050x384 "dots" (1 dot = 1px) escalado con transform para caber en el
// ancho disponible. Puramente presentacional, sin llamadas a la API.
// ---------------------------------------------------------------------------
function TicketCanvas({ elements, stubEndCol }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.offsetWidth);
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const k = width > 0 ? width / DOTS_W : 0;
  const heightPx = DOTS_H * k;

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <div style={{ width: '100%', height: heightPx, overflow: 'hidden' }}>
        <div
          style={{
            width: DOTS_W,
            height: DOTS_H,
            transform: `scale(${k})`,
            transformOrigin: '0 0',
            position: 'relative',
            background: '#FBFAF6',
            borderRadius: 3,
            boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            color: '#191919',
          }}
        >
          {elements.map((el, idx) => (
            <TicketElement key={idx} el={el} />
          ))}

          {/* Línea de perforación del talón */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: stubEndCol,
              width: 0,
              height: DOTS_H,
              borderLeft: '2px dashed #E4574B',
              pointerEvents: 'none',
            }}
          />
          {/* Tinte del área del talón */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: stubEndCol,
              height: DOTS_H,
              background: 'rgba(0,122,255,0.05)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TicketElement({ el }) {
  switch (el.type) {
    case 'text': {
      const [boxW, charH] = FONTS[el.font] || FONTS.F1;
      const hw = el.hw || [1, 1];
      const fontSize = charH * hw[0];
      const letterSpacing = boxW * hw[1] - 0.6 * fontSize;
      const style = {
        position: 'absolute',
        fontFamily: '"Courier New", Courier, monospace',
        fontWeight: 600,
        whiteSpace: 'pre',
        fontSize,
        lineHeight: `${fontSize}px`,
        letterSpacing,
        color: '#191919',
      };
      if (el.rotation === 180) {
        // Talón derecho (<RU>, fglSimulator.js): (el.row, el.col) es el punto
        // de anclaje del comando FGL, que para RU es el extremo DERECHO/ABAJO
        // de la corrida en el sistema de coordenadas SIN rotar (el texto
        // "construye hacia arriba", cheatsheet §4) — o sea, la esquina
        // inferior-derecha de la caja, no la superior-izquierda como en NR.
        // Rotar 180° alrededor del centro de esa caja no mueve su bounding
        // box (sigue ocupando el mismo rectángulo), solo voltea el contenido:
        // exactamente el efecto visual de imprimir con <RU>, sin necesitar
        // fidelidad física perfecta (alcanza con mostrar el talón girado en
        // el lugar correcto).
        const width = el.text.length * boxW * hw[1];
        style.top = el.row - fontSize;
        style.left = el.col - width;
        style.width = width;
        style.transform = 'rotate(180deg)';
        style.transformOrigin = 'center';
      } else {
        style.top = el.row;
        style.left = el.col;
      }
      return <div style={style}>{el.text}</div>;
    }
    case 'line': {
      const size = el.vertical
        ? { width: el.thickness, height: el.length }
        : { width: el.length, height: el.thickness };
      return (
        <div
          style={{
            position: 'absolute',
            top: el.row,
            left: el.col,
            background: '#191919',
            ...size,
          }}
        />
      );
    }
    case 'box':
      return (
        <div
          style={{
            position: 'absolute',
            top: el.row,
            left: el.col,
            width: el.width,
            height: el.height,
            border: `${el.thickness}px solid #191919`,
            boxSizing: 'border-box',
          }}
        />
      );
    case 'qr':
      return <QrCanvas el={el} />;
    case 'graphic':
      return <GraphicCanvas el={el} />;
    default:
      return null;
  }
}

// Hash determinístico (FNV-1a + mezcla estilo xorshift) para generar un
// patrón "falso" de módulos de QR a partir del payload, solo para el
// preview visual — nunca se usa para generar el QR real (eso lo hace la
// impresora con el comando <QR#>{payload}).
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hashCell(seed, r, c) {
  let h = seed ^ Math.imul(r + 1, 374761393) ^ Math.imul(c + 1, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function QrCanvas({ el }) {
  const { row, col, pointSize, modules, payload } = el;
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = modules;
    canvas.height = modules;
    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    ctx.clearRect(0, 0, modules, modules);
    ctx.fillStyle = '#FBFAF6';
    ctx.fillRect(0, 0, modules, modules);
    ctx.fillStyle = '#191919';

    const seed = fnv1a(payload || '');
    // Los 3 "ojos" (finder patterns) de un QR real: anillo 7x7 con centro 3x3,
    // rodeados de un margen blanco de 1 módulo.
    const finders = [
      [0, 0],
      [0, modules - 7],
      [modules - 7, 0],
    ];

    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        let dark = null;
        for (const [fr, fc] of finders) {
          const rr = r - fr;
          const cc = c - fc;
          if (rr >= -1 && rr <= 7 && cc >= -1 && cc <= 7) {
            if (rr < 0 || rr > 6 || cc < 0 || cc > 6) {
              dark = false; // margen de aclarado alrededor del ojo
            } else {
              const isBorder = rr === 0 || rr === 6 || cc === 0 || cc === 6;
              const isCenter = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
              dark = isBorder || isCenter;
            }
            break;
          }
        }
        if (dark === null) {
          dark = hashCell(seed, r, c) > 0.52;
        }
        if (dark) ctx.fillRect(c, r, 1, 1);
      }
    }
  }, [modules, payload]);

  const sizePx = modules * pointSize;
  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute',
        top: row,
        left: col,
        width: sizePx,
        height: sizePx,
        imageRendering: 'pixelated',
      }}
    />
  );
}

// Un <canvas> por elemento `graphic`: cada elemento es UNA fila del logo
// (altura 1 dot). Cada par de caracteres hex = 1 byte = 8 dots horizontales,
// bit más significativo primero (igual que el formato <g#>HEX de BOCA).
function GraphicCanvas({ el }) {
  const { row, col, hex } = el;
  const ref = useRef(null);
  const width = Math.max(1, hex.length * 4);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = 1;
    let ctx = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    ctx.clearRect(0, 0, width, 1);
    ctx.fillStyle = '#191919';
    const nBytes = Math.floor(hex.length / 2);
    for (let b = 0; b < nBytes; b++) {
      const byte = parseInt(hex.substr(b * 2, 2), 16);
      if (Number.isNaN(byte)) continue;
      for (let bit = 0; bit < 8; bit++) {
        if (byte & (0x80 >> bit)) ctx.fillRect(b * 8 + bit, 0, 1, 1);
      }
    }
  }, [hex, width]);

  return (
    <canvas
      ref={ref}
      style={{
        position: 'absolute',
        top: row,
        left: col,
        width,
        height: 1,
        imageRendering: 'pixelated',
      }}
    />
  );
}
