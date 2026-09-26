import { lote } from '../db';
import { ahora } from '../formato';

export const ESTADOS_DESPACHO = [
  { v: 'pendiente', t: 'Por despachar', c: 'warn' },
  { v: 'en_ruta', t: 'En ruta', c: 'info' },
  { v: 'entregado', t: 'Entregado', c: 'ok' },
  { v: 'devuelto', t: 'Devuelto', c: 'bad' },
  { v: 'cancelado', t: 'Cancelado', c: '' }
] as const;

export async function actualizarDespacho(id: string, c: { estado?: string; ruta_id?: string | null; transportista_id?: string | null; programado?: string | null; recibe?: string; notas?: string; direccion?: string }) {
  const sets: string[] = [], params: any[] = [];
  for (const [k, v] of Object.entries(c)) if (v !== undefined) { sets.push(`${k} = ?`); params.push(v === '' ? null : v); }
  if (c.estado === 'entregado') { sets.push('entregado_en = ?'); params.push(ahora()); }
  if (!sets.length) return;
  await lote([{ sql: `UPDATE despachos SET ${sets.join(', ')} WHERE id = ?`, params: [...params, id] }]);
}
