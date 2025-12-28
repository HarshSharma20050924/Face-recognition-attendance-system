import sqlite3
import json
import base64
import io
import numpy as np
import face_recognition
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from PIL import Image
from datetime import datetime
import uuid
import uvicorn

# --- App Configuration ---
app = FastAPI()

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "data/attendance.db"

# --- Database Setup ---
def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # Students Table
    c.execute('''CREATE TABLE IF NOT EXISTS students (
                 id TEXT PRIMARY KEY,
                 name TEXT,
                 department TEXT,
                 photo_base64 TEXT,
                 encoding BLOB,
                 created_at INTEGER
                 )''')

    # Faculty Table
    c.execute('''CREATE TABLE IF NOT EXISTS faculty (
                 id TEXT PRIMARY KEY,
                 name TEXT,
                 subjects TEXT,
                 photo_base64 TEXT,
                 encoding BLOB,
                 pin TEXT
                 )''')

    # Subjects Table
    c.execute('''CREATE TABLE IF NOT EXISTS subjects (
                 abbr TEXT PRIMARY KEY,
                 code TEXT,
                 name TEXT
                 )''')

    # Attendance Logs
    c.execute('''CREATE TABLE IF NOT EXISTS attendance (
                 id TEXT PRIMARY KEY,
                 student_id TEXT,
                 student_name TEXT,
                 subject TEXT,
                 timestamp INTEGER,
                 date_str TEXT,
                 status TEXT
                 )''')
    
    # Admin Table
    c.execute('''CREATE TABLE IF NOT EXISTS admin (
                 id TEXT PRIMARY KEY,
                 password TEXT,
                 photo_base64 TEXT,
                 encoding BLOB
                 )''')

    conn.commit()
    conn.close()

init_db()

# --- Helper Functions ---

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def decode_image(base64_string: str):
    try:
        if "base64," in base64_string:
            base64_string = base64_string.split("base64,")[1]
        image_data = base64.b64decode(base64_string)
        image = Image.open(io.BytesIO(image_data))
        return np.array(image.convert('RGB'))
    except Exception as e:
        print(f"Image decode error: {e}")
        return None

def get_face_encoding(image_np):
    try:
        # Detect faces
        face_locations = face_recognition.face_locations(image_np)
        if not face_locations:
            return None
        # Get encoding for the first face found
        encodings = face_recognition.face_encodings(image_np, face_locations)
        if encodings:
            return encodings[0]
        return None
    except Exception as e:
        print(f"Encoding error: {e}")
        return None

def serialize_encoding(encoding):
    return encoding.tobytes()

def deserialize_encoding(blob):
    return np.frombuffer(blob, dtype=np.float64)

# --- Pydantic Models ---

class StudentModel(BaseModel):
    id: str = None # Optional for updates
    student_id: str
    name: str
    department: str
    photo_base64: Optional[str] = None

class FacultyModel(BaseModel):
    id: str
    name: str
    subjects: List[str]
    photo_base64: Optional[str] = None
    pin: Optional[str] = None

class SubjectModel(BaseModel):
    abbr: str
    code: str
    name: str

class IdentificationRequest(BaseModel):
    photo_base64: str
    subject: str = "General"

class UpdateAttendance(BaseModel):
    status: str

class AdminSetup(BaseModel):
    password: str
    photo_base64: str

class AdminLogin(BaseModel):
    photo_base64: str

# --- Routes: Admin ---

@app.get("/admin/status")
def get_admin_status():
    conn = get_db()
    admin = conn.execute("SELECT * FROM admin WHERE id='ADMIN'").fetchone()
    conn.close()
    if admin:
        return {"registered": True, "photoBase64": admin['photo_base64']}
    return {"registered": False, "photoBase64": None}

