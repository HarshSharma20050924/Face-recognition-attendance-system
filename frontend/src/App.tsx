import React, { useState } from 'react';
import { ViewMode, SessionStats } from './types';
import { Dashboard } from './components/Dashboard';
import { StudentList } from './components/StudentList';
import { AttendanceKiosk } from './components/AttendanceKiosk';
import { Reports } from './components/Reports';
import { TimetableManager } from './components/TimetableManager';
import { FacultyManager } from './components/FacultyManager';
import { WelcomeScreen } from './components/WelcomeScreen';
import { FacultyAuth } from './components/FacultyAuth';
import { SubjectSelect } from './components/SubjectSelect';
import { SessionReport } from './components/SessionReport';
import { AdminLogin } from './components/AdminLogin'; // NEW
import { LayoutDashboard, Users, FileSpreadsheet, Menu, X, Lock, LogIn, CalendarClock, UserCog } from 'lucide-react';
import { Faculty } from './types';

const App: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState<ViewMode>('WELCOME'); 
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  
  // Session State
  const [currentFaculty, setCurrentFaculty] = useState<Faculty | null>(null);
  const [currentSubject, setCurrentSubject] = useState<string>('');
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);

  // Login State
  const [showLogin, setShowLogin] = useState(false);

  const navItems = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'STUDENTS', label: 'Students', icon: Users },
    { id: 'FACULTY_MAN', label: 'Faculty', icon: UserCog },
    { id: 'REPORTS', label: 'Reports', icon: FileSpreadsheet },
    { id: 'TIMETABLE', label: 'Timetable', icon: CalendarClock },
  ];

  const handleAdminAuthSuccess = (adminData: any) => {
      // Create a "Virtual" faculty object for the Admin so they can run kiosks too
      const adminFaculty: Faculty = {
          id: 'ADMIN',
          name: 'Lab Admin',
          subjects: ['TOC', 'ML', 'IWT', 'GT', 'IWT LAB', 'LINUX', 'MP-I', 'APT'], // Default all subjects
          photoBase64: adminData.photoBase64 // Important for Kiosk exit verification
      };
      
      setIsAdmin(true);
      setCurrentFaculty(adminFaculty); // Set admin as current faculty context just in case
      setShowLogin(false);
      setView('DASHBOARD');
  };

  const handleLogout = () => {
      setIsAdmin(false);
      setCurrentFaculty(null);
      setView('WELCOME');
  };

  // --- FACULTY FLOW HANDLERS ---
  const onFacultyAuthenticated = (faculty: Faculty) => {
      setCurrentFaculty(faculty);
      setView('SUBJECT_SELECT');
  };

  const onSubjectSelected = (subject: string) => {
      setCurrentSubject(subject);
      setView('KIOSK');
  };

  const onKioskComplete = (stats: SessionStats) => {
      setSessionStats(stats);
      setView('SESSION_SUMMARY');
  };

  const endSession = () => {
      setCurrentFaculty(null);
      setCurrentSubject('');
      setSessionStats(null);
      setView('WELCOME');
  };

  // --- WELCOME & KIOSK MODE (PUBLIC) ---
  if (!isAdmin) {
      return (
          <div className="h-screen w-screen relative overflow-hidden bg-slate-950">
              {view === 'WELCOME' && (
                  <WelcomeScreen onStart={() => setView('FACULTY_AUTH')} />
              )}

              {view === 'FACULTY_AUTH' && (
                  <FacultyAuth 
                    onSuccess={onFacultyAuthenticated} 
                    onBack={() => setView('WELCOME')} 
                  />
              )}

              {view === 'SUBJECT_SELECT' && currentFaculty && (
                  <SubjectSelect 
                    faculty={currentFaculty} 
                    onSelect={onSubjectSelected} 
                  />
              )}

              {view === 'KIOSK' && currentFaculty && (
                  <AttendanceKiosk 
                    subject={currentSubject}
                    faculty={currentFaculty}
                    onComplete={onKioskComplete}
                  />
              )}

              {view === 'SESSION_SUMMARY' && sessionStats && (
                  <SessionReport 
                    stats={sessionStats}
                    onClose={endSession}
                  />
              )}
              
              {/* Invisible Admin Trigger (Only on Welcome Screen) */}
              {view === 'WELCOME' && (
                  <button 
                    onClick={() => setShowLogin(true)}
                    className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 text-slate-400 hover:text-slate-600 rounded-full transition-all z-50"
                    title="Admin Access"
                  >
                      <Lock size={16} />
                  </button>
              )}

              {/* New Face Login Modal */}
              {showLogin && (
                  <AdminLogin 
                    onSuccess={handleAdminAuthSuccess}
                    onClose={() => setShowLogin(false)}
                  />
              )}
          </div>
      );
  }

  // --- ADMIN DASHBOARD ---
  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <div 
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} 
        bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col z-20`}
      >
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen ? (
            <h1 className="font-bold text-xl tracking-wider text-primary-500">OMNI<span className="text-white">SIGHT</span></h1>
          ) : (
            <span className="font-bold text-xl text-primary-500 ml-1">O</span>
          )}
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-slate-500 hover:text-white">
             {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-2 mt-4">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewMode)}
              className={`w-full flex items-center gap-4 px-3 py-3 rounded-lg transition-all
                ${view === item.id 
                  ? 'bg-primary-600/10 text-primary-400 border border-primary-600/20' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
              `}
            >
              <item.icon size={24} />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>
        
        <div className="px-3 pb-6">
            <button 
                onClick={handleLogout}
                className={`w-full flex items-center gap-4 px-3 py-3 rounded-lg transition-all text-red-500 hover:bg-red-500/10 border border-red-500/20`}
            >
                <LogOutIcon />
                {isSidebarOpen && <span className="font-medium text-left">Logout</span>}
            </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col bg-slate-950">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur z-10">
           <div className="flex items-center gap-4">
               <h2 className="text-lg font-medium text-white">{navItems.find(n => n.id === view)?.label}</h2>
               {view !== 'DASHBOARD' && (
                   // Allow admin to switch to Kiosk Mode directly from dashboard
                   <button 
                        onClick={() => {
                             setCurrentFaculty({
                                 id: 'ADMIN',
                                 name: 'Lab Admin',
                                 subjects: ['TOC', 'ML', 'IWT', 'GT', 'IWT LAB', 'LINUX', 'MP-I', 'APT'],
                                 photoBase64: currentFaculty?.photoBase64 // Pass admin photo
                             });
                             setView('SUBJECT_SELECT');
                             setIsAdmin(false); // Switch to kiosk UI
                        }}
                        className="text-xs bg-primary-900/30 text-primary-400 px-2 py-1 rounded border border-primary-900/50 hover:bg-primary-900/50"
                   >
                       Start Kiosk Session
                   </button>
               )}
           </div>
           
           <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-mono">ADMIN MODE</span>
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
                   {currentFaculty?.photoBase64 ? (
                       <img src={currentFaculty.photoBase64} className="w-full h-full object-cover" />
                   ) : (
                       <UserCog size={16} className="m-2 text-slate-500"/>
                   )}
              </div>
           </div>
        </header>
        
        <div className="flex-1 overflow-auto relative">
          {view === 'DASHBOARD' && <Dashboard />}
          {view === 'STUDENTS' && <StudentList />}
          {view === 'FACULTY_MAN' && <FacultyManager />}
          {view === 'REPORTS' && <Reports />}
          {view === 'TIMETABLE' && <TimetableManager />}
        </div>
      </main>
    </div>
  );
};

const LogOutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
)

export default App;