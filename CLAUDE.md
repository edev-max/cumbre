# Cumbre · notas para trabajar en este repositorio

- Todo el texto de la interfaz, los commits y la documentación va en español de Venezuela, de tú.
- Marca Apex: azul noche `#070B17`, rojo señal `#E8380D` (poco), papel `#F6F1E8`; Mona Sans. El acento de la interfaz es `--acento` (personalizable); `--rojo` es sólo la firma de Apex.
- Montos en centavos de USD (`*_c`, enteros); bolívares con la tasa guardada en cada documento. Cantidades en la unidad base del producto; `factor` convierte presentaciones.

## Comprobar

```bash
npm install
npm test && npm run check          # cálculos y tipos
(cd src-tauri && cargo test --lib)  # licencias, BCV, respaldos
(cd licencias/src-tauri && cargo test --lib)
npm run dev                         # navegador, http://localhost:1420 (sql.js)
```

## Armar los instaladores de Windows desde Linux

GitHub Actions no corre en la cuenta de Apex (falla sin asignar máquina), así que se arman aquí:

```bash
apt-get install -y libwebkit2gtk-4.1-dev librsvg2-dev mingw-w64 nsis   # una vez
rustup target add x86_64-pc-windows-gnu                               # una vez
npm run instalador             # instalador/Cumbre-<versión>-instalador.exe
npm run licencias:instalador   # licencias/Apex-Licencias-1.0.0-instalador.exe
```

Al cambiar funciones, subir la versión en `package.json`, `src-tauri/tauri.conf.json` y `src-tauri/Cargo.toml`.

## Clave de licencias

`src-tauri/clave_publica.txt` es la clave pública con la que Cumbre verifica licencias. La privada la tiene Apex en su app **Apex Licencias** (o en `keys/`, fuera del repositorio). Si Apex manda una clave pública nueva, se pone en ese archivo y se vuelve a armar el instalador de Cumbre.
