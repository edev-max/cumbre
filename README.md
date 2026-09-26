# Cumbre · by Apex Consulting

Sistema administrativo para bodegas y pequeños negocios de Venezuela. Funciona en la computadora del negocio (Windows), con su información guardada localmente en SQLite, y se activa con una licencia por equipo.

## Módulos

| Módulo | Submódulos |
|---|---|
| **Ventas** | Punto de venta (código de barras, cobro mixto $/Bs con vuelto), notas de venta (crédito y despacho), clientes, cobranza por antigüedad, reportes |
| **Compras** | Órdenes de compra, recepciones (parciales, costo promedio), proveedores, cuentas por pagar |
| **Inventario** | Productos con foto, código y presentaciones (caja, bulto, paquete…), existencias por almacén, ajustes, conteo físico, traslados, kardex, categorías, almacenes |
| **Logística** | Tablero de despachos, rutas, transportistas |
| **Configuración** | Empresa, tasa BCV, impuestos, métodos de pago, numeración, usuarios, respaldos, licencia |

Cada producto se lleva en su unidad de venta (unidad, kilo…). Sus **presentaciones** dicen cuánto trae cada caja o bulto: se compra en la presentación del proveedor y, al recibir, Cumbre convierte cantidades y costos a la unidad de venta. Una presentación también puede venderse (al mayor), con su propio precio y código de barras.

Los precios viven en dólares y los bolívares salen de la tasa BCV; cada documento guarda la tasa de su día. Los documentos son **no fiscales** (tickets y notas de entrega).

## Cómo está hecho

- **Interfaz:** Svelte 5 + Vite, con el sistema visual de Apex (liquid glass, azul noche, rojo señal, papel, Mona Sans). `src/`
- **Datos:** SQLite. El mismo SQL corre en dos lugares:
  - en el escritorio, lo ejecuta Rust (`src-tauri/src/db.rs`) sobre `cumbre.db`, en la carpeta de datos de la aplicación;
  - en el navegador, corre sobre sql.js (SQLite en WebAssembly), guardado en IndexedDB, para desarrollar y mostrar demos.
- **Escritorio:** Tauri 2. Instalador de ~10 MB, ventana con Mica en Windows 11.
- **Lógica de negocio:** `src/lib/servicios/`. Cada operación (una venta, una recepción…) entra completa o no entra: se manda a la base como una sola transacción.

## Desarrollo

```bash
npm install
npm run dev          # Cumbre en el navegador (modo demostración): http://localhost:1420
npm run tauri dev    # Cumbre como aplicación de escritorio (requiere Rust)
npm test             # pruebas de cálculos
npm run check        # tipos
```

### Instalador de Windows

Desde Linux (o WSL), con `mingw-w64`, `nsis` y el target de Rust `x86_64-pc-windows-gnu`:

```bash
npm run instalador   # deja instalador/Cumbre-<versión>-instalador.exe
```

También lo arma GitHub Actions (`.github/workflows/windows.yml`) en cada cambio a `main`: se descarga desde la pestaña **Actions → Instalador de Windows → Artifacts**. Con una etiqueta `v0.1.0` se crea además un borrador de release.

## Usuarios y roles

Si algún usuario tiene clave, Cumbre pide elegir usuario al abrir. Cada rol ve lo suyo: **Administrador** todo; **Gerente** todo menos usuarios, numeración, impuestos, métodos y licencia; **Cajero** caja, notas, clientes y cobranza; **Almacén** inventario, órdenes, recepciones y logística.

## Licencias

- Sin licencia, Cumbre funciona completo **15 días** desde la instalación. Después queda en **sólo lectura**: se consulta todo, pero no se registran movimientos.
- La licencia está firmada con la clave privada de Apex (Ed25519) y atada al **código de equipo** que muestra Cumbre en Configuración → Licencia. El programa sólo trae la clave pública: puede verificar licencias, pero no fabricarlas.
- Al vencer hay **7 días de gracia**.

### Apex Licencias (la app de Apex para emitir licencias)

`licencias/` es una app de Windows aparte, sólo para Apex. No se entrega a clientes.

1. **Primera vez:** crea la clave de Apex con una contraseña. La clave privada se genera en esa computadora y queda cifrada (Argon2id + ChaCha20-Poly1305); nunca sale de ahí salvo en el respaldo cifrado.
2. **Respaldar:** pestaña *Mi clave* → *Respaldar clave…* (ideal: Google Drive). Con ese archivo y la contraseña se restaura en otra computadora.
3. **Clave pública:** pestaña *Mi clave* → *Copiar clave pública*. Va en `src-tauri/clave_publica.txt` y se vuelve a armar el instalador de Cumbre (una sola vez; desde ahí Cumbre reconoce las licencias de esa clave).
4. **Emitir:** cliente, RIF, WhatsApp y código de equipo → *Generar licencia* → *Copiar* o *Enviar por WhatsApp*. Queda en el historial.

Se arma con `npm run licencias:instalador` (deja `licencias/Apex-Licencias-<versión>-instalador.exe`).

La herramienta de línea de comandos `npm run licencia -- …` sigue sirviendo para lo mismo.

### Por línea de comandos (alternativa)

```bash
npm run licencia -- claves
```

Esto crea `keys/apex-privada.pem` (**no se sube al repositorio**, está en `.gitignore`; guárdala con copia en un lugar seguro) y escribe la clave pública en `src-tauri/clave_publica.txt`, que sí se sube. La clave que trae el repositorio hoy es de desarrollo: reemplázala con este comando en tu computadora y sube el cambio.

### Emitir una licencia

```bash
npm run licencia -- emitir --cliente "Bodega La Esquina" --rif J-12345678-9 \
  --equipo ABCD-1234-EF56-7890 --vence 2027-12-31 --plan Pyme
```

Se imprime un texto `CUMBRE-…` que el cliente pega en Configuración → Licencia.

## Automático

- **Tasa BCV:** en el escritorio, Cumbre lee la página del BCV al abrir y cada 3 horas (`src-tauri/src/bcv.rs`). Guarda la tasa con su fecha valor y la empieza a usar ese día. Se puede apagar y escribir a mano en Configuración → Tasa BCV.
- **Respaldos:** una copia al abrir y cada 12 horas, conservando las últimas 30, en la carpeta que elija el cliente (`src-tauri/src/respaldo.rs`). Cumbre detecta **Google Drive para computadoras** ("Mi unidad") y OneDrive: si la carpeta es de Drive, la copia sube sola a la nube, sin iniciar sesión en Cumbre.

## Personalización

Configuración → Personalización: logo del negocio (barra lateral, entrada y tickets), imagen de fondo (se atenúa para que el vidrio se lea) y color de acento. El triángulo rojo del logo de Cumbre queda fijo: es la firma de Apex.

## Pendiente

- Servidor de licencias en `cumbre.apexconsultingve.com` para renovar en línea y desactivar licencias a distancia; la tasa BCV pasaría a leerse desde ahí.
- Integración con máquina fiscal o proveedor autorizado por el SENIAT.
