# SST Booking System

A production-ready unified booking system for SST facilities, rooms, and equipment. Built with Next.js 14, TypeScript, MongoDB, and NextAuth.
## Features

### Core Functionality
- **Facility Booking**: Sports facilities (turf, courts) with slot-based scheduling
- **Room Booking**: Meeting and study rooms with 2-hour slots
- **Equipment Management**: Sports and lab equipment with quantity tracking
- **Group Bookings**: Create and manage group bookings with invitations
- **QR Code Check-in**: Secure check-in/checkout via QR codes with HMAC signing
- **Penalty System**: Automated no-show detection and penalty tracking
- **Lab Approvals**: Admin approval workflow for lab equipment requests
- **Analytics Dashboard**: Real-time statistics and charts for admins

### User Roles
- **Students**: Book facilities, rooms, and equipment via Google OAuth (`@sst.scaler.com`)
- **Admins**: Manage resources, approve lab requests, create blocks (`@scaler.com`)
- **Guards**: Scan QR codes for check-in/checkout with local credentials

### Key Features
- Domain-restricted Google OAuth authentication
- Real-time availability checking with conflict detection
- Shared resource mutex (football/cricket turf)
- Automatic suspension after 5 penalty points
- Booking limits (2/day, 6/week)
- 7-day advance booking window
- Email notifications for bookings and approvals
- Rate limiting on API endpoints
- Zod schema validation

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: MongoDB Atlas with Mongoose ODM
- **Auth**: NextAuth.js with Google OAuth + Credentials
- **Styling**: Tailwind CSS
- **Charts**: Recharts for analytics
- **QR Codes**: qrcode npm package with HMAC security
- **Validation**: Zod schemas
- **Email**: Nodemailer
- **Deployment**: Vercel (free tier compatible)

## System Architecture

```mermaid
flowchart TB
    subgraph Clients
        ST[Student Portal]
        AD[Admin Dashboard]
        GD[Guard Scanner]
    end

    subgraph App["Next.js Application (App Router)"]
        UI[Pages and UI Components]
        MW[Middleware and RBAC]
        AUTH[NextAuth]
        API[API Routes (/app/api/*)]
        CORE[Domain Services<br/>Booking · QR · Policies · Inventory · Penalties]
    end

    subgraph Data["Data Layer"]
        MODELS[Mongoose Models]
        DB[(MongoDB Atlas)]
    end

    subgraph Integrations["External Integrations"]
        GOOGLE[Google OAuth]
        MAIL[SMTP / Nodemailer]
        REDIS[Upstash Redis (Rate Limiting)]
        ISBN[ISBN Metadata APIs]
    end

    CRON[Cron Endpoints (/api/cron, /api/group-bookings/expire)]

    ST --> UI
    AD --> UI
    GD --> UI

    UI --> MW
    MW --> AUTH
    UI --> API
    API --> CORE
    CORE --> MODELS
    MODELS --> DB

    AUTH --> GOOGLE
    CORE --> MAIL
    API --> REDIS
    API --> ISBN
    CRON --> API
```

## Quick Start

Get the system running locally in 5 minutes!

### Prerequisites

- Node.js 18+ and npm (or pnpm)
- MongoDB Atlas account (free tier)
- Google Cloud Console account for OAuth

### 1. Install Dependencies

```bash
git clone <repository-url>
cd SST-Borrowing-equipments
pnpm install
```

### 2. Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a free M0 cluster
3. Create a database user with read/write permissions
4. Whitelist IP: `0.0.0.0/0` (for development only)
5. Click "Connect" → "Connect your application"
6. Copy the connection string (should look like: `mongodb+srv://username:password@cluster.mongodb.net/sst-booking`)

### 3. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable "Google+ API" (or "Google Identity")
4. Navigate to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: **Web application**
6. Add authorized redirect URI:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
7. Copy the **Client ID** and **Client Secret**

### 4. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Next.js & NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here-generate-with-openssl

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Domain Restrictions
ALLOWED_STUDENT_DOMAIN=sst.scaler.com
ALLOWED_ADMIN_DOMAIN=scaler.com

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sst-booking?retryWrites=true&w=majority

