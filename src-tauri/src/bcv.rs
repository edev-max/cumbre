//! Tasa oficial del BCV, leída de su página principal (bcv.org.ve).
//! La página trae el dólar en `<div id="dolar"> … <strong> 36,50370000 </strong>`
//! y la "Fecha Valor" desde la que rige (el BCV publica en la tarde la tasa
//! del día hábil siguiente). Si el BCV cambia su página, sólo hay que tocar
//! `leer`, que tiene su prueba con una copia de esa estructura.

use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;

#[derive(Serialize, Debug, PartialEq)]
pub struct Tasa {
    pub valor: f64,
    /// fecha desde la que rige, AAAA-MM-DD (vacía si la página no la trae)
    pub fecha: String,
}

fn numero(t: &str) -> Option<f64> {
    let t = t.trim();
    let n = if t.contains(',') { t.replace('.', "").replace(',', ".") } else { t.to_string() };
    n.parse::<f64>().ok().filter(|v| *v > 0.0 && *v < 1.0e9)
}

pub fn leer(html: &str) -> Option<Tasa> {
    let i = html.find("id=\"dolar\"")?;
    let resto = &html[i..];
    let a = resto.find("<strong>")? + "<strong>".len();
    let b = a + resto[a..].find("</strong>")?;
    let valor = numero(&resto[a..b])?;
    // la fecha valor viene como content="2026-09-29T00:00:00-04:00"
    let fecha = html
        .find("Fecha Valor")
        .map(|j| &html[j..])
        .and_then(|r| r.find("content=\"").map(|k| &r[k + 9..]))
        .filter(|r| r.len() >= 10 && r.as_bytes()[4] == b'-' && r.as_bytes()[7] == b'-')
        .map(|r| r[..10].to_string())
        .unwrap_or_default();
    Some(Tasa { valor, fecha })
}

fn descargar() -> Result<String, String> {
    let tls = native_tls::TlsConnector::new().map_err(|e| e.to_string())?;
    let agente = ureq::AgentBuilder::new()
        .tls_connector(Arc::new(tls))
        .timeout(Duration::from_secs(20))
        .user_agent("Cumbre (Apex Consulting)")
        .build();
    agente
        .get("https://www.bcv.org.ve/")
        .call()
        .map_err(|e| format!("No se pudo consultar al BCV: {e}"))?
        .into_string()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tasa_bcv() -> Result<Tasa, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let html = descargar()?;
        leer(&html).ok_or_else(|| "La página del BCV cambió y no se encontró la tasa. Escríbela a mano mientras tanto.".to_string())
    })
    .await
    .map_err(|e| e.to_string())?
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

    #[test]
    fn lee_dolar_y_fecha_valor() {
        assert_eq!(leer(MUESTRA), Some(Tasa { valor: 150.2537, fecha: "2026-09-29".into() }));
    }
    #[test]
    fn formatos_de_numero() {
        assert_eq!(numero(" 36,50370000 "), Some(36.5037));
        assert_eq!(numero("1.234,50"), Some(1234.5));
        assert_eq!(numero("36.5037"), Some(36.5037));
        assert_eq!(numero("abc"), None);
        assert_eq!(numero("0"), None);
    }
    #[test]
    fn sin_dolar_no_inventa() {
        assert_eq!(leer("<html>mantenimiento</html>"), None);
    }
}
