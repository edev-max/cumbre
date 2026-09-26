//! Tasa oficial del BCV.
//!
//! 1. Se lee la página principal del BCV (bcv.org.ve): el dólar está en
//!    `<div id="dolar"> … <strong> 36,50370000 </strong>` y la "Fecha Valor"
//!    dice desde cuándo rige (el BCV publica en la tarde la del día hábil
//!    siguiente). La lectura es tolerante: si no está el bloque "dolar", busca
//!    el número junto a "USD".
//! 2. Si el BCV no responde o su página no trae la tasa, se consulta una
//!    segunda fuente que replica la tasa oficial (ve.dolarapi.com).
//! 3. Si ambas fallan, lo que respondió el BCV se guarda en
//!    `bcv-respuesta.html` (carpeta de datos de Cumbre) para ajustar el lector.

use crate::Estado;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::State;

#[derive(Serialize, Debug, PartialEq)]
pub struct Tasa {
    pub valor: f64,
    /// fecha desde la que rige, AAAA-MM-DD (vacía si la fuente no la trae)
    pub fecha: String,
    /// "bcv" o "dolarapi"
    pub fuente: String,
}

fn numero(t: &str) -> Option<f64> {
    let t: String = t.chars().filter(|c| c.is_ascii_digit() || *c == ',' || *c == '.').collect();
    let n = if t.contains(',') { t.replace('.', "").replace(',', ".") } else { t };
    n.parse::<f64>().ok().filter(|v| *v >= 1.0 && *v < 1.0e8)
}

/// texto de la primera etiqueta <strong …>…</strong> dentro de `s`, sin etiquetas internas
fn primer_strong(s: &str, s_min: &str) -> Option<String> {
    let a = s_min.find("<strong")?;
    let a = a + s_min[a..].find('>')? + 1;
    let b = a + s_min[a..].find("</strong")?;
    let mut t = String::new();
    let mut dentro = false;
    for c in s[a..b].chars() {
        match c { '<' => dentro = true, '>' => dentro = false, _ if !dentro => t.push(c), _ => {} }
    }
    Some(t)
}

pub fn leer(html: &str) -> Option<Tasa> {
    // minúsculas ASCII: conserva las posiciones de cada byte
    let min = html.to_ascii_lowercase();
    let mut valor = None;
    for marca in ["id=\"dolar\"", "id='dolar'", "id=dolar"] {
        if let Some(i) = min.find(marca) {
            let fin = (i + 3000).min(html.len());
            let fin = (fin..=html.len()).find(|&k| html.is_char_boundary(k)).unwrap_or(html.len());
            valor = primer_strong(&html[i..fin], &min[i..fin]).and_then(|t| numero(&t));
            if valor.is_some() { break; }
        }
    }
    if valor.is_none() {
        // respaldo: el número en negrita que sigue a "USD"
        let mut desde = 0;
        while let Some(k) = min[desde..].find("usd") {
            let i = desde + k;
            let fin = (i + 800).min(html.len());
            let fin = (fin..=html.len()).find(|&k| html.is_char_boundary(k)).unwrap_or(html.len());
            if let Some(v) = primer_strong(&html[i..fin], &min[i..fin]).and_then(|t| numero(&t)) { valor = Some(v); break; }
            desde = i + 3;
        }
    }
    let valor = valor?;
    // la fecha valor: content="2026-09-29T00:00:00-04:00" después de "Fecha Valor"
    let fecha = min
        .find("fecha valor")
        .and_then(|j| min[j..].find("content=").map(|k| j + k + 8))
        .map(|k| html[k..].trim_start_matches(['"', '\'']).to_string())
        .filter(|r| r.len() >= 10 && r.as_bytes()[4] == b'-' && r.as_bytes()[7] == b'-')
        .map(|r| r[..10].to_string())
        .unwrap_or_default();
    Some(Tasa { valor, fecha, fuente: "bcv".into() })
}

/// segunda fuente (JSON): toma "promedio", o si no "venta"/"compra"
pub fn leer_json(texto: &str) -> Option<Tasa> {
    let v: serde_json::Value = serde_json::from_str(texto).ok()?;
    let v = if v.is_array() { v.as_array()?.iter().find(|x| x.to_string().to_lowercase().contains("oficial"))?.clone() } else { v };
    let valor = ["promedio", "venta", "compra", "price"].iter().find_map(|k| v.get(*k).and_then(|x| x.as_f64())).filter(|x| *x >= 1.0 && *x < 1.0e8)?;
    Some(Tasa { valor, fecha: String::new(), fuente: "dolarapi".into() })
}

fn agente() -> Result<ureq::Agent, String> {
    let tls = native_tls::TlsConnector::new().map_err(|e| e.to_string())?;
    Ok(ureq::AgentBuilder::new()
        .tls_connector(Arc::new(tls))
        .timeout(Duration::from_secs(25))
        // como un navegador: algunas páginas no le responden igual a un programa desconocido
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36")
        .build())
}

fn bajar(a: &ureq::Agent, url: &str, acepta: &str) -> Result<String, String> {
    a.get(url)
        .set("Accept", acepta)
        .set("Accept-Language", "es-VE,es;q=0.9")
        .call()
        .map_err(|e| e.to_string())?
        .into_string()
        .map_err(|e| e.to_string())
}

