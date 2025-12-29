// Speculative word bank for detecting potentially speculative language in comments
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

// Function to check if a comment contains speculative language
export const checkSpeculativeLanguage = (comment) => {
    if (!comment || typeof comment !== 'string') {
        return { hasSpeculativeLanguage: false, flaggedWords: [] };
    }
    
    const lowerComment = comment.toLowerCase();
    const flaggedWords = [];
    
    SPECULATIVE_WORDS.forEach(word => {
        // Use word boundaries to avoid partial matches
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(lowerComment)) {
            flaggedWords.push(word);
        }
    });
    
    return {
        hasSpeculativeLanguage: flaggedWords.length > 0,
        flaggedWords: [...new Set(flaggedWords)] // Remove duplicates
    };
};

// Function to check if a comment contains a rushee's name
export const checkRusheeName = (comment, rusheeFirstName, rusheeLastName) => {
    if (!comment || !rusheeFirstName || !rusheeLastName) {
        return { hasRusheeName: false, foundNames: [] };
    }
    
    const lowerComment = comment.toLowerCase();
    const foundNames = [];
    
    // Check for first name
    const firstNameRegex = new RegExp(`\\b${rusheeFirstName.toLowerCase()}\\b`, 'gi');
    if (firstNameRegex.test(lowerComment)) {
        foundNames.push(rusheeFirstName);
    }
    
    // Check for last name
    const lastNameRegex = new RegExp(`\\b${rusheeLastName.toLowerCase()}\\b`, 'gi');
    if (lastNameRegex.test(lowerComment)) {
        foundNames.push(rusheeLastName);
    }
    
    // Check for full name
    const fullName = `${rusheeFirstName} ${rusheeLastName}`;
    const fullNameRegex = new RegExp(`\\b${fullName.toLowerCase()}\\b`, 'gi');
    if (fullNameRegex.test(lowerComment)) {
        foundNames.push(fullName);
    }
    
    return {
        hasRusheeName: foundNames.length > 0,
        foundNames: [...new Set(foundNames)] // Remove duplicates
    };
};

// Combined function to check both speculative language and rushee names
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

// Generate warning messages
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