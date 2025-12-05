
const POLICIES = {
    MIN_BOOKING_DURATION_MINUTES: 15,
    MAX_BOOKING_DURATION_MINUTES: 120,
};

const busySlots = []; // No busy slots for this test
const workStart = 540; // 09:00
const workEnd = 1020; // 17:00
const todayIST = "2025-12-04"; // Assume today
const date = "2025-12-04";
const isToday = true;
const currentMinutes = 600; // 10:00

const getEarliestBookableTime = () => {
    // Simplified
    return workStart;
};

const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const isRangeValid = (start: number, end: number): boolean => {
    // Check within working hours
    if (start < workStart || end > workEnd) {
        console.log(`Invalid: Outside working hours ${start}-${end}`);
        return false;
    }

    // Check minimum duration
    if (end - start < POLICIES.MIN_BOOKING_DURATION_MINUTES) {
        console.log(`Invalid: Too short ${end - start}`);
        return false;
    }

    // Check maximum duration
    if (end - start > POLICIES.MAX_BOOKING_DURATION_MINUTES) {
        console.log(`Invalid: Too long ${end - start}`);
        return false;
    }

    // Check overlap with busy slots
    for (const slot of busySlots) {
        const slotStart = parseTime(slot.start);
        const slotEnd = parseTime(slot.end);

        if (start < slotEnd && end > slotStart) {
            console.log(`Invalid: Overlap ${start}-${end} with ${slotStart}-${slotEnd}`);
            return false; // Overlap detected
        }
    }

    return true;
};

const adjustToValidRange = (
    start: number,
    end: number,
    dragType: 'start' | 'end' | 'move' | null
): { start: number; end: number } | null => {
    console.log(`Adjusting: ${start}-${end}, type: ${dragType}`);

    // Priority 1: If valid as-is, return immediately
    if (isRangeValid(start, end)) {
        console.log("Valid as-is");
        return { start, end };
    }

    const minDuration = POLICIES.MIN_BOOKING_DURATION_MINUTES;
    const maxDuration = POLICIES.MAX_BOOKING_DURATION_MINUTES;
    const currentDuration = end - start;

    // Priority 2: Based on drag type, preserve the user's intent
    if (dragType === 'end') {
        for (let offset = 0; offset <= 120; offset += 5) {
            const newEnd1 = end - offset;
            if (newEnd1 - start >= minDuration && newEnd1 - start <= maxDuration) {
                if (isRangeValid(start, newEnd1)) {
                    console.log(`Found valid end (shrink): ${newEnd1}`);
                    return { start, end: newEnd1 };
                }
            }

            if (offset > 0) {
                const newEnd2 = end + offset;
                if (newEnd2 - start >= minDuration && newEnd2 - start <= maxDuration) {
                    if (isRangeValid(start, newEnd2)) {
                        console.log(`Found valid end (grow): ${newEnd2}`);
                        return { start, end: newEnd2 };
                    }
                }
            }
        }
    }

    // Fallback
    if (dragType === 'end') {
        for (let d = minDuration; d <= maxDuration; d += 5) {
            if (isRangeValid(start, start + d)) {
                console.log(`Fallback found: ${start + d}`);
                return { start, end: start + d };
            }
        }
    }

    console.log("No valid range found");
    return null;
};

// Test Case 1: Drag end to 45 mins (valid)
console.log("--- Test Case 1: Drag end to 45 mins (Valid) ---");
const result1 = adjustToValidRange(600, 645, 'end'); // 10:00 to 10:45
console.log("Result 1:", result1);

// Test Case 2: Drag end to 50 mins (Valid)
console.log("\n--- Test Case 2: Drag end to 50 mins (Valid) ---");
const result2 = adjustToValidRange(600, 650, 'end'); // 10:00 to 10:50
console.log("Result 2:", result2);

// Test Case 3: Drag end to invalid (too long - e.g. 3 hours)
console.log("\n--- Test Case 3: Drag end to invalid (Too long) ---");
const result3 = adjustToValidRange(600, 800, 'end'); // 10:00 to 13:20 (200 mins)
console.log("Result 3:", result3);
