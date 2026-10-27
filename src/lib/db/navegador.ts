import initSqlJs, { type Database } from 'sql.js';
import type { Driver, Fila, Sentencia, Valor } from './tipos';

/* SQLite en el navegador (modo demostración y desarrollo).
   Cada escritura se guarda en IndexedDB, con un pequeño retraso. */
const IDB = 'cumbre', STORE = 'db', KEY = 'principal';

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function leer(): Promise<Uint8Array | null> {
  try {
    const d = await idb();
    return await new Promise((res) => {
      const q = d.transaction(STORE).objectStore(STORE).get(KEY);
      q.onsuccess = () => res(q.result ? new Uint8Array(q.result) : null);
      q.onerror = () => res(null);
    });
  } catch { return null; }
}
async function escribir(datos: Uint8Array) {
  try {
    const d = await idb();
    await new Promise<void>((res) => {
      const t = d.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(datos, KEY);
      t.oncomplete = () => res(); t.onerror = () => res();
    });
  } catch { /* sin almacenamiento: sigue en memoria */ }
}

export async function crearDriverNavegador(): Promise<Driver> {
  const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });
  const previo = await leer();
  let db: Database = previo ? new SQL.Database(previo) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  let t: ReturnType<typeof setTimeout> | undefined;
  const guardar = () => { clearTimeout(t); t = setTimeout(() => escribir(db.export()), 250); };
  addEventListener('beforeunload', () => { if (t) { clearTimeout(t); escribir(db.export()); } });

  function filas(sql: string, params: Valor[] = []): Fila[] {
    const st = db.prepare(sql);
    try {
      st.bind(params as any);
      const out: Fila[] = [];
      while (st.step()) out.push(st.getAsObject());
      return out;
    } finally { st.free(); }
  }
  return {
    tipo: 'navegador',
    async select(sql, params) { return filas(sql, params); },
    async execute(sql, params = []) {
      db.run(sql, params as any);
      const n = db.getRowsModified();
      guardar();
      return n;
    },
    async script(sql) { db.exec(sql); guardar(); },
    async batch(sentencias: Sentencia[]) {
      db.run('BEGIN');
      try {
        for (const s of sentencias) db.run(s.sql, (s.params || []) as any);
        db.run('COMMIT');
      } catch (e) { db.run('ROLLBACK'); throw e; }
      guardar();
    },
    async exportar() { return db.export(); },
    async importar(datos) {
      db.close(); db = new SQL.Database(datos); db.run('PRAGMA foreign_keys = ON');
      await escribir(db.export());
    }
  };
}
