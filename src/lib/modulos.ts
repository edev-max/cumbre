/* Mapa de Cumbre: módulos y submódulos (la barra lateral sale de aquí) */
export interface Sub { id: string; nombre: string; icono: string; desc: string }
export interface Modulo { id: string; nombre: string; icono: string; subs: Sub[] }

export const MODULOS: Modulo[] = [
  { id: 'inicio', nombre: 'Inicio', icono: 'inicio', subs: [] },
  {
    id: 'ventas', nombre: 'Ventas', icono: 'ventas', subs: [
      { id: 'pos', nombre: 'Punto de venta', icono: 'pos', desc: 'Cobra rápido en caja, con código de barras.' },
      { id: 'notas', nombre: 'Notas de venta', icono: 'doc', desc: 'Pedidos y ventas a crédito o con despacho.' },
      { id: 'clientes', nombre: 'Clientes', icono: 'usuarios', desc: 'Datos, crédito y estado de cuenta.' },
      { id: 'cobranza', nombre: 'Cobranza', icono: 'cobro', desc: 'Cuentas por cobrar y cobros registrados.' },
      { id: 'reportes', nombre: 'Reportes', icono: 'reporte', desc: 'Ventas por día, producto, cliente y método de pago.' }
    ]
  },
  {
    id: 'compras', nombre: 'Compras', icono: 'compras', subs: [
      { id: 'ordenes', nombre: 'Órdenes de compra', icono: 'doc', desc: 'Lo que le pides a tus proveedores.' },
      { id: 'recepciones', nombre: 'Recepciones', icono: 'recibir', desc: 'Mercancía que llegó y entró al inventario.' },
      { id: 'proveedores', nombre: 'Proveedores', icono: 'proveedor', desc: 'Datos y días de crédito.' },
      { id: 'pagar', nombre: 'Cuentas por pagar', icono: 'pagar', desc: 'Lo que debes y los pagos hechos.' }
    ]
  },
  {
    id: 'inventario', nombre: 'Inventario', icono: 'inventario', subs: [
      { id: 'productos', nombre: 'Productos', icono: 'etiqueta', desc: 'Precios, costos, códigos y mínimos.' },
      { id: 'existencias', nombre: 'Existencias', icono: 'caja', desc: 'Cuánto hay en cada almacén y qué reponer.' },
      { id: 'movimientos', nombre: 'Ajustes y traslados', icono: 'mover', desc: 'Entradas, salidas, mermas y traslados.' },
      { id: 'kardex', nombre: 'Kardex', icono: 'kardex', desc: 'Historia de cada producto, movimiento por movimiento.' },
      { id: 'categorias', nombre: 'Categorías', icono: 'etiqueta', desc: 'Grupos de productos.' },
      { id: 'almacenes', nombre: 'Almacenes', icono: 'almacen', desc: 'Depósitos y tiendas.' }
    ]
  },
  {
    id: 'logistica', nombre: 'Logística', icono: 'logistica', subs: [
      { id: 'despachos', nombre: 'Despachos', icono: 'camion', desc: 'Entregas pendientes, en ruta y entregadas.' },
      { id: 'rutas', nombre: 'Rutas', icono: 'ruta', desc: 'Zonas y días de reparto.' },
      { id: 'transportistas', nombre: 'Transportistas', icono: 'usuario', desc: 'Choferes y vehículos.' }
    ]
  },
  {
    id: 'config', nombre: 'Configuración', icono: 'config', subs: [
      { id: 'empresa', nombre: 'Empresa', icono: 'empresa', desc: 'Nombre, RIF y datos de tus documentos.' },
      { id: 'tasas', nombre: 'Tasa BCV', icono: 'tasa', desc: 'Tasa del día e historial.' },
      { id: 'impuestos', nombre: 'Impuestos', icono: 'impuesto', desc: 'IVA general, reducido y exento.' },
      { id: 'metodos', nombre: 'Métodos de pago', icono: 'metodo', desc: 'Efectivo, pago móvil, punto, Zelle…' },
      { id: 'numeracion', nombre: 'Numeración', icono: 'numeracion', desc: 'Prefijos y correlativos de documentos.' },
      { id: 'usuarios', nombre: 'Usuarios', icono: 'usuario', desc: 'Quién entra y qué puede hacer.' },
      { id: 'respaldos', nombre: 'Respaldos', icono: 'respaldo', desc: 'Copias de seguridad de tu información.' },
      { id: 'licencia', nombre: 'Licencia', icono: 'licencia', desc: 'Activación de Cumbre en este equipo.' }
    ]
  }
];

export function buscarSub(mod: string, sub: string) {
  const m = MODULOS.find((x) => x.id === mod);
  return { m, s: m?.subs.find((x) => x.id === sub) };
}
