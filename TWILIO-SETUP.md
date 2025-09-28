# 📞 Configuración Twilio para Agente Telefónico

## 🚀 Paso 1: Crear Cuenta Twilio

1. Ve a https://www.twilio.com/try-twilio
2. Crea cuenta gratuita (incluye $15 de crédito)
3. Verifica tu número de teléfono

## 📱 Paso 2: Comprar Número Telefónico

1. **Console Twilio** → **Phone Numbers** → **Manage** → **Buy a number**
2. **Country**: United States
3. **Capabilities**: ✅ Voice (incoming calls)
4. **Buscar** número disponible
5. **Buy this number** (~$1/mes)

## 🔧 Paso 3: Configurar Webhook

### Desplegar Azure Function primero:
```powershell
# Compilar y desplegar
npm run build
.\deploy-new.ps1
```

### Configurar en Twilio Console:
1. **Phone Numbers** → **Manage** → **Active numbers**
2. Click en tu número comprado
3. **Voice Configuration**:
   - **Webhook**: `https://TU-FUNCTION-APP.azurewebsites.net/api/twilioWebhook`
   - **HTTP Method**: POST
4. **Save configuration**

## 🧪 Paso 4: Probar el Sistema

### Llamar a tu número Twilio:
1. Marca el número que compraste
2. Escucha el mensaje de bienvenida
3. Di: "Necesito información sobre laptops"
4. El agente responderá con productos disponibles

### Flujo de conversación:
- **"Hola"** → Saludo personalizado
- **"Necesito laptops"** → Lista de productos
- **"Precio del LAP001"** → Información detallada
- **"Quiero 2 laptops LAP001"** → Creación de pedido
- **"Sí, confirmo"** → Pedido procesado

## ⚙️ Configuración Avanzada

### Variables de entorno adicionales:
```json
{
  "TWILIO_ACCOUNT_SID": "tu-account-sid",
  "TWILIO_AUTH_TOKEN": "tu-auth-token",
  "TWILIO_PHONE_NUMBER": "+1234567890"
}
```

### Obtener credenciales Twilio:
1. **Twilio Console** → **Account** → **API keys & tokens**
2. Copia **Account SID** y **Auth Token**

## 🔍 Debugging

### Ver logs en tiempo real:
```powershell
# Azure Functions logs
func azure functionapp logstream TU-FUNCTION-APP

# O en Azure Portal
# Function App → Functions → twilioWebhook → Monitor
```

### Probar webhook localmente:
```bash
# Usar ngrok para exponer puerto local
ngrok http 7071

# Configurar webhook temporal en Twilio:
# https://abc123.ngrok.io/api/twilioWebhook
```

## 💰 Costos Twilio

- **Número telefónico**: $1/mes
- **Llamadas entrantes**: $0.0085/minuto
- **Speech-to-Text**: $0.02/minuto
- **Text-to-Speech**: $0.04/1000 caracteres

**Ejemplo**: 100 llamadas de 2 minutos = ~$3/mes

## 🎯 Ventajas vs Azure Communication Services

- ✅ **Configuración inmediata** (sin esperar aprobaciones)
- ✅ **Números disponibles** en múltiples países
- ✅ **Speech-to-Text integrado** (sin Azure Speech Services)
- ✅ **Documentación extensa** y comunidad activa
- ✅ **Costos predecibles** y transparentes

## 🔧 Troubleshooting

**Error "Webhook timeout":**
- Verifica que la Function App esté desplegada
- Revisa logs en Azure Portal

**Error "TwiML parsing":**
- Verifica que el XML esté bien formado
- Usa herramientas de validación XML

**No se reconoce el speech:**
- Ajusta `language="es-MX"` según tu región
- Aumenta `timeout` en `<Gather>`

## 📞 Próximos Pasos

1. ✅ Comprar número Twilio
2. ✅ Desplegar Function App
3. ✅ Configurar webhook
4. ✅ Probar llamadas
5. 🔄 Integrar con ERP real
6. 📊 Configurar métricas y alertas