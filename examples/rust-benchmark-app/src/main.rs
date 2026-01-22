use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::time::{sleep, Duration};

#[derive(Debug, Serialize, Deserialize)]
struct Payload {
    id: u32,
    label: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let payload = Payload {
        id: 42,
        label: "boringcache benchmark".to_string(),
    };

    let value: Value = json!({
        "id": payload.id,
        "label": payload.label,
    });

    let request = Client::new()
        .post("https://example.com/benchmark")
        .json(&value)
        .build()?;

    let method = request.method().clone();
    let uri = request.url().clone();
    let headers = request.headers().clone();

    // Small async pause to exercise tokio during build checks.
    sleep(Duration::from_millis(5)).await;

    println!(
        "Built benchmark app request: {} {} ({} headers)",
        method,
        uri,
        headers.len()
    );
    Ok(())
}
