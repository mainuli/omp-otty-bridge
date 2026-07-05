# Public Release Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repository read like a lean public OMP extension while preserving the existing runtime behavior.

**Architecture:** This is a documentation, repository hygiene, CI, and release-validation change. Runtime source under `src/`, tests under `test/`, package metadata, and OMP manifest behavior remain unchanged. Internal planning/spike artifacts are removed from the final public tree and replaced with public docs plus GitHub Actions CI.

**Tech Stack:** TypeScript, Bun, OMP extension APIs, GitHub Actions, GitHub CLI, OMP CLI.

---

## File Structure

- Modify: `README.md` — public user entry point for install, configuration, diagnostics, troubleshooting, and development.
- Create: `CONTRIBUTING.md` — contributor setup, validation, local linking, and release expectations.
- Create: `docs/validation.md` — public validation and release checklist replacing the internal checklist.
- Create: `.github/workflows/ci.yml` — Bun test/typecheck CI.
- Delete: `docs/release-checklist.md` — replaced by `docs/validation.md`.
- Delete: `spikes/` — throwaway compatibility spike is not part of public operation.
- Delete: `docs/superpowers/` — internal planning artifacts, including this plan and the design spec, are temporary checkpoints and must not remain in the final public tree.
- Remote metadata: `mainuli/omp-otty-bridge` description, homepage, and topics.

## Task 0: Preflight Repository Identity

**Files:**
- No file changes.

- [ ] **Step 1: Verify GitHub repository identity before writing install commands**

Run:

```bash
gh repo view mainuli/omp-otty-bridge --json nameWithOwner,url,defaultBranchRef,isPrivate
```

Expected JSON fields:

```json
{
  "nameWithOwner": "mainuli/omp-otty-bridge",
  "url": "https://github.com/mainuli/omp-otty-bridge",
  "defaultBranchRef": {
    "name": "main"
  },
  "isPrivate": false
}
```

Stop if the handle, default branch, or visibility differs. The README and validation docs hardcode the GitHub install target and should not be written until this check passes.

## Task 1: Public README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README with public-facing content**

Use `apply_patch` to replace the full contents of `README.md` with:

````markdown
# omp-otty-bridge

`omp-otty-bridge` is an OMP (`omp.sh`) extension for Otty users. It shows live OMP activity in the Otty tab or window title using stable OMP extension APIs.

## What It Does

- Shows when OMP is working, using a title such as `▶ π: project · bash`.
- Includes active tool names or compact state labels depending on settings.
- Restores the base OMP title after the session returns to idle.
- Provides `/otty-status` diagnostics for detection, settings, backend, state, and the last emitted title.

## What It Does Not Do

- It does not provide native Otty badges, Otty notifications, or Otty history entries.
- It does not spoof Claude, Codex, OpenCode, or any other native Otty agent.
- It does not call private Otty IPC or rely on process-name detection.
- It is not published to npm in this release.

Native Otty parity requires a stable Otty custom-agent API or direct OMP support. This extension stays on stable public OMP APIs.

## Requirements

- OMP 16.3.4 or newer.
- Otty for default title output.
- Bun-compatible OMP plugin loading.

Outside Otty, output is disabled by default. You can opt into non-Otty title output with `nonOttyBehavior enabled`.

## Install

Install from GitHub:

```bash
omp install github:mainuli/omp-otty-bridge
```

Restart OMP after installation so it loads the extension from `package.json#omp.extensions`.

OMP 16.3.4 supports `--scope project` only for marketplace installs. GitHub targets ignore `--scope project`, so use the global GitHub install above for normal use.

For local development, link a checkout:

```bash
omp plugin link .
```

To return from a linked development copy to the GitHub install:

```bash
omp plugin uninstall omp-otty-bridge
rm -f ~/.omp/plugins/node_modules/omp-otty-bridge
omp install github:mainuli/omp-otty-bridge
```

## Configuration

List settings:

```bash
omp plugin config list omp-otty-bridge
```

Use compact labels:

```bash
omp plugin config set omp-otty-bridge mode minimal
```

Allow title output outside Otty:

```bash
omp plugin config set omp-otty-bridge nonOttyBehavior enabled
```

Use OSC terminal-title output instead of OMP's UI title API:

```bash
omp plugin config set omp-otty-bridge backend osc-tty
```

