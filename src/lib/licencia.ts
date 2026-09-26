import { app } from './estado.svelte';
import { enEscritorio } from './db';

/* Estado de la licencia. En el escritorio lo decide Rust (src-tauri/src/licencia.rs);
   en el navegador Cumbre corre siempre en modo demostración. */
export interface InfoLicencia { estado: 'activa' | 'demo' | 'vencida' | 'invalida'; cliente: string; rif?: string; plan?: string; vence: string; equipo: string; dias_gracia?: number }

export async function iniciarLicencia(): Promise<InfoLicencia> {
  let info: InfoLicencia = { estado: 'demo', cliente: '', vence: '', equipo: 'NAVEGADOR' };
  if (enEscritorio()) {
    const { invoke } = await import('@tauri-apps/api/core');
    info = await invoke<InfoLicencia>('licencia_estado');
  }
  app.licencia = { estado: info.estado, cliente: info.cliente, vence: info.vence };
  return info;
}
export async function activarLicencia(texto: string): Promise<InfoLicencia> {
  if (!enEscritorio()) throw new Error('La activación se hace en la aplicación de escritorio.');
  const { invoke } = await import('@tauri-apps/api/core');
  const info = await invoke<InfoLicencia>('licencia_activar', { texto: texto.trim() });
  app.licencia = { estado: info.estado, cliente: info.cliente, vence: info.vence };
  return info;
}
export async function estadoLicencia(): Promise<InfoLicencia> {
  if (!enEscritorio()) return { estado: 'demo', cliente: '', vence: '', equipo: 'Sólo en la aplicación de escritorio' };
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<InfoLicencia>('licencia_estado');
}
