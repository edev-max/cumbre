import { q, valor } from './db';

/* Un producto tal como se elige en caja, notas u órdenes. Si viene de una
   presentación (Caja x 24), cantidad y precio se entienden en esa
   presentación y factor dice cuántas unidades base trae. */
export interface ProductoSel {
  id: string; codigo: string; barra: string; nombre: string; unidad: string;
  precio_c: number; costo_c: number; iva: number; existencia: number;
  presentacion_id: string | null; presentacion: string | null; factor: number; imagen: string | null;
}

export async function buscarProductos(o: { texto?: string; almacen?: string; compra?: boolean; categoria?: string; limite?: number; conPresentaciones?: boolean }): Promise<ProductoSel[]> {
  const t = (o.texto || '').trim();
  const uso = o.compra ? 'compra' : 'venta';
  const exist = `COALESCE((SELECT SUM(cantidad) FROM stock s WHERE s.producto_id = p.id${o.almacen ? ' AND s.almacen_id = $alm' : ''}), 0)`;
  const img = `(SELECT imagen FROM producto_imagenes pi WHERE pi.producto_id = p.id)`;
  const filtro = (barra: string) => (t ? ` AND (p.nombre LIKE $like OR p.codigo LIKE $pre OR p.codigo = $t OR ${barra} = $t)` : '') + (o.categoria ? ' AND p.categoria_id = $cat' : '');
  const base = `SELECT p.id, p.codigo, p.barra, p.nombre, p.unidad, p.precio_c, p.costo_c, COALESCE(i.tasa, 0) AS iva, ${exist} AS existencia,
      NULL AS presentacion_id, NULL AS presentacion, 1 AS factor, ${img} AS imagen, CASE WHEN p.barra = $t OR p.codigo = $t THEN 0 ELSE 1 END AS exacto
    FROM productos p LEFT JOIN impuestos i ON i.id = p.impuesto_id
    WHERE p.activo = 1 AND p.${o.compra ? 'se_compra' : 'se_vende'} = 1${filtro('p.barra')}`;
  const pres = `SELECT p.id, p.codigo, pr.barra, p.nombre, p.unidad,
      CASE WHEN pr.precio_c > 0 THEN pr.precio_c ELSE CAST(ROUND(p.precio_c * pr.factor) AS INTEGER) END,
      CASE WHEN pr.costo_c > 0 THEN pr.costo_c ELSE CAST(ROUND(p.costo_c * pr.factor) AS INTEGER) END,
      COALESCE(i.tasa, 0), ${exist}, pr.id, pr.nombre, pr.factor, ${img}, CASE WHEN pr.barra = $t THEN 0 ELSE 1 END
    FROM presentaciones pr JOIN productos p ON p.id = pr.producto_id LEFT JOIN impuestos i ON i.id = p.impuesto_id
    WHERE pr.activo = 1 AND pr.${uso} = 1 AND p.activo = 1${filtro('pr.barra')}`;
  const sql = `SELECT * FROM (${base}${o.conPresentaciones === false ? '' : ` UNION ALL ${pres}`}) ORDER BY exacto, nombre, factor LIMIT ${o.limite || 12}`;
  // sql.js y Rust aceptan parámetros por nombre sólo como posición: se expanden aquí
  const valores: Record<string, any> = { $alm: o.almacen || '', $like: `%${t}%`, $pre: `${t}%`, $t: t, $cat: o.categoria || '' };
  const params: any[] = [];
  const final = sql.replace(/\$(alm|like|pre|t|cat)\b/g, (m) => { params.push(valores[m]); return '?'; });
  return (await q(final, params)) as ProductoSel[];
}

/** próximo código libre P-0001 */
export async function proximoCodigo(): Promise<string> {
  const n = (await valor<number>(`SELECT COALESCE(MAX(CAST(SUBSTR(codigo, 3) AS INTEGER)), 0) FROM productos WHERE codigo GLOB 'P-[0-9]*'`)) || 0;
  return 'P-' + String(n + 1).padStart(4, '0');
}

/** reduce una imagen a 480 px y la guarda como WebP (unos 20–40 KB) */
export async function prepararImagen(archivo: Blob, lado = 480): Promise<string> {
  const bmp = await createImageBitmap(archivo);
  const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const webp = c.toDataURL('image/webp', 0.82);
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.85);
}