The default backend is `ui-title`.

## Diagnostics

Inside OMP, run:

```text
/otty-status
```

The report shows:

- whether Otty was detected;
- whether output is enabled;
- selected backend;
- current bridge state;
- last emitted title;
- bridge settings;
- relevant terminal environment values.

## Troubleshooting

Confirm OMP is running inside Otty:

```bash
echo "$TERM_PROGRAM"
```

Expected value:

```text
otty
```

Confirm the plugin is installed and enabled:

```bash
omp plugin list
omp plugin config list omp-otty-bridge
```

If `/otty-status` is missing, restart OMP. If it is still missing, OMP did not load the extension.

If the title stays in a working state after OMP finishes, update to the latest GitHub version and restart OMP:

```bash
omp plugin uninstall omp-otty-bridge
rm -f ~/.omp/plugins/node_modules/omp-otty-bridge
omp install github:mainuli/omp-otty-bridge
```

## Development

```bash
bun install
bun test
bun run typecheck
omp plugin link .
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and release checks.

## Validation

See [docs/validation.md](docs/validation.md) for automated checks and the manual Otty smoke test.

## License

MIT
````

- [ ] **Step 2: Verify README configuration commands match the OMP settings schema**

Run:

```bash
bun -e '
import pkg from "./package.json" with { type: "json" };
const settings = pkg.omp.settings;
const required = [
  settings.mode.values.includes("minimal"),
  settings.nonOttyBehavior.values.includes("enabled"),
  settings.backend.values.includes("osc-tty"),
  settings.backend.default === "ui-title"
];
if (!required.every(Boolean)) {
  throw new Error("README setting commands do not match package.json#omp.settings");
}
console.log("README setting commands verified");
'
```

Expected output:

```text
README setting commands verified
```

- [ ] **Step 3: Review README for stale internal references**

Run:

```bash
rg -n "superpowers|spike|release-checklist|npm publish|marketplace" README.md || true
```

Expected output is either empty or the single intentional `marketplace` line explaining that GitHub targets ignore project scope:

```text
<line-number>:OMP 16.3.4 supports `--scope project` only for marketplace installs. GitHub targets ignore `--scope project`, so use the global GitHub install above for normal use.
```

No other matches should remain.

- [ ] **Step 4: Commit README**

Run:

```bash
git add README.md
git commit -m "docs: polish public readme"
```

Expected: commit succeeds.

## Task 2: Public Contributor And Validation Docs

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `docs/validation.md`
- Delete: `docs/release-checklist.md`

- [ ] **Step 1: Create `CONTRIBUTING.md`**

Create `CONTRIBUTING.md` with:

````markdown
# Contributing

## Development Setup

Install dependencies:

```bash
bun install
```

Run the local checks:

```bash
bun test
bun run typecheck
```

The project is an OMP extension package. OMP loads the extension from `package.json#omp.extensions`, which points to `src/index.ts`.

## Local OMP Testing

Link the checkout into OMP:

```bash
omp plugin link .
```

Restart OMP after linking.

Inside OMP, run:

```text
/otty-status
```

For a real Otty smoke test, run OMP inside Otty, send a prompt that triggers a tool call, confirm the title changes to an active state, and confirm it restores after OMP returns to idle.

## Returning To The GitHub Install

If you linked a development checkout and want to go back to the public GitHub install:

```bash
omp plugin uninstall omp-otty-bridge
rm -f ~/.omp/plugins/node_modules/omp-otty-bridge
omp install github:mainuli/omp-otty-bridge
```

Restart OMP after reinstalling.

## Change Expectations

- Runtime behavior changes should include focused tests.
- Keep the extension on stable public OMP APIs.
- Do not add npm publishing or marketplace publishing unless that release path is explicitly designed first.
- Do not add private Otty IPC, process spoofing, or native-agent impersonation.
- Run the validation checklist in [docs/validation.md](docs/validation.md) before opening or merging a release PR.
````

- [ ] **Step 2: Create `docs/validation.md`**

Create `docs/validation.md` with:

````markdown
# Validation

This document lists the checks for `omp-otty-bridge`.

## Automated Checks

Run from the repository root:

```bash
bun test
bun run typecheck
```

Expected result:

- all tests pass;
- TypeScript exits with status 0.

## OMP Import Surface Checks

