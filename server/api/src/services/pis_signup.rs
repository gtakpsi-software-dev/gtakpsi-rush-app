use crate::models::pis::{IncomingPISSignup, PISSignup};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum SignupSlot {
    First,
    Second,
}

impl SignupSlot {
    pub(crate) fn fields(self) -> (&'static str, &'static str) {
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

    pub(crate) fn success_message(self) -> &'static str {
        match self {
            Self::First => "Successfully registered!",
            Self::Second => "Successfully registered for PIS!",
        }
    }
}

pub(crate) fn select_signup_slot(
    signup: &PISSignup,
    payload: &IncomingPISSignup,
) -> Result<SignupSlot, String> {
    if signup.first_brother_first_name == "none" && signup.first_brother_last_name == "none" {
        Ok(SignupSlot::First)
    } else if signup.second_brother_first_name == "none"
        && signup.second_brother_last_name == "none"
    {
        if signup.first_brother_first_name == payload.brother_first_name
            && signup.first_brother_last_name == payload.brother_last_name
        {
            return Err(format!(
                "Brother {} {} has already registered for this PIS.",
                payload.brother_first_name, payload.brother_last_name
            ));
        }
        Ok(SignupSlot::Second)
    } else {
        Err(format!(
            "Two brothers ({} {} and {} {}) are already signed up",
            signup.first_brother_first_name,
            signup.first_brother_last_name,
            signup.second_brother_first_name,
            signup.second_brother_last_name
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn signup(first: (&str, &str), second: (&str, &str)) -> PISSignup {
        PISSignup {
            time: bson::DateTime::from_millis(0),
            rushee_first_name: "Rushee".to_string(),
            rushee_last_name: "Example".to_string(),
            rushee_gtid: "123".to_string(),
            first_brother_first_name: first.0.to_string(),
            first_brother_last_name: first.1.to_string(),
            second_brother_first_name: second.0.to_string(),
            second_brother_last_name: second.1.to_string(),
            flex_window: false,
        }
    }

    fn payload() -> IncomingPISSignup {
        IncomingPISSignup {
            brother_first_name: "Bea".to_string(),
            brother_last_name: "Brother".to_string(),
        }
    }

    #[test]
    fn first_empty_slot_takes_priority_over_second_slot_state() {
        let state = signup(("none", "none"), ("Occupied", "Brother"));
        assert_eq!(
            select_signup_slot(&state, &payload()),
            Ok(SignupSlot::First)
        );
        assert_eq!(
            SignupSlot::First.success_message(),
            "Successfully registered!"
        );
    }

    #[test]
    fn second_slot_accepts_a_new_brother_even_when_first_is_partial() {
        let state = signup(("Alex", "none"), ("none", "none"));
        assert_eq!(
            select_signup_slot(&state, &payload()),
            Ok(SignupSlot::Second)
        );
        assert_eq!(
            SignupSlot::Second.success_message(),
            "Successfully registered for PIS!"
        );
    }

    #[test]
    fn duplicate_first_brother_keeps_exact_error_text() {
        let state = signup(("Bea", "Brother"), ("none", "none"));
        assert_eq!(
            select_signup_slot(&state, &payload()),
            Err("Brother Bea Brother has already registered for this PIS.".to_string())
        );
    }

    #[test]
    fn full_slots_keep_exact_error_text() {
        let state = signup(("Alex", "Brother"), ("Casey", "Member"));
        assert_eq!(
            select_signup_slot(&state, &payload()),
            Err("Two brothers (Alex Brother and Casey Member) are already signed up".to_string())
        );
    }
}
