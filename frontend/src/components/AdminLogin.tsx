import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Loader2, ScanFace, Lock, X, CheckCircle, Save, RefreshCw, AlertTriangle } from 'lucide-react';

declare const faceapi: any;

interface AdminLoginProps {
    onSuccess: (adminData: any) => void;
    onClose: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onClose }) => {
    const [mode, setMode] = useState<'LOADING' | 'SETUP' | 'LOGIN'>('LOADING');
    const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'VERIFYING' | 'SUCCESS' | 'ERROR'>('IDLE');
    const [feedback, setFeedback] = useState('');
    const [setupPassword, setSetupPassword] = useState('');
    
    // Media Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<any>(null);

    // State
    const [isFaceGood, setIsFaceGood] = useState(false);
    const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);
    const [setupImage, setSetupImage] = useState<string | null>(null);

    // Refs for Loop Access (Critical for avoiding stale closures)
    const progressRef = useRef(0);
    const modeRef = useRef(mode);
    const statusRef = useRef(status);
    const setupImageRef = useRef(setupImage);

    // Sync Refs
    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { statusRef.current = status; }, [status]);
    useEffect(() => { setupImageRef.current = setupImage; }, [setupImage]);
    useEffect(() => { progressRef.current = autoCaptureProgress; }, [autoCaptureProgress]);

    useEffect(() => {
        checkAdminStatus();
        return () => stopCamera();
    }, []);

    const checkAdminStatus = async () => {
        try {
            const { registered } = await api.getAdminStatus();
            setMode(registered ? 'LOGIN' : 'SETUP');
            startCamera(); 
        } catch (e) {
            setFeedback("Connection Error");
        }
    };

    const loadModels = async () => {
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
        } catch(e) {}
    };

    const startCamera = async () => {
        await loadModels();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setStatus('SCANNING');
                // Allow video to play before starting detection
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    handleVideoPlay();
                };
            }
        } catch (e) {
            setFeedback("Camera Error");
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const handleVideoPlay = () => {
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(async () => {
            // 1. Safety Checks
            if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || !canvasRef.current) return;
            if (statusRef.current !== 'SCANNING') return;
            if (modeRef.current === 'SETUP' && setupImageRef.current) return;

            // 2. Detection
            const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
            faceapi.matchDimensions(canvasRef.current, displaySize);

            const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions());
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            const ctx = canvasRef.current.getContext('2d');
            if(ctx) ctx.clearRect(0,0, displaySize.width, displaySize.height);

            if (resizedDetections.length === 1) {
                const { score, box } = resizedDetections[0];
                // Relaxed Thresholds: Score > 0.6 (was 0.75), Width > 50 (was 100)
                const isGood = score > 0.6 && box.width > 50;
                
                const drawBox = new faceapi.draw.DrawBox(box, { 
                    label: isGood ? "Perfect" : "Move Closer",
                    boxColor: isGood ? '#22c55e' : '#f59e0b' 
                });
                drawBox.draw(canvasRef.current);

                setIsFaceGood(isGood);

                if (isGood) {
                    // Increment Progress faster
                    const newProgress = Math.min(progressRef.current + 20, 100);
                    setAutoCaptureProgress(newProgress);
                    
                    if (newProgress >= 100) {
                        // TRIGGER CAPTURE IMMEDIATELY
                        if (modeRef.current === 'SETUP') {
                            captureForSetup();
                        } else {
                            attemptAuth();
                        }
                    }
                } else {
                    setAutoCaptureProgress(0);
                }

            } else {
                setIsFaceGood(false);
                setAutoCaptureProgress(0);
            }
        }, 100);
    };

    const captureForSetup = () => {
        if (!videoRef.current) return;
        
        // Pause scanning logic
        if (intervalRef.current) clearInterval(intervalRef.current);

        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if(!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0);
        
        const imgData = canvas.toDataURL('image/jpeg');
        setSetupImage(imgData);
        setAutoCaptureProgress(0); // Reset for next time
    };

    const attemptAuth = async () => {
        if (!videoRef.current) return;
        
        // 1. Lock State
        setStatus('VERIFYING'); 
        if (intervalRef.current) clearInterval(intervalRef.current);

        // 2. Capture
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if(!ctx) return;
        ctx.drawImage(videoRef.current, 0, 0);
        const b64 = canvas.toDataURL('image/jpeg');

        // 3. Send to API
        try {
            await api.loginAdmin(b64);
            setStatus('SUCCESS');
            setFeedback("Access Granted");
            
            // Fetch admin photo to pass to context
            const { photoBase64 } = await api.getAdminStatus();
            
            setTimeout(() => {
                onSuccess({ id: 'ADMIN', name: 'Lab Admin', photoBase64 });
            }, 1000);
        } catch (e) {
            setStatus('ERROR');
            setFeedback("Face not recognized");
            setAutoCaptureProgress(0);
            setTimeout(() => {
                setStatus('SCANNING');
                setIsFaceGood(false);
                handleVideoPlay(); // Restart loop
            }, 2000);
        }
    };
    
    const handleReset = () => {
        setMode('SETUP');
        setSetupImage(null);
        setSetupPassword('');
        setFeedback('');
        setStatus('SCANNING');
        setAutoCaptureProgress(0);
        setIsFaceGood(false);
        handleVideoPlay();
    };

    const submitSetup = async () => {
        if (!setupImage || setupPassword !== 'admin123') {
            setFeedback("Invalid Password");
            return;
        }
        try {
            await api.setupAdmin(setupImage);
            setStatus('SUCCESS');
            setFeedback("Admin Registered");
            setTimeout(() => {
                setMode('LOGIN');
                setSetupImage(null);
                setSetupPassword('');
                setStatus('SCANNING');
                handleVideoPlay();
            }, 1500);
        } catch(e) {
            setFeedback("Setup Failed");
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white z-20">
                    <X />
                </button>

                <div className="p-8 flex-1 overflow-y-auto">
                    <div className="text-center mb-6">
                        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-2 mb-4 transition-colors ${
                            status === 'SUCCESS' ? 'bg-green-500/20 border-green-500 text-green-500' : 
                            status === 'ERROR' ? 'bg-red-500/20 border-red-500 text-red-500' : 
                            'bg-slate-800 border-primary-500 text-primary-500'
                        }`}>
                             {status === 'SUCCESS' ? <CheckCircle size={32}/> : (status === 'ERROR' ? <AlertTriangle size={32}/> : <Lock size={32} />)}
                        </div>
                        <h2 className="text-2xl font-bold text-white">
                            {mode === 'SETUP' ? "Admin Registration" : "Admin Unlock"}
                        </h2>
                        <p className={`text-sm mt-1 font-medium ${status === 'ERROR' ? 'text-red-400' : 'text-slate-400'}`}>
                            {feedback || (mode === 'SETUP' ? "Auto-capture face & set password" : "Look at camera to unlock")}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-slate-700 shadow-inner group">
                             {mode === 'SETUP' && setupImage ? (
                                <>
                                    <img src={setupImage} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                                        <CheckCircle className="text-green-500 mb-2" size={48} />
                                        <span className="text-white font-bold">Face Captured</span>
                                        <button onClick={() => {setSetupImage(null); setAutoCaptureProgress(0); handleVideoPlay();}} className="mt-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs text-white flex items-center gap-2">
                                            <RefreshCw size={12}/> Retake
                                        </button>
                                    </div>
                                </>
                             ) : (
                                <>
                                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                                    
                                    {/* Feedback Overlay */}
                                    <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
                                        <div className={`px-4 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${
                                            isFaceGood ? 'bg-green-500/30 border-green-500 text-green-100' : 'bg-red-500/30 border-red-500 text-red-100'
                                        }`}>
                                            {isFaceGood ? "Hold Still..." : (mode === 'LOGIN' ? "Verifying..." : "Align Face")}
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    {isFaceGood && (
                                        <div className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-100" style={{ width: `${autoCaptureProgress}%` }} />
                                    )}
                                </>
                             )}
                        </div>

                        {mode === 'SETUP' && (
                            <div className="animate-in slide-in-from-bottom-4">
                                <input 
                                    type="password" 
                                    value={setupPassword}
                                    onChange={e => setSetupPassword(e.target.value)}
                                    placeholder="Enter Master Password (admin123)"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none mb-3"
                                />
                                <button 
                                    onClick={submitSetup}
                                    disabled={!setupImage || !setupPassword}
                                    className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
                                >
                                    <Save size={18} /> Complete Registration
                                </button>
                            </div>
                        )}

                        {mode === 'LOGIN' && (
                            <div className="text-center pt-4 border-t border-slate-800">
                                <p className="text-xs text-slate-500 mb-2">Issue logging in?</p>
                                <button 
                                    onClick={handleReset}
                                    className="text-xs text-primary-400 hover:text-primary-300 underline underline-offset-4"
                                >
                                    Reset / Re-register Admin
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};