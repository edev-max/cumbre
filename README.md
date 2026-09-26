# Cumbre · by Apex Consulting

Sistema administrativo para bodegas y pequeños negocios de Venezuela. Funciona en la computadora del negocio (Windows), con su información guardada localmente en SQLite, y se activa con una licencia por equipo.

## Módulos

| Módulo | Submódulos |
|---|---|
| **Ventas** | Punto de venta (código de barras, cobro mixto $/Bs con vuelto), notas de venta (crédito y despacho), clientes, cobranza por antigüedad, reportes |
| **Compras** | Órdenes de compra, recepciones (parciales, costo promedio), proveedores, cuentas por pagar |
| **Inventario** | Productos, existencias por almacén, ajustes, conteo físico, traslados, kardex, categorías, almacenes |
| **Logística** | Tablero de despachos, rutas, transportistas |
| **Configuración** | Empresa, tasa BCV, impuestos, métodos de pago, numeración, usuarios, respaldos, licencia |

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

El instalador de Windows lo arma GitHub Actions (`.github/workflows/windows.yml`) en cada cambio a `main`: se descarga desde la pestaña **Actions → Instalador de Windows → Artifacts**. Con una etiqueta `v0.1.0` se crea además un borrador de release.

## Usuarios y roles

Si algún usuario tiene clave, Cumbre pide elegir usuario al abrir. Cada rol ve lo suyo: **Administrador** todo; **Gerente** todo menos usuarios, numeración, impuestos, métodos y licencia; **Cajero** caja, notas, clientes y cobranza; **Almacén** inventario, órdenes, recepciones y logística.

## Licencias

- Sin licencia, Cumbre funciona completo **15 días** desde la instalación. Después queda en **sólo lectura**: se consulta todo, pero no se registran movimientos.
- La licencia está firmada con la clave privada de Apex (Ed25519) y atada al **código de equipo** que muestra Cumbre en Configuración → Licencia. El programa sólo trae la clave pública: puede verificar licencias, pero no fabricarlas.
- Al vencer hay **7 días de gracia**.

### Antes de la primera venta: crear las claves de Apex

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

## Pendiente

- Servidor de licencias en `cumbre.apexconsultingve.com` para renovar en línea y desactivar licencias a distancia.
- Tasa BCV automática.
- Respaldo automático en la nube.
- Integración con máquina fiscal o proveedor autorizado por el SENIAT.
