# AgentHerd Learning

[English](README.md)

面向学习和面试的小型 Agent 审批服务，代码独立实现。
产品目标：Coding Agent 遇到拿不准的权限请求时，通过聊天渠道交给主人。

**第一轮已完成：** 共享类型、确定性守卫、规则匹配、脱敏和终端演示。
这一轮只给出决定建议，不执行演示中的命令，也不连接真实 Agent。
ACP、主人审批闭环、存储和飞书留到后续轮次。

## 运行

使用活跃 LTS 系列的 Node.js 22.13+ 和 pnpm 11.25.0。当前在 Node 24.22.1 上验证。

```sh
pnpm install --frozen-lockfile
pnpm demo
pnpm test
pnpm check
```

演示会给出以下建议：

| 命令                    | 结果     | 原因                     |
| ----------------------- | -------- | ------------------------ |
| `pnpm test --run`       | allow    | 匹配主人规则             |
| `npm publish`           | deny     | 匹配拒绝规则             |
| `git push --force`      | escalate | 命中内置守卫             |
| `cat .env`              | escalate | 涉及凭据                 |
| `pnpm test && git push` | escalate | 允许规则不能匹配复合命令 |
| `git status`            | escalate | 演示没有配置对应规则     |

`allow` 是建议，不代表执行。未来由核心处理运行模式和主人的决定。

## 阅读代码

先看[演示入口](examples/rules-demo.ts)，再按下面的顺序阅读：

1. [共享类型](packages/protocol/src/types.ts)：理解 `Item`、`Rule` 和 `Decision`。
2. [规则评估入口](packages/rules/src/evaluate.ts)：守卫 → 规则 → 主人。
3. [守卫清单](packages/rules/src/guard.ts)：规则也不能盖过的条件。
4. [规则匹配](packages/rules/src/match.ts)：所有指定字段都要匹配，拒绝优先。
5. [测试](packages/rules/test/evaluate.test.ts)：用具体例子检查上述保证。

[中文阅读与设计记录](docs/repro/第一轮实现与取舍.md)包含代码解释、面试讲法、
相对参考文档的取舍，以及下一轮内容。

```text
examples/rules-demo.ts
        ↓
packages/rules       →       packages/protocol
纯函数做决定                  共享类型 + 入站数据校验
```

这一轮没有类继承体系、依赖注入框架、数据库或模型调用。
函数接收明确的输入并返回结果，测试不需要账号或联网。

## 能力边界

- `evaluateRules` 是保证“守卫先运行”的公开入口。
  `matchRules` 是底层辅助函数，单独调用不会检查守卫。
- 只检查一个小范围的 POSIX 命令语法，不支持的写法交给主人。
  带环境变量前缀和复合结构的命令不匹配允许规则。
- 路径检查覆盖 `../` 和名字相近的兄弟目录，但只做字符串层面的解析。
  尚不检查符号链接、可执行文件内容、包脚本和 shell 别名。
  路径范围是匹配条件，不是文件系统沙箱。
- 脱敏能识别已知格式和调用方传入的密钥值，不能识别所有未知凭据。
  将来的日志、存储和显示出口需要主动调用它。
- `isInbound` 只校验数据形状。主人身份校验和重复操作处理属于未来的核心，目前尚未实现。

## 检查

`pnpm check` 运行 Biome、严格 TypeScript 检查（包括测试和演示）、源码行数检查。
`pnpm --filter @agentherd/rules test` 只运行规则测试。没有构建步骤，包直接导出 TypeScript
源码。依赖版本固定在清单和锁文件中。

参考规格是本地快照，其中历史上的 `DONE` 不代表本复现项目已经完成。
`docs/` 下仅把新写的阅读指南纳入版本控制。
