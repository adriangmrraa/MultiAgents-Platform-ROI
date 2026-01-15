import os

keys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "EMAILS_FROM_EMAIL", "SENDER_EMAIL", "FRONTEND_URL"]

for key in keys:
    val = os.getenv(key)
    if not val:
        print(f"{key}: NOT SET")
    else:
        if "PASS" in key or "KEY" in key or "TOKEN" in key:
            print(f"{key}: [SET - HIDDEN]")
        else:
            print(f"{key}: {val}")
