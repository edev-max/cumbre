import { q, uno, lote, uid, numerar, type Sentencia } from '../db';
import { app } from '../estado.svelte';
import { linea as calcLinea, totales, aCentavosUsd, costoPromedio } from '../calculos';
import { ahora } from '../formato';
import { sStock, sMov, quien } from './comun';

/** cantidad y costo van en la presentación de compra (factor = unidades base que trae) */
export interface LineaCompra { id?: string; producto_id: string | null; descripcion: string; cantidad: number; costo_c: number; impuesto_tasa: number; presentacion_id?: string | null; presentacion?: string | null; factor?: number }
export interface OrdenIn {
  id?: string; proveedor_id: string; almacen_id: string; factura_proveedor?: string; vence?: string | null; notas?: string;
  estado: 'borrador' | 'ordenada'; lineas: LineaCompra[]; fecha?: string;
}

export const ESTADOS_COMPRA: Record<string, [string, string]> = {
  borrador: ['Borrador', ''], ordenada: ['Por recibir', 'warn'], parcial: ['Recibida en parte', 'info'], recibida: ['Recibida', 'ok'], anulada: ['Anulada', '']
};

const aCalc = (l: LineaCompra) => ({ cantidad: l.cantidad, precio_c: l.costo_c, impuesto_tasa: l.impuesto_tasa });

