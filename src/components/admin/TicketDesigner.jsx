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
  Select,
  Checkbox,
  Input,
  Button,
  Space,
  Typography,
  Segmented,
  Alert,
  Upload,
  Spin,
  message,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import {
  getTemplate,
  saveTemplate,
  deleteTemplate,
  previewTemplate,
  uploadLogo,
} from '../../services/ticketTemplateService';
import { parseFgl, FONTS } from '../../utils/fglSimulator';

const { Text } = Typography;
const { TextArea } = Input;

// Dimensiones del ticket en dots de impresora (ver services/fglConstants.js
// en el backend: WIDTH_DOTS=384 alto, LENGTH_DOTS=1050 ancho).
const DOTS_W = 1050;
const DOTS_H = 384;
const DEFAULT_STUB_END_COL = 250;

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
const ZONES = [
  { key: 'evento', label: 'Nombre del evento', hasSize: true, hasCol: false },
  { key: 'venue', label: 'Venue y dirección', hasSize: true, hasCol: false },
  { key: 'fecha', label: 'Fecha y hora', hasSize: true, hasCol: false },
  { key: 'sector', label: 'Sector / entrada', hasSize: true, hasCol: false },
  { key: 'precio', label: 'Precio', hasSize: true, hasCol: false },
  { key: 'leyendas', label: 'Leyendas', hasSize: false, hasCol: true },
  { key: 'pie', label: 'Pie legal', hasSize: false, hasCol: false },
  { key: 'codigo', label: 'Código talón', hasSize: false, hasCol: true },
  { key: 'emision', label: 'Fecha emisión talón', hasSize: false, hasCol: true },
  { key: 'logo', label: 'Logo', hasSize: false, hasCol: true },
];

// Garantiza `v: 1` sin tocar el resto del config (el backend rechaza claves
// desconocidas con Joi .unknown(false), así que nunca agregamos nada más).
const withV = (cfg) => (cfg && cfg.v ? cfg : { ...(cfg || {}), v: 1 });

const apiErrorDetail = (err) => err?.response?.data?.detail;

export default function TicketDesigner({ eventId = null, onSaved }) {
  const [cfg, setCfg] = useState(null);
  const [logoFilename, setLogoFilename] = useState(null);
  const [source, setSource] = useState('default');
  const [fixture, setFixture] = useState('normal');
  const [elements, setElements] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  // Secuencia anti-stale: solo la respuesta del preview más reciente puede
  // tocar el estado (una request lenta A no debe pisar a una más nueva B).
  const previewSeq = useRef(0);

  // Carga inicial / al cambiar de evento.
  useEffect(() => {
    let cancelled = false;
    getTemplate(eventId)
      .then(({ config, logoFilename: lf, source: src }) => {
        if (cancelled) return;
        setCfg(config || { v: 1, zonas: {}, leyendas: null });
        setLogoFilename(lf || null);
        setSource(src || 'default');
      })
      .catch(() => {
        if (!cancelled) message.error('No se pudo cargar la plantilla');
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Preview en vivo: cualquier cambio de config/fixture/logo dispara un
  // preview debounced 400ms contra el backend (única fuente de verdad FGL).
  useEffect(() => {
    if (!cfg) return undefined;
    const timer = setTimeout(() => {
      const seq = ++previewSeq.current;
      previewTemplate(withV(cfg), fixture, logoFilename)
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
  }, [cfg, fixture, logoFilename]);

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

  // `leyendas` es un caso especial: null = "usar los datos del evento",
  // array = "forzar exactamente estas leyendas" (incluso [] = ninguna).
  const setLeyendasEnabled = (checked) => {
    setCfg((prev) => ({
      ...prev,
      leyendas: checked ? (Array.isArray(prev.leyendas) ? prev.leyendas : []) : null,
    }));
  };

  const setLeyendasText = (text) => {
    // filter(Boolean): Joi rechaza strings vacíos dentro del array
    // ("is not allowed to be empty"), así que textarea vacío o líneas en
    // blanco ⇒ se descartan; con el toggle ON queda [] = "forzar ninguna".
    const lines = text
      .split('\n')
      .map((l) => l.trimEnd())
      .filter(Boolean)
      .slice(0, 3);
    setCfg((prev) => ({ ...prev, leyendas: lines }));
  };

  const handleSave = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      await saveTemplate(eventId, withV(cfg));
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
      message.success('Ahora usa la plantilla global');
    } catch (err) {
      message.error(apiErrorDetail(err) || 'No se pudo revertir la plantilla');
    } finally {
      setReverting(false);
    }
  };

  const handleUploadLogo = async (file) => {
    try {
      const res = await uploadLogo(eventId, file);
      setLogoFilename(res?.logoFilename || null);
      message.success('Logo subido');
    } catch (err) {
      message.error(apiErrorDetail(err) || 'No se pudo subir el logo');
    }
    return false; // evita que antd intente subir el archivo por su cuenta
  };

  if (!cfg) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  const stubEndCol = cfg.stubEndCol ?? DEFAULT_STUB_END_COL;

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
            <Select
              placeholder="Tamaño"
              style={{ width: '100%' }}
              allowClear
              options={SIZE_OPTIONS}
              value={zona.size}
              onChange={(v) => setZona(zone.key, { size: v ?? undefined })}
            />
          )}
          {zone.key === 'leyendas' && (
            <>
              <Checkbox
                checked={Array.isArray(cfg.leyendas)}
                onChange={(e) => setLeyendasEnabled(e.target.checked)}
              >
                Usar leyendas propias
              </Checkbox>
              <TextArea
                rows={3}
                placeholder="Una leyenda por línea (máx. 3)"
                disabled={!Array.isArray(cfg.leyendas)}
                value={Array.isArray(cfg.leyendas) ? cfg.leyendas.join('\n') : ''}
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
            </Space>
          )}
        </Space>
      ),
    };
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
          <Segmented options={FIXTURE_OPTIONS} value={fixture} onChange={setFixture} />
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
      return (
        <div
          style={{
            position: 'absolute',
            top: el.row,
            left: el.col,
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: 600,
            whiteSpace: 'pre',
            fontSize,
            lineHeight: `${fontSize}px`,
            letterSpacing,
            color: '#191919',
          }}
        >
          {el.text}
        </div>
      );
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
