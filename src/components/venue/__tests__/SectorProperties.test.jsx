import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SectorProperties from '../SectorProperties';

describe('SectorProperties', () => {
  it('submits the form body including geometry', async () => {
    const onSave = vi.fn();
    render(<SectorProperties value={null} geometry={{ points: [[0,0],[1,0],[1,1]] }} onSave={onSave} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Campo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(onSave).toHaveBeenCalled();
    const body = onSave.mock.calls[0][0];
    expect(body.name).toBe('Campo');
    expect(body.geometry).toEqual({ points: [[0,0],[1,0],[1,1]] });
  });
});
