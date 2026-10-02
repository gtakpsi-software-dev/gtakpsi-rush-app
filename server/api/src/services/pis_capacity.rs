use std::io::Error;

use bson::{doc, DateTime};

use crate::storage::db;

enum CapacityChange {
    Take,
    Vacate,
}

pub async fn take_pis_timeslot(time: DateTime) -> Result<bool, Error> {
    change_pis_timeslot_capacity(time, CapacityChange::Take).await
}

pub async fn vacate_pis_timeslot(time: DateTime) -> Result<bool, Error> {
    change_pis_timeslot_capacity(time, CapacityChange::Vacate).await
}

async fn change_pis_timeslot_capacity(
    time: DateTime,
    change: CapacityChange,
) -> Result<bool, Error> {
    let connection = db::get_pis_timeslots_collection().await;
    let find_query = doc! {"time": time};
    let find = connection.find_one(find_query).await;

    match find {
        Ok(Some(timeslot)) => {
            if matches!(change, CapacityChange::Take) && timeslot.num_available <= 0 {
                return Err(Error::other("All slots for this time are taken"));
            }

            // Keep the read-then-set update to preserve existing reservation behavior.
            // An atomic increment would change how concurrent requests interact.
            let next_available = match change {
                CapacityChange::Take => timeslot.num_available - 1,
                CapacityChange::Vacate => timeslot.num_available + 1,
            };
            let query = doc! {"time": time};
            let update = doc! {"$set": doc! {"num_available": next_available}};

            match connection.update_one(query, update).await {
                Ok(_update_result) => Ok(true),
                Err(_err) => Err(Error::other("couldn't update PIS timeslot")),
            }
        }
        Ok(None) => Err(Error::other("PIS timeslot does not exist")),
        Err(_err) => Err(Error::other("some network occurred")),
    }
}
