import subprocess
import sys
import time
import socket
import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).parent

# Parse command-line arguments
BACKEND_PORT = 8000
FRONTEND_PORT = 6500    

if '--backend-port' in sys.argv:
    idx = sys.argv.index('--backend-port')
    if idx + 1 < len(sys.argv):
        try:
            BACKEND_PORT = int(sys.argv[idx + 1])
        except ValueError:
            print(f"Invalid backend port: {sys.argv[idx + 1]}")
            sys.exit(1)

if '--frontend-port' in sys.argv:
    idx = sys.argv.index('--frontend-port')
    if idx + 1 < len(sys.argv):
        try:
            FRONTEND_PORT = int(sys.argv[idx + 1])
        except ValueError:
            print(f"Invalid frontend port: {sys.argv[idx + 1]}")
            sys.exit(1)

BACKEND_URL = f"http://127.0.0.1:{BACKEND_PORT}"
FRONTEND_URL = f"http://127.0.0.1:{FRONTEND_PORT}/pages/landing.html"


def check_port_in_use(port: int) -> bool:
    """Check if a port is already in use"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', port))
    sock.close()
    return result == 0


def wait_for_port_free(port: int, max_wait: int = 10) -> bool:
    """Wait for a port to become available"""
    start_time = time.time()
    while time.time() - start_time < max_wait:
        if not check_port_in_use(port):
            return True
        print(f"Waiting for port {port} to become available...")
        time.sleep(1)
    return False


def start_backend() -> subprocess.Popen:
    # Set environment variable to allow socket address reuse (Windows)
    env = os.environ.copy()
    env['PYTHONUNBUFFERED'] = '1'
    
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(BACKEND_PORT),
            "--reload",
            "--loop",
            "asyncio",
        ],
        cwd=str(PROJECT_ROOT),
        env=env,
    )


def start_frontend() -> subprocess.Popen:
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "http.server",
            str(FRONTEND_PORT),
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
        print(f"Backend will use port {BACKEND_PORT}, Frontend will use port {FRONTEND_PORT}")
        
        # Check if ports are already in use and wait for them
        if check_port_in_use(BACKEND_PORT):
            print(f"⚠️  Port {BACKEND_PORT} is currently in use. Waiting for it to become available...")
            if not wait_for_port_free(BACKEND_PORT):
                print(f"❌ Port {BACKEND_PORT} is still in use.")
                print(f"   Try running with different ports: python run.py --backend-port 8001 --frontend-port 5501")
                sys.exit(1)
            print(f"✓ Port {BACKEND_PORT} is now available.")
        
        if check_port_in_use(FRONTEND_PORT):
            print(f"⚠️  Port {FRONTEND_PORT} is currently in use. Waiting for it to become available...")
            if not wait_for_port_free(FRONTEND_PORT):
                print(f"❌ Port {FRONTEND_PORT} is still in use.")
                sys.exit(1)
            print("✓ Port 5500 is now available.")
        
        backend_proc = start_backend()
        time.sleep(2)  # Give backend more time to start
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
