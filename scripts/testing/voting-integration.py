#!/usr/bin/env python3
"""Run voting socket tests against a disposable loopback Redis server."""

import os
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GUARD_KEY = "_rush_voting_integration_guard"


def available_port():
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        return reservation.getsockname()[1]


def redis_cli(port, *arguments):
    return subprocess.run(
        ["redis-cli", "-h", "127.0.0.1", "-p", str(port), *arguments],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()


def main():
    run_id = uuid.uuid4().hex
    with tempfile.TemporaryDirectory(prefix="rush-voting-test-") as directory:
        port = available_port()
        log_path = Path(directory, "redis.log")
        command = [
            "redis-server", "--bind", "127.0.0.1", "--port", str(port),
            "--save", "", "--appendonly", "no", "--dir", directory,
            "--logfile", str(log_path),
        ]
        # The captured PID and private directory ensure cleanup touches only this test instance.
        server = subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
        try:
            for _ in range(100):
                if server.poll() is not None:
                    raise RuntimeError(f"Redis exited during startup:\n{log_path.read_text()}")
                try:
                    if redis_cli(port, "PING") == "PONG":
                        break
                except subprocess.CalledProcessError:
                    pass
                time.sleep(0.05)
            else:
                raise RuntimeError(f"Redis did not become ready:\n{log_path.read_text()}")

            redis_directory = redis_cli(port, "CONFIG", "GET", "dir").splitlines()[-1]
            if Path(redis_directory).resolve() != Path(directory).resolve():
                raise RuntimeError("The loopback port does not belong to the test Redis instance")
            redis_cli(port, "SET", GUARD_KEY, run_id)

            env = os.environ.copy()
            env.update({
                "REDIS_URL": f"redis://127.0.0.1:{port}",
                "RUSH_TEST_REDIS_PORT": str(port),
                "RUSH_TEST_REDIS_RUN_ID": run_id,
            })
            voting_status = subprocess.call(
                ["cargo", "test", "--locked", "--manifest-path", str(ROOT / "server/websockets/voting/Cargo.toml"),
                 "--features", "integration-tests", "--", "--nocapture"],
                cwd=ROOT,
                env=env,
            )
            if voting_status:
                return voting_status
            return subprocess.call(
                ["cargo", "test", "--locked", "--manifest-path", str(ROOT / "server/api/Cargo.toml"),
                 "--features", "redis-integration-tests", "voting_redis_contracts", "--", "--nocapture"],
                cwd=ROOT,
                env=env,
            )
        finally:
            server.terminate()
            try:
                server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()


if __name__ == "__main__":
    sys.exit(main())
