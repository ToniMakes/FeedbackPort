# ADR 0004: Terraform Infrastructure for AWS Staging

- Status: Accepted
- Date: 2026-10-07
- Depends on: [0003-container-image](0003-container-image.md)

## Context

The Dockerized Next.js application needs a reproducible AWS staging environment while the existing Vercel production deployment remains untouched. Tenant routing requires hosts shaped as `<slug>.board.<domain>`, so the certificate must cover `*.board.fp-staging.tonimakes.com`. The staging environment must stay within a US$5/month target and be easy to remove when idle.

## Decision

- Use Terraform in `infra/terraform`, split into a bootstrap state bucket, a persistent `staging-base` state, and an ephemeral `staging-runtime` state. Terraform 1.10+ S3 native lockfiles are used; all stacks have separate state keys.
- Manage the account-level AWS Budget through the `us-east-1` provider alias; application and runtime infrastructure is in `ap-southeast-2`.
- Keep ECR, Route 53 delegated zone, DNS validated ACM certificate, empty Secrets Manager containers, ECS roles, and the GitHub OIDC deploy role in `staging-base`.
- Put VPC/public subnets, Internet Gateway, ALB, ECS cluster/service/task definition, security groups, DNS aliases, and the CloudWatch log group in `staging-runtime`. Destroy this entire stack when idle for more than one day. Desired count zero is not an adequate cost control because an ALB still incurs hourly charges.
- Run ECS Fargate tasks in public subnets with public IPs and no NAT Gateway. The task security group accepts application traffic only from the ALB security group. The app task role has no AWS permissions; the execution role can pull the ECR image, write logs, and read only the named runtime secrets.
- Create a Route 53 hosted zone for `fp-staging.tonimakes.com`, delegated manually from Namecheap. Request an ACM certificate for the zone apex and `*.board.fp-staging.tonimakes.com`; Terraform creates DNS validation records.
- Terraform creates Secrets Manager secret containers but never secret versions or values. Values are entered separately by the owner. Runtime credentials are only supplied to ECS tasks.
- Trust GitHub Actions only for `repo:ToniMakes/FeedbackPort:environment:staging` with `sts.amazonaws.com` audience. The `staging` GitHub Environment must require the owner's approval and allow deployment from `main`. The role starts with narrowly scoped ECR push permissions; phase C will extend it only for ECS deployment actions.
- Keep Supabase, Upstash, Turnstile, and Resend hosted. Only the Next.js application moves to AWS staging.

## Alternatives and evidence

- **App Runner:** AWS's current developer guide says a wildcard custom domain must be an immediate subdomain of the root domain (for example `*.example.com`) and cannot be a nested wildcard such as `*.login.example.com`. The required `*.board.fp-staging.tonimakes.com` is nested, so App Runner does not meet this routing requirement. Evidence: [AWS App Runner custom domains](https://docs.aws.amazon.com/apprunner/latest/dg/manage-custom-domains.html). This is a documentation check, not a live AWS deployment test.
- **NAT Gateway:** rejected because its always-on hourly and data processing charges consume the small budget. Public task IPs plus restrictive task ingress preserve a narrow inbound path; task egress is HTTPS to managed dependencies. This trades private outbound networking for lower cost.
- **One Terraform state:** rejected because routine runtime destruction must not affect ECR, delegated DNS, certificates, state storage, or secret containers.
- **Manage AWS Budgets in Sydney:** rejected because the billing service endpoint is `us-east-1`; this provider alias does not move application resources from Sydney.
- **Secrets in Terraform-managed versions:** rejected because secret values would be stored in Terraform state.
- **Scale to zero while retaining the ALB:** rejected because it does not stop the ALB's hourly charge.

## Cost and consequences

