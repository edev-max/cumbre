import type { Driver, Fila, Sentencia, Valor } from './tipos';
import { MIGRACIONES } from './esquema';

export type { Fila, Sentencia, Valor };
let driver: Driver;

export const enEscritorio = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function abrir(): Promise<Driver> {
  if (enEscritorio()) driver = (await import('./escritorio')).crearDriverEscritorio();
  else driver = await (await import('./navegador')).crearDriverNavegador();
  await migrar();
  return driver;
}
async function migrar() {
  await driver.script('CREATE TABLE IF NOT EXISTS _version (n INTEGER NOT NULL)');
  const v = (await driver.select('SELECT n FROM _version'))[0]?.n ?? 0;
  if (!(await driver.select('SELECT 1 FROM _version')).length) await driver.execute('INSERT INTO _version (n) VALUES (0)');
  for (let i = v; i < MIGRACIONES.length; i++) {
    await driver.script('BEGIN;\n' + MIGRACIONES[i] + `\nUPDATE _version SET n = ${i + 1};\nCOMMIT;`);
  }
}

export const tipoDriver = () => driver.tipo;
export const q = (sql: string, params?: Valor[]) => driver.select(sql, params);
export async function uno<T = Fila>(sql: string, params?: Valor[]): Promise<T | undefined> {
  return (await driver.select(sql, params))[0] as T | undefined;
}
export async function valor<T = any>(sql: string, params?: Valor[]): Promise<T | undefined> {
  const f = (await driver.select(sql, params))[0];
  return f ? (Object.values(f)[0] as T) : undefined;
}
export const exec = (sql: string, params?: Valor[]) => driver.execute(sql, params);
export const lote = (s: Sentencia[]) => driver.batch(s);
export const exportarDb = () => driver.exportar();
export const importarDb = (d: Uint8Array) => driver.importar(d);

export const uid = () => crypto.randomUUID();

/** próximo número de un tipo de documento: V-000123. Devuelve el número y
 *  la sentencia que lo consume (va dentro del mismo lote que el documento). */
export async function numerar(clave: string): Promise<{ numero: string; sentencia: Sentencia }> {
  const s = await uno<{ prefijo: string; siguiente: number; digitos: number }>('SELECT prefijo, siguiente, digitos FROM secuencias WHERE clave = ?', [clave]);
  const pref = s?.prefijo ?? clave.toUpperCase().slice(0, 3) + '-', n = s?.siguiente ?? 1, dig = s?.digitos ?? 6;
  return {
    numero: pref + String(n).padStart(dig, '0'),
    sentencia: s
      ? { sql: 'UPDATE secuencias SET siguiente = siguiente + 1 WHERE clave = ? AND siguiente = ?', params: [clave, n] }
      : { sql: 'INSERT INTO secuencias (clave, prefijo, siguiente) VALUES (?, ?, 2)', params: [clave, pref] }
  };
}
