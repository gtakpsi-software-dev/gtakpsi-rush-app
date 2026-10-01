use crate::controllers::db;
use crate::models::pis::{IncomingPISSignup, PISSignup};
use crate::models::rushee::RusheeModel;
use axum::{extract::Path, http::StatusCode, response::Json};
use mongodb::bson::{doc, Document};
use mongodb::Collection;
use serde_json::{json, Value};

#[derive(Clone, Copy)]
enum SignupSlot {
    First,
    Second,
}

impl SignupSlot {
    fn fields(self) -> (&'static str, &'static str) {
        match self {
            Self::First => (
                "pis_signup.first_brother_first_name",
                "pis_signup.first_brother_last_name",
            ),
            Self::Second => (
                "pis_signup.second_brother_first_name",
                "pis_signup.second_brother_last_name",
            ),
        }
    }

    fn success_message(self) -> &'static str {
        match self {
            Self::First => "Successfully registered!",
            Self::Second => "Successfully registered for PIS!",
        }
    }
}

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
    let slot = if signup.first_brother_first_name == "none"
        && signup.first_brother_last_name == "none"
    {
        SignupSlot::First
    } else if signup.second_brother_first_name == "none"
        && signup.second_brother_last_name == "none"
    {
        if signup.first_brother_first_name == payload.brother_first_name
            && signup.first_brother_last_name == payload.brother_last_name
        {
            return Ok(Json(json!({
                "status": "error",
                "message": format!("Brother {} {} has already registered for this PIS.", payload.brother_first_name, payload.brother_last_name)
            })));
        }
        SignupSlot::Second
    } else {
        return Ok(Json(json!({
            "status": "error",
            "message": format!("Two brothers ({} {} and {} {}) are already signed up",
                signup.first_brother_first_name,
                signup.first_brother_last_name,
                signup.second_brother_first_name,
                signup.second_brother_last_name)
        })));
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