US$5/month is a planning target (lowered from US$30 on 2026-10-08; set by `monthly_budget_usd`), not a guaranteed ceiling. AWS currently lists US$0.50/month for a Route 53 hosted zone ([pricing](https://aws.amazon.com/route53/pricing/)) and US$0.005 per public IPv4 address-hour (US$3.65 per address over 730 hours; [VPC pricing](https://aws.amazon.com/vpc/pricing/)); an ALB additionally incurs hourly and LCU charges ([ELB pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)), while Fargate compute varies by region and runtime ([Fargate pricing](https://aws.amazon.com/fargate/pricing/)). An always-on ALB plus a continuously running Fargate task may exceed the budget in Sydney after public addresses, logs, and data transfer. Runtime resources are therefore created only for active verification and destroyed when idle; persistent resources still have storage and hosted-zone costs. Before first apply, the owner must enter planned ALB hours, Fargate runtime, and traffic into the [AWS Pricing Calculator](https://calculator.aws/) for `ap-southeast-2`, then configure AWS Budgets at 50%, 80%, 100%, and forecasted 100%. The Sydney account-specific calculator estimate remains pending. Actual cost must later be reported from Cost Explorer, not inferred from this ADR.

The persistent state bucket is encrypted and versioned. State access is sensitive and must be restricted. The bootstrap bucket uses local state for its first creation and is then used as the remote backend for the two staging stacks.

---

# ADR 0004：AWS staging 基础设施采用 Terraform

- 状态：已采纳
- 日期：2026-10-07
- 依赖：[0003-container-image](0003-container-image.md)

## 背景

容器化后的 Next.js 应用需要可复现的 AWS staging 环境，同时保持现有 Vercel 生产部署不变。租户路由要求主机名形如 `<slug>.board.<domain>`，因此证书必须覆盖 `*.board.fp-staging.tonimakes.com`。staging 目标预算为每月 US$5，并且闲置时要容易销毁。

## 决策

- 在 `infra/terraform` 使用 Terraform，拆为 bootstrap 状态 bucket、常驻 `staging-base` 状态和临时 `staging-runtime` 状态。要求 Terraform 1.10+，使用 S3 原生锁文件；每个栈使用独立状态 key。
- AWS Budget 属于账号账单级资源，通过 `us-east-1` provider alias 管理；应用与运行资源仍在 `ap-southeast-2`。
- `staging-base` 保留 ECR、Route 53 委托托管区、DNS 验证的 ACM 证书、空的 Secrets Manager 容器、ECS 角色和 GitHub OIDC 部署角色。
- VPC/公有子网、Internet Gateway、ALB、ECS 集群/服务/任务定义、安全组、DNS 别名和 CloudWatch 日志组归入 `staging-runtime`。闲置超过一天时销毁整个栈。仅把 desired count 设成 0 不能控制成本，因为 ALB 仍按小时收费。
- ECS Fargate 任务放在公有子网并分配公有 IP，不建 NAT Gateway。任务安全组仅允许 ALB 安全组访问应用端口。应用任务角色没有 AWS 权限；执行角色仅能拉取 ECR 镜像、写日志及读取指定运行时密钥。
- 为 `fp-staging.tonimakes.com` 建 Route 53 托管区，由 Namecheap 手动委托。申请覆盖主站名及 `*.board.fp-staging.tonimakes.com` 的 ACM 证书；Terraform 创建 DNS 验证记录。
- Terraform 只创建 Secrets Manager 密钥容器，不创建 secret version 或写入密钥值。实际值由所有者在 Terraform 外填写，只在运行时注入 ECS 任务。
- GitHub Actions 信任条件严格限定为 `repo:ToniMakes/FeedbackPort:environment:staging` 和 `sts.amazonaws.com` audience。GitHub `staging` Environment 必须要求所有者审批，并限制从 `main` 部署。初始角色仅有范围受限的 ECR 推送权限；阶段 C 再按需增加 ECS 部署动作。
- Supabase、Upstash、Turnstile 和 Resend 继续使用托管服务，只将 Next.js 应用部署到 AWS staging。

## 备选方案与依据

- **App Runner：**AWS 当前开发者文档说明 wildcard 自定义域名必须是根域名的直接子域（例如 `*.example.com`），不能使用 `*.login.example.com` 这样的嵌套 wildcard。所需的 `*.board.fp-staging.tonimakes.com` 属于嵌套 wildcard，因此不满足本项目路由要求。依据：[AWS App Runner 自定义域名文档](https://docs.aws.amazon.com/apprunner/latest/dg/manage-custom-domains.html)。这是文档核对，不是实际 AWS 部署验证。
- **NAT Gateway：**由于持续小时费和数据处理费会占用有限预算而不采用。公有任务 IP 配合严格的任务入站规则，仍只允许经 ALB 进入；任务出站限于 HTTPS 访问托管依赖。取舍是以较低费用换取非私有出站网络。
- **单一 Terraform 状态：**不采用，避免日常销毁运行层时波及 ECR、委托 DNS、证书、状态存储或密钥容器。
- **在悉尼区域管理 AWS Budgets：**不采用，因为账单服务端点是 `us-east-1`；该 provider alias 不会把应用资源移出悉尼。
- **由 Terraform 管理密钥版本：**不采用，避免密钥值写入 Terraform 状态。
- **保留 ALB、只把服务缩容到零：**不采用，因为 ALB 小时费用仍继续产生。

## 成本与影响

US$5/月是规划目标（2026-10-08 起由 US$30 下调，由 `monthly_budget_usd` 设置），不是费用保证。AWS 当前列出的 Route 53 托管区价格是 US$0.50/月（[价格](https://aws.amazon.com/route53/pricing/)），公有 IPv4 地址为 US$0.005/地址小时（按 730 小时计算，每个地址 US$3.65；[VPC 价格](https://aws.amazon.com/vpc/pricing/)）；ALB 还会产生小时与 LCU 费用（[ELB 价格](https://aws.amazon.com/elasticloadbalancing/pricing/)），Fargate 计算费用则随区域和运行时长变化（[Fargate 价格](https://aws.amazon.com/fargate/pricing/)）。悉尼区域常驻 ALB 加持续运行的 Fargate 任务，叠加公有地址、日志与流量后可能超过预算。因此仅在验证期间创建 runtime 资源，闲置后销毁；常驻层仍会有存储和托管区费用。首次 apply 前，所有者需在 [AWS Pricing Calculator](https://calculator.aws/) 选择 `ap-southeast-2` 并填入 ALB 小时、Fargate 时长和流量，随后配置 50%、80%、100% 及预测 100% 的 AWS Budgets 告警。悉尼的账号级估算仍待完成。后续实际成本应从 Cost Explorer 报告，不能从本 ADR 推断。

常驻状态 bucket 开启加密与版本控制，状态访问必须受限。bootstrap bucket 首次创建时使用本地状态，之后作为两个 staging 栈的远端 backend。