# QR Security
QR_HMAC_SECRET=your-qr-secret-generate-with-openssl

# Guard Authentication
GUARD_DEFAULT_PASSWORD_HASH=$2a$10$rKzVmCk7HF.6bGGvqGhYWOqWJ5M0aZ5qLxQxZpGvXFVJYtRYJMGVO
GUARD_ACCESS_KEY=your-secret-access-key-here

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@sst.scaler.com
```

**Generate secrets:**
```bash
openssl rand -base64 32
```

> **Note**: The default guard password hash is for `123456`. Change this in production!

### 5. Seed the Database

```bash
pnpm seed
```

This creates:
- 1 admin user: `admin@scaler.com`
- 2 guards: `guard-1` and `guard-2` (password: `123456`)
- 5 facilities (turf, courts)
- 6 rooms (meeting and study rooms)  
- 10 sports equipment items
- 6 lab equipment items

### 6. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### As a Student

1. **Sign In**: Click "Sign In" and use Google OAuth with your `@sst.scaler.com` email
2. **Browse Resources**: Navigate to Facilities, Rooms, or Equipment
3. **Make a Booking**: 
   - Select a resource
   - Choose date and time slot
   - Confirm booking (lab equipment requires admin approval)
4. **Generate QR Code**: Once confirmed, generate a QR code from your bookings page
5. **Check-in**: Show the QR code to the guard for check-in at the facility

**Booking Limits**:
- Up to 3 active bookings at once (2 facilities, 1 room, 5 equipment items)
- No daily cap (currently disabled)
- Book up to 7 days in advance
- Facility slots: 60 minutes
- Room slots: 120 minutes
- Equipment duration: 120 minutes

### As a Guard

1. **Sign In**: Navigate to the secure guard login URL and use credentials:
   - URL: `/login?gk=YOUR_GUARD_ACCESS_KEY` (get this from your admin)
   - Username: `guard-1` or `guard-2`
   - Password: `123456`
   
   > **Security Note**: The guard login is hidden from the main login page. Guards must use the special URL with the access key (`?gk=...`) to access the guard login form.
2. **Scan QR Code**: 
   - Enter the QR token manually or scan with camera
   - System validates the booking and time window
3. **Issue Equipment**: For equipment bookings, mark items as issued
4. **Process Returns**:
   - Navigate to "Library Returns" or "Equipment Returns"
   - Check equipment condition
   - Mark as damaged if necessary (assigns penalty)

### As an Admin

1. **Sign In**: Use Google OAuth with your `@scaler.com` email
2. **View Dashboard**: See real-time statistics and charts
3. **Manage Approvals**: Review and approve/reject lab equipment requests
4. **Create Blocks**: Block resources for maintenance or events
5. **Manage Penalties**: View user penalties and waive if necessary
6. **Resource Management**: 
   - Add/edit facilities, rooms, and equipment
   - Update equipment inventory
   - View booking history

## System Policies

### Booking Rules
| Rule | Value |
|------|-------|
| Advance booking window | 7 days |
| Daily booking limit | 2 bookings |
| Weekly booking limit | 6 bookings |
| Facility slot duration | 60 minutes |
| Room slot duration | 120 minutes |
| Equipment duration | 120 minutes |

### Penalty System
| Violation | Points | Notes |
|-----------|--------|-------|
| No-show | +1 | Auto-applied after 15 min grace period |
| Late return | +1 | Equipment not returned on time |
| Equipment damage | +2 | Marked by guard during return |
| **Suspension threshold** | **5 points** | **7-day automatic suspension** |

### Special Rules
- **Shared Turf**: Football and cricket facilities share the same ground (mutex lock)
- **Lab Equipment**: Students only, requires admin approval before confirmation
- **QR Validity Window**: Valid from 10 minutes before to 15 minutes after start time
- **Group Bookings**: Support for multiple participants with invitation system

## Project Structure

```
SST-Booking-equipments/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/              # NextAuth endpoints
│   │   ├── bookings/          # Booking CRUD operations
│   │   ├── resources/         # Resource management
│   │   ├── admin/             # Admin endpoints
│   │   ├── scanner/           # QR validation & returns
│   │   └── group-bookings/    # Group booking management
│   ├── user/                  # Student pages
│   ├── guard/                 # Guard pages
│   ├── admin/                 # Admin pages
│   └── login/                 # Authentication page
├── components/                # React components
│   ├── ui/                    # Reusable UI components
│   └── admin/                 # Admin-specific components
├── lib/
│   ├── auth/                  # Auth configuration
│   ├── db.ts                  # MongoDB connection
│   ├── policies.ts            # Business rules & policies
│   ├── qr.ts                  # QR generation & validation
│   ├── email.ts               # Email notifications
│   ├── ratelimit.ts           # API rate limiting
│   ├── validations.ts         # Zod schemas
│   ├── errors.ts              # Custom error classes
│   └── utils.ts               # Utility functions
├── models/                    # Mongoose schemas
│   ├── User.ts
│   ├── Booking.ts
│   ├── Resource.ts
│   ├── Penalty.ts
│   ├── Block.ts
│   ├── GroupBooking.ts
│   └── ...
├── seed/                      # Database seeding scripts
├── types/                     # TypeScript type definitions
├── middleware.ts              # Route protection middleware
└── .env                       # Environment variables (not committed)
```

## API Endpoints

### Authentication
- `GET/POST /api/auth/[...nextauth]` - NextAuth.js endpoints

### Resources
- `GET /api/resources` - List all available resources
- `GET /api/resources/[id]/availability` - Check resource availability

### Bookings
- `GET /api/bookings` - List user bookings
- `POST /api/bookings` - Create new booking
- `PATCH /api/bookings/[id]/cancel` - Cancel booking
- `POST /api/bookings/[id]/qr` - Generate QR code for booking

### Group Bookings
- `POST /api/bookings/group` - Create group booking
- `POST /api/group-bookings/[id]/invite` - Send invitation to user
- `GET /api/group-bookings/invitations` - Get user's invitations

### QR & Scanner (Guard Only)
- `POST /api/qr/validate` - Validate QR token
- `POST /api/scanner/return` - Process equipment return
- `GET /api/scanner/issued` - Get issued equipment list

### Admin
- `GET /api/admin/stats` - Get dashboard statistics
- `POST /api/admin/approvals/[id]` - Approve/reject lab booking
- `GET/POST /api/admin/blocks` - Manage resource blocks
- `GET /api/admin/penalties` - List all penalties
- `PATCH /api/admin/penalties/[id]/waive` - Waive penalty
- `GET/POST/PATCH /api/admin/equipment` - Manage equipment inventory

## Testing

The project includes unit tests using Vitest.

```bash
# Run tests
npm run test

