# 🔧 Configuración Completa de Azure

## 🚀 Opción 1: Script Automático (Recomendado)

```powershell
# Ejecutar en PowerShell como administrador
.\setup-azure.ps1
```

Este script creará automáticamente:
- ✅ Grupo de recursos
- ✅ Azure OpenAI Service
- ✅ Speech Services  
- ✅ Communication Services
- ✅ Storage Account
- ✅ Function App
- ✅ Archivo `local.settings.json` con todas las credenciales

## 🔧 Opción 2: Configuración Manual

### **Paso 1: Preparativos**
```bash
# Login a Azure
az login

# Crear grupo de recursos
az group create --name "rg-phone-agent" --location "eastus"
```

### **Paso 2: Azure OpenAI Service**
```bash
# Crear recurso
az cognitiveservices account create \
  --name "openai-phone-agent" \
  --resource-group "rg-phone-agent" \
  --kind "OpenAI" \
  --sku "S0" \
  --location "eastus"

# Obtener credenciales
az cognitiveservices account show \
  --name "openai-phone-agent" \
  --resource-group "rg-phone-agent" \
  --query "properties.endpoint"

az cognitiveservices account keys list \
  --name "openai-phone-agent" \
  --resource-group "rg-phone-agent"
```

**Desplegar modelo GPT-4:**
1. Ve a [Azure OpenAI Studio](https://oai.azure.com/)
2. Selecciona tu recurso
3. Ve a "Deployments" → "Create new deployment"
4. Modelo: `gpt-4` versión `turbo-2024-04-09`
5. Nombre: `gpt-4-turbo`

### **Paso 3: Speech Services**
```bash
az cognitiveservices account create \
  --name "speech-phone-agent" \
  --resource-group "rg-phone-agent" \
  --kind "SpeechServices" \
  --sku "S0" \
  --location "eastus"
```

### **Paso 4: Communication Services**
```bash
az communication create \
  --name "acs-phone-agent" \
  --resource-group "rg-phone-agent" \
  --location "global"
```

**Comprar número telefónico:**
1. Portal Azure → Communication Services → Phone numbers
2. "Get a number" → Selecciona país y tipo
3. Configura capabilities: "Inbound calls"

### **Paso 5: Function App**
```bash
# Storage account
az storage account create \
  --name "stphoneagent$(date +%s)" \
  --resource-group "rg-phone-agent" \
  --location "eastus" \
  --sku "Standard_LRS"

# Function App
az functionapp create \
  --resource-group "rg-phone-agent" \
  --consumption-plan-location "eastus" \
  --runtime "node" \
  --runtime-version "18" \
  --functions-version "4" \
  --name "func-phone-agent" \
  --storage-account "stphoneagent..."
```

## 📝 Configurar Variables de Entorno

Actualiza `local.settings.json` con tus credenciales:

```json
{
  "Values": {
    "AZURE_OPENAI_ENDPOINT": "https://openai-phone-agent.openai.azure.com/",
    "AZURE_OPENAI_KEY": "tu-openai-key",
    "AZURE_OPENAI_DEPLOYMENT_NAME": "gpt-4-turbo",
    
    "AZURE_SPEECH_KEY": "tu-speech-key",
    "AZURE_SPEECH_REGION": "eastus",
    
    "ACS_CONNECTION_STRING": "endpoint=https://acs-phone-agent.communication.azure.com/;accesskey=tu-key",
    "ACS_PHONE_NUMBER": "+1234567890",
    
    "ERP_API_BASE_URL": "https://tu-erp.com/api",
    "ERP_API_TOKEN": "tu-token-erp"
  }
}
```

## 🚀 Desplegar a Azure

```powershell
# Compilar y desplegar
.\deploy-azure.ps1 -FunctionAppName "func-phone-agent"
```

O manualmente:
```bash
npm run build
func azure functionapp publish func-phone-agent
```

## 📞 Configurar Webhooks

1. **Communication Services** → Event Grid → Create subscription
2. **Endpoint**: `https://func-phone-agent.azurewebsites.net/api/webhookHandler`
3. **Event types**: 
   - Microsoft.Communication.IncomingCall
   - Microsoft.Communication.CallConnected
   - Microsoft.Communication.CallDisconnected
   - Microsoft.Communication.RecognizeCompleted

## 🧪 Probar la Solución

```bash
# Probar endpoint
curl -X POST https://func-phone-agent.azurewebsites.net/api/callHandler \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-123",
    "customerPhone": "+1234567890",
    "transcribedText": "Hola, quiero hacer un pedido",
    "eventType": "RecognizeCompleted"
  }'
```

## 💰 Costos Estimados (USD/mes)

- **Azure OpenAI**: ~$50-200 (según uso)
- **Speech Services**: ~$10-50 (según minutos)
- **Communication Services**: ~$1/número + $0.013/minuto
- **Function App**: ~$0-20 (según ejecuciones)
- **Storage**: ~$1-5

**Total estimado**: $60-300/mes según volumen

## 🔒 Seguridad

- ✅ Todo en tu tenant Azure
- ✅ Sin datos externos
- ✅ Cumple GDPR/SOC2
- ✅ Logs en Application Insights
- ✅ Autenticación con Azure AD (opcional)

## 🆘 Troubleshooting

**Error "Deployment not found":**
- Verifica que el modelo GPT-4 esté desplegado en Azure OpenAI Studio

**Error "Phone number not found":**
- Compra un número telefónico en Communication Services

**Error "Webhook not receiving events":**
- Configura Event Grid subscription correctamente
- Verifica que la Function App esté desplegada

## 📊 Monitoreo

- **Application Insights**: Logs y métricas automáticas
- **Azure Monitor**: Alertas y dashboards
- **Communication Services**: Métricas de llamadas