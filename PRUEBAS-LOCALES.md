# 🧪 Guía de Pruebas Locales

## 🚀 Inicio Rápido (Sin credenciales Azure)

### Opción 1: Script Automático
```bash
# Windows
start-local.bat

# O manualmente:
```

### Opción 2: Paso a Paso

1. **Iniciar simulador ERP:**
```bash
cd erp-simulator
npm install
npm start
```

2. **En otra terminal, iniciar Azure Functions:**
```bash
npm install
npm run build
npm start
```

3. **En otra terminal, ejecutar pruebas:**
```bash
node test-local.js
```

## 📞 Pruebas Disponibles

### 1. Probar ERP Simulado
```bash
# Obtener productos
curl http://localhost:3001/api/products \
  -H "Authorization: Bearer demo-erp-token-12345"

# Buscar cliente
curl http://localhost:3001/api/customers/by-phone/+1234567890 \
  -H "Authorization: Bearer demo-erp-token-12345"
```

### 2. Probar Agente Telefónico

**Saludo inicial:**
```bash
curl -X POST http://localhost:7071/api/callHandler \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-001",
    "customerPhone": "+1234567890",
    "eventType": "CallConnected"
  }'
```

**Búsqueda de productos:**
```bash
curl -X POST http://localhost:7071/api/callHandler \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-001",
    "customerPhone": "+1234567890",
    "transcribedText": "Necesito información sobre laptops",
    "eventType": "RecognizeCompleted"
  }'
```

**Consulta precio:**
```bash
curl -X POST http://localhost:7071/api/callHandler \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-001",
    "customerPhone": "+1234567890",
    "transcribedText": "Cuánto cuesta el LAP001",
    "eventType": "RecognizeCompleted"
  }'
```

**Crear pedido:**
```bash
curl -X POST http://localhost:7071/api/callHandler \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "test-001",
    "customerPhone": "+1234567890",
    "transcribedText": "Quiero hacer un pedido de 2 laptops LAP001",
    "eventType": "RecognizeCompleted"
  }'
```

## 🔧 Configuración para Pruebas

El archivo `local.settings.json` está configurado para usar **mocks** cuando no tienes credenciales de Azure:

```json
{
  "Values": {
    "USE_MOCK": "true",
    "AZURE_OPENAI_KEY": "",
    "ERP_API_BASE_URL": "http://localhost:3001/api",
    "ERP_API_TOKEN": "demo-erp-token-12345"
  }
}
```

## 📊 Datos de Prueba

### Clientes en el ERP simulado:
- **+1234567890** → Empresa ABC (descuento 10%)
- **+0987654321** → Distribuidora XYZ (descuento 15%)
- **Otros números** → Cliente invitado

### Productos disponibles:
- **LAP001** → Laptop Dell Inspiron 15 ($899.99)
- **MON001** → Monitor Samsung 24" ($199.99)
- **TEC001** → Teclado Logitech MX Keys ($99.99)

## 🎯 Flujo de Conversación Simulado

1. **Cliente llama** → Saludo personalizado
2. **"Necesito laptops"** → Búsqueda de productos
3. **"Precio del LAP001"** → Información detallada
4. **"Quiero 2 laptops"** → Creación de pedido
5. **"Confirmar"** → Pedido enviado al ERP
6. **"Gracias"** → Despedida y fin

## 🔍 Logs y Debugging

- **Azure Functions**: Logs en la consola donde ejecutas `npm start`
- **ERP Simulado**: Logs en la consola del simulador
- **Pruebas**: Output detallado con `node test-local.js`

## ⚡ Próximo Paso: Credenciales Reales

Cuando tengas credenciales de Azure:

1. Actualiza `local.settings.json` con tus keys reales
2. Cambia `"USE_MOCK": "false"`
3. El sistema usará Azure OpenAI automáticamente

## 🆘 Troubleshooting

**Error "ECONNREFUSED":**
- Verifica que el ERP simulador esté corriendo en puerto 3001

**Error "Function not found":**
- Ejecuta `npm run build` antes de `npm start`

**Respuestas genéricas:**
- Normal en modo mock, las respuestas son predefinidas
- Con Azure OpenAI real tendrás conversaciones más naturales