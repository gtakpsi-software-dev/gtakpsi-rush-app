use futures::stream::StreamExt;
use mongodb::bson::doc;
use std::io::Error;

use crate::models::misc::RushNight;
use crate::storage::db;

pub async fn get_rush_nights() -> Result<Vec<RushNight>, Error> {
    let mut answer = Vec::<RushNight>::new();

    let connection = db::get_rush_nights_client().await;

    let result = connection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            while let Some(night) = cursor.next().await {
                match night {
                    Ok(x) => answer.push(x),
                    Err(_err) => return Err(Error::other("some error occurred")),
                }
            }

            return Ok(answer);
        }

        Err(_err) => Err(Error::other("some error occurred")),
    }
}

pub async fn get_rush_nights_sorted() -> Result<Vec<RushNight>, Error> {
    let nights = get_rush_nights().await?;
    Ok(crate::services::rush_nights::merge_rush_nights(
        &nights,
        &[],
    ))
}
