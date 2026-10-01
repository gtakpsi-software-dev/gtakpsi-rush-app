export function getRusheeNumber(search) {
    const params = new URLSearchParams(search);
    return params.get('rushee_num') || '---';
}

export function isBidCommitteeMode(location, getReferrer) {
    // Read the referrer only after route checks so its legacy fallback remains lazy.
    return location.pathname.includes('/bid-committee') ||
        location.search.includes('bid_committee=true') ||
        getReferrer().includes('/bid-committee');
}