# Run tests with UI
npm run test:ui

# Run tests with coverage
# Run tests with coverage
pnpm test:coverage
```

## CI/CD Pipeline

This project implements a production-grade **DevSecOps** pipeline using GitHub Actions, with **separate CI and CD workflows** for clear separation of concerns.

### Pipeline Architecture

```mermaid
graph LR
    subgraph "CI Pipeline (ci.yml)"
        Push[Git Push] --> Lint[Linting]
        Push --> Test[Unit Tests]
        Push --> SAST[SAST - CodeQL]
        Push --> SCA[SCA - Dependency Audit]
        Lint --> Build[Next.js Build]
        Test --> Build
        SAST --> Docker[Docker Build]
        SCA --> Docker
        Build --> Docker
        Docker --> Trivy[Trivy Scan]
        Docker --> Smoke[Smoke Test]
        Trivy --> CI_Complete[CI Complete]
        Smoke --> CI_Complete
    end
    
    subgraph "CD Pipeline (cd.yml)"
        CI_Complete -.->|Triggers| Push_Registry[Push to DockerHub]
        Push_Registry --> K8s[Deploy to Kubernetes]
        K8s --> DAST[DAST Security Scan]
    end
```

### CI Pipeline Stages (`ci.yml`)
1.  **Quality Checks**: Linting (ESLint) & Unit Tests (Vitest)
2.  **Security**: 
    - **SAST**: CodeQL scans source code for vulnerabilities
    - **SCA**: Checks dependencies for known CVEs
3.  **Build**: Next.js Standalone Build & Multi-stage Docker Build
4.  **Verification**: 
    - Trivy container vulnerability scan
    - Runtime smoke test

### CD Pipeline Stages (`cd.yml`)
1.  **Push to Registry**: Pushes validated image to DockerHub
2.  **Kubernetes Deployment**: Deploys to Kind cluster (simulates production)
3.  **DAST (Dynamic Application Security Testing)**: 
    - Security header checks against running application
    - Sensitive path probing
    - Generates security report

### Required Secrets
To run this pipeline in your own fork, configure these **GitHub Secrets**:

| Secret | Value |
|--------|-------|
| `DOCKERHUB_USERNAME` | Your DockerHub Username |
| `DOCKERHUB_TOKEN` | DockerHub Access Token (PAT) |


## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [Vercel](https://vercel.com) and sign in
2. Click "Import Project"
3. Select your GitHub repository
4. Configure project:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `pnpm build`
   - Output Directory: `.next`
5. Add **all environment variables** from your `.env` file
6. Update `NEXTAUTH_URL` to your Vercel domain (e.g., `https://your-app.vercel.app`)
7. Click "Deploy"

