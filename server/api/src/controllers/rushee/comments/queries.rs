use crate::storage::db;
use axum::{extract::Path, http::StatusCode, response::Json};
use futures::stream::StreamExt;
use mongodb::bson::doc;
use serde_json::{json, Value};

/// Returns all rushees where the given brother_name has commented, with rushee info and the brother's comment(s)
pub async fn get_brother_comments(
    Path(brother_name): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let collection = db::get_rushee_client().await;
    let result = collection.find(doc! {}).await;

    match result {
        Ok(mut cursor) => {
            let mut commented_rushees = Vec::new();
            while let Some(rushee_res) = cursor.next().await {
                if let Ok(rushee) = rushee_res {
                    // Find all comments by this brother on this rushee
                    let brother_comments: Vec<_> = rushee
                        .comments
                        .iter()
                        .filter(|c| c.brother_name == brother_name)
                        .cloned()
                        .collect();
                    if !brother_comments.is_empty() {
                        commented_rushees.push(serde_json::json!({
                            "rushee": {
                                "gtid": rushee.gtid,
                                "first_name": rushee.first_name,
                                "last_name": rushee.last_name,
                                "image_url": rushee.image_url,
                            },
                            "comments": brother_comments
                        }));
                    }
                }
            }
            Ok(Json(json!({
                "status": "success",
                "payload": commented_rushees
            })))
        }
        Err(_err) => Ok(Json(json!({
            "status": "error",
            "message": "some network error occurred"
        }))),
    }
}
