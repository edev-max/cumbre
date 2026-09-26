import { enEscritorio, q, exec, uid } from './db';
import { app, ajuste, recargarTasa, avisar } from './estado.svelte';
import { ahora } from './formato';

/* Tareas que corren solas en el escritorio: la tasa del BCV y el respaldo. */
async function invocar<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

export interface TasaBcv { valor: number; fecha: string; fuente: string }

/** consulta al BCV y registra la tasa si es nueva. Devuelve lo que leyó. */
export async function actualizarTasaBcv(avisarSiCambia = false): Promise<TasaBcv> {
  const t = await invocar<TasaBcv>('tasa_bcv');
  const rige = (t.fecha || ahora().slice(0, 10)) + ' 00:00:00';
  const ya = await q(`SELECT 1 FROM tasas WHERE fuente IN ('bcv', 'dolarapi') AND substr(fecha, 1, 10) = ? AND ABS(valor - ?) < 0.00001`, [rige.slice(0, 10), t.valor]);
  if (!ya.length) {
    await exec('INSERT INTO tasas (id, fecha, valor, fuente) VALUES (?, ?, ?, ?)', [uid(), rige, t.valor, t.fuente || 'bcv']);
    if (avisarSiCambia) avisar(`Tasa BCV ${t.valor.toLocaleString('es-VE')} Bs/$${t.fecha ? ', rige desde el ' + t.fecha.split('-').reverse().join('/') : ''}.`, 'info');
  }
  await ajuste('tasa_auto_ultima', ahora());
  await ajuste('tasa_auto_error', '');
  await recargarTasa();
  return t;
}

export interface Hecho { archivo: string; carpeta: string; bytes: number; guardados: number }
export interface CarpetaSugerida { nombre: string; ruta: string; nube: boolean }

export const sugerirCarpetas = () => invocar<CarpetaSugerida[]>('respaldo_sugerencias');
export async function respaldarAhora(): Promise<Hecho> {
  const carpeta = app.ajustes.respaldo_carpeta;
  if (!carpeta) throw new Error('Elige primero dónde guardar los respaldos.');
  try {
    const h = await invocar<Hecho>('respaldo_guardar', { carpeta, conservar: 30 });
    await ajuste('respaldo_ultimo', ahora());
    await ajuste('respaldo_error', '');
    return h;
  } catch (e) {
    await ajuste('respaldo_error', String(e)).catch(() => {});
    throw e;
  }
}

const horasDesde = (f?: string) => (f ? (Date.now() - new Date(f.replace(' ', 'T')).getTime()) / 3600000 : Infinity);
let iniciado = false;

export function iniciarAutomatico() {
  if (iniciado || !enEscritorio()) return;
  iniciado = true;
  const tasa = async () => {
    if (app.ajustes.tasa_auto === '0') return;
    if (horasDesde(app.ajustes.tasa_auto_ultima) < 2.9) return;
    try { await actualizarTasaBcv(true); }
    catch (e) { await ajuste('tasa_auto_error', String(e)).catch(() => {}); }
  };
  const respaldo = async () => {
    if (!app.ajustes.respaldo_carpeta || app.ajustes.respaldo_auto === '0') return;
    if (horasDesde(app.ajustes.respaldo_ultimo) < 12) return;
    try { await respaldarAhora(); } catch { /* queda anotado; se reintenta en la próxima vuelta */ }
  };
  setTimeout(() => { tasa(); respaldo(); }, 4000);
  setInterval(() => { tasa(); respaldo(); }, 30 * 60 * 1000);
}
