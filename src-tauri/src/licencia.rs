//! Licencias de Cumbre, verificadas sin internet.
//!
//! Formato: `CUMBRE-<datos>.<firma>`, ambos en base64url. `datos` es un JSON
//! con cliente, RIF, plan, código de equipo y vencimiento; `firma` es la firma
//! Ed25519 de `datos` hecha con la clave privada de Apex (tools/licencias.mjs).
//! Aquí sólo vive la clave pública: con ella se verifica, pero no se puede
//! fabricar una licencia.
//!
//! Sin licencia, Cumbre corre de prueba durante DIAS_PRUEBA días desde la
//! instalación. Con la licencia vencida hay DIAS_GRACIA días de gracia. Pasado
//! eso queda en sólo lectura: la información se consulta pero no se registra.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
use chrono::{Local, NaiveDate};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;
use tauri::State;

use crate::Estado;

const CLAVE_PUBLICA: &str = include_str!("../clave_publica.txt");
const DIAS_PRUEBA: i64 = 15;
const DIAS_GRACIA: i64 = 7;

#[derive(Deserialize, Serialize, Clone, Default)]
pub struct Datos {
    #[serde(default)]
    pub v: u32,
    pub cliente: String,
    #[serde(default)]
    pub rif: String,
    #[serde(default)]
    pub plan: String,
    pub equipo: String,
    #[serde(default)]
    pub emitida: String,
    pub vence: String,
}

#[derive(Serialize, Clone)]
pub struct Info {
    pub estado: String, // activa, demo, vencida, invalida
    pub cliente: String,
    pub rif: String,
    pub plan: String,
    pub vence: String,
    pub equipo: String,
    pub dias_gracia: i64,
    pub dias_prueba: i64,
    pub escribir: bool,
    pub motivo: String,
}

/// Huella del equipo: identificador de la máquina pasado por SHA-256.
pub fn equipo() -> String {
    let id = machine_uid::get().unwrap_or_else(|_| "sin-id".into());
    let h = Sha256::digest(format!("cumbre:{id}").as_bytes());
    let hex: String = h.iter().take(8).map(|b| format!("{b:02X}")).collect();
    hex.as_bytes().chunks(4).map(|c| std::str::from_utf8(c).unwrap()).collect::<Vec<_>>().join("-")
}

fn hoy() -> NaiveDate {
    Local::now().date_naive()
}

fn clave() -> Option<VerifyingKey> {
    let hex = CLAVE_PUBLICA.trim();
    if hex.len() != 64 {
        return None;
    }
    let mut b = [0u8; 32];
    for i in 0..32 {
        b[i] = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16).ok()?;
    }
    VerifyingKey::from_bytes(&b).ok()
}

/// Verifica la firma y devuelve los datos, o por qué no vale.
pub fn verificar(texto: &str, equipo_actual: &str) -> Result<Datos, String> {
    let k = clave().ok_or("Esta instalación no tiene la clave de Apex configurada.")?;
    verificar_con(texto, equipo_actual, &k)
}

fn verificar_con(texto: &str, equipo_actual: &str, k: &VerifyingKey) -> Result<Datos, String> {
    let t = texto.trim().trim_start_matches("CUMBRE-");
    let (datos_b64, firma_b64) = t.split_once('.').ok_or("La licencia está incompleta.")?;
    let firma = B64.decode(firma_b64.trim()).map_err(|_| "La licencia está dañada.")?;
    let firma = Signature::from_slice(&firma).map_err(|_| "La licencia está dañada.")?;
    k.verify(datos_b64.trim().as_bytes(), &firma).map_err(|_| "La licencia no es válida.")?;
    let json = B64.decode(datos_b64.trim()).map_err(|_| "La licencia está dañada.")?;
    let d: Datos = serde_json::from_slice(&json).map_err(|_| "La licencia está dañada.")?;
    if !d.equipo.eq_ignore_ascii_case(equipo_actual) {
        return Err("Esta licencia es de otro equipo.".into());
    }
    Ok(d)
}

pub fn registrar_inicio(carpeta: &Path) {
    let f = carpeta.join("inicio.txt");
    if !f.exists() {
        let _ = std::fs::write(f, hoy().to_string());
    }
}

