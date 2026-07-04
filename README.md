# omp-otty-bridge

OMP extension that shows live OMP state in Otty tab titles.

## Status

Requires OMP 16.3.4 or newer. This repository is currently under implementation; the install commands below are intended for the completed plugin state after the source files land.

Native Otty badges and Otty agent history are not provided by this extension because Otty does not expose a stable custom-agent API for OMP.

## Install

```bash
omp install github:mainuli/omp-otty-bridge
```

Project-scoped install:

```bash
omp install github:mainuli/omp-otty-bridge --scope project
```

## Development

```bash
bun install
bun test
bun run typecheck
omp plugin link .
```
