'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { QrCode, CheckCircle, XCircle } from 'lucide-react';

export default function ScannerPage() {
  const [token, setToken] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'qr' | 'manual' | 'return'>('qr');

  const handleValidate = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/qr/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Validation failed');
      } else {
        setResult(data);
        setToken('');
      }
    } catch (err: any) {
      setError('Failed to validate QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async (condition: 'good' | 'damaged') => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/scanner/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, condition }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Return failed');
      } else {
        alert(data.message || 'Equipment returned successfully');
        setBookingId('');
        setResult(null);
      }
    } catch (err: any) {
      setError('Failed to process return');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">QR Scanner</h1>
        <p className="text-gray-600">Scan or enter QR code for check-in/checkout</p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={mode === 'qr' ? 'default' : 'outline'}
          onClick={() => setMode('qr')}
        >
          QR Scan
        </Button>
        <Button
          variant={mode === 'manual' ? 'default' : 'outline'}
          onClick={() => setMode('manual')}
        >
          Manual Entry
        </Button>
        <Button
          variant={mode === 'return' ? 'default' : 'outline'}
          onClick={() => setMode('return')}
        >
          Equipment Return
        </Button>
      </div>

      {mode === 'qr' && (
        <Card>
          <CardHeader>
            <CardTitle>Scan QR Code</CardTitle>
            <CardDescription>Enter the QR token or scan with a camera</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">QR Token</label>
              <Input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste QR token here"
                className="font-mono"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <XCircle className="h-5 w-5" />
                {error}
              </div>
            )}

            {result && (
              <div className="rounded-md bg-green-50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <p className="font-semibold text-green-900">Check-in Successful!</p>
                </div>
                <div className="text-sm text-green-800">
                  <p>Booking ID: {result.booking.id}</p>
                  <p>User ID: {result.booking.userId}</p>
                  <p>Type: {result.booking.kind}</p>
                  {result.booking.items && (
                    <div className="mt-2">
                      <p className="font-medium">Items:</p>
                      {result.booking.items.map((item: any, idx: number) => (
                        <p key={idx}>
                          - {item.name} × {item.qty}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button
              onClick={handleValidate}
              disabled={!token || loading}
              className="w-full"
              size="lg"
            >
              {loading ? 'Validating...' : 'Validate & Check-in'}
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Entry</CardTitle>
            <CardDescription>Enter booking ID for fallback check-in</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Booking ID</label>
              <Input
                type="text"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="Enter booking ID"
              />
            </div>

            <Button
              disabled={!bookingId || loading}
              className="w-full"
              size="lg"
            >
              Lookup Booking
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === 'return' && (
        <Card>
          <CardHeader>
            <CardTitle>Equipment Return</CardTitle>
            <CardDescription>Process equipment returns</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Booking ID</label>
              <Input
                type="text"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                placeholder="Enter booking ID"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <XCircle className="h-5 w-5" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => handleReturn('good')}
                disabled={!bookingId || loading}
                className="flex-1"
                variant="default"
              >
                Return in Good Condition
              </Button>
              <Button
                onClick={() => handleReturn('damaged')}
                disabled={!bookingId || loading}
                className="flex-1"
                variant="destructive"
              >
                Report Damage
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
