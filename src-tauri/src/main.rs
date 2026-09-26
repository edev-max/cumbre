// Sin consola en Windows al abrir la versión final
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cumbre_lib::run()
}
