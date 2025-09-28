# Script simplificado para desplegar
param(
    [string]$ResourceGroup = "rg-phone-agent-new"
)

Write-Host "Desplegando Phone Agent..." -ForegroundColor Green

# Obtener Function App
$functionApps = az functionapp list --resource-group $ResourceGroup --query "[].name" -o tsv
$functionAppName = $functionApps | Select-Object -First 1

if (-not $functionAppName) {
    Write-Host "No se encontro Function App en $ResourceGroup" -ForegroundColor Red
    exit 1
}

Write-Host "Function App: $functionAppName" -ForegroundColor Cyan

# Compilar
Write-Host "Compilando..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error compilando" -ForegroundColor Red
    exit 1
}

# Desplegar directamente
Write-Host "Desplegando..." -ForegroundColor Yellow
func azure functionapp publish $functionAppName --typescript

if ($LASTEXITCODE -eq 0) {
    Write-Host "Despliegue exitoso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "URLs:" -ForegroundColor Cyan
    Write-Host "- Twilio Webhook: https://$functionAppName.azurewebsites.net/api/twilioWebhook"
    Write-Host "- Call Handler: https://$functionAppName.azurewebsites.net/api/callHandler"
} else {
    Write-Host "Error en despliegue" -ForegroundColor Red
}