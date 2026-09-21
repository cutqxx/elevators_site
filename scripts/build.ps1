$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$apiDist = Join-Path $dist "api"

if (Test-Path $dist) {
  Remove-Item -LiteralPath $dist -Recurse -Force
}

New-Item -ItemType Directory -Path $dist | Out-Null
New-Item -ItemType Directory -Path $apiDist | Out-Null

$filesToCopy = @(
  "index.html",
  "styles.css",
  "script.js",
  "pico.min.css",
  ".env.example"
)

foreach ($file in $filesToCopy) {
  Copy-Item -LiteralPath (Join-Path $root $file) -Destination $dist
}

Copy-Item -LiteralPath (Join-Path $root "fonts") -Destination (Join-Path $dist "fonts") -Recurse
Copy-Item -LiteralPath (Join-Path $root "api\\lead.js") -Destination $apiDist

Write-Host "Build completed: files copied to dist/"
