# Script para corregir problemas de Twilio
param(
    [string]$FunctionAppName = "func-phone-agent-202509252306"
)

Write-Host "Corrigiendo configuracion de Twilio..." -ForegroundColor Yellow

# 1. Verificar que las funciones existen
Write-Host "Verificando funciones desplegadas..." -ForegroundColor Cyan
az functionapp function list --name $FunctionAppName --resource-group "rg-phone-agent-new" --query "[].{Name:name}" -o table

# 2. Cambiar nivel de autenticación a anonymous para twilioWebhook
Write-Host "Configurando autenticacion..." -ForegroundColor Cyan
az functionapp config appsettings set --name $FunctionAppName --resource-group "rg-phone-agent-new" --settings "FUNCTIONS_EXTENSION_VERSION=~4" --output none

# 3. Obtener URL correcta
$webhookUrl = "https://$FunctionAppName.azurewebsites.net/api/twilioWebhook"
Write-Host "URL del webhook: $webhookUrl" -ForegroundColor Green

Write-Host "Configuracion completada!" -ForegroundColor Green
Write-Host ""
Write-Host "Pasos siguientes:" -ForegroundColor Yellow
Write-Host "1. Ve a console.twilio.com"
Write-Host "2. Phone Numbers -> Manage -> Active numbers"
Write-Host "3. Click en tu numero"
Write-Host "4. Voice Configuration:"
Write-Host "   Webhook: $webhookUrl"
Write-Host "   HTTP Method: POST"
Write-Host "5. Save configuration"