#!/usr/bin/env python3
"""Entry point for the Zurich Insurance LC/NC prototype.

Usage:
    python run.py            # Start dev server on http://localhost:8000
    python -m uvicorn src.main:app --reload --port 8000  # With auto-reload
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))

from src.main import app, init_db

if __name__ == "__main__":
    import uvicorn
    init_db()
    port = int(os.environ.get("PORT", "8000"))
    print(f"Starting Zurich Insurance LC/NC Platform on http://localhost:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
