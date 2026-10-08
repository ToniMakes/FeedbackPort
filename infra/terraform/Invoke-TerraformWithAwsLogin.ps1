param(
    [Parameter(Mandatory = $true)]
    [string[]]$TerraformArgs
)

$ErrorActionPreference = "Stop"

$awsCommand = Get-Command aws -ErrorAction SilentlyContinue
if ($awsCommand) {
    $awsPath = $awsCommand.Source
} else {
    $awsPath = Join-Path $env:ProgramFiles "Amazon\AWSCLIV2\aws.exe"
}

if (-not (Test-Path -LiteralPath $awsPath)) {
    throw "AWS CLI was not found. Install AWS CLI v2 and run aws login first."
}

$terraformCommand = Get-Command terraform -ErrorAction SilentlyContinue
if ($terraformCommand) {
    $terraformPath = $terraformCommand.Source
} else {
    $terraformPath = Join-Path $env:TEMP "feedbackport-terraform-1.14.9\terraform.exe"
}

if (-not (Test-Path -LiteralPath $terraformPath)) {
    throw "Terraform was not found. Install Terraform 1.10+ or place its executable on PATH."
}

# Keep temporary credentials in process memory only; never write or print them.
$credentialJson = & $awsPath configure export-credentials --format process --region ap-southeast-2
if ($LASTEXITCODE -ne 0) {
    throw "AWS CLI could not export the current temporary login session. Run aws login first."
}

$credentials = $credentialJson | ConvertFrom-Json
if (-not $credentials.AccessKeyId -or -not $credentials.SecretAccessKey -or -not $credentials.SessionToken) {
    throw "AWS CLI did not return a complete temporary session."
}

$environmentNames = @(
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AWS_DEFAULT_REGION"
)
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}

try {
    $env:AWS_ACCESS_KEY_ID = $credentials.AccessKeyId
    $env:AWS_SECRET_ACCESS_KEY = $credentials.SecretAccessKey
    $env:AWS_SESSION_TOKEN = $credentials.SessionToken
    $env:AWS_DEFAULT_REGION = "ap-southeast-2"

    & $terraformPath @TerraformArgs
    $terraformExitCode = $LASTEXITCODE
} finally {
    foreach ($name in $environmentNames) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
    }
    Remove-Variable credentials, credentialJson -ErrorAction SilentlyContinue
}

exit $terraformExitCode
