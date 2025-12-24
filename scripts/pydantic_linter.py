import os
import re
import sys

def check_pydantic_trap(directory):
    trap_found = False
    # Regex to find class definitions that are indented (i.e., inside a function/class)
    # and likely inherit from BaseModel or are just classes inside functions.
    # Looking for: indented 'class' + Name + optionally (BaseModel)
    class_regex = re.compile(r'^\s+class\s+\w+')
    
    for root, _, files in os.walk(directory):
        if "__pycache__" in root or ".git" in root:
            continue
            
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    in_async_func = False
                    for i, line in enumerate(lines):
                        if re.match(r'^\s*async\s+def\s+|^\s*def\s+', line):
                            # We are entering a function context
                            pass
                        
                        if class_regex.match(line):
                            print(f"❌ PYDANTIC TRAP DETECTED: Class defined inside function at {path}:{i+1}")
                            print(f"   Line: {line.strip()}")
                            trap_found = True
                            
    return trap_found

if __name__ == "__main__":
    target_dir = sys.argv[1] if len(sys.argv) > 1 else "."
    if check_pydantic_trap(target_dir):
        print("\nFix these issues before pushing! BaseModel classes must be top-level.")
        sys.exit(1)
    else:
        print("✅ No Pydantic Traps found in functions.")
        sys.exit(0)
