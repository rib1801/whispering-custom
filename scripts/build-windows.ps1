# Build do instalador Windows (.exe / NSIS) — Whispering custom
#
# Uso:  powershell -ExecutionPolicy Bypass -File scripts/build-windows.ps1
#
# Requisitos: Rust (MSVC), Visual Studio Build Tools com C++ x64, bun no PATH
# (https://bun.sh). Gera o instalador em
# apps\whispering\src-tauri\target\release\bundle\nsis\

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# Workaround ort-sys 2.0.0-rc.10 (build.rs:126): o build script copia DLLs
# (DirectML/onnxruntime) para target\release, target\release\examples e
# target\release\deps com std::fs::copy; se "examples" não existir, o unwrap
# estoura com "path not found" e a compilação morre. Criar as pastas resolve.
$targetRelease = Join-Path $repo 'apps\whispering\src-tauri\target\release'
New-Item -ItemType Directory -Force -Path $targetRelease | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $targetRelease 'examples') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $targetRelease 'deps') | Out-Null

Write-Host '== bun install ==' -ForegroundColor Cyan
bun install
if ($LASTEXITCODE -ne 0) { throw "bun install falhou ($LASTEXITCODE)" }

Write-Host '== build do frontend ==' -ForegroundColor Cyan
bun --filter '@epicenter/whispering' build
if ($LASTEXITCODE -ne 0) { throw "build do frontend falhou ($LASTEXITCODE)" }

Write-Host '== tauri build (NSIS) ==' -ForegroundColor Cyan
Push-Location 'apps\whispering'
try {
  bun x tauri build --bundles nsis
  if ($LASTEXITCODE -ne 0) { throw "tauri build falhou ($LASTEXITCODE)" }
} finally {
  Pop-Location
}

$nsis = Join-Path $repo 'apps\whispering\src-tauri\target\release\bundle\nsis'
Get-ChildItem $nsis -Filter '*.exe' | Select-Object FullName, @{n = 'MB'; e = { [math]::Round($_.Length / 1MB, 1) } }
