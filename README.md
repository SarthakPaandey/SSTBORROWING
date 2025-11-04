# SST Booking System

A production-ready unified booking system for SST facilities, rooms, and equipment. Built with Next.js 14, TypeScript, MongoDB, and NextAuth.

## Features

### Core Functionality
- **Facility Booking**: Sports facilities (turf, courts, gym) with slot-based scheduling
- **Room Booking**: Meeting and study rooms with 2-hour slots
- **Equipment Management**: Sports and lab equipment with quantity tracking
- **QR Code Check-in**: Secure check-in/checkout via QR codes
- **Penalty System**: Automated no-show detection and penalty tracking
- **Lab Approvals**: Admin approval workflow for lab equipment

### User Roles
- **Students**: Book facilities, rooms, and equipment via Google OAuth (@sst.scaler.com)
- **Admins**: Manage resources, approve lab requests, create blocks (@scaler.com)
- **Guards**: Scan QR codes for check-in/checkout with local credentials

### Key Features
- Domain-restricted Google OAuth authentication
- Real-time availability checking
- Shared resource mutex (football/cricket turf)
- Automatic suspension after 5 penalty points
- Booking limits (2/day, 6/week)
- 7-day advance booking window
- QR code generation with HMAC signing

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: MongoDB Atlas
- **Auth**: NextAuth.js with Google OAuth + Credentials
- **Styling**: Tailwind CSS
- **QR Codes**: qrcode npm package
- **Deployment**: Vercel (free tier)

## Prerequisites

- Node.js 18+ and npm
- MongoDB Atlas account (free tier)
- Google Cloud Console account for OAuth

## Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd SST-Borrowing\ equipments
npm install
```

### 2. Set Up MongoDB Atlas

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Create a database user
4. Get your connection string (should look like: `mongodb+srv://username:password@cluster.mongodb.net/sst-booking`)
5. Whitelist your IP (or use `0.0.0.0/0` for development)

### 3. Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: Web application
6. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://yourdomain.com/api/auth/callback/google` (production)
7. Copy Client ID and Client Secret

### 4. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update `.env` with your values:

```env
# Next.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Domain restrictions
ALLOWED_STUDENT_DOMAIN=sst.scaler.com
ALLOWED_ADMIN_DOMAIN=scaler.com

# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sst-booking?retryWrites=true&w=majority

# QR Security
QR_HMAC_SECRET=<generate-with-openssl-rand-base64-32>

# Guard Password (bcrypt hash of "123456")
GUARD_DEFAULT_PASSWORD_HASH=$2a$10$rKzVmCk7HF.6bGGvqGhYWOqWJ5M0aZ5qLxQxZpGvXFVJYtRYJMGVO
```

Generate secrets:
```bash
openssl rand -base64 32
```

### 5. Seed the Database

```bash
npm run seed
```

This will create:
- 1 admin user: `admin@scaler.com`
- 2 guards: `guard-1` and `guard-2` (password: `123456`)
- 8 facilities (turf, courts, gym)
- 6 rooms (meeting and study rooms)
- 10 sports equipment items
- 6 lab equipment items

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### As a Student

1. **Sign In**: Use Google OAuth with your `@sst.scaler.com` email
2. **Browse**: Navigate to Facilities, Rooms, or Equipment
3. **Book**: Select date/time and confirm booking
4. **Get QR**: Generate QR code for confirmed bookings
5. **Check-in**: Show QR to guard for check-in

**Booking Limits**:
- 2 bookings per day
- 6 bookings per week
- Maximum 7 days in advance
- Facility slots: 60 minutes
- Room slots: 120 minutes
- Equipment: 120 minutes

### As a Guard

1. **Sign In**: Use username `guard-1` or `guard-2` with password `123456`
2. **Scan**: Enter QR token or scan with camera
3. **Validate**: System checks booking and issues equipment/facility access
4. **Return**: Process equipment returns (good/damaged condition)

### As an Admin

