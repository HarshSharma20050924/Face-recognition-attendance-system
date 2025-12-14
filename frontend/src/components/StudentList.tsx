import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Student } from '../types';
import { api } from '../services/api';
import { Trash2, UserPlus, CheckCircle, RefreshCw, X, Save, Edit, ScanFace, Loader2 } from 'lucide-react';

declare const faceapi: any;

export const StudentList: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [editId, setEditId] = useState<string | null>(null);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentDept, setNewStudentDept] = useState('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Face Detection State
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceFeedback, setFaceFeedback] = useState("Initializing...");
  const [isFaceGood, setIsFaceGood] = useState(false);
  const [autoCaptureProgress, setAutoCaptureProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<any>(null);

  const loadStudents = async () => {
    const list = await api.getStudents();
    setStudents(list);
  };

  const loadModels = async () => {
    try {
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        ]);
        setModelsLoaded(true);
    } catch (e) {
        console.error("Model load failed", e);
    }
  };
  
  // --- Memoized Functions for useEffect Dependencies ---

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []); // stopCamera doesn't depend on any state/props

  const resetForm = useCallback(() => {
      setNewStudentId('');
      setNewStudentName('');
      setNewStudentDept('');
      setCapturedImage(null);
      setIsEditing(false);
      setEditId(null);
      setIsFaceGood(false);
      setAutoCaptureProgress(0);
  }, []); // resetForm doesn't depend on any state/props setters

  const handleVideoPlay = useCallback(() => {
      // Must access up-to-date state inside the interval.
      // We will rely on interval cleanup in stopCamera to handle re-runs.
      if (!modelsLoaded || !videoRef.current || !canvasRef.current) return;

      const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
      faceapi.matchDimensions(canvasRef.current, displaySize);

      const capturePhoto = () => {
        if (videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            setCapturedImage(canvas.toDataURL('image/jpeg'));
            stopCamera();
          }
        }
      };

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
                          // The function capturePhoto is defined inside handleVideoPlay to capture the current state
                          capturePhoto(); 
                          return 100;
                      }
                      return prev + 10;
                  });
              } else {
                  setFaceFeedback(box.width <= 120 ? "Move Closer" : "Adjust Lighting");
                  setAutoCaptureProgress(0);
              }
          } else {
              setIsFaceGood(false);
              setFaceFeedback(resizedDetections.length === 0 ? "Look at Camera" : "One Face Only");
              setAutoCaptureProgress(0);
          }
      }, 100);
      
      // Clear interval on unmount or re-run
      return () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
      };
      
  }, [modelsLoaded, capturedImage, stopCamera]); // Added capturedImage and stopCamera

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        // handleVideoPlay is run after the video starts playing
        // We ensure it is called only once the video is ready via the interval logic inside
        // or directly if necessary, but here we rely on the effect below.
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  }, []); // startCamera doesn't depend on any state/props

  useEffect(() => {
    loadStudents();
    loadModels();
    return () => stopCamera();
  }, [stopCamera]); // Added stopCamera as a dependency

  useEffect(() => {
    if (isFormOpen) {
      startCamera();
    } else {
      stopCamera();
      resetForm();
    }
    // FIX: Added startCamera and resetForm to dependencies
  }, [isFormOpen, startCamera, stopCamera, resetForm]); 

  // New useEffect to start face detection once video starts playing
  useEffect(() => {
      if (videoRef.current && isFormOpen && !capturedImage) {
          videoRef.current.addEventListener('play', handleVideoPlay);
          return () => {
              // Cleanup the event listener on unmount/dependency change
              if (videoRef.current) {
                  videoRef.current.removeEventListener('play', handleVideoPlay);
              }
              // Also ensure interval is cleared when dependencies change
              if (intervalRef.current) clearInterval(intervalRef.current);
          };
      }
      return () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
      };
  }, [isFormOpen, capturedImage, handleVideoPlay]);
  
  // NOTE: capturePhoto logic moved inside handleVideoPlay for clean state access within interval.

  const openEdit = (student: Student) => {
      setEditId(student.id);
      setNewStudentId(student.id);
      setNewStudentName(student.name);
      setNewStudentDept(student.department);
      // Ensure photoBase64 is not null/undefined if it exists
      setCapturedImage(student.photoBase64 || null); 
      setIsEditing(true);
      setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!newStudentId || !newStudentName) return;
    setIsLoading(true);

    try {
      if (isEditing && editId) {
          // If editing and no new photo is captured, we pass the existing one (or undefined)
          await api.updateStudent(
              newStudentId, 
              newStudentName, 
              newStudentDept || 'General', 
              capturedImage || undefined 
          );
      } else {
          if (!capturedImage) throw new Error("Photo required for new students");
          await api.addStudent(
              newStudentName, 
              newStudentId, 
              newStudentDept || 'General', 
              capturedImage
          );
      }
      
      setIsFormOpen(false);
      loadStudents();
    } catch (e: any) {
      alert(e.message || "Error saving student.");
      if(!isEditing) {
          setCapturedImage(null);
          // Restart camera if save failed for a new student
          startCamera();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // FIX: Suppress no-restricted-globals warning
    // eslint-disable-next-line no-restricted-globals
    if (confirm('Are you sure you want to remove this student?')) {
      await api.deleteStudent(id);
      loadStudents();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-100">Student Database</h2>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <UserPlus size={20} /> Add Student
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-slate-850 p-6 rounded-xl border border-slate-700 animate-in fade-in slide-in-from-top-4 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-white">
                {isEditing ? 'Edit Student Profile' : 'New Enrollment'}
            </h3>
            <button onClick={() => setIsFormOpen(false)} className="text-slate-500 hover:text-white"><X /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Student ID</label>
                <input 
                  value={newStudentId}
                  onChange={e => setNewStudentId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none font-mono"
                  placeholder="e.g. CS-2024-001"
                  disabled={isEditing} 
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Full Name</label>
                <input 
                  value={newStudentName}
                  onChange={e => setNewStudentName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Department</label>
                <input 
                  value={newStudentDept}
                  onChange={e => setNewStudentDept(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-primary-500 outline-none"
                  placeholder="e.g. Computer Science"
                />
              </div>
            </div>

            <div className="space-y-4">
                 <h4 className="text-sm font-semibold text-primary-400 uppercase tracking-wider flex items-center gap-2">
                    <ScanFace size={16} /> Biometric Photo
                 </h4>
                 
                 <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-slate-700 shadow-inner group">
                    {capturedImage ? (
                        <>
                            <img src={capturedImage} alt="Captured Student Face" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div className="flex flex-col items-center gap-2">
                                    <CheckCircle className="text-green-500" size={48} />
                                    <span className="text-white font-bold">Face Captured</span>
                                    <button onClick={() => { setCapturedImage(null); startCamera(); }} className="mt-2 px-4 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs text-white flex items-center gap-2">
                                        <RefreshCw size={12}/> Retake
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
                            
                            <div className="absolute top-4 left-0 right-0 flex justify-center z-10">
                                <div className={`px-4 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${
                                    isFaceGood ? 'bg-green-500/30 border-green-500 text-green-100' : 'bg-red-500/30 border-red-500 text-red-100'
                                }`}>
                                    {faceFeedback}
                                </div>
                            </div>

                            {isFaceGood && (
                                <div className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-100" style={{ width: `${autoCaptureProgress}%` }} />
                            )}
                        </>
                    )}
                </div>
                <p className="text-xs text-slate-500 text-center">
                    The system will auto-capture when a clear face is aligned.
                </p>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end">
            <button 
              disabled={(!capturedImage && !isEditing) || !newStudentId || isLoading}
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg flex items-center gap-2 font-bold shadow-lg"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : <Save size={20} />}
              {isLoading ? 'Processing...' : (isEditing ? 'Update Student' : 'Save Student')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
        {students.map(student => (
          <div key={student.id} className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex items-center space-x-4 hover:border-slate-600 transition-all group">
            <img 
              src={student.photoBase64} 
              // FIX: Added alt prop
              alt={`Profile photo of ${student.name}`} 
              className="w-16 h-16 rounded-full object-cover border-2 border-slate-600 group-hover:border-primary-500 transition-colors" 
            />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-white truncate">{student.name}</h4>
              <p className="text-xs text-slate-400 font-mono">{student.id}</p>
              <p className="text-xs text-primary-400">{student.department}</p>
            </div>
            <div className="flex flex-col gap-2">
                <button 
                  onClick={() => openEdit(student)}
                  className="text-slate-500 hover:text-blue-400 p-1.5 rounded-full hover:bg-blue-500/10 transition-colors"
                  title="Edit"
                >
                  <Edit size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(student.id)}
                  className="text-slate-500 hover:text-red-500 p-1.5 rounded-full hover:bg-red-500/10 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
            </div>
          </div>
        ))}
        {students.length === 0 && !isFormOpen && (
          <div className="col-span-full text-center py-12 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
             No students enrolled. Click "Add Student" to begin biometrics registration.
          </div>
        )}
      </div>
    </div>
  );
};