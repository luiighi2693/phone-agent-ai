# Script completo para nueva cuenta Azure
param(
    [string]$ResourceGroup = "rg-phone-agent-new",
    [string]$Location = "swedencentral"
)

Write-Host "🚀 Configurando Phone Agent en nueva cuenta Azure..." -ForegroundColor Green

# Verificar login
Write-Host "Verificando login de Azure..." -ForegroundColor Yellow
$account = az account show 2>$null
if (-not $account) {
    Write-Host "Ejecutando az login..." -ForegroundColor Red
    az login
}

# Mostrar suscripción actual
$currentSub = az account show --query "{Name:name, SubscriptionId:id}" -o json | ConvertFrom-Json
Write-Host "Suscripción: $($currentSub.Name) ($($currentSub.SubscriptionId))" -ForegroundColor Cyan

# Variables con timestamp
$timestamp = Get-Date -Format "yyyyMMddHHmm"
$openaiName = "openai-phone-agent-$timestamp"
$speechName = "speech-phone-agent-$timestamp"
$acsName = "acs-phone-agent-$timestamp"
$storageName = "stphoneagent$timestamp"
$functionName = "func-phone-agent-$timestamp"

Write-Host "Creando grupo de recursos..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location

Write-Host "Creando Azure OpenAI..." -ForegroundColor Yellow
az cognitiveservices account create `
  --name $openaiName `
  --resource-group $ResourceGroup `
  --kind "OpenAI" `
  --sku "S0" `
  --location $Location

Write-Host "Desplegando modelo GPT-4..." -ForegroundColor Yellow
az cognitiveservices account deployment create `
  --name $openaiName `
  --resource-group $ResourceGroup `
  --deployment-name "gpt-4-turbo" `
  --model-name "gpt-4" `
  --model-version "turbo-2024-04-09" `
  --model-format "OpenAI" `
  --sku-capacity 10 `
  --sku-name "Standard"

Write-Host "Creando Speech Services..." -ForegroundColor Yellow
az cognitiveservices account create `
  --name $speechName `
  --resource-group $ResourceGroup `
  --kind "SpeechServices" `
  --sku "S0" `
  --location $Location

Write-Host "Creando Communication Services..." -ForegroundColor Yellow
az communication create `
  --name $acsName `
  --resource-group $ResourceGroup `
  --location "global" `
  --data-location "Europe"

Write-Host "Creando Storage Account..." -ForegroundColor Yellow
az storage account create `
  --name $storageName `
  --resource-group $ResourceGroup `
  --location $Location `
  --sku "Standard_LRS"

Write-Host "Creando Function App..." -ForegroundColor Yellow
az functionapp create `
  --resource-group $ResourceGroup `
  --consumption-plan-location $Location `
  --runtime "node" `
  --runtime-version "20" `
  --functions-version "4" `
  --name $functionName `
  --storage-account $storageName

Write-Host "Obteniendo credenciales..." -ForegroundColor Yellow

# Obtener todas las credenciales
$openaiEndpoint = az cognitiveservices account show --name $openaiName --resource-group $ResourceGroup --query "properties.endpoint" -o tsv
$openaiKey = az cognitiveservices account keys list --name $openaiName --resource-group $ResourceGroup --query "key1" -o tsv
$speechKey = az cognitiveservices account keys list --name $speechName --resource-group $ResourceGroup --query "key1" -o tsv
$acsConnectionString = az communication list-key --name $acsName --resource-group $ResourceGroup --query "primaryConnectionString" -o tsv
$storageConnectionString = az storage account show-connection-string --name $storageName --resource-group $ResourceGroup --query "connectionString" -o tsv

Write-Host "Generando configuración..." -ForegroundColor Yellow

$config = @"
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "$storageConnectionString",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "FUNCTIONS_EXTENSION_VERSION": "~4",
    
    "ACS_CONNECTION_STRING": "$acsConnectionString",
    "ACS_PHONE_NUMBER": "+46123456789",
    
    "AZURE_OPENAI_ENDPOINT": "$openaiEndpoint",
    "AZURE_OPENAI_KEY": "$openaiKey",
    "AZURE_OPENAI_DEPLOYMENT_NAME": "gpt-4-turbo",
    "USE_MOCK": "false",
    
    "AZURE_SPEECH_KEY": "$speechKey",
    "AZURE_SPEECH_REGION": "$Location",
    
    "ERP_API_BASE_URL": "http://localhost:3001/api",
    "ERP_API_TOKEN": "demo-erp-token-12345",
    
    "COMPANY_NAME": "Tu Empresa",
    "FUNCTION_APP_URL": "https://$functionName.azurewebsites.net"
  },
  "Host": {
    "CORS": "*",
    "LocalHttpPort": 7071
  }
}
"@

$config | Out-File -FilePath "local.settings.json" -Encoding UTF8

Write-Host "✅ Configuración completada!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Recursos creados:" -ForegroundColor Cyan
Write-Host "- Resource Group: $ResourceGroup"
Write-Host "- OpenAI: $openaiName (GPT4 desplegado)"
Write-Host "- Speech: $speechName"
Write-Host "- Communication: $acsName"
Write-Host "- Storage: $storageName"
Write-Host "- Function App: $functionName"
Write-Host ""
Write-Host "🎯 Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Probar localmente: npm run build; npm start"
Write-Host "2. Desplegar a Azure: func azure functionapp publish $functionName"
Write-Host "3. Comprar número telefónico sueco en portal.azure.com"
Write-Host ""
Write-Host "🔗 Enlaces útiles:" -ForegroundColor Cyan
Write-Host "- Azure OpenAI Studio: https://oai.azure.com/"
Write-Host "- Function App: https://$functionName.azurewebsites.net"
Write-Host "- Portal Azure: https://portal.azure.com"