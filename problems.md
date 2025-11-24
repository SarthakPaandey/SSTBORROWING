

# 🛠️ Master Code-Fix Specification (Detailed Technical Breakdown)
**Project:** SST Borrowing System
**Scope:** Backend Logic, Security, Race Conditions, and Edge Cases (No DevOps)
**Status:** Action Required

---

## 🔴 Phase 1: Critical Inventory & Data Integrity
*These defects cause permanent database corruption ("phantom inventory") or system-level crashes.*

### 1. Fix Inventory Leaks (The "Infinite Reservation" Bug)
> **Context:** The system tracks inventory using `qtyTotal`, `qtyAvailable`, and `qtyReserved`. `qtyReserved` is incremented when a booking is made to "hold" the item. It *must* be released when the item leaves the shelf or the booking ends.

* **[ ] QR Pickup Logic**
    * **Edge Case:** EC-1, EC-5
    * **Location:** `app/api/qr/validate/route.ts`
    * **The Problem:** Currently, when a Guard scans a QR code to issue equipment, the code decrements `qtyAvailable` (indicating physical removal) but **fails to decrement `qtyReserved`**. This leaves the item "reserved" in the database forever. Over time, `qtyReserved` will keep growing until it hits the `qtyTotal` limit, preventing anyone else from booking that item ever again, even if the shelf is full.
    * **The Fix:** Update the `EquipmentItem` update operation to decrement **both** `qtyAvailable` (`-qty`) AND `qtyReserved` (`-qty`) atomically.

* **[ ] Cancellation Logic**
    * **Edge Case:** EC-11
    * **Location:** `app/api/bookings/[id]/cancel/route.ts`
    * **The Problem:** When a user cancels a booking, the system marks the booking status as `CANCELLED`, but it **skips the step of releasing the inventory reservation**. The comment in the code incorrectly claims "we never actually reduced it," ignoring that `qtyReserved` was indeed incremented at creation. This permanently locks up the stock for that time slot.
    * **The Fix:** Iterate through the booking's items and decrement `qtyReserved` (`$inc: { qtyReserved: -qty }`) in the `EquipmentItem` collection.

* **[ ] Rejection Logic**
    * **Edge Case:** EC-11 (Variant)
    * **Location:** `app/api/admin/approvals/[id]/route.ts`
    * **The Problem:** Similar to cancellation, when an Admin rejects a pending request, the booking status updates to `REJECTED`, but the initial reservation made during the request remains in the database.
    * **The Fix:** If `action === 'reject'`, iterate through items and decrement `qtyReserved`.

* **[ ] No-Show Logic**
    * **Edge Case:** EC-10
    * **Location:** `app/api/cron/route.ts`
    * **The Problem:** The Cron job identifies users who didn't show up and marks them as `NO_SHOW` to apply penalties. However, it forgets to release the equipment they reserved. These "ghost bookings" continue to block availability for other students.
    * **The Fix:** When the Cron job updates a booking to `NO_SHOW`, it must also execute the inventory release logic (decrement `qtyReserved`).

### 2. Fix Race Conditions (The "Double Spend" Bugs)
> **Context:** Node.js handles requests asynchronously. If two requests hit the server at the exact same millisecond, standard logic checks can fail.

* **[ ] Atomic QR Validation**
    * **Edge Case:** EC-11
    * **Location:** `app/api/qr/validate/route.ts`
    * **The Problem:** The endpoint follows a "Check-then-Act" pattern:
        1. Check if token is unused.
        2. Check inventory.
        3. Update inventory.
        4. Mark token as used.
        If two guards scan the same QR code simultaneously, both requests can pass step 1 before either reaches step 4. This results in the same booking being issued twice, causing negative inventory.
    * **The Fix:** Wrap the entire function in a **MongoDB Transaction** (`session.startTransaction()`). This ensures that if one request is processing, the second one waits or fails.

