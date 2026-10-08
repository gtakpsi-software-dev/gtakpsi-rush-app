// Strip nondigits and format complete or partial US phone-number input.
export function formatPhoneInput(value) {
    const digits = value.replace(/\D/g, "");
    return digits
        .replace(/^(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")
        .replace(/^(\d{3})(\d{1,3})$/, "($1) $2")
        .replace(/^(\d{1,3})$/, "($1");
}
