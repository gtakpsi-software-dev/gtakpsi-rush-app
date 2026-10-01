export function parseAdminAllowlist(value) {
    return (value || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0);
}
