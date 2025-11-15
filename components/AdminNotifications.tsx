'use client';

import { useEffect } from 'react';
import { NotificationSettings } from './NotificationSettings';
import { areNotificationsEnabled, notifyApprovalNeeded } from '@/lib/notifications';

/**
 * Admin Notifications Component
 * Polls for new approvals and triggers notifications
 */
export function AdminNotifications() {
  useEffect(() => {
    // Poll for new approvals every 30 seconds
    let lastCount = 0;

    const checkForNewApprovals = async () => {
      if (!areNotificationsEnabled()) {
        return;
      }

      try {
        const res = await fetch('/api/admin/lab-approvals?status=PENDING');
        const data = await res.json();
        const currentCount = data.bookings?.length || 0;

        // If count increased, there's a new approval
        if (currentCount > lastCount && lastCount !== 0) {
          const newBookings = data.bookings.slice(0, currentCount - lastCount);

          // Show notification for each new booking
          newBookings.forEach((booking: any) => {
            const userName = booking.userName || booking.userEmail?.split('@')[0] || 'Someone';
            notifyApprovalNeeded(booking.resourceName, userName, booking._id);
          });
        }

        lastCount = currentCount;
      } catch (error) {
        console.error('Failed to check for new approvals:', error);
      }
    };

    // Initial check
    checkForNewApprovals();

    // Poll every 30 seconds
    const interval = setInterval(checkForNewApprovals, 30000);

    return () => clearInterval(interval);
  }, []);

  return <NotificationSettings />;
}