Run:

```bash
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/extensions").then(() => console.log("extensions export ok"))'
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/plugins").then((m) => console.log(typeof m.getPluginSettings))'
```

Expected output:

```text
extensions export ok
function
```

## GitHub Install Check

Confirm `--dry-run` support:

```bash
omp install --help | rg -- '--dry-run'
```

If the command prints `--dry-run`, run after the release commit is pushed to `main`:

```bash
omp install github:mainuli/omp-otty-bridge --dry-run
```

Expected: command exits 0 and reports that OMP would install `github:mainuli/omp-otty-bridge`.

If the installed OMP version does not support `--dry-run`, use an isolated temporary home instead of the real OMP plugin directory:

```bash
tmp_home=$(mktemp -d)
HOME="$tmp_home" omp install github:mainuli/omp-otty-bridge
HOME="$tmp_home" omp plugin list --json
rm -rf "$tmp_home"
```

Expected: the isolated plugin list contains `omp-otty-bridge`.

OMP 16.3.4 supports `--scope project` only for marketplace installs. GitHub targets ignore `--scope project`; use `omp plugin link .` for project-local development.

## Manual Otty Smoke Test

Last recorded runtime Otty smoke test:

- Date: 2026-07-05
- Runtime commit: `2f77fe4`
- Install source: `github:mainuli/omp-otty-bridge`
- Source: user-confirmed real Otty session during development
- Result: pass

Observed behavior:

- Otty detected: yes
- Backend: `ui-title`
- Output enabled: yes
- Title changed to a working state during OMP activity
- Title restored to the base title after OMP returned to idle
- `/otty-status` reported expected settings and state

This public-release polish does not change runtime files. Repeat the manual Otty smoke test when files under `src/`, `test/`, or `package.json#omp` change.

To repeat the smoke test:

1. Install from GitHub:

   ```bash
   omp install github:mainuli/omp-otty-bridge
   ```

2. Restart OMP inside Otty.

3. Run:

   ```text
   /otty-status
   ```

4. Confirm:

   - `Otty detected: yes`
   - `Output enabled: yes`
   - `Backend: ui-title`

5. Send a prompt that triggers at least one tool call.

6. Confirm the Otty tab or window title changes to an active title.

7. Wait for OMP to return to idle.

8. Confirm the title restores to the base OMP title.

9. Run `/otty-status` again and confirm the state is idle.

## Release Maintainer Checklist

- [ ] `bun test`
- [ ] `bun run typecheck`
- [ ] OMP import surface checks
- [ ] GitHub install dry run after merge to `main`
- [ ] Manual Otty smoke test when runtime behavior changes
- [ ] GitHub Actions CI passes on the release PR
- [ ] Repository metadata is current
- [ ] `LICENSE` matches `package.json#license`
````

- [ ] **Step 3: Remove old internal release checklist**

Run:

```bash
git rm docs/release-checklist.md
```

Expected: `docs/release-checklist.md` is staged for deletion.

- [ ] **Step 4: Check public docs for stale internal wording**

Run:

```bash
rg -n "superpowers|spike|release-checklist|pending" README.md CONTRIBUTING.md docs/validation.md || true
```

Expected output:

```text
```

No matches should remain.

- [ ] **Step 5: Commit public docs**

Run:

```bash
git add CONTRIBUTING.md docs/validation.md README.md
git commit -m "docs: add public validation and contributing guides"
```

Expected: commit succeeds.

## Task 3: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

Create `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bun test

      - name: Typecheck
        run: bun run typecheck
```

- [ ] **Step 2: Validate workflow references existing scripts**

Run:

```bash
bun run typecheck
bun test
```

Expected:

- `bun run typecheck` exits 0;
- `bun test` passes with 0 failures.

- [ ] **Step 3: Commit CI workflow**

