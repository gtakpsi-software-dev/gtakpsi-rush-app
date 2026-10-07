"""Print the malformed-comment scan and its existing diagnostic summary."""

from lib.comment_inspection import inspect_rushee_comments


def print_comment_report(collection):
    print("\n🔍 Scanning for malformed comment data...")
    print("=" * 60)

    total_rushees = 0
    problematic_rushees = 0
    total_issues = 0

    try:
        cursor = collection.find({})

        for rushee in cursor:
            total_rushees += 1
            issue_count, rushee_has_issues = inspect_rushee_comments(rushee)
            total_issues += issue_count
            if rushee_has_issues:
                problematic_rushees += 1

    except Exception as e:
        print(f"❌ Error scanning database: {e}")
        return

    print("=" * 60)
    print("📊 SCAN SUMMARY")
    print("=" * 60)
    print(f"Total rushees scanned: {total_rushees}")
    print(f"Rushees with issues: {problematic_rushees}")
    print(f"Total issues found: {total_issues}")

    if problematic_rushees == 0:
        print("\n✅ No malformed comment data found!")
        print("The dashboard issue might be caused by something else.")
    else:
        print(f"\n⚠️  Found {problematic_rushees} rushees with malformed comment data.")
        print("This is likely causing your dashboard loading errors.")

        print("\n🔧 SUGGESTED FIXES:")
        print("1. Use the cleanup script to fix malformed data")
        print("2. Or manually review and fix the problematic rushees listed above")
        print("3. Restart your Rust server after fixing the data")