pub fn estado_actual(carpeta: &Path) -> Info {
    let eq = equipo();
    let mut info = Info {
        estado: "demo".into(), cliente: String::new(), rif: String::new(), plan: String::new(), vence: String::new(),
        equipo: eq.clone(), dias_gracia: 0, dias_prueba: 0, escribir: false, motivo: String::new(),
    };
    if let Ok(texto) = std::fs::read_to_string(carpeta.join("licencia.txt")) {
        match verificar(&texto, &eq) {
            Ok(d) => {
                info.cliente = d.cliente; info.rif = d.rif; info.plan = d.plan; info.vence = d.vence.clone();
                let vence = NaiveDate::parse_from_str(&d.vence, "%Y-%m-%d").unwrap_or(hoy());
                let atraso = (hoy() - vence).num_days();
                if atraso <= 0 {
                    info.estado = "activa".into(); info.escribir = true;
                } else if atraso <= DIAS_GRACIA {
                    info.estado = "activa".into(); info.escribir = true; info.dias_gracia = DIAS_GRACIA - atraso;
                } else {
                    info.estado = "vencida".into();
                }
                return info;
            }
            Err(m) => { info.estado = "invalida".into(); info.motivo = m; }
        }
    }
    // período de prueba desde la instalación
    let inicio = std::fs::read_to_string(carpeta.join("inicio.txt")).ok()
        .and_then(|s| NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d").ok()).unwrap_or(hoy());
    let restan = DIAS_PRUEBA - (hoy() - inicio).num_days();
    info.dias_prueba = restan.max(0);
    info.escribir = restan > 0;
    info
}

#[tauri::command]
pub fn licencia_estado(estado: State<Estado>) -> Info {
    estado_actual(&estado.carpeta)
}

#[tauri::command]
pub fn licencia_activar(estado: State<Estado>, texto: String) -> Result<Info, String> {
    verificar(&texto, &equipo())?;
    std::fs::write(estado.carpeta.join("licencia.txt"), texto.trim()).map_err(|e| e.to_string())?;
    Ok(estado_actual(&estado.carpeta))
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn rechaza_basura() {
        assert!(verificar("CUMBRE-abc", "X").is_err());
        assert!(verificar("", "X").is_err());
    }

    #[test]
    fn firma_ida_y_vuelta() {
        use ed25519_dalek::{Signer, SigningKey};
        let sk = SigningKey::from_bytes(&[7u8; 32]);
        let datos = B64.encode(br#"{"v":1,"cliente":"Bodega de prueba","equipo":"AAAA-BBBB-CCCC-DDDD","vence":"2099-12-31"}"#);
        let firma = B64.encode(sk.sign(datos.as_bytes()).to_bytes());
        let lic = format!("CUMBRE-{datos}.{firma}");
        let d = verificar_con(&lic, "aaaa-bbbb-cccc-dddd", &sk.verifying_key()).unwrap();
        assert_eq!(d.cliente, "Bodega de prueba");
        // otro equipo, o un solo carácter cambiado: no vale
        assert!(verificar_con(&lic, "AAAA-BBBB-CCCC-EEEE", &sk.verifying_key()).is_err());
        let falsos = B64.encode(br#"{"v":1,"cliente":"Otra bodega","equipo":"AAAA-BBBB-CCCC-DDDD","vence":"2099-12-31"}"#);
        assert!(verificar_con(&format!("CUMBRE-{falsos}.{firma}"), "AAAA-BBBB-CCCC-DDDD", &sk.verifying_key()).is_err());
        let mut otra = datos.clone(); otra.push('A');
        assert!(verificar_con(&format!("CUMBRE-{otra}.{firma}"), "AAAA-BBBB-CCCC-DDDD", &sk.verifying_key()).is_err());
    }

    #[test]
    fn licencia_de_node() {
        // compatibilidad con tools/licencias.mjs: CUMBRE_LIC y CUMBRE_EQUIPO de prueba
        if let (Ok(l), Ok(e)) = (std::env::var("CUMBRE_LIC"), std::env::var("CUMBRE_EQUIPO")) {
            assert!(verificar(&l, &e).is_ok(), "{:?}", verificar(&l, &e).err());
        }
    }

    #[test]
    fn huella_con_formato() {
        let e = equipo();
        assert_eq!(e.len(), 19);
        assert_eq!(e.matches('-').count(), 3);
    }
}
