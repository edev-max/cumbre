import type { ConfCatalogo, Opcion } from '../lib/ui/Catalogo.svelte';
import { q } from '../lib/db';
import { usd, num, pct } from '../lib/formato';

const ops = (sql: string) => async (): Promise<Opcion[]> => (await q(sql)).map((f) => ({ v: f.v, t: f.t }));
const activo = (r: any) => (r.activo ? '' : 'mute');

export const CATALOGOS: Record<string, { titulo: string; desc: string; conf: ConfCatalogo }> = {
  clientes: {
    titulo: 'Clientes', desc: 'Datos de contacto, crédito y lo que te deben.',
    conf: {
      tabla: 'clientes', singular: 'Cliente', activos: true, orden: "CASE WHEN id = 'contado' THEN 0 ELSE 1 END, nombre",
      select: `SELECT c.*, COALESCE((SELECT SUM(total_c - pagado_c) FROM ventas v WHERE v.cliente_id = c.id AND v.estado = 'confirmada'), 0) AS deuda_c FROM clientes c`,
      buscar: ['nombre', 'rif', 'telefono', 'codigo', 'zona'],
      cols: [
        { k: 'codigo', t: 'Código', w: '90px', clase: activo }, { k: 'nombre', t: 'Nombre', clase: (r) => 'fuerte ' + activo(r) },
        { k: 'rif', t: 'RIF / cédula' }, { k: 'telefono', t: 'Teléfono' }, { k: 'zona', t: 'Zona' },
        { k: 'limite_credito_c', t: 'Límite de crédito', al: 'r', f: (r) => (r.limite_credito_c ? usd(r.limite_credito_c) : '—') },
        { k: 'deuda_c', t: 'Por cobrar', al: 'r', f: (r) => (r.deuda_c ? usd(r.deuda_c) : '—'), clase: (r) => (r.deuda_c > 0 ? 'warn fuerte' : 'mute') }
      ],
      campos: [
        { k: 'nombre', t: 'Nombre o razón social', req: true, full: true },
        { k: 'rif', t: 'RIF o cédula', ph: 'J-00000000-0' }, { k: 'codigo', t: 'Código', ph: 'C-0001' },
        { k: 'telefono', t: 'Teléfono', tipo: 'tel' }, { k: 'email', t: 'Correo', tipo: 'email' },
        { k: 'direccion', t: 'Dirección', full: true }, { k: 'zona', t: 'Zona o sector' },
        { k: 'dias_credito', t: 'Días de crédito', tipo: 'entero', def: 0 },
        { k: 'limite_credito_c', t: 'Límite de crédito ($)', tipo: 'monto', def: 0, ayuda: '0 = sin límite.' },
        { k: 'notas', t: 'Notas', tipo: 'area' }
      ]
    }
  },
  proveedores: {
    titulo: 'Proveedores', desc: 'A quién le compras y en qué condiciones.',
    conf: {
      tabla: 'proveedores', singular: 'Proveedor', activos: true, orden: 'nombre',
      select: `SELECT p.*, COALESCE((SELECT SUM(total_c - pagado_c) FROM compras c WHERE c.proveedor_id = p.id AND c.estado IN ('parcial','recibida')), 0) AS deuda_c FROM proveedores p`,
      buscar: ['nombre', 'rif', 'contacto', 'telefono'],
      cols: [
        { k: 'nombre', t: 'Proveedor', clase: (r) => 'fuerte ' + activo(r) }, { k: 'rif', t: 'RIF' }, { k: 'contacto', t: 'Contacto' },
        { k: 'telefono', t: 'Teléfono' }, { k: 'dias_credito', t: 'Crédito', al: 'r', f: (r) => (r.dias_credito ? r.dias_credito + ' días' : 'Contado') },
        { k: 'deuda_c', t: 'Le debes', al: 'r', f: (r) => (r.deuda_c ? usd(r.deuda_c) : '—'), clase: (r) => (r.deuda_c > 0 ? 'warn fuerte' : 'mute') }
      ],
      campos: [
        { k: 'nombre', t: 'Razón social', req: true, full: true }, { k: 'rif', t: 'RIF', ph: 'J-00000000-0' }, { k: 'contacto', t: 'Persona de contacto' },
        { k: 'telefono', t: 'Teléfono', tipo: 'tel' }, { k: 'email', t: 'Correo', tipo: 'email' }, { k: 'direccion', t: 'Dirección', full: true },
        { k: 'dias_credito', t: 'Días de crédito', tipo: 'entero', def: 0 }, { k: 'notas', t: 'Notas', tipo: 'area' }
      ]
    }
  },
  productos: {
    titulo: 'Productos', desc: 'Precios en dólares sin IVA; el sistema calcula el IVA y los bolívares.',
    conf: {
      tabla: 'productos', singular: 'Producto', activos: true, orden: 'nombre',
      select: `SELECT p.*, c.nombre AS categoria, i.tasa AS iva, COALESCE((SELECT SUM(cantidad) FROM stock s WHERE s.producto_id = p.id), 0) AS existencia FROM productos p
               LEFT JOIN categorias c ON c.id = p.categoria_id LEFT JOIN impuestos i ON i.id = p.impuesto_id`,
      buscar: ['nombre', 'codigo', 'barra', 'categoria'],
      cols: [
        { k: 'codigo', t: 'Código', w: '90px', clase: activo }, { k: 'nombre', t: 'Producto', clase: (r) => 'fuerte ' + activo(r) }, { k: 'categoria', t: 'Categoría' },
        { k: 'costo_c', t: 'Costo', al: 'r', f: (r) => usd(r.costo_c), clase: () => 'mute' }, { k: 'precio_c', t: 'Precio', al: 'r', f: (r) => usd(r.precio_c), clase: () => 'fuerte' },
        { k: 'margen', t: 'Margen', al: 'r', f: (r) => (r.precio_c ? pct(((r.precio_c - r.costo_c) / r.precio_c) * 100) : '—') },
        { k: 'iva', t: 'IVA', al: 'r', f: (r) => (r.iva ? pct(r.iva) : 'Exento') },
        { k: 'existencia', t: 'Existencia', al: 'r', f: (r) => num(r.existencia) + ' ' + r.unidad, clase: (r) => (r.existencia <= r.stock_min ? 'warn fuerte' : '') }
      ],
      campos: [
        { k: 'nombre', t: 'Nombre', req: true, full: true },
        { k: 'codigo', t: 'Código interno' }, { k: 'barra', t: 'Código de barras' },
        { k: 'categoria_id', t: 'Categoría', tipo: 'select', op: ops(`SELECT id AS v, nombre AS t FROM categorias WHERE activo = 1 ORDER BY nombre`), def: 'general' },
        { k: 'unidad', t: 'Unidad', tipo: 'select', op: [{ v: 'und', t: 'Unidad' }, { v: 'kg', t: 'Kilo' }, { v: 'lt', t: 'Litro' }, { v: 'caja', t: 'Caja' }, { v: 'bulto', t: 'Bulto' }, { v: 'paq', t: 'Paquete' }], def: 'und' },
        { k: 'costo_c', t: 'Costo ($)', tipo: 'monto', def: 0, ayuda: 'Se actualiza solo con cada compra (promedio).' },
        { k: 'precio_c', t: 'Precio de venta ($, sin IVA)', tipo: 'monto', def: 0, req: true },
        { k: 'impuesto_id', t: 'Impuesto', tipo: 'select', op: ops(`SELECT id AS v, nombre || ' (' || tasa || ' %)' AS t FROM impuestos WHERE activo = 1 ORDER BY tasa DESC`), def: 'iva16' },
        { k: 'stock_min', t: 'Existencia mínima', tipo: 'numero', def: 0, ayuda: 'Te avisamos cuando baje de aquí.' },
        { k: 'se_vende', t: 'Se vende', tipo: 'check', def: true }, { k: 'se_compra', t: 'Se compra', tipo: 'check', def: true }
      ],
      validar: async (d, id) => {
        if (d.codigo && (await q(`SELECT 1 FROM productos WHERE codigo = ? AND id != COALESCE(?, '')`, [d.codigo, id ?? null])).length) return 'Ese código ya lo tiene otro producto.';
      }
    }
  },
  categorias: {
    titulo: 'Categorías', desc: 'Agrupa tus productos para buscarlos y reportarlos mejor.',
    conf: {
      tabla: 'categorias', singular: 'Categoría', activos: true, orden: 'nombre',
      select: 'SELECT c.*, (SELECT COUNT(*) FROM productos p WHERE p.categoria_id = c.id AND p.activo = 1) AS n FROM categorias c', buscar: ['nombre'],
      cols: [{ k: 'nombre', t: 'Categoría', clase: (r) => 'fuerte ' + activo(r) }, { k: 'n', t: 'Productos', al: 'r' }],
      campos: [{ k: 'nombre', t: 'Nombre', req: true, full: true }]
    }
  },
  almacenes: {
    titulo: 'Almacenes', desc: 'Tiendas y depósitos donde guardas mercancía.',
    conf: {
      tabla: 'almacenes', singular: 'Almacén', activos: true, orden: 'principal DESC, nombre',
      select: `SELECT a.*, (SELECT COUNT(*) FROM stock s WHERE s.almacen_id = a.id AND s.cantidad > 0) AS n,
               (SELECT COALESCE(SUM(s.cantidad * p.costo_c), 0) FROM stock s JOIN productos p ON p.id = s.producto_id WHERE s.almacen_id = a.id AND s.cantidad > 0) AS valor_c FROM almacenes a`,
      buscar: ['nombre', 'direccion'],
      cols: [
        { k: 'nombre', t: 'Almacén', clase: (r) => 'fuerte ' + activo(r) }, { k: 'direccion', t: 'Dirección' },
        { k: 'principal', t: '', f: (r) => (r.principal ? 'Principal' : '') }, { k: 'n', t: 'Productos con existencia', al: 'r' },
        { k: 'valor_c', t: 'Valor al costo', al: 'r', f: (r) => usd(r.valor_c) }
      ],
      campos: [{ k: 'nombre', t: 'Nombre', req: true, full: true }, { k: 'direccion', t: 'Dirección', full: true }]
    }
  },
  transportistas: {
    titulo: 'Transportistas', desc: 'Choferes y vehículos para tus despachos.',
    conf: {
      tabla: 'transportistas', singular: 'Transportista', activos: true, orden: 'nombre', buscar: ['nombre', 'cedula', 'placa', 'vehiculo'],
      cols: [{ k: 'nombre', t: 'Nombre', clase: (r) => 'fuerte ' + activo(r) }, { k: 'cedula', t: 'Cédula' }, { k: 'telefono', t: 'Teléfono' }, { k: 'vehiculo', t: 'Vehículo' }, { k: 'placa', t: 'Placa' }],
      campos: [
        { k: 'nombre', t: 'Nombre', req: true, full: true }, { k: 'cedula', t: 'Cédula' }, { k: 'telefono', t: 'Teléfono', tipo: 'tel' },
        { k: 'vehiculo', t: 'Vehículo', ph: 'Camioneta, moto…' }, { k: 'placa', t: 'Placa' }
      ]
    }
  },
  rutas: {
    titulo: 'Rutas', desc: 'Zonas y días de reparto.',
    conf: {
      tabla: 'rutas', singular: 'Ruta', activos: true, orden: 'nombre', buscar: ['nombre', 'zona', 'dias'],
      select: `SELECT r.*, (SELECT COUNT(*) FROM despachos d WHERE d.ruta_id = r.id AND d.estado IN ('pendiente','en_ruta')) AS abiertos FROM rutas r`,
      cols: [{ k: 'nombre', t: 'Ruta', clase: (r) => 'fuerte ' + activo(r) }, { k: 'zona', t: 'Zona' }, { k: 'dias', t: 'Días' }, { k: 'abiertos', t: 'Despachos abiertos', al: 'r' }],
      campos: [{ k: 'nombre', t: 'Nombre', req: true, full: true }, { k: 'zona', t: 'Zona' }, { k: 'dias', t: 'Días de reparto', ph: 'Lun, Mié, Vie' }, { k: 'notas', t: 'Notas', tipo: 'area' }]
    }
  },
  impuestos: {
    titulo: 'Impuestos', desc: 'Tasas de IVA que usan tus productos.',
    conf: {
      tabla: 'impuestos', singular: 'Impuesto', activos: true, orden: 'tasa DESC', buscar: ['nombre'],
      cols: [{ k: 'nombre', t: 'Nombre', clase: (r) => 'fuerte ' + activo(r) }, { k: 'tasa', t: 'Tasa', al: 'r', f: (r) => pct(r.tasa) }],
      campos: [{ k: 'nombre', t: 'Nombre', req: true, full: true }, { k: 'tasa', t: 'Tasa (%)', tipo: 'numero', req: true }]
    }
  },
  metodos: {
    titulo: 'Métodos de pago', desc: 'Cómo te pagan y cómo pagas. La moneda define si el monto se escribe en dólares o bolívares.',
    conf: {
      tabla: 'metodos_pago', singular: 'Método de pago', activos: true, orden: 'orden, nombre', buscar: ['nombre'],
      cols: [
        { k: 'nombre', t: 'Método', clase: (r) => 'fuerte ' + activo(r) }, { k: 'moneda', t: 'Moneda', f: (r) => (r.moneda === 'VES' ? 'Bolívares' : 'Dólares') },
        { k: 'pide_referencia', t: 'Pide referencia', f: (r) => (r.pide_referencia ? 'Sí' : 'No') }
      ],
      campos: [
        { k: 'nombre', t: 'Nombre', req: true, full: true },
        { k: 'moneda', t: 'Moneda', tipo: 'select', op: [{ v: 'USD', t: 'Dólares' }, { v: 'VES', t: 'Bolívares' }], def: 'VES' },
        { k: 'orden', t: 'Orden en la caja', tipo: 'entero', def: 10 },
        { k: 'pide_referencia', t: 'Pide número de referencia', tipo: 'check', def: false }
      ]
    }
  },
  usuarios: {
    titulo: 'Usuarios', desc: 'Quién usa Cumbre en este equipo. El cajero sólo ve el punto de venta.',
    conf: {
      tabla: 'usuarios', singular: 'Usuario', activos: true, orden: 'nombre', buscar: ['nombre', 'usuario', 'rol'],
      cols: [
        { k: 'nombre', t: 'Nombre', clase: (r) => 'fuerte ' + activo(r) }, { k: 'usuario', t: 'Usuario' },
        { k: 'rol', t: 'Rol', f: (r) => ({ admin: 'Administrador', gerente: 'Gerente', cajero: 'Cajero', almacen: 'Almacén' } as any)[r.rol] || r.rol },
        { k: 'clave', t: 'Clave', f: (r) => (r.clave ? 'Con clave' : 'Sin clave') }
      ],
      campos: [
        { k: 'nombre', t: 'Nombre', req: true, full: true }, { k: 'usuario', t: 'Usuario', req: true },
        { k: 'rol', t: 'Rol', tipo: 'select', op: [{ v: 'admin', t: 'Administrador' }, { v: 'gerente', t: 'Gerente' }, { v: 'cajero', t: 'Cajero' }, { v: 'almacen', t: 'Almacén' }], def: 'cajero' },
        { k: 'clave', t: 'Clave (PIN)', tipo: 'clave', ayuda: 'Si nadie tiene clave, Cumbre abre directo.' }
      ]
    }
  }
};
