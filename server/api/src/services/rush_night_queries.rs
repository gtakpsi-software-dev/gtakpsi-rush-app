use mongodb::bson::doc;
use std::io::Error;

use crate::models::rush_nights::RushNight;
use crate::storage::{cursor_rows::collect_strict_rows, db};

// Load all rush nights, returning an error if the query or any row fails.
pub async fn get_rush_nights() -> Result<Vec<RushNight>, Error> {
    let connection = db::get_rush_nights_collection().await;
    let cursor = connection
        .find(doc! {})
        .await
        .map_err(|_| Error::other("some error occurred"))?;
    collect_strict_rows(cursor)
        .await
        .map_err(|_| Error::other("some error occurred"))
}

// Load rush nights and merge missing default nights in chronological order.
pub async fn get_rush_nights_sorted() -> Result<Vec<RushNight>, Error> {
    let nights = get_rush_nights().await?;
    Ok(crate::services::rush_nights::merge_rush_nights(
        &nights,
        &[],
    ))
}
