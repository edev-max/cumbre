import { invoke } from '@tauri-apps/api/core';
import type { Driver, Fila, Sentencia, Valor } from './tipos';

/* SQLite en el escritorio: el archivo lo abre Rust; aquí sólo se le pasan
   las sentencias. Rust decide si se puede escribir (licencia vigente). */
export function crearDriverEscritorio(): Driver {
  return {
    tipo: 'escritorio',
    select: (sql: string, params: Valor[] = []) => invoke<Fila[]>('db_select', { sql, params }),
    execute: (sql: string, params: Valor[] = []) => invoke<number>('db_execute', { sql, params }),
    script: (sql: string) => invoke<void>('db_script', { sql }),
    batch: (sentencias: Sentencia[]) => invoke<void>('db_batch', { sentencias: sentencias.map((s) => ({ sql: s.sql, params: s.params || [] })) }),
    exportar: async () => new Uint8Array(await invoke<number[]>('db_exportar')),
    importar: (datos: Uint8Array) => invoke<void>('db_importar', { datos: Array.from(datos) })
  };
}
