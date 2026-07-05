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
