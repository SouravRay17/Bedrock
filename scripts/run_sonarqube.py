#!/usr/bin/env python3
"""
SonarQube Analysis & Coverage Orchestrator for Amazon BedRock AgentOS Studio.
Runs pytest test coverage and triggers local or CI SonarScanner analysis.
"""

import argparse
import os
import shutil
import subprocess
import sys


def run_command(cmd, cwd=None, exit_on_fail=True):
    print(f"\n[RUN] {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    res = subprocess.run(cmd, cwd=cwd, shell=isinstance(cmd, str))
    if res.returncode != 0 and exit_on_fail:
        print(f"\n[ERROR] Command failed with exit code {res.returncode}")
        sys.exit(res.returncode)
    return res.returncode


def generate_coverage():
    print("\n=== Generating Code Coverage Report (coverage.xml) ===")
    run_command([
        sys.executable, "-m", "pytest",
        "--cov=services",
        "--cov=packages",
        "--cov=apps/api",
        "--cov-report=xml:coverage.xml",
        "--cov-report=term-missing"
    ])
    print("[SUCCESS] coverage.xml generated.")


def start_sonar_server():
    print("\n=== Starting SonarQube Server via Docker Compose ===")
    run_command(["docker", "compose", "-f", "docker-compose.sonar.yml", "up", "-d", "sonarqube", "db"])
    print("[INFO] SonarQube is booting at http://localhost:9000 (Default login: admin / admin)")


def run_sonar_scanner(sonar_host=None, sonar_token=None):
    print("\n=== Running SonarScanner ===")
    cmd = ["sonar-scanner"]
    if sonar_host:
        cmd.append(f"-Dsonar.host.url={sonar_host}")
    if sonar_token:
        cmd.append(f"-Dsonar.login={sonar_token}")

    # Check if local sonar-scanner binary exists
    if shutil.which("sonar-scanner"):
        run_command(cmd)
    elif shutil.which("docker"):
        print("[INFO] Local sonar-scanner not found. Running sonar-scanner via Docker container...")
        run_command([
            "docker", "compose", "-f", "docker-compose.sonar.yml",
            "run", "--rm", "sonar-scanner"
        ])
    else:
        print("[WARN] Neither local 'sonar-scanner' nor 'docker' is available on PATH.")
        print("Please install sonar-scanner CLI: https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/scanners/sonarscanner/")


def main():
    parser = argparse.ArgumentParser(description="SonarQube Local Runner & Quality Gate Orchestrator")
    parser.add_argument("--server", action="store_true", help="Start local SonarQube server via Docker Compose")
    parser.add_argument("--scan", action="store_true", help="Run SonarScanner code analysis")
    parser.add_argument("--coverage-only", action="store_true", help="Only run tests and generate coverage.xml")
    parser.add_argument("--host", default=os.environ.get("SONAR_HOST_URL", "http://localhost:9000"), help="SonarQube host URL")
    parser.add_argument("--token", default=os.environ.get("SONAR_TOKEN"), help="SonarQube authentication token")

    args = parser.parse_args()

    if args.server:
        start_sonar_server()
        return

    if args.coverage_only:
        generate_coverage()
        return

    # Default flow: generate coverage and run scan
    generate_coverage()
    if args.scan or os.environ.get("SONAR_TOKEN"):
        run_sonar_scanner(args.host, args.token)
    else:
        print("\n[INFO] Tests & coverage report completed. Use '--scan' or '--server' to run SonarQube.")


if __name__ == "__main__":
    main()
