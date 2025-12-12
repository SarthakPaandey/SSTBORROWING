import { z } from 'zod';

export const bookingSchema = z.object({
    resourceId: z.string().min(1, "Resource ID is required"),
    start: z.string().datetime("Invalid start date"),
    end: z.string().datetime("Invalid end date"),
    items: z.array(z.object({
        itemId: z.string(),
        // FIX Issue #9: Add max limit to prevent absurdly large quantities
        // Prevents integer overflow, database bloat, and potential DoS
        qty: z.number().min(1, "Quantity must be at least 1").max(100, "Quantity cannot exceed 100")
    })).min(1, "At least one item is required").optional(),
    // Optional reason for borrowing (helps with lab equipment approval)
    borrowReason: z.string().max(500, "Reason cannot exceed 500 characters").optional(),
}).refine((data: { start: string; end: string }) => {
    const start = new Date(data.start);
    const end = new Date(data.end);
    return end > start;
}, {
    message: "End time must be after start time",
    path: ["end"],
});

export const groupBookingSchema = z.object({
    resourceId: z.string().min(1, "Resource ID is required"),
    start: z.string().datetime("Invalid start date"),
    end: z.string().datetime("Invalid end date"),
    memberEmails: z.array(z.string().email("Invalid email address")).min(1, "At least one member is required"),
}).refine((data: { start: string; end: string }) => {
    const start = new Date(data.start);
    const end = new Date(data.end);
    return end > start;
}, {
    message: "End time must be after start time",
    path: ["end"],
});

export const rescheduleSchema = z.object({
    start: z.string().datetime("Invalid start date"),
    end: z.string().datetime("Invalid end date"),
}).refine((data: { start: string; end: string }) => {
    const start = new Date(data.start);
    const end = new Date(data.end);
    return end > start;
}, {
    message: "End time must be after start time",
    path: ["end"],
});
