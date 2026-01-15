use bson::DateTime as BsonDateTime;

pub fn string_to_bson_datetime(date_string: &str) -> BsonDateTime {
    BsonDateTime::parse_rfc3339_str(date_string).unwrap_or_else(|_| {
        BsonDateTime::parse_rfc3339_str("1970-01-01T00:00:00Z").unwrap()
    })
}

pub fn same_day(date1: &BsonDateTime, date2: &BsonDateTime) -> bool {
    // Extract the milliseconds since the UNIX epoch
    let millis1 = date1.timestamp_millis();
    let millis2 = date2.timestamp_millis();

    // Compute the number of days since the UNIX epoch for each date
    const MILLIS_PER_DAY: i64 = 24 * 60 * 60 * 1000;
    let days1 = millis1 / MILLIS_PER_DAY;
    let days2 = millis2 / MILLIS_PER_DAY;

    // Compare the days
    days1 == days2
}
