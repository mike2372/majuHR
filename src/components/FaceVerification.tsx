import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  loadModels, 
  getFaceDescriptor, 
  compareFaces, 
  deserializeDescriptor 
} from '../lib/faceRecognition';
import { cn } from '../lib/utils';

interface FaceVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  expectedDescriptor?: string | null; // JSON string
  mode: 'register' | 'verify';
  onDescriptorGenerated?: (descriptor: string) => void;
}

export function FaceVerification({ 
  isOpen, 
  onClose, 
  onVerified, 
  expectedDescriptor,
  mode,
  onDescriptorGenerated
}: FaceVerificationProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'active' | 'success' | 'failed'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    setStatus('loading');
    setErrorMessage(null);
    setProgress(0);
    
    try {
      await loadModels();
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStatus('active');
        processVideo();
      }
    } catch (err: any) {
      console.error(err);
      setStatus('failed');
      setErrorMessage(err.message || 'Could not access camera. Please ensure permissions are granted.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const processVideo = async () => {
    if (status !== 'active' || !videoRef.current) return;

    let matchCount = 0;
    const requiredMatches = 5; // Require multiple successful frames for accuracy

    const interval = setInterval(async () => {
      if (!videoRef.current || status !== 'active') {
        clearInterval(interval);
        return;
      }

      try {
        const descriptor = await getFaceDescriptor(videoRef.current);
        
        if (descriptor) {
          if (mode === 'register') {
            matchCount++;
            setProgress((matchCount / requiredMatches) * 100);
            
            if (matchCount >= requiredMatches) {
              clearInterval(interval);
              const serialized = JSON.stringify(Array.from(descriptor));
              onDescriptorGenerated?.(serialized);
              setStatus('success');
              setTimeout(() => onVerified(), 1500);
            }
          } else if (mode === 'verify' && expectedDescriptor) {
            const target = deserializeDescriptor(expectedDescriptor);
            const isMatch = compareFaces(descriptor, target);
            
            if (isMatch) {
              matchCount++;
              setProgress((matchCount / requiredMatches) * 100);
              
              if (matchCount >= requiredMatches) {
                clearInterval(interval);
                setStatus('success');
                setTimeout(() => onVerified(), 1500);
              }
            } else {
              // Reset progress if match lost
              matchCount = Math.max(0, matchCount - 0.5);
              setProgress((matchCount / requiredMatches) * 100);
            }
          }
        }
      } catch (err) {
        console.error('Processing error:', err);
      }
    }, 200);

    return () => clearInterval(interval);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 flex justify-between items-center border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {mode === 'register' ? 'Face Registration' : 'Face Verification'}
            </h3>
            <p className="text-sm text-gray-500">
              {mode === 'register' ? 'Scanning your features to create a secure ID.' : 'Confirming your identity for attendance.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden mb-6 group">
            <video 
              ref={videoRef} 
              autoPlay 
              muted 
              playsInline 
              className={cn(
                "w-full h-full object-cover mirror transition-opacity duration-500",
                status === 'active' ? "opacity-100" : "opacity-30"
              )}
              style={{ transform: 'scaleX(-1)' }} // Mirror effect
            />
            
            {/* Overlay UI */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {/* Face Guide Frame */}
              <div className={cn(
                "w-48 h-64 border-2 rounded-[3rem] transition-all duration-300",
                status === 'success' ? "border-emerald-500 scale-105" : 
                status === 'active' ? "border-white/50 scale-100" : "border-transparent"
              )}>
                {status === 'active' && (
                  <div className="absolute inset-0 overflow-hidden rounded-[2.9rem]">
                    <motion.div 
                      animate={{ y: [0, 256, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="h-1 bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                    />
                  </div>
                )}
              </div>

              {/* Status Indicators */}
              <AnimatePresence mode="wait">
                {status === 'loading' && (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                    <span className="text-white text-sm font-medium">Initializing AI models...</span>
                  </motion.div>
                )}
                
                {status === 'success' && (
                  <motion.div 
                    key="success"
                    initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle2 className="w-10 h-10 text-white" />
                    </div>
                    <span className="text-white text-lg font-bold">Identity Verified</span>
                  </motion.div>
                )}

                {status === 'failed' && (
                  <motion.div 
                    key="failed"
                    initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center p-6 text-center"
                  >
                    <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
                    <span className="text-white text-sm font-medium">{errorMessage}</span>
                    <button 
                      onClick={startCamera}
                      className="mt-4 px-4 py-2 bg-white rounded-lg text-sm font-bold text-gray-900"
                    >
                      Try Again
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Progress Bar */}
            {status === 'active' && (
              <div className="absolute bottom-4 left-4 right-4 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3">
              <Camera className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-blue-900">Tips for better accuracy:</p>
                <ul className="text-blue-700 space-y-1 mt-1 list-disc list-inside">
                  <li>Ensure good lighting on your face</li>
                  <li>Remove masks or heavy eyewear</li>
                  <li>Look directly into the camera</li>
                </ul>
              </div>
            </div>

            <p className="text-xs text-center text-gray-400">
              Biometric data is processed locally and never stored as images.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