1. **Sign In**: Use Google OAuth with your `@scaler.com` email
2. **Dashboard**: View system statistics
3. **Approvals**: Review and approve lab equipment requests
4. **Blocks**: Create maintenance/event blocks
5. **Penalties**: View and waive user penalties
6. **Resources**: Manage facilities, rooms, and equipment inventory

## System Policies

### Booking Rules
- **Advance Window**: 7 days
- **Daily Limit**: 2 bookings
- **Weekly Limit**: 6 bookings
- **Facility Duration**: 60 minutes (30 for gym)
- **Room Duration**: 120 minutes
- **Equipment Duration**: 120 minutes

### Penalties
- **No-show**: +1 point (auto-applied after 15 min grace)
- **Late Return**: +1 point
- **Damage**: +2 points
- **Suspension**: 5+ points = 7-day suspension

### Special Rules
- **Shared Turf**: Football and cricket share the same ground (mutex)
- **Lab Equipment**: Students only, requires admin approval
- **QR Validity**: 10 min before to 15 min after start time

## Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo>
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [Vercel](https://vercel.com)
2. Click "Import Project"
3. Select your GitHub repository
4. Add all environment variables from `.env`
5. Update `NEXTAUTH_URL` to your Vercel domain
6. Add Vercel domain to Google OAuth authorized redirects
7. Deploy!

### 3. Run Seed Script on Production

After first deployment:

1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `vercel link`
3. Run seed remotely or use a one-time serverless function

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── user/             # Student pages
│   ├── guard/            # Guard pages
│   ├── admin/            # Admin pages
│   └── login/            # Login page
├── components/           # React components
│   └── ui/               # UI components
├── lib/
│   ├── auth/             # Auth configuration
│   ├── db.ts             # MongoDB connection
│   ├── policies.ts       # Business rules
│   ├── qr.ts             # QR generation/validation
│   └── utils.ts          # Utilities
├── models/               # Mongoose models
├── seed/                 # Database seeding
├── middleware.ts         # Route protection
└── types/                # TypeScript types
```

## API Endpoints

### Authentication
- `GET/POST /api/auth/[...nextauth]` - NextAuth endpoints

### Resources
- `GET /api/resources` - List resources
- `GET /api/resources/[id]/availability` - Check availability

### Bookings
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `PATCH /api/bookings/[id]/cancel` - Cancel booking
- `POST /api/bookings/[id]/qr` - Generate QR code

### QR & Scanner
- `POST /api/qr/validate` - Validate QR token (Guard)
- `POST /api/scanner/return` - Process equipment return (Guard)

### Admin
- `POST /api/admin/approvals/[id]` - Approve/reject lab booking
- `GET/POST /api/admin/blocks` - Manage resource blocks
- `GET/POST /api/admin/penalties` - Manage penalties
- `GET/POST/PATCH /api/admin/equipment` - Manage equipment inventory

## Troubleshooting

### Database Connection Issues
- Verify MongoDB connection string
- Check IP whitelist in MongoDB Atlas
- Ensure database name is correct

### OAuth Issues
- Verify Google OAuth credentials
- Check authorized redirect URIs
- Ensure correct domain restrictions

### QR Code Issues
- Verify `QR_HMAC_SECRET` is set
- Check token expiration times
- Ensure booking is confirmed before QR generation

### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npm run lint`

## Future Enhancements

### Phase 2 (Optional)
- Email notifications via Nodemailer
- WhatsApp notifications (Twilio/similar)
- Advanced analytics dashboard
- Calendar view with drag-and-drop
- Recurring bookings
- Equipment damage tracking
- Tournament scheduling

### Phase 3 (Optional)
- Mobile app (React Native)
- Offline-first PWA
- Real-time notifications
- Payment integration for damages
- Advanced reporting

## Support

For issues or questions:
1. Check troubleshooting section
2. Review API documentation
3. Check MongoDB and Vercel logs
4. Contact system administrator

## License

MIT License - Free for educational and commercial use.

---

Built with ❤️ for SST by the development team.
