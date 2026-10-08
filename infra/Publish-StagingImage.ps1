param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^(?!latest$)[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$')]
    [string]$ImageTag
)

$ErrorActionPreference = "Stop"
$region = "ap-southeast-2"
$repositoryName = "feedbackport-web-staging"
$repoRoot = Split-Path -Parent $PSScriptRoot
$publicEnvFile = Join-Path $repoRoot "apps/web/.env.staging.local"

$awsCommand = Get-Command aws -ErrorAction SilentlyContinue
if ($awsCommand) {
    $awsPath = $awsCommand.Source
} else {
    $awsPath = Join-Path $env:ProgramFiles "Amazon\AWSCLIV2\aws.exe"
}
if (-not (Test-Path -LiteralPath $awsPath)) {
    throw "AWS CLI was not found. Install AWS CLI v2 and run aws login first."
}

$dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
$dockerPath = if ($dockerCommand) { $dockerCommand.Source } else { Join-Path $env:ProgramFiles "Docker\Docker\resources\bin\docker.exe" }
if (-not (Test-Path -LiteralPath $dockerPath)) {
    throw "Docker CLI was not found. Start Docker Desktop or add its CLI to PATH."
}

if (-not (Test-Path -LiteralPath $publicEnvFile)) {
    throw "Create apps/web/.env.staging.local with the three public NEXT_PUBLIC_* build values first."
}

$requiredPublicValues = @(
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY"
)
$publicValues = @{}
foreach ($line in Get-Content -LiteralPath $publicEnvFile) {
    if ($line -match '^\s*(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|NEXT_PUBLIC_TURNSTILE_SITE_KEY)\s*=\s*(.*?)\s*$') {
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $publicValues[$Matches[1]] = $value
    }
}

$missing = @($requiredPublicValues | Where-Object { -not $publicValues[$_] })
if ($missing.Count -gt 0) {
    throw "Missing public build values in apps/web/.env.staging.local: $($missing -join ', ')"
}

$accountId = (& $awsPath sts get-caller-identity --query Account --output text 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or -not $accountId) {
    throw "AWS CLI session is unavailable. Run aws login --region $region and try again."
}

$repositoryUri = & $awsPath ecr describe-repositories --region $region --repository-names $repositoryName --query 'repositories[0].repositoryUri' --output text
if ($LASTEXITCODE -ne 0 -or -not $repositoryUri) {
    throw "Could not read the staging ECR repository. Confirm the AWS CLI session and target account."
}
if ($repositoryUri -notmatch "^$accountId\.dkr\.ecr\.$region\.amazonaws\.com/") {
    throw "The selected AWS account does not match the staging ECR repository. Check aws sts get-caller-identity."
}

$imageUri = "${repositoryUri}:$ImageTag"
$localImage = "feedbackport-web-staging:$ImageTag"

Write-Output "Building staging image $ImageTag..."
& $dockerPath build --file (Join-Path $repoRoot "Dockerfile") --tag $localImage `
    --build-arg "NEXT_PUBLIC_SUPABASE_URL=$($publicValues['NEXT_PUBLIC_SUPABASE_URL'])" `
    --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=$($publicValues['NEXT_PUBLIC_SUPABASE_ANON_KEY'])" `
    --build-arg "NEXT_PUBLIC_TURNSTILE_SITE_KEY=$($publicValues['NEXT_PUBLIC_TURNSTILE_SITE_KEY'])" `
    $repoRoot
if ($LASTEXITCODE -ne 0) {
    throw "Docker image build failed."
}

& $dockerPath tag $localImage $imageUri
if ($LASTEXITCODE -ne 0) {
    throw "Could not tag the staging image."
}

$ecrPassword = & $awsPath ecr get-login-password --region $region
if ($LASTEXITCODE -ne 0 -or -not $ecrPassword) {
    throw "Could not get a temporary ECR login token. Run aws login --region $region again."
}
try {
    $ecrPassword | & $dockerPath login --username AWS --password-stdin "$accountId.dkr.ecr.$region.amazonaws.com"
    if ($LASTEXITCODE -ne 0) {
        throw "Docker could not authenticate to ECR."
    }
} finally {
    Remove-Variable ecrPassword -ErrorAction SilentlyContinue
}

& $dockerPath push $imageUri
if ($LASTEXITCODE -ne 0) {
    throw "Docker image push failed."
}

Write-Output "Pushed $imageUri"
Write-Output "This script only builds and pushes the image. ECS remains at zero tasks until staging secrets and the runtime Terraform inputs are configured."
