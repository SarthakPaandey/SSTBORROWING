'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Bell, BellOff, CheckCircle, XCircle } from 'lucide-react';
import {
  requestNotificationPermission,
  getNotificationPermission,
  setNotificationPreference,
  getNotificationPreference,
  areNotificationsEnabled,
  notifyGeneral,
} from '@/lib/notifications';

export function NotificationSettings() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check current permission and preference
    setPermission(getNotificationPermission());
    setEnabled(getNotificationPreference());
  }, []);

  const handleRequestPermission = async () => {
    setLoading(true);

    try {
      const result = await requestNotificationPermission();
      setPermission(result);

      if (result === 'granted') {
        setEnabled(true);
        setNotificationPreference(true);

        // Show test notification
        notifyGeneral(
          '✅ Notifications Enabled!',
          'You will now receive approval notifications'
        );
      } else if (result === 'denied') {
        alert(
          'Notification permission denied. Please enable it in your browser settings to receive notifications.'
        );
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      alert('Failed to request notification permission');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (permission !== 'granted') {
      handleRequestPermission();
      return;
    }

    const newEnabled = !enabled;
    setEnabled(newEnabled);
    setNotificationPreference(newEnabled);

    if (newEnabled) {
      notifyGeneral('🔔 Notifications Enabled', 'You will receive approval notifications');
    }
  };

  const handleTestNotification = () => {
    console.log('Test button clicked');
    console.log('Notifications enabled?', areNotificationsEnabled());
    console.log('Permission:', Notification.permission);

    if (!areNotificationsEnabled()) {
      alert('Please enable notifications first');
      return;
    }

    try {
      const result = notifyGeneral(
        '🧪 Test Notification',
        'This is a test notification. Click to dismiss.'
      );

      if (result) {
        console.log('Notification created successfully');
      } else {
        console.error('Failed to create notification');
        alert('Failed to show notification. Check browser console for details.');
      }
    } catch (error) {
      console.error('Error showing notification:', error);
      alert('Error showing notification: ' + error);
    }
  };

  const getStatusBadge = () => {
    if (permission === 'denied') {
      return <Badge variant="destructive">Blocked</Badge>;
    }
    if (permission === 'granted' && enabled) {
      return <Badge variant="success">Enabled</Badge>;
    }
    if (permission === 'granted' && !enabled) {
      return <Badge variant="secondary">Disabled</Badge>;
    }
    return <Badge variant="warning">Not Set</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-text-main flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Push Notifications
            </CardTitle>
            <CardDescription className="text-text-muted mt-1">
              Get instant browser notifications for pending approvals
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-bg-dark p-4">
          <div className="icon-circle w-10 h-10">
            {enabled && permission === 'granted' ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <XCircle className="h-5 w-5 text-text-muted" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-main">
              {permission === 'denied' && 'Notifications Blocked'}
              {permission === 'default' && 'Notifications Not Enabled'}
              {permission === 'granted' && enabled && 'Notifications Active'}
              {permission === 'granted' && !enabled && 'Notifications Paused'}
            </p>
            <p className="text-xs text-text-muted mt-1">
              {permission === 'denied' &&
                'Please enable notifications in your browser settings'}
              {permission === 'default' &&
                'Click the button below to enable browser notifications'}
              {permission === 'granted' &&
                enabled &&
                'You will receive notifications for new approval requests'}
              {permission === 'granted' &&
                !enabled &&
                'Enable to receive notifications again'}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {permission === 'granted' ? (
            <>
              <Button
                onClick={handleToggle}
                variant={enabled ? 'outline' : 'gradient'}
                className={enabled ? 'flex-1' : 'flex-1 btn-ripple'}
              >
                {enabled ? (
                  <>
                    <BellOff className="mr-2 h-4 w-4" />
                    Disable
                  </>
                ) : (
                  <>
                    <Bell className="mr-2 h-4 w-4" />
                    Enable
                  </>
                )}
              </Button>
              {enabled && (
                <Button onClick={handleTestNotification} variant="outline">
                  Test
                </Button>
              )}
            </>
          ) : (
            <Button
              onClick={handleRequestPermission}
              disabled={loading || permission === 'denied'}
              variant="gradient"
              className="flex-1 btn-ripple"
            >
              <Bell className="mr-2 h-4 w-4" />
              {loading ? 'Requesting...' : 'Enable Notifications'}
            </Button>
          )}
        </div>

        {permission === 'denied' && (
          <div className="rounded-lg bg-danger/10 border border-danger/30 p-3">
            <p className="text-sm text-danger">
              <strong>Notifications are blocked.</strong> To enable:
            </p>
            <ul className="text-xs text-danger mt-2 ml-4 list-disc space-y-1">
              <li>Click the lock icon in your browser's address bar</li>
              <li>Find "Notifications" and set to "Allow"</li>
              <li>Refresh this page and try again</li>
            </ul>
          </div>
        )}

        <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3">
          <p className="text-xs text-accent-blue">
            <strong>💡 Tip:</strong> Notifications work even when this tab is in the background.
            You'll be notified instantly when approval is needed.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
