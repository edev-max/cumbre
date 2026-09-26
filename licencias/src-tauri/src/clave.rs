//! La clave de Apex: creación, cifrado con contraseña y firma de licencias.

use argon2::Argon2;
use base64::{engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD as B64}, Engine};
use chacha20poly1305::{aead::{Aead, KeyInit}, ChaCha20Poly1305, Nonce};
use ed25519_dalek::{Signer, SigningKey};
use rand_core::{OsRng, RngCore};
use serde::{Deserialize, Serialize};
use zeroize::Zeroize;

#[derive(Serialize, Deserialize, Clone)]
pub struct ArchivoClave {
    pub v: u32,
    /// clave pública en hex: es la que va dentro del instalador de Cumbre
    pub publica: String,
    pub sal: String,
    pub nonce: String,
    pub cifrado: String,
}

fn derivar(contrasena: &str, sal: &[u8]) -> Result<[u8; 32], String> {
    let mut k = [0u8; 32];
    Argon2::default().hash_password_into(contrasena.as_bytes(), sal, &mut k).map_err(|e| e.to_string())?;
    Ok(k)
}

pub fn hex(b: &[u8]) -> String { b.iter().map(|x| format!("{x:02x}")).collect() }

pub fn crear(contrasena: &str) -> Result<(ArchivoClave, SigningKey), String> {
    let sk = SigningKey::generate(&mut OsRng);
    let mut sal = [0u8; 16];
    let mut nonce = [0u8; 12];
    OsRng.fill_bytes(&mut sal);
    OsRng.fill_bytes(&mut nonce);
    let mut k = derivar(contrasena, &sal)?;
    let cifrador = ChaCha20Poly1305::new((&k).into());
    let cifrado = cifrador.encrypt(Nonce::from_slice(&nonce), sk.to_bytes().as_ref()).map_err(|e| e.to_string())?;
    k.zeroize();
    Ok((ArchivoClave { v: 1, publica: hex(sk.verifying_key().as_bytes()), sal: STANDARD.encode(sal), nonce: STANDARD.encode(nonce), cifrado: STANDARD.encode(cifrado) }, sk))
}

pub fn abrir(a: &ArchivoClave, contrasena: &str) -> Result<SigningKey, String> {
    let sal = STANDARD.decode(&a.sal).map_err(|_| "La clave está dañada.")?;
    let nonce = STANDARD.decode(&a.nonce).map_err(|_| "La clave está dañada.")?;
    let cifrado = STANDARD.decode(&a.cifrado).map_err(|_| "La clave está dañada.")?;
    let mut k = derivar(contrasena, &sal)?;
    let mut plano = ChaCha20Poly1305::new((&k).into())
        .decrypt(Nonce::from_slice(&nonce), cifrado.as_ref())
        .map_err(|_| "Contraseña incorrecta.".to_string())?;
    k.zeroize();
    let bytes: [u8; 32] = plano.as_slice().try_into().map_err(|_| "La clave está dañada.")?;
    plano.zeroize();
    let sk = SigningKey::from_bytes(&bytes);
    if hex(sk.verifying_key().as_bytes()) != a.publica {
        return Err("La clave está dañada.".into());
    }
    Ok(sk)
}

/// Lo que va dentro de la licencia: mismos campos y nombres que lee Cumbre.
#[derive(Serialize, Clone)]
pub struct Datos {
    pub v: u32,
    pub cliente: String,
    pub rif: String,
    pub plan: String,
    pub equipo: String,
    pub emitida: String,
    pub vence: String,
}

impl Datos {
    pub fn nuevos(cliente: &str, rif: &str, plan: &str, equipo: &str, vence: &str) -> Result<Datos, String> {
        let cliente = cliente.trim();
        if cliente.is_empty() { return Err("Falta el nombre del cliente.".into()); }
        let equipo = equipo.trim().to_uppercase().replace(' ', "");
        let ok = equipo.len() == 19 && equipo.split('-').count() == 4
            && equipo.split('-').all(|g| g.len() == 4 && g.chars().all(|c| c.is_ascii_hexdigit()));
        if !ok { return Err("El código de equipo va así: ABCD-1234-EF56-7890 (está en Cumbre → Configuración → Licencia).".into()); }
        chrono::NaiveDate::parse_from_str(vence, "%Y-%m-%d").map_err(|_| "La fecha de vencimiento no es válida.")?;
        Ok(Datos {
            v: 1, cliente: cliente.into(), rif: rif.trim().into(),
            plan: if plan.trim().is_empty() { "Pyme".into() } else { plan.trim().into() },
            equipo, emitida: chrono::Local::now().format("%Y-%m-%d").to_string(), vence: vence.into(),
        })
    }
}

pub fn firmar(sk: &SigningKey, d: &Datos) -> String {
    let datos = B64.encode(serde_json::to_vec(d).unwrap());
    let firma = B64.encode(sk.sign(datos.as_bytes()).to_bytes());
    format!("CUMBRE-{datos}.{firma}")
}

#[cfg(test)]
mod pruebas {
    use super::*;
    use ed25519_dalek::{Signature, Verifier, VerifyingKey};

    #[test]
    fn crea_cifra_y_abre() {
        let (a, sk) = crear("una clave larga").unwrap();
        assert_eq!(abrir(&a, "una clave larga").unwrap().to_bytes(), sk.to_bytes());
        assert!(abrir(&a, "otra").is_err());
        assert!(!a.cifrado.is_empty() && a.publica.len() == 64);
    }

    #[test]
    fn valida_datos() {
        assert!(Datos::nuevos("", "", "", "ABCD-1234-EF56-7890", "2027-01-01").is_err());
        assert!(Datos::nuevos("Bodega", "", "", "ABCD-1234", "2027-01-01").is_err());
        assert!(Datos::nuevos("Bodega", "", "", "abcd-1234-ef56-7890", "2027-13-01").is_err());
        let d = Datos::nuevos(" Bodega ", "J-1", "", "abcd-1234-ef56-7890", "2027-01-01").unwrap();
        assert_eq!((d.cliente.as_str(), d.equipo.as_str(), d.plan.as_str()), ("Bodega", "ABCD-1234-EF56-7890", "Pyme"));
    }

    /// la verificación es la misma que hace Cumbre en src-tauri/src/licencia.rs
    #[test]
    fn cumbre_la_acepta() {
        let (a, sk) = crear("una clave larga").unwrap();
        let lic = firmar(&sk, &Datos::nuevos("Bodega La Esquina", "J-12345678-9", "Pyme", "ABCD-1234-EF56-7890", "2027-12-31").unwrap());
        let t = lic.trim_start_matches("CUMBRE-");
        let (d, f) = t.split_once('.').unwrap();
        let mut pk = [0u8; 32];
        for i in 0..32 { pk[i] = u8::from_str_radix(&a.publica[i * 2..i * 2 + 2], 16).unwrap(); }
        let firma = Signature::from_slice(&B64.decode(f).unwrap()).unwrap();
        VerifyingKey::from_bytes(&pk).unwrap().verify(d.as_bytes(), &firma).unwrap();
        let json: serde_json::Value = serde_json::from_slice(&B64.decode(d).unwrap()).unwrap();
        assert_eq!(json["equipo"], "ABCD-1234-EF56-7890");
        assert_eq!(json["vence"], "2027-12-31");
        if let Ok(ruta) = std::env::var("APEX_SALIDA") {
            std::fs::write(ruta, format!("{}\n{}\n", a.publica, lic)).unwrap();
        }
    }
}
