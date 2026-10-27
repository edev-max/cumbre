/* Enrutador por hash: #/ventas/pos, #/ventas/notas/nueva, #/compras/ordenes/<id> */
function leer() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const partes = (path || 'inicio').split('/').filter(Boolean);
  return { partes, query: new URLSearchParams(qs || '') };
}
export const ruta = $state(leer());
addEventListener('hashchange', () => { const r = leer(); ruta.partes = r.partes; ruta.query = r.query; });
export function ir(path: string) { location.hash = '#/' + path.replace(/^\//, ''); }
export const rutaActual = () => ruta.partes.join('/');
