# Contribuir a Cumbre

Gracias por querer mejorar Cumbre. Esta guía explica cómo reportar un error, cómo mandar un cambio y qué convenciones sigue el proyecto.

## Reportar un error o proponer una idea

Abre un [issue](https://github.com/edev-max/cumbre/issues). Si es un error, cuenta:

- qué hiciste, qué esperabas y qué pasó;
- la versión de Cumbre (aparece en *Configuración → Aplicaciones → Aplicaciones instaladas* de Windows) y la de Windows;
- una captura de pantalla, si ayuda.

No pegues datos reales de tu negocio ni de tus clientes.

## Mandar un cambio

1. Haz un fork y crea una rama desde `main`.
2. Haz tu cambio y comprueba que todo pasa (ver abajo).
3. Abre un pull request que diga qué cambia y por qué. Si toca la interfaz, agrega una captura.

Los cambios pequeños y enfocados se revisan más rápido que uno grande que toca muchas cosas.

## Comprobar

```bash
npm install
npm test && npm run check            # cálculos y tipos
(cd src-tauri && cargo test --lib)   # tasa BCV y respaldos
npm run dev                          # Cumbre en el navegador: http://localhost:1420
```

`npm run dev` usa sql.js en el navegador, así que no necesitas Rust para trabajar en la interfaz ni en la lógica de negocio. Necesitas Node.js 22.18 o más nuevo, porque las pruebas importan TypeScript directamente.

## Convenciones

- **Idioma.** Los textos de la interfaz, los commits y la documentación van en español de Venezuela y de tú.
- **Dinero.** Los montos se guardan en centavos de dólar, como enteros, en campos que terminan en `_c`. Los bolívares se calculan con la tasa que guarda cada documento, nunca con la tasa de hoy.
- **Cantidades.** Se guardan en la unidad base del producto. El `factor` de cada presentación convierte cajas, bultos o paquetes a esa unidad.
- **Operaciones.** La lógica de negocio vive en `src/lib/servicios/`. Cada operación (una venta, una recepción…) se manda a la base como una sola transacción.
- **SQL.** Tiene que correr igual en el escritorio (rusqlite) y en el navegador (sql.js).
- **Marca.** Usa azul noche `#070B17`, papel `#F6F1E8` y Mona Sans. El acento de la interfaz es `--acento`, que el usuario puede cambiar. El rojo señal `--rojo` (`#E8380D`) es sólo la firma de Apex y se usa poco.
- **Libre uso.** Cumbre no tiene licencias, activación, período de prueba ni telemetría. No se aceptan cambios que agreguen bloqueos de uso.

## Publicar una versión

1. Sube la versión en `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` y la insignia de versión del `README.md`.
2. Arma el instalador (ver el [README](README.md#armar-el-instalador)).
3. En GitHub, ve a **Releases → Draft a new release** y crea la etiqueta `vX.Y.Z`.
4. Adjunta el instalador con el nombre **`Cumbre-instalador.exe`**. El botón de descarga del README apunta a ese nombre en la última release. Si el nombre cambia, el enlace se rompe.
5. Publica la release.

Si GitHub Actions corre en el repositorio, al subir la etiqueta `vX.Y.Z` arma el instalador y deja un borrador de release con `Cumbre-instalador.exe` ya adjunto. En ese caso sólo te queda revisarlo y publicarlo.

## Licencia

Al contribuir, aceptas que tu aporte se publique bajo la [licencia MIT](LICENSE) del proyecto.
