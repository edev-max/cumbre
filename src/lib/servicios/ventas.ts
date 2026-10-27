import { q, uno, lote, uid, numerar, type Sentencia } from '../db';
import { app } from '../estado.svelte';
import { linea as calcLinea, totales, aCentavosUsd, saldo as saldoDe } from '../calculos';
import { ahora } from '../formato';
import { sStock, sMov, verificarStock, quien } from './comun';

export const CONTADO = 'contado';

/** cantidad y precio van en la presentación (factor = unidades base que trae; 1 si es la unidad base) */
export interface LineaVenta { producto_id: string | null; descripcion: string; cantidad: number; precio_c: number; descuento?: number; impuesto_tasa: number; costo_c?: number; presentacion_id?: string | null; presentacion?: string | null; factor?: number }
export interface PagoIn { metodo_id: string; moneda: string; monto: number; referencia?: string }
export interface VentaIn {
  cliente_id: string; almacen_id: string; origen: 'pos' | 'nota'; entrega?: 'retira' | 'despacho';
  lineas: LineaVenta[]; pagos?: PagoIn[]; vence?: string | null; notas?: string; fecha?: string; tasa?: number;
  despacho?: { direccion?: string; ruta_id?: string | null; transportista_id?: string | null; programado?: string | null };
}

