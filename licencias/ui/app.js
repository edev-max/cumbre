// Apex Licencias: la interfaz. Toda la criptografía vive en Rust.
const { invoke } = window.__TAURI__.core;
const $ = (id) => document.getElementById(id);
const mostrar = (id, si = true) => { $(id).hidden = !si; };

function aviso(t) {
  const a = $('aviso'); a.textContent = t; a.hidden = false;
  clearTimeout(aviso.t); aviso.t = setTimeout(() => (a.hidden = true), 2600);
}
const fechaLarga = (s) => new Date(s + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
const hoy = () => new Date().toISOString().slice(0, 10);

async function inicio() {
  const i = await invoke('info');
  if (i.desbloqueada) return entrar(i);
  mostrar('app', false); mostrar('puerta');
  mostrar('crear', !i.tiene_clave); mostrar('abrir', i.tiene_clave); mostrar('restaurar', false);
  $('errPuerta').textContent = '';
  setTimeout(() => (i.tiene_clave ? $('ca') : $('c1')).focus(), 50);
}
function entrar(i) {
  mostrar('puerta', false); mostrar('app');
  $('publica').textContent = i.publica;
  $('carpetaDatos').textContent = 'Tus datos están en ' + i.carpeta;
  calcularVence(); cargarHistorial(); $('cliente').focus();
}
async function intentar(fn, err) {
  $(err).textContent = '';
  try { return await fn(); } catch (e) { $(err).textContent = String(e); }
}

// ---------- entrada ----------
$('btnCrear').onclick = () => intentar(async () => {
  if ($('c1').value !== $('c2').value) throw 'Las contraseñas no coinciden.';
  const i = await invoke('crear_clave', { contrasena: $('c1').value });
  entrar(i); cambiarTab('clave'); aviso('Clave creada. Respáldala ahora.');
}, 'errPuerta');
$('btnAbrir').onclick = () => intentar(async () => entrar(await invoke('desbloquear', { contrasena: $('ca').value })), 'errPuerta');
$('ca').onkeydown = (e) => { if (e.key === 'Enter') $('btnAbrir').click(); };
$('btnIrRestaurar').onclick = () => { mostrar('crear', false); mostrar('restaurar'); };
$('btnVolverCrear').onclick = () => { mostrar('restaurar', false); mostrar('crear'); };
let archivoClave = '';
$('btnElegirClave').onclick = async () => {
  const r = await window.__TAURI__.dialog.open({ title: 'Archivo clave-apex.json', filters: [{ name: 'Clave de Apex', extensions: ['json'] }] });
  if (r) { archivoClave = r; $('rutaClave').textContent = r; }
};
$('btnRestaurar').onclick = () => intentar(async () => {
  if (!archivoClave) throw 'Elige el archivo de la clave.';
  entrar(await invoke('restaurar', { archivo: archivoClave, contrasena: $('cr').value })); aviso('Clave restaurada.');
}, 'errPuerta');
$('btnBloquear').onclick = async () => { await invoke('bloquear'); $('ca').value = ''; inicio(); };

// ---------- pestañas ----------
function cambiarTab(t) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  ['emitir', 'historial', 'clave'].forEach((v) => mostrar('v-' + v, v === t));
  if (t === 'historial') cargarHistorial();
}
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => cambiarTab(b.dataset.tab)));

// ---------- emitir ----------
function venceElegido() {
  const d = $('duracion').value;
  if (d === 'fecha') return $('vence').value;
  const f = new Date(); f.setMonth(f.getMonth() + Number(d));
  return f.toISOString().slice(0, 10);
}
function calcularVence() {
  mostrar('campoFecha', $('duracion').value === 'fecha');
  const v = venceElegido();
  $('resumenVence').textContent = v ? 'Vence el ' + fechaLarga(v) + '.' : '';
}
$('duracion').onchange = calcularVence; $('vence').onchange = calcularVence;
// el código se escribe solo con guiones: ABCD-1234-EF56-7890
$('equipo').oninput = (e) => {
  const limpio = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 16);
  e.target.value = limpio.match(/.{1,4}/g)?.join('-') || '';
};
let ultima = { lic: '', tel: '', cliente: '' };
$('form').onsubmit = (e) => { e.preventDefault(); intentar(async () => {
  const datos = { cliente: $('cliente').value, rif: $('rif').value, plan: $('plan').value, equipo: $('equipo').value, vence: venceElegido(), telefono: $('tel').value };
  const lic = await invoke('emitir', datos);
  ultima = { lic, tel: datos.telefono, cliente: datos.cliente.trim() };
  $('lic').value = lic; mostrar('resVacio', false); mostrar('resLleno');
  $('resTitulo').textContent = `Licencia de ${ultima.cliente}, vence el ${fechaLarga(datos.vence)}.`;
  aviso('Licencia generada.');
}, 'errForm'); };
$('btnCopiar').onclick = async () => { await navigator.clipboard.writeText(ultima.lic); aviso('Licencia copiada.'); };
function whatsapp(lic, tel, cliente) {
  let n = (tel || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '58' + n.slice(1);
  const texto = `Hola${cliente ? ' ' + cliente : ''}, aquí está tu licencia de Cumbre. Ábrelo, ve a Configuración → Licencia, pega este texto y toca Activar:\n\n${lic}`;
  window.__TAURI__.opener.openUrl(`https://wa.me/${n}?text=${encodeURIComponent(texto)}`);
}
$('btnWhats').onclick = () => whatsapp(ultima.lic, ultima.tel, ultima.cliente);

// ---------- historial ----------
let hist = [];
async function cargarHistorial() { hist = await invoke('historial'); pintar(); }
function pintar() {
  const t = $('buscar').value.trim().toLowerCase();
  const filas = hist.filter((h) => !t || [h.cliente, h.rif, h.equipo].some((x) => (x || '').toLowerCase().includes(t)));
  mostrar('histVacio', !filas.length);
  $('filas').innerHTML = '';
  for (const h of filas) {
    const tr = document.createElement('tr');
    const celdas = [h.fecha, h.cliente, h.rif || '—', h.equipo, h.plan, fechaLarga(h.vence)];
    celdas.forEach((c, i) => { const td = document.createElement('td'); td.textContent = c; if (i === 3) td.className = 'eq'; if (i === 5 && h.vence < hoy()) td.className = 'vencida'; tr.appendChild(td); });
    const td = document.createElement('td'); td.style.whiteSpace = 'nowrap';
    const b1 = document.createElement('button'); b1.className = 'btn chico'; b1.textContent = 'Copiar';
    b1.onclick = async () => { await navigator.clipboard.writeText(h.licencia); aviso('Licencia copiada.'); };
    const b2 = document.createElement('button'); b2.className = 'btn chico fantasma'; b2.textContent = 'WhatsApp';
    b2.onclick = () => whatsapp(h.licencia, h.telefono, h.cliente);
    td.append(b1, b2); tr.appendChild(td); $('filas').appendChild(tr);
  }
}
$('buscar').oninput = pintar;

// ---------- clave ----------
$('btnCopiarPublica').onclick = async () => { await navigator.clipboard.writeText($('publica').textContent); aviso('Clave pública copiada.'); };
$('btnRespaldar').onclick = async () => {
  const carpeta = await window.__TAURI__.dialog.open({ directory: true, title: 'Dónde guardar el respaldo (ideal: Google Drive)' });
  if (!carpeta) return;
  try { const r = await invoke('respaldar', { carpeta }); $('okRespaldo').textContent = 'Respaldo guardado en ' + r; }
  catch (e) { aviso(String(e)); }
};

inicio();
