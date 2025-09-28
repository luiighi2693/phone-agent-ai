import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ERPConnector } from '../../services/erpConnector';
import { LLMAgent } from '../../services/llmAgent';
import { ConversationContext, ConversationTurn } from '../../types';

// Store temporal para conversaciones
const conversationStore = new Map<string, ConversationContext>();

export async function twilioWebhook(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('📞 Webhook de Twilio recibido');
  
  try {
    // Parsear datos de Twilio (form-encoded)
    const body = await request.text();
    const params = new URLSearchParams(body);
    
    const callSid = params.get('CallSid');
    const from = params.get('From');
    const to = params.get('To');
    const speechResult = params.get('SpeechResult');
    const digits = params.get('Digits');
    
    context.log(`📱 Llamada: ${callSid} de ${from} a ${to}`);
    
    // Si es una nueva llamada
    if (!speechResult && !digits) {
      return await handleNewCall(callSid!, from!, context);
    }
    
    // Si hay resultado de speech-to-text
    if (speechResult) {
      return await handleSpeechInput(callSid!, from!, speechResult, context);
    }
    
    // Fallback
    return generateTwiMLResponse("Lo siento, no pude procesar su solicitud. Por favor intente de nuevo.");
    
  } catch (error: any) {
    context.error('❌ Error en Twilio webhook:', error);
    return generateTwiMLResponse("Disculpe, tenemos problemas técnicos temporales.");
  }
}

async function handleNewCall(callSid: string, customerPhone: string, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`🔗 Nueva llamada: ${callSid} desde ${customerPhone}`);
  
  try {
    // Inicializar servicios
    const erpConnector = new ERPConnector();
    const llmAgent = new LLMAgent();

    // Obtener información del cliente
    const customerInfo = await erpConnector.getCustomerByPhone(customerPhone);
    
    // Crear contexto de conversación
    const conversationContext: ConversationContext = {
      callId: callSid,
      customerPhone,
      customerInfo,
      conversationHistory: [],
      currentIntent: 'greeting'
    };

    // Guardar contexto
    conversationStore.set(callSid, conversationContext);

    // Generar mensaje de bienvenida
    const welcomeMessage = llmAgent.buildWelcomeMessage(customerInfo.nombre);
    
    // Agregar al historial
    conversationContext.conversationHistory.push({
      speaker: 'agent',
      text: welcomeMessage,
      timestamp: new Date().toISOString()
    });

    context.log(`👋 Mensaje de bienvenida para ${customerInfo.nombre}`);

    return generateTwiMLResponse(welcomeMessage, true);

  } catch (error: any) {
    context.error('❌ Error manejando nueva llamada:', error);
    const fallbackMessage = "Bienvenido, gracias por llamar. ¿En qué puedo ayudarle hoy?";
    return generateTwiMLResponse(fallbackMessage, true);
  }
}

async function handleSpeechInput(callSid: string, customerPhone: string, speechText: string, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`🎤 Speech reconocido: "${speechText}"`);

  if (!speechText || speechText.trim().length === 0) {
    return generateTwiMLResponse("No pude escuchar claramente. ¿Podría repetir por favor?", true);
  }

  try {
    // Obtener contexto de conversación
    let conversationContext = conversationStore.get(callSid);
    
    if (!conversationContext) {
      // Si no existe contexto, crear uno básico
      const erpConnector = new ERPConnector();
      const customerInfo = await erpConnector.getCustomerByPhone(customerPhone);
      
      conversationContext = {
        callId: callSid,
        customerPhone,
        customerInfo,
        conversationHistory: []
      };
      
      conversationStore.set(callSid, conversationContext);
    }

    // Agregar input del cliente al historial
    conversationContext.conversationHistory.push({
      speaker: 'customer',
      text: speechText,
      timestamp: new Date().toISOString()
    });

    // Procesar con el agente LLM
    const llmAgent = new LLMAgent();
    const erpConnector = new ERPConnector();

    // Obtener productos disponibles para contexto
    const availableProducts = await erpConnector.getAllProducts();
    
    const agentResponse = await llmAgent.processCustomerInput(
      conversationContext,
      speechText,
      availableProducts
    );

    context.log(`🤖 Respuesta del agente: ${agentResponse.intent}`);

    // Procesar acciones requeridas
    let finalMessage = agentResponse.message;

    if (agentResponse.requiresERPQuery && agentResponse.functionCall) {
      const erpResult = await handleERPFunction(agentResponse.functionCall, erpConnector, conversationContext, context);
      finalMessage = erpResult.message;
    }

    // Agregar respuesta del agente al historial
    conversationContext.conversationHistory.push({
      speaker: 'agent',
      text: finalMessage,
      timestamp: new Date().toISOString(),
      metadata: {
        intent: agentResponse.intent,
        confidence: agentResponse.confidence,
        action: agentResponse.action
      }
    });

    conversationContext.currentIntent = agentResponse.intent;

    // Determinar si continuar o terminar
    const shouldContinue = agentResponse.action !== 'end_call';
    
    if (!shouldContinue) {
      conversationStore.delete(callSid); // Limpiar contexto
    }

    return generateTwiMLResponse(finalMessage, shouldContinue);

  } catch (error: any) {
    context.error('❌ Error procesando speech:', error);
    return generateTwiMLResponse("Disculpe, no pude procesar su solicitud. ¿Podría intentarlo de nuevo?", true);
  }
}

