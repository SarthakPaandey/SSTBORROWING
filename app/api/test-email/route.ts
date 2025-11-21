import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, AuthorizationError } from '@/lib/errors';

export async function GET() {
  try {
    // Require authentication
    const user = await requireAuth(['ADMIN']);

    // Send test email
    await sendEmail({
      to: user.email,
      subject: 'SST Booking System - Test Email',
      html: `
        <h1>Email Configuration Test</h1>
        <p>If you're reading this, your email configuration is working correctly!</p>
        <p><strong>Configuration Details:</strong></p>
        <ul>
          <li>SMTP Host: ${process.env.SMTP_HOST}</li>
          <li>SMTP Port: ${process.env.SMTP_PORT}</li>
          <li>SMTP User: ${process.env.SMTP_USER}</li>
          <li>Recipient: ${user.email}</li>
        </ul>
        <p>Timestamp: ${new Date().toISOString()}</p>
      `,
    });

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${user.email}`,
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        user: process.env.SMTP_USER,
        hasPassword: !!process.env.SMTP_PASSWORD,
      },
    });
  } catch (error: any) {
    console.error('Test email error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send test email',
        details: {
          name: error.name,
          code: error.code,
          command: error.command,
        },
      },
      { status: 500 }
    );
  }
}

