#[derive(Debug, PartialEq, Eq)]
pub(crate) enum DeletionPlan {
    Delete,
    Update(i32),
}

pub(crate) fn plan_deletion(num_available: i32, change: i32) -> DeletionPlan {
    // INVARIANT: the current API compares strictly, then adds the signed change.
    // Altering this arithmetic changes stored capacity for legacy callers.
    if num_available < change {
        DeletionPlan::Delete
    } else {
        DeletionPlan::Update(num_available + change)
    }
}

#[cfg(test)]
mod tests {
    use super::{plan_deletion, DeletionPlan};

    #[test]
    fn deletion_plan_retains_strict_comparison_and_signed_addition() {
        assert_eq!(plan_deletion(2, 3), DeletionPlan::Delete);
        assert_eq!(plan_deletion(2, 2), DeletionPlan::Update(4));
        assert_eq!(plan_deletion(2, 1), DeletionPlan::Update(3));
        assert_eq!(plan_deletion(2, -1), DeletionPlan::Update(1));
    }
}
