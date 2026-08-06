use postgres::{Client, NoTls};

fn main() {
    let conn_str = "host=localhost user=postgres password=admin123 dbname=axion connect_timeout=3";
    match Client::connect(conn_str, NoTls) {
        Ok(_) => println!("Success!"),
        Err(e) => println!("Error: {}", e),
    }
}
