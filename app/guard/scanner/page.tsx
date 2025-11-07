'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { QrCode, CheckCircle, XCircle, Camera, X, Keyboard } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

export default function ScannerPage() {
  const [token, setToken] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  const handleValidate = async (scannedToken?: string) => {
    const tokenToValidate = scannedToken || token;
    if (!tokenToValidate) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/qr/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToValidate }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Validation failed');
      } else {
        setResult(data);
        setToken('');
        // Stop camera after successful scan
        if (isScanning) {
          stopScanner();
        }
      }
    } catch (err: any) {
      setError('Failed to validate QR code');
    } finally {
      setLoading(false);
    }
  };

  const startScanner = async () => {
    setCameraError('');
    setError('');
    setResult(null);
    setIsScanning(true);
  };

  // Initialize camera when isScanning becomes true
  useEffect(() => {
    if (!isScanning) return;

    const initCamera = async () => {
      try {
        const html5QrCode = new Html5Qrcode('qr-reader');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' }, // Use back camera on mobile
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            // Prevent multiple scans
            if (isScanningRef.current) return;
            isScanningRef.current = true;

            // Auto-validate the scanned QR code
            await handleValidate(decodedText);

            setTimeout(() => {
              isScanningRef.current = false;
            }, 2000);
          },
          (errorMessage) => {
            // Ignore scan errors (happens continuously while scanning)
          }
        );
      } catch (err: any) {
        console.error('Camera error:', err);
        setCameraError(
          err.message || 'Failed to start camera. Please check permissions and try again.'
        );
        setIsScanning(false);
      }
    };

    initCamera();
  }, [isScanning]);

  const stopScanner = async () => {
    try {
      if (scannerRef.current && isScanning) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }
      setIsScanning(false);
      isScanningRef.current = false;
    } catch (err) {
      console.error('Error stopping scanner:', err);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">QR Scanner</h1>
        <p className="text-text-muted">Scan equipment QR codes for check-in</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={mode === 'camera' ? 'gradient' : 'outline'}
          onClick={() => {
            setMode('camera');
            stopScanner();
          }}
          className={mode === 'camera' ? 'btn-ripple' : ''}
        >
          <Camera className="mr-2 h-4 w-4" />
          Camera Scan
        </Button>
        <Button
          variant={mode === 'manual' ? 'gradient' : 'outline'}
          onClick={() => {
            setMode('manual');
            stopScanner();
          }}
          className={mode === 'manual' ? 'btn-ripple' : ''}
        >
          <Keyboard className="mr-2 h-4 w-4" />
          Manual Entry
        </Button>
      </div>

      {mode === 'camera' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-text-main">Camera Scanner</span>
              {isScanning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={stopScanner}
                  className="hover:bg-danger/10 hover:text-danger hover:border-danger"
                >
                  <X className="h-4 w-4 mr-2" />
                  Stop Camera
                </Button>
              )}
            </CardTitle>
            <CardDescription className="text-text-muted">
              Point your camera at the student's QR code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isScanning && !result && (
              <Button
                onClick={startScanner}
                disabled={loading}
                variant="gradient"
                className="w-full btn-ripple"
                size="lg"
              >
                <Camera className="mr-2 h-5 w-5" />
                Start Camera Scanner
              </Button>
            )}

            {cameraError && (
              <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-3 text-sm text-yellow-500">
                <XCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">Camera Error</p>
                  <p className="text-xs mt-1">{cameraError}</p>
                </div>
              </div>
            )}

            {isScanning && (
              <div className="space-y-3">
                <div
                  id="qr-reader"
                  className="rounded-lg overflow-hidden border-2 border-accent-blue/50 shadow-[0_0_20px_rgba(13,140,232,0.3)]"
                ></div>
                <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-accent-blue text-sm">
                    <Camera className="h-4 w-4 animate-pulse" />
                    <span className="font-medium">Scanning... Point at QR code</span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-danger/10 border border-danger/30 p-3 text-sm text-danger">
                <XCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">Validation Error</p>
                  <p className="text-xs mt-1">{error}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="rounded-lg bg-success/10 border-2 border-success/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-6 w-6 text-success" />
                  <p className="font-bold text-lg text-success">Check-in Successful!</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="bg-bg-dark rounded-lg p-3 space-y-1">
                    <p className="text-text-muted">Booking ID:</p>
                    <p className="text-text-main font-mono font-semibold">
                      {result.booking.id.slice(-8)}
                    </p>
                  </div>
                  <div className="bg-bg-dark rounded-lg p-3 space-y-1">
                    <p className="text-text-muted">Student ID:</p>
                    <p className="text-text-main font-semibold">{result.booking.userId}</p>
                  </div>
                  {result.booking.items && result.booking.items.length > 0 && (
                    <div className="bg-bg-dark rounded-lg p-3">
                      <p className="text-text-muted mb-2 font-medium">Items Issued:</p>
                      <div className="space-y-1">
                        {result.booking.items.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-bg-very-dark rounded px-3 py-2"
                          >
                            <span className="text-text-main font-medium">{item.name}</span>
                            <Badge variant="default">×{item.qty}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => {
                    setResult(null);
                    setError('');
                    if (mode === 'camera') {
                      startScanner();
                    }
                  }}
                  variant="gradient"
                  className="w-full mt-4 btn-ripple"
                >
                  Scan Next QR Code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-text-main">Manual QR Entry</CardTitle>
            <CardDescription className="text-text-muted">
              Paste QR token if camera is not available
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-text-main">
                QR Token
              </label>
              <Input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste the QR token here"
                className="font-mono"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-danger/10 border border-danger/30 p-3 text-sm text-danger">
                <XCircle className="h-5 w-5" />
                <div>
                  <p className="font-medium">Validation Error</p>
                  <p className="text-xs mt-1">{error}</p>
                </div>
              </div>
            )}

            {result && (
              <div className="rounded-lg bg-success/10 border-2 border-success/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-6 w-6 text-success" />
                  <p className="font-bold text-lg text-success">Check-in Successful!</p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="bg-bg-dark rounded-lg p-3 space-y-1">
                    <p className="text-text-muted">Booking ID:</p>
                    <p className="text-text-main font-mono font-semibold">
                      {result.booking.id.slice(-8)}
                    </p>
                  </div>
                  <div className="bg-bg-dark rounded-lg p-3 space-y-1">
                    <p className="text-text-muted">Student ID:</p>
                    <p className="text-text-main font-semibold">{result.booking.userId}</p>
                  </div>
                  {result.booking.items && result.booking.items.length > 0 && (
                    <div className="bg-bg-dark rounded-lg p-3">
                      <p className="text-text-muted mb-2 font-medium">Items Issued:</p>
                      <div className="space-y-1">
                        {result.booking.items.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between bg-bg-very-dark rounded px-3 py-2"
                          >
                            <span className="text-text-main font-medium">{item.name}</span>
                            <Badge variant="default">×{item.qty}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => {
                    setResult(null);
                    setError('');
                    setToken('');
                  }}
                  variant="gradient"
                  className="w-full mt-4 btn-ripple"
                >
                  Validate Another Token
                </Button>
              </div>
            )}

            <Button
              onClick={() => handleValidate()}
              disabled={!token || loading}
              variant="gradient"
              className="w-full btn-ripple"
              size="lg"
            >
              {loading ? 'Validating...' : 'Validate & Check-in'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
