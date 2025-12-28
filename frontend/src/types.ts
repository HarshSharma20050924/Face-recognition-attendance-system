
export interface Student {
  id: string;
  name: string;
  email: string;
  department: string;
  photoBase64: string; 
  createdAt: number;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  subject?: string;
  timestamp: number;
  dateStr: string; 
  status: 'PRESENT' | 'LATE' | 'ABSENT';
  verificationConfidence: number;
}

export interface Faculty {
    id: string; // e.g., "KA" or "NS"
    name: string;
    subjects: string[]; // List of Subject Abbreviations
    photoBase64?: string; // Added for Face Auth
    pin?: string; // Legacy field
}

export interface Subject {
    code: string;
    name: string;
    abbr: string;
}

export type ViewMode = 'DASHBOARD' | 'KIOSK' | 'STUDENTS' | 'REPORTS' | 'TIMETABLE' | 'FACULTY_MAN' | 'WELCOME' | 'FACULTY_AUTH' | 'SUBJECT_SELECT' | 'SESSION_SUMMARY';

export interface VerificationResult {
  match: boolean;
  matchedStudentId?: string;
  matchedStudentName?: string; 
  confidence: number;
  reasoning?: string;
  alreadyMarked?: boolean;
}

export interface SessionStats {
    subject: string;
    totalStudents: number;
    presentCount: number;
    absentStudents: Student[];
    presentStudents: Student[]; // Added list of present students
    startTime: number;
    endTime: number;
}
