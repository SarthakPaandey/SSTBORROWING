/**
 * Sport Equipment Kits Configuration
 * 
 * Defines the maximum quantities of each equipment type per sport category.
 * This ensures students borrow realistic "kits" for actual gameplay.
 * 
 * Example: Cricket needs 2 bats (for both teams), 1 ball, 2 sets of pads, etc.
 */

import { SPORT_CATEGORIES, SportCategory } from './sportCategoryRules';

// Equipment limits per sport category
// Maps item names to max quantity allowed per booking
export const SPORT_EQUIPMENT_KITS: Record<SportCategory, Record<string, number>> = {
    // Cricket: Full match kit
    CRICKET: {
        'Cricket Bat': 2,        // One for each team
        'Cricket Ball': 1,       // One ball per match
        'Cricket Pads': 2,       // One set per batsman
        'Cricket Helmet': 2,     // One per batsman
        'Cricket Gloves': 2,     // One pair per batsman
        'Cricket Stumps': 2,     // One set per end (if we add this item)
    },

    // Badminton: Doubles kit
    BADMINTON: {
        'Badminton Racket': 4,   // 2 per side for doubles
        'Shuttlecocks': 2,       // Pack of shuttlecocks (qty represents packs)
    },

    // Table Tennis: Singles/Doubles kit
    TABLE_TENNIS: {
        'TT Paddle': 4,          // 2 per side for doubles
        'TT Balls': 2,           // A couple of balls
    },

    // Basketball: One ball per game
    BASKETBALL: {
        'Basketball': 1,         // One ball per game
    },

    // Football: One ball per game
    FOOTBALL: {
        'Football': 1,           // One ball per game
    },

    // General: No specific limits (flexible items)
    GENERAL: {},
};

// Default max quantity if item not in sport kit (fallback)
export const DEFAULT_MAX_QUANTITY_PER_ITEM = 1;

/**
 * Get the maximum allowed quantity for an item in a specific sport category
 */
export function getMaxQuantityForItem(
    itemName: string,
    sportCategory: SportCategory
): number {
    const sportKit = SPORT_EQUIPMENT_KITS[sportCategory];

    if (!sportKit) {
        return DEFAULT_MAX_QUANTITY_PER_ITEM;
    }

    // Check for exact match first
    if (sportKit[itemName] !== undefined) {
        return sportKit[itemName];
    }

    // Check for partial match (e.g., "TT Paddle" matches "TT Paddle")
    for (const [kitItemName, maxQty] of Object.entries(sportKit)) {
        if (itemName.toLowerCase().includes(kitItemName.toLowerCase()) ||
            kitItemName.toLowerCase().includes(itemName.toLowerCase())) {
            return maxQty;
        }
    }

    // Default: 1 of any unlisted item
    return DEFAULT_MAX_QUANTITY_PER_ITEM;
}

/**
 * Validate that a booking request doesn't exceed sport-specific limits
 * 
 * @returns { valid: boolean, errors: string[] }
 */
export async function validateSportKitQuantities(
    items: Array<{ itemId: string; name: string; qty: number; sportCategory?: SportCategory }>,
    sportCategory: SportCategory
): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Group items by name and sum quantities
    const itemQuantities: Record<string, number> = {};

    for (const item of items) {
        const key = item.name;
        itemQuantities[key] = (itemQuantities[key] || 0) + item.qty;
    }

    // Check each item against sport kit limits
    for (const [itemName, totalQty] of Object.entries(itemQuantities)) {
        const maxAllowed = getMaxQuantityForItem(itemName, sportCategory);

        if (totalQty > maxAllowed) {
            errors.push(
                `For ${sportCategory.replace('_', ' ')}, you can borrow at most ${maxAllowed} ${itemName}(s). You requested ${totalQty}.`
            );
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Equipment to Facility Mapping
 * 
 * Maps sport categories to the facilities where they should be used.
 * Used for soft warnings when borrowing equipment without a matching facility.
 */
export const SPORT_FACILITY_MAPPING: Record<SportCategory, string[]> = {
    TABLE_TENNIS: ['Table Tennis 1', 'Table Tennis 2'],
    BASKETBALL: ['Basketball Court'],
    BADMINTON: [], // No indoor facility - outdoor courts assumed
    FOOTBALL: ['Main Turf'],
    CRICKET: ['Main Turf'],
    GENERAL: [], // No specific facility required
};

/**
 * Get suggested facilities for a sport category
 */
export function getSuggestedFacilities(sportCategory: SportCategory): string[] {
    return SPORT_FACILITY_MAPPING[sportCategory] || [];
}

/**
 * Check if user should receive a facility suggestion warning
 * 
 * Returns a warning message if the sport has associated facilities
 * but the user doesn't have one booked (checked externally).
 */
export function getFacilityWarningMessage(sportCategory: SportCategory): string | null {
    const facilities = getSuggestedFacilities(sportCategory);

    if (facilities.length === 0) {
        // No specific facility required for this sport
        return null;
    }

    const sportName = sportCategory.replace('_', ' ').toLowerCase();
    const facilityList = facilities.join(' or ');

    return `You're borrowing ${sportName} equipment without a ${facilityList} booking. Play responsibly wherever you're headed! 🏆`;
}
