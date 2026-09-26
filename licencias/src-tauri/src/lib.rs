//! Apex Licencias: la herramienta de Apex para emitir licencias de Cumbre.
//!
//! La clave privada se crea en esta computadora y se guarda cifrada con la
//! contraseña de Apex (Argon2id + ChaCha20-Poly1305). Sólo mientras la app
//! está desbloqueada vive descifrada, en memoria. La licencia que emite tiene
//! el mismo formato que verifica Cumbre (src-tauri/src/licencia.rs):
//! `CUMBRE-<datos base64url>.<firma Ed25519 base64url>`.

pub mod clave;

use clave::{ArchivoClave, Datos};
use ed25519_dalek::SigningKey;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

pub struct Estado {
    carpeta: PathBuf,
    firma: Mutex<Option<SigningKey>>,
}

impl Estado {
    fn archivo_clave(&self) -> PathBuf { self.carpeta.join("clave-apex.json") }
    fn archivo_historial(&self) -> PathBuf { self.carpeta.join("historial.json") }
}

#[derive(Serialize)]
pub struct Info {
    tiene_clave: bool,
    desbloqueada: bool,
    publica: String,
    carpeta: String,
}

fn leer_clave(e: &Estado) -> Option<ArchivoClave> {
    std::fs::read_to_string(e.archivo_clave()).ok().and_then(|t| serde_json::from_str(&t).ok())
}

#[tauri::command]
fn info(e: State<Estado>) -> Info {
    let k = leer_clave(&e);
    Info {
        tiene_clave: k.is_some(),
        desbloqueada: e.firma.lock().map(|f| f.is_some()).unwrap_or(false),
        publica: k.map(|k| k.publica).unwrap_or_default(),
        carpeta: e.carpeta.to_string_lossy().into_owned(),
    }
}

#[tauri::command]
fn crear_clave(e: State<Estado>, contrasena: String) -> Result<Info, String> {
    if leer_clave(&e).is_some() {
        return Err("Ya hay una clave creada en esta computadora.".into());
    }
    if contrasena.chars().count() < 8 {
        return Err("La contraseña debe tener al menos 8 caracteres.".into());
    }
    let (archivo, sk) = clave::crear(&contrasena)?;
    std::fs::write(e.archivo_clave(), serde_json::to_string_pretty(&archivo).unwrap()).map_err(|x| x.to_string())?;
    *e.firma.lock().unwrap() = Some(sk);
    Ok(info(e))
}

#[tauri::command]
fn desbloquear(e: State<Estado>, contrasena: String) -> Result<Info, String> {
    let k = leer_clave(&e).ok_or("Todavía no hay clave en esta computadora.")?;
    let sk = clave::abrir(&k, &contrasena)?;
    *e.firma.lock().unwrap() = Some(sk);
    Ok(info(e))
}

#[tauri::command]
fn bloquear(e: State<Estado>) {
    *e.firma.lock().unwrap() = None;
}

#[derive(Serialize, serde::Deserialize, Clone)]
struct Emitida {
    fecha: String,
    cliente: String,
    rif: String,
    plan: String,
    equipo: String,
    vence: String,
    telefono: String,
    licencia: String,
}

#[tauri::command]
fn emitir(e: State<Estado>, cliente: String, rif: String, plan: String, equipo: String, vence: String, telefono: String) -> Result<String, String> {
    let guard = e.firma.lock().unwrap();
    let sk = guard.as_ref().ok_or("Desbloquea la app con tu contraseña.")?;
    let datos = Datos::nuevos(&cliente, &rif, &plan, &equipo, &vence)?;
    let lic = clave::firmar(sk, &datos);
    drop(guard);
    let mut h = historial(e.clone());
    h.insert(0, Emitida {
        fecha: chrono::Local::now().format("%Y-%m-%d %H:%M").to_string(),
        cliente: datos.cliente, rif: datos.rif, plan: datos.plan, equipo: datos.equipo, vence: datos.vence,
        telefono: telefono.trim().to_string(), licencia: lic.clone(),
    });
    std::fs::write(e.archivo_historial(), serde_json::to_string_pretty(&h).unwrap()).map_err(|x| x.to_string())?;
    Ok(lic)
}

#[tauri::command]
fn historial(e: State<Estado>) -> Vec<Emitida> {
    std::fs::read_to_string(e.archivo_historial()).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

/// Copia la clave cifrada (y el historial) a otra carpeta: sin respaldo, si
/// se daña esta computadora no se pueden emitir más licencias de Cumbre.
#[tauri::command]
fn respaldar(e: State<Estado>, carpeta: String) -> Result<String, String> {
    let destino = PathBuf::from(carpeta).join("Apex Licencias - respaldo");
    std::fs::create_dir_all(&destino).map_err(|x| x.to_string())?;
    std::fs::copy(e.archivo_clave(), destino.join("clave-apex.json")).map_err(|_| "Todavía no hay clave para respaldar.".to_string())?;
    let _ = std::fs::copy(e.archivo_historial(), destino.join("historial.json"));
    Ok(destino.to_string_lossy().into_owned())
}

/// Trae una clave respaldada (por ejemplo, en una computadora nueva).
#[tauri::command]
fn restaurar(e: State<Estado>, archivo: String, contrasena: String) -> Result<Info, String> {
    let t = std::fs::read_to_string(&archivo).map_err(|x| x.to_string())?;
    let k: ArchivoClave = serde_json::from_str(&t).map_err(|_| "Ese archivo no es una clave de Apex Licencias.")?;
    let sk = clave::abrir(&k, &contrasena)?;
    if leer_clave(&e).map(|x| x.publica != k.publica).unwrap_or(false) {
        return Err("Ya hay otra clave en esta computadora. No se reemplaza para no perder licencias.".into());
    }
    std::fs::write(e.archivo_clave(), t).map_err(|x| x.to_string())?;
    if let Some(h) = PathBuf::from(&archivo).parent().map(|p| p.join("historial.json")) {
        if h.exists() && !e.archivo_historial().exists() { let _ = std::fs::copy(h, e.archivo_historial()); }
    }
    *e.firma.lock().unwrap() = Some(sk);
    Ok(info(e))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let carpeta = app.path().app_data_dir().expect("sin carpeta de datos");
            std::fs::create_dir_all(&carpeta)?;
            app.manage(Estado { carpeta, firma: Mutex::new(None) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![info, crear_clave, desbloquear, bloquear, emitir, historial, respaldar, restaurar])
        .run(tauri::generate_context!())
        .expect("no se pudo iniciar Apex Licencias");
}
