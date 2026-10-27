/* Cálculos de documentos. Todo en centavos de USD (enteros) para que las
   sumas cuadren; los bolívares se calculan con la tasa del documento. */
export interface LineaCalc { cantidad: number; precio_c: number; descuento?: number; impuesto_tasa?: number }
export interface Totales { subtotal_c: number; descuento_c: number; impuesto_c: number; total_c: number }

export const redondear = (n: number) => Math.round(n + Number.EPSILON * Math.sign(n));

export function linea(l: LineaCalc) {
  const bruto = l.cantidad * l.precio_c;
  const desc = redondear(bruto * (l.descuento || 0) / 100);
  const base = redondear(bruto) - desc;
  const imp = redondear(base * (l.impuesto_tasa || 0) / 100);
  return { bruto_c: redondear(bruto), descuento_c: desc, base_c: base, impuesto_c: imp, total_c: base + imp };
}

export function totales(lineas: LineaCalc[]): Totales {
  let sub = 0, desc = 0, imp = 0;
  for (const l of lineas) { const r = linea(l); sub += r.bruto_c; desc += r.descuento_c; imp += r.impuesto_c; }
  return { subtotal_c: sub, descuento_c: desc, impuesto_c: imp, total_c: sub - desc + imp };
}

/** centavos de USD → bolívares a una tasa */
export const aBs = (c: number, tasa: number) => (c / 100) * tasa;
/** un monto en una moneda → centavos de USD */
export function aCentavosUsd(monto: number, moneda: string, tasa: number): number {
  if (moneda === 'VES') return tasa > 0 ? redondear((monto / tasa) * 100) : 0;
  return redondear(monto * 100);
}
/** saldo pendiente, nunca negativo */
export const saldo = (total_c: number, pagado_c: number) => Math.max(0, total_c - pagado_c);

/** estado de pago de un documento */
export function estadoPago(total_c: number, pagado_c: number): 'pagada' | 'parcial' | 'pendiente' {
  if (pagado_c >= total_c && total_c > 0) return 'pagada';
  if (pagado_c > 0) return 'parcial';
  return 'pendiente';
}

/** costo promedio ponderado al recibir mercancía */
export function costoPromedio(stockActual: number, costoActual_c: number, entra: number, costoEntra_c: number): number {
  const base = Math.max(0, stockActual);
  if (base + entra <= 0) return costoEntra_c;
  return redondear((base * costoActual_c + entra * costoEntra_c) / (base + entra));
}

/** días de atraso de una cuenta (0 si no está vencida) */
export function diasVencida(vence: string | null | undefined, hoy = new Date()): number {
  if (!vence) return 0;
  const d = new Date(vence.replace(' ', 'T'));
  const ms = hoy.getTime() - d.getTime();
  return ms > 0 ? Math.floor(ms / 86400000) : 0;
}
