use bson::DateTime as BsonDateTime;
use chrono::{DateTime as ChronoDateTime, Utc};
use chrono_tz::Tz;
use once_cell::sync::Lazy;
use std::env;

static RUSH_TZ: Lazy<Tz> = Lazy::new(|| {
    env::var("RUSH_TIMEZONE")
        .ok()
        .and_then(|value| value.parse::<Tz>().ok())
        .unwrap_or(chrono_tz::America::New_York)
});

// Convert BSON milliseconds to UTC, falling back to the epoch for unsupported dates.
fn bson_to_utc_datetime(date: &BsonDateTime) -> ChronoDateTime<Utc> {
    // Keep the epoch fallback for BSON values outside Chrono's date range.
    ChronoDateTime::<Utc>::from_timestamp_millis(date.timestamp_millis())
        .unwrap_or_else(|| ChronoDateTime::<Utc>::from_timestamp(0, 0).unwrap())
}

// Parse an RFC 3339 timestamp, falling back to the epoch on invalid input.
pub fn string_to_bson_datetime(date_string: &str) -> BsonDateTime {
    BsonDateTime::parse_rfc3339_str(date_string)
        .unwrap_or_else(|_| BsonDateTime::parse_rfc3339_str("1970-01-01T00:00:00Z").unwrap())
}

// Compare calendar dates in the configured rush timezone.
pub fn same_day(date1: &BsonDateTime, date2: &BsonDateTime) -> bool {
    let date1_local = bson_to_utc_datetime(date1)
        .with_timezone(&*RUSH_TZ)
        .date_naive();
    let date2_local = bson_to_utc_datetime(date2)
        .with_timezone(&*RUSH_TZ)
        .date_naive();
    date1_local == date2_local
}

#[cfg(test)]
mod tests {
    use super::*;

    // Verify negative timestamps and the fallback for out-of-range dates.
    #[test]
    fn bson_conversion_preserves_signed_millis_and_epoch_fallback() {
        for millis in [-1, 0, 1, 1_780_000_000_123] {
            let converted = bson_to_utc_datetime(&BsonDateTime::from_millis(millis));
            assert_eq!(converted.timestamp_millis(), millis);
        }

        for millis in [i64::MIN, i64::MAX] {
            let converted = bson_to_utc_datetime(&BsonDateTime::from_millis(millis));
            assert_eq!(converted.timestamp_millis(), 0);
        }
    }
}
