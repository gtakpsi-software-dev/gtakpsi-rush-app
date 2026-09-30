use super::*;

#[test]
fn averaging_accepts_the_closed_one_to_five_range_including_fractional_values() {
    for value in [1.0, 1.5, 3.0, 5.0] {
        assert!(is_modern_rating_value(value));
    }
    for value in [
        -1.0,
        0.0,
        0.99,
        5.01,
        f32::NAN,
        f32::INFINITY,
        f32::NEG_INFINITY,
    ] {
        assert!(!is_modern_rating_value(value));
    }
}
