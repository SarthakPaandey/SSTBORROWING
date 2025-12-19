# 🏟️ SST Facilities Booking — Product Design Specification

> **Project:** SST Campus Booking System   

---

## Table of Contents
1. [Product Overview](#1-product-overview)
2. [User Personas](#2-user-personas)
3. [User Flows by Persona](#3-user-flows-by-persona)
4. [Screen-by-Screen Breakdown](#4-screen-by-screen-breakdown)
5. [UI Components Library](#5-ui-components-library)
6. [State Management & Feedback](#6-state-management--feedback)
7. [Visual Design System](#7-visual-design-system)
8. [Interaction Diagrams](#8-interaction-diagrams)
9. [Edge Cases & Error Handling](#9-edge-cases--error-handling)
10. [Appendix: Technical Constraints](#10-appendix-technical-constraints)

---

## 1. Product Overview

### 1.1 What We're Building
A **mobile-first booking platform** that enables SST students to reserve campus sports facilities (Turf, Basketball Court, Table Tennis, etc.). The system must handle both **instant individual bookings** and **coordinated group reservations** for team sports.

### 1.2 Design Goals

| Priority | Goal | Success Metric |
|:--------:|:-----|:---------------|
| 🥇 | **Speed** — Book a facility in under 30 seconds | < 4 taps from home to confirmation |
| 🥈 | **Clarity** — Instant visibility of availability | Zero user confusion on what's bookable |
| 🥉 | **Delight** — Premium, modern aesthetic | Positive user feedback on design |

### 1.3 Key Features at a Glance

```mermaid
flowchart TB
    subgraph Core["🏟️ Facilities Booking System"]
        direction TB
        
        subgraph Individual["📱 Individual Booking"]
            I1[Browse Facilities]
            I2[Select Time Slot]
            I3[Instant Confirmation]
            I4[QR Access Pass]
        end
        
        subgraph Group["👥 Group Booking"]
            G1[Invite Friends via Email]
            G2[Track Confirmations]
            G3[Auto-Expire if Quorum Not Met]
        end
        
        subgraph Guard["🛡️ Guard Access"]
            S1[QR Scanner]
            S2[Entry/Exit Logging]
            S3[Audio Feedback]
        end
        
        subgraph Admin["⚙️ Admin Oversight"]
            A1[Live Booking Feed]
            A2[Force Cancel]
            A3[Bulk Operations]
        end
    end
    
    style Individual fill:#10B981,color:#fff
    style Group fill:#8B5CF6,color:#fff
    style Guard fill:#3B82F6,color:#fff
    style Admin fill:#F59E0B,color:#fff
```

---

## 2. User Personas

We design for **three distinct users** with different goals and contexts.

### 👨‍🎓 Persona 1: Student (Primary User)
| Attribute | Details |
|:----------|:--------|
| **Goal** | Book a facility quickly between classes |
| **Context** | Using phone, often in a hurry |
| **Pain Points** | Slow loading, unclear availability, complex group coordination |
| **Key Actions** | Browse → Select Slot → Confirm → Show QR at Entry |

### 🛡️ Persona 2: Security Guard
| Attribute | Details |
|:----------|:--------|
| **Goal** | Verify student entitlement, prevent unauthorized access |
| **Context** | Standing at facility entrance, phone or tablet |
| **Pain Points** | Fake QR codes, expired bookings, slow verification |
| **Key Actions** | Scan QR → View Result → Grant/Deny Access |

### 👩‍💼 Persona 3: Admin
| Attribute | Details |
|:----------|:--------|
| **Goal** | Manage facility usage, handle exceptions |
| **Context** | Desktop, monitoring dashboard |
| **Pain Points** | No-shows, overbooking conflicts, weather cancellations |
| **Key Actions** | Monitor → Select Bookings → Cancel/Override |

---

## 3. User Flows by Persona

### 3.1 🎓 Student: Individual Booking Flow

```mermaid
graph LR
    A[🏠 Home] --> B[📋 Facility List]
    B --> C[🏟️ Facility Detail]
    C --> D[📅 Date Picker]
    D --> E[⏰ Time Selector]
    E --> F{Add Equipment?}
    F -- Yes --> G[🏓 Equipment Selection]
    G --> H[✅ Confirm]
    F -- No --> H
    H --> I[🎉 Success Screen]
    I --> J[📱 My Bookings]
```

**Key Moments:**
1. **Discovery** (B): User scans cards to find available facilities.
2. **Decision** (E): Timeline picker shows exactly when slots are free.
3. **Confirmation** (H): Single tap to lock in the booking.
4. **Celebration** (I): Confetti animation, clear next steps.

---

### 3.2 🎓 Student: Group Booking Flow (Team Sports)

```mermaid
graph TD
    A[🏟️ Team Sport Selected] --> B[📅 Select Date & Time]
    B --> C[👥 Enter Friend Emails]
    C --> D{Min 5 Friends?}
    D -- No --> E[🔒 Button Disabled]
    D -- Yes --> F[📧 Send Invitations]
    F --> G[⏳ Pending State]
    G --> H{6+ Confirmed?}
    H -- Yes --> I[✅ Booking Confirmed]
    H -- No --> J{Timeout?}
    J -- Yes --> K[❌ Booking Expired]
    J -- No --> G
```

**Design Challenges:**
- **Email Input UX**: Make it effortless to add 5+ emails (autocomplete from directory?).
- **Waiting State**: Clear progress indicator showing "3/6 confirmed".
- **Failure State**: Graceful expiration message with retry option.

---

### 3.3 🛡️ Guard: Access Verification Flow

```mermaid
graph LR
    A[� Open Scanner] --> B[🔍 Point at QR]
    B --> C{Valid?}
    C -- Yes --> D[🎵 Success Chime]
    D --> E[📗 Green Card: Student Info]
    E --> F[👋 Allow Entry]
    C -- No --> G[🔔 Error Buzz]
    G --> H[📕 Red Card: Error Message]
    H --> I[🚫 Deny Entry]
```

**Audio Feedback:**
- ✅ **Valid**: Pleasant ascending chime (C5 → E5 → G5).
- ❌ **Invalid**: Low error buzz (200Hz square wave).

---

### 3.4 👩‍💼 Admin: Bulk Cancellation Flow

```mermaid
graph TD
    A[📊 Dashboard] --> B[🔍 Filter: Active Bookings]
    B --> C[☑️ Select Multiple]
    C --> D[🗑️ Click Bulk Cancel]
    D --> E[📝 Enter Reason Modal]
    E --> F[⚠️ Confirm Action]
    F --> G[📧 System Sends Cancellation Emails]
    G --> H[🔄 Dashboard Refreshes]
```

**Design Requirement:**
- **Sticky Selection Bar**: When items are selected, show a floating action bar.
- **Destructive Confirmation**: Red modal with clear warning copy.

---

## 4. Screen-by-Screen Breakdown

### 4.1 Facility Discovery Dashboard

![Facility Dashboard](public/docs/facility_browsing_mockup_1766151164372.png)

| Element | Specification |
|:--------|:--------------|
| **Card Layout** | Grid, 2 columns on mobile, 3 on desktop |
| **Card Content** | Emoji (48px), Name (H3), Status Badge, Location (muted) |
| **Status Badge** | `Available` (Green), `Full` (Red), `Closed` (Gray) |
| **Hover State** | Subtle lift (translateY -2px) + glow |
| **Empty State** | Illustration + "No facilities available right now" |

---

### 4.2 Time Slot Selection

![Time Selection UI](public/docs/booking_selection_mockup_1766151187783.png)

| Element | Specification |
|:--------|:--------------|
| **Date Picker** | Horizontal scroll, 7 days ahead, today highlighted |
| **Timeline** | Horizontal bar, 8 AM → 8 PM IST |
| **Slot States** | 🟩 Available, 🟥 Busy, ⬜ Past/Closed |
| **Selection** | Cyan glow on selected range |
| **Duration Pills** | 15m, 30m, 1h, 2h (tap to select) |
| **Quick Pick** | "Next Available" smart suggestion |

---

### 4.3 Group Invitation Form

![Group Booking Screen](public/docs/group_booking_mockup_1766151209970.png)

| Element | Specification |
|:--------|:--------------|
| **Header** | "Invite your team (min 6 players)" |
| **Input Fields** | Dynamic list, starts with 5 rows, "+Add More" button |
| **Validation** | Real-time check for @sst.scaler.com domain |
| **Progress** | "3/6 friends added" with progress bar |
| **CTA** | "Send Invitations" (disabled until min met) |

---

### 4.4 Guard Scanner Interface

| Element | Specification |
|:--------|:--------------|
| **Camera Feed** | Full width, 250x250 QR target box |
| **Scanning Indicator** | Pulsing camera icon + "Point at QR..." |
| **Success Result** | Green card → Student name, Roll No, Resource, Return time |
| **Error Result** | Red card → Error message, reason |
| **Mode Toggle** | Camera / Manual Entry tabs |

---

### 4.5 Admin Booking Management

| Element | Specification |
|:--------|:--------------|
| **Tabs** | All / Active / Completed / Cancelled |
| **Booking Card** | Resource, Student (Name + Roll), Time, Status Badge |
| **Actions** | Cancel (Red outline), Complete (Green outline) |
| **Selection** | Checkbox per row, "Select All" in header |
| **Bulk Bar** | Sticky, shows count + "Cancel Selected" button |

---

## 5. UI Components Library

### 5.1 Buttons

| Variant | Use Case | Style |
|:--------|:---------|:------|
| `gradient` | Primary CTA | Blue-Cyan gradient, white text |
| `outline` | Secondary action | Transparent, colored border |
| `ghost` | Tertiary | No background, text only |
| `destructive` | Dangerous action | Red background |

### 5.2 Badges

| Variant | Color | Use Case |
|:--------|:------|:---------|
| `success` | Emerald | Confirmed, Available |
| `warning` | Amber | Pending, Awaiting |
| `destructive` | Red | Cancelled, Denied |
| `secondary` | Gray | Completed, Inactive |

### 5.3 Cards

- **Background**: `rgba(255,255,255,0.05)` (Glassmorphism)
- **Border**: `rgba(255,255,255,0.1)`
- **Border Radius**: `12px`
- **Shadow**: Subtle glow on hover

---

## 6. State Management & Feedback

Every interactive screen must handle these states:

| State | Visual Treatment |
|:------|:-----------------|
| **Empty** | Illustration + Friendly message + CTA |
| **Loading** | Skeleton shimmer matching content layout |
| **Success** | Confetti + Green checkmark + Auto-redirect |
| **Error** | Inline red banner + Retry button |

### 6.1 Toast Notifications
- **Position**: Bottom center, 16px from edge.
- **Duration**: 3 seconds auto-dismiss.
- **Types**: Success (Green), Error (Red), Warning (Amber), Info (Blue).

### 6.2 Modals
- **Backdrop**: Semi-transparent black (50% opacity).
- **Animation**: Fade in + scale from 0.95.
- **Close**: X button top-right + ESC key + click outside.

---

## 7. Visual Design System

### 7.1 Color Palette (Dark Mode)

#### Background Colors
| Token | Color | Hex | Usage |
|:------|:-----:|:----|:------|
| `bg-primary` | ⬛ | `#0A0A0F` | Main app background |
| `bg-card` | ⬜ | `rgba(255,255,255,0.05)` | Card surfaces, glassmorphism |
| `bg-dark` | ⬛ | `#1A1A2E` | Secondary containers |

#### Text Colors
| Token | Color | Hex | Usage |
|:------|:-----:|:----|:------|
| `text-main` | ⬜ | `#FFFFFF` | Primary text, headings |
| `text-muted` | 🩶 | `#A0A0A0` | Secondary text, captions |

#### Brand & Accent Colors
| Token | Color | Hex | Usage |
|:------|:-----:|:----|:------|
| `accent-blue` | 🔵 | `#0D8CE8` | Brand color, links, primary buttons |
| `accent-cyan` | 🩵 | `#22D3EE` | Highlights, selected states, glow effects |

#### Status Colors
| Token | Color | Hex | Usage |
|:------|:-----:|:----|:------|
| `success` | 🟢 | `#10B981` | Available, confirmed, valid |
| `warning` | 🟡 | `#F59E0B` | Pending, awaiting action |
| `danger` | 🔴 | `#EF4444` | Error, cancelled, denied |
| `info` | 🔵 | `#3B82F6` | Information, neutral states |

### 7.2 Typography

| Element | Font | Size | Weight |
|:--------|:-----|:-----|:-------|
| H1 | Inter | 32px | Bold |
| H2 | Inter | 24px | Semibold |
| H3 | Inter | 18px | Medium |
| Body | Inter | 14px | Regular |
| Caption | Inter | 12px | Regular |
| Mono (times) | JetBrains Mono | 14px | Regular |

### 7.3 Iconography
- **Library**: Lucide React
- **Stroke Width**: 1.5px or 2px
- **Common Icons**: `Clock`, `MapPin`, `Users`, `QrCode`, `Calendar`, `Camera`

### 7.4 Spacing System
- Base unit: `4px`
- Common values: `8px`, `12px`, `16px`, `24px`, `32px`

---

## 8. Interaction Diagrams

### 8.1 Student Group Booking — Technical Sequence

```mermaid
sequenceDiagram
    actor Student
    participant UI as Mobile App
    participant API as Backend
    participant DB as Database
    participant Email as Email Service
    actor Friend

    Student->>UI: Selects Team Sport
    UI->>API: GET /availability
    API-->>UI: Returns busy slots
    
    Student->>UI: Picks time + enters emails
    UI->>UI: Validates emails
    Student->>UI: Taps Send Invites
    
    UI->>API: POST /bookings/group
    API->>DB: Create Booking (PENDING)
    API->>DB: Create GroupBooking
    API->>Email: Send 5 invitation emails
    API-->>UI: Success
    
    UI->>Student: Shows Pending screen
    
    loop Every Friend
        Friend->>API: Clicks confirmation link
        API->>DB: Update member status
        API->>DB: Increment confirmedCount
    end
    
    alt 6+ Confirmed
        DB->>DB: Status = CONFIRMED
        API->>Email: Send QR codes to all
    else Timeout
        DB->>DB: Status = EXPIRED
        API->>Email: Send expiry notice
    end
```

---

### 8.2 Guard QR Validation — Technical Sequence

```mermaid
sequenceDiagram
    actor Guard
    participant Scanner as Scanner App
    participant API as Backend
    participant DB as Database
    actor Student

    Student->>Guard: Shows QR on phone
    Guard->>Scanner: Points camera
    Scanner->>Scanner: Decodes QR token
    
    Scanner->>API: POST /qr/validate
    API->>DB: Find Booking by token
    
    alt Valid & Within Time
        DB-->>API: Returns Booking + User
        API->>DB: Update checkedInAt
        API-->>Scanner: Success + Details
        Scanner->>Scanner: Play success chime
        Scanner->>Guard: Show green card
        Guard->>Student: Allow entry
    else Invalid/Expired
        API-->>Scanner: Error message
        Scanner->>Scanner: Play error buzz
        Scanner->>Guard: Show red alert
        Guard->>Student: Deny entry
    end
```

---

### 8.3 Admin Override — Technical Sequence

```mermaid
sequenceDiagram
    actor Admin
    participant Dash as Dashboard
    participant API as Backend
    participant DB as Database
    participant Email as Email Service
    actor User

    Admin->>Dash: Views Active Bookings
    Admin->>Dash: Filters by Facility
    Admin->>Dash: Selects 5 bookings
    Admin->>Dash: Clicks Bulk Cancel
    
    Dash->>Admin: Shows confirmation modal
    Admin->>Dash: Enters reason
    Admin->>Dash: Confirms
    
    Dash->>API: POST /bulk-cancel
    
    loop Each Booking
        API->>DB: Update status = CANCELLED
        API->>DB: Log admin override reason
        API->>Email: Send cancellation email
    end
    
    API-->>Dash: Success response
    Dash->>Dash: Refresh list
    Dash->>Admin: Show success toast
```

---

## 9. Edge Cases & Error Handling

### 9.1 User-Facing Errors

| Scenario | Message | Action |
|:---------|:--------|:-------|
| Slot just taken | "This slot was just booked by someone else" | Show toast, refresh timeline |
| Daily limit reached | "You've reached your limit of 3 bookings today" | Disable booking, show limit |
| Past time clicked | "Cannot book slots in the past" | Tooltip, prevent selection |
| No network | "Connection lost. Please check your internet" | Retry button |
| QR expired | "This QR code has expired" | Show expiry time, suggest regenerate |

### 9.2 Guard-Specific Errors

| Scenario | Visual | Audio |
|:---------|:-------|:------|
| Booking not found | Red card: "No booking found" | Error buzz |
| Already checked in | Amber card: "Already checked in at 10:30" | Warning beep |
| Time not yet | Amber card: "Booking starts in 45 minutes" | Warning beep |

---

## 10. Appendix: Technical Constraints

> **Note for Designers:** You don't need to solve these, but awareness helps.

### 10.1 Performance
- Availability API: ~500ms latency. Design for loading state.
- QR validation: ~200ms. Camera should stay active.

### 10.2 Race Conditions
- Two users booking same slot simultaneously → One gets error.
- Design: Show toast + auto-refresh timeline.

### 10.3 Timezone
- All times are **IST (Asia/Kolkata)**.
- Display "IST" label where ambiguous.

### 10.4 Booking Limits
- Individual: Max 3 bookings/day, 7 days advance.
- Slot duration: 15 min to 2 hours.
- Group: Minimum 6 members, 10 min confirmation window.

---

**End of Document**

