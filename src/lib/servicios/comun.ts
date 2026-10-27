import { q, type Sentencia } from '../db';
import { app } from '../estado.svelte';
import { num } from '../formato';

export const quien = () => app.usuario.nombre;

/** suma (o resta) existencia en un almacén */
export function sStock(producto_id: string, almacen_id: string, delta: number): Sentencia {
  return {
    sql: `INSERT INTO stock (producto_id, almacen_id, cantidad) VALUES (?, ?, ?)
          ON CONFLICT(producto_id, almacen_id) DO UPDATE SET cantidad = cantidad + excluded.cantidad`,
    params: [producto_id, almacen_id, delta]
  };
}
export interface Mov { id: string; fecha?: string; tipo: string; producto_id: string; almacen_id: string; cantidad: number; costo_c?: number; ref_tipo?: string; ref_id?: string; ref_numero?: string; nota?: string }
export function sMov(m: Mov): Sentencia {
  return {
    sql: `INSERT INTO movimientos (id, fecha, tipo, producto_id, almacen_id, cantidad, costo_c, ref_tipo, ref_id, ref_numero, nota, usuario)
          VALUES (?, COALESCE(?, datetime('now','localtime')), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [m.id, m.fecha ?? null, m.tipo, m.producto_id, m.almacen_id, m.cantidad, m.costo_c ?? 0, m.ref_tipo ?? null, m.ref_id ?? null, m.ref_numero ?? null, m.nota ?? null, quien()]
  };
}

/** revisa que alcance la existencia; se puede permitir vender en negativo desde Configuración */
export async function verificarStock(almacen_id: string, salidas: Map<string, number>) {
  if (app.ajustes.permitir_negativo === '1' || !salidas.size) return;
  const ids = [...salidas.keys()];
  const filas = await q(
    `SELECT p.id, p.nombre, p.unidad, COALESCE(s.cantidad, 0) AS hay FROM productos p
     LEFT JOIN stock s ON s.producto_id = p.id AND s.almacen_id = ?
     WHERE p.id IN (${ids.map(() => '?').join(',')})`, [almacen_id, ...ids]);
  for (const f of filas) {
    const pide = salidas.get(f.id) || 0;
    if (pide > f.hay + 1e-9) throw new Error(`No alcanza "${f.nombre}": hay ${num(f.hay)} ${f.unidad} y se piden ${num(pide)}.`);
  }
}
