Edge Cases Analysis
Overview
This document outlines all identified edge cases across the booking, QR, approval, cron, and policy logic in the system. Each issue includes the current behavior, why it’s problematic, and the recommended fix.

🔴 Critical Edge Cases
1. QR Code Expiration After Booking End Time
Location: app/api/bookings/[id]/qr/route.ts
Issue:
QR codes expire 10 minutes after generation.


They can be generated up to 15 minutes before the booking start.


For short bookings, the QR code may expire after the booking ends.


Example: Booking 2:00–2:05 PM, QR generated at 1:45 PM → expires at 1:55 PM.
Fix: Set the expiration to: min(now + 10 minutes, booking.end).

2. QR Code Expires Before Booking Starts
Location: app/api/bookings/[id]/qr/route.ts
Issue:
QR codes expire 10 minutes after creation.


If generated exactly 15 minutes before the start, they expire 5 minutes before the booking starts.


Fix: Ensure QR validity extends to at least the booking start time: max(now + 10 minutes, booking.start + buffer).

3. Approval Token Expires After Booking Starts
Location: models/ApprovalToken.ts, app/api/approve/[token]/route.ts
Issue:
Approval tokens expire after 7 days.


Booking might start before the 7 days, allowing approval after booking start.


Fix: Token expiration should be: min(createdAt + 7 days, booking.start).

4. No-Show Detection Misses Short Bookings
Location: app/api/cron/route.ts
Issue:
No-show logic uses a 15-minute grace period.


Short bookings may end before the cron job identifies check-ins.


Fix: Mark no-show only if booking.end > now.

5. Equipment Availability and CHECKED_IN State
Location: app/api/bookings/route.ts
Issue:
CHECKED_IN bookings always count as reserved.


Bookings that are CHECKED_IN but past their end time should not reserve equipment.


Fix: Include CHECKED_IN bookings only when end > now.

🟡 Medium-Priority Edge Cases
6. Monthly Limits and Calendar Boundaries
Location: app/api/bookings/route.ts
Issue:
Bookings spanning month boundaries count in both months.


Fix: Decide between calendar month (current behavior) or a rolling 30-day window.

7. Weekly Cancellation Limit (Exactly 7 Days)
Location: app/api/bookings/[id]/cancel/route.ts
Issue:
Current logic includes cancellations exactly 7 days ago.


Fix: Clarify intended behavior and adjust comparison accordingly.

8. Consecutive Booking Detection (1-Minute Window)
Location: lib/policies.ts
Issue:
Bookings exactly 1 minute apart are not considered consecutive.


Fix: Define whether exactly 1 minute apart should count and update logic/documentation.

9. Late Cancellation Boundary Condition
Location: app/api/bookings/[id]/cancel/route.ts
Issue:
Cancelling exactly 2 hours before start is not marked late.


Fix: Decide whether the threshold should be < or <=.

10. Daily vs Weekly Limit Inconsistency
Location: app/api/bookings/route.ts
Issue:
Daily limit uses calendar day.


Weekly limit uses rolling 7 days.


Fix: Make both consistent or document the difference clearly.

Additional Edge Case Classes
1. Authentication & Roles
Missing or invalid session handling.


Role mismatches between student, admin, and guard.


Google auth email domain inconsistencies.


Guard credential edge cases.


2. Time-Based Booking Edge Cases
Start/end boundary issues and extremely short durations.


DST and timezone mismatches.


Advance booking window boundaries and client/server clock skew.


Overlap logic at exact boundaries.


Blocks overlapping bookings or becoming invalid after creation.


3. Group Booking Edge Cases
Member state changes after invitation.


Organizer penalties or suspension after creation.


Cancellations after confirmation.


No leave state for confirmed members.


Conflicting invites for overlapping times.


4. Limits & Policies
Calendar vs rolling windows for daily/weekly/monthly limits.


Interplay between global and type-specific limits.


Cancelling while at cancellation limit.


Suspension boundary conditions.


5. QR Generation & Validation
Early/late generation timing issues.


Using QR after cancellation or approval changes.


Multiple active tokens.


Forwarded/stolen QR codes.


6. Returns & Penalties
Double penalties (late + damaged).


Returns for bookings with no items.


Inventory mismatches due to race conditions.


Overdue items not handled by cron.


7. Admin Resource & Equipment Management
Deleting resources with active bookings.


Changing capacities below reserved amounts.


Shared resource blocks conflicting.


8. Cron & Background Processes
Missed or delayed cron runs.


Multiple cron instances causing duplicate work.


CRON_SECRET rotation issues.


9. Email & Approval Links
Base URL mismatches.


Reused approval links.


Email delivery failures not handled.


10. API & Error Handling
IP-based rate limiting edge cases.


Large or malformed payloads.


Database consistency issues in multi-step flows.


