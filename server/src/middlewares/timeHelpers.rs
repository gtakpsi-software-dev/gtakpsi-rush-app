use bson::DateTime as BsonDateTime;
use chrono::{DateTime as ChronoDateTime, NaiveDateTime, Utc};
use chrono_tz::Tz;
use once_cell::sync::Lazy;
use std::env;

static RUSH_TZ: Lazy<Tz> = Lazy::new(|| {
    env::var("RUSH_TIMEZONE")
        .ok()
        .and_then(|value| value.parse::<Tz>().ok())
        .unwrap_or(chrono_tz::America::New_York)
});

fn bson_to_utc_datetime(date: &BsonDateTime) -> ChronoDateTime<Utc> {
    let millis = date.timestamp_millis();
    let naive = NaiveDateTime::from_timestamp_millis(millis)
        .unwrap_or_else(|| NaiveDateTime::from_timestamp_opt(0, 0).unwrap());
    ChronoDateTime::<Utc>::from_utc(naive, Utc)
}

pub fn string_to_bson_datetime(date_string: &str) -> BsonDateTime {
    BsonDateTime::parse_rfc3339_str(date_string).unwrap_or_else(|_| {
        BsonDateTime::parse_rfc3339_str("1970-01-01T00:00:00Z").unwrap()
    })
}

pub fn same_day(date1: &BsonDateTime, date2: &BsonDateTime) -> bool {
    let date1_local = bson_to_utc_datetime(date1)
        .with_timezone(&*RUSH_TZ)
        .date_naive();
    let date2_local = bson_to_utc_datetime(date2)
        .with_timezone(&*RUSH_TZ)
        .date_naive();
    date1_local == date2_local
}