/** crea o reemplaza una orden que todavía no ha recibido mercancía */
export async function guardarOrden(o: OrdenIn): Promise<{ id: string; numero: string }> {
  const lineas = o.lineas.filter((l) => l.cantidad > 0);
  if (!o.proveedor_id) throw new Error('Elige el proveedor.');
  if (!lineas.length) throw new Error('La orden no tiene productos.');
  const t = totales(lineas.map(aCalc));
  const S: Sentencia[] = [];
  let id = o.id, numero = '';
  if (id) {
    const prev = await uno<{ numero: string; estado: string }>('SELECT numero, estado FROM compras WHERE id = ?', [id]);
    if (!prev) throw new Error('La orden no existe.');
    if (!['borrador', 'ordenada'].includes(prev.estado)) throw new Error('Esta orden ya recibió mercancía; no se puede editar.');
    numero = prev.numero;
    S.push({ sql: 'DELETE FROM compra_lineas WHERE compra_id = ?', params: [id] });
    S.push({
      sql: `UPDATE compras SET proveedor_id = ?, almacen_id = ?, factura_proveedor = ?, vence = ?, notas = ?, estado = ?, subtotal_c = ?, impuesto_c = ?, total_c = ?, tasa = ? WHERE id = ?`,
      params: [o.proveedor_id, o.almacen_id, o.factura_proveedor || null, o.vence || null, o.notas || null, o.estado, t.subtotal_c, t.impuesto_c, t.total_c, app.tasa, id]
    });
  } else {
    id = uid();
    const nro = await numerar('compra'); numero = nro.numero;
    S.push(nro.sentencia);
    S.push({
      sql: `INSERT INTO compras (id, numero, fecha, proveedor_id, almacen_id, factura_proveedor, estado, subtotal_c, impuesto_c, total_c, tasa, vence, notas, usuario)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [id, numero, o.fecha || ahora(), o.proveedor_id, o.almacen_id, o.factura_proveedor || null, o.estado, t.subtotal_c, t.impuesto_c, t.total_c, app.tasa, o.vence || null, o.notas || null, quien()]
    });
  }
  for (const l of lineas) S.push({
    sql: `INSERT INTO compra_lineas (id, compra_id, producto_id, descripcion, cantidad, costo_c, impuesto_tasa, total_c, presentacion_id, presentacion, factor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [uid(), id, l.producto_id, l.descripcion, l.cantidad, l.costo_c, l.impuesto_tasa, calcLinea(aCalc(l)).total_c, l.presentacion_id || null, l.presentacion || null, l.factor || 1]
  });
  await lote(S);
  return { id: id!, numero };
}

export interface RecibirLinea { compra_linea_id: string; cantidad: number; costo_c: number }
/** entra la mercancía: suma existencia, recalcula el costo promedio y avanza la orden */
export async function recibir(compra_id: string, recibe: RecibirLinea[], almacen_id?: string, notas = '', fecha?: string) {
  const c = await uno<{ numero: string; estado: string; almacen_id: string }>('SELECT numero, estado, almacen_id FROM compras WHERE id = ?', [compra_id]);
  if (!c) throw new Error('La orden no existe.');
  if (['recibida', 'anulada'].includes(c.estado)) throw new Error('Esta orden ya no admite recepciones.');
  const alm = almacen_id || c.almacen_id;
  const lineas = await q('SELECT * FROM compra_lineas WHERE compra_id = ?', [compra_id]);
  const porId = new Map(lineas.map((l) => [l.id, l]));
  const validas = recibe.filter((r) => r.cantidad > 0 && porId.has(r.compra_linea_id));
  if (!validas.length) throw new Error('Indica cuánto llegó de al menos un producto.');
  for (const r of validas) {
    const l = porId.get(r.compra_linea_id)!;
    if (r.cantidad > l.cantidad - l.recibido + 1e-9) throw new Error(`De "${l.descripcion}" faltan por recibir ${l.cantidad - l.recibido}.`);
  }
  // costo promedio: existencia total y costo actual de cada producto
  const prodIds = [...new Set(validas.map((r) => porId.get(r.compra_linea_id)!.producto_id).filter(Boolean))];
  const info = new Map<string, { hay: number; costo: number }>();
  if (prodIds.length) for (const f of await q(
    `SELECT p.id, p.costo_c, COALESCE((SELECT SUM(cantidad) FROM stock s WHERE s.producto_id = p.id), 0) AS hay FROM productos p WHERE p.id IN (${prodIds.map(() => '?').join(',')})`, prodIds))
    info.set(f.id, { hay: f.hay, costo: f.costo_c });

  const id = uid(), nro = await numerar('recepcion'), cuando = fecha || ahora();
  const S: Sentencia[] = [nro.sentencia, {
    sql: 'INSERT INTO recepciones (id, numero, compra_id, fecha, almacen_id, notas, usuario) VALUES (?, ?, ?, ?, ?, ?, ?)',
    params: [id, nro.numero, compra_id, cuando, alm, notas || null, quien()]
  }];
  for (const r of validas) {
    const l = porId.get(r.compra_linea_id)!;
    S.push({ sql: 'INSERT INTO recepcion_lineas (id, recepcion_id, compra_linea_id, producto_id, cantidad, costo_c) VALUES (?, ?, ?, ?, ?, ?)', params: [uid(), id, l.id, l.producto_id, r.cantidad, r.costo_c] });
    l.recibido += r.cantidad;
    if (r.costo_c !== l.costo_c) { l.costo_c = r.costo_c; l.total_c = calcLinea({ cantidad: l.cantidad, precio_c: l.costo_c, impuesto_tasa: l.impuesto_tasa }).total_c; }
    S.push({ sql: 'UPDATE compra_lineas SET recibido = ?, costo_c = ?, total_c = ? WHERE id = ?', params: [l.recibido, l.costo_c, l.total_c, l.id] });
    if (l.producto_id) {
      // la presentación se convierte a unidades base: 2 cajas x 24 = 48 und, a costo / 24
      const f = l.factor || 1, entra = r.cantidad * f, costoBase = Math.round(r.costo_c / f);
      const i = info.get(l.producto_id) || { hay: 0, costo: costoBase };
      const nuevo = costoPromedio(i.hay, i.costo, entra, costoBase);
      info.set(l.producto_id, { hay: i.hay + entra, costo: nuevo });
      S.push({ sql: 'UPDATE productos SET costo_c = ? WHERE id = ?', params: [nuevo, l.producto_id] });
      if (l.presentacion_id) S.push({ sql: 'UPDATE presentaciones SET costo_c = ? WHERE id = ?', params: [r.costo_c, l.presentacion_id] });
      S.push(sStock(l.producto_id, alm, entra));
      S.push(sMov({ id: uid(), fecha: cuando, tipo: 'compra', producto_id: l.producto_id, almacen_id: alm, cantidad: entra, costo_c: costoBase, ref_tipo: 'compra', ref_id: compra_id, ref_numero: c.numero, nota: l.presentacion ? `${r.cantidad} × ${l.presentacion}` : undefined }));
    }
  }
  const t = totales(lineas.map((l) => ({ cantidad: l.cantidad, precio_c: l.costo_c, impuesto_tasa: l.impuesto_tasa })));
  const completa = lineas.every((l) => l.recibido >= l.cantidad - 1e-9);
  S.push({ sql: 'UPDATE compras SET estado = ?, subtotal_c = ?, impuesto_c = ?, total_c = ? WHERE id = ?', params: [completa ? 'recibida' : 'parcial', t.subtotal_c, t.impuesto_c, t.total_c, compra_id] });
  await lote(S);
  return { id, numero: nro.numero };
}

/** registra un pago a proveedor; sin orden indicada se reparte entre las más viejas */
export async function registrarPago(p: { proveedor_id: string; compra_id?: string | null; metodo_id: string; moneda: string; monto: number; referencia?: string; notas?: string; fecha?: string }) {
  const tasa = app.tasa;
  if (p.moneda === 'VES' && !(tasa > 0)) throw new Error('Registra la tasa BCV antes de pagar en bolívares.');
  let resto = aCentavosUsd(p.monto, p.moneda, tasa);
  if (resto <= 0) throw new Error('El monto debe ser mayor que cero.');
  const abiertas = await q(
    // con orden indicada se admite adelantar el pago; sin ella, sólo se reparte entre lo ya recibido
    `SELECT id, total_c, pagado_c FROM compras WHERE ${p.compra_id ? "estado IN ('ordenada','parcial','recibida') AND id = ?" : "estado IN ('parcial','recibida') AND proveedor_id = ?"} AND total_c > pagado_c ORDER BY fecha`,
    [p.compra_id || p.proveedor_id]);
  const deuda = abiertas.reduce((a, c) => a + c.total_c - c.pagado_c, 0);
  if (resto > deuda + 1) throw new Error('El monto es mayor que lo que se debe.');
  const S: Sentencia[] = [];
  for (const c of abiertas) {
    if (resto <= 0) break;
    const aplica = Math.min(resto, c.total_c - c.pagado_c);
    const montoMoneda = p.moneda === 'VES' ? Math.round((aplica / 100) * tasa * 100) / 100 : aplica / 100;
    S.push({
      sql: `INSERT INTO pagos (id, fecha, proveedor_id, compra_id, metodo_id, moneda, monto, tasa, monto_c, referencia, notas, usuario)
            VALUES (?, COALESCE(?, datetime('now','localtime')), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [uid(), p.fecha ?? null, p.proveedor_id, c.id, p.metodo_id, p.moneda, montoMoneda, tasa, aplica, p.referencia || null, p.notas || null, quien()]
    });
    S.push({ sql: 'UPDATE compras SET pagado_c = pagado_c + ? WHERE id = ?', params: [aplica, c.id] });
    resto -= aplica;
  }
  await lote(S);
}

export async function anularOrden(id: string) {
  const c = await uno<{ estado: string; pagado_c: number }>('SELECT estado, pagado_c FROM compras WHERE id = ?', [id]);
  if (!c) return;
  if (!['borrador', 'ordenada'].includes(c.estado)) throw new Error('Ya entró mercancía de esta orden; no se puede anular.');
  if (c.pagado_c > 0) throw new Error('Esta orden tiene pagos registrados.');
  await lote([{ sql: `UPDATE compras SET estado = 'anulada' WHERE id = ?`, params: [id] }]);
}
