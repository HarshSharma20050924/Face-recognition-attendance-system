
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Faculty } from '../types';
import { ArrowLeft, Loader2, ScanFace, CheckCircle, AlertTriangle } from 'lucide-react';

declare const faceapi: any;

interface FacultyAuthProps {
    onSuccess: (faculty: Faculty) => void;
    onBack: () => void;
}

export const FacultyAuth: React.FC<FacultyAuthProps> = ({ onSuccess, onBack }) => {
    const [status, setStatus] = useState<'LOADING' | 'SCANNING' | 'VERIFYING' | 'SUCCESS' | 'FAILED'>('LOADING');
    const [feedback, setFeedback] = useState('Initializing Biometrics...');
    const [facultyList, setFacultyList] = useState<Faculty[]>([]);
    
    // Face API State
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<any>(null);
    const labeledDescriptors = useRef<any[]>([]);

    useEffect(() => {
        initialize();
        return () => {
            stopCamera();
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const initialize = async () => {
        try {
            // 1. Load Data
            const list = await api.getFaculty();
            setFacultyList(list);

            // 2. Load Models
            await faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
            await faceapi.nets.faceLandmark68Net.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
            await faceapi.nets.faceRecognitionNet.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
            await faceapi.nets.ssdMobilenetv1.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');

            // 3. Prepare Face Descriptors for Faculty
            const descriptors = [];
            for (const fac of list) {
                if (fac.photoBase64) {
                    const img = await faceapi.fetchImage(fac.photoBase64);
                    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                    if (detection) {
                        descriptors.push(new faceapi.LabeledFaceDescriptors(fac.id, [detection.descriptor]));
                    }
                }
            }
            labeledDescriptors.current = descriptors;

            if (descriptors.length === 0) {
                setFeedback("No Faculty faces registered by Admin yet.");
                setStatus('FAILED');
                return;
            }

            // 4. Start Camera
            startCamera();
        } catch (e) {
            console.error(e);
            setFeedback("System Error. Reload.");
            setStatus('FAILED');
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setStatus('SCANNING');
                setFeedback("Align your face");
                handleVideoPlay();
            }
        } catch (e) {
            setFeedback("Camera permission denied.");
            setStatus('FAILED');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    };

    const handleVideoPlay = () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        faceapi.matchDimensions(canvasRef.current, displaySize);

        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors.current, 0.6);

        intervalRef.current = setInterval(async () => {
            if (status !== 'SCANNING' && status !== 'VERIFYING') return;
            if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

            const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();
            
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);

            if (resizedDetections.length > 0) {
                // We only care about the best match
                const bestMatch = faceMatcher.findBestMatch(resizedDetections[0].descriptor);
                
                if (bestMatch.label !== 'unknown') {
                    // Match Found!
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setStatus('SUCCESS');
                    
                    const faculty = facultyList.find(f => f.id === bestMatch.label);
                    setFeedback(`Welcome, ${faculty?.name}`);
                    
                    setTimeout(() => {
                        if (faculty) onSuccess(faculty);
                    }, 1500);
                }
            }
        }, 500);
    };

    return (
        <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-4">
            <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
                <button onClick={onBack} className="text-slate-400 hover:text-white mb-6 flex items-center gap-2 z-20 relative">
                    <ArrowLeft size={18} /> Back
                </button>
                
                <div className="text-center mb-6 z-20 relative">
                    <h2 className="text-2xl font-bold text-white mb-1">Faculty Access</h2>
                    <p className={`text-sm font-medium ${status === 'SUCCESS' ? 'text-green-400' : 'text-slate-400'}`}>
                        {feedback}
                    </p>
                </div>

                <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-4 border-slate-800 shadow-inner">
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" onPlay={handleVideoPlay} />
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                    
                    {status === 'LOADING' && (
                        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
                            <Loader2 className="text-primary-500 animate-spin" size={40} />
                        </div>
                    )}
                    
                    {status === 'SCANNING' && (
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-primary-500/50 rounded-full animate-pulse" />
                            <div className="w-full h-1 bg-primary-500/50 absolute top-0 animate-scan" />
                        </div>
                    )}

                    {status === 'SUCCESS' && (
                        <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-sm animate-in fade-in">
                            <CheckCircle size={64} className="text-green-400" />
                        </div>
                    )}

                     {status === 'FAILED' && (
                        <div className="absolute inset-0 bg-red-500/20 flex flex-col items-center justify-center backdrop-blur-sm">
                            <AlertTriangle size={48} className="text-red-400 mb-2" />
                            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-slate-800 rounded text-xs">Retry</button>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-center">
                   <div className="flex items-center gap-2 text-slate-500 text-xs">
                       <ScanFace size={16} /> Secured by OmniSight Biometrics
                   </div>
                </div>
            </div>
        </div>
    );
};
