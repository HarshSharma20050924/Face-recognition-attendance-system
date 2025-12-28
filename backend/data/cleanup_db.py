import sqlite3
import numpy as np

# --- Configuration ---
DB_NAME = "data/college.db"
# The size of the expected data type: np.float64 is 8 bytes
EXPECTED_ITEM_SIZE = np.dtype(np.float64).itemsize 

def clean_corrupted_encodings():
    """
    Connects to the database and deletes records in the 'students' table 
    where the 'encoding' BLOB is corrupted (not a multiple of 8 bytes).
    """
    print(f"Connecting to database: {DB_NAME}")
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
    except sqlite3.Error as e:
        print(f"Error connecting to database: {e}")
        return

    # 1. Select all student IDs and their encoding BLOBs
    c.execute("SELECT id, name, encoding FROM students")
    rows = c.fetchall()

    corrupted_ids = []
    
    print(f"Found {len(rows)} student records to check.")

    # 2. Check each record for corruption
    for student_id, name, blob in rows:
        if blob is None:
            # Skip records with no encoding (shouldn't happen with the route logic)
            continue

        if len(blob) % EXPECTED_ITEM_SIZE != 0:
            corrupted_ids.append((student_id, name, len(blob)))
    
    # 3. Report and delete corrupted records
    if not corrupted_ids:
        print("\n✅ No corrupted records found in the 'students' table. Database is clean.")
    else:
        print(f"\n🚨 FOUND {len(corrupted_ids)} CORRUPTED RECORDS:")
        print("---")
        for student_id, name, length in corrupted_ids:
            print(f"ID: {student_id}, Name: {name}, Length: {length} bytes.")
        print("---")
        
        # Prepare IDs for deletion query
        id_list = [cid[0] for cid in corrupted_ids]
        placeholders = ','.join(['?'] * len(id_list))
        
        # Delete the corrupted records
        try:
            c.execute(f"DELETE FROM students WHERE id IN ({placeholders})", id_list)
            conn.commit()
            print(f"\n✅ Successfully deleted {len(corrupted_ids)} corrupted student records.")
            print("You should now be able to run your API successfully.")
        except sqlite3.Error as e:
            print(f"Error during deletion: {e}")

    conn.close()

if __name__ == "__main__":
    clean_corrupted_encodings()