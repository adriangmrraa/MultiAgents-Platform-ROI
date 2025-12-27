import ast
try:
    with open('c:/Users/Asus/Downloads/Platform AI Solutions/orchestrator_service/main.py', 'r', encoding='utf-8') as f:
        source = f.read()
    ast.parse(source)
    print("Syntax OK")
except SyntaxError as e:
    print(f"Syntax Error: {e}")
    print(f"Line: {e.lineno}")
    print(f"Offset: {e.offset}")
    print(f"Text: {e.text}")
