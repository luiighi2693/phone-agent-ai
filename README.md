# 🤖 Agente Telefónico con IA - Azure

Prototipo de agente telefónico inteligente usando **solo servicios de Azure** para máxima seguridad y confiabilidad.

## 🏗️ Arquitectura (Solo Azure)

- **Azure Communication Services** - Llamadas telefónicas
- **Azure Speech Services** - Speech-to-text/text-to-speech  
- **Azure OpenAI Service** - LLM privado en tu tenant
- **Azure Functions** - Lógica de negocio serverless
- **Azure SQL Database** - Conexión ERP
- **Azure Cosmos DB** - Contexto conversacional (opcional)

## 🚀 Configuración Rápida

### 1. Configurar Azure OpenAI Service

```bash
# Crear recurso Azure OpenAI en tu tenant
az cognitiveservices account create \
  --name "tu-openai-service" \
  --resource-group "tu-rg" \
  --kind "OpenAI" \
  --sku "S0" \
  --location "eastus"

# Desplegar modelo GPT-4
az cognitiveservices account deployment create \
  --name "tu-openai-service" \
  --resource-group "tu-rg" \
  --deployment-name "gpt-4-turbo" \
  --model-name "gpt-4" \
  --model-version "turbo-2024-04-09"
```

### 2. Configurar Azure Communication Services

```bash
# Crear recurso Communication Services
az communication create \
  --name "tu-acs-service" \
  --resource-group "tu-rg" \
  --location "global"

# Obtener número telefónico
az communication phonenumber purchase \
  --connection-string "tu-connection-string" \
  --phone-plan-id "plan-id"
```

### 3. Configurar Variables de Entorno

Edita `local.settings.json`:

```json
{
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    
    "ACS_CONNECTION_STRING": "endpoint=https://tu-acs.communication.azure.com/;accesskey=TU_ACCESS_KEY",
    "ACS_PHONE_NUMBER": "+1234567890",
    
    "AZURE_OPENAI_ENDPOINT": "https://tu-openai.openai.azure.com/",
    "AZURE_OPENAI_KEY": "tu-openai-key",
    "AZURE_OPENAI_DEPLOYMENT_NAME": "gpt-4-turbo",
    
    "AZURE_SPEECH_KEY": "tu-speech-key",
    "AZURE_SPEECH_REGION": "eastus",
    
    "ERP_API_BASE_URL": "http://localhost:3001/api",
    "ERP_API_TOKEN": "demo-erp-token-12345",
    
    "COMPANY_NAME": "Tu Empresa"
  }
}
```

### 4. Instalar y Ejecutar

```bash
# Instalar dependencias
npm install

# Instalar simulador ERP
cd erp-simulator
npm install
npm start &
cd ..

# Compilar y ejecutar Azure Functions
npm run build
npm start
```

## 🔧 Conexión con tu ERP

### Opción 1: API REST
Modifica `src/services/erpConnector.ts` para conectar con tu API ERP:

```typescript
constructor() {
  this.baseUrl = 'https://tu-erp.com/api';
  this.apiToken = process.env.ERP_API_TOKEN;
}
```

### Opción 2: Base de Datos Directa
Instala driver de BD y modifica el connector:

```bash
npm install mssql  # Para SQL Server
npm install mysql2 # Para MySQL
npm install pg     # Para PostgreSQL
```

## 📞 Flujo de Llamada

1. **Cliente llama** → Azure Communication Services
2. **Webhook recibe evento** → `webhookHandler`
3. **Speech-to-text** → Azure Speech Services  
4. **Procesamiento IA** → Azure OpenAI (privado)
5. **Consulta ERP** → Tu base de datos/API
6. **Respuesta** → Text-to-speech → Cliente

## 🛡️ Ventajas de Solo Azure

- **Seguridad**: Todo en tu tenant, sin datos externos
- **Confiabilidad**: Un solo proveedor, menos puntos de falla
- **Compliance**: Cumple regulaciones empresariales
- **Escalabilidad**: Auto-scaling nativo
- **Costos**: Facturación unificada

## 🧪 Pruebas

```bash
# Probar endpoint de llamadas
curl -X POST http://localhost:7071/api/callHandler \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-123",
    "customerPhone": "+1234567890", 
    "transcribedText": "Hola, quiero hacer un pedido",
    "eventType": "RecognizeCompleted"
  }'
```

## 📊 Monitoreo

- **Application Insights** para logs y métricas
- **Azure Monitor** para alertas
- **Azure Dashboard** para visualización

## 🚀 Despliegue a Producción

```bash
# Crear Function App
az functionapp create \
  --resource-group "tu-rg" \
  --consumption-plan-location "eastus" \
  --runtime "node" \
  --runtime-version "18" \
  --functions-version "4" \
  --name "tu-phone-agent" \
  --storage-account "tustorage"

# Desplegar
func azure functionapp publish tu-phone-agent
```

## 💡 Próximos Pasos

1. **Integrar con tu ERP real**
2. **Configurar Azure Cosmos DB** para persistencia
3. **Implementar autenticación** con Azure AD
4. **Configurar CI/CD** con Azure DevOps
5. **Agregar métricas** y alertas

## 🆘 Soporte

- Revisa logs en Application Insights
- Verifica configuración en `local.settings.json`
- Asegúrate que el simulador ERP esté corriendo
- Valida permisos de Azure OpenAI

---

**¿Listo para producción?** Este prototipo está diseñado para ser resiliente, seguro y escalable usando únicamente servicios de Azure. 🚀