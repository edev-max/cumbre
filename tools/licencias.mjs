#!/usr/bin/env node
/* Cumbre · herramienta interna de Apex para emitir licencias.
 *
 *   npm run licencia -- claves
 *       Crea el par de claves de Apex. La privada queda en keys/apex-privada.pem
 *       (NUNCA se sube al repositorio: guárdala en un lugar seguro y con copia).
 *       La pública se escribe en src-tauri/clave_publica.txt y va dentro del
 *       instalador. Si cambias las claves, las licencias viejas dejan de valer.
 *
 *   npm run licencia -- emitir --cliente "Bodega La Esquina" --rif J-12345678-9 \
 *       --equipo ABCD-1234-EF56-7890 --vence 2027-12-31 [--plan Pyme]
 *       Imprime la licencia (CUMBRE-…) para enviársela al cliente.
 *
 *   npm run licencia -- verificar "CUMBRE-…"
 */
import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRIVADA = process.env.CUMBRE_CLAVE || join(RAIZ, 'keys', 'apex-privada.pem');
const PUBLICA = join(RAIZ, 'src-tauri', 'clave_publica.txt');
const b64 = (b) => Buffer.from(b).toString('base64url');

function args(lista) {
  const o = {};
  for (let i = 0; i < lista.length; i++) if (lista[i].startsWith('--')) o[lista[i].slice(2)] = lista[i + 1], i++;
  return o;
}
function publicaHex(clave) {
  return Buffer.from(createPublicKey(clave).export({ format: 'jwk' }).x, 'base64url').toString('hex');
}

const [cmd, ...resto] = process.argv.slice(2);
if (cmd === 'claves') {
  if (existsSync(PRIVADA) && !resto.includes('--reemplazar')) {
    console.error(`Ya existe ${PRIVADA}. Usa --reemplazar si de verdad quieres cambiarla (las licencias emitidas dejarán de valer).`);
    process.exit(1);
  }
  const { privateKey } = generateKeyPairSync('ed25519');
  mkdirSync(dirname(PRIVADA), { recursive: true });
  writeFileSync(PRIVADA, privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  writeFileSync(PUBLICA, publicaHex(privateKey) + '\n');
  console.log(`Clave privada: ${PRIVADA}  (guárdala fuera del repositorio)`);
  console.log(`Clave pública: ${PUBLICA}  (súbela; va dentro del instalador)`);
} else if (cmd === 'emitir') {
  const a = args(resto);
  for (const k of ['cliente', 'equipo', 'vence']) if (!a[k]) { console.error(`Falta --${k}`); process.exit(1); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.vence)) { console.error('--vence va como AAAA-MM-DD'); process.exit(1); }
  const clave = createPrivateKey(readFileSync(PRIVADA));
  const datos = { v: 1, cliente: a.cliente, rif: a.rif || '', plan: a.plan || 'Pyme', equipo: a.equipo.toUpperCase(), emitida: new Date().toISOString().slice(0, 10), vence: a.vence };
  const d = b64(JSON.stringify(datos));
  console.log(`CUMBRE-${d}.${b64(sign(null, Buffer.from(d), clave))}`);
} else if (cmd === 'verificar') {
  const t = (resto[0] || '').trim().replace(/^CUMBRE-/, '');
  const [d, f] = t.split('.');
  const hex = readFileSync(PUBLICA, 'utf8').trim();
  const pub = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(hex, 'hex').toString('base64url') }, format: 'jwk' });
  const ok = !!d && !!f && verify(null, Buffer.from(d), pub, Buffer.from(f, 'base64url'));
  console.log(ok ? 'Válida:' : 'NO es válida.', ok ? JSON.parse(Buffer.from(d, 'base64url').toString()) : '');
  process.exit(ok ? 0 : 1);
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 16).join('\n'));
}
