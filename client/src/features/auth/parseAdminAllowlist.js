// Parse comma-separated admin emails into normalized, nonempty entries.
export function parseAdminAllowlist(value) {
    return (value || "")
        .split(",")
        .map(/* Trim and lowercase an allowlist email. */ (email) => email.trim().toLowerCase())
        .filter(/* Discard empty allowlist entries. */ (email) => email.length > 0);
}
