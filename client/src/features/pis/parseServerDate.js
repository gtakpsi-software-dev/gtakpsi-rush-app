// PIS reveal times can arrive as BSON extended JSON or plain dates.
// Parse the BSON milliseconds explicitly because Date cannot read that object shape.
export function parseServerDate(value) {
    if (!value) return null;
    const millis = value?.$date?.$numberLong;
    if (millis !== undefined) return new Date(parseInt(millis, 10));
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
}
