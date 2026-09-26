//! Cumbre · núcleo de escritorio.
//! La interfaz (Svelte) no toca el disco: le pide a Rust que ejecute SQL.
//! Aquí también se decide si la licencia permite escribir.

mod db;
mod licencia;

use std::sync::Mutex;
use tauri::Manager;

pub struct Estado {
    pub db: Mutex<rusqlite::Connection>,
    pub carpeta: std::path::PathBuf,
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let carpeta = app.path().app_data_dir().expect("sin carpeta de datos");
            std::fs::create_dir_all(&carpeta)?;
            let ruta_db = carpeta.join("cumbre.db");
            let conn = db::abrir(&ruta_db)?;
            licencia::registrar_inicio(&carpeta);
            app.manage(Estado { db: Mutex::new(conn), carpeta });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::db_select,
            db::db_execute,
            db::db_script,
            db::db_batch,
            db::db_exportar,
            db::db_importar,
            licencia::licencia_estado,
            licencia::licencia_activar
        ])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Cumbre");
}