fn titulo(html: &str) -> String {
    let min = html.to_ascii_lowercase();
    min.find("<title").and_then(|a| {
        let a = a + min[a..].find('>')? + 1;
        let b = a + min[a..].find("</title")?;
        Some(html[a..b].trim().chars().take(80).collect::<String>())
    }).unwrap_or_default()
}

fn consultar(carpeta: PathBuf) -> Result<Tasa, String> {
    let a = agente()?;
    let html = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    let mut detalle;
    match bajar(&a, "https://www.bcv.org.ve/", html) {
        Ok(pagina) => {
            if let Some(t) = leer(&pagina) { return Ok(t); }
            let _ = std::fs::write(carpeta.join("bcv-respuesta.html"), &pagina);
            detalle = format!("el BCV respondió \"{}\" ({} KB) sin la tasa", titulo(&pagina), pagina.len() / 1024);
        }
        Err(e) => detalle = format!("el BCV no respondió ({e})"),
    }
    match bajar(&a, "https://ve.dolarapi.com/v1/dolares/oficial", "application/json") {
        Ok(j) => {
            if let Some(t) = leer_json(&j) { return Ok(t); }
            detalle.push_str("; la segunda fuente no trajo la tasa");
        }
        Err(e) => detalle.push_str(&format!("; la segunda fuente no respondió ({e})")),
    }
    let archivo = carpeta.join("bcv-respuesta.html");
    Err(format!(
        "No se pudo traer la tasa: {detalle}.{} Mientras tanto, escríbela a mano.",
        if archivo.exists() { format!(" Guardé la respuesta del BCV en {} para revisarla.", archivo.display()) } else { String::new() }
    ))
}

#[tauri::command]
pub async fn tasa_bcv(estado: State<'_, Estado>) -> Result<Tasa, String> {
    let carpeta = estado.carpeta.clone();
    tauri::async_runtime::spawn_blocking(move || consultar(carpeta)).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod pruebas {
    use super::*;

    // copia reducida de la estructura de bcv.org.ve
    const MUESTRA: &str = r#"
      <div id="euro" class="col-sm-12 col-xs-12 "><div class="field-content"><div class="row recuadrotsmc">
        <div class="col-sm-6 col-xs-6"><span> EUR </span></div><div class="col-sm-6 col-xs-6 centrado"><strong> 42,11220000 </strong></div></div></div></div>
      <div id="dolar" class="col-sm-12 col-xs-12 "><div class="field-content"><div class="row recuadrotsmc">
        <div class="col-sm-6 col-xs-6"><img src="/sites/all/themes/bcv/images/usa.png"><span> USD</span></div>
        <div class="col-sm-6 col-xs-6 centrado"><strong> 150,25370000 </strong></div></div></div></div>
      <div class="pull-right dinpro center">Fecha Valor:&nbsp; <span class="date-display-single" property="dc:date"
        datatype="xsd:dateTime" content="2026-09-29T00:00:00-04:00">Martes, 29 Septiembre  2026</span></div>"#;

    fn t(valor: f64, fecha: &str) -> Option<Tasa> { Some(Tasa { valor, fecha: fecha.into(), fuente: "bcv".into() }) }

    #[test]
    fn lee_dolar_y_fecha_valor() {
        assert_eq!(leer(MUESTRA), t(150.2537, "2026-09-29"));
    }
    #[test]
    fn tolera_variantes() {
        // comillas simples, mayúsculas, atributos en <strong> y etiquetas dentro
        let v = MUESTRA.replace("id=\"dolar\"", "ID='dolar'").replace("<strong> 150,25370000 </strong>", "<STRONG class=\"x\"><span> 150,25370000</span> </STRONG>");
        assert_eq!(leer(&v).map(|x| x.valor), Some(150.2537));
        // sin bloque "dolar": el número en negrita después de USD
        let sin_id = MUESTRA.replace("id=\"dolar\"", "id=\"moneda2\"");
        assert_eq!(leer(&sin_id).map(|x| x.valor), Some(150.2537));
        // acentos antes del bloque no rompen las posiciones
        let con_acentos = format!("<p>Información económica — año</p>{MUESTRA}");
        assert_eq!(leer(&con_acentos), t(150.2537, "2026-09-29"));
    }
    #[test]
    fn formatos_de_numero() {
        assert_eq!(numero(" 36,50370000 "), Some(36.5037));
        assert_eq!(numero("1.234,50"), Some(1234.5));
        assert_eq!(numero("36.5037"), Some(36.5037));
        assert_eq!(numero("Bs. 36,50"), Some(36.5));
        assert_eq!(numero("abc"), None);
        assert_eq!(numero("0"), None);
    }
    #[test]
    fn no_inventa() {
        assert_eq!(leer("<html><title>Verificando…</title>Espere un momento</html>"), None);
        assert_eq!(titulo("<html><head><TITLE> Banco Central </TITLE>"), "Banco Central");
    }
    #[test]
    fn segunda_fuente() {
        let j = r#"{"fuente":"oficial","nombre":"Oficial","compra":null,"venta":null,"promedio":150.25,"fechaActualizacion":"2026-09-26T16:00:00-04:00"}"#;
        assert_eq!(leer_json(j).map(|x| (x.valor, x.fuente)), Some((150.25, "dolarapi".to_string())));
        assert_eq!(leer_json(r#"[{"fuente":"paralelo","promedio":200.0},{"fuente":"oficial","promedio":150.25}]"#).map(|x| x.valor), Some(150.25));
        assert_eq!(leer_json(r#"{"error":"x"}"#), None);
    }
}