Run:

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add bun validation workflow"
```

Expected: commit succeeds.

## Task 4: Remove Internal Artifacts From Public Tree

**Files:**
- Delete: `spikes/`
- Delete: `docs/superpowers/`

- [ ] **Step 1: Save a temporary execution copy of this plan outside the repository**

Run:

```bash
cp docs/superpowers/plans/2026-07-05-public-release-polish.md /tmp/omp-otty-public-release-polish-plan.md
test -s /tmp/omp-otty-public-release-polish-plan.md
```

Expected: the copy command exits 0 and the temporary plan copy is non-empty.

- [ ] **Step 2: Remove internal artifact trees**

Run:

```bash
git rm -r spikes docs/superpowers
rm -rf spikes docs/superpowers
```

Expected: tracked files under `spikes/` and `docs/superpowers/` are staged for deletion, and the directories no longer exist in the working tree.

- [ ] **Step 3: Confirm removed trees are no longer tracked**

Run:

```bash
git ls-files spikes docs/superpowers
test ! -e spikes
test ! -e docs/superpowers
```

Expected: the command exits 0 and `git ls-files` prints no files:

```text
```

- [ ] **Step 4: Commit cleanup**

Run:

```bash
git commit -m "chore: remove internal planning artifacts"
```

Expected: commit succeeds.

## Task 5: Repository Metadata And Safety Gates

**Files:**
- No file changes required.
- Remote metadata: `mainuli/omp-otty-bridge`

- [ ] **Step 1: Verify license gate**

Run:

```bash
test -f LICENSE
bun -e 'import pkg from "./package.json" with { type: "json" }; console.log(pkg.license)'
head -n 1 LICENSE
rg -n "Permission is hereby granted|THE SOFTWARE IS PROVIDED" LICENSE
```

Expected output includes:

```text
MIT
MIT License
Permission is hereby granted
THE SOFTWARE IS PROVIDED
```

- [ ] **Step 2: Scan tracked history and current tree for sensitive content**

Run:

```bash
git grep -n -I -E '(gho_|ghp_|ANTHROPIC_|OPENAI_|api[_-]?key|secret|token|password)' $(git rev-list --all) -- . ':!bun.lock' || true
```

Expected: no sensitive credentials. Matches in documentation wording such as `token` should be reviewed manually. If a real secret appears, stop and ask whether to rewrite history or recreate the public repository.

- [ ] **Step 3: Set GitHub repository metadata**

Run:

```bash
gh repo edit mainuli/omp-otty-bridge \
  --description "OMP extension that shows live OMP state in Otty tab titles." \
  --homepage "https://github.com/mainuli/omp-otty-bridge#readme" \
  --add-topic omp \
  --add-topic omp-sh \
  --add-topic otty \
  --add-topic terminal \
  --add-topic extension
```

Expected: command exits 0.

- [ ] **Step 4: Verify metadata**

Run:

```bash
gh repo view mainuli/omp-otty-bridge --json description,homepageUrl,repositoryTopics
```

Expected JSON includes:

```json
{
  "description": "OMP extension that shows live OMP state in Otty tab titles.",
  "homepageUrl": "https://github.com/mainuli/omp-otty-bridge#readme"
}
```

Expected topics include:

```text
omp
omp-sh
otty
terminal
extension
```

## Task 6: Final Local Verification And PR

**Files:**
- No planned file changes.

- [ ] **Step 1: Fetch and rebase on current `origin/main`**

Run:

```bash
git fetch origin
git rebase origin/main
```

Expected: rebase succeeds without conflicts. If conflicts occur, resolve them and rerun the validation commands below.

- [ ] **Step 2: Run full local verification**

Run:

```bash
bun test
bun run typecheck
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/extensions").then(() => console.log("extensions export ok"))'
bun -e 'import("@oh-my-pi/pi-coding-agent/extensibility/plugins").then((m) => console.log(typeof m.getPluginSettings))'
git diff --check
git ls-files spikes docs/superpowers
test ! -e spikes
test ! -e docs/superpowers
git diff --name-only "$(git merge-base origin/main HEAD)" HEAD -- src test package.json tsconfig.json bun.lock
```

Expected:

- `bun test` passes with 0 failures;
- `bun run typecheck` exits 0;
- the OMP import checks print `extensions export ok` and `function`;
- `git diff --check` exits 0;
- `git ls-files` prints no files;
- the filesystem checks exit 0;
- the runtime/package diff command prints no files.

- [ ] **Step 3: Get independent final review**

Run a Claude Opus read-only review of the final diff:

```bash
tmp_prompt=$(mktemp /tmp/omp-otty-public-release-review.XXXXXX)
{
  printf '%s\n' 'Review this public-release polish diff. Do not edit files. Findings first, ordered by severity. If there are no blocking findings, say "No blocking findings" clearly. Focus on public repo polish, docs accuracy, CI correctness, accidental runtime changes, and release validation gaps.'
  printf '%s\n' ''
  git diff "$(git merge-base origin/main HEAD)" HEAD
} > "$tmp_prompt"
claude -p --safe-mode --tools "" --model opus --output-format json --max-budget-usd 3 < "$tmp_prompt"
```

Expected: no blocking findings. Address any blocking findings with additional commits and rerun local verification.

- [ ] **Step 4: Push branch**

Run:

```bash
git push -u origin feature/polish-public-release
```

Expected: branch pushes successfully.

- [ ] **Step 5: Create pull request**

Create a PR body file:

```bash
cat > /tmp/omp-otty-public-release-pr.md <<'EOF'
## Summary

