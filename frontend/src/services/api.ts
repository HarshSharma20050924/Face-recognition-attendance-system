
import { Student, AttendanceRecord, VerificationResult, Faculty, Subject } from '../types';
import { SUBJECTS, FACULTY } from '../data/timetable';

// --- CONFIGURATION ---
// Set this to true to run in "Serverless Demo Mode" (e.g. on Vercel)
// Set to false to connect to the Python FastAPI backend
export const IS_DEMO_MODE = true; 
const API_URL = 'http://localhost:8000';

// --- MOCK DATABASE (LocalStorage Helper) ---
const DB = {
    get: (key: string, defaultVal: any) => {
        const stored = localStorage.getItem(`omnisight_${key}`);
        return stored ? JSON.parse(stored) : defaultVal;
    },
    set: (key: string, val: any) => {
        localStorage.setItem(`omnisight_${key}`, JSON.stringify(val));
    },
    delay: (ms: number) => new Promise(res => setTimeout(res, ms))
};

// Initial Mock Data Seeding
const seedData = () => {
    if(!localStorage.getItem('omnisight_students')) {
        const mockStudents: Student[] = [
            { id: 'CS-2024-001', name: 'John Doe', email: 'john@mit.ac.in', department: 'CSE', photoBase64: 'https://randomuser.me/api/portraits/men/32.jpg', createdAt: Date.now() },
            { id: 'CS-2024-002', name: 'Jane Smith', email: 'jane@mit.ac.in', department: 'AI&DS', photoBase64: 'https://randomuser.me/api/portraits/women/44.jpg', createdAt: Date.now() },
            { id: 'CS-2024-003', name: 'Alice Johnson', email: 'alice@mit.ac.in', department: 'IT', photoBase64: 'https://randomuser.me/api/portraits/women/68.jpg', createdAt: Date.now() }
        ];
        DB.set('students', mockStudents);
    }
    if(!localStorage.getItem('omnisight_faculty')) {
        DB.set('faculty', FACULTY);
    }
    if(!localStorage.getItem('omnisight_subjects')) {
        DB.set('subjects', SUBJECTS);
    }
    if(!localStorage.getItem('omnisight_attendance')) {
        // Generate some fake past attendance
        const pastLogs: AttendanceRecord[] = [];
        const students = DB.get('students', []);
        const today = new Date();
        
        // Create logs for today and yesterday
        [0, 1].forEach(daysAgo => {
            const d = new Date(today);
            d.setDate(d.getDate() - daysAgo);
            const dateStr = d.toISOString().split('T')[0];
            
            students.forEach((s: Student, idx: number) => {
                // Randomly present or absent
                if (Math.random() > 0.2) {
                    pastLogs.push({
                        id: Math.random().toString(36).substr(2, 9),
                        studentId: s.id,
                        studentName: s.name,
                        subject: 'TOC',
                        timestamp: d.setHours(10, 30, 0),
                        dateStr: dateStr,
                        status: 'PRESENT',
                        verificationConfidence: 0.98
                    });
                }
            });
        });
        DB.set('attendance', pastLogs);
    }
};

if (IS_DEMO_MODE) {
    console.log("OmniSight running in DEMO MODE (Mock API)");
    seedData();
}

