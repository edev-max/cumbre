import { lote, uid, q, type Sentencia } from '../db';
import { ahora } from '../formato';
import { crearVenta, registrarCobro, CONTADO } from './ventas';
import { guardarOrden, recibir, registrarPago } from './compras';
import { app, cargarAjustes } from '../estado.svelte';

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

/* ---------- un negocio de ejemplo para conocer Cumbre ---------- */
const CATS = [['viveres', 'Víveres'], ['bebidas', 'Bebidas'], ['limpieza', 'Limpieza'], ['personal', 'Cuidado personal'], ['charcuteria', 'Charcutería']];
// [código, nombre, categoría, unidad, costo $, precio $, impuesto, stock inicial, mínimo]
const PRODUCTOS: [string, string, string, string, number, number, string, number, number][] = [
  ['7590001', 'Harina de maíz precocida 1 kg', 'viveres', 'und', 0.95, 1.25, 'exento', 120, 30],
  ['7590002', 'Arroz blanco 1 kg', 'viveres', 'und', 1.05, 1.4, 'exento', 90, 24],
  ['7590003', 'Pasta larga 1 kg', 'viveres', 'und', 1.2, 1.6, 'exento', 70, 20],
  ['7590004', 'Azúcar refinada 1 kg', 'viveres', 'und', 1.1, 1.45, 'exento', 60, 20],
  ['7590005', 'Aceite vegetal 1 L', 'viveres', 'und', 2.6, 3.4, 'iva16', 48, 12],
  ['7590006', 'Café molido 250 g', 'viveres', 'und', 2.4, 3.2, 'iva16', 40, 10],
  ['7590007', 'Leche en polvo 400 g', 'viveres', 'und', 4.2, 5.5, 'exento', 30, 8],
  ['7590008', 'Caraotas negras 500 g', 'viveres', 'und', 1.15, 1.55, 'exento', 50, 12],
  ['7590009', 'Atún en lata 140 g', 'viveres', 'und', 1.35, 1.85, 'iva16', 64, 16],
  ['7590010', 'Sardinas en lata 170 g', 'viveres', 'und', 0.85, 1.2, 'iva16', 72, 16],
  ['7590011', 'Mayonesa 445 g', 'viveres', 'und', 2.3, 3.1, 'iva16', 6, 8],
  ['7590012', 'Salsa de tomate 397 g', 'viveres', 'und', 1.5, 2.05, 'iva16', 24, 8],
  ['7590013', 'Huevos (cartón de 30)', 'viveres', 'und', 4.5, 5.8, 'exento', 18, 6],
  ['7590014', 'Refresco de cola 2 L', 'bebidas', 'und', 1.4, 2.0, 'iva16', 60, 18],
  ['7590015', 'Agua mineral 1,5 L', 'bebidas', 'und', 0.55, 0.85, 'iva16', 80, 24],
  ['7590016', 'Jugo pasteurizado 1 L', 'bebidas', 'und', 1.3, 1.8, 'iva16', 4, 10],
  ['7590017', 'Detergente en polvo 1 kg', 'limpieza', 'und', 2.8, 3.7, 'iva16', 30, 8],
  ['7590018', 'Jabón de panela', 'limpieza', 'und', 0.6, 0.9, 'iva16', 55, 12],
  ['7590019', 'Cloro 1 L', 'limpieza', 'und', 0.9, 1.3, 'iva16', 40, 10],
  ['7590020', 'Papel higiénico (4 rollos)', 'personal', 'und', 2.1, 2.9, 'iva16', 36, 10],
  ['7590021', 'Crema dental 100 ml', 'personal', 'und', 1.6, 2.2, 'iva16', 28, 8],
  ['7590022', 'Champú 400 ml', 'personal', 'und', 3.1, 4.2, 'iva16', 16, 6],
  ['7590023', 'Queso blanco duro', 'charcuteria', 'kg', 4.8, 6.5, 'exento', 22.5, 5],
  ['7590024', 'Jamón de pierna', 'charcuteria', 'kg', 6.2, 8.4, 'iva16', 14.2, 4]
];
const CLIENTES = [
  ['Abasto Los Próceres', 'J-00000001-0', '0412-0000001', 'Av. principal de Los Próceres', 'Centro', 50000, 15],
  ['Panadería La Espiga', 'J-00000002-0', '0414-0000002', 'Calle 3, Los Chaguaramos', 'Este', 30000, 7],
  ['María Rodríguez', 'V-00000003', '0424-0000003', 'Res. El Parque, torre B', 'Centro', 0, 0],
  ['Comedor Escolar El Samán', 'G-00000004-0', '0416-0000004', 'Sector El Samán', 'Oeste', 80000, 30]
];
const PROVEEDORES = [
  ['Distribuidora Andina', 'J-10000001-0', 'Luis Pérez', '0212-0000010', 15],
  ['Alimentos del Centro', 'J-10000002-0', 'Ana Gómez', '0241-0000020', 7],
  ['Químicos y Limpieza Oriente', 'J-10000003-0', 'José Marcano', '0281-0000030', 0]
];

