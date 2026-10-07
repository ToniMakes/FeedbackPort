# FeedbackPort AWS staging infrastructure

## English

Terraform is split by lifecycle. `bootstrap/` creates the encrypted, versioned state bucket and initially uses local state. `staging-base/` owns resources that stay between deployments: ECR, the delegated Route 53 zone, ACM certificate and DNS validation, empty Secrets Manager secret containers, ECS roles, and (when permitted) the GitHub Actions OIDC deploy role. `staging-runtime/` owns the VPC and public subnets, ALB, ECS cluster/service, task and security groups, DNS aliases, and CloudWatch log group. The AWS Budget is an account billing resource managed through the `us-east-1` provider alias; workload resources stay in Sydney. Destroy `staging-runtime` whenever the staging environment is idle for more than one day; setting ECS desired count to zero does not stop ALB charges.

The Fargate tasks receive public IPs in public subnets and have no NAT Gateway. Their security group only accepts TCP/3000 from the ALB security group; outbound HTTPS is allowed for managed Supabase and Upstash. The ALB is public on 80/443 and redirects HTTP to HTTPS. The ACM certificate covers `fp-staging.tonimakes.com` and `*.board.fp-staging.tonimakes.com`.

Terraform never receives secret values. It creates Secrets Manager containers; add values through the AWS console or AWS CLI from your secure workstation. ECS reads these values at task start through the execution role. The task role has no AWS permissions. State files and plans can contain sensitive infrastructure metadata; restrict access and do not commit local `*.tfvars`, state, plans, or backend configuration.

### Initial account setup checklist (owner-operated)

1. Use the existing AWS project created through the new AWS experience; do not create another account or project. Confirm the intended project is `Assembly Required`, register Builder ID MFA, and add a recovery email. This experience has no root user or user-managed IAM Identity Center role for routine access.
2. Install AWS CLI v2.32.0 or newer, then run `aws login --region ap-southeast-2` and complete browser authorization. Verify `aws sts get-caller-identity` returns the project account and an `assumed-role/AccountFullAccessRole/...` ARN. Do not create long-lived access keys.
3. Terraform's AWS SDK does not directly consume the new CLI login cache in every local setup. Use `Invoke-TerraformWithAwsLogin.ps1` to pass the CLI-refreshed temporary credentials to Terraform only in the current process; do not print or save exported credentials.
4. Terraform has not created the US$30 monthly AWS Budget yet because `budget_notification_email` is unset. To add actual notifications at 50%, 80%, and 100%, plus a 100% forecast alert, set the owner-approved address in the ignored `staging-base/terraform.tfvars`, review the plan, apply it, and confirm AWS's email subscription. Budget alerts are monitoring, not a hard spending cap.
5. The current AWS Free Plan project's organization policy denied `iam:CreateOpenIDConnectProvider`. Keep `enable_github_deployment = false` (the default); do not create static GitHub credentials or activate advanced features. GitHub Actions AWS deployment is unavailable under the observed policy.
6. In GitHub, create the `staging` Environment and restrict deployments to `main`; configure yourself as the required reviewer. No AWS credentials are stored as repository secrets.
7. In Namecheap, wait until `staging-base` outputs the four Route 53 name servers, then create NS records delegating `fp-staging.tonimakes.com` to those values. Do not alter the production zone or Vercel records.
8. In the staging Supabase project, Upstash staging database, and Cloudflare Turnstile, create the separate staging credentials. Enter only server-side values into the matching Secrets Manager secret. Keep the public Supabase URL/anon key and Turnstile site key in GitHub Variables for the image build; they are public values, never server secrets.

### Terraform bootstrap and apply

Install Terraform 1.10+ and AWS CLI v2.32+, then authenticate with `aws login --region ap-southeast-2`. From `infra/terraform/bootstrap`, copy `terraform.tfvars.example` to `terraform.tfvars`, choose a globally unique bucket name, and run Terraform through the temporary-credential helper:

```powershell
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('init', '-input=false')
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('fmt', '-check', '-recursive', '..')
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('validate')
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('plan', '-out=bootstrap.tfplan')
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('apply', 'bootstrap.tfplan')
```

After the bucket exists, initialize each remote-backed stack with its backend file (copy the `.example` file to an ignored `backend.hcl` and replace the bucket):

```powershell
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('init', '-backend-config=backend.hcl')
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('plan')
```

