// Mnemonic ID Generator
// Generates human-readable session IDs like "HappyBlueWhaleStorm"

const ADJECTIVES = [
    "Happy", "Brave", "Clever", "Swift", "Mighty", "Gentle", "Wise", "Bold",
    "Bright", "Calm", "Eager", "Fancy", "Jolly", "Kind", "Lively", "Noble",
    "Quick", "Silent", "Witty", "Zesty", "Cosmic", "Electric", "Mystic", "Royal",
    "Sunny", "Lucky", "Dizzy", "Funky", "Jazzy", "Peppy", "Shiny", "Stellar",
    "Wild", "Cozy", "Daring", "Epic", "Fierce", "Golden", "Humble", "Icy"
];

const COLORS = [
    "Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Cyan",
    "Magenta", "Lime", "Teal", "Indigo", "Violet", "Crimson", "Azure", "Jade",
    "Amber", "Ruby", "Emerald", "Sapphire", "Gold", "Silver", "Bronze", "Pearl",
    "Coral", "Mint", "Rose", "Ivory", "Ebony", "Scarlet"
];

const ANIMALS = [
    "Whale", "Eagle", "Tiger", "Dragon", "Phoenix", "Wolf", "Bear", "Fox",
    "Hawk", "Lion", "Panda", "Otter", "Raven", "Shark", "Dolphin", "Falcon",
    "Jaguar", "Lynx", "Moose", "Owl", "Penguin", "Rabbit", "Seal", "Turtle",
    "Zebra", "Koala", "Lemur", "Gecko", "Crane", "Bison", "Cougar", "Ferret",
    "Gazelle", "Heron", "Iguana", "Gecko", "Mantis", "Narwhal", "Alpaca", "Badger"
];

const NOUNS = [
    "Storm", "Mountain", "River", "Forest", "Ocean", "Thunder", "Lightning", "Cloud",
    "Star", "Moon", "Sun", "Wind", "Rain", "Snow", "Fire", "Earth",
    "Sky", "Wave", "Reef", "Valley", "Peak", "Coast", "Dawn", "Dusk",
    "Meadow", "Brook", "Canyon", "Desert", "Glacier", "Island", "Lake", "Savanna",
    "Tundra", "Volcano", "Waterfall", "Aurora", "Comet", "Eclipse", "Horizon", "Nebula"
];

/**
 * Generates a random mnemonic ID in the format: AdjectiveColorAnimalNoun
 * Example: "HappyBlueWhaleStorm"
 */
export function generateMnemonicId(): string {
    const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];

    return `${adjective}${color}${animal}${noun}`;
}

/**
 * Validates if a string is a valid mnemonic ID format
 * Must be PascalCase and contain only letters
 */
export function isValidMnemonicId(id: string): boolean {
    // Must be 4-60 characters, only letters, and start with uppercase
    return /^[A-Z][a-zA-Z]{3,59}$/.test(id);
}

/**
 * Calculate total possible combinations
 * Current: 40 adjectives × 30 colors × 40 animals × 40 nouns = 1,920,000 combinations
 */
export function getTotalCombinations(): number {
    return ADJECTIVES.length * COLORS.length * ANIMALS.length * NOUNS.length;
}
