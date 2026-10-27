import { lote, uid, numerar, q, type Sentencia } from '../db';
import { sStock, sMov, verificarStock } from './comun';

export interface LineaAjuste { producto_id: string; cantidad: number; costo_c?: number }

/** entradas (+) y salidas (-) sueltas: mermas, consumo, sobrantes, conteo físico */
export async function ajustar(almacen_id: string, lineas: LineaAjuste[], motivo: string) {
  const vale = lineas.filter((l) => l.cantidad !== 0);
  if (!vale.length) throw new Error('No hay cantidades para ajustar.');
  const salidas = new Map<string, number>();
  for (const l of vale) if (l.cantidad < 0) salidas.set(l.producto_id, (salidas.get(l.producto_id) || 0) - l.cantidad);
  await verificarStock(almacen_id, salidas);
  const costos = new Map((await q(`SELECT id, costo_c FROM productos WHERE id IN (${vale.map(() => '?').join(',')})`, vale.map((l) => l.producto_id))).map((f) => [f.id, f.costo_c]));
  const nro = await numerar('ajuste');
  const S: Sentencia[] = [nro.sentencia];
  for (const l of vale) {
    S.push(sStock(l.producto_id, almacen_id, l.cantidad));
    S.push(sMov({ id: uid(), tipo: 'ajuste', producto_id: l.producto_id, almacen_id, cantidad: l.cantidad, costo_c: l.costo_c ?? costos.get(l.producto_id) ?? 0, ref_tipo: 'ajuste', ref_numero: nro.numero, nota: motivo }));
  }
  await lote(S);
  return nro.numero;
}

/** traslado entre almacenes: sale de uno y entra en otro, con el mismo número */
export async function trasladar(origen: string, destino: string, lineas: LineaAjuste[], nota = '') {
  if (!origen || !destino || origen === destino) throw new Error('Elige dos almacenes distintos.');
  const vale = lineas.filter((l) => l.cantidad > 0);
  if (!vale.length) throw new Error('No hay cantidades para trasladar.');
  const salidas = new Map<string, number>();
  for (const l of vale) salidas.set(l.producto_id, (salidas.get(l.producto_id) || 0) + l.cantidad);
  await verificarStock(origen, salidas);
  const costos = new Map((await q(`SELECT id, costo_c FROM productos WHERE id IN (${vale.map(() => '?').join(',')})`, vale.map((l) => l.producto_id))).map((f) => [f.id, f.costo_c]));
  const nro = await numerar('traslado');
  const S: Sentencia[] = [nro.sentencia];
  for (const l of vale) {
    const c = costos.get(l.producto_id) ?? 0;
    S.push(sStock(l.producto_id, origen, -l.cantidad), sStock(l.producto_id, destino, l.cantidad));
    S.push(sMov({ id: uid(), tipo: 'traslado', producto_id: l.producto_id, almacen_id: origen, cantidad: -l.cantidad, costo_c: c, ref_tipo: 'traslado', ref_numero: nro.numero, nota }));
    S.push(sMov({ id: uid(), tipo: 'traslado', producto_id: l.producto_id, almacen_id: destino, cantidad: l.cantidad, costo_c: c, ref_tipo: 'traslado', ref_numero: nro.numero, nota }));
  }
  await lote(S);
  return nro.numero;
}
