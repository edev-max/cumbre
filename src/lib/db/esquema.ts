/* Cumbre · esquema de la base de datos
   Montos en centavos de dólar (columnas *_c, enteros): la moneda base es USD
   y los bolívares salen de la tasa BCV guardada en cada documento.
   Cantidades con decimales (se vende por kilo). IDs de texto (UUID) para
   poder armar un documento completo en una sola transacción. */

export const MIGRACIONES: string[] = [
  /* ---------- 1 · base ---------- */
  `
  CREATE TABLE ajustes (clave TEXT PRIMARY KEY, valor TEXT);

  CREATE TABLE tasas (
    id TEXT PRIMARY KEY, fecha TEXT NOT NULL, valor REAL NOT NULL, fuente TEXT DEFAULT 'manual'
  );
  CREATE INDEX tasas_fecha ON tasas(fecha);

  CREATE TABLE secuencias (clave TEXT PRIMARY KEY, prefijo TEXT NOT NULL, siguiente INTEGER NOT NULL DEFAULT 1, digitos INTEGER NOT NULL DEFAULT 6);

  CREATE TABLE usuarios (
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL, usuario TEXT NOT NULL UNIQUE,
    rol TEXT NOT NULL DEFAULT 'cajero', clave TEXT, activo INTEGER NOT NULL DEFAULT 1,
    creado TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE impuestos (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, tasa REAL NOT NULL, activo INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE metodos_pago (
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL, moneda TEXT NOT NULL DEFAULT 'USD',
    pide_referencia INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1, orden INTEGER DEFAULT 0
  );

  /* ---------- inventario ---------- */
  CREATE TABLE almacenes (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, direccion TEXT, principal INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE categorias (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE productos (
    id TEXT PRIMARY KEY, codigo TEXT UNIQUE, barra TEXT, nombre TEXT NOT NULL,
    categoria_id TEXT REFERENCES categorias(id), unidad TEXT NOT NULL DEFAULT 'und',
    costo_c INTEGER NOT NULL DEFAULT 0, precio_c INTEGER NOT NULL DEFAULT 0,
    impuesto_id TEXT REFERENCES impuestos(id), stock_min REAL NOT NULL DEFAULT 0,
    se_vende INTEGER NOT NULL DEFAULT 1, se_compra INTEGER NOT NULL DEFAULT 1,
    activo INTEGER NOT NULL DEFAULT 1, creado TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX productos_barra ON productos(barra);
  CREATE TABLE stock (
    producto_id TEXT NOT NULL REFERENCES productos(id), almacen_id TEXT NOT NULL REFERENCES almacenes(id),
    cantidad REAL NOT NULL DEFAULT 0, PRIMARY KEY (producto_id, almacen_id)
  );
  CREATE TABLE movimientos (
    id TEXT PRIMARY KEY, fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    tipo TEXT NOT NULL,            -- inicial, venta, compra, ajuste, transferencia, devolucion, anulacion
    producto_id TEXT NOT NULL REFERENCES productos(id), almacen_id TEXT NOT NULL REFERENCES almacenes(id),
    cantidad REAL NOT NULL,        -- con signo: entra (+) o sale (-)
    costo_c INTEGER NOT NULL DEFAULT 0,
    ref_tipo TEXT, ref_id TEXT, ref_numero TEXT, nota TEXT, usuario TEXT
  );
  CREATE INDEX movimientos_producto ON movimientos(producto_id, fecha);
  CREATE INDEX movimientos_ref ON movimientos(ref_tipo, ref_id);

  /* ---------- ventas ---------- */
  CREATE TABLE clientes (
    id TEXT PRIMARY KEY, codigo TEXT, nombre TEXT NOT NULL, rif TEXT, telefono TEXT, email TEXT,
    direccion TEXT, zona TEXT, limite_credito_c INTEGER NOT NULL DEFAULT 0, dias_credito INTEGER NOT NULL DEFAULT 0,
    notas TEXT, activo INTEGER NOT NULL DEFAULT 1, creado TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE ventas (
    id TEXT PRIMARY KEY, numero TEXT NOT NULL, fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    cliente_id TEXT REFERENCES clientes(id), almacen_id TEXT REFERENCES almacenes(id),
    origen TEXT NOT NULL DEFAULT 'nota',       -- pos, nota
    estado TEXT NOT NULL DEFAULT 'confirmada',  -- borrador, confirmada, anulada
    entrega TEXT NOT NULL DEFAULT 'retira',     -- retira, despacho
    subtotal_c INTEGER NOT NULL DEFAULT 0, descuento_c INTEGER NOT NULL DEFAULT 0,
    impuesto_c INTEGER NOT NULL DEFAULT 0, total_c INTEGER NOT NULL DEFAULT 0, pagado_c INTEGER NOT NULL DEFAULT 0,
    tasa REAL NOT NULL DEFAULT 0, vence TEXT, notas TEXT, usuario TEXT
  );
  CREATE INDEX ventas_fecha ON ventas(fecha);
  CREATE INDEX ventas_cliente ON ventas(cliente_id);
  CREATE TABLE venta_lineas (
    id TEXT PRIMARY KEY, venta_id TEXT NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id TEXT REFERENCES productos(id), descripcion TEXT NOT NULL,
    cantidad REAL NOT NULL, precio_c INTEGER NOT NULL, descuento REAL NOT NULL DEFAULT 0,
    impuesto_tasa REAL NOT NULL DEFAULT 0, costo_c INTEGER NOT NULL DEFAULT 0, total_c INTEGER NOT NULL
  );
  CREATE INDEX venta_lineas_venta ON venta_lineas(venta_id);
  CREATE TABLE cobros (
    id TEXT PRIMARY KEY, fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    cliente_id TEXT REFERENCES clientes(id), venta_id TEXT REFERENCES ventas(id),
    metodo_id TEXT REFERENCES metodos_pago(id), moneda TEXT NOT NULL DEFAULT 'USD',
    monto REAL NOT NULL, tasa REAL NOT NULL DEFAULT 0, monto_c INTEGER NOT NULL,
    referencia TEXT, notas TEXT, usuario TEXT, anulado INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX cobros_venta ON cobros(venta_id);

  /* ---------- compras ---------- */
  CREATE TABLE proveedores (
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL, rif TEXT, contacto TEXT, telefono TEXT, email TEXT,
    direccion TEXT, dias_credito INTEGER NOT NULL DEFAULT 0, notas TEXT, activo INTEGER NOT NULL DEFAULT 1,
    creado TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE TABLE compras (
    id TEXT PRIMARY KEY, numero TEXT NOT NULL, fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    proveedor_id TEXT REFERENCES proveedores(id), almacen_id TEXT REFERENCES almacenes(id),
    factura_proveedor TEXT,
    estado TEXT NOT NULL DEFAULT 'borrador',    -- borrador, ordenada, parcial, recibida, anulada
    subtotal_c INTEGER NOT NULL DEFAULT 0, impuesto_c INTEGER NOT NULL DEFAULT 0,
    total_c INTEGER NOT NULL DEFAULT 0, pagado_c INTEGER NOT NULL DEFAULT 0,
    tasa REAL NOT NULL DEFAULT 0, vence TEXT, notas TEXT, usuario TEXT
  );
  CREATE TABLE compra_lineas (
    id TEXT PRIMARY KEY, compra_id TEXT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    producto_id TEXT REFERENCES productos(id), descripcion TEXT NOT NULL,
    cantidad REAL NOT NULL, recibido REAL NOT NULL DEFAULT 0, costo_c INTEGER NOT NULL,
    impuesto_tasa REAL NOT NULL DEFAULT 0, total_c INTEGER NOT NULL
  );
  CREATE INDEX compra_lineas_compra ON compra_lineas(compra_id);
  CREATE TABLE recepciones (
    id TEXT PRIMARY KEY, numero TEXT NOT NULL, compra_id TEXT REFERENCES compras(id),
    fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')), almacen_id TEXT REFERENCES almacenes(id),
    notas TEXT, usuario TEXT
  );
  CREATE TABLE recepcion_lineas (
    id TEXT PRIMARY KEY, recepcion_id TEXT NOT NULL REFERENCES recepciones(id) ON DELETE CASCADE,
    compra_linea_id TEXT REFERENCES compra_lineas(id), producto_id TEXT REFERENCES productos(id),
    cantidad REAL NOT NULL, costo_c INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE pagos (
    id TEXT PRIMARY KEY, fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    proveedor_id TEXT REFERENCES proveedores(id), compra_id TEXT REFERENCES compras(id),
    metodo_id TEXT REFERENCES metodos_pago(id), moneda TEXT NOT NULL DEFAULT 'USD',
    monto REAL NOT NULL, tasa REAL NOT NULL DEFAULT 0, monto_c INTEGER NOT NULL,
    referencia TEXT, notas TEXT, usuario TEXT, anulado INTEGER NOT NULL DEFAULT 0
  );

  /* ---------- logística ---------- */
  CREATE TABLE transportistas (
    id TEXT PRIMARY KEY, nombre TEXT NOT NULL, cedula TEXT, telefono TEXT,
    vehiculo TEXT, placa TEXT, activo INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE rutas (id TEXT PRIMARY KEY, nombre TEXT NOT NULL, zona TEXT, dias TEXT, notas TEXT, activo INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE despachos (
    id TEXT PRIMARY KEY, numero TEXT NOT NULL, fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    venta_id TEXT REFERENCES ventas(id), cliente_id TEXT REFERENCES clientes(id),
    ruta_id TEXT REFERENCES rutas(id), transportista_id TEXT REFERENCES transportistas(id),
    direccion TEXT, programado TEXT,
    estado TEXT NOT NULL DEFAULT 'pendiente',   -- pendiente, en_ruta, entregado, devuelto
    entregado_en TEXT, recibe TEXT, notas TEXT
  );
  CREATE INDEX despachos_estado ON despachos(estado);

  CREATE TABLE auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    usuario TEXT, accion TEXT NOT NULL, detalle TEXT
  );
  `,

  /* ---------- 2 · presentaciones e imágenes ----------
     El producto se lleva en su unidad base (la de venta: und, kg…).
     Una presentación dice cuántas unidades base trae (Caja x 24 = 24 und)
     y si se usa para comprar, para vender o para ambas. */
  `
  CREATE TABLE presentaciones (
    id TEXT PRIMARY KEY, producto_id TEXT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL, factor REAL NOT NULL, barra TEXT,
    compra INTEGER NOT NULL DEFAULT 1, venta INTEGER NOT NULL DEFAULT 0,
    costo_c INTEGER NOT NULL DEFAULT 0, precio_c INTEGER NOT NULL DEFAULT 0, activo INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX presentaciones_producto ON presentaciones(producto_id);
  CREATE INDEX presentaciones_barra ON presentaciones(barra);
  CREATE TABLE producto_imagenes (
    producto_id TEXT PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
    imagen TEXT NOT NULL, actualizado TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  ALTER TABLE compra_lineas ADD COLUMN presentacion_id TEXT;
  ALTER TABLE compra_lineas ADD COLUMN presentacion TEXT;
  ALTER TABLE compra_lineas ADD COLUMN factor REAL NOT NULL DEFAULT 1;
  ALTER TABLE venta_lineas ADD COLUMN presentacion_id TEXT;
  ALTER TABLE venta_lineas ADD COLUMN presentacion TEXT;
  ALTER TABLE venta_lineas ADD COLUMN factor REAL NOT NULL DEFAULT 1;
  `
];
