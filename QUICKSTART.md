# Quick Start Guide

Get the SST Booking System running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Environment Variables

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit `.env` and add:

```env
# Required: Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here

# Required: Get from Google Cloud Console
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Required: Get from MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sst-booking

# Optional: Override defaults
ALLOWED_STUDENT_DOMAIN=sst.scaler.com
ALLOWED_ADMIN_DOMAIN=scaler.com

# Required: Generate with: openssl rand -base64 32
QR_HMAC_SECRET=your-qr-secret
```

## Step 3: Set Up MongoDB Atlas (Free)

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Create a free cluster (M0 tier)
3. Create a database user
4. Whitelist IP: `0.0.0.0/0` (for development)
5. Click "Connect" → "Connect your application"
6. Copy connection string and add to `.env`

## Step 4: Set Up Google OAuth (Free)

1. Go to https://console.cloud.google.com/
2. Create new project
3. Enable "Google+ API"
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: Web application
6. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
7. Copy Client ID and Secret to `.env`

## Step 5: Seed Database

```bash
npm run seed
```

This creates:
- Admin: `admin@scaler.com`
- Guards: `guard-1` / `guard-2` (password: `123456`)
- 8 facilities, 6 rooms, 16 equipment items

## Step 6: Run the App

```bash
npm run dev
```

Open http://localhost:3000

## Test Users

### Admin
- Email: `admin@scaler.com` (via Google OAuth)
- Access: Admin dashboard, approvals, blocks, penalties

### Guard
- Username: `guard-1` or `guard-2`
- Password: `123456`
- Access: Scanner, equipment returns

### Student
- Email: Any `@sst.scaler.com` email (via Google OAuth)
- Access: Book facilities, rooms, equipment

## Common Issues

### "Cannot connect to MongoDB"
→ Check `MONGODB_URI` in `.env`
→ Whitelist your IP in MongoDB Atlas

### "OAuth error"
→ Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
→ Verify redirect URI is correct

### "Unauthorized"
→ Check your email domain matches allowed domains
→ Students: `@sst.scaler.com`
→ Admins: `@scaler.com`

## Next Steps

1. **Test booking flow**: Sign in as student → Book facility → Generate QR
2. **Test approval flow**: Book lab equipment → Sign in as admin → Approve
3. **Test scanner**: Sign in as guard → Enter QR token → Validate
4. **Customize**: Edit `/lib/policies.ts` to change rules

## Deploy to Production

See `README.md` for detailed Vercel deployment instructions.

## Need Help?

1. Check `README.md` for detailed documentation
2. Review `/lib/policies.ts` for business rules
3. Check API routes in `/app/api/` for endpoints
4. Review models in `/models/` for data structure

---

Ready to use! 🚀
