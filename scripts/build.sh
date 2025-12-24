#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "--- Starting Omega Build Process ---"

# Detect service based on directory or environment variable if needed
# For now, just install dependencies. 
# Different services might need different build steps.

if [ -f "requirements.txt" ]; then
    echo "[BUILD] Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
fi

if [ -f "package.json" ]; then
    echo "[BUILD] Installing Node dependencies..."
    npm install
fi

echo "--- Build Completed Successfully ---"