📊 Summary
Priority
Edge Case
Impact
Complexity
🔴 Critical
QR expires after booking end
High
Low
🔴 Critical
QR expires before booking start
High
Low
🔴 Critical
Approval token valid after start
Medium
Low
🔴 Critical
No-show misclassification
Medium
Low
🔴 Critical
CHECKED_IN availability issue
Medium
Medium
🟡 Medium
Monthly boundary issue
Low
Medium
🟡 Medium
Weekly cancellation boundary
Low
Low
🟡 Medium
Consecutive booking window
Low
Low
🟡 Medium
Late cancellation boundary
Low
Low
🟡 Medium
Daily/Weekly inconsistency
Low
Low


🎯 Recommended Fixes (In Order)
Fix QR expiration logic.


Ensure QR validity through booking start.


Adjust approval token expiration.


Improve no-show logic for short bookings.


Clarify CHECKED_IN availability rules.



💡 Key Insight
Most issues arise from fixed timing windows not accounting for booking-specific values. Standardizing with min() and max() logic resolves them consistently.



### 🆕 Additional Edge Cases Found During Analysis

#### 11. Inventory Race Condition (QR Validation)
**Location:** `app/api/qr/validate/route.ts`
**Issue:**
The code fetches `EquipmentItem`, checks availability, decrements, and saves.
This "check-then-act" sequence is not atomic. Two concurrent scans for the same item could both pass the check and decrement, potentially leading to negative inventory or double allocation.
**Fix:** Use `EquipmentItem.findOneAndUpdate` with `$inc` and a query condition `$gte` to ensure atomic updates.

#### 12. Suspended User Check-in
**Location:** `app/api/qr/validate/route.ts`
**Issue:**
The QR validation logic checks if the *scanner* (guard) is authorized, but does **not** check if the *booking owner* (student) is currently suspended.
A student could generate a QR code, get suspended, and still pick up equipment.
**Fix:** Fetch the booking owner and check `user.penaltyPoints` or suspension status before allowing check-in.

#### 13. Inactive Resource Check-in
**Location:** `app/api/qr/validate/route.ts`
**Issue:**
The system does not check if the `Resource` is still `ACTIVE` during check-in.
If a facility is closed (set to INACTIVE) after a booking is made, the user might still be able to check in.
**Fix:** Fetch the resource and check `status === 'ACTIVE'`.

#### 14. Overlapping Bookings Race Condition
**Location:** `app/api/bookings/route.ts`
**Issue:**
The conflict check (finding existing bookings) and the booking creation are separate steps.
While there is a unique index on `{ resourceId: 1, start: 1, end: 1 }`, it only catches *exact* duplicates.
Two users could book overlapping slots (e.g., 2:00-3:00 and 2:30-3:30) simultaneously. Both pass the application-level conflict check, and the unique index doesn't trigger because the start/end times differ.
**Fix:** Use a more robust locking mechanism or a "slots" collection to enforce uniqueness, or use serializable transactions (though MongoDB transactions are snapshot isolated).

#### 15. Group Booking Confirmation Race Condition
**Location:** `app/api/group-bookings/[id]/respond/route.ts`
**Issue:**
When a member accepts, the code fetches the group booking, increments `confirmedCount` in memory, and saves.
Concurrent acceptances will overwrite each other's increment, leading to an incorrect count.
This could prevent the booking from ever reaching the `requiredMinimum` to confirm.
**Fix:** Use `GroupBooking.findOneAndUpdate` with `$inc: { confirmedCount: 1 }` and check the updated document to trigger confirmation.

#### 16. Timezone "Today" Inconsistency
**Location:** `app/api/bookings/route.ts` (and others)
**Issue:**
`new Date().setHours(0,0,0,0)` uses the server's local time.
If the server is in UTC but the university is in IST (+5:30), "today" starts at 5:30 AM IST.
Bookings made between 12:00 AM and 5:30 AM IST would count towards the *previous* day's limit (or next, depending on offset).
**Fix:** Use a consistent timezone (e.g., `Asia/Kolkata`) when calculating "start of day" for limits.

#### 17. Rate Limiting Memory Leak & Clustering
**Location:** `lib/ratelimit.ts`
**Issue:**
The rate limiter uses an in-memory `Map` without any cleanup mechanism.
1. **Memory Leak:** The map grows indefinitely as new IPs connect.
2. **Clustering/Serverless:** State is not shared between instances/functions. A user can bypass limits by hitting different instances.
**Fix:**
- Implement a cleanup interval to remove old entries from the Map.
- For production, use a distributed store like Redis (or Vercel KV).

#### 18. Stale Authentication Sessions
**Location:** `lib/auth/config.ts` & `lib/auth/guards.ts`
**Issue:**
NextAuth uses stateless JWT sessions. The `session` callback only reads from the token, not the database.
If an admin bans a user or changes their role, the user's existing session remains valid with the *old* permissions until the token expires (up to 30 days).
**Fix:**
- In `requireAuth`, fetch the latest user record from the database to verify status/role, rather than relying solely on the session token.
