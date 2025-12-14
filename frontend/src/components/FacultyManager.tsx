import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Faculty, Subject } from '../types';
import { UserCog, Plus, Trash2, Key, X, ScanFace, Save, User, Edit, CheckCircle } from 'lucide-react';

declare const faceapi: any;

export const FacultyManager: React.FC = () => {
    const [facultyList, setFacultyList] = useState<Faculty[]>([]);
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    
    // UI State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    
    // Form State
    const [editId, setEditId] = useState<string | null>(null); 
    const [newName, setNewName] = useState('');
    const [newId, setNewId] = useState(''); 
    const [newPin, setNewPin] = useState(''); 
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    // Face Detection State
    const [faceFeedback, setFaceFeedback] = useState("Initializing Camera...");
    const [isFaceGood, setIsFaceGood] = useState(false);
    const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const intervalRef = useRef<any>(null);

    useEffect(() => {
        loadData();
        loadModels();
        return () => stopCamera();
    }, []);

    const loadData = async () => {
        const [facList, subList] = await Promise.all([
            api.getFaculty(),
            api.getSubjects()
        ]);
        setFacultyList(facList);
        setAllSubjects(subList);
    };

    const loadModels = async () => {
        try {
            const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            ]);
            setModelsLoaded(true);
        } catch (e) {
            console.error("Model load failed", e);
        }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
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

    useEffect(() => {
        if (isFormOpen) {
            startCamera();
        } else {
            stopCamera();
            resetForm();
        }
    }, [isFormOpen]);

    const resetForm = () => {
        setNewName('');
        setNewId('');
        setNewPin('');
        setSelectedSubjects([]);
        setCapturedImage(null);
        setIsEditing(false);
        setEditId(null);
        setIsFaceGood(false);
        setAutoCaptureProgress(0);
        setFaceFeedback("Initializing Camera...");
    };

    const handleVideoPlay = () => {
        if (!modelsLoaded || !videoRef.current || !canvasRef.current) return;

        const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
        faceapi.matchDimensions(canvasRef.current, displaySize);

        intervalRef.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || capturedImage) return;

            const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions());
            const resizedDetections = faceapi.resizeResults(detections, displaySize);

            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);

            if (resizedDetections.length === 1) {
                const { score, box } = resizedDetections[0];
                const isGood = score > 0.8 && box.width > 120;

                const drawBox = new faceapi.draw.DrawBox(box, { 
                    label: isGood ? "Perfect" : "Move Closer",
                    boxColor: isGood ? '#22c55e' : '#f59e0b' 
                });
                drawBox.draw(canvasRef.current!);

                setIsFaceGood(isGood);

                if (isGood) {
                    setFaceFeedback("Hold still...");
                    setAutoCaptureProgress(prev => {
                        if (prev >= 100) {
                            capturePhoto();
                            return 100;
                        }
                        return prev + 10; 
                    });
                } else {
                    setFaceFeedback(box.width <= 120 ? "Move Closer" : "Adjust Lighting");
                    setAutoCaptureProgress(0);
                }
            } else if (resizedDetections.length === 0) {
                setIsFaceGood(false);
                setFaceFeedback("Look at camera");
                setAutoCaptureProgress(0);
            } else {
                setIsFaceGood(false);
                setFaceFeedback("One face only");
                setAutoCaptureProgress(0);
            }
        }, 100);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg');
                setCapturedImage(dataUrl);
                stopCamera();
            }
        }
    };

    const openEdit = (fac: Faculty) => {
        setEditId(fac.id);
        setNewId(fac.id);
        setNewName(fac.name);
        setNewPin(fac.pin || '');
        setSelectedSubjects(fac.subjects);
        setCapturedImage(fac.photoBase64 || null);
        setIsEditing(true);
        setIsFormOpen(true);
    };

    const toggleSubject = (abbr: string) => {
        if (selectedSubjects.includes(abbr)) {
            setSelectedSubjects(prev => prev.filter(s => s !== abbr));
        } else {
            setSelectedSubjects(prev => [...prev, abbr]);
        }
    };

    const handleSave = async () => {
        if (!newName || !newId) return;
        
        const facultyData: Faculty = {
            id: newId.toUpperCase(),
            name: newName,
            subjects: selectedSubjects,
            photoBase64: capturedImage || undefined,
            pin: newPin || undefined
        };

        try {
            if (isEditing && editId) {
                // If ID changed, delete old one first
                if (editId !== newId) {
                    await api.deleteFaculty(editId);
                    await api.addFaculty(facultyData);
                } else {
                    await api.updateFaculty(facultyData);
                }
            } else {
                await api.addFaculty(facultyData);
            }
            
            setIsFormOpen(false);
            loadData(); // Reload both faculty and subjects to be safe
        } catch(e: any) {
            alert(e.message || "Error saving faculty");
            // If failed (e.g. duplicate face), restart camera to let user try again
            if(!isEditing) {
                setCapturedImage(null);
                startCamera();
            }
        }
    };

    const handleDelete = async (id: string) => {
        if(window.confirm("Delete this faculty member?")) {
            await api.deleteFaculty(id);
            loadData();
        }
    }

    return (
        <div className="p-6 space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <UserCog /> Faculty Management
                </h2>
                <button 
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    {isFormOpen ? <><X size={18} /> Cancel</> : <><Plus size={18} /> Add Faculty</>}
                </button>
            </div>

            {isFormOpen && (
                <div className="bg-slate-850 border border-slate-700 p-6 rounded-xl animate-in slide-in-from-top-4 shadow-xl">
                    <h3 className="text-xl font-bold text-white mb-6 border-b border-slate-700 pb-2">
                        {isEditing ? 'Edit Faculty Profile' : 'New Faculty Registration'}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column: Details */}
                        <div className="space-y-5">
                            <h4 className="text-sm font-semibold text-primary-400 uppercase tracking-wider flex items-center gap-2">
                                <User size={16} /> Personal Info
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Initials (ID)</label>
                                    <input 
                                        value={newId}
                                        onChange={e => setNewId(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-primary-500 font-mono placeholder:text-slate-600"
                                        placeholder="e.g. KA"
                                        disabled={isEditing && editId === newId} 
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Legacy PIN</label>
                                    <input 
                                        value={newPin}
                                        onChange={e => setNewPin(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-primary-500 font-mono tracking-widest placeholder:text-slate-600"
                                        placeholder="XXXX"
                                        maxLength={4}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-slate-400 uppercase font-bold mb-1 block">Full Name</label>
                                <input 
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-primary-500 placeholder:text-slate-600"
                                    placeholder="e.g. Dr. Kamlesh Ahuja"
                                />
                            </div>
                            
                            <div>
                                <label className="text-xs text-slate-400 uppercase font-bold mb-2 block">Assigned Subjects</label>
                                <div className="flex flex-wrap gap-2 p-3 bg-slate-900 rounded-lg border border-slate-700 min-h-[60px]">
                                    {allSubjects.map(sub => (
                                        <button
                                            key={sub.code}
                                            onClick={() => toggleSubject(sub.abbr)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
                                                selectedSubjects.includes(sub.abbr) 
                                                ? 'bg-primary-600 border-primary-500 text-white shadow-md' 
                                                : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                                            }`}
                                        >
                                            {sub.abbr}
                                        </button>
                                    ))}
                                    {allSubjects.length === 0 && <span className="text-slate-600 text-sm">No subjects found. Add them in Timetable Manager.</span>}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Face Auth */}
                        <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-primary-400 uppercase tracking-wider flex items-center gap-2">
                                <ScanFace size={16} /> Biometric Data
                            </h4>
                            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-inner group">
                                {capturedImage ? (
                                    <>
                                        <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <CheckCircle className="text-green-500" size={48} />
                                                <span className="text-white font-bold">Face Registered</span>
                                                <button onClick={() => { setCapturedImage(null); startCamera(); }} className="mt-2 px-4 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs text-white">Retake</button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" onPlay={handleVideoPlay} />
                                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                                        
                                        {/* Feedback Overlay */}
                                        <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
                                            <div className={`px-4 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${
                                                isFaceGood ? 'bg-green-500/30 border-green-500 text-green-100' : 'bg-red-500/30 border-red-500 text-red-100'
                                            }`}>
                                                {faceFeedback}
                                            </div>
                                        </div>

                                        {/* Auto Capture Progress Bar */}
                                        {isFaceGood && (
                                            <div className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-100" style={{ width: `${autoCaptureProgress}%` }} />
                                        )}
                                    </>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 text-center">
                                Look directly at the camera. The system will auto-capture when a clear face is detected.
                            </p>
                        </div>
                    </div>
                    
                    <div className="mt-8 flex justify-end pt-4 border-t border-slate-800">
                         <button 
                            disabled={!newName || !newId || (!capturedImage && !newPin)}
                            onClick={handleSave}
                            className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
                        >
                            <Save size={20} /> {isEditing ? 'Update Faculty' : 'Save Faculty'}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {facultyList.map(fac => (
                    <div key={fac.id} className="bg-slate-850 p-6 rounded-xl border border-slate-800 flex items-start gap-4 group hover:border-slate-600 transition-all">
                        <div className="w-20 h-20 rounded-full bg-slate-800 overflow-hidden border-2 border-slate-700 shrink-0 relative">
                            {fac.photoBase64 ? (
                                <img src={fac.photoBase64} className="w-full h-full object-cover" alt={fac.name} />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600"><UserCog size={32} /></div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold text-white truncate">{fac.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs font-mono bg-slate-800 px-2 py-0.5 rounded text-primary-400 border border-slate-700">ID: {fac.id}</span>
                                        {fac.pin && <span className="text-xs font-mono text-slate-500 flex items-center gap-1"><Key size={10}/> ••••</span>}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1 mt-3">
                                {fac.subjects.map(s => (
                                    <span key={s} className="px-2 py-0.5 bg-primary-900/20 text-primary-400 text-[10px] font-bold rounded border border-primary-900/30">{s}</span>
                                ))}
                                {fac.subjects.length === 0 && <span className="text-[10px] text-slate-600 italic">No subjects</span>}
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                             <button 
                                onClick={() => openEdit(fac)}
                                className="text-slate-500 hover:text-blue-400 p-2 rounded-full hover:bg-blue-500/10 transition-colors"
                                title="Edit"
                            >
                                <Edit size={18} />
                            </button>
                            <button 
                                onClick={() => handleDelete(fac.id)}
                                className="text-slate-500 hover:text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
