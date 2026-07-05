# Public Release Polish Design

## Goal

Make `mainuli/omp-otty-bridge` read like a small, installable public OMP extension instead of an agent workbench, while preserving the existing runtime behavior and GitHub installation flow.

## Scope

This polish pass is documentation, repository hygiene, and release infrastructure only. It must not change the extension's runtime state model, title formatting, Otty detection, settings behavior, or supported installation target.

In scope:

- Remove tracked internal planning and spike artifacts from the public default-branch tree.
- Replace internal release notes with concise public validation documentation.
- Improve README structure for users who install from GitHub.
- Add contributor documentation for local development and release checks.
- Add GitHub Actions CI for tests and typecheck.
- Set GitHub repository metadata so the repo is discoverable and self-describing.
- Verify the repository handle, license, public install path, and retained history before pushing the release-polish branch.

Out of scope:

- Publishing to npm.
- Publishing to the OMP marketplace.
- Adding native Otty integration beyond the stable OMP title API.
- Changing package name, version, runtime dependencies, or OMP manifest settings.
- Adding broad open-source governance files such as a code of conduct or security policy in this first release.

## Public Repository Shape

The public repo should contain only artifacts useful to installers, contributors, and maintainers:

- `README.md`
- `LICENSE`
- `package.json`
- `bun.lock`
- `tsconfig.json`
- `src/`
- `test/`
- `docs/validation.md`
- `CONTRIBUTING.md`
- `.github/workflows/ci.yml`

The following tracked development artifact trees should be removed from the final public default-branch tree:

- `spikes/`
- `docs/superpowers/`

The old compatibility spike proved feasibility, but keeping it in the public tree invites users to run a throwaway extension that is no longer part of normal operation. The Superpowers specs and plans are useful local process history, but they are not user-facing product documentation. This design document is also a temporary planning artifact under `docs/superpowers/`; it should be committed only as the brainstorming checkpoint for this work and then removed with the rest of `docs/superpowers/` before the release-polish branch is pushed.

## History Policy

The repository is already public, so removing files from the default branch will not remove them from Git history. This release polish should not rewrite history by default. Before pushing the final polish branch, scan the repository history and current tree for secrets or sensitive local-only content. If the scan finds sensitive data, stop and ask whether to rewrite history or recreate the public repository. If the scan finds no sensitive data, history retention is acceptable for this first public release because the default branch tree is the supported installation and browsing surface.

At minimum, the scan should include:

```bash
git grep -n -I -E '(gho_|ghp_|ANTHROPIC_|OPENAI_|api[_-]?key|secret|token|password)' $(git rev-list --all) -- . ':!bun.lock'
```

The scan may produce false positives for documentation wording such as `token`; review any matches before deciding whether history cleanup is required.

## Documentation Design

`README.md` should be the user entry point. It should explain:

- what the extension does;
- what it intentionally does not do;
- requirements;
- GitHub install command;
- restart requirement after install;
- configuration commands;
- `/otty-status` diagnostics;
- troubleshooting;
- local development commands.

The README should keep GitHub installation as the supported install path:

```bash
omp install github:mainuli/omp-otty-bridge
```

It should mention that npm publishing is not part of this release. It should also clarify that project-scoped GitHub install is not supported by OMP 16.3.4; local development should use `omp plugin link .`.

`docs/validation.md` should replace `docs/release-checklist.md` with stable public language:

- automated checks;
- OMP import-surface checks;
- GitHub install dry run;
- manual Otty smoke test;
- release maintainer checklist.

It should record that a real Otty smoke test has passed for the current implementation:

- Otty detected;
- `ui-title` backend active;
- GitHub-installed plugin loads;
- title switches to working during a turn;
- title restores to base after idle;
- `/otty-status` reports expected status.

The smoke-test record should include the date and commit tested, so future code changes do not inherit stale validation claims.

`CONTRIBUTING.md` should explain:

- Bun requirement;
- dependency installation;
- test and typecheck commands;
- local plugin linking;
- replacing a linked development copy with the GitHub install;
- expectation that changes include tests when behavior changes.

## CI Design

Add `.github/workflows/ci.yml` with one workflow:

- Trigger on pushes to `main` and pull requests targeting `main`.
- Run on `ubuntu-latest`.
- Install Bun with `oven-sh/setup-bun`.
- Run `bun install --frozen-lockfile`.
- Run `bun test`.
- Run `bun run typecheck`.

CI should not run Otty-specific manual checks because GitHub Actions does not provide Otty. Manual Otty checks remain documented in `docs/validation.md`.

## GitHub Metadata

Set public repository metadata:

- Description: `OMP extension that shows live OMP state in Otty tab titles.`
- Homepage: `https://github.com/mainuli/omp-otty-bridge#readme`
- Topics: `omp`, `omp-sh`, `otty`, `terminal`, `extension`

Before setting metadata or documenting install commands, verify the repository handle and default branch:

```bash
gh repo view mainuli/omp-otty-bridge --json nameWithOwner,url,defaultBranchRef,isPrivate
```

The command must report `nameWithOwner` as `mainuli/omp-otty-bridge`, `defaultBranchRef.name` as `main`, and `isPrivate` as `false`.

## License Gate

Confirm `LICENSE` exists and is the MIT License, and confirm `package.json#license` is `MIT`. If these disagree, fix the mismatch before pushing public-release polish.

## Validation

Before this polish is considered complete:

- Run `bun test`.
- Run `bun run typecheck`.
- Run `git diff --check`.
- Confirm `LICENSE` exists and matches `package.json#license`.
- Confirm the GitHub repository handle, default branch, and visibility with `gh repo view`.
- Run the history/current-tree sensitive-content scan and resolve or explicitly accept any findings.
- Push the release-polish branch and open a pull request targeting `main` so GitHub Actions runs on the proposed release commit.
- Confirm CI workflow YAML is syntactically reasonable and references existing scripts.
- Confirm GitHub Actions CI passes on the release-polish pull request.
- Confirm removed files no longer appear in `git ls-files`.
- Get an independent Claude Opus review of the final diff.
- After the release-polish branch is merged to `main`, run `omp install github:mainuli/omp-otty-bridge --dry-run` against the pushed `main` commit. If the installed OMP version does not support `--dry-run`, document that limitation and verify the install path manually in a disposable OMP plugin environment.

## Acceptance Criteria

- Public repo no longer tracks `spikes/` or `docs/superpowers/`.
- Public validation documentation replaces stale pending checklist wording.
- README has a clear install/use/troubleshooting path for GitHub users.
- Contributor docs explain development without implying npm publication.
- CI is present and uses the repo's existing Bun scripts.
- CI passes on the release-polish pull request before merge.
- `LICENSE` is present and matches the MIT license declared in `package.json`.
- GitHub description, homepage, and topics match this design.
- After merge, GitHub install dry run resolves the pushed `main` commit.
- History/current-tree sensitive-content scan has no unresolved findings.
- Runtime source and tests still pass without behavior changes.
