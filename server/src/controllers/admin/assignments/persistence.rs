use mongodb::{bson::doc, Collection};

use super::planning::AssignmentPlan;
use crate::models::rushee::RusheeModel;

pub(super) async fn persist_assignment(
    collection: &Collection<RusheeModel>,
    rushee: &RusheeModel,
    plan: &AssignmentPlan,
) -> bool {
    let mut update_doc = doc! {};
    if let Some(first) = &plan.first {
        update_doc.insert("pis_signup.first_brother_first_name", first.0.trim());
        update_doc.insert("pis_signup.first_brother_last_name", first.1.trim());
    }
    if let Some(second) = &plan.second {
        update_doc.insert("pis_signup.second_brother_first_name", second.0.trim());
        update_doc.insert("pis_signup.second_brother_last_name", second.1.trim());
    }

    let filter = doc! { "gtid": &rushee.gtid };
    let update = doc! { "$set": update_doc };
    collection.update_one(filter, update).await.is_ok()
}