* **[ ] Atomic Equipment Returns**
    * **Edge Case:** EC-2
    * **Location:** `app/api/scanner/return/route.ts`
    * **The Problem:** Similar to validation, if a guard double-taps the "Return" button, the system processes two return requests. Both requests will increment `qtyAvailable`, potentially doubling the stock count in the database artificially (e.g., returning 1 laptop results in +2 stock).
    * **The Fix:** Wrap in a transaction. Inside the transaction, explicitly check `if (booking.returnedAt !== null) throw Error`. This ensures the second request fails instantly.

* **[ ] Atomic Group Confirmation**
    * **Edge Case:** EC-15
    * **Location:** `app/api/group-bookings/[id]/respond/route.ts`
    * **The Problem:** The code fetches the group booking, reads `confirmedCount` into a JavaScript variable (e.g., `count = 5`), adds 1 (`count = 6`), and saves it back. If two users accept invites at the same time, both start with `5` and both save `6`. The count should be `7`. This prevents the group from ever reaching the "Confirmed" threshold.
    * **The Fix:** Do not calculate in JavaScript. Use the MongoDB atomic operator `$inc: { confirmedCount: 1 }`.

---

## 🟠 Phase 2: Security & Authentication
*These flaws allow users to bypass rules or compromise accounts.*

* **[ ] Fix Weak Error Handling**
    * **Location:** `lib/auth/guards.ts`
    * **The Problem:** The auth middleware throws generic `Error('Unauthorized')` objects. Generic errors are often caught by global error handlers (or `try/catch` blocks in routes) and ignored or logged without stopping execution properly in some edge cases. It also makes it impossible for the frontend to distinguish between "You need to log in" and "Server crashed".
    * **The Fix:** Throw specific, typed errors (e.g., `new AuthenticationError()`, `new AuthorizationError()`). Ensure the global error handler sends the correct HTTP 401/403 status codes based on these types.

* **[ ] Remove Hardcoded Credentials**
    * **Edge Case:** EC-31
    * **Location:** `lib/auth/config.ts`
    * **The Problem:** The default password hash for Guard accounts is hardcoded in the source code. If this code is ever public or shared, anyone can log in as a guard.
    * **The Fix:** Delete the hash from the code. Add a `mustChangePassword` boolean flag to the User model. On login, if this flag is true, force a redirect to a password change form.

* **[ ] Fix Stale Sessions**
    * **Edge Case:** EC-18
    * **Location:** `lib/auth/guards.ts` (inside `requireAuth`)
    * **The Problem:** NextAuth uses JWTs (stateless sessions). The token contains the user's role at the time of login. If an Admin bans a user or revokes their role, their existing JWT remains valid until it expires (up to 30 days). The banned user can still book items.
    * **The Fix:** Inside `requireAuth`, do not trust the token blindly. Perform a lightweight DB lookup (`User.findById(token.sub).select('role suspendedUntil')`) to verify the user is still active and holds the correct role.

---

## 🟡 Phase 3: Edge Cases & Timing Logic
*Logic errors where the system misunderstands time, leading to unfair penalties or allowed loopholes.*

### Time & Expiration
* **[ ] Fix QR Expiration (Post-Booking)**
    * **Edge Case:** EC-8
    * **Location:** `app/api/bookings/[id]/qr/route.ts`
    * **The Problem:** QR codes are currently valid for a fixed 10 minutes. If a student books a 5-minute slot (e.g., 2:00 PM - 2:05 PM) and generates the QR at 1:59 PM, the QR remains valid until 2:09 PM—4 minutes *after* their booking has ended. This allows them to take equipment they are no longer entitled to.
    * **The Fix:** Set expiration dynamically: `expiresAt = Math.min(Date.now() + 10*60000, booking.end.getTime())`.

* **[ ] Fix QR Expiration (Pre-Booking)**
    * **Edge Case:** EC-8 (Variant)
    * **Location:** `app/api/bookings/[id]/qr/route.ts`
    * **The Problem:** Students can generate QRs 15 minutes before start. If they generate it at 1:45 PM for a 2:00 PM booking, the 10-minute lifespan means it expires at 1:55 PM—5 minutes *before* they can even use it.
    * **The Fix:** Ensure the expiration time extends at least 5-10 minutes *into* the booking slot. `expiresAt = Math.max(calculatedExpiry, booking.start.getTime() + 5*60000)`.

