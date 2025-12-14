import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Faculty, SessionStats } from '../types';
import { CheckCircle, Camera, Loader2, AlertTriangle, ScanFace, UserPlus, LogOut, ShieldCheck, RefreshCw, X } from 'lucide-react';

declare const faceapi: any;

interface AttendanceKioskProps {
    onComplete?: (stats: SessionStats) => void;
    subject?: string;
    faculty: Faculty;
}

export const AttendanceKiosk: React.FC<AttendanceKioskProps> = ({ onComplete, subject = "General", faculty }) => {
  // --- MAIN ATTENDANCE STATE ---
  const [status, setStatus] = useState<'IDLE' | 'ANALYZING' | 'SUCCESS' | 'DUPLICATE' | 'UNKNOWN_USER' | 'REGISTERING'>('IDLE');
  const [feedback, setFeedback] = useState('');
  const [isFaceValid, setIsFaceValid] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  
  // Registration Data
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newBranch, setNewBranch] = useState(''); 
  
  // Session tracking
  const [startTime] = useState(Date.now());
  const [markedStudents, setMarkedStudents] = useState<Set<string>>(new Set());

  // --- EXIT VERIFICATION STATE ---
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);
  
  // We keep the faculty descriptor separate to ensure we only match the admin/faculty for exit
  const facultyDescriptorRef = useRef<any>(null);

  // 1. Initialize System
  useEffect(() => {
    const loadModelsAndDescriptor = async () => {
      try {
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        await Promise.all([
             faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
             faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
             faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL), 
             faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
        ]);

        // Pre-compute faculty descriptor for Exit Verification
        if (faculty.photoBase64) {
            try {
                const img = await faceapi.fetchImage(faculty.photoBase64);
                // Use higher accuracy model for the reference descriptor
                const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options()).withFaceLandmarks().withFaceDescriptor();
                if (detection) {
                    facultyDescriptorRef.current = detection.descriptor;
                }
            } catch (e) {
                console.warn("Failed to generate faculty descriptor", e);
            }
        }

        setModelsLoaded(true);
        if (!isExitModalOpen) {
            startCamera();
        }
      } catch (err) {
        console.error("Failed to load face-api models", err);
      }
    };

    loadModelsAndDescriptor();

    return () => {
        stopCamera();
    };
  }, [faculty.photoBase64, isExitModalOpen]);

  // 2. Camera Management
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (err) {
      console.error("Camera error", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  // 3. Main Attendance Loop
  const handleVideoPlay = () => {
    if (!modelsLoaded || !videoRef.current || !canvasRef.current) return;
    
    // If exit modal is open, we don't run the attendance loop
    if (isExitModalOpen) return;

    const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
    faceapi.matchDimensions(canvasRef.current, displaySize);

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || video.paused || video.ended || !canvas) return;
      if (status !== 'IDLE' && status !== 'ANALYZING') return; // Don't detect if busy

      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
      const resizedDetections = faceapi.resizeResults(detections, displaySize);

      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (resizedDetections.length === 1) {
          const detection = resizedDetections[0];
          const { score, box } = detection;
          
          const isQualityGood = score > 0.8 && box.width > 150;

          const drawBox = new faceapi.draw.DrawBox(box, { 
              label: isQualityGood ? "Valid" : "Move Closer",
              boxColor: isQualityGood ? '#22c55e' : '#ef4444', 
              lineWidth: 4
          });
          drawBox.draw(canvas);

          setIsFaceValid(isQualityGood);
      } else {
          setIsFaceValid(false);
      }
    }, 100);
  };

  // 4. Capture & Identify (Attendance)
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
  }, []);

  const finishSession = useCallback(() => {
      setTimeout(() => {
          setStatus('IDLE');
          setFeedback('');
          setTempImage(null);
          setIsFaceValid(false);
      }, 3000);
  }, []);

  const handleScan = useCallback(async () => {
    if (status !== 'IDLE') return;

    const image = captureFrame();
    if (!image) return;

    setStatus('ANALYZING');
    setTempImage(image);

    const result = await api.identifyStudent(image, subject);

    if (result.match && result.matchedStudentId) {
        const name = result.matchedStudentName || result.matchedStudentId;
        setMarkedStudents(prev => new Set(prev).add(result.matchedStudentId!));

        if (result.alreadyMarked) {
             setStatus('DUPLICATE');
             setFeedback(`Already Recorded: ${name}`);
        } else {
             setStatus('SUCCESS');
             setFeedback(`Attendance Recorded: ${name}`);
        }
        finishSession();
        return;
    }

    if (result.reasoning === "No Face" || result.reasoning === "Bad Image") {
        setFeedback("Face unclear. Please hold still and try again.");
        setStatus('IDLE');
        setTempImage(null);
        return;
    }

    setFeedback("New face detected.");
    setStatus('UNKNOWN_USER');
  }, [captureFrame, finishSession, status, subject]); 

  // Auto-scan trigger
  useEffect(() => {
    let autoScanTimer: NodeJS.Timeout;
    if (isFaceValid && status === 'IDLE' && !isExitModalOpen) {
        autoScanTimer = setTimeout(() => {
            handleScan();
        }, 800); 
    }
    return () => {
        if (autoScanTimer) clearTimeout(autoScanTimer);
    };
  }, [isFaceValid, status, handleScan, isExitModalOpen]);


  // 5. Registration Logic
  const handleRegistration = async () => {
      if (!newId || !newName || !tempImage) return;
      setStatus('REGISTERING');
      try {
        await api.addStudent(newName, newId, newBranch || 'General', tempImage);
        setStatus('SUCCESS');
        setFeedback(`Welcome, ${newName}. Registered & Marked Present.`);
        setMarkedStudents(prev => new Set(prev).add(newId));
        setNewId(''); setNewName(''); setNewBranch('');
        finishSession();
      } catch (e: any) {
          setFeedback(e.message || "Error registering.");
          setStatus('UNKNOWN_USER'); 
      }
  };


  // --- EXIT VERIFICATION LOGIC ---
  
  const handleExitClick = () => {
      // 1. Pause Attendance
      stopCamera(); 
      // 2. Open Modal
      setIsExitModalOpen(true);
  };

  const handleExitCancel = () => {
      setIsExitModalOpen(false);
      // Restart Attendance Camera
      startCamera();
  };

  const finalizeExit = async () => {
      if (onComplete) {
          const allStudents = await api.getStudents();
          const absentList = allStudents.filter(s => !markedStudents.has(s.id));
          const presentList = allStudents.filter(s => markedStudents.has(s.id));
          
          const stats: SessionStats = {
              subject,
              totalStudents: allStudents.length,
              presentCount: markedStudents.size,
              absentStudents: absentList,
              presentStudents: presentList,
              startTime,
              endTime: Date.now()
          };
          onComplete(stats);
      }
  };


  // --- RENDER ---

  return (
    <div className="h-full flex flex-col bg-slate-950 relative">
      
      {/* HEADER */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 flex justify-between items-center z-10">
          <div className="flex flex-col">
              <h1 className="text-xl font-bold text-white tracking-widest flex items-center gap-2">
                 <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
                 {subject}
              </h1>
              {faculty && <p className="text-xs text-primary-400 font-mono">By: {faculty.name}</p>}
          </div>
          
          <div className="flex items-center gap-4">
              <div className="text-slate-400 font-mono text-sm hidden md:block">{new Date().toLocaleTimeString()}</div>
              <button onClick={handleExitClick} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-colors">
                  <LogOut size={16} /> End Session
              </button>
          </div>
      </div>

      {/* ATTENDANCE INTERFACE */}
      <div className="flex-1 flex flex-col md:flex-row p-6 gap-6 overflow-hidden">
        <div className="flex-1 relative bg-black rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl">
            <video 
                ref={videoRef} 
                onPlay={handleVideoPlay}
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover" 
            />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
            
            {!modelsLoaded && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white">
                    <Loader2 className="animate-spin mr-2" /> Loading AI Models...
                </div>
            )}

            {status === 'ANALYZING' && (
                <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center z-20">
                    <div className="w-full h-1 bg-blue-400 shadow-[0_0_20px_#60a5fa] animate-scan"></div>
                </div>
            )}

            {status === 'SUCCESS' && (
                <div className="absolute inset-0 bg-green-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-30 animate-in fade-in zoom-in">
                    <CheckCircle size={100} className="text-green-400 mb-6" />
                    <h2 className="text-4xl font-bold text-white text-center px-4">{feedback}</h2>
                </div>
            )}

            {status === 'DUPLICATE' && (
                <div className="absolute inset-0 bg-amber-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-30 animate-in fade-in zoom-in">
                    <AlertTriangle size={100} className="text-amber-400 mb-6" />
                    <h2 className="text-4xl font-bold text-white text-center px-4">{feedback}</h2>
                    <p className="text-amber-200 mt-2 text-xl font-mono">ALREADY MARKED</p>
                </div>
            )}
        </div>

        {/* SIDEBAR STATUS */}
        <div className="w-full md:w-[400px] flex flex-col gap-4">
            {['IDLE', 'ANALYZING', 'SUCCESS', 'DUPLICATE'].includes(status) && (
                 <div className="flex-1 bg-slate-900 rounded-3xl p-8 border border-slate-800 flex flex-col items-center justify-center text-center shadow-lg">
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 transition-all duration-500 border-4 
                        ${isFaceValid 
                            ? 'bg-green-500/10 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' 
                            : 'bg-slate-800 border-slate-700'
                        }`}
                    >
                        <ScanFace size={64} className={`transition-colors duration-500 ${isFaceValid ? 'text-green-500' : 'text-slate-600'}`} />
                    </div>

                    <h2 className="text-3xl font-bold text-white mb-2">
                        {isFaceValid ? "Face Locked" : "Align Face"}
                    </h2>
                    
                    <p className={`mb-8 font-medium transition-colors ${isFaceValid ? 'text-green-400' : 'text-slate-500'}`}>
                        {feedback || (isFaceValid ? "Hold still..." : "Please stand closer.")}
                    </p>
                    
                    <button 
                        onClick={handleScan}
                        disabled={status === 'ANALYZING'}
                        className={`w-full py-6 text-xl font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3
                            ${isFaceValid || status === 'IDLE'
                                ? 'bg-primary-600 hover:bg-primary-500 text-white shadow-primary-900/30 scale-100 hover:scale-105 active:scale-95 cursor-pointer' 
                                : 'bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed'
                            }
                        `}
                    >
                        {status === 'ANALYZING' ? <Loader2 className="animate-spin" /> : <Camera size={28} />}
                        {status === 'ANALYZING' ? "Processing..." : "Scan Manual"}
                    </button>
                 </div>
            )}

            {(status === 'UNKNOWN_USER' || status === 'REGISTERING') && (
                <div className="flex-1 bg-slate-800 rounded-3xl p-6 border border-slate-700 flex flex-col shadow-lg animate-in slide-in-from-right">
                    <div className="flex items-center gap-3 mb-6 text-primary-400">
                        <UserPlus size={24} />
                        <div>
                            <h2 className="text-xl font-bold text-white">New Face Detected</h2>
                            <p className="text-xs text-slate-400">Register for {subject}</p>
                        </div>
                    </div>
                    
                    <div className="bg-black rounded-lg h-32 w-full mb-4 overflow-hidden border border-slate-600 relative group">
                         {tempImage && <img src={tempImage} className="w-full h-full object-cover opacity-80" alt="Captured" />}
                         <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={handleScan} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full text-white text-xs font-bold flex items-center gap-2">
                                 <RefreshCw size={14} /> Retake
                             </button>
                         </div>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold">Student ID</label>
                            <input value={newId} onChange={e => setNewId(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none" placeholder="Enter College ID" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold">Full Name</label>
                            <input value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none" placeholder="Enter Full Name" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 uppercase font-bold">Branch</label>
                            <input value={newBranch} onChange={e => setNewBranch(e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:border-primary-500 outline-none" placeholder="e.g. AI & DS" />
                        </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                        <button onClick={finishSession} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold">Cancel</button>
                        <button onClick={handleRegistration} disabled={!newId || !newName} className="flex-[2] py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                             {status === 'REGISTERING' ? <Loader2 className="animate-spin" /> : "Register"}
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* --- EXIT VERIFICATION MODAL --- */}
      {isExitModalOpen && (
          <ExitVerificationModal 
            faculty={faculty}
            facultyDescriptor={facultyDescriptorRef.current}
            onCancel={handleExitCancel}
            onSuccess={finalizeExit}
          />
      )}

    </div>
  );
};

// --- SUB-COMPONENT: Dedicated Exit Verification Modal ---

interface ExitModalProps {
    faculty: Faculty;
    facultyDescriptor: any;
    onCancel: () => void;
    onSuccess: () => void;
}

const ExitVerificationModal: React.FC<ExitModalProps> = ({ faculty, facultyDescriptor, onCancel, onSuccess }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const intervalRef = useRef<any>(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<'SCANNING' | 'VERIFYING' | 'SUCCESS' | 'ERROR'>('SCANNING');
    const [msg, setMsg] = useState("Align your face to confirm authority");

    // Memoize the start function to allow usage in useEffect dependency array
    const startExitCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Wait for video to be ready
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    startVerificationLoop();
                };
            }
        } catch (e) {
            setMsg("Camera Error");
        }
    }, [facultyDescriptor]); // Re-create if descriptor changes

    const stopExitCamera = () => {
        const stream = videoRef.current?.srcObject as MediaStream;
        if (stream) stream.getTracks().forEach(t => t.stop());
    };

    const startVerificationLoop = () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        // This matching logic is strictly for the faculty photo provided in props
        const faceMatcher = facultyDescriptor 
            ? new faceapi.FaceMatcher(facultyDescriptor, 0.6) // Strict threshold
            : null;

        intervalRef.current = setInterval(async () => {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            
            // Null check inside the loop to prevent crashes
            if (!video || video.paused || video.ended || !canvas) return;
            if (status === 'SUCCESS') return;

            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
            const displaySize = { width: video.videoWidth, height: video.videoHeight };
            
            // Double check width to avoid 0 width crashes
            if(displaySize.width === 0 || displaySize.height === 0) return;

            faceapi.matchDimensions(canvas, displaySize);
            const resized = faceapi.resizeResults(detections, displaySize);

            const ctx = canvas.getContext('2d');
            if(ctx) ctx.clearRect(0,0, displaySize.width, displaySize.height);

            if (resized.length === 1) {
                const detection = resized[0];
                const box = detection.detection.box;

                // 1. Draw Box
                new faceapi.draw.DrawBox(box, { label: "Verifying...", boxColor: '#3b82f6' }).draw(canvas);

                // 2. Verify Identity
                if (faceMatcher) {
                    const match = faceMatcher.findBestMatch(detection.descriptor);
                    
                    // The label will be 'unknown' if distance > 0.6
                    if (match.label !== 'unknown') {
                        // MATCH FOUND - Increment Progress
                        setProgress(prev => {
                            const next = prev + 10;
                            if (next >= 100) {
                                setStatus('SUCCESS');
                                setMsg("Authority Confirmed");
                                setTimeout(onSuccess, 1000);
                                return 100;
                            }
                            return next;
                        });
                    } else {
                        // Face found, but wrong person
                        setProgress(0);
                        setMsg("Face not recognized as Faculty");
                    }
                } else {
                    // Fallback: If no photo provided for faculty
                    setProgress(prev => {
                        const next = prev + 5;
                        if (next >= 100) {
                            setStatus('SUCCESS');
                            setTimeout(onSuccess, 1000);
                            return 100;
                        }
                        return next;
                    });
                }
            } else {
                setProgress(0);
                setMsg(resized.length === 0 ? "Look at camera" : "Multiple faces detected");
            }
        }, 100);
    };

    useEffect(() => {
        startExitCamera();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            stopExitCamera();
        }
    }, [startExitCamera]);

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden flex flex-col">
                <button onClick={onCancel} className="absolute top-4 right-4 text-slate-500 hover:text-white z-20">
                    <X />
                </button>

                <div className="p-8 flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
                        status === 'SUCCESS' ? 'bg-green-500/20 text-green-500 border-2 border-green-500' : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                         {status === 'SUCCESS' ? <CheckCircle size={32} /> : <ShieldCheck size={32} />}
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-1">Verify Authority</h2>
                    <p className="text-slate-400 text-sm mb-6">
                        Only <span className="text-white font-bold">{faculty.name}</span> can end this session.
                    </p>

                    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-inner mb-6">
                        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                        
                        {/* Progress Bar Overlay */}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-800">
                            <div className="h-full bg-green-500 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }} />
                        </div>

                        {status === 'SUCCESS' && (
                             <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-sm">
                                 <CheckCircle className="text-green-400 w-16 h-16 animate-in zoom-in" />
                             </div>
                        )}
                    </div>

                    <p className={`text-sm font-mono font-medium ${status === 'SUCCESS' ? 'text-green-400' : 'text-primary-400'}`}>
                        {msg}
                    </p>
                </div>
            </div>
        </div>
    );
};
