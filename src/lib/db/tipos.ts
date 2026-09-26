/* Cumbre · la base de datos es SQLite en los dos mundos:
     escritorio ... archivo cumbre.db, lo maneja Rust (src-tauri/src/db.rs)
     navegador .... sql.js (SQLite en WebAssembly), guardado en IndexedDB
   El mismo SQL corre en ambos. Parámetros siempre con "?". */
export type Valor = string | number | null;
export type Fila = Record<string, any>;
export interface Sentencia { sql: string; params?: Valor[] }
export interface Driver {
  tipo: 'escritorio' | 'navegador';
  select(sql: string, params?: Valor[]): Promise<Fila[]>;
  execute(sql: string, params?: Valor[]): Promise<number>;
  /** varias sentencias SQL sin parámetros (migraciones) */
  script(sql: string): Promise<void>;
  /** varias sentencias en una sola transacción: o entran todas o ninguna */
  batch(sentencias: Sentencia[]): Promise<void>;
  exportar(): Promise<Uint8Array>;
  importar(datos: Uint8Array): Promise<void>;
}
