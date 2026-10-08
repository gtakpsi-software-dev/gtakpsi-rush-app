use bson::DateTime;

use super::fixtures::{add_slot, capacity, reset, SLOT};
use crate::services::pis_capacity;

pub async fn check_contracts() {
    reset().await;
    let time = DateTime::parse_rfc3339_str(SLOT).unwrap();

    assert_eq!(
        pis_capacity::take_pis_timeslot(time)
            .await
            .unwrap_err()
            .to_string(),
        "PIS timeslot does not exist"
    );
    assert_eq!(
        pis_capacity::vacate_pis_timeslot(time)
            .await
            .unwrap_err()
            .to_string(),
        "PIS timeslot does not exist"
    );

    add_slot(SLOT, 0).await;
    assert_eq!(
        pis_capacity::take_pis_timeslot(time)
            .await
            .unwrap_err()
            .to_string(),
        "All slots for this time are taken"
    );
    assert_eq!(capacity(SLOT).await, 0);

    assert!(pis_capacity::vacate_pis_timeslot(time).await.unwrap());
    assert_eq!(capacity(SLOT).await, 1);
    assert!(pis_capacity::take_pis_timeslot(time).await.unwrap());
    assert_eq!(capacity(SLOT).await, 0);
}