### 3. Post-Deployment

1. Add your Vercel domain to Google OAuth authorized redirect URIs:
   - `https://your-app.vercel.app/api/auth/callback/google`
2. Run the seed script on production (one-time):
   - Option A: Use Vercel CLI to run seed remotely
   - Option B: Create a temporary API endpoint that runs the seed
3. Test the deployment with all user roles

## Troubleshooting

### Database Connection Issues
- ✅ Verify `MONGODB_URI` is correct in environment variables
- ✅ Check IP whitelist in MongoDB Atlas (use `0.0.0.0/0` for dev)
- ✅ Ensure database name matches in connection string
- ✅ Verify database user has read/write permissions

### OAuth Issues
- ✅ Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- ✅ Check authorized redirect URIs in Google Console
- ✅ Ensure correct domain restrictions (`@sst.scaler.com` for students)
- ✅ Try signing in with an incognito window

### QR Code Issues
- ✅ Verify `QR_HMAC_SECRET` is set and consistent
- ✅ Check that booking is confirmed before generating QR
- ✅ Verify time window (10 min before to 15 min after start)
- ✅ Ensure system clocks are synchronized

### Build Errors
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
pnpm install

# Check for TypeScript errors
pnpm lint
```

### "Unauthorized" Errors
- ✅ Verify email domain matches allowed domains in `.env`
  - Students: `@sst.scaler.com`
  - Admins: `@scaler.com`
- ✅ Check that `ALLOWED_STUDENT_DOMAIN` and `ALLOWED_ADMIN_DOMAIN` are set correctly

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Cannot connect to MongoDB | Check connection string and IP whitelist |
| OAuth error on login | Verify redirect URI matches exactly |
| QR code "already used" | Each QR is single-use; generate a new one |
| Booking limit exceeded | Users can only book 2/day, 6/week |
| Resource unavailable | Check for conflicts or admin blocks |

## Security Features

- 🔒 Domain-restricted OAuth (students and admins from specific domains)
- 🔒 HMAC-signed QR codes to prevent forgery
- 🔒 Bcrypt password hashing for guard accounts
- 🔒 **Hidden guard portal** with secret access key (prevents unauthorized login attempts)
- 🔒 API rate limiting on critical endpoints
- 🔒 Zod schema validation on all inputs
- 🔒 Role-based access control via middleware
- 🔒 Environment-based configuration (no hardcoded secrets)

## Future Enhancements

### Planned Features
- [ ] Push notifications for mobile devices
- [ ] WhatsApp notifications via Twilio
- [ ] Recurring bookings (weekly/monthly)
- [ ] Advanced calendar view with drag-and-drop
- [ ] Equipment damage history tracking
- [ ] Tournament scheduling system
- [ ] Payment integration for fines
- [ ] Offline PWA support
- [ ] Mobile app (React Native)

## Support & Contact

For issues or questions:
1. Check the **Troubleshooting** section above
2. Review the **API Endpoints** documentation
3. Check MongoDB and Vercel logs for errors
4. Contact the system administrator

## License

MIT License - Free for educational and commercial use.

---

**Built with ❤️ for SST**