@app.post("/admin/setup")
def setup_admin(data: AdminSetup):
    image_np = decode_image(data.photo_base64)
    if image_np is None:
        raise HTTPException(400, "Invalid image")
    
    encoding = get_face_encoding(image_np)
    if encoding is None:
        raise HTTPException(400, "No face detected")
    
    conn = get_db()
    conn.execute("INSERT OR REPLACE INTO admin (id, password, photo_base64, encoding) VALUES (?, ?, ?, ?)",
                 ("ADMIN", data.password, data.photo_base64, serialize_encoding(encoding)))
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/admin/login")
def login_admin(data: AdminLogin):
    image_np = decode_image(data.photo_base64)
    if image_np is None: raise HTTPException(400, "Invalid image")
    
    current_encoding = get_face_encoding(image_np)
    if current_encoding is None: raise HTTPException(400, "No face detected")
    
    conn = get_db()
    admin = conn.execute("SELECT encoding FROM admin WHERE id='ADMIN'").fetchone()
    conn.close()
    
    if not admin: raise HTTPException(404, "Admin not configured")
    
    stored_encoding = deserialize_encoding(admin['encoding'])
    match = face_recognition.compare_faces([stored_encoding], current_encoding, tolerance=0.5)[0]
    
    if match:
        return {"status": "authorized"}
    else:
        raise HTTPException(401, "Face not recognized")

# --- Routes: Students ---

@app.get("/students")
def get_students():
    conn = get_db()
    rows = conn.execute("SELECT id, name, department, photo_base64, created_at FROM students").fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/students")
