import os
import subprocess
import sys


def start_services():
    print("================================================================")
    print("[*] Starting AgentOS (Bedrock Canvas) Multi-Agent Operating System")
    print("================================================================")
    print("1. Control Plane & Runtime API: http://localhost:8000")
    print("2. Studio Web Frontend:          http://localhost:3000")
    print("3. Documentation & Swagger:      http://localhost:8000/docs")
    print("================================================================")

    # Set PYTHONPATH
    os.environ["PYTHONPATH"] = "."
    root_dir = os.path.dirname(os.path.abspath(__file__))
    web_dir = os.path.join(root_dir, "apps", "web")

    processes = []
    try:
        # Start FastAPI backend
        p_api = subprocess.Popen([sys.executable, "-m", "uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"], cwd=root_dir)
        processes.append(p_api)

        # Start Vite frontend
        npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
        p_web = subprocess.Popen([npm_cmd, "run", "dev"], cwd=web_dir)
        processes.append(p_web)

        for p in processes:
            p.wait()
    except KeyboardInterrupt:
        print("\n[*] Shutting down AgentOS services...")
        for p in processes:
            p.terminate()

if __name__ == "__main__":
    start_services()
