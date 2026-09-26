import { q, uno } from './db';
import { app } from './estado.svelte';
import { usd, bsDeC, num, fechaHora, fecha } from './formato';

/* documentos imprimibles: ticket de 80 mm y nota carta. Se imprimen desde un
   iframe oculto con el diálogo de impresión del sistema. */
function esc(s: any) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!)); }

export function imprimirHtml(html: string) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const d = f.contentDocument!;
  d.open(); d.write(html); d.close();
  setTimeout(() => { f.contentWindow?.focus(); f.contentWindow?.print(); setTimeout(() => f.remove(), 1500); }, 250);
}

export async function documentoVenta(id: string, formato: 'ticket' | 'carta' = 'ticket') {
  const v = await uno<any>(`SELECT v.*, c.nombre AS cliente, c.rif AS cliente_rif, c.direccion AS cliente_dir FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id WHERE v.id = ?`, [id]);
  if (!v) return;
  const L = await q('SELECT * FROM venta_lineas WHERE venta_id = ?', [id]);
  const C = await q('SELECT c.*, m.nombre AS metodo FROM cobros c LEFT JOIN metodos_pago m ON m.id = c.metodo_id WHERE c.venta_id = ? AND c.anulado = 0', [id]);
  const a = app.ajustes, t = v.tasa || app.tasa;
  const ancho = formato === 'ticket' ? '72mm' : '190mm';
  const filas = L.map((l) => `<tr><td>${esc(l.descripcion)}${l.presentacion ? ' (' + esc(l.presentacion) + ')' : ''}<br><small>${num(l.cantidad)} × ${usd(l.precio_c)}${l.impuesto_tasa ? '' : ' (E)'}</small></td><td class="r">${usd(l.total_c)}</td></tr>`).join('');
  const pagos = C.map((c) => `<tr><td>${esc(c.metodo)}${c.referencia ? ' · ' + esc(c.referencia) : ''}</td><td class="r">${c.moneda === 'VES' ? 'Bs ' + num(c.monto) : usd(c.monto_c)}</td></tr>`).join('');
  imprimirHtml(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(v.numero)}</title><style>
    @page { size: ${formato === 'ticket' ? '80mm auto' : 'letter'}; margin: ${formato === 'ticket' ? '4mm' : '14mm'}; }
    body { font: 12px/1.35 'Segoe UI', system-ui, sans-serif; color: #000; width: ${ancho}; margin: 0 auto; }
    h1 { font-size: 15px; margin: 0; } p { margin: 2px 0; } table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    td { padding: 3px 0; vertical-align: top; } .r { text-align: right; white-space: nowrap; } small { color: #444; }
    .tot td { font-weight: 700; border-top: 1px dashed #000; } hr { border: 0; border-top: 1px dashed #000; } .c { text-align: center; }
  </style></head><body>
    <div class="c"><h1>${esc(a.empresa_nombre)}</h1><p>RIF ${esc(a.empresa_rif)}</p>${a.empresa_direccion ? `<p>${esc(a.empresa_direccion)}</p>` : ''}${a.empresa_telefono ? `<p>${esc(a.empresa_telefono)}</p>` : ''}</div>
    <hr><p><b>${v.origen === 'pos' ? 'Ticket' : 'Nota de venta'} ${esc(v.numero)}</b></p><p>${fechaHora(v.fecha)}</p>
    <p>Cliente: ${esc(v.cliente)}${v.cliente_rif ? ' · ' + esc(v.cliente_rif) : ''}</p>
    <table>${filas}</table>
    <table><tr><td>Subtotal</td><td class="r">${usd(v.subtotal_c - v.descuento_c)}</td></tr><tr><td>IVA</td><td class="r">${usd(v.impuesto_c)}</td></tr>
    <tr class="tot"><td>Total</td><td class="r">${usd(v.total_c)}</td></tr><tr><td>Total en bolívares</td><td class="r">${bsDeC(v.total_c, t)}</td></tr>
    <tr><td><small>Tasa BCV</small></td><td class="r"><small>${num(t)} Bs/$</small></td></tr></table>
    ${pagos ? `<hr><table>${pagos}</table>` : ''}
    ${v.total_c > v.pagado_c ? `<p><b>Saldo pendiente: ${usd(v.total_c - v.pagado_c)}</b>${v.vence ? ' · vence ' + fecha(v.vence) : ''}</p>` : ''}
    <hr><p class="c">${esc(a.pie_documentos || '')}</p><p class="c"><small>Documento no fiscal · Cumbre by Apex Consulting</small></p>
  </body></html>`);
}