export const api = {
  // --- Admin Auth ---
  async getAdminStatus(): Promise<{registered: boolean, photoBase64: string | null}> {
      if (IS_DEMO_MODE) {
          const admin = DB.get('admin_setup', null);
          return { registered: !!admin, photoBase64: admin?.photoBase64 || null };
      }
      const res = await fetch(`${API_URL}/admin/status`);
      return await res.json();
  },

  async setupAdmin(photoBase64: string): Promise<void> {
      if (IS_DEMO_MODE) {
          await DB.delay(1000);
          DB.set('admin_setup', { password: 'admin123', photoBase64 });
          return;
      }
      const res = await fetch(`${API_URL}/admin/setup`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ password: 'admin123', photo_base64: photoBase64 })
      });
      if(!res.ok) throw new Error("Setup failed");
  },

  async loginAdmin(photoBase64: string): Promise<void> {
      if (IS_DEMO_MODE) {
          await DB.delay(1500);
          const admin = DB.get('admin_setup', null);
          if (!admin) throw new Error("Admin not registered");
          // In demo mode, we accept ANY face as correct if admin is registered, 
          // or you could implement strict checking if you had a JS face matcher here.
          // For demo fluidity, we assume the biometric check passed if the component sent a good image.
          return;
      }
      const res = await fetch(`${API_URL}/admin/login`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ photo_base64: photoBase64 })
      });
      if(!res.ok) throw new Error("Auth failed");
  },

  // --- Student Management ---
  async getStudents(): Promise<Student[]> {
    if (IS_DEMO_MODE) {
        return DB.get('students', []);
    }
    try {
      const res = await fetch(`${API_URL}/students`);
      if (!res.ok) throw new Error('Failed to fetch students');
      const data = await res.json();
      return data.map((s: any) => ({
          id: s.id,
          name: s.name,
          department: s.department,
          photoBase64: s.photo_base64,
          createdAt: s.created_at
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async addStudent(name: string, studentId: string, department: string, photoBase64: string): Promise<Student> {
    if (IS_DEMO_MODE) {
        await DB.delay(800);
        const students = DB.get('students', []);
        const newStudent: Student = {
            id: studentId,
            name,
            department,
            photoBase64,
            email: '',
            createdAt: Date.now()
        };
        DB.set('students', [...students, newStudent]);
        return newStudent;
    }

    const res = await fetch(`${API_URL}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, student_id: studentId, department, photo_base64: photoBase64 })
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to add student');
    }
    const data = await res.json();
    return {
        id: data.id,
        name: data.name,
        department: data.department || department,
        photoBase64: data.photoBase64 || photoBase64,
        createdAt: Date.now(),
        email: ''
    };
  },

  async updateStudent(studentId: string, name: string, department: string, photoBase64?: string): Promise<void> {
    if (IS_DEMO_MODE) {
        const students = DB.get('students', []);
        const updated = students.map((s: Student) => 
            s.id === studentId ? { ...s, name, department, photoBase64: photoBase64 || s.photoBase64 } : s
        );
        DB.set('students', updated);
        return;
    }
    const res = await fetch(`${API_URL}/students/${studentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
          name, 
          student_id: studentId, 
          department, 
          photo_base64: photoBase64 
      })
    });
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to update student');
    }
  },

  async deleteStudent(id: string): Promise<void> {
    if (IS_DEMO_MODE) {
        const students = DB.get('students', []);
        DB.set('students', students.filter((s: Student) => s.id !== id));
        return;
    }
    await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' });
  },

  // --- Timetable Management (Subjects) ---
  
  async getSubjects(): Promise<Subject[]> {
      if (IS_DEMO_MODE) return DB.get('subjects', []);
      try {
        const res = await fetch(`${API_URL}/subjects`);
        if(!res.ok) return [];
        return await res.json();
      } catch (e) {
        return [];
      }
  },

  async addSubject(sub: Subject): Promise<void> {
      if (IS_DEMO_MODE) {
          const subs = DB.get('subjects', []);
          DB.set('subjects', [...subs, sub]);
          return;
      }
      const res = await fetch(`${API_URL}/subjects`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(sub)
      });
      if (!res.ok) {
          throw new Error('Failed to add subject');
      }
  },

  async deleteSubject(abbr: string): Promise<void> {
      if (IS_DEMO_MODE) {
          const subs = DB.get('subjects', []);
          DB.set('subjects', subs.filter((s: Subject) => s.abbr !== abbr));
          return;
      }
      await fetch(`${API_URL}/subjects/${abbr}`, { method: 'DELETE' });
  },

  // --- Faculty Management ---

  async getFaculty(): Promise<Faculty[]> {
      if (IS_DEMO_MODE) return DB.get('faculty', []);
      try {
        const res = await fetch(`${API_URL}/faculty`);
        if(!res.ok) return [];
        const data = await res.json();
        return data.map((f: any) => ({
            id: f.id,
            name: f.name,
            subjects: f.subjects,
            photoBase64: f.photo_base64,
            pin: f.pin
        })); 
      } catch (e) {
        return [];
      }
  },

  async addFaculty(fac: Faculty): Promise<void> {
      if (IS_DEMO_MODE) {
          const list = DB.get('faculty', []);
          DB.set('faculty', [...list, fac]);
          return;
      }
      const payload = {
          id: fac.id,
          name: fac.name,
          subjects: fac.subjects,
          photo_base64: fac.photoBase64,
          pin: fac.pin
      };
      const res = await fetch(`${API_URL}/faculty`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
      });
      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.detail || 'Failed to add faculty');
      }
  },

  async updateFaculty(fac: Faculty): Promise<void> {
      if (IS_DEMO_MODE) {
          const list = DB.get('faculty', []);
          DB.set('faculty', list.map((f: Faculty) => f.id === fac.id ? fac : f));
          return;
      }
      const payload = {
          id: fac.id,
          name: fac.name,
          subjects: fac.subjects,
          photo_base64: fac.photoBase64,
          pin: fac.pin
      };
      const res = await fetch(`${API_URL}/faculty`, {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
      });
      if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.detail || 'Failed to update faculty');
      }
  },

  async deleteFaculty(id: string): Promise<void> {
      if (IS_DEMO_MODE) {
          const list = DB.get('faculty', []);
          DB.set('faculty', list.filter((f: Faculty) => f.id !== id));
          return;
      }
      await fetch(`${API_URL}/faculty/${id}`, { method: 'DELETE' });
  },


  // --- Recognition & Attendance ---

  async identifyStudent(photoBase64: string, subject: string = "General"): Promise<VerificationResult> {
    if (IS_DEMO_MODE) {
        await DB.delay(1200); // Simulate network/processing latency
        
        // In demo mode, we randomly match a student from the DB
        // unless it's a completely black image or something.
        const students = DB.get('students', []);
        
        if (students.length === 0) {
            return { match: false, confidence: 0, reasoning: "No students in DB" };
        }

        // Simulate logic: Pick a random student to "recognize" 
        // In a real demo you might want to use the actual face descriptor, 
        // but here we just simulate a successful scan.
        const randomStudent = students[Math.floor(Math.random() * students.length)];
        
        // Check for duplicate in today's logs
        const todayStr = new Date().toISOString().split('T')[0];
        const logs = DB.get('attendance', []);
        const alreadyMarked = logs.some((l: AttendanceRecord) => 
            l.dateStr === todayStr && l.studentId === randomStudent.id && l.subject === subject
        );

        if (!alreadyMarked) {
            const newLog: AttendanceRecord = {
                id: Math.random().toString(36).substr(2, 9),
                studentId: randomStudent.id,
                studentName: randomStudent.name,
                subject: subject,
                timestamp: Date.now(),
                dateStr: todayStr,
                status: 'PRESENT',
                verificationConfidence: 0.99
            };
            DB.set('attendance', [...logs, newLog]);
        }

        return {
            match: true,
            matchedStudentId: randomStudent.id,
            matchedStudentName: randomStudent.name,
            confidence: 0.98,
            reasoning: "Demo Match",
            alreadyMarked: alreadyMarked
        };
    }

    try {
      const res = await fetch(`${API_URL}/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo_base64: photoBase64, subject: subject })
      });
      
      const data = await res.json();
      
      if (data.match) {
        return {
          match: true,
          matchedStudentId: data.student.id,
          matchedStudentName: data.student.name, 
          confidence: 0.99,
          reasoning: "Biometric Match Confirmed",
          alreadyMarked: data.already_marked
        };
      }
      
      return { 
          match: false, 
          confidence: 0, 
          reasoning: data.reason || "Face not found in database" 
      };
    } catch (e) {
      console.error("API Error", e);
      return { match: false, confidence: 0, reasoning: "Server Error" };
    }
  },

  async getAttendanceLogs(dateStr?: string): Promise<AttendanceRecord[]> {
    if (IS_DEMO_MODE) {
        return DB.get('attendance', []);
    }
    try {
        const url = dateStr ? `${API_URL}/attendance?date=${dateStr}` : `${API_URL}/attendance`;
        const res = await fetch(url);
        const data = await res.json();
        
        return data.map((log: any) => ({
        id: log.id,
        studentId: log.student_id,
        studentName: log.student_name,
        subject: log.subject,
        timestamp: new Date(log.timestamp).getTime(),
        dateStr: log.date_str,
        status: log.status,
        verificationConfidence: 0.99
        }));
    } catch(e) {
        return [];
    }
  },

  async updateAttendanceStatus(recordId: string, newStatus: string): Promise<void> {
      if (IS_DEMO_MODE) {
          const logs = DB.get('attendance', []);
          const updated = logs.map((l: AttendanceRecord) => l.id === recordId ? {...l, status: newStatus} : l);
          DB.set('attendance', updated);
          return;
      }
      await fetch(`${API_URL}/attendance/${recordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
      });
  }
};
