# � Product Design Spec: Facilities Booking Experience

**Project:** SST Booking System - Facilities Module  
**Audience:** UI/UX Designers, Product Managers  
**Status:** Ready for Design Review  

---

## 1. Design Objective
Create a seamless, premium mobile-first experience for students to book sports infrastructure. The interface must balance **speed** for individual users (e.g., booking a Table Tennis table) with **clarity** for complex group coordination (e.g., organizing a football match).

### Core Design Values
*   **Clarity**: Instant visibility of "What is available right now?"
*   **Speed**: Minimized clicks to confirm a booking.
*   **Premium Feel**: Use glassmorphism, dark mode aesthetics, and fluid micro-interactions to reflect a high-tech campus environment.

---

## 2. User Flows & Key Screens

### 2.1 The Discovery Dashboard (Home)
**User Goal:** "I want to see what I can play right now."

*   **UI Requirement:** A grid of "Facility Cards".
*   **Visual Hierarchy:**
    1.  **Sport Emoji/Icon**: Immediate recognition.
    2.  **Status Badge**: "Available" (Green) vs "Full" (Red).
    3.  **Name**: e.g., "Main Turf".
*   **Interaction:** Hovering over a card should trigger a subtle lift/glow effect.

![Facility Dashboard](public/docs/facility_browsing_mockup_1766151164372.png)

### 2.2 The Time Scanner (Booking Interface)
**User Goal:** "I need a slot between 5 PM and 7 PM."

*   **Primary Component: The Timeline Picker**
    *   **Visual Metaphor**: A horizontal day timeline.
    *   **States**:
        *   🟩 **Green Zone**: Available time.
        *   🟥 **Red Zone**: Already booked (Busy).
        *   ⬜ **Gray Zone**: Past time/Closed.
        *   ✨ **Glow/Highlight**: The currently selected duration (e.g., 1 hour).
*   **Controls**:
    *   **Duration Pill**: User selects how long they want to play (15m, 30m, 1h, 2h).
    *   **Date Switcher**: Horizontal scroll or calendar modal for next 7 days.

![Time Selection UI](public/docs/booking_selection_mockup_1766151187783.png)

### 2.3 logic Branch: Individual vs. Group
The system behaves differently based on the facility type.

```mermaid
graph TD
    Start([User Selects Facility]) --> TypeCheck{Is it a Team Sport?}
    
    %% Design Note: This decision is automatic based on facility type, 
    %% but the UI changes significantly.
    
    TypeCheck -- No (e.g. Table Tennis) --> SimpleFlow["Show 'Confirm' Button"]
    
    TypeCheck -- Yes (e.g. Football) --> GroupFlow["Show 'Invite Friends' Form"]
    GroupFlow --> MinCheck{min. 5 Friends?}
    MinCheck -- No --> DisabledBtn["Disable 'Book' Button"]
    MinCheck -- Yes --> ActiveBtn["Enable 'Send Invites' Button"]
```

### 2.4 The Guard Interface (Access Control)
**User Goal:** "Verify student entitlement and log entry/exit."

*   **Primary Interaction**: One-tap QR Scanner (Camera or Manual Code Entry).
*   **Feedback States**:
    *   ✅ **Valid**: High-pitched chime + Green Screen + Student Details (Name, Photo).
    *   ❌ **Invalid/Expired**: Low buzz + Red Screen + Error Message ("Booking Expired").
*   **Key Information Displayed**:
    *   **Resource**: "Basketball Court"
    *   **Time Remaining**: "45 mins left"
    *   **Identity**: Name & Roll Number (to prevent ID swapping).

### 2.5 The Admin Portal (Oversight)
**User Goal:** "Manage facility usage and handle exceptions."

*   **Dashboard Features**:
    *   **Live Feed**: Real-time list of all active/upcoming bookings.
    *   **Filters**: "Active", "Completed", "Cancelled".
*   **Critical Actions**:
    *   **Force Cancel**: Remove a booking (e.g., for unexpected maintenance).
        *   *UI*: Red outline button -> Modal -> Reason Input.
    *   **Bulk Select**: Cancel multiple bookings at once (e.g., Rainy day closes open turf).

---

## 3. Interaction Patterns & Per-Persona Flows

### 3.1 Scenario: The "Happy Path" Group Booking (Student)

```mermaid
sequenceDiagram
    participant User
    participant App as UI Interface
    participant System as Backend

    User->>App: Opens "Football Turf" Page
    App->>System: 1. Fetch Availability
    System-->>App: Returns: [10AM-11AM is Busy]
    
    App->>App: Renders Timeline (Red bar at 10AM)
    
    User->>App: Clicks 4:00 PM Slot
    App->>App: Highlights 4:00 - 5:00 PM
    App->>App: Reveals "Invite Friends" Form (Slide down animation)
    
    User->>App: Types 5 emails
    App->>App: Validates emails (Green checkmarks)
    App->>App: Unlocks "Send Invites" Button
    
    User->>App: Clicks "Send Invites"
    App->>App: Shows Loading Spinner
    App->>User: Shows "Success" Modal + Redirects
```

### 3.2 Scenario: Guard Check-In Flow
How the Guard validates a student.

```mermaid
sequenceDiagram
    actor Guard
    participant Scanner as Scanner App
    participant BE as Backend API
    actor Student

    Student->>Guard: Shows QR Code
    Guard->>Scanner: Points Camera
    Scanner->>BE: Sends Token
    
    alt Token Valid
        BE-->>Scanner: Returns {Booking + Student Details}
        Scanner->>Guard: Plays "Chime" (Success Sound)
        Scanner->>Guard: Displays Green "Access Granted" Card
        Guard->>Student: Allows Entry
    else Token Invalid/Expired
        BE-->>Scanner: Returns Error
        Scanner->>Guard: Plays "Buzz" (Error Sound)
        Scanner->>Guard: Displays Red "Access Denied" Alert
        Guard->>Student: Rejects Entry
    end
```

### 3.3 Scenario: Admin Override
When an admin needs to intervene (e.g., Force Cancel for Rain).

```mermaid
sequenceDiagram
    actor Admin
    participant Dash as Admin Dashboard
    participant BE as Backend
    participant Mail as Email Service
    actor User

    Admin->>Dash: Selects "Active Bookings"
    Dash->>Dash: Filters by "Main Turf"
    
    Admin->>Dash: Clicks "Select All"
    Admin->>Dash: Clicks "Bulk Cancel"
    Dash->>Admin: Prompts for Reason
    Admin->>Dash: Enters "Heavy Rain Forecast"
    
    Dash->>BE: POST /bulk-cancel {ids, reason}
    BE->>BE: Update Status -> CANCELLED
    BE->>Mail: Sends "Booking Cancelled" Email to Users
    BE-->>Dash: Success Response
    
    Dash->>Admin: Shows Toast "5 Bookings Cancelled"
    Dash->>Dash: Refreshes List (Empty)
```



---

## Appendix: Developer Constraints
*(For reference - Design does not need to solve these, but should be aware)*
*   **Latency**: Checking availability might take ~500ms. UI needs to handle this delay gracefully.
*   **Race Conditions**: Two users might book the same slot simultaneously. The second user will get an error on submit. Plan for an alert: "Sorry, this slot was just taken."
*   **Timezones**: All times are IST. Design should clearly state "IST" if ambiguous.
