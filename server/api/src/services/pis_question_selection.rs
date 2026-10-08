use crate::models::pis::PISQuestion;
use rand::Rng;
use std::collections::HashMap;

// Group categorized questions while preserving their order within each category.
pub(crate) fn category_buckets(questions: Vec<PISQuestion>) -> HashMap<String, Vec<PISQuestion>> {
    let mut by_category: HashMap<String, Vec<PISQuestion>> = HashMap::new();
    for question in questions.into_iter() {
        if let Some(category) = &question.category {
            by_category
                .entry(category.clone())
                .or_default()
                .push(question);
        }
    }
    by_category
}

// Use the supplied random generator to choose one question per nonempty category.
pub(crate) fn draw_one_per_bucket<R: Rng + ?Sized>(
    by_category: HashMap<String, Vec<PISQuestion>>,
    rng: &mut R,
) -> Vec<PISQuestion> {
    let mut assigned_questions: Vec<PISQuestion> = Vec::new();
    for (_category, bucket) in by_category.into_iter() {
        if bucket.is_empty() {
            continue;
        }
        let idx = rng.gen_range(0..bucket.len());
        assigned_questions.push(bucket[idx].clone());
    }
    assigned_questions
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::rngs::mock::StepRng;

    // Build a question fixture with an optional category.
    fn question(text: &str, category: Option<&str>) -> PISQuestion {
        PISQuestion {
            question: text.to_string(),
            question_type: "professional".to_string(),
            order: None,
            category: category.map(str::to_string),
        }
    }

    // Verify that category buckets retain question order and omit uncategorized questions.
    #[test]
    fn buckets_keep_category_order_and_exclude_fixed_questions() {
        let buckets = category_buckets(vec![
            question("first", Some("motivation")),
            question("fixed", None),
            question("second", Some("motivation")),
            question("empty category", Some("")),
        ]);

        assert_eq!(buckets.len(), 2);
        assert_eq!(
            buckets["motivation"]
                .iter()
                .map(|question| question.question.as_str())
                .collect::<Vec<_>>(),
            ["first", "second"]
        );
        assert_eq!(buckets[""].len(), 1);
    }

    // Verify category selection with a deterministic random generator.
    #[test]
    fn draw_selects_one_per_nonempty_bucket_with_injected_rng() {
        let mut buckets = category_buckets(vec![
            question("first", Some("motivation")),
            question("second", Some("motivation")),
            question("third", Some("professional")),
            question("fixed", None),
        ]);
        buckets.insert("empty".to_string(), Vec::new());
        let mut rng = StepRng::new(0, 0);

        let mut selected = draw_one_per_bucket(buckets, &mut rng)
            .into_iter()
            .map(|question| question.question)
            .collect::<Vec<_>>();
        selected.sort();
        assert_eq!(selected, ["first", "third"]);
    }
}
