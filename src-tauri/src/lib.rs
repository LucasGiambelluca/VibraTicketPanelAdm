//! Núcleo de la app desktop VibraTickets Admin (Tauri v2).

mod boca;
mod printer;
mod secure;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            printer::list_printers,
            printer::print_test,
            printer::print_ticket,
            boca::boca_status,
            boca::boca_print,
            boca::boca_test,
            secure::secure_set,
            secure::secure_get,
            secure::secure_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
