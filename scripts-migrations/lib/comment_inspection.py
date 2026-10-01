"""Render the existing per-rushee comment diagnostics for maintenance scans."""

from .comment_validation import check_comment_structure


def inspect_rushee_comments(rushee):
    rushee_info = (
        f"{rushee.get('first_name', 'Unknown')} {rushee.get('last_name', 'Unknown')} "
        f"(GTID: {rushee.get('gtid', 'Unknown')})"
    )

    if 'comments' not in rushee:
        print(f"⚠️  {rushee_info}")
        print("   Missing 'comments' field entirely")
        return 1, True

    if not isinstance(rushee['comments'], list):
        print(f"⚠️  {rushee_info}")
        print(f"   'comments' should be array, got {type(rushee['comments'])}")
        return 1, True

    issue_count = 0
    rushee_has_issues = False
    for i, comment in enumerate(rushee['comments']):
        if not isinstance(comment, dict):
            if not rushee_has_issues:
                print(f"❌ {rushee_info}")
                rushee_has_issues = True
            print(f"   Comment {i}: Should be object, got {type(comment)}")
            issue_count += 1
            continue

        issues = check_comment_structure(comment, rushee_info)
        if issues:
            if not rushee_has_issues:
                print(f"❌ {rushee_info}")
                rushee_has_issues = True
            print(f"   Comment {i} issues:")
            for issue in issues:
                print(f"     - {issue}")
                issue_count += 1

    if rushee_has_issues:
        print()
    return issue_count, rushee_has_issues
