import React, { useRef, useState } from 'react';
import { screenToViewbox, pointsToSvg, isNearPoint, zoomViewbox, panViewbox, clampZoom } from '../../lib/canvasGeom';

/**
 * Props:
 *  viewbox: [minX,minY,w,h]
 *  imageUrl: string|null
 *  sectors: [{ id, name, kind, geometry:{points,label}, defaultColor }]
 *  activeSectorId: string|null
 *  tool: 'select'|'draw'|'edit'|'delete'
 *  draftPoints: [[x,y],...]
 *  onVertexAdd(pt), onPolygonClose(), onSelectSector(id),
 *  onVertexDrag(sectorId, index, pt), onVertexDragEnd(sectorId),
 *  onViewChange(viewbox)
 */
export default function LayoutCanvas({
  viewbox, imageUrl, sectors, activeSectorId, tool, draftPoints,
  onVertexAdd, onPolygonClose, onSelectSector, onVertexDrag, onVertexDragEnd, onViewChange,
}) {
  const svgRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const CLOSE_TOL = viewbox[2] * 0.02;

  const toVb = (e) => screenToViewbox(e, svgRef.current);

  const handleClick = (e) => {
    if (tool !== 'draw') return;
    const pt = toVb(e);
    if (draftPoints.length >= 3 && isNearPoint(pt, draftPoints[0], CLOSE_TOL)) {
      onPolygonClose();
    } else {
      onVertexAdd(pt);
    }
  };

  const handleDoubleClick = () => {
    if (tool === 'draw' && draftPoints.length >= 3) onPolygonClose();
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const center = toVb(e);
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const scale = clampZoom(viewbox[2] * factor, 50, 100000) / viewbox[2];
    onViewChange(zoomViewbox(viewbox, scale, center));
  };

  const handlePointerDown = (e) => {
    if (e.button === 1 || (tool === 'select' && e.target === svgRef.current)) {
      setDrag({ pan: true, last: [e.clientX, e.clientY] });
    }
  };
  const handlePointerMove = (e) => {
    if (!drag) return;
    if (drag.pan) {
      const dxScreen = e.clientX - drag.last[0];
      const dyScreen = e.clientY - drag.last[1];
      const scaleX = viewbox[2] / svgRef.current.clientWidth;
      const scaleY = viewbox[3] / svgRef.current.clientHeight;
      onViewChange(panViewbox(viewbox, -dxScreen * scaleX, -dyScreen * scaleY));
      setDrag({ pan: true, last: [e.clientX, e.clientY] });
    } else if (drag.sectorId != null) {
      onVertexDrag(drag.sectorId, drag.index, toVb(e));
    }
  };
  const handlePointerUp = () => {
    if (drag && drag.sectorId != null) onVertexDragEnd(drag.sectorId);
    setDrag(null);
  };

  return (
    <svg
      ref={svgRef}
      viewBox={viewbox.join(' ')}
      style={{ width: '100%', height: '100%', background: '#fff', touchAction: 'none', cursor: tool === 'draw' ? 'crosshair' : 'default' }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {imageUrl && <image href={imageUrl} x={viewbox[0]} y={viewbox[1]} width={viewbox[2]} height={viewbox[3]} opacity="0.5" />}

      {sectors.map((s) => (
        <polygon
          key={s.id}
          points={pointsToSvg(s.geometry?.points || [])}
          fill={s.defaultColor || '#00B69B'}
          fillOpacity={s.id === activeSectorId ? 0.45 : 0.3}
          stroke={s.id === activeSectorId ? '#007AFF' : (s.defaultColor || '#00B69B')}
          strokeWidth={viewbox[2] * 0.003}
          style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
          onClick={(e) => { if (tool === 'select') { e.stopPropagation(); onSelectSector(s.id); } }}
        />
      ))}

      {tool === 'edit' && sectors.filter((s) => s.id === activeSectorId).map((s) => (
        (s.geometry?.points || []).map((p, i) => (
          <circle
            key={`${s.id}-${i}`}
            cx={p[0]} cy={p[1]} r={viewbox[2] * 0.008}
            fill="#007AFF"
            style={{ cursor: 'grab' }}
            onPointerDown={(e) => { e.stopPropagation(); setDrag({ sectorId: s.id, index: i }); }}
          />
        ))
      ))}

      {draftPoints.length > 0 && (
        <>
          <polyline points={pointsToSvg(draftPoints)} fill="none" stroke="#007AFF" strokeWidth={viewbox[2] * 0.003} />
          {draftPoints.map((p, i) => (
            <circle key={`d-${i}`} cx={p[0]} cy={p[1]} r={viewbox[2] * 0.008} fill={i === 0 ? '#E93AB8' : '#007AFF'} />
          ))}
        </>
      )}
    </svg>
  );
}