export async function crearVenta(v: VentaIn): Promise<{ id: string; numero: string }> {
  const lineas = v.lineas.filter((l) => l.cantidad > 0);
  if (!lineas.length) throw new Error('La venta no tiene productos.');
  if (!v.almacen_id) throw new Error('Falta el almacén.');
  const tasa = v.tasa ?? app.tasa;
  const t = totales(lineas);
  const pagos = (v.pagos || []).filter((p) => p.monto > 0);
  const pagosC = pagos.map((p) => aCentavosUsd(p.monto, p.moneda, tasa));
  const pagado = pagosC.reduce((a, b) => a + b, 0);
  if (pagado > t.total_c + 1) throw new Error('Lo cobrado supera el total. Registra el vuelto.');
  const debe = saldoDe(t.total_c, pagado);
  if (debe > 1) {
    if (v.cliente_id === CONTADO) throw new Error('Una venta a "Cliente de contado" se cobra completa. Elige un cliente para darle crédito.');
    const c = await uno<{ limite_credito_c: number; nombre: string }>('SELECT limite_credito_c, nombre FROM clientes WHERE id = ?', [v.cliente_id]);
    if (c && c.limite_credito_c > 0) {
      const deuda = (await uno<{ d: number }>(`SELECT COALESCE(SUM(total_c - pagado_c), 0) AS d FROM ventas WHERE cliente_id = ? AND estado = 'confirmada'`, [v.cliente_id]))?.d || 0;
      if (deuda + debe > c.limite_credito_c) throw new Error(`${c.nombre} pasaría su límite de crédito.`);
    }
  }
  const salidas = new Map<string, number>();
  const base = (l: LineaVenta) => l.cantidad * (l.factor || 1);
  for (const l of lineas) if (l.producto_id) salidas.set(l.producto_id, (salidas.get(l.producto_id) || 0) + base(l));
  await verificarStock(v.almacen_id, salidas);

  // costo del momento, para la utilidad
  const costos = new Map<string, number>();
  if (salidas.size) for (const f of await q(`SELECT id, costo_c FROM productos WHERE id IN (${[...salidas.keys()].map(() => '?').join(',')})`, [...salidas.keys()])) costos.set(f.id, f.costo_c);

  const id = uid(), fecha = v.fecha || ahora();
  const nro = await numerar(v.origen === 'pos' ? 'pos' : 'venta');
  const S: Sentencia[] = [nro.sentencia];
  const entrega = v.entrega || 'retira';
  S.push({
    sql: `INSERT INTO ventas (id, numero, fecha, cliente_id, almacen_id, origen, estado, entrega, subtotal_c, descuento_c, impuesto_c, total_c, pagado_c, tasa, vence, notas, usuario)
          VALUES (?, ?, ?, ?, ?, ?, 'confirmada', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [id, nro.numero, fecha, v.cliente_id, v.almacen_id, v.origen, entrega, t.subtotal_c, t.descuento_c, t.impuesto_c, t.total_c, Math.min(pagado, t.total_c), tasa, debe > 1 ? v.vence || null : null, v.notas || null, quien()]
  });
  for (const l of lineas) {
    const f = l.factor || 1, r = calcLinea(l), costoBase = l.producto_id ? costos.get(l.producto_id) ?? l.costo_c ?? 0 : 0, costo = Math.round(costoBase * f);
    S.push({
      sql: `INSERT INTO venta_lineas (id, venta_id, producto_id, descripcion, cantidad, precio_c, descuento, impuesto_tasa, costo_c, total_c, presentacion_id, presentacion, factor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [uid(), id, l.producto_id, l.descripcion, l.cantidad, l.precio_c, l.descuento || 0, l.impuesto_tasa, costo, r.total_c, l.presentacion_id || null, l.presentacion || null, f]
    });
    if (l.producto_id) {
      S.push(sStock(l.producto_id, v.almacen_id, -base(l)));
      S.push(sMov({ id: uid(), fecha, tipo: 'venta', producto_id: l.producto_id, almacen_id: v.almacen_id, cantidad: -base(l), costo_c: costoBase, ref_tipo: 'venta', ref_id: id, ref_numero: nro.numero, nota: l.presentacion || undefined }));
    }
  }
  pagos.forEach((p, i) => S.push(sCobro({ fecha, cliente_id: v.cliente_id, venta_id: id, metodo_id: p.metodo_id, moneda: p.moneda, monto: p.monto, tasa, monto_c: pagosC[i], referencia: p.referencia })));
  if (entrega === 'despacho') {
    const dn = await numerar('despacho');
    S.push(dn.sentencia);
    const cli = await uno<{ direccion: string }>('SELECT direccion FROM clientes WHERE id = ?', [v.cliente_id]);
    S.push({
      sql: `INSERT INTO despachos (id, numero, fecha, venta_id, cliente_id, ruta_id, transportista_id, direccion, programado, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      params: [uid(), dn.numero, fecha, id, v.cliente_id, v.despacho?.ruta_id || null, v.despacho?.transportista_id || null, v.despacho?.direccion || cli?.direccion || null, v.despacho?.programado || null]
    });
  }
  await lote(S);
  return { id, numero: nro.numero };
}

function sCobro(c: { fecha?: string; cliente_id: string; venta_id: string; metodo_id: string; moneda: string; monto: number; tasa: number; monto_c: number; referencia?: string; notas?: string }): Sentencia {
  return {
    sql: `INSERT INTO cobros (id, fecha, cliente_id, venta_id, metodo_id, moneda, monto, tasa, monto_c, referencia, notas, usuario)
          VALUES (?, COALESCE(?, datetime('now','localtime')), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [uid(), c.fecha ?? null, c.cliente_id, c.venta_id, c.metodo_id, c.moneda, c.monto, c.tasa, c.monto_c, c.referencia || null, c.notas || null, quien()]
  };
}

/** registra un cobro. Sin venta indicada, se reparte entre las deudas más viejas del cliente. */
export async function registrarCobro(c: { cliente_id: string; venta_id?: string | null; metodo_id: string; moneda: string; monto: number; referencia?: string; notas?: string; tasa?: number }) {
  const tasa = c.tasa ?? app.tasa;
  if (c.moneda === 'VES' && !(tasa > 0)) throw new Error('Registra la tasa BCV antes de cobrar en bolívares.');
  let resto = aCentavosUsd(c.monto, c.moneda, tasa);
  if (resto <= 0) throw new Error('El monto debe ser mayor que cero.');
  const abiertas = await q(
    `SELECT id, total_c, pagado_c FROM ventas WHERE estado = 'confirmada' AND total_c > pagado_c AND ${c.venta_id ? 'id = ?' : 'cliente_id = ?'} ORDER BY fecha`,
    [c.venta_id || c.cliente_id]);
  const deuda = abiertas.reduce((a, v) => a + v.total_c - v.pagado_c, 0);
  if (resto > deuda + 1) throw new Error('El monto es mayor que lo que se debe.');
  const S: Sentencia[] = [];
  for (const v of abiertas) {
    if (resto <= 0) break;
    const aplica = Math.min(resto, v.total_c - v.pagado_c);
    const montoMoneda = c.moneda === 'VES' ? Math.round((aplica / 100) * tasa * 100) / 100 : aplica / 100;
    S.push(sCobro({ cliente_id: c.cliente_id, venta_id: v.id, metodo_id: c.metodo_id, moneda: c.moneda, monto: montoMoneda, tasa, monto_c: aplica, referencia: c.referencia, notas: c.notas }));
    S.push({ sql: 'UPDATE ventas SET pagado_c = pagado_c + ? WHERE id = ?', params: [aplica, v.id] });
    resto -= aplica;
  }
  await lote(S);
}

export async function anularCobro(id: string) {
  const c = await uno<{ venta_id: string; monto_c: number; anulado: number }>('SELECT venta_id, monto_c, anulado FROM cobros WHERE id = ?', [id]);
  if (!c || c.anulado) return;
  await lote([
    { sql: 'UPDATE cobros SET anulado = 1 WHERE id = ?', params: [id] },
    { sql: 'UPDATE ventas SET pagado_c = MAX(0, pagado_c - ?) WHERE id = ?', params: [c.monto_c, c.venta_id] }
  ]);
}

export async function anularVenta(id: string, motivo = '') {
  const v = await uno<{ numero: string; estado: string; almacen_id: string }>('SELECT numero, estado, almacen_id FROM ventas WHERE id = ?', [id]);
  if (!v || v.estado === 'anulada') return;
  const lineas = await q('SELECT producto_id, cantidad * factor AS cantidad, costo_c / factor AS costo_c FROM venta_lineas WHERE venta_id = ? AND producto_id IS NOT NULL', [id]);
  const S: Sentencia[] = [
    { sql: `UPDATE ventas SET estado = 'anulada', pagado_c = 0, notas = TRIM(COALESCE(notas, '') || ' ' || ?) WHERE id = ?`, params: [motivo ? 'Anulada: ' + motivo : 'Anulada', id] },
    { sql: 'UPDATE cobros SET anulado = 1 WHERE venta_id = ?', params: [id] },
    { sql: `UPDATE despachos SET estado = 'cancelado' WHERE venta_id = ? AND estado != 'entregado'`, params: [id] }
  ];
  for (const l of lineas) {
    S.push(sStock(l.producto_id, v.almacen_id, l.cantidad));
    S.push(sMov({ id: uid(), tipo: 'anulacion', producto_id: l.producto_id, almacen_id: v.almacen_id, cantidad: l.cantidad, costo_c: Math.round(l.costo_c), ref_tipo: 'venta', ref_id: id, ref_numero: v.numero, nota: motivo }));
  }
  await lote(S);
}
