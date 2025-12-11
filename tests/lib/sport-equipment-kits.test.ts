import { describe, it, expect } from 'vitest';
import {
    SPORT_EQUIPMENT_KITS,
    getMaxQuantityForItem,
    validateSportKitQuantities,
    getSuggestedFacilities,
    getFacilityWarningMessage,
} from '@/lib/sportEquipmentKits';
import { SPORT_CATEGORIES } from '@/lib/sportCategoryRules';

describe('Sport Equipment Kits', () => {
    describe('SPORT_EQUIPMENT_KITS configuration', () => {
        it('should have cricket kit with correct limits', () => {
            const cricketKit = SPORT_EQUIPMENT_KITS.CRICKET;
            expect(cricketKit['Cricket Bat']).toBe(2);
            expect(cricketKit['Cricket Ball']).toBe(1);
            expect(cricketKit['Cricket Stumps']).toBe(2);
        });

        it('should have badminton kit with correct limits', () => {
            const badmintonKit = SPORT_EQUIPMENT_KITS.BADMINTON;
            expect(badmintonKit['Badminton Racket']).toBe(4);
        });

        it('should have table tennis kit with correct limits', () => {
            const ttKit = SPORT_EQUIPMENT_KITS.TABLE_TENNIS;
            expect(ttKit['TT Bat']).toBe(4);
            expect(ttKit['TT Ball']).toBe(1);
        });

        it('should have basketball kit with 1 ball limit', () => {
            expect(SPORT_EQUIPMENT_KITS.BASKETBALL['Basketball']).toBe(1);
        });

        it('should have football kit with 1 ball limit', () => {
            expect(SPORT_EQUIPMENT_KITS.FOOTBALL['Football']).toBe(1);
        });
    });

    describe('getMaxQuantityForItem', () => {
        it('should return correct limit for cricket bat', () => {
            expect(getMaxQuantityForItem('Cricket Bat', SPORT_CATEGORIES.CRICKET)).toBe(2);
        });

        it('should return correct limit for badminton racket', () => {
            expect(getMaxQuantityForItem('Badminton Racket', SPORT_CATEGORIES.BADMINTON)).toBe(4);
        });

        it('should return 1 for unlisted items', () => {
            expect(getMaxQuantityForItem('Unknown Item', SPORT_CATEGORIES.CRICKET)).toBe(1);
        });

        it('should handle partial name matching', () => {
            // "TT Bat" should match via partial matching
            expect(getMaxQuantityForItem('TT Bat', SPORT_CATEGORIES.TABLE_TENNIS)).toBe(4);
        });
    });

    describe('validateSportKitQuantities', () => {
        it('should allow valid cricket kit', async () => {
            const items = [
                { itemId: '1', name: 'Cricket Bat', qty: 2 },
                { itemId: '2', name: 'Cricket Ball', qty: 1 },
                { itemId: '3', name: 'Cricket Stumps', qty: 2 },
            ];

            const result = await validateSportKitQuantities(items, SPORT_CATEGORIES.CRICKET);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject too many cricket bats', async () => {
            const items = [
                { itemId: '1', name: 'Cricket Bat', qty: 3 }, // Max is 2
            ];

            const result = await validateSportKitQuantities(items, SPORT_CATEGORIES.CRICKET);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Cricket Bat');
            expect(result.errors[0]).toContain('at most 2');
        });

        it('should reject multiple footballs', async () => {
            const items = [
                { itemId: '1', name: 'Football', qty: 2 }, // Max is 1
            ];

            const result = await validateSportKitQuantities(items, SPORT_CATEGORIES.FOOTBALL);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('at most 1');
        });

        it('should allow valid badminton doubles kit', async () => {
            const items = [
                { itemId: '1', name: 'Badminton Racket', qty: 4 }, // For doubles
            ];

            const result = await validateSportKitQuantities(items, SPORT_CATEGORIES.BADMINTON);
            expect(result.valid).toBe(true);
        });

        it('should aggregate quantities for same item type', async () => {
            const items = [
                { itemId: '1', name: 'Cricket Bat', qty: 1 },
                { itemId: '2', name: 'Cricket Bat', qty: 2 }, // Total: 3, max is 2
            ];

            const result = await validateSportKitQuantities(items, SPORT_CATEGORIES.CRICKET);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('3'); // Requested qty
        });
    });

    describe('getSuggestedFacilities', () => {
        it('should suggest TT tables for table tennis', () => {
            const facilities = getSuggestedFacilities(SPORT_CATEGORIES.TABLE_TENNIS);
            expect(facilities).toContain('Table Tennis');
        });

        it('should suggest Basketball Court for basketball', () => {
            const facilities = getSuggestedFacilities(SPORT_CATEGORIES.BASKETBALL);
            expect(facilities).toContain('Basketball Court');
        });

        it('should return empty array for badminton (outdoor)', () => {
            const facilities = getSuggestedFacilities(SPORT_CATEGORIES.BADMINTON);
            expect(facilities).toHaveLength(0);
        });

        it('should suggest Main Turf for football and cricket', () => {
            expect(getSuggestedFacilities(SPORT_CATEGORIES.FOOTBALL)).toContain('Main Turf');
            expect(getSuggestedFacilities(SPORT_CATEGORIES.CRICKET)).toContain('Main Turf');
        });
    });

    describe('getFacilityWarningMessage', () => {
        it('should return warning for table tennis without facility', () => {
            const warning = getFacilityWarningMessage(SPORT_CATEGORIES.TABLE_TENNIS);
            expect(warning).toContain('table tennis');
            expect(warning).toContain('Table Tennis');
            expect(warning).toContain('Play responsibly');
        });

        it('should return null for badminton (no facility required)', () => {
            const warning = getFacilityWarningMessage(SPORT_CATEGORIES.BADMINTON);
            expect(warning).toBeNull();
        });

        it('should return null for general items', () => {
            const warning = getFacilityWarningMessage(SPORT_CATEGORIES.GENERAL);
            expect(warning).toBeNull();
        });

        it('should return warning for basketball without facility', () => {
            const warning = getFacilityWarningMessage(SPORT_CATEGORIES.BASKETBALL);
            expect(warning).toContain('basketball');
            expect(warning).toContain('Basketball Court');
        });
    });
});
