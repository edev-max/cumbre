import { q, uno, exec, uid } from './db';
import { ahora } from './formato';

/* Estado global de Cumbre: empresa, tasa del día, usuario y avisos */
export const app = $state({
  listo: false,
  error: '' as string,
  ajustes: {} as Record<string, string>,
  tasa: 0,
  tasaFecha: '' as string,
  usuario: { id: '', nombre: 'Administrador', rol: 'admin' },
  tema: 'noche' as 'noche' | 'papel',
  licencia: { estado: 'demo', cliente: '', vence: '', dias_prueba: 0, escribir: true } as { estado: string; cliente: string; vence: string; dias_prueba: number; escribir: boolean },
  version: 0 // sube cuando cambian datos compartidos (para refrescar vistas)
});

export async function cargarAjustes() {
  const filas = await q('SELECT clave, valor FROM ajustes');
  const a: Record<string, string> = {};
  for (const f of filas) a[f.clave] = f.valor;
  app.ajustes = a;
  app.tema = (a.tema as any) || 'noche';
  document.documentElement.dataset.theme = app.tema;
  const t = await uno<{ valor: number; fecha: string }>('SELECT valor, fecha FROM tasas ORDER BY fecha DESC LIMIT 1');
  app.tasa = t?.valor || 0; app.tasaFecha = t?.fecha || '';
}
export async function ajuste(clave: string, valor: string) {
  await exec('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor', [clave, valor]);
  app.ajustes[clave] = valor;
}
export async function registrarTasa(valor: number, fuente = 'manual') {
  const f = ahora();
  await exec('INSERT INTO tasas (id, fecha, valor, fuente) VALUES (?, ?, ?, ?)', [uid(), f, valor, fuente]);
  app.tasa = valor; app.tasaFecha = f; refrescar();
}
export async function cambiarTema() {
  app.tema = app.tema === 'noche' ? 'papel' : 'noche';
  document.documentElement.dataset.theme = app.tema;
  await ajuste('tema', app.tema);
}
export const refrescar = () => { app.version++; };

/* ---------- sesión ---------- */
export const sesion = $state({ conClave: false, salir: null as null | (() => void) });

/* ---------- avisos (toasts) ---------- */
export interface Aviso { id: number; tipo: 'ok' | 'error' | 'info'; texto: string }
export const avisos = $state<Aviso[]>([]);
let n = 0;
export function avisar(texto: string, tipo: Aviso['tipo'] = 'ok') {
  const id = ++n; avisos.push({ id, tipo, texto });
  setTimeout(() => { const i = avisos.findIndex((a) => a.id === id); if (i >= 0) avisos.splice(i, 1); }, tipo === 'error' ? 6000 : 3200);
}
export function fallo(e: unknown) {
  const m = e instanceof Error ? e.message : String(e);
  console.error(e);
  avisar(m.includes('licencia') ? m : 'No se pudo guardar: ' + m, 'error');
}

/* ---------- confirmaciones ---------- */
export const dialogo = $state({ abierto: false, titulo: '', texto: '', accion: 'Confirmar', peligro: false, resolver: null as null | ((v: boolean) => void) });
export function confirmar(titulo: string, texto = '', accion = 'Confirmar', peligro = false): Promise<boolean> {
  return new Promise((res) => Object.assign(dialogo, { abierto: true, titulo, texto, accion, peligro, resolver: res }));
}
