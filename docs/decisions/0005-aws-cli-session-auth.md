# ADR 0005: Temporary AWS CLI Sessions for Local Terraform

- Status: Accepted
- Date: 2026-10-07
- Depends on: [0004-aws-staging-infrastructure](0004-aws-staging-infrastructure.md)

## Context

The staging account is a project in AWS's new account experience. The owner signs in to the project with an AWS Builder ID and uses the AWS CLI `aws login` flow. Terraform's AWS provider does not consume the AWS CLI login cache directly in this local Windows setup. Long-lived IAM access keys must not be created or stored in the repository, image, or chat.

## Decision

- Authenticate the owner with `aws login --region ap-southeast-2` and verify the selected project using `aws sts get-caller-identity`.
- Use `aws configure export-credentials --format process` to let Terraform obtain the current short-lived session through environment variables only for the duration of a Terraform process.
- Provide `infra/terraform/Invoke-TerraformWithAwsLogin.ps1` as the Windows wrapper. It keeps credentials in process memory, restores prior environment variables, and does not print or persist the temporary credentials.
- Do not create long-lived access keys. GitHub Actions OIDC is the intended automation path in ADR 0004, but the current Free Plan organization policy blocks provider creation; see ADR 0006. Until that constraint changes, AWS deployment remains owner-operated.
- Terraform deployments remain owner-operated and must use the intended project account. The local wrapper does not determine or silently switch accounts.

## Consequences

The owner must complete browser authorization when the AWS CLI session expires. The wrapper requires AWS CLI v2.32.0 or newer and a local Terraform 1.10+ executable. Terraform's provider and backend receive only short-lived session credentials through the process environment. A user should verify `aws sts get-caller-identity` before applying any saved plan.

---

# ADR 0005：本地 Terraform 使用 AWS CLI 临时会话

- 状态：已采纳
- 日期：2026-10-07
- 依赖：[0004-aws-staging-infrastructure](0004-aws-staging-infrastructure.md)

## 背景

staging 账号属于 AWS 新账号体验中的一个项目。所有者通过 AWS Builder ID 登录项目，并使用 AWS CLI `aws login` 流程。当前 Windows 本地环境中的 Terraform AWS provider 不能直接读取 AWS CLI 登录缓存。不得创建或在仓库、镜像、聊天中保存长期 IAM access key。

## 决策

- 所有者运行 `aws login --region ap-southeast-2` 完成登录，并使用 `aws sts get-caller-identity` 确认当前项目。
- 使用 `aws configure export-credentials --format process`，仅在 Terraform 进程运行期间通过环境变量提供当前短期会话。
- 提供 Windows 包装脚本 `infra/terraform/Invoke-TerraformWithAwsLogin.ps1`。凭证仅驻留进程内存；脚本会恢复原有环境变量，不打印或持久化短期凭证。
- 不创建长期 access key。ADR 0004 中的 GitHub Actions OIDC 是预期自动化方式，但当前 Free Plan 组织策略阻止创建 provider；见 ADR 0006。该限制解除前，AWS 部署仍由所有者本机操作。
- Terraform 部署由所有者操作，必须先确认目标项目账号。包装脚本不会自动判断或切换账号。

## 影响

AWS CLI 会话过期后，所有者需要重新完成浏览器授权。包装脚本要求 AWS CLI v2.32.0+ 和本地 Terraform 1.10+。Terraform provider 与 backend 只通过进程环境获得短期会话凭证。应用任何 plan 前，所有者应再次运行 `aws sts get-caller-identity` 确认账号。
