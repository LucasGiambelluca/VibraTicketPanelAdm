import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import LayoutCanvas from '../LayoutCanvas';

describe('LayoutCanvas', () => {
  it('renders a polygon per sector', () => {
    const sectors = [{ id: '1', name: 'A', kind: 'GA', geometry: { points: [[0,0],[10,0],[10,10]] }, defaultColor: '#00B69B' }];
    const { container } = render(
      <LayoutCanvas viewbox={[0,0,100,100]} imageUrl={null} sectors={sectors}
        activeSectorId={null} tool="select" draftPoints={[]}
        onVertexAdd={vi.fn()} onPolygonClose={vi.fn()} onSelectSector={vi.fn()}
        onVertexDrag={vi.fn()} onVertexDragEnd={vi.fn()} onViewChange={vi.fn()} />
    );
    expect(container.querySelectorAll('polygon').length).toBe(1);
  });
});
