
const POLICIES = {
    MIN_BOOKING_DURATION_MINUTES: 15,
    MAX_BOOKING_DURATION_MINUTES: 120,
};

// Mock data
const busySlots = [];
const workStart = 540; // 09:00
const workEnd = 1020; // 17:00
const todayIST = "2025-12-04";
const date = "2025-12-04";
const isToday = true;
const currentMinutes = 600; // 10:00

const getEarliestBookableTime = () => {
    return workStart;
};

const parseTime = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

const isRangeValid = (start: number, end: number): boolean => {
    console.log(`Checking validity for ${start}-${end} (Duration: ${end - start})`);

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
                    console.log(`Found valid end (shrink): ${newEnd1} (Duration: ${newEnd1 - start})`);
                    return { start, end: newEnd1 };
                }
            }

            if (offset > 0) {
                const newEnd2 = end + offset;
                if (newEnd2 - start >= minDuration && newEnd2 - start <= maxDuration) {
                    if (isRangeValid(start, newEnd2)) {
                        console.log(`Found valid end (grow): ${newEnd2} (Duration: ${newEnd2 - start})`);
                        return { start, end: newEnd2 };
                    }
                }
            }
        }
    }

    return null;
};

// Test Case: Drag end to 75 mins (1h 15m)
console.log("--- Test Case: Drag end to 75 mins (1h 15m) ---");
// Start at 10:00 (600), End at 11:15 (675)
const start = 600;
const end = 675;
const result = adjustToValidRange(start, end, 'end');
console.log("Result:", result);

if (result && (result.end - result.start) === 75) {
    console.log("SUCCESS: 75 minute duration allowed.");
} else {
    console.log("FAILURE: 75 minute duration NOT allowed.");
}
