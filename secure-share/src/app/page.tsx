'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  encryptFile,
  generateKey,
  exportKey,
  generateShareUrl,
  formatFileSize,
  validateFileSize,
  MAX_FILE_SIZE,
  ProgressCallback,
} from '@/lib/encryption';
import { toast } from 'sonner';
import Turnstile from '@/components/turnstile';
import { BrowserLockGoldIcon } from '@/components/icons/browser-lock';

interface UploadState {
  file: File | null;
  encrypting: boolean;
  uploading: boolean;
  encryptionProgress: number;
  encryptionStage: string;
  uploadProgress: number;
  shareUrl: string | null;
  error: string | null;
  expiresAt: string | null;
}

export default function UploadPage() {
  const [state, setState] = useState<UploadState>({
    file: null,
    encrypting: false,
    uploading: false,
    encryptionProgress: 0,
    encryptionStage: '',
    uploadProgress: 0,
    shareUrl: null,
    error: null,
    expiresAt: null,
  });
  
  const [oneTimeDownload, setOneTimeDownload] = useState(true);
  const [expiryHours, setExpiryHours] = useState(24);
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showLockAnimation, setShowLockAnimation] = useState(false);
  
  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if Turnstile is enabled on the server
  useEffect(() => {
    fetch('/api/files')
      .then(res => res.json())
      .then(data => {
        setTurnstileEnabled(data.turnstile?.enabled ?? false);
      })
      .catch(() => {});
  }, []);

  // Clear expired files on mount
  useEffect(() => {
    fetch('/api/cleanup').catch(() => {});
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    if (!validateFileSize(file)) {
      setState(prev => ({
        ...prev,
        error: `File size exceeds limit of ${formatFileSize(MAX_FILE_SIZE)}`,
        file: null,
      }));
      return;
    }
    
    setState(prev => ({
      ...prev,
      file,
      error: null,
      shareUrl: null,
      expiresAt: null,
    }));
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const handleUpload = async () => {
    if (!state.file) return;
    
    // Check Turnstile if enabled
    if (turnstileEnabled && !turnstileToken) {
      toast.error('Please complete the security check');
      return;
    }
    
    try {
      // PHASE 1: ENCRYPTION
      setState(prev => ({ 
        ...prev, 
        encrypting: true, 
        uploading: false,
        encryptionProgress: 0,
        encryptionStage: 'Initializing...',
        uploadProgress: 0,
      }));
      
      const key = await generateKey();
      const keyBase64 = await exportKey(key);
      
      // Encryption progress callback
      const onEncryptionProgress: ProgressCallback = (progress, stage) => {
        setState(prev => ({
          ...prev,
          encryptionProgress: progress,
          encryptionStage: stage,
        }));
      };
      
      const encryptedData = await encryptFile(state.file, key, onEncryptionProgress);
      
      // PHASE 2: UPLOAD
      setState(prev => ({ 
        ...prev, 
        encrypting: false, 
        uploading: true,
        uploadProgress: 0,
      }));
      
      // Simulate upload progress (we can't get real progress with fetch)
      // But we'll show a nice animated progress
      const progressInterval = setInterval(() => {
        setState(prev => ({
          ...prev,
          uploadProgress: Math.min(prev.uploadProgress + 10, 90),
        }));
      }, 100);
      
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: encryptedData.fileName,
          fileType: encryptedData.fileType,
          fileSize: encryptedData.fileSize,
          encryptedData: encryptedData.encryptedData,
          iv: encryptedData.iv,
          salt: '',
          oneTimeDownload,
          expiryHours,
          turnstileToken: turnstileEnabled ? turnstileToken : undefined,
        }),
      });
      
      clearInterval(progressInterval);
      setState(prev => ({ ...prev, uploadProgress: 95 }));
      
      const result = await response.json();
      
      if (result.success) {
        setState(prev => ({
          ...prev,
          uploading: false,
          uploadProgress: 100,
          shareUrl: result.fileId ? generateShareUrl(result.fileId, keyBase64) : null,
          expiresAt: result.expiresAt,
        }));
        
        setShowLockAnimation(true);
        
        setTimeout(() => {
          setShowSuccessModal(true);
        }, 500);
      } else {
        // Reset Turnstile on error
        if (turnstileRef.current && (turnstileRef.current as any).resetTurnstile) {
          (turnstileRef.current as any).resetTurnstile();
        }
        setTurnstileToken(null);
        
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        encrypting: false,
        uploading: false,
        encryptionProgress: 0,
        uploadProgress: 0,
        error: error instanceof Error ? error.message : 'Upload failed',
      }));
      toast.error('Upload failed');
    }
  };

  const copyToClipboard = async () => {
    if (state.shareUrl) {
      await navigator.clipboard.writeText(state.shareUrl);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetUpload = () => {
    setState({
      file: null,
      encrypting: false,
      uploading: false,
      encryptionProgress: 0,
      encryptionStage: '',
      uploadProgress: 0,
      shareUrl: null,
      error: null,
      expiresAt: null,
    });
    setShowSuccessModal(false);
    setShowLockAnimation(false);
    setTurnstileToken(null);
    
    // Reset Turnstile widget
    if (turnstileRef.current && (turnstileRef.current as any).resetTurnstile) {
      (turnstileRef.current as any).resetTurnstile();
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isProcessing = state.encrypting || state.uploading;
  const canUpload = state.file && !isProcessing && (!turnstileEnabled || turnstileToken);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Image - Responsive Cover */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: 'url(/bg-image.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      />
      
      {/* Dark Overlay for readability */}
      <div 
        className="fixed inset-0 z-0"
        style={{
          background: 'linear-gradient(135deg, rgba(46, 16, 101, 0.85) 0%, rgba(23, 37, 84, 0.85) 50%, rgba(15, 23, 42, 0.9) 100%)',
        }}
      />
      
      {/* Animated background particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Lock Animation Overlay */}
      <AnimatePresence>
        {showLockAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 200 }}
              className="relative"
            >
              <div 
                className="p-8 rounded-full backdrop-blur-xl border"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(46, 16, 101, 0.8), rgba(23, 37, 84, 0.8))',
                  borderColor: 'rgba(252, 211, 77, 0.3)',
                  boxShadow: '0 0 20px rgba(252, 211, 77, 0.3), 0 0 40px rgba(252, 211, 77, 0.1)'
                }}
              >
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 0.6,
                    ease: "easeInOut"
                  }}
                  style={{ filter: 'drop-shadow(0 0 10px rgba(252, 211, 77, 0.5))' }}
                >
                  <BrowserLockGoldIcon size={70} />
                </motion.div>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-center mt-4 text-lg font-semibold"
                style={{ color: '#FCD34D' }}
              >
                File Secured!
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - Sticky with blur */}
      <header className="sticky top-0 z-50 border-b backdrop-blur-md" style={{ borderColor: 'rgba(255, 255, 255, 0.1)', background: 'rgba(0, 0, 0, 0.2)' }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {/* Fixed size icon box */}
            <div 
              className="w-11 h-11 flex items-center justify-center rounded-lg border"
              style={{ background: 'rgba(252, 211, 77, 0.2)', borderColor: 'rgba(252, 211, 77, 0.3)' }}
            >
              <BrowserLockGoldIcon size={26} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-none">SecureShare</h1>
              <p className="text-sm mt-1 leading-none" style={{ color: 'rgba(167, 139, 250, 0.7)' }}>Zero-Knowledge File Sharing</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Security Info */}
          <Alert 
            className="mb-6 backdrop-blur-xl border"
            style={{ 
              background: 'rgba(30, 30, 60, 0.4)',
              borderColor: 'rgba(252, 211, 77, 0.2)'
            }}
          >
            <BrowserLockGoldIcon size={20} />
            <AlertTitle className="font-semibold" style={{ color: '#FCD34D' }}>Zero-Knowledge Encryption</AlertTitle>
            <AlertDescription style={{ color: 'rgba(196, 181, 253, 0.8)' }}>
              Files are encrypted in your browser. The encryption key never leaves your device.
              We can never read your files.
            </AlertDescription>
          </Alert>

          {/* Upload Card - Glassmorphism */}
          <Card 
            className="backdrop-blur-xl border"
            style={{ 
              background: 'rgba(30, 30, 60, 0.5)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}
          >
            <CardHeader>
              <CardTitle className="text-white">Upload Secure File</CardTitle>
              <CardDescription style={{ color: 'rgba(167, 139, 250, 0.6)' }}>
                Maximum file size: {formatFileSize(MAX_FILE_SIZE)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragActive
                    ? 'border-[#FCD34D] bg-[rgba(252,211,77,0.1)]'
                    : 'border-white/20 hover:border-[rgba(252,211,77,0.5)]'
                } ${state.file && !isProcessing ? 'border-[rgba(252,211,77,0.5)] bg-[rgba(252,211,77,0.05)]' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                  disabled={isProcessing}
                />
                
                <AnimatePresence mode="wait">
                  {state.file ? (
                    <motion.div
                      key="file-selected"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div 
                        className="w-14 h-14 flex items-center justify-center rounded-full border"
                        style={{ background: 'rgba(252, 211, 77, 0.2)', borderColor: 'rgba(252, 211, 77, 0.3)' }}
                      >
                        <i className="bi bi-file-earmark-text text-3xl" style={{ color: '#FCD34D' }}></i>
                      </div>
                      <div>
                        <p className="font-medium text-white">{state.file.name}</p>
                        <p className="text-sm" style={{ color: 'rgba(167, 139, 250, 0.6)' }}>{formatFileSize(state.file.size)}</p>
                      </div>
                      {!isProcessing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            resetUpload();
                          }}
                          className="hover:text-red-400 hover:bg-red-400/10"
                          style={{ color: 'rgba(167, 139, 250, 0.6)' }}
                        >
                          <i className="bi bi-trash mr-1"></i>
                          Remove
                        </Button>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="file-empty"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="w-14 h-14 flex items-center justify-center rounded-full bg-white/5">
                        <i className="bi bi-cloud-upload text-3xl" style={{ color: 'rgba(252, 211, 77, 0.7)' }}></i>
                      </div>
                      <div>
                        <p className="font-medium text-white">Drop your file here</p>
                        <p className="text-sm" style={{ color: 'rgba(167, 139, 250, 0.5)' }}>or click to browse</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Error Message */}
              {state.error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
                  <i className="bi bi-exclamation-circle text-red-400"></i>
                  <AlertDescription className="text-red-200">{state.error}</AlertDescription>
                </Alert>
              )}

              {/* ENCRYPTION PROGRESS - Separate Section */}
              <AnimatePresence>
                {state.encrypting && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div 
                      className="rounded-xl p-4 border"
                      style={{ 
                        background: 'rgba(252, 211, 77, 0.05)',
                        borderColor: 'rgba(252, 211, 77, 0.2)'
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <BrowserLockGoldIcon size={22} />
                        </motion.div>
                        <div>
                          <p className="font-medium text-white">Encrypting Locally</p>
                          <p className="text-xs" style={{ color: 'rgba(167, 139, 250, 0.6)' }}>
                            Zero-Knowledge Encryption in Progress
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span style={{ color: 'rgba(167, 139, 250, 0.7)' }}>
                            <i className="bi bi-gear-wide-connected mr-1 animate-spin inline-block"></i>
                            {state.encryptionStage}
                          </span>
                          <span className="font-medium" style={{ color: '#FCD34D' }}>
                            {state.encryptionProgress}%
                          </span>
                        </div>
                        <Progress 
                          value={state.encryptionProgress} 
                          className="h-2 bg-white/10 [&>div]:bg-[#FCD34D]" 
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* UPLOAD PROGRESS - Separate Section */}
              <AnimatePresence>
                {state.uploading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div 
                      className="rounded-xl p-4 border"
                      style={{ 
                        background: 'rgba(96, 165, 250, 0.05)',
                        borderColor: 'rgba(96, 165, 250, 0.2)'
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <motion.div
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <i className="bi bi-cloud-arrow-up text-xl" style={{ color: '#60A5FA' }}></i>
                        </motion.div>
                        <div>
                          <p className="font-medium text-white">Uploading Encrypted Blob</p>
                          <p className="text-xs" style={{ color: 'rgba(167, 139, 250, 0.6)' }}>
                            Securely transmitting to server
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span style={{ color: 'rgba(167, 139, 250, 0.7)' }}>
                            <i className="bi bi-cloud-check mr-1"></i>
                            Uploading...
                          </span>
                          <span className="font-medium" style={{ color: '#60A5FA' }}>
                            {state.uploadProgress}%
                          </span>
                        </div>
                        <Progress 
                          value={state.uploadProgress} 
                          className="h-2 bg-white/10 [&>div]:bg-[#60A5FA]" 
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Turnstile Widget */}
              {turnstileEnabled && state.file && !isProcessing && !state.shareUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-3 pt-4 border-t border-white/10"
                >
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(167, 139, 250, 0.7)' }}>
                    <i className="bi bi-shield-check" style={{ color: '#FCD34D' }}></i>
                    <span>Complete security check to upload</span>
                  </div>
                  <div 
                    ref={turnstileRef}
                    className="rounded-lg overflow-hidden"
                  >
                    <Turnstile
                      onVerify={handleTurnstileVerify}
                      onExpire={handleTurnstileExpire}
                      theme="dark"
                    />
                  </div>
                  {turnstileToken && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(34, 197, 94, 0.8)' }}>
                      <i className="bi bi-check-circle-fill"></i>
                      <span>Security verified</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Options */}
              {!isProcessing && !state.shareUrl && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <i className="bi bi-eye text-xl" style={{ color: 'rgba(252, 211, 77, 0.8)' }}></i>
                      <div>
                        <Label htmlFor="one-time" className="text-white">One-Time Download</Label>
                        <p className="text-xs" style={{ color: 'rgba(167, 139, 250, 0.5)' }}>Link expires after first download</p>
                      </div>
                    </div>
                    <Switch
                      id="one-time"
                      checked={oneTimeDownload}
                      onCheckedChange={setOneTimeDownload}
                      className="data-[state=checked]:bg-[#FCD34D]"
                    />
                  </div>
                  
                  {/* Expiry Time Selector - CSS Grid */}
                  <div className="flex items-start gap-3">
                    <i className="bi bi-clock text-xl mt-0.5" style={{ color: 'rgba(252, 211, 77, 0.8)' }}></i>
                    <div className="flex-1">
                      <Label className="text-white">Expiry Time</Label>
                      <p className="text-xs mb-3" style={{ color: 'rgba(167, 139, 250, 0.5)' }}>Auto-delete after</p>
                      {/* CSS Grid for buttons */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
                        {[1, 6, 12, 24, 48, 72].map((hours) => (
                          <Button
                            key={hours}
                            variant={expiryHours === hours ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setExpiryHours(hours)}
                            className={`w-full font-medium ${
                              expiryHours === hours
                                ? 'bg-[#FCD34D] hover:bg-[#F5D03B] text-purple-900'
                                : 'border-white/20 text-purple-200 hover:bg-white/10 hover:text-white'
                            }`}
                            style={expiryHours === hours ? { boxShadow: '0 0 10px rgba(252, 211, 77, 0.5)' } : {}}
                          >
                            {hours < 24 ? `${hours}h` : `${hours / 24}d`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              {!state.shareUrl ? (
                <Button
                  onClick={handleUpload}
                  disabled={!canUpload}
                  className="w-full text-purple-900 font-bold text-lg py-6 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                  size="lg"
                  style={{ 
                    background: canUpload ? '#FCD34D' : 'rgba(252, 211, 77, 0.3)',
                    boxShadow: canUpload ? '0 0 20px rgba(252, 211, 77, 0.3), 0 0 40px rgba(252, 211, 77, 0.1)' : 'none'
                  }}
                >
                  {isProcessing ? (
                    <>
                      <i className="bi bi-arrow-repeat mr-2 animate-spin"></i>
                      {state.encrypting ? 'Encrypting...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <BrowserLockGoldIcon size={20} className="mr-2" />
                      Encrypt & Upload
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={resetUpload}
                  variant="outline"
                  className="w-full border-white/20 hover:bg-white/10 hover:text-white"
                  style={{ color: 'rgba(196, 181, 253, 0.8)' }}
                >
                  Upload Another File
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Features */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: 'bi-lock-fill',
                title: 'Client-Side Encryption',
                description: 'AES-256-GCM encryption in your browser',
              },
              {
                icon: 'bi-eye-slash-fill',
                title: 'Zero-Knowledge',
                description: 'We never see your encryption key',
              },
              {
                icon: 'bi-clock-history',
                title: 'Auto-Delete',
                description: 'Files self-destruct after expiry',
              },
            ].map((feature, index) => (
              <Card
                key={index}
                className="backdrop-blur-xl border hover:border-[rgba(252,211,77,0.3)] transition-colors"
                style={{ 
                  background: 'rgba(30, 30, 60, 0.5)',
                  borderColor: 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <CardContent className="pt-4">
                  <i className={`${feature.icon} text-2xl mb-2`} style={{ color: '#FCD34D' }}></i>
                  <h3 className="font-medium text-white text-sm">{feature.title}</h3>
                  <p className="text-xs" style={{ color: 'rgba(167, 139, 250, 0.5)' }}>{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent 
          className="backdrop-blur-xl border text-white max-w-lg"
          style={{ 
            background: 'rgba(30, 30, 60, 0.9)',
            borderColor: 'rgba(252, 211, 77, 0.3)'
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-10 h-10 flex items-center justify-center rounded-lg border"
                style={{ background: 'rgba(252, 211, 77, 0.2)', borderColor: 'rgba(252, 211, 77, 0.3)' }}
              >
                <BrowserLockGoldIcon size={24} />
              </motion.div>
              <span style={{ color: '#FCD34D' }}>File Secured!</span>
            </DialogTitle>
            <DialogDescription style={{ color: 'rgba(167, 139, 250, 0.7)' }}>
              Your file has been encrypted and uploaded. Share the link below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* File ID */}
            {state.shareUrl && (
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide" style={{ color: 'rgba(167, 139, 250, 0.7)' }}>File ID</Label>
                <div 
                  className="rounded-md px-3 py-2 border"
                  style={{ background: 'rgba(0, 0, 0, 0.3)', borderColor: 'rgba(255, 255, 255, 0.1)' }}
                >
                  <span className="mono text-sm" style={{ color: 'rgba(252, 211, 77, 0.8)' }}>
                    {state.shareUrl.split('/download/')[1]?.split('#')[0] || 'N/A'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Share URL */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide" style={{ color: 'rgba(167, 139, 250, 0.7)' }}>Share Link</Label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={state.shareUrl || ''}
                  readOnly
                  className="flex-1 rounded-md px-3 py-2 text-sm text-white mono truncate focus:outline-none border"
                  style={{ background: 'rgba(0, 0, 0, 0.3)', borderColor: 'rgba(255, 255, 255, 0.1)' }}
                />
                <Button
                  onClick={copyToClipboard}
                  className="text-purple-900 shrink-0"
                  style={{ 
                    background: '#FCD34D',
                    boxShadow: '0 0 10px rgba(252, 211, 77, 0.5)'
                  }}
                >
                  {copied ? (
                    <i className="bi bi-check2"></i>
                  ) : (
                    <i className="bi bi-clipboard"></i>
                  )}
                </Button>
              </div>
            </div>

            {/* Encryption Key */}
            {state.shareUrl && (
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide" style={{ color: 'rgba(167, 139, 250, 0.7)' }}>
                  <i className="bi bi-key mr-1"></i>
                  Encryption Key (in URL)
                </Label>
                <div 
                  className="rounded-md px-3 py-2 border overflow-hidden"
                  style={{ background: 'rgba(0, 0, 0, 0.3)', borderColor: 'rgba(252, 211, 77, 0.2)' }}
                >
                  <span className="mono text-xs break-all" style={{ color: 'rgba(252, 211, 77, 0.6)' }}>
                    #{state.shareUrl.split('#')[1] || 'N/A'}
                  </span>
                </div>
              </div>
            )}

            {/* Security Warning */}
            <Alert className="bg-amber-500/10 border-amber-500/30">
              <i className="bi bi-info-circle text-amber-400"></i>
              <AlertDescription className="text-amber-200 text-sm">
                The encryption key is embedded in the URL. Anyone with this link can decrypt and download the file.
              </AlertDescription>
            </Alert>

            {/* File Info */}
            <div className="flex flex-wrap gap-2">
              {oneTimeDownload && (
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/10">
                  <i className="bi bi-eye mr-1"></i>
                  One-Time Download
                </Badge>
              )}
              <Badge variant="outline" className="border-[rgba(252,211,77,0.3)] bg-[rgba(252,211,77,0.1)]" style={{ color: '#FCD34D' }}>
                <i className="bi bi-clock mr-1"></i>
                Expires: {expiryHours}h
              </Badge>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={resetUpload}
              variant="outline"
              className="border-white/20 hover:bg-white/10 hover:text-white"
              style={{ color: 'rgba(196, 181, 253, 0.8)' }}
            >
              Upload Another File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer 
        className="border-t py-4 mt-auto relative z-10 backdrop-blur-sm"
        style={{ borderColor: 'rgba(255, 255, 255, 0.1)', background: 'rgba(0, 0, 0, 0.2)' }}
      >
        <div className="container mx-auto px-4 text-center text-sm" style={{ color: 'rgba(167, 139, 250, 0.5)' }}>
          <p>SecureShare <i className="bi bi-dot"></i> End-to-End Encrypted File Sharing</p>
        </div>
      </footer>
    </div>
  );
}
