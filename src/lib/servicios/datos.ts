import { lote, uid, type Sentencia } from '../db';
import { ahora } from '../formato';
import { CONTADO } from './ventas';
import { cargarAjustes } from '../estado.svelte';

/* ---------- lo mínimo para arrancar ---------- */
export async function sembrarBase(e: { nombre: string; rif: string; telefono?: string; direccion?: string; tasa: number }) {
  const S: Sentencia[] = [];
  const aj: Record<string, string> = {
    empresa_nombre: e.nombre, empresa_rif: e.rif, empresa_telefono: e.telefono || '', empresa_direccion: e.direccion || '',
    empresa_email: '', pie_documentos: 'Gracias por tu compra.', tema: 'noche', almacen_principal: 'principal',
    impuesto_defecto: 'iva16', permitir_negativo: '0', iniciado: ahora()
  };
  for (const [k, v] of Object.entries(aj)) S.push({ sql: 'INSERT OR REPLACE INTO ajustes (clave, valor) VALUES (?, ?)', params: [k, v] });
  S.push(
    { sql: `INSERT INTO impuestos (id, nombre, tasa) VALUES ('iva16', 'IVA general', 16), ('iva8', 'IVA reducido', 8), ('exento', 'Exento', 0)` },
    { sql: `INSERT INTO metodos_pago (id, nombre, moneda, pide_referencia, orden) VALUES
      ('efectivo_usd', 'Efectivo en dólares', 'USD', 0, 1), ('efectivo_bs', 'Efectivo en bolívares', 'VES', 0, 2),
      ('pago_movil', 'Pago móvil', 'VES', 1, 3), ('punto', 'Punto de venta', 'VES', 1, 4),
      ('transferencia', 'Transferencia', 'VES', 1, 5), ('zelle', 'Zelle', 'USD', 1, 6)` },
    { sql: `INSERT INTO almacenes (id, nombre, principal) VALUES ('principal', 'Tienda', 1)` },
    { sql: `INSERT INTO categorias (id, nombre) VALUES ('general', 'General')` },
    { sql: `INSERT INTO clientes (id, codigo, nombre, rif) VALUES (?, 'C-0000', 'Cliente de contado', '')`, params: [CONTADO] },
    { sql: `INSERT INTO usuarios (id, nombre, usuario, rol) VALUES ('admin', 'Administrador', 'admin', 'admin')` },
    { sql: `INSERT INTO secuencias (clave, prefijo, siguiente, digitos) VALUES
      ('pos', 'T-', 1, 6), ('venta', 'NV-', 1, 6), ('compra', 'OC-', 1, 6), ('recepcion', 'RC-', 1, 6),
      ('despacho', 'DS-', 1, 6), ('ajuste', 'AJ-', 1, 6), ('traslado', 'TR-', 1, 6)` }
  );
  if (e.tasa > 0) S.push({ sql: 'INSERT INTO tasas (id, fecha, valor, fuente) VALUES (?, ?, ?, ?)', params: [uid(), ahora(), e.tasa, 'manual'] });
  await lote(S);
  await cargarAjustes();
}

/** vacía los movimientos y deja la configuración: para empezar en limpio */
export async function borrarDatos(conCatalogos: boolean) {
  const S: Sentencia[] = ['recepcion_lineas', 'recepciones', 'pagos', 'compra_lineas', 'compras', 'despachos', 'cobros', 'venta_lineas', 'ventas', 'movimientos', 'stock', 'auditoria']
    .map((t) => ({ sql: `DELETE FROM ${t}` }));
  if (conCatalogos) {
    S.push({ sql: 'DELETE FROM productos' }, { sql: `DELETE FROM categorias WHERE id != 'general'` }, { sql: `DELETE FROM clientes WHERE id != '${CONTADO}'` },
      { sql: 'DELETE FROM proveedores' }, { sql: 'DELETE FROM transportistas' }, { sql: 'DELETE FROM rutas' }, { sql: `DELETE FROM almacenes WHERE id != 'principal'` });
  }
  S.push({ sql: 'UPDATE secuencias SET siguiente = 1' }, { sql: `DELETE FROM ajustes WHERE clave = 'datos_ejemplo'` });
  await lote(S);
}
