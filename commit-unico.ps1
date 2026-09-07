# =====================================================================
#  eWMS_Advance - dejar UN solo commit completo
#  Pliega todo lo pendiente en el commit inicial y reescribe su mensaje.
#  Seguro: el commit nunca se pusheo (no hay refs/remotes).
# =====================================================================

$ErrorActionPreference = 'Stop'
$Repo = 'C:\Users\steve_1xcg4d1\OneDrive\Desktop\eWMS_Advance\wms_advanced_web'

Push-Location $Repo

# Todo al indice: modificados, nuevos y borrados
git add -A

$mensaje = @'
Scaffold de Fase 0: workspace, 6 librerias y 9 compuertas de CI

Workspace de Angular CLI 22 (sin Nx) con la aplicacion shell y seis
librerias vacias: design-system, showroom, core, shared, api-client y
testing. Cada una expone unicamente su public-api.ts y se importa por su
alias @ewms/*.

Las reglas de dependencia entre librerias son errores de ESLint que rompen
el CI, no un acuerdo de buena fe: es el espejo frontend de la regla de
arquitectura del backend. Los cruces por ruta relativa profunda y el acceso
por detras de un public-api tambien estan prohibidos.

Compuertas de CI, todas bloqueantes:
  1. tsc en strict total (incluye noUncheckedIndexedAccess y
     exactOptionalPropertyTypes)
  2. ESLint con las fronteras, cero warnings
  3. Vitest con umbrales de cobertura
  4. Playwright, humo sobre la app real
  5. axe-core cableado en pruebas de componente
  6. npm audit --audit-level=high
  7. Gitleaks sobre historia y working tree
  8. Presupuestos de bundle en angular.json
  9. Reglas de seguridad como error de lint

Cada compuerta se verifico haciendola fallar antes de aceptarla:
  - frontera: un import de @ewms/core en design-system falla el lint
  - secreto: una credencial falsa dispara Gitleaks
  - cobertura: subir el umbral a 95% rompe el build
  - strict: los tres flags producen error de tipos
  - seguridad: localStorage, window.localStorage, globalThis.localStorage,
    innerHTML y bypassSecurityTrust* fallan el lint

Los tokens de diseno viven en projects/design-system/src/styles/tokens.css
y ese archivo es la fuente de verdad: se escribe a mano y se revisa en un
pull request, como cualquier otro codigo. No hay generador, ni tokens.json,
ni Style Dictionary. Ningun componente puede llevar un valor crudo; si
falta un token se agrega ahi primero.

Node fijado en 24 LTS en cuatro lugares que deben coincidir: .node-version,
engines.node, engine-strict=true en .npmrc y node-version-file en ci.yml.

Sin componentes, sin pantallas y sin valores de diseno: eso es Fase 1 y 2.
'@

$tmp = Join-Path $env:TEMP 'ewms-commit-msg.txt'
[System.IO.File]::WriteAllText($tmp, $mensaje, (New-Object System.Text.UTF8Encoding $false))

git commit --amend -F $tmp
Remove-Item -LiteralPath $tmp -Force

Write-Host "`n--- Resultado ---`n" -ForegroundColor Green
git log --oneline
Write-Host ""
git status --short
Write-Host "`nArbol del commit (debe NO aparecer tools/tokens):" -ForegroundColor Cyan
git ls-tree -r --name-only HEAD | Select-String 'tools/'
if ($LASTEXITCODE -ne 0) { Write-Host "  OK: no hay tools/ en el commit" -ForegroundColor Green }

Pop-Location
