//! Respaldos automáticos a una carpeta. Si la carpeta es de Google Drive para
//! escritorio (o de OneDrive), la copia sube sola a la nube: Cumbre no
//! necesita cuentas ni contraseñas, sólo escribir el archivo ahí.

use crate::Estado;
use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::State;

pub const SUBCARPETA: &str = "Cumbre respaldos";

#[derive(Serialize)]
pub struct Carpeta {
    pub nombre: String,
    pub ruta: String,
    pub nube: bool,
}

#[derive(Serialize)]
pub struct Hecho {
    pub archivo: String,
    pub carpeta: String,
    pub bytes: u64,
    pub guardados: usize,
}

/// Dónde puede guardar: Google Drive primero, luego OneDrive y Documentos.
#[tauri::command]
pub fn respaldo_sugerencias() -> Vec<Carpeta> {
    let mut v: Vec<Carpeta> = Vec::new();
    let mut agregar = |nombre: &str, p: PathBuf, nube: bool| {
        if p.is_dir() && !v.iter().any(|c| Path::new(&c.ruta) == p) {
            v.push(Carpeta { nombre: nombre.into(), ruta: p.to_string_lossy().into_owned(), nube });
        }
    };
    // Google Drive para escritorio monta una unidad (G: por defecto) con "Mi unidad"
    if cfg!(windows) {
        for letra in b'D'..=b'Z' {
            let raiz = format!("{}:\\", letra as char);
            for nombre in ["Mi unidad", "My Drive"] {
                agregar("Google Drive", PathBuf::from(&raiz).join(nombre), true);
            }
        }
    }
    if let Some(casa) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")).map(PathBuf::from) {
        for n in ["Google Drive", "My Drive", "Mi unidad"] {
            agregar("Google Drive", casa.join(n), true);
        }
        for var in ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"] {
            if let Some(o) = std::env::var_os(var) {
                agregar("OneDrive", PathBuf::from(o), true);
            }
        }
        agregar("Documentos", casa.join("Documents"), false);
    }
    v
}

fn podar(carpeta: &Path, conservar: usize) -> usize {
    let mut archivos: Vec<PathBuf> = std::fs::read_dir(carpeta)
        .map(|it| {
            it.filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|p| {
                    let n = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    n.starts_with("cumbre-") && n.ends_with(".db")
                })
                .collect()
        })
        .unwrap_or_default();
    archivos.sort(); // el nombre lleva fecha y hora: ordena por antigüedad
    let sobran = archivos.len().saturating_sub(conservar);
    for p in archivos.iter().take(sobran) {
        let _ = std::fs::remove_file(p);
    }
    archivos.len() - sobran
}

pub fn respaldar(c: &Connection, raiz: &Path, conservar: usize) -> Result<Hecho, String> {
    if !raiz.is_dir() {
        return Err(format!("La carpeta {} no existe o no está conectada.", raiz.display()));
    }
    let carpeta = raiz.join(SUBCARPETA);
    std::fs::create_dir_all(&carpeta).map_err(|e| format!("No se pudo crear {}: {e}", carpeta.display()))?;
    let nombre = format!("cumbre-{}.db", chrono::Local::now().format("%Y-%m-%d_%H%M"));
    let tmp = carpeta.join(format!("{nombre}.parcial"));
    let destino = carpeta.join(&nombre);
    let _ = std::fs::remove_file(&tmp);
    {
        let mut d = Connection::open(&tmp).map_err(|e| e.to_string())?;
        let b = rusqlite::backup::Backup::new(c, &mut d).map_err(|e| e.to_string())?;
        b.run_to_completion(512, std::time::Duration::from_millis(0), None).map_err(|e| e.to_string())?;
    }
    // se escribe aparte y se renombra: Drive nunca sube un archivo a medias
    std::fs::rename(&tmp, &destino).map_err(|e| e.to_string())?;
    let bytes = std::fs::metadata(&destino).map(|m| m.len()).unwrap_or(0);
    let guardados = podar(&carpeta, conservar.max(1));
    Ok(Hecho { archivo: nombre, carpeta: carpeta.to_string_lossy().into_owned(), bytes, guardados })
}

#[tauri::command]
pub fn respaldo_guardar(estado: State<Estado>, carpeta: String, conservar: Option<usize>) -> Result<Hecho, String> {
    let c = estado.db.lock().map_err(|e| e.to_string())?;
    respaldar(&c, Path::new(&carpeta), conservar.unwrap_or(30))
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn guarda_y_conserva_los_ultimos() {
        let raiz = std::env::temp_dir().join(format!("cumbre-prueba-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&raiz);
        std::fs::create_dir_all(raiz.join(SUBCARPETA)).unwrap();
        // respaldos viejos de mentira
        for i in 0..5 {
            std::fs::write(raiz.join(SUBCARPETA).join(format!("cumbre-2020-01-0{i}_0000.db")), b"x").unwrap();
        }
        let c = Connection::open_in_memory().unwrap();
        c.execute_batch("CREATE TABLE t (x); INSERT INTO t VALUES (42);").unwrap();
        let h = respaldar(&c, &raiz, 3).unwrap();
        assert_eq!(h.guardados, 3);
        let copia = Connection::open(raiz.join(SUBCARPETA).join(&h.archivo)).unwrap();
        let x: i64 = copia.query_row("SELECT x FROM t", [], |r| r.get(0)).unwrap();
        assert_eq!(x, 42);
        assert!(!raiz.join(SUBCARPETA).join("cumbre-2020-01-00_0000.db").exists());
        let _ = std::fs::remove_dir_all(&raiz);
    }

    #[test]
    fn carpeta_inexistente() {
        let c = Connection::open_in_memory().unwrap();
        assert!(respaldar(&c, Path::new("/no/existe/cumbre"), 3).is_err());
    }
}