- Removes internal planning and spike artifacts from the public tree.
- Adds public README, contributing, validation, and CI documentation.
- Configures release validation around GitHub install, Otty smoke testing, and repository metadata.

## Validation

- `bun test`
- `bun run typecheck`
- OMP import surface checks
- `git diff --check`
- `git ls-files spikes docs/superpowers`
- `test ! -e spikes && test ! -e docs/superpowers`
- `git diff --name-only "$(git merge-base origin/main HEAD)" HEAD -- src test package.json tsconfig.json bun.lock`
- GitHub repository metadata verified
- License gate verified
- Sensitive-content scan reviewed

## Notes

Runtime source and behavior are unchanged.
EOF
```

Open the PR:

```bash
gh pr create \
  --base main \
  --head feature/polish-public-release \
  --title "Polish repository for public release" \
  --body-file /tmp/omp-otty-public-release-pr.md
```

Expected: GitHub prints the PR URL.

- [ ] **Step 6: Wait for CI**

Run:

```bash
gh pr checks --watch
```

Expected: CI passes. If CI fails, inspect logs, fix with a follow-up commit, push, and wait again.

## Task 7: Post-Merge Validation

**Files:**
- No planned file changes.

- [ ] **Step 1: Merge only after approval**

After the PR is reviewed and approved by the maintainer, merge it using the chosen merge strategy. If merging from the CLI, run:

```bash
gh pr merge --squash --delete-branch
```

Expected: PR merges and remote branch is deleted. If the maintainer chooses merge commit or rebase merge, use that strategy instead.

- [ ] **Step 2: Update local `main`**

Run:

```bash
cd /Users/mainul/Workspaces/Personal/omp-otty-bridge
git checkout main
git pull --ff-only origin main
```

Expected: local `main` fast-forwards to the merged commit.

- [ ] **Step 3: Verify GitHub install path after merge**

Run:

```bash
omp install --help | rg -- '--dry-run'
```

If the command prints `--dry-run`, run:

```bash
omp install github:mainuli/omp-otty-bridge --dry-run
```

Expected: command exits 0 and reports that OMP would install `github:mainuli/omp-otty-bridge`.

If the installed OMP version does not support `--dry-run`, run the install in an isolated temporary home:

```bash
tmp_home=$(mktemp -d)
HOME="$tmp_home" omp install github:mainuli/omp-otty-bridge
HOME="$tmp_home" omp plugin list --json
rm -rf "$tmp_home"
```

Expected: the isolated plugin list contains `omp-otty-bridge`.

- [ ] **Step 4: Clean up local worktree if no longer needed**

Run from the main worktree:

```bash
git worktree remove /Users/mainul/Workspaces/Personal/omp-otty-bridge/.worktrees/polish-public-release
git worktree prune
```

Expected: release-polish worktree is removed.

## Self-Review Checklist

- Spec requirement: remove `spikes/` and `docs/superpowers/` from final public tree — covered by Task 4 and Task 6.
- Spec requirement: public README — covered by Task 1.
- Spec requirement: public validation docs — covered by Task 2.
- Spec requirement: contributor docs — covered by Task 2.
- Spec requirement: CI — covered by Task 3 and Task 6.
- Spec requirement: repository metadata — covered by Task 5.
- Spec requirement: handle gate before public install docs — covered by Task 0.
- Spec requirement: license, install path, and history/content gates — covered by Task 5, Task 6, and Task 7.
- Spec requirement: no runtime behavior changes — protected by Task 6 local verification and final review.
