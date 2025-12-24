import os
import sys
import psycopg2
from urllib.parse import urlparse

def apply_sql_file(file_path):
    dsn = os.getenv("POSTGRES_DSN") or os.getenv("DATABASE_URL")
    if not dsn:
        print("[ERROR] No POSTGRES_DSN or DATABASE_URL found.")
        sys.exit(1)

    print(f"[INFO] Connecting to database...")
    try:
        conn = psycopg2.connect(dsn)
        conn.autocommit = True
        cursor = conn.cursor()
    except Exception as e:
        print(f"[ERROR] Connection failed: {e}")
        sys.exit(1)

    print(f"[INFO] Reading SQL script: {file_path}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
            
        print(f"[INFO] Executing SQL script...")
        cursor.execute(sql_content)
        print(f"[SUCCESS] Script {file_path} executed successfully.")
        
    except FileNotFoundError:
        print(f"[ERROR] File not found: {file_path}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] SQL Execution failed: {e}")
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python apply_sql.py <path_to_sql_file>")
        sys.exit(1)
    
    apply_sql_file(sys.argv[1])
