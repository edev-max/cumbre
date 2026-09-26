//! SQLite local. Una sola conexión protegida por un Mutex: Cumbre es de un
//! solo puesto, así que no hace falta más. Las escrituras pasan por la
//! licencia; las lecturas siempre se permiten (nunca se secuestra la
//! información del cliente).

use crate::{licencia, Estado};
use rusqlite::{types::Value as SqlValor, Connection, OpenFlags};
use serde::Deserialize;
use serde_json::{Map, Number, Value};
use std::path::Path;
use tauri::State;

pub fn abrir(ruta: &Path) -> rusqlite::Result<Connection> {
    let c = Connection::open_with_flags(ruta, OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE)?;
    c.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;")?;
    Ok(c)
}

fn a_sql(v: &Value) -> SqlValor {
    match v {
        Value::Null => SqlValor::Null,
        Value::Bool(b) => SqlValor::Integer(*b as i64),
        Value::Number(n) => match n.as_i64() {
            Some(i) => SqlValor::Integer(i),
            None => SqlValor::Real(n.as_f64().unwrap_or(0.0)),
        },
        Value::String(s) => SqlValor::Text(s.clone()),
        otro => SqlValor::Text(otro.to_string()),
    }
}

fn a_json(v: rusqlite::types::ValueRef) -> Value {
    use rusqlite::types::ValueRef::*;
    match v {
        Null => Value::Null,
        Integer(i) => Value::Number(i.into()),
        Real(f) => Number::from_f64(f).map(Value::Number).unwrap_or(Value::Null),
        Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
        Blob(b) => Value::Array(b.iter().map(|x| Value::Number((*x).into())).collect()),
    }
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn puede_escribir(e: &Estado) -> Result<(), String> {
    let info = licencia::estado_actual(&e.carpeta);
    if info.escribir {
        Ok(())
    } else {
        Err(format!(
            "La licencia de Cumbre {}. Puedes consultar tu información, pero no registrar movimientos. Actívala en Configuración → Licencia.",
            if info.estado == "vencida" { "venció" } else { "no está activa" }
        ))
    }
}

#[tauri::command]
pub fn db_select(estado: State<Estado>, sql: String, params: Vec<Value>) -> Result<Vec<Map<String, Value>>, String> {
    let c = estado.db.lock().map_err(err)?;
    let mut st = c.prepare(&sql).map_err(err)?;
    let nombres: Vec<String> = st.column_names().iter().map(|s| s.to_string()).collect();
    let ps: Vec<SqlValor> = params.iter().map(a_sql).collect();
    let mut filas = st.query(rusqlite::params_from_iter(ps.iter())).map_err(err)?;
    let mut out = Vec::new();
    while let Some(f) = filas.next().map_err(err)? {
        let mut m = Map::new();
        for (i, n) in nombres.iter().enumerate() {
            m.insert(n.clone(), a_json(f.get_ref(i).map_err(err)?));
        }
        out.push(m);
    }
    Ok(out)
}

#[tauri::command]
pub fn db_execute(estado: State<Estado>, sql: String, params: Vec<Value>) -> Result<usize, String> {
    puede_escribir(&estado)?;
    let c = estado.db.lock().map_err(err)?;
    let ps: Vec<SqlValor> = params.iter().map(a_sql).collect();
    c.execute(&sql, rusqlite::params_from_iter(ps.iter())).map_err(err)
}

/// Sólo para migraciones de esquema: se permite aunque la licencia no esté
/// activa, para que la base siempre pueda abrirse con la versión instalada.
#[tauri::command]
pub fn db_script(estado: State<Estado>, sql: String) -> Result<(), String> {
    let c = estado.db.lock().map_err(err)?;
    c.execute_batch(&sql).map_err(err)
}

#[derive(Deserialize)]
pub struct Sentencia {
    sql: String,
    #[serde(default)]
    params: Vec<Value>,
}

/// Varias sentencias en una transacción: entran todas o ninguna.
#[tauri::command]
pub fn db_batch(estado: State<Estado>, sentencias: Vec<Sentencia>) -> Result<(), String> {
    puede_escribir(&estado)?;
    let mut c = estado.db.lock().map_err(err)?;
    let tx = c.transaction().map_err(err)?;
    for s in &sentencias {
        let ps: Vec<SqlValor> = s.params.iter().map(a_sql).collect();
        tx.execute(&s.sql, rusqlite::params_from_iter(ps.iter())).map_err(|e| format!("{e} · {}", s.sql.lines().next().unwrap_or("")))?;
    }
    tx.commit().map_err(err)
}

/// Copia consistente de la base (API de respaldo de SQLite).
#[tauri::command]
pub fn db_exportar(estado: State<Estado>) -> Result<Vec<u8>, String> {
    let c = estado.db.lock().map_err(err)?;
    let tmp = estado.carpeta.join("respaldo.tmp");
    let _ = std::fs::remove_file(&tmp);
    {
        let mut destino = Connection::open(&tmp).map_err(err)?;
        let b = rusqlite::backup::Backup::new(&c, &mut destino).map_err(err)?;
        b.run_to_completion(256, std::time::Duration::from_millis(0), None).map_err(err)?;
    }
    let datos = std::fs::read(&tmp).map_err(err)?;
    let _ = std::fs::remove_file(&tmp);
    Ok(datos)
}

/// Restaura un respaldo: se valida que sea SQLite y se copia encima.
#[tauri::command]
pub fn db_importar(estado: State<Estado>, datos: Vec<u8>) -> Result<(), String> {
    if datos.len() < 100 || &datos[..15] != b"SQLite format 3" {
        return Err("Ese archivo no es un respaldo de Cumbre.".into());
    }
    let tmp = estado.carpeta.join("restaurar.tmp");
    std::fs::write(&tmp, &datos).map_err(err)?;
    let origen = Connection::open(&tmp).map_err(err)?;
    let mut c = estado.db.lock().map_err(err)?;
    {
        let b = rusqlite::backup::Backup::new(&origen, &mut c).map_err(err)?;
        b.run_to_completion(256, std::time::Duration::from_millis(0), None).map_err(err)?;
    }
    drop(origen);
    let _ = std::fs::remove_file(&tmp);
    Ok(())
}
