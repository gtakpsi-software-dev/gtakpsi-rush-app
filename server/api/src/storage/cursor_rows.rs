use futures::{Stream, StreamExt};

pub(crate) async fn for_each_valid_row<T, E>(
    mut cursor: impl Stream<Item = Result<T, E>> + Unpin,
    mut visit: impl FnMut(T),
) {
    // These readers tolerate malformed documents so later valid rows remain visible.
    while let Some(row) = cursor.next().await {
        if let Ok(value) = row {
            visit(value);
        }
    }
}

pub(crate) async fn collect_valid_rows<T, E>(
    cursor: impl Stream<Item = Result<T, E>> + Unpin,
) -> Vec<T> {
    let mut rows = Vec::new();
    for_each_valid_row(cursor, |row| rows.push(row)).await;
    rows
}

#[cfg(test)]
mod tests {
    use super::{collect_valid_rows, for_each_valid_row};
    use futures::stream;

    #[tokio::test]
    async fn malformed_rows_do_not_hide_later_valid_rows() {
        let cursor = stream::iter([Ok(1), Err(()), Ok(2)]);
        assert_eq!(collect_valid_rows(cursor).await, vec![1, 2]);

        let mut visited = Vec::new();
        let cursor = stream::iter([Ok(1), Err(()), Ok(2)]);
        for_each_valid_row(cursor, |row| visited.push(row)).await;
        assert_eq!(visited, [1, 2]);
    }
}
