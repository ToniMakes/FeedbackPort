# ADR 0006: Defer GitHub OIDC Deployment Under AWS Free Plan Policy

- Status: Accepted
- Date: 2026-10-07
- Depends on: [0004-aws-staging-infrastructure](0004-aws-staging-infrastructure.md)

## Context

The staging deployment design uses GitHub Actions OIDC with a trust condition scoped to `repo:ToniMakes/FeedbackPort:environment:staging`. During the `staging-base` Terraform apply in AWS account ending 5646, AWS explicitly denied `iam:CreateOpenIDConnectProvider` under an AWS Organizations service control policy. The owner requires continuing on the Free Plan and has not authorized upgrading or activating advanced account features. Long-lived access keys are prohibited.

## Decision

- Keep GitHub OIDC provider, deploy role, and ECR push policy behind the `enable_github_deployment` Terraform flag, defaulting to `false`.
- Continue managing resources that AWS permitted: ECR, Route 53, ACM, empty Secrets Manager containers, and ECS task roles.
- Do not enable advanced account features, upgrade the account, or create static GitHub credentials as a workaround.
- Treat GitHub Actions deployment as blocked under the observed account policy. Revisit only if AWS changes the policy or the owner changes the no-upgrade constraint.

## Consequences

The infrastructure base can be applied and reconciled without repeatedly failing on OIDC creation. GitHub Actions cannot yet assume a staging deployment role, so image push and automated AWS deployment remain incomplete. Local owner-operated AWS CLI sessions remain available for later manual steps, subject to the same service control policy and the owner's approval for resource creation.

---

# ADR 0006：AWS Free Plan 策略下暂缓 GitHub OIDC 部署

- 状态：已采纳
- 日期：2026-10-07
- 依赖：[0004-aws-staging-infrastructure](0004-aws-staging-infrastructure.md)

## 背景

staging 部署方案使用 GitHub Actions OIDC，并将信任条件限制为 `repo:ToniMakes/FeedbackPort:environment:staging`。在账号尾号 5646 的 AWS `staging-base` Terraform apply 过程中，AWS Organizations 服务控制策略明确拒绝了 `iam:CreateOpenIDConnectProvider`。所有者要求继续使用 Free Plan，未授权升级或启用高级账号功能。禁止使用长期 access key。

## 决策

- 将 GitHub OIDC provider、部署角色和 ECR 推送策略放在 Terraform 开关 `enable_github_deployment` 后面，默认值为 `false`。
- 继续管理 AWS 已允许的资源：ECR、Route 53、ACM、空的 Secrets Manager 密钥容器和 ECS 任务角色。
- 不启用高级账号功能、不升级账号，也不创建静态 GitHub 凭证作为绕过方案。
- 根据当前观察到的账号策略，将 GitHub Actions 部署标记为受阻。只有 AWS 政策变化或所有者改变“不升级”约束后再重新评估。

## 影响

常驻基础设施可以继续 apply 和核对，不会反复因 OIDC 创建失败而中断。GitHub Actions 目前不能担任 staging 部署角色，因此镜像推送和自动 AWS 部署尚未完成。后续仍可使用所有者本机的 AWS CLI 临时会话完成手动操作，但仍受同一服务控制策略约束；创建资源前应由所有者确认。
