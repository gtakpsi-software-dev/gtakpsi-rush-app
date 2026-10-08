// Preserve bank order and repeated entries; warning order follows this list, then matches are deduplicated.
export const SPECULATIVE_WORDS = [
    // Future-oriented speculation
    "would", "could", "should", "might", "may", "shall",
    "going to", "gonna", "planning to", "intending to", "expecting to",

    // Conditional speculation
    "assuming", "supposing", "provided that", "in case",
    "unless", "otherwise", "alternatively",

    // Uncertainty indicators
    "maybe", "perhaps", "possibly", "potentially", "likely", "unlikely",
    "probably", "definitely", "certainly", "surely", "obviously",

    // Comparative speculation
    "better", "worse", "best", "worst", "more", "less", "most", "least",
    "improve", "decline", "grow", "shrink", "increase", "decrease",

    // Time-based speculation
    "eventually", "someday", "in the future", "later", "soon", "eventually",
    "one day", "sometime", "eventually",

    // Character/personality speculation
    "seems like", "appears to be", "looks like", "sounds like", "feels like",
    "gives the impression", "comes across as", "strikes me as",

    // Academic/professional speculation
    "good fit", "bad fit", "suitable", "unsuitable", "qualified", "unqualified",
    "capable", "incapable", "competent", "incompetent",

    // Social speculation
    "popular", "unpopular", "well-liked", "disliked", "friendly", "unfriendly",
    "outgoing", "shy", "confident", "insecure",

    // Performance speculation
    "successful", "unsuccessful", "productive", "unproductive", "efficient", "inefficient",
    "effective", "ineffective", "valuable", "worthless"
];

// Find whole-word speculative phrases and return unique matches in word-bank order.
export const checkSpeculativeLanguage = (comment) => {
    if (!comment || typeof comment !== 'string') {
        return { hasSpeculativeLanguage: false, flaggedWords: [] };
    }

    const lowerComment = comment.toLowerCase();
    const flaggedWords = [];

    SPECULATIVE_WORDS.forEach(word => {
        // Record a speculative phrase when its word-boundary pattern matches.
        // Word boundaries keep partial words from triggering a warning.
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(lowerComment)) {
            flaggedWords.push(word);
        }
    });

    return {
        hasSpeculativeLanguage: flaggedWords.length > 0,
        flaggedWords: [...new Set(flaggedWords)]
    };
};

// Detect occurrences of the rushee’s first, last, or full name in a comment.
export const checkRusheeName = (comment, rusheeFirstName, rusheeLastName) => {
    if (!comment || !rusheeFirstName || !rusheeLastName) {
        return { hasRusheeName: false, foundNames: [] };
    }

    const lowerComment = comment.toLowerCase();
    const foundNames = [];

    // Keep legacy regex interpolation; escaping name characters would change existing matches.
    const firstNameRegex = new RegExp(`\\b${rusheeFirstName.toLowerCase()}\\b`, 'gi');
    if (firstNameRegex.test(lowerComment)) {
        foundNames.push(rusheeFirstName);
    }

    const lastNameRegex = new RegExp(`\\b${rusheeLastName.toLowerCase()}\\b`, 'gi');
    if (lastNameRegex.test(lowerComment)) {
        foundNames.push(rusheeLastName);
    }

    const fullName = `${rusheeFirstName} ${rusheeLastName}`;
    const fullNameRegex = new RegExp(`\\b${fullName.toLowerCase()}\\b`, 'gi');
    if (fullNameRegex.test(lowerComment)) {
        foundNames.push(fullName);
    }

    return {
        hasRusheeName: foundNames.length > 0,
        foundNames: [...new Set(foundNames)]
    };
};

// Combine speculative-language and name checks into a validation result.
export const validateComment = (comment, rusheeFirstName, rusheeLastName) => {
    const speculativeCheck = checkSpeculativeLanguage(comment);
    const nameCheck = checkRusheeName(comment, rusheeFirstName, rusheeLastName);

    return {
        hasWarnings: speculativeCheck.hasSpeculativeLanguage || nameCheck.hasRusheeName,
        speculativeLanguage: speculativeCheck,
        rusheeName: nameCheck,
        warnings: []
    };
};

// Build warning messages from the detected speculative phrases and names.
export const generateWarnings = (validationResult) => {
    const warnings = [];

    if (validationResult.speculativeLanguage.hasSpeculativeLanguage) {
        warnings.push({
            type: 'speculative',
            message: `Speculative language detected: "${validationResult.speculativeLanguage.flaggedWords.join(', ')}". Consider using more concrete observations.`
        });
    }

    if (validationResult.rusheeName.hasRusheeName) {
        warnings.push({
            type: 'name',
            message: `Rushee's name detected: "${validationResult.rusheeName.foundNames.join(', ')}". Consider using "the rushee" or "they" instead.`
        });
    }

    return warnings;
};
