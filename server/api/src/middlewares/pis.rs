use std::io::Error;

use bson::{doc, DateTime};

use crate::controllers::db;

pub async fn take_pis_timeslot(time: DateTime) -> Result<bool, Error> {

    let connection = db::get_pis_timeslots_client().await;

    let find_query= doc! {"time": time};
    let find = connection.find_one(find_query).await;

    match find {

        Ok(find_result) => {

            match find_result {

                Some(timeslot) => {

                    if timeslot.num_available <= 0 {
                        return Err(Error::new(std::io::ErrorKind::Other, "All slots for this time are taken"))
                    }

                    let query = doc! {"time": time};
                    let update = doc! {"$set": doc! {
                        "num_available": timeslot.num_available - 1
                    }};

                    let result = connection.update_one(query, update).await;

                    match result {

                        Ok(_update_result) => {
                            return Ok(true)
                        }

                        Err(_err) => {
                            return Err(Error::new(std::io::ErrorKind::Other, "couldn't update PIS timeslot"))
                        }

                    }
                    
                }
    
                None => {
                    return Err(Error::new(std::io::ErrorKind::Other, "PIS timeslot does not exist"))
                }
            }

        }

        Err(_err) => {
            return Err(Error::new(std::io::ErrorKind::Other, "some network occurred"))
        }

    }

}

pub async fn vacate_pis_timeslot(time: DateTime) -> Result<bool, Error> {

    let connection = db::get_pis_timeslots_client().await;

    let find_query= doc! {"time": time};
    let find = connection.find_one(find_query).await;

    match find {

        Ok(find_result) => {

            match find_result {

                Some(timeslot) => {

                    let query = doc! {"time": time};
                    let update = doc! {"$set": doc! {
                        "num_available": timeslot.num_available + 1
                    }};

                    let result = connection.update_one(query, update).await;

                    match result {

                        Ok(_update_result) => {
                            return Ok(true)
                        }

                        Err(_err) => {
                            return Err(Error::new(std::io::ErrorKind::Other, "couldn't update PIS timeslot"))
                        }

                    }
                    
                }
    
                None => {
                    return Err(Error::new(std::io::ErrorKind::Other, "PIS timeslot does not exist"))
                }
            }

        }

        Err(_err) => {
            return Err(Error::new(std::io::ErrorKind::Other, "some network occurred"))
        }

    }

}