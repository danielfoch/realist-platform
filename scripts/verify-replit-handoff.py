#!/usr/bin/env python3
"""Validate REPLIT_PULL_TODAY.md against live repo facts.

Default mode is safe/fast: verify branch, commit, files, package scripts, and command
shape without running npm gates. Use --run-gates to execute the commands listed under
"Replit commands to run" and capture pass/fail results.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


@dataclass
class Check:
    name: str
    status: str
    detail: str = ""


def run(cmd: list[str], cwd: Path, timeout: int = 120) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=cwd, text=True, capture_output=True, timeout=timeout)


def section(text: str, heading_fragment: str) -> str:
    pattern = re.compile(rf"^##\s+\d+\.\s+.*{re.escape(heading_fragment)}.*$", re.I | re.M)
    match = pattern.search(text)
    if not match:
        return ""
    start = match.end()
    nxt = re.search(r"^##\s+\d+\.\s+", text[start:], re.M)
    end = start + nxt.start() if nxt else len(text)
    return text[start:end].strip()


def parse_branch_commit(text: str) -> tuple[str | None, str | None]:
    branch = None
    commit = None
    m = re.search(r"Branch:\s*`?([^`\n]+)`?", text, re.I)
    if m:
        branch = m.group(1).strip()
    m = re.search(r"(?:Code\s+)?commit SHA:\s*`?([a-f0-9]{7,40})`?", text, re.I)
    if m:
        commit = m.group(1).strip()
    return branch, commit


def parse_files(text: str) -> list[str]:
    block = section(text, "Files changed")
    files: list[str] = []
    for line in block.splitlines():
        m = re.match(r"\s*-\s+`?([^`\n]+?)`?\s*$", line)
        if m:
            item = m.group(1).strip()
            if item and not item.lower().startswith(("none", "n/a")):
                files.append(item)
    return files


def parse_commands(text: str) -> list[str]:
    block = section(text, "Replit commands to run")
    commands: list[str] = []
    in_code = False
    for line in block.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code = not in_code
            continue
        if in_code and stripped and not stripped.startswith("#"):
            commands.append(stripped)
    return commands


def npm_script_name(command: str) -> str | None:
    parts = command.split()
    if len(parts) >= 3 and parts[0] == "npm" and parts[1] == "run":
        return parts[2]
    return None


def is_standard_command(command: str) -> bool:
    return command == "npm install" or command.startswith("npm test") or command.startswith("npm exec ")


def validate(repo: Path, brief_path: Path, run_gates: bool) -> tuple[list[Check], bool]:
    text = brief_path.read_text()
    checks: list[Check] = []
    deploy_blocked = False

    branch, commit = parse_branch_commit(text)
    remote = run(["git", "remote", "get-url", "origin"], repo)
    checks.append(Check("remote", "PASS" if remote.returncode == 0 else "FAIL", remote.stdout.strip() or remote.stderr.strip()))

    if branch:
        ls = run(["git", "ls-remote", "--heads", "origin", branch], repo)
        ok = bool(ls.stdout.strip()) and ls.returncode == 0
        checks.append(Check("branch exists on origin", "PASS" if ok else "FAIL", branch))
        deploy_blocked |= not ok
    else:
        checks.append(Check("branch present in brief", "FAIL", "No Branch line found"))
        deploy_blocked = True

    if commit:
        cat = run(["git", "cat-file", "-t", commit], repo)
        ok = cat.returncode == 0 and cat.stdout.strip() == "commit"
        checks.append(Check("commit exists locally", "PASS" if ok else "FAIL", commit))
        deploy_blocked |= not ok
        if branch and ok:
            merge_base = run(["git", "merge-base", "--is-ancestor", commit, f"origin/{branch}"], repo)
            reachable = merge_base.returncode == 0
            checks.append(Check("commit reachable from origin branch", "PASS" if reachable else "FAIL", f"{commit} -> origin/{branch}"))
            deploy_blocked |= not reachable
    else:
        checks.append(Check("commit present in brief", "FAIL", "No commit SHA found"))
        deploy_blocked = True

    files = parse_files(text)
    for file in files:
        deleted = "deleted" in file.lower()
        clean_file = re.sub(r"\s*\(.*deleted.*\)\s*", "", file, flags=re.I).strip()
        exists = (repo / clean_file).exists()
        ok = exists or deleted
        checks.append(Check(f"file exists: {clean_file}", "PASS" if ok else "FAIL", "deleted" if deleted else ""))
        deploy_blocked |= not ok

    pkg_path = repo / "package.json"
    scripts = {}
    if pkg_path.exists():
        scripts = json.loads(pkg_path.read_text()).get("scripts", {})
        checks.append(Check("package.json exists", "PASS", f"{len(scripts)} scripts"))
    else:
        checks.append(Check("package.json exists", "FAIL", "missing"))
        deploy_blocked = True

    commands = parse_commands(text)
    if not commands:
        checks.append(Check("commands listed", "FAIL", "No fenced commands found in Replit commands section"))
        deploy_blocked = True

    for command in commands:
        script = npm_script_name(command)
        if script:
            ok = script in scripts
            checks.append(Check(f"npm script exists: {script}", "PASS" if ok else "FAIL", command))
            deploy_blocked |= not ok
        elif is_standard_command(command):
            checks.append(Check("standard command shape", "PASS", command))
        else:
            checks.append(Check("command recognized", "WARN", command))

        for test_file in re.findall(r"(?:^|\s)(test/[^\s]+\.test\.[tj]sx?)", command):
            ok = (repo / test_file).exists()
            checks.append(Check(f"referenced test exists: {test_file}", "PASS" if ok else "FAIL", command))
            deploy_blocked |= not ok

    if run_gates:
        for command in commands:
            gate = run(["bash", "-lc", command], repo, timeout=900)
            out = (gate.stdout + gate.stderr).strip()
            checks.append(Check(f"gate: {command}", "PASS" if gate.returncode == 0 else "FAIL", out[-1200:]))
            deploy_blocked |= gate.returncode != 0
    else:
        checks.append(Check("gates execution", "NOT RUN", "Use --run-gates to execute listed commands"))

    deploy_line = re.search(r"No deploy was run|deploy[^\n]*(?:PASS|FAIL|run)", text, re.I)
    ok = bool(deploy_line)
    checks.append(Check("deploy status explicit", "PASS" if ok else "FAIL", deploy_line.group(0).strip() if deploy_line else "missing"))
    deploy_blocked |= not ok

    return checks, deploy_blocked


def emit_markdown(checks: Iterable[Check], deploy_blocked: bool) -> str:
    status = "DO-NOT-DEPLOY" if deploy_blocked else "HANDOFF VERIFIED"
    lines = [f"# Replit Handoff Verification", "", f"**Status:** {status}", "", "## Checks"]
    for c in checks:
        detail = f" — {c.detail}" if c.detail else ""
        lines.append(f"- **{c.status}** {c.name}{detail}")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--brief", default="REPLIT_PULL_TODAY.md")
    parser.add_argument("--repo", default=".")
    parser.add_argument("--run-gates", action="store_true")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    brief = (repo / args.brief).resolve() if not os.path.isabs(args.brief) else Path(args.brief)
    if not brief.exists():
        print(f"# Replit Handoff Verification\n\n**Status:** DO-NOT-DEPLOY\n\n- **FAIL** brief exists — missing {brief}")
        return 2
    checks, blocked = validate(repo, brief, args.run_gates)
    print(emit_markdown(checks, blocked))
    return 2 if blocked else 0


if __name__ == "__main__":
    sys.exit(main())
