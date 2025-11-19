# Email Notification Setup Guide

## Overview
The email notification system sends approval/rejection emails **only to admin users** when a booking requires approval. Admins can approve or reject bookings directly from the email without logging in.

## ✅ Confirmation: Only Admins Receive Emails

The system is already configured to send emails **only to admin users**. Here's the relevant code:

```typescript
// From app/api/bookings/route.ts (lines 430-432)
const admins = await User.find({ role: 'ADMIN' });
const adminEmails = admins.map(admin => admin.email).filter(Boolean);
```

This queries the database for all users with `role: 'ADMIN'` and sends emails only to those email addresses.

## Required Environment Variables

Add these to your `.env` file (or `.env.local` for local development):

```env
# SMTP Email Configuration (Required)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Base URL for email links (Required)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
# OR use NEXTAUTH_URL if already set
```

## Setup Instructions

### 1. Gmail Setup (Recommended)

If using Gmail, follow these steps:

1. **Enable 2-Factor Authentication**
   - Go to your Google Account settings
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "SST Booking System" as the name
   - Copy the generated 16-character password

3. **Configure Environment Variables**
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=xxxx xxxx xxxx xxxx  # The app password (remove spaces)
   ```

### 2. Other Email Providers

#### Outlook/Office 365
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=your-email@outlook.com
SMTP_PASSWORD=your-password
```

#### SendGrid
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

#### Mailgun
```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=your-mailgun-username
SMTP_PASSWORD=your-mailgun-password
```

### 3. Base URL Configuration

Set the base URL where your application is hosted:

**For Production:**
```env
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

**For Local Development:**
```env
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Note:** If `NEXT_PUBLIC_BASE_URL` is not set, it will fall back to `NEXTAUTH_URL` or `http://localhost:3000`.

## How It Works

1. **When a booking requires approval:**
   - System queries database for all users with `role: 'ADMIN'`
   - Generates secure approval/rejection tokens
   - Sends email to all admin email addresses

2. **Email contains:**
   - Booking details (student name, resource, time, etc.)
   - Two buttons: "Approve" and "Reject"
   - Secure links that work without login

3. **Admin clicks button:**
   - Token is validated
   - Booking is approved/rejected immediately
   - Admin sees confirmation page
   - Token is marked as used (one-time use)

## Testing Without Email Configuration

If SMTP is not configured, the system will:
- Still create bookings successfully
- Log email details to console instead of sending
- Not fail the booking creation process

You'll see logs like:
```
Email not sent (SMTP not configured): {
  to: ['admin@scaler.com'],
  subject: 'Booking Approval Required: Lab Equipment'
}
```

## Security Features

- ✅ Tokens expire after 7 days
- ✅ Tokens can only be used once
- ✅ Tokens are cryptographically secure (32-byte random)
- ✅ Action validation (approve token can't be used to reject)
- ✅ Booking status validation (can't approve already processed bookings)

## Troubleshooting

### Emails not sending?

1. **Check environment variables:**
   ```bash
   # Make sure these are set
   echo $SMTP_USER
   echo $SMTP_PASSWORD
   ```

2. **Check logs:**
   - Look for "Email not sent (SMTP not configured)" in console
   - Check for "Failed to send email" errors

3. **Test SMTP connection:**
   - Verify SMTP credentials are correct
   - Check firewall/network restrictions
   - For Gmail: Ensure "Less secure app access" is enabled OR use App Password

### Links not working?

1. **Check base URL:**
   - Ensure `NEXT_PUBLIC_BASE_URL` is set correctly
   - Must match your actual domain (no trailing slash)

2. **Check token expiration:**
   - Tokens expire after 7 days
   - Check `expiresAt` field in database

## Database Requirements

The system uses the `approval_tokens` collection to store:
- Booking ID
- Token (unique, indexed)
- Action (approve/reject)
- Expiration date
- Used status

Tokens are automatically cleaned up after 7 days via MongoDB TTL index.

## Admin User Requirements

For emails to be sent, you need at least one user in the database with:
- `role: 'ADMIN'`
- Valid `email` field

To check admin users:
```javascript
// In MongoDB shell or via API
db.users.find({ role: 'ADMIN' })
```

## Example Email

The email sent to admins includes:
- Professional HTML formatting
- Booking details table
- Large, clickable approve/reject buttons
- Security notice about link expiration
- Booking ID for reference