export async function sembrarEjemplo() {
  const S: Sentencia[] = [];
  S.push({ sql: `UPDATE ajustes SET valor = ? WHERE clave = 'empresa_nombre'`, params: ['Distribuidora La Cumbre, C.A.'] });
  S.push({ sql: `UPDATE ajustes SET valor = ? WHERE clave = 'empresa_rif'`, params: ['J-00000000-0'] });
  S.push({ sql: `INSERT OR REPLACE INTO ajustes (clave, valor) VALUES ('datos_ejemplo', '1')` });
  S.push({ sql: `INSERT INTO almacenes (id, nombre, direccion) VALUES ('deposito', 'Depósito', 'Galpón trasero')` });
  for (const [id, n] of CATS) S.push({ sql: 'INSERT INTO categorias (id, nombre) VALUES (?, ?)', params: [id, n] });
  const pid: Record<string, string> = {};
  for (const [cod, nom, cat, und, costo, precio, imp, ini, min] of PRODUCTOS) {
    const id = uid(); pid[cod] = id;
    S.push({
      sql: `INSERT INTO productos (id, codigo, barra, nombre, categoria_id, unidad, costo_c, precio_c, impuesto_id, stock_min) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [id, 'P-' + cod.slice(-3), cod, nom, cat, und, Math.round(costo * 100), Math.round(precio * 100), imp, min]
    });
    S.push({ sql: 'INSERT INTO stock (producto_id, almacen_id, cantidad) VALUES (?, ?, ?)', params: [id, 'principal', ini] });
    S.push({ sql: `INSERT INTO movimientos (id, fecha, tipo, producto_id, almacen_id, cantidad, costo_c, nota, usuario) VALUES (?, ?, 'inicial', ?, 'principal', ?, ?, 'Inventario inicial', 'Administrador')`, params: [uid(), ahora(-15), id, ini, Math.round(costo * 100)] });
  }
  // presentaciones: cómo llega del proveedor y, a veces, cómo se vende al mayor
  const PRES: [string, string, number, number, number][] = [ // [código, nombre, trae, compra, venta]
    ['7590001', 'Bulto x 20', 20, 1, 1], ['7590002', 'Bulto x 24', 24, 1, 0], ['7590003', 'Bulto x 12', 12, 1, 0],
    ['7590005', 'Caja x 12', 12, 1, 0], ['7590014', 'Caja x 6', 6, 1, 1], ['7590015', 'Paca x 6', 6, 1, 1],
    ['7590009', 'Caja x 48', 48, 1, 0], ['7590023', 'Pieza de 4 kg', 4, 1, 0]
  ];
  for (const [cod, nom, f, c, v] of PRES) S.push({ sql: 'INSERT INTO presentaciones (id, producto_id, nombre, factor, compra, venta) VALUES (?, ?, ?, ?, ?, ?)', params: [uid(), pid[cod], nom, f, c, v] });
  const cid: string[] = [];
  CLIENTES.forEach(([n, rif, tel, dir, zona, lim, dias], i) => {
    const id = uid(); cid.push(id);
    S.push({ sql: 'INSERT INTO clientes (id, codigo, nombre, rif, telefono, direccion, zona, limite_credito_c, dias_credito) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', params: [id, 'C-' + String(i + 1).padStart(4, '0'), n, rif, tel, dir, zona, lim, dias] });
  });
  const prv: string[] = [];
  for (const [n, rif, contacto, tel, dias] of PROVEEDORES) {
    const id = uid(); prv.push(id as string);
    S.push({ sql: 'INSERT INTO proveedores (id, nombre, rif, contacto, telefono, dias_credito) VALUES (?, ?, ?, ?, ?, ?)', params: [id, n, rif, contacto, tel, dias] });
  }
  const ruta1 = uid(), ruta2 = uid(), tr = uid();
  S.push({ sql: 'INSERT INTO rutas (id, nombre, zona, dias) VALUES (?, ?, ?, ?), (?, ?, ?, ?)', params: [ruta1, 'Ruta Centro', 'Centro', 'Lun, Mié, Vie', ruta2, 'Ruta Este', 'Este', 'Mar, Jue'] });
  S.push({ sql: 'INSERT INTO transportistas (id, nombre, cedula, telefono, vehiculo, placa) VALUES (?, ?, ?, ?, ?, ?)', params: [tr, 'Carlos Méndez', 'V-00000005', '0412-0000005', 'Camioneta de carga', 'AB000CD'] });
  await lote(S);
  await cargarAjustes();

  // historia de dos semanas, hecha con las mismas operaciones que usa el sistema
  const tasa = app.tasa || 1;
  const P = await q('SELECT p.id, p.nombre, p.precio_c, p.costo_c, i.tasa AS iva FROM productos p LEFT JOIN impuestos i ON i.id = p.impuesto_id');
  let semilla = 7;
  const r = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  const metodos = ['efectivo_usd', 'pago_movil', 'punto', 'efectivo_bs', 'zelle'];
  for (let dia = 14; dia >= 0; dia--) {
    const n = 2 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      const lineas = Array.from({ length: 1 + Math.floor(r() * 4) }, () => {
        const p = P[Math.floor(r() * P.length)];
        return { producto_id: p.id, descripcion: p.nombre, cantidad: 1 + Math.floor(r() * 3), precio_c: p.precio_c, impuesto_tasa: p.iva || 0 };
      });
      const tot = lineas.reduce((a, l) => a + Math.round(l.cantidad * l.precio_c * (1 + l.impuesto_tasa / 100)), 0);
      const m = metodos[Math.floor(r() * metodos.length)], ves = m === 'pago_movil' || m === 'punto' || m === 'efectivo_bs';
      const monto = ves ? Math.round((tot / 100) * tasa * 100) / 100 : tot / 100;
      const hora = ahora(-dia).slice(0, 11) + String(8 + Math.floor(r() * 10)).padStart(2, '0') + ':' + String(Math.floor(r() * 60)).padStart(2, '0') + ':00';
      try { await crearVenta({ cliente_id: CONTADO, almacen_id: 'principal', origen: 'pos', lineas, pagos: [{ metodo_id: m, moneda: ves ? 'VES' : 'USD', monto }], fecha: hora, tasa }); } catch { /* sin existencia: se salta */ }
    }
  }
  // ventas a crédito, una con despacho
  const credito = async (cli: number, items: number[], dias: number, despacho = false) => {
    const lineas = items.map((ix) => { const p = P[ix]; return { producto_id: p.id, descripcion: p.nombre, cantidad: 6, precio_c: p.precio_c, impuesto_tasa: p.iva || 0 }; });
    return crearVenta({ cliente_id: cid[cli], almacen_id: 'principal', origen: 'nota', lineas, vence: ahora(dias).slice(0, 10), fecha: ahora(-Math.max(1, 20 - dias)), tasa, entrega: despacho ? 'despacho' : 'retira', despacho: despacho ? { ruta_id: ruta1, transportista_id: tr } : undefined });
  };
  const v1 = await credito(0, [0, 1, 4, 13], 10, true);
  await credito(1, [2, 3, 5], -3);
  await credito(3, [0, 1, 2, 7, 8], 20, true);
  await registrarCobro({ cliente_id: cid[0], venta_id: v1.id, metodo_id: 'transferencia', moneda: 'USD', monto: 10, referencia: '000123' });
  // una orden recibida (con deuda) y una pendiente
  const o1 = await guardarOrden({ proveedor_id: prv[1], almacen_id: 'principal', estado: 'ordenada', lineas: [0, 1, 2].map((ix) => ({ producto_id: P[ix].id, descripcion: P[ix].nombre, cantidad: 24, costo_c: P[ix].costo_c, impuesto_tasa: P[ix].iva || 0 })), fecha: ahora(-6), vence: ahora(9).slice(0, 10) });
  const lin = await q('SELECT id, cantidad, costo_c FROM compra_lineas WHERE compra_id = ?', [o1.id]);
  await recibir(o1.id, lin.map((l) => ({ compra_linea_id: l.id, cantidad: l.cantidad, costo_c: l.costo_c })), undefined, '', ahora(-5));
  await registrarPago({ proveedor_id: prv[1], compra_id: o1.id, metodo_id: 'zelle', moneda: 'USD', monto: 20, referencia: 'Z-5521' });
  await guardarOrden({ proveedor_id: prv[2], almacen_id: 'principal', estado: 'ordenada', lineas: [16, 17, 18].map((ix) => ({ producto_id: P[ix].id, descripcion: P[ix].nombre, cantidad: 12, costo_c: P[ix].costo_c, impuesto_tasa: P[ix].iva || 0 })), fecha: ahora(-1) });
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
