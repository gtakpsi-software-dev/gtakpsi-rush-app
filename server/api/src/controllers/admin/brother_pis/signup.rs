use crate::models::pis::{IncomingPISSignup, PISSignup};
use crate::models::rushee::RusheeModel;
use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, Document};
use mongodb::Collection;
use serde_json::{json, Value};

use super::slot_selection::{select_signup_slot, SignupSlot};

fn set_field_update(field: &str, value: &str) -> Document {
    let mut fields = Document::new();
    fields.insert(field, value);
    doc! { "$set": fields }
}

fn signup_updates(slot: SignupSlot, payload: &IncomingPISSignup) -> (Document, Document) {
    let (first_field, last_field) = slot.fields();
    (
        set_field_update(first_field, &payload.brother_first_name),
        set_field_update(last_field, &payload.brother_last_name),
    )
}

async fn write_signup(
    collection: &Collection<RusheeModel>,
    id: &str,
    payload: &IncomingPISSignup,
    slot: SignupSlot,
) -> Result<(), &'static str> {
    let (first_update, last_update) = signup_updates(slot, payload);

    // INVARIANT: these writes stay sequential; a failed last-name write leaves the first name set.
    if collection
        .update_one(doc! { "gtid": id }, first_update)
        .await
        .is_err()
    {
        return Err("Couldn't update the PIS Signup for first name");
    }
    if collection
        .update_one(doc! { "gtid": id }, last_update)
        .await
        .is_err()
    {
        return Err("Couldn't update the PIS Signup for last name");
    }
    Ok(())
}

pub async fn brother_pis_sign_up(
    Path(id): Path<String>,
    Json(payload): Json<IncomingPISSignup>,
) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rushee_client().await;
    let rushee = match collection.find_one(doc! { "gtid": id.clone() }).await {
        Ok(Some(rushee)) => rushee,
        Ok(None) => {
            return Ok(Json(json!({
                "status": "error",
                "message": format!("The rushee with GTID {} does not exist", id)
            })));
        }
        Err(_) => {
            return Ok(Json(json!({
                "status": "error",
                "message": "Couldn't access the MongoDB database"
            })));
        }
    };

    let signup: &PISSignup = &rushee.pis_signup;
    let slot = match select_signup_slot(signup, &payload) {
        Ok(slot) => slot,
        Err(message) => {
            return Ok(Json(json!({
                "status": "error",
                "message": message
            })));
        }
    };

    match write_signup(&collection, &id, &payload, slot).await {
        Ok(()) => Ok(Json(json!({
            "status": "success",
            "message": slot.success_message()
        }))),
        Err(message) => Ok(Json(json!({
            "status": "error",
            "message": message
        }))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signup_keeps_separate_untrimmed_first_and_last_name_updates() {
        let payload = IncomingPISSignup {
            brother_first_name: " Alex ".to_string(),
            brother_last_name: " Brother ".to_string(),
        };
        let (first, last) = signup_updates(SignupSlot::First, &payload);
        assert_eq!(
            first,
            doc! { "$set": { "pis_signup.first_brother_first_name": " Alex " } }
        );
        assert_eq!(
            last,
            doc! { "$set": { "pis_signup.first_brother_last_name": " Brother " } }
        );

        let (first, last) = signup_updates(SignupSlot::Second, &payload);
        assert_eq!(
            first,
            doc! { "$set": { "pis_signup.second_brother_first_name": " Alex " } }
        );
        assert_eq!(
            last,
            doc! { "$set": { "pis_signup.second_brother_last_name": " Brother " } }
        );
    }
}