Apply `staging-base` only after reviewing its plan. The apply creates the certificate and validation records but does not wait for certificate issuance, so it can finish and print the zone name servers. Add those NS records in Namecheap, wait for DNS delegation and for ACM status `ISSUED`, then add the secret values outside Terraform. Copy the base outputs into `staging-runtime/terraform.tfvars.example` (as `terraform.tfvars`), review the runtime plan and apply. This creates a zero-task service by default; phase C will deploy a real immutable image and scale the service to one task for verification.

To retire an idle environment, run `terraform destroy` in `staging-runtime` first. Keep `staging-base` and the state bucket. Delete permanent resources only when intentionally decommissioning staging, after backing up and reviewing state. ECR has immutable tags and retains the newest 20 images.

### Cost model (planning estimate, not a bill)

An always-on ALB has hourly and capacity-unit charges, even with zero ECS tasks ([ELB pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)). A single 0.25-vCPU/0.5-GiB Fargate task adds hourly compute while running ([Fargate pricing](https://aws.amazon.com/fargate/pricing/)). AWS currently lists a public Route 53 hosted zone at US$0.50/month ([Route 53 pricing](https://aws.amazon.com/route53/pricing/)) and in-use public IPv4 addresses at US$0.005/address-hour (US$3.65 per address for a 730-hour month; [VPC pricing](https://aws.amazon.com/vpc/pricing/)). With the ALB's public addresses, one task address, compute, logs, and traffic, a continuously running environment could exceed the US$30 cap. The chosen operating pattern is to run staging only for planned verification and destroy the whole runtime layer when idle; the Route 53 zone, ECR storage, Secrets Manager, ACM, and state storage remain. Before the first apply, enter planned ALB hours, task runtime, and data volume in the [AWS Pricing Calculator](https://calculator.aws/) for `ap-southeast-2`; the account-specific estimate is still pending. Compare it with actual AWS Cost Explorer after use. Do not represent this planning estimate as measured spend. Prices and free-tier eligibility can change.

## 中文

Terraform 按资源生命周期拆分。`bootstrap/` 创建加密且开启版本控制的状态 bucket，首次使用本地状态；`staging-base/` 管理部署间保留的 ECR、委托的 Route 53 托管区、ACM 证书及 DNS 验证、空的 Secrets Manager 密钥容器、ECS 角色和（权限允许时）GitHub Actions OIDC 部署角色；`staging-runtime/` 管理 VPC/公有子网、ALB、ECS 集群与服务、任务和安全组、DNS 别名及 CloudWatch 日志组。AWS Budget 是账号账单资源，通过 `us-east-1` provider alias 管理；应用资源仍在悉尼。预发布环境闲置超过一天时销毁整个 `staging-runtime`；仅将 ECS desired count 设为 0 并不会停止 ALB 计费。

Fargate 任务使用公有子网和公有 IP，不创建 NAT Gateway。任务安全组只允许来自 ALB 安全组的 TCP/3000；出站 HTTPS 用于访问托管的 Supabase、Upstash。ALB 对公网开放 80/443，并把 HTTP 重定向到 HTTPS。ACM 证书覆盖 `fp-staging.tonimakes.com` 和 `*.board.fp-staging.tonimakes.com`。

Terraform 不接收任何密钥值，只创建 Secrets Manager 容器；请通过 AWS 控制台或安全工作站上的 AWS CLI 填值。ECS 启动任务时由执行角色读取密钥；应用任务角色没有 AWS 权限。状态文件和 plan 也可能包含敏感基础设施元数据，请限制访问，不要提交本地 `*.tfvars`、状态、plan 或 backend 配置。

### 账号初始化清单（由账号所有者操作）

1. 使用通过 AWS 新体验创建的现有项目，不要再创建 AWS 账号或项目。确认目标项目为 `Assembly Required`，注册 Builder ID MFA 并添加恢复邮箱。该体验没有 root 用户，也不需要自行建立 IAM Identity Center 日常登录角色。
2. 安装 AWS CLI v2.32.0 或更高版本，运行 `aws login --region ap-southeast-2` 并在浏览器完成授权。验证 `aws sts get-caller-identity` 返回此项目账号及 `assumed-role/AccountFullAccessRole/...` ARN。不要创建长期 access key。
3. Terraform AWS SDK 在部分本地环境中不能直接读取新版 CLI 登录缓存。使用 `Invoke-TerraformWithAwsLogin.ps1`，只在当前进程中把 CLI 刷新的临时凭证交给 Terraform；不要打印或保存导出的凭证。
4. Terraform 尚未创建每月 US$30 AWS Budget，因为 `budget_notification_email` 还未设置。若要添加 50%、80%、100% 实际支出告警和 100% 预测告警，请将你确认的通知邮箱填入被忽略的 `staging-base/terraform.tfvars`，审阅 plan 后 apply，并确认 AWS 的邮件订阅。预算告警只是监控，不是硬性支出上限。
5. 当前 AWS Free Plan 项目的组织策略已明确拒绝 `iam:CreateOpenIDConnectProvider`。保持 `enable_github_deployment = false`（默认值）；不要创建静态 GitHub 凭证或启用高级功能。在观察到的策略下，GitHub Actions 暂不能访问 AWS，详见 ADR 0006。
6. 在 GitHub 创建 `staging` Environment，部署分支限制为 `main`，并将你设置为必需审批人。不要把 AWS 凭证存为仓库 Secret。
7. 等 `staging-base` 输出 Route 53 的四个 Name Server 后，在 Namecheap 创建 NS 记录，把 `fp-staging.tonimakes.com` 委托给这些服务器。不要更改生产 DNS 区或 Vercel 记录。
8. 在 staging Supabase 项目、Upstash staging 数据库和 Cloudflare Turnstile 中创建独立 staging 凭证，把服务端值填入对应 Secrets Manager 密钥。公开的 Supabase URL/anon key 与 Turnstile site key 存入 GitHub Variables，供镜像构建使用；它们是公开值，不是服务端密钥。

### Terraform 初始化与 apply

安装 Terraform 1.10+ 和 AWS CLI v2.32+，然后运行 `aws login --region ap-southeast-2`。从 `infra/terraform/bootstrap` 复制 `terraform.tfvars.example` 为 `terraform.tfvars`，选择全局唯一的 bucket 名，并通过临时凭证 helper 运行 Terraform：

```powershell
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('init', '-input=false')
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('fmt', '-check', '-recursive', '..')
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('validate')
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('plan', '-out=bootstrap.tfplan')
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('apply', 'bootstrap.tfplan')
```

bucket 建好后，各远端状态栈使用对应 backend 文件初始化（把 `.example` 复制为被忽略的 `backend.hcl` 并替换 bucket 名）：

```powershell
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('init', '-backend-config=backend.hcl')
& ..\Invoke-TerraformWithAwsLogin.ps1 -TerraformArgs @('plan')
```

当前 AWS Free Plan 项目的组织策略已明确拒绝 `iam:CreateOpenIDConnectProvider`。保持 `enable_github_deployment = false`（默认值）；不要创建静态 GitHub 凭证或启用高级功能。在观察到的策略下，GitHub Actions 暂不能访问 AWS。

先审阅 `staging-base` plan 再 apply。apply 会创建证书与验证记录，但不会等待证书签发，因此能先结束并输出托管区 Name Server。将 NS 记录加入 Namecheap，等待 DNS 委托和 ACM 状态变为 `ISSUED`，再在 Terraform 外填入密钥。随后把 base 输出填入 `staging-runtime/terraform.tfvars.example`（另存为 `terraform.tfvars`），审阅 runtime plan 后 apply。默认服务任务数为 0；阶段 C 会部署真实不可变镜像，并将服务扩到一个任务进行验证。

环境闲置时先在 `staging-runtime` 执行 `terraform destroy`。保留 `staging-base` 与状态 bucket。只有明确停用 staging 时才销毁常驻资源，并先备份、审阅状态。ECR 标签不可变并保留最新 20 个镜像。

### 成本模型（规划估算，不是账单）

ALB 即使 ECS 任务数为 0，仍按小时及容量单位收费（[ELB 价格](https://aws.amazon.com/elasticloadbalancing/pricing/)）。持续运行一个 0.25-vCPU/0.5-GiB Fargate 任务还会产生小时计算费用（[Fargate 价格](https://aws.amazon.com/fargate/pricing/)）。AWS 当前列出的 Route 53 公有托管区价格为每月 US$0.50（[Route 53 价格](https://aws.amazon.com/route53/pricing/)）；正在使用的公有 IPv4 地址为 US$0.005/地址小时（按 730 小时月计，每个地址 US$3.65；[VPC 价格](https://aws.amazon.com/vpc/pricing/)）。加上 ALB 公有地址、任务地址、计算、日志和流量后，持续运行的环境可能超过 US$30。计划采用按需验证 staging、闲置时销毁整个 runtime 层的方式；Route 53 托管区、ECR 存储、Secrets Manager、ACM 和状态存储保留。首次 apply 前，请在 [AWS Pricing Calculator](https://calculator.aws/) 选择 `ap-southeast-2` 并填入计划中的 ALB 小时、任务运行时长与流量；账号内的实际估算尚待完成。运行后再用 Cost Explorer 对照实际费用。不要把规划估算描述成实测费用。价格和免费额度可能变化。
