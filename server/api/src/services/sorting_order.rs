fn insert_at_target(ids: &mut Vec<String>, id: String, target_index: i32) {
    // Keep negative indices at the front and oversized indices at the end of the column.
    let index = usize::try_from(target_index).unwrap_or(0).min(ids.len());
    ids.insert(index, id);
}

pub(crate) fn move_within_column(
    mut ids: Vec<String>,
    moved_id: &str,
    target_index: i32,
) -> Option<Vec<String>> {
    let position = ids.iter().position(|id| id == moved_id)?;
    let id = ids.remove(position);
    insert_at_target(&mut ids, id, target_index);
    Some(ids)
}

pub(crate) fn move_between_columns(
    mut source_ids: Vec<String>,
    mut target_ids: Vec<String>,
    moved_id: &str,
    target_index: i32,
) -> Option<(Vec<String>, Vec<String>)> {
    let position = source_ids.iter().position(|id| id == moved_id)?;
    let id = source_ids.remove(position);
    insert_at_target(&mut target_ids, id, target_index);
    Some((source_ids, target_ids))
}

#[cfg(test)]
mod tests {
    use super::{move_between_columns, move_within_column};

    fn ids(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }

    #[test]
    fn moving_within_a_column_uses_the_order_after_removal() {
        assert_eq!(
            move_within_column(ids(&["a", "b", "c"]), "a", 2),
            Some(ids(&["b", "c", "a"]))
        );
        assert_eq!(
            move_within_column(ids(&["a", "b", "c"]), "c", -1),
            Some(ids(&["c", "a", "b"]))
        );
        assert_eq!(
            move_within_column(ids(&["a", "b", "c"]), "b", i32::MAX),
            Some(ids(&["a", "c", "b"]))
        );
    }

    #[test]
    fn moving_between_columns_keeps_source_and_target_order() {
        assert_eq!(
            move_between_columns(ids(&["a", "b", "c"]), ids(&["x", "y"]), "b", 1),
            Some((ids(&["a", "c"]), ids(&["x", "b", "y"])))
        );
        assert_eq!(
            move_between_columns(ids(&["a", "b"]), ids(&[]), "a", -1),
            Some((ids(&["b"]), ids(&["a"])))
        );
    }

    #[test]
    fn missing_rushee_does_not_produce_an_order_to_write() {
        assert_eq!(move_within_column(ids(&["a"]), "missing", 0), None);
        assert_eq!(
            move_between_columns(ids(&["a"]), ids(&["x"]), "missing", 0),
            None
        );
    }
}
