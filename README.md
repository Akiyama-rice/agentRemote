# AgentHerd Learning

[简体中文](README.zh-CN.md)

A small, original implementation of an Agent approval service, built for learning and interviews.
The product goal is to send uncertain coding-agent permission requests to their owner through chat.

**Round 1 is ready:** shared types, deterministic guards, rule matching, redaction, and a terminal demo.
This round recommends decisions. It does not run the example commands or connect to real agents.
ACP, the owner approval loop, storage, and Feishu are later rounds.

## Run it

Use Node.js 22.13+ on an active LTS line and pnpm 11.25.0. Development was checked with Node 24.22.1.

```sh
pnpm install --frozen-lockfile
pnpm demo
pnpm test
pnpm check
```

The demo produces these recommendations:

| Command                 | Result   | Why                                           |
| ----------------------- | -------- | --------------------------------------------- |
| `pnpm test --run`       | allow    | Matches an owner rule                         |
| `npm publish`           | deny     | Matches a deny rule                           |
| `git push --force`      | escalate | Built-in guard                                |
| `cat .env`              | escalate | Credential access                             |
| `pnpm test && git push` | escalate | A compound command cannot match an allow rule |
| `git status`            | escalate | No matching rule was configured               |

`allow` is a recommendation, not execution. A future core will apply modes and owner decisions.

## Read the code

Start with [the demo](examples/rules-demo.ts), then follow this sequence:

1. [Shared types](packages/protocol/src/types.ts): `Item`, `Rule`, and `Decision`.
2. [Evaluation](packages/rules/src/evaluate.ts): guards → rules → owner.
3. [Guards](packages/rules/src/guard.ts): conditions that rules cannot override.
4. [Matching](packages/rules/src/match.ts): every specified field must match; deny wins.
5. [Tests](packages/rules/test/evaluate.test.ts): examples of the guarantees.

The [Chinese walkthrough and design record](docs/repro/第一轮实现与取舍.md) explains the implementation,
the interview story, deviations from the reference documents, and the next round.

```text
examples/rules-demo.ts
        ↓
packages/rules       →       packages/protocol
pure decision functions      shared types + inbound validation
```

There is no class hierarchy, dependency injection framework, database, or model call in this round.
Functions take explicit inputs and return results, so tests need no accounts or network access.

## Boundaries

- `evaluateRules` is the public entry point that enforces guard-first evaluation.
  `matchRules` alone is a low-level helper; it does not check guards.
- Only a small POSIX command subset is inspected. Unsupported syntax asks the owner.
  Environment prefixes and compound commands cannot match allow rules.
- Paths are checked lexically, including `../` and similarly named sibling directories.
  Symlinks, executable contents, package scripts, and shell aliases are not inspected.
  Path scope is a matching condition, not a filesystem sandbox.
- Redaction recognizes known formats and caller-supplied secret values. It cannot recognize every
  unknown credential. Production output paths must call it before persistence or display.
- `isInbound` validates data shape. Owner authentication and duplicate-action handling belong to
  the future core; they are not implemented yet.

## Checks

`pnpm check` runs Biome, strict TypeScript checks (including tests and the demo), and source line limits.
`pnpm --filter @agentherd/rules test` runs only the rule tests. There is no build step; packages export
TypeScript source. Versions are pinned in the manifests and lockfile.

The reference specifications are local snapshots. Their historical `DONE` labels do not describe
this reproduction. Only the new walkthrough is added to version control under `docs/`.