async function handleERPFunction(functionCall: any, erpConnector: ERPConnector, context: ConversationContext, logContext: InvocationContext): Promise<{message: string, data: any}> {
  const { name, parameters } = functionCall;
  
  try {
    switch (name) {
      case 'query_product_info':
        const product = await erpConnector.getProduct(parameters.product_code);
        
        if (!product) {
          return {
            message: `Lo siento, no encontré el producto ${parameters.product_code}. ¿Podría verificar el código o decirme el nombre del producto?`,
            data: { productFound: false }
          };
        }

        return {
          message: `El producto ${product.nombre} está disponible. Precio: $${product.precio_unitario}, Stock: ${product.stock_disponible} unidades. ¿Cuántas unidades necesita?`,
          data: { productFound: true, product: product }
        };

      case 'search_products':
        const searchResults = await erpConnector.searchProducts(parameters.search_term);
        
        if (searchResults.length === 0) {
          return {
            message: `No encontré productos relacionados con "${parameters.search_term}". ¿Podría ser más específico?`,
            data: { searchResults: [] }
          };
        }

        const resultsList = searchResults.slice(0, 3).map(p => 
          `${p.codigo}: ${p.nombre} - $${p.precio_unitario}`
        ).join(', ');

        return {
          message: `Encontré estos productos: ${resultsList}. ¿Cuál le interesa?`,
          data: { searchResults: searchResults }
        };

      case 'create_order_draft':
        const validation = await erpConnector.validateOrderItems(parameters.items);
        
        if (!validation.valid) {
          return {
            message: `Hay problemas con su pedido: ${validation.errors.join(', ')}. ¿Desea ajustar las cantidades?`,
            data: { orderValid: false, errors: validation.errors }
          };
        }

        const subtotal = validation.validatedItems.reduce((sum, item) => 
          sum + (item.quantity * item.unit_price), 0
        );
        
        const discount = subtotal * context.customerInfo.descuento;
        const total = subtotal - discount;

        let orderSummary = `Su pedido: ${validation.validatedItems.map(item => 
          `${item.quantity} ${item.product_name}`
        ).join(', ')}. `;
        
        orderSummary += `Total: $${total.toFixed(2)}. ¿Confirma este pedido?`;

        return {
          message: orderSummary,
          data: { 
            orderValid: true,
            orderItems: validation.validatedItems,
            totals: { subtotal, discount, total }
          }
        };

      default:
        return {
          message: "Procesando su solicitud...",
          data: {}
        };
    }
  } catch (error: any) {
    logContext.error(`❌ Error en función ERP ${name}:`, error);
    return {
      message: "Disculpe, tuve un problema consultando nuestro sistema. ¿Podría intentar de nuevo?",
      data: { error: error.message }
    };
  }
}

function generateTwiMLResponse(message: string, continueListening: boolean = false): HttpResponseInit {
  let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="es-MX">${message}</Say>`;

  if (continueListening) {
    twiml += `
  <Gather input="speech" timeout="10" speechTimeout="auto" language="es-MX">
    <Say voice="alice" language="es-MX">Por favor, dígame en qué puedo ayudarle.</Say>
  </Gather>`;
  } else {
    twiml += `
  <Hangup/>`;
  }

  twiml += `
</Response>`;

  return {
    status: 200,
    headers: {
      'Content-Type': 'application/xml'
    },
    body: twiml
  };
}

// Registrar la función
app.http('twilioWebhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: twilioWebhook
});