* **[ ] Fix No-Show Cron Logic**
    * **Edge Case:** EC-4
    * **Location:** `app/api/cron/route.ts`
    * **The Problem:** The Cron job runs every 15 minutes and looks for bookings that started >15 minutes ago. If a booking is only 10 minutes long (e.g., 2:00-2:10), it finishes before the Cron job (running at 2:15) sees it. The user never gets marked "No Show" and avoids penalties.
    * **The Fix:** Change the query to look for: `end < Now` AND `status === 'CONFIRMED'` AND `checkedInAt === null`. This catches all completed bookings that were missed, regardless of duration.

### Validation & Rules
* **[ ] Block Suspended Users**
    * **Edge Case:** EC-12
    * **Location:** `app/api/qr/validate/route.ts`
    * **The Problem:** The validation endpoint checks if the *Guard* scanning the code is authorized. It fails to check if the *Student* who owns the booking is currently suspended. A suspended student can still generate a QR and have it scanned.
    * **The Fix:** Fetch the student user doc and check `if (student.suspendedUntil > new Date()) throw Error`.

* **[ ] Block Inactive Resources**
    * **Edge Case:** EC-13
    * **Location:** `app/api/qr/validate/route.ts`
    * **The Problem:** If a lab is marked "Inactive" (e.g., for emergency maintenance) *after* students have already made bookings, the system still allows those students to check in via QR.
    * **The Fix:** Fetch the `Resource` doc and check `if (resource.status !== 'ACTIVE') throw Error`.

* **[ ] Prevent Duplicate Item Bookings**
    * **Edge Case:** EC-19
    * **Location:** `app/api/bookings/route.ts`
    * **The Problem:** The API accepts an array of items. A user can send `{ items: [{id: "Cam1", qty: 1}, {id: "Cam1", qty: 1}] }`. The logic processes these sequentially. Both checks pass individually (stock is available), but collectively they might request more than available, or simply confuse the return logic.
    * **The Fix:** Add a validation step to ensure all `itemId`s in the `items` array are unique.

---

## 🟢 Phase 4: Code Stability & Hygiene
*Refactoring to prevent future bugs and ensure reliability.*

* **[ ] Standardize Timezones**
    * **Edge Case:** EC-12, EC-16
    * **Location:** Global / `lib/timezone.ts`
    * **The Problem:** `new Date()` uses the server's local time. In production (e.g., Vercel/AWS), this is usually UTC. The University is likely in IST (UTC+5:30). This causes "Today" and "Late" calculations to be off by 5.5 hours, potentially marking on-time returns as late or allowing bookings in the past.
    * **The Fix:** Create a `lib/timezone.ts` utility. Replace all `new Date()` calls involved in business logic with a helper that enforces `Asia/Kolkata`.

* **[ ] Fix Rate Limiting Memory Leak**
    * **Edge Case:** EC-17
    * **Location:** `lib/ratelimit.ts`
    * **The Problem:** The current rate limiter stores IP addresses in a Javascript `Map` (in-memory). It never deletes them. Over weeks of runtime, this Map will grow infinitely with every unique visitor IP, eventually causing the server to crash (Out of Memory).
    * **The Fix:** Add a simple cleanup interval (`setInterval`) that runs every hour and deletes entries from the Map that are older than the rate limit window.

* **[ ] Prevent Equipment Deletion**
    * **Edge Case:** Crash Prevention
    * **Location:** `app/api/admin/equipment/[id]/route.ts`
    * **The Problem:** Admins can currently delete an equipment item even if students have future bookings for it. When those students try to view their bookings or generate a QR code, the app crashes because the referenced equipment ID no longer exists in the DB.
    * **The Fix:** Before deletion, query the `Booking` collection. If any active bookings (`PENDING`, `CONFIRMED`) contain this `itemId`, throw a 409 Conflict error and block the deletion.