import subprocess
import sys
import time
from pathlib import Path


PROJECT_ROOT = Path(__file__).parent
BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:5500/pages/landing.html"


def start_backend() -> subprocess.Popen:
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ],
        cwd=str(PROJECT_ROOT),
    )


def start_frontend() -> subprocess.Popen:
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "http.server",
            "5500",
            "--bind",
            "127.0.0.1",
        ],
        cwd=str(PROJECT_ROOT),
    )


def stop_process(proc: subprocess.Popen | None) -> None:
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    backend_proc = None
    frontend_proc = None

    try:
        print("Starting BITS Fee Portal servers...")
        backend_proc = start_backend()
        time.sleep(1)
        frontend_proc = start_frontend()

        print(f"Backend API: {BACKEND_URL}")
        print(f"API Docs: {BACKEND_URL}/docs")
        print(f"Frontend: {FRONTEND_URL}")
        print("Press Ctrl+C to stop both servers.")

        while True:
            time.sleep(1)

            if backend_proc.poll() is not None:
                print("Backend server stopped unexpectedly. Shutting down frontend...")
                break

            if frontend_proc.poll() is not None:
                print("Frontend server stopped unexpectedly. Shutting down backend...")
                break

    except KeyboardInterrupt:
        print("\nStopping servers...")
    finally:
        stop_process(frontend_proc)
        stop_process(backend_proc)
        print("All servers stopped.")
