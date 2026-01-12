'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle, XCircle, Camera, X, Keyboard, BookOpen } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface ReturnResult {
  success: boolean;
  booking: {
    id: string;
    kind: string;
    status: string;
    resourceName: string;
    returnedAt: string;
  };
  book: {
    name: string;
    author?: string;
    isbn?: string;
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
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } else {
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.type = 'square';
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  } catch (e) {
    console.debug('Audio feedback not available');
  }
};

export default function LibraryReturnsPage() {
  const [isbn, setIsbn] = useState('');
  const [result, setResult] = useState<ReturnResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  const handleReturn = async (scannedIsbn?: string) => {
    const isbnToProcess = scannedIsbn || isbn;
    if (!isbnToProcess) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/isbn/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isbn: isbnToProcess }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Return failed');
        playSound('error');
      } else {
        setResult(data);
        setIsbn('');
        playSound('success');
        if (isScanning) {
          stopScanner();
        }
      }
    } catch {
      setError('Failed to process library return');
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

  useEffect(() => {
    if (!isScanning) return;

    const initCamera = async () => {
      try {
        const html5QrCode = new Html5Qrcode('library-return-scanner');
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            if (isScanningRef.current) return;
            isScanningRef.current = true;

            await handleReturn(decodedText);

            setTimeout(() => {
              isScanningRef.current = false;
            }, 2000);
          },
          (errorMessage) => {
            console.debug(errorMessage);
          }
        );
      } catch (err) {
        console.error('Camera error:', err);
        setCameraError(
          (err instanceof Error ? err.message : String(err)) || 'Failed to start camera.'
        );
        setIsScanning(false);
      }
    };

    initCamera();

    return () => {
      stopScanner();
    };
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-accent-blue">Library Returns</h1>
        <p className="text-text-muted">Scan book ISBN barcodes for returns</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={mode === 'camera' ? 'gradient' : 'outline'}
          onClick={() => {
            setMode('camera');
            stopScanner();
          }}
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
        >
          <Keyboard className="mr-2 h-4 w-4" />
          Manual Entry
        </Button>
      </div>

      {mode === 'camera' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-text-main">ISBN Barcode Scanner</span>
              {isScanning && (
                <Button variant="outline" size="sm" onClick={stopScanner}>
                  <X className="h-4 w-4 mr-2" />
                  Stop Camera
                </Button>
              )}
            </CardTitle>
            <CardDescription className="text-text-muted">
              Point your camera at the book's ISBN barcode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isScanning && !result && (
              <Button onClick={startScanner} variant="gradient" className="w-full" size="lg">
                <Camera className="mr-2 h-5 w-5" />
                Start Scanner
              </Button>
            )}

            {cameraError && (
              <div className="flex items-center gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-3 text-sm text-yellow-500">
                <XCircle className="h-5 w-5" />
                <p>{cameraError}</p>
              </div>
            )}

            {isScanning && (
              <div className="space-y-3">
                <div id="library-return-scanner" className="rounded-lg overflow-hidden border-2 border-accent-blue/50 shadow-lg max-w-sm mx-auto"></div>
                <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3 text-center">
                  <p className="text-accent-blue text-sm font-medium">Scanning for ISBN...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-md bg-danger/10 border border-danger/30 p-3 text-sm text-danger">
                <XCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            )}

            {result && (
              <div className="rounded-lg bg-success/10 border-2 border-success/30 p-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                    <CheckCircle className="h-7 w-7 text-success" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-success">✅ Return Successful!</p>
                    <p className="text-xs text-text-muted">{result.booking.resourceName}</p>
                  </div>
                </div>
                
                <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-lg p-3 mb-3">
                  <p className="text-xs text-accent-blue font-medium mb-1">📚 BOOK</p>
                  <p className="text-lg font-bold text-text-main">{result.book.name}</p>
                  {result.book.author && <p className="text-sm text-text-muted">by {result.book.author}</p>}
                </div>

                <div className="bg-bg-dark rounded-lg p-3 mb-4">
                  <p className="text-xs text-text-muted font-medium mb-1">👤 STUDENT</p>
                  <p className="text-base font-bold text-text-main">{result.student.name}</p>
                  <p className="text-sm text-text-muted">{result.student.email}</p>
                </div>

                <Button
                  onClick={() => {
                    setResult(null);
                    setError('');
                    if (mode === 'camera') startScanner();
                  }}
                  variant="gradient"
                  className="w-full"
                >
                  Scan Next Book
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle>Manual ISBN Entry</CardTitle>
            <CardDescription>Enter ISBN if barcode won't scan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="ISBN Number"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="e.g. 9780134685991"
            />
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-danger/10 border border-danger/30 p-3 text-sm text-danger">
                <XCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            )}
            <Button
              onClick={() => handleReturn()}
              disabled={!isbn || loading}
              variant="gradient"
              className="w-full"
              size="lg"
            >
              {loading ? 'Processing...' : 'Process Return'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
