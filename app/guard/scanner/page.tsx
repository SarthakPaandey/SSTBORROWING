'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle, XCircle, Camera, X, Keyboard } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
interface QRValidationResult {
  success: boolean;
  booking: {
    id: string;
    kind: string;
    status: string;
    items?: { name: string; qty: number }[];
    resourceName: string;
    returnBy: string;
  };
  student: {
    id: string;
    name: string;
    email: string;
    rollNumber?: string;
  };
}

// Audio feedback for scans
const playSound = (type: 'success' | 'error') => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === 'success') {
      // Pleasant ascending chime
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } else {
      // Error buzz
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.type = 'square';
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  } catch (e) {
    // Audio not supported, fail silently
    console.debug('Audio feedback not available');
  }
};

export default function ScannerPage() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<QRValidationResult | null>(null);
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
        playSound('error');
      } else {
        setResult(data);
        setToken('');
        playSound('success');
        // Stop camera after successful scan
        if (isScanning) {
          stopScanner();
        }
      }
    } catch {
      setError('Failed to validate QR code');
      playSound('error');
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
            console.debug(errorMessage);
          }
        );
      } catch (err) {
        console.error('Camera error:', err);
        setCameraError(
          (err instanceof Error ? err.message : String(err)) || 'Failed to start camera. Please check permissions and try again.'
        );
        setIsScanning(false);
      }
    };

    initCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <div className="rounded-lg bg-success/10 border-2 border-success/30 p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 text-success" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-success">✅ Check-in Successful!</p>
                    <p className="text-xs text-text-muted">{result.booking.resourceName}</p>
                  </div>
                </div>
                
                {/* Student Info - Important for guard verification */}
                <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3 mb-3">
                  <p className="text-xs text-accent-blue font-medium mb-1">👤 STUDENT</p>
                  <p className="text-lg font-bold text-text-main">{result.student.name}</p>
                  <p className="text-sm text-text-muted">{result.student.email}</p>
                  {result.student.rollNumber && (
                    <p className="text-sm text-text-muted">Roll: {result.student.rollNumber}</p>
                  )}
                </div>

                {/* Return Deadline - Critical info */}
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3">
                  <p className="text-xs text-warning font-medium mb-1">⏰ RETURN BY</p>
                  <p className="text-lg font-bold text-warning">
                    {new Date(result.booking.returnBy).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata'
                    })}
                  </p>
                </div>

                {result.booking.items && result.booking.items.length > 0 && (
                  <div className="bg-bg-dark rounded-lg p-3 mb-3">
                    <p className="text-xs text-text-muted font-medium mb-2">📦 ITEMS ISSUED</p>
                    <div className="space-y-1">
                      {result.booking.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-bg-very-dark rounded px-3 py-2"
                        >
                          <span className="text-text-main font-medium">{item.name}</span>
                          <Badge variant="success">×{item.qty}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-text-muted bg-bg-dark rounded p-2 mb-3">
                  <span className="font-mono">ID: {result.booking.id.slice(-8)}</span>
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
                  className="w-full btn-ripple"
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
              <div className="rounded-lg bg-success/10 border-2 border-success/30 p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 text-success" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-success">✅ Check-in Successful!</p>
                    <p className="text-xs text-text-muted">{result.booking.resourceName}</p>
                  </div>
                </div>
                
                {/* Student Info */}
                <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3 mb-3">
                  <p className="text-xs text-accent-blue font-medium mb-1">👤 STUDENT</p>
                  <p className="text-lg font-bold text-text-main">{result.student.name}</p>
                  <p className="text-sm text-text-muted">{result.student.email}</p>
                  {result.student.rollNumber && (
                    <p className="text-sm text-text-muted">Roll: {result.student.rollNumber}</p>
                  )}
                </div>

                {/* Return Deadline */}
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-3">
                  <p className="text-xs text-warning font-medium mb-1">⏰ RETURN BY</p>
                  <p className="text-lg font-bold text-warning">
                    {new Date(result.booking.returnBy).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata'
                    })}
                  </p>
                </div>

                {result.booking.items && result.booking.items.length > 0 && (
                  <div className="bg-bg-dark rounded-lg p-3 mb-3">
                    <p className="text-xs text-text-muted font-medium mb-2">📦 ITEMS ISSUED</p>
                    <div className="space-y-1">
                      {result.booking.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-bg-very-dark rounded px-3 py-2"
                        >
                          <span className="text-text-main font-medium">{item.name}</span>
                          <Badge variant="success">×{item.qty}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={() => {
                    setResult(null);
                    setError('');
                    setToken('');
                  }}
                  variant="gradient"
                  className="w-full btn-ripple"
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
