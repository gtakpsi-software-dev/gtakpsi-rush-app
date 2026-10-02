use futures::{Stream, StreamExt};

pub(crate) async fn collect_valid_rows<T, E>(
    mut cursor: impl Stream<Item = Result<T, E>> + Unpin,
) -> Vec<T> {
    let mut rows = Vec::new();
    // These readers tolerate malformed documents so later valid rows remain visible.
    while let Some(row) = cursor.next().await {
        if let Ok(value) = row {
            rows.push(value);
        }
    }
    rows
}

#[cfg(test)]
mod tests {
    use super::collect_valid_rows;
    use futures::stream;

    #[tokio::test]
    async fn malformed_rows_do_not_hide_later_valid_rows() {
        let cursor = stream::iter([Ok(1), Err(()), Ok(2)]);
        assert_eq!(collect_valid_rows(cursor).await, vec![1, 2]);
    }
}
