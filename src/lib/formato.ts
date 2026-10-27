/* Formatos venezolanos: 1.234,56 */
const nf = (min: number, max = min) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: min, maximumFractionDigits: max });
const n2 = nf(2), n0 = nf(0), n3 = nf(0, 3);

export const usd = (c: number | null | undefined) => '$ ' + n2.format((c || 0) / 100);
export const bs = (monto: number | null | undefined) => 'Bs ' + n2.format(monto || 0);
export const bsDeC = (c: number | null | undefined, tasa: number) => bs(((c || 0) / 100) * (tasa || 0));
export const num = (n: number | null | undefined) => n3.format(n || 0);
export const entero = (n: number | null | undefined) => n0.format(n || 0);
export const tasaFmt = (t: number | null | undefined) => n2.format(t || 0) + ' Bs/$';
export const pct = (n: number | null | undefined) => n0.format(n || 0) + ' %';

const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function d(s: string) { return new Date(s.replace(' ', 'T')); }
export function fecha(s: string | null | undefined) {
  if (!s) return '—';
  const x = d(s); return `${x.getDate()} ${meses[x.getMonth()]} ${x.getFullYear()}`;
}
export function fechaHora(s: string | null | undefined) {
  if (!s) return '—';
  const x = d(s); return `${x.getDate()} ${meses[x.getMonth()]}, ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
}
/** 'YYYY-MM-DD HH:MM:SS' en hora local, como la guarda SQLite con 'localtime' */
export function ahora(desplazaDias = 0) {
  const x = new Date(Date.now() + desplazaDias * 86400000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())} ${p(x.getHours())}:${p(x.getMinutes())}:${p(x.getSeconds())}`;
}
export const hoy = () => ahora().slice(0, 10);

/** texto → centavos: acepta "12,50", "12.50", "1.234,56" */
export function leerMonto(t: string | number): number {
  if (typeof t === 'number') return Math.round(t * 100);
  let s = String(t).trim().replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? Math.round(n * 100) : 0;
}
export function leerNumero(t: string | number): number {
  if (typeof t === 'number') return t;
  let s = String(t).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
/** centavos → texto editable "12,50" */
export const montoEditable = (c: number) => ((c || 0) / 100).toFixed(2).replace('.', ',');
