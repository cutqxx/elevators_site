$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$requiredFiles = @(
  "index.html",
  "styles.css",
  "script.js",
  "server.js",
  "package.json",
  "scripts/build.ps1",
  "api/lead.js",
  ".env.example"
)

foreach ($file in $requiredFiles) {
  $path = Join-Path $root $file

  if (-not (Test-Path $path)) {
    throw "Missing required file: $file"
  }
}

$html = Get-Content -LiteralPath (Join-Path $root "index.html") -Raw
$css = Get-Content -LiteralPath (Join-Path $root "styles.css") -Raw
$js = Get-Content -LiteralPath (Join-Path $root "script.js") -Raw
$api = Get-Content -LiteralPath (Join-Path $root "api/lead.js") -Raw
$server = Get-Content -LiteralPath (Join-Path $root "server.js") -Raw
$packageJson = Get-Content -LiteralPath (Join-Path $root "package.json") -Raw

$checks = @(
  @{ Pattern = 'lang="ru"'; Source = "index.html"; Message = "Missing ru language marker" },
  @{ Pattern = 'id="lead-form"'; Source = "index.html"; Message = "Missing lead form" },
  @{ Pattern = 'id="name"'; Source = "index.html"; Message = "Missing name field" },
  @{ Pattern = 'id="address"'; Source = "index.html"; Message = "Missing address field" },
  @{ Pattern = 'id="issue"'; Source = "index.html"; Message = "Missing issue field" },
  @{ Pattern = 'id="phone"'; Source = "index.html"; Message = "Missing phone field" },
  @{ Pattern = 'minlength="2"'; Source = "index.html"; Message = "Missing name min length" },
  @{ Pattern = 'minlength="5"'; Source = "index.html"; Message = "Missing address min length" },
  @{ Pattern = 'issue'; Source = "script.js"; Message = "Missing issue validation" },
  @{ Pattern = 'lead-form__submit'; Source = "index.html"; Message = "Missing submit button" },
  @{ Pattern = '\.hero__layout'; Source = "styles.css"; Message = "Missing hero styles" },
  @{ Pattern = '@media \(min-width: 980px\)'; Source = "styles.css"; Message = "Missing desktop responsive styles" },
  @{ Pattern = 'normalizePhoneDigits'; Source = "script.js"; Message = "Missing phone normalization" },
  @{ Pattern = '/api/lead'; Source = "script.js"; Message = "Missing form submit endpoint" },
  @{ Pattern = 'isSubmitting'; Source = "script.js"; Message = "Missing duplicate submit protection" },
  @{ Pattern = 'subject:'; Source = "api/lead.js"; Message = "Missing email subject" },
  @{ Pattern = 'RESEND_API_KEY'; Source = "api/lead.js"; Message = "Missing server env usage" },
  @{ Pattern = 'response\.status\(400\)'; Source = "api/lead.js"; Message = "Missing server validation response" },
  @{ Pattern = 'PHONE_PATTERN'; Source = "api/lead.js"; Message = "Missing phone validation on server" },
  @{ Pattern = 'loadEnvFile'; Source = "server.js"; Message = "Missing .env loading in local server" },
  @{ Pattern = '/api/lead'; Source = "server.js"; Message = "Missing local api route" },
  @{ Pattern = 'node server\.js'; Source = "package.json"; Message = "Missing local dev script" }
)

foreach ($check in $checks) {
  $content = switch ($check.Source) {
    "index.html" { $html }
    "styles.css" { $css }
    "script.js" { $js }
    "api/lead.js" { $api }
    "server.js" { $server }
    "package.json" { $packageJson }
    default { "" }
  }

  if ($content -notmatch $check.Pattern) {
    throw $check.Message
  }
}

Write-Host "Lint completed: required structure and validation rules are present."
