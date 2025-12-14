import { Student, AttendanceRecord, VerificationResult, Faculty, Subject } from '../types';

const API_URL = 'http://localhost:8000';

export const api = {
  // --- Admin Auth ---
  async getAdminStatus(): Promise<{registered: boolean, photoBase64: string | null}> {
      const res = await fetch(`${API_URL}/admin/status`);
      return await res.json();
  },

  async setupAdmin(photoBase64: string): Promise<void> {
      const res = await fetch(`${API_URL}/admin/setup`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ password: 'admin123', photo_base64: photoBase64 })
      });
      if(!res.ok) throw new Error("Setup failed");
  },

  async loginAdmin(photoBase64: string): Promise<void> {
      const res = await fetch(`${API_URL}/admin/login`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ photo_base64: photoBase64 })
      });
      if(!res.ok) throw new Error("Auth failed");
  },

  // --- Student Management ---
  async getStudents(): Promise<Student[]> {
    try {
      const res = await fetch(`${API_URL}/students`);
      if (!res.ok) throw new Error('Failed to fetch students');
      const data = await res.json();
      // Map backend response (snake_case) to frontend types (camelCase) if necessary
      // backend returns: id, name, department, photo_base64, created_at
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
        photoBase64: data.photoBase64 || photoBase64, // Fallback if backend response differs
        createdAt: Date.now(),
        email: ''
    };
  },

  async updateStudent(studentId: string, name: string, department: string, photoBase64?: string): Promise<void> {
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
    await fetch(`${API_URL}/students/${id}`, { method: 'DELETE' });
  },

  // --- Timetable Management (Subjects) ---
  
  async getSubjects(): Promise<Subject[]> {
      try {
        const res = await fetch(`${API_URL}/subjects`);
        if(!res.ok) return [];
        return await res.json();
      } catch (e) {
        return [];
      }
  },

  async addSubject(sub: Subject): Promise<void> {
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
      await fetch(`${API_URL}/subjects/${abbr}`, { method: 'DELETE' });
  },

  // --- Faculty Management ---

  async getFaculty(): Promise<Faculty[]> {
      try {
        const res = await fetch(`${API_URL}/faculty`);
        if(!res.ok) return [];
        const data = await res.json();
        // Backend returns `photo_base64`, Frontend needs `photoBase64`
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
      const payload = {
          id: fac.id,
          name: fac.name,
          subjects: fac.subjects,
          photo_base64: fac.photoBase64, // Map to snake_case
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
      const payload = {
          id: fac.id,
          name: fac.name,
          subjects: fac.subjects,
          photo_base64: fac.photoBase64, // Map to snake_case
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
      await fetch(`${API_URL}/faculty/${id}`, { method: 'DELETE' });
  },


  // --- Recognition & Attendance ---

  async identifyStudent(photoBase64: string, subject: string = "General"): Promise<VerificationResult> {
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
      
      // Return specific reason from backend (e.g. "No Face", "Bad Image")
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
      await fetch(`${API_URL}/attendance/${recordId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
      });
  }
};