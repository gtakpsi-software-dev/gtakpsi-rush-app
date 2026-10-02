use futures::stream::StreamExt;
use mongodb::bson::doc;
use std::io::Error;

use crate::controllers::db;
use crate::models::misc::RushNight;

pub async fn get_rush_nights() -> Result<Vec<RushNight>, Error> {
    let mut answer = Vec::<RushNight>::new();

    let connection = db::get_rush_nights_client().await;

    let result = connection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            while let Some(night) = cursor.next().await {
                match night {
                    Ok(x) => answer.push(x),
                    Err(_err) => {
                        return Err(Error::new(std::io::ErrorKind::Other, "some error occurred"))
                    }
                }
            }

            return Ok(answer);
        }

        Err(_err) => Err(Error::new(std::io::ErrorKind::Other, "some error occurred")),
    }
}

pub async fn get_rush_nights_sorted() -> Result<Vec<RushNight>, Error> {
    let nights = get_rush_nights().await?;
    Ok(crate::middlewares::rush_nights::merge_rush_nights(
        &nights,
        &[],
    ))
}