def add_student(student: StudentModel):
    # Check duplicate ID
    conn = get_db()
    existing = conn.execute("SELECT id FROM students WHERE id=?", (student.student_id,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(400, "Student ID already exists")

    # Process Face
    if not student.photo_base64:
        conn.close()
        raise HTTPException(400, "Photo required")

    image_np = decode_image(student.photo_base64)
    encoding = get_face_encoding(image_np)
    
    if encoding is None:
        conn.close()
        raise HTTPException(400, "No face detected in photo. Please retake.")

    # Check for duplicate face (optional, but good for security)
    all_students = conn.execute("SELECT name, encoding FROM students").fetchall()
    for s in all_students:
        if s['encoding']:
            known_enc = deserialize_encoding(s['encoding'])
            if face_recognition.compare_faces([known_enc], encoding, tolerance=0.4)[0]:
                conn.close()
                raise HTTPException(400, f"Face already registered as {s['name']}")

    # Insert
    conn.execute(
        "INSERT INTO students (id, name, department, photo_base64, encoding, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (student.student_id, student.name, student.department, student.photo_base64, serialize_encoding(encoding), int(datetime.now().timestamp() * 1000))
    )
    conn.commit()
    conn.close()
    return {"id": student.student_id, "name": student.name, "photoBase64": student.photo_base64}

@app.put("/students/{id}")
def update_student(id: str, student: StudentModel):
    conn = get_db()
    
    if student.photo_base64:
        image_np = decode_image(student.photo_base64)
        encoding = get_face_encoding(image_np)
        if encoding is None:
            conn.close()
            raise HTTPException(400, "No face detected")
        
        conn.execute(
            "UPDATE students SET name=?, department=?, photo_base64=?, encoding=? WHERE id=?",
            (student.name, student.department, student.photo_base64, serialize_encoding(encoding), id)
        )
    else:
        conn.execute(
            "UPDATE students SET name=?, department=? WHERE id=?",
            (student.name, student.department, id)
        )
        
    conn.commit()
    conn.close()
    return {"status": "updated"}

@app.delete("/students/{id}")
def delete_student(id: str):
    conn = get_db()
    conn.execute("DELETE FROM students WHERE id=?", (id,))
    conn.execute("DELETE FROM attendance WHERE student_id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

# --- Routes: Subjects ---

@app.get("/subjects")
def get_subjects():
    conn = get_db()
    rows = conn.execute("SELECT * FROM subjects").fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.post("/subjects")
def add_subject(sub: SubjectModel):
    conn = get_db()
    try:
        conn.execute("INSERT INTO subjects (abbr, code, name) VALUES (?, ?, ?)", 
                     (sub.abbr, sub.code, sub.name))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(400, "Subject abbreviation already exists")
    conn.close()
    return {"status": "added"}

@app.delete("/subjects/{abbr}")
def delete_subject(abbr: str):
    conn = get_db()
    conn.execute("DELETE FROM subjects WHERE abbr=?", (abbr,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

# --- Routes: Faculty ---

@app.get("/faculty")
def get_faculty():
    conn = get_db()
    # Explicitly select columns to exclude 'encoding' BLOB which causes JSON serialization errors
    rows = conn.execute("SELECT id, name, subjects, photo_base64, pin FROM faculty").fetchall()
    conn.close()
    result = []
    for row in rows:
        d = dict(row)
        # Parse subjects from JSON string
        d['subjects'] = json.loads(d['subjects']) if d['subjects'] else []
        result.append(d)
    return result

@app.post("/faculty")
def add_faculty(fac: FacultyModel):
    encoding_blob = None
    if fac.photo_base64:
        image_np = decode_image(fac.photo_base64)
        encoding = get_face_encoding(image_np)
        if encoding is not None:
            encoding_blob = serialize_encoding(encoding)
    
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO faculty (id, name, subjects, photo_base64, encoding, pin) VALUES (?, ?, ?, ?, ?, ?)",
            (fac.id, fac.name, json.dumps(fac.subjects), fac.photo_base64, encoding_blob, fac.pin)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(400, "Faculty ID already exists")
    conn.close()
    return {"status": "added"}

@app.put("/faculty")
def update_faculty(fac: FacultyModel):
    conn = get_db()
    
    update_fields = ["name=?, subjects=?, pin=?"]
    params = [fac.name, json.dumps(fac.subjects), fac.pin]
    
    if fac.photo_base64:
        image_np = decode_image(fac.photo_base64)
        encoding = get_face_encoding(image_np)
        if encoding is not None:
            update_fields.append("photo_base64=?, encoding=?")
            params.extend([fac.photo_base64, serialize_encoding(encoding)])
    
    params.append(fac.id)
    
    sql = f"UPDATE faculty SET {', '.join(update_fields)} WHERE id=?"
    conn.execute(sql, tuple(params))
    conn.commit()
    conn.close()
    return {"status": "updated"}

@app.delete("/faculty/{id}")
def delete_faculty(id: str):
    conn = get_db()
    conn.execute("DELETE FROM faculty WHERE id=?", (id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

# --- Routes: Identification & Attendance ---

@app.post("/identify")
def identify_student(data: IdentificationRequest):
    # 1. Decode Image
    unknown_image = decode_image(data.photo_base64)
    if unknown_image is None:
        return {"match": False, "reason": "Bad Image"}

    # 2. Get Encoding
    unknown_encoding = get_face_encoding(unknown_image)
    if unknown_encoding is None:
        return {"match": False, "reason": "No Face"}

    # 3. Fetch all student encodings
    conn = get_db()
    students = conn.execute("SELECT id, name, encoding FROM students").fetchall()
    
    known_encodings = []
    known_ids = []
    
    for s in students:
        if s['encoding']:
            known_encodings.append(deserialize_encoding(s['encoding']))
            known_ids.append(s)

    if not known_encodings:
        conn.close()
        return {"match": False, "reason": "No students in database"}

    # 4. Compare
    # Tolerance: Lower is stricter. 0.5 is usually good for verified photos.
    distances = face_recognition.face_distance(known_encodings, unknown_encoding)
    best_match_index = np.argmin(distances)
    
    if distances[best_match_index] < 0.5:
        matched_student = known_ids[best_match_index]
        
        # 5. Check duplicate attendance for today/subject
        today_str = datetime.now().strftime("%Y-%m-%d")
        existing = conn.execute(
            "SELECT id FROM attendance WHERE student_id=? AND subject=? AND date_str=?",
            (matched_student['id'], data.subject, today_str)
        ).fetchone()
        
        already_marked = False
        if existing:
            already_marked = True
        else:
            # Mark Attendance
            record_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO attendance (id, student_id, student_name, subject, timestamp, date_str, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (record_id, matched_student['id'], matched_student['name'], data.subject, int(datetime.now().timestamp() * 1000), today_str, 'PRESENT')
            )
            conn.commit()
        
        conn.close()
        return {
            "match": True, 
            "student": {"id": matched_student['id'], "name": matched_student['name']},
            "already_marked": already_marked
        }
    
    conn.close()
    return {"match": False, "reason": "Unknown Face"}

@app.get("/attendance")
def get_attendance(date: Optional[str] = None):
    conn = get_db()
    if date:
        rows = conn.execute("SELECT * FROM attendance WHERE date_str=?", (date,)).fetchall()
    else:
        # Default last 500 records
        rows = conn.execute("SELECT * FROM attendance ORDER BY timestamp DESC LIMIT 500").fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.put("/attendance/{id}")
def update_attendance_status(id: str, data: UpdateAttendance):
    conn = get_db()
    conn.execute("UPDATE attendance SET status=? WHERE id=?", (data.status, id))
    conn.commit()
    conn.close()
    return {"status": "updated"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)