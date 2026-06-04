# Replit Handoff Contract

This repo uses `REPLIT_PULL_TODAY.md` as the daily handoff from the nightly GitHub builder to the Replit ingestion agent.

The handoff is only valid if it is backed by live repo facts. If any required check cannot be verified, the brief must say `DO-NOT-DEPLOY` and list the exact blocker.

## Required preflight before writing or sending a brief

Run from the repo root:

```bash
python3 scripts/verify-replit-handoff.py --brief REPLIT_PULL_TODAY.md
```

For a final promotion-ready brief, also run gates:

```bash
python3 scripts/verify-replit-handoff.py --brief REPLIT_PULL_TODAY.md --run-gates
```

## Required facts in the brief

1. **Repo/remote**
   - Remote URL is explicit.
   - Branch exists on `origin`.
   - Commit SHA exists locally.
   - Commit SHA is reachable from the named branch.

2. **Files**
   - Every file listed under `Files changed` exists in the branch, except deleted files must be explicitly marked `deleted`.
   - Any referenced test file exists.

3. **Commands**
   - Every `npm run <script>` command references an actual `package.json` script.
   - Every direct command (`npm test`, `npm install`, etc.) is either standard or explicitly marked absent/manual.
   - Commands that are not valid in this repo must not appear as instructions.

4. **Verification results**
   - Typecheck/build/test results must be captured as `PASS`, `FAIL`, or `NOT RUN`.
   - If a gate is not runnable or the repo lacks that infrastructure, the brief must say `DO-NOT-DEPLOY`.

5. **Deploy status**
   - The brief must explicitly say: `No deploy was run` or name the deployment command/result.
   - Default status is no deploy.

## Cron split recommendation

- **1am nightly builder:** create/update a branch, commit code, push branch, run `scripts/verify-replit-handoff.py --run-gates`, then write `REPLIT_PULL_TODAY.md` only from verified repo facts.
- **10am pull brief:** read `REPLIT_PULL_TODAY.md`, rerun `scripts/verify-replit-handoff.py` without gates for freshness, and send Dan a concise brief. If validation fails, send `DO-NOT-DEPLOY` plus blockers instead of summarizing stale/hallucinated instructions.

The 10am job should not invent branches, commands, tests, scripts, or results. It is a messenger/checker, not a builder.
