import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Row, Col, Card, Spin, message } from 'antd';
import { venueLayoutApi } from '../services/apiService';
import LayoutCanvas from '../components/venue/LayoutCanvas';
import LayoutToolbar from '../components/venue/LayoutToolbar';
import SectorList from '../components/venue/SectorList';
import SectorProperties from '../components/venue/SectorProperties';
import { deriveViewbox } from '../lib/canvasGeom';

function parseViewbox(str) {
  const [a, b, c, d] = String(str || '0 0 1000 1000').trim().split(/\s+/).map(Number);
  return [a, b, c, d];
}
// Normalize: getLayout may resolve to the body OR an axios response. Return the body.
function body(res) { return res && res.data !== undefined && res.status !== undefined ? res.data : res; }

export default function VenueLayoutBuilder() {
  const { venueId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [viewbox, setViewbox] = useState([0, 0, 1000, 1000]);
  const [sectors, setSectors] = useState([]);
  const [tool, setTool] = useState('select');
  const [activeSectorId, setActiveSectorId] = useState(null);
  const [draftPoints, setDraftPoints] = useState([]);
  const [draftGeometry, setDraftGeometry] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = body(await venueLayoutApi.getLayout(venueId));
      setImageUrl(data.imageUrl || null);
      setViewbox(parseViewbox(data.viewbox));
      setSectors(data.sectors || []);
    } catch (e) {
      message.error(e?.response?.data?.error || e.message || 'No se pudo cargar el plano');
    } finally { setLoading(false); }
  }, [venueId]);

  useEffect(() => { load(); }, [load]);

  const onVertexAdd = (pt) => setDraftPoints((p) => [...p, pt]);
  const onPolygonClose = () => {
    if (draftPoints.length < 3) { message.warning('Un sector necesita al menos 3 vértices'); return; }
    setDraftGeometry({ points: draftPoints });
    setDraftPoints([]);
    setActiveSectorId(null);
    setTool('select');
  };

  const saveNewSector = async (b) => {
    setSaving(true);
    try {
      const created = body(await venueLayoutApi.createSector(venueId, b));
      message.success('Sector creado');
      setDraftGeometry(null);
      await load();
      if (created?.id) setActiveSectorId(String(created.id));
    } catch (e) {
      message.error(e?.response?.data?.error || e.message || 'Error al crear el sector');
    } finally { setSaving(false); }
  };

  const saveExistingSector = async (b) => {
    setSaving(true);
    try {
      await venueLayoutApi.updateSector(venueId, activeSectorId, b);
      message.success('Sector actualizado');
      await load();
    } catch (e) {
      message.error(e?.response?.data?.error || e.message || 'Error al actualizar');
    } finally { setSaving(false); }
  };

  const deleteSector = async (id) => {
    const prev = sectors;
    setSectors((s) => s.filter((x) => x.id !== id));
    try {
      await venueLayoutApi.deleteSector(venueId, id);
      message.success('Sector borrado');
      if (activeSectorId === id) setActiveSectorId(null);
    } catch (e) {
      setSectors(prev);
      message.error(e?.response?.data?.error || e.message || 'Error al borrar');
    }
  };

  const onVertexDrag = (sectorId, index, pt) => {
    setSectors((arr) => arr.map((s) => {
      if (s.id !== sectorId) return s;
      const points = s.geometry.points.map((p, i) => (i === index ? pt : p));
      return { ...s, geometry: { ...s.geometry, points } };
    }));
  };
  const onVertexDragEnd = async (sectorId) => {
    const s = sectors.find((x) => x.id === sectorId);
    if (!s) return;
    try {
      await venueLayoutApi.updateSector(venueId, sectorId, { geometry: s.geometry });
    } catch (e) {
      message.error('No se pudo guardar la posición'); load();
    }
  };

  const onUploadImage = async (file) => {
    try {
      const res = body(await venueLayoutApi.uploadLayoutImage(venueId, file));
      const url = res.url;
      setImageUrl(url);
      const img = new Image();
      img.onload = async () => {
        const vb = deriveViewbox(img.naturalWidth, img.naturalHeight);
        await venueLayoutApi.setViewbox(venueId, vb);
        setViewbox(parseViewbox(vb));
      };
      img.src = url.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || ''}${url}`;
      message.success('Imagen subida');
    } catch (e) {
      message.error(e?.response?.data?.error || e.message || 'Error al subir imagen');
    }
  };

  const activeSector = sectors.find((s) => s.id === activeSectorId) || null;
  const fullImg = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `${import.meta.env.VITE_API_URL || ''}${imageUrl}`) : null;

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: 16 }}>
      <LayoutToolbar tool={tool} onToolChange={setTool} onUploadImage={onUploadImage} />
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} md={16}>
          <Card styles={{ body: { padding: 0, height: 520 } }}>
            <LayoutCanvas
              viewbox={viewbox} imageUrl={fullImg} sectors={sectors}
              activeSectorId={activeSectorId} tool={tool} draftPoints={draftPoints}
              onVertexAdd={onVertexAdd} onPolygonClose={onPolygonClose}
              onSelectSector={(id) => setActiveSectorId(id)}
              onVertexDrag={onVertexDrag} onVertexDragEnd={onVertexDragEnd}
              onViewChange={setViewbox}
            />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card style={{ marginBottom: 16 }}>
            <SectorList sectors={sectors} activeSectorId={activeSectorId} onSelect={setActiveSectorId} />
          </Card>
          {draftGeometry ? (
            <Card><SectorProperties value={null} geometry={draftGeometry} saving={saving}
              onSave={saveNewSector} onDelete={() => setDraftGeometry(null)} /></Card>
          ) : activeSector ? (
            <Card><SectorProperties value={activeSector} geometry={null} saving={saving}
              onSave={saveExistingSector} onDelete={deleteSector} /></Card>
          ) : (
            <Card>Elegí "Dibujar sector" para crear, o seleccioná uno de la lista.</Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
