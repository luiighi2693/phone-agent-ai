import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { ERPConnector } from '../../services/erpConnector';
import { LLMAgent } from '../../services/llmAgent';
import { ConversationContext, ConversationState, ConversationTurn } from '../../types';

// Store temporal para mantener contexto de conversaciones
// En producción, usar Azure Cosmos DB o Table Storage
const conversationStore = new Map<string, ConversationContext>();

export async function callHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('📞 Nueva solicitud recibida');
  
  try {
    // Detectar si es request de Twilio (form-encoded)
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return await handleTwilioRequest(request, context);
    }
    
    // Parsear el cuerpo de la solicitud (Azure)
    const body = await request.json() as any;
    const { callId, customerPhone, transcribedText, eventType } = body;

    if (!callId || !customerPhone) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: 'callId y customerPhone son requeridos'
        }
      };
    }

    // Manejar diferentes tipos de eventos
    switch (eventType) {
      case 'CallConnected':
        return await handleCallConnected(callId, customerPhone, context);
      
      case 'RecognizeCompleted':
        return await handleSpeechRecognized(callId, customerPhone, transcribedText, context);
      
      case 'CallDisconnected':
        return await handleCallDisconnected(callId, context);
      
      default:
        return await handleGeneralRequest(callId, customerPhone, transcribedText, context);
    }

  } catch (error: any) {
    context.error('❌ Error en callHandler:', error);
    
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Error interno del servidor',
        message: 'Disculpe, tenemos problemas técnicos temporales.'
      }
    };
  }
}

async function handleCallConnected(callId: string, customerPhone: string, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`🔗 Llamada conectada: ${callId} desde ${customerPhone}`);
  
  try {
    // Inicializar servicios
    const erpConnector = new ERPConnector();
    const llmAgent = new LLMAgent();

    // Obtener información del cliente
    const customerInfo = await erpConnector.getCustomerByPhone(customerPhone);
    
    // Crear contexto de conversación
    const conversationContext: ConversationContext = {
      callId,
      customerPhone,
      customerInfo,
      conversationHistory: [],
      currentIntent: 'greeting'
    };

    // Guardar contexto
    conversationStore.set(callId, conversationContext);

    // Generar mensaje de bienvenida
    const welcomeMessage = llmAgent.buildWelcomeMessage(customerInfo.nombre);
    
    // Agregar al historial
    conversationContext.conversationHistory.push({
      speaker: 'agent',
      text: welcomeMessage,
      timestamp: new Date().toISOString()
    });

    context.log(`👋 Mensaje de bienvenida generado para ${customerInfo.nombre}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        action: 'speak',
        message: welcomeMessage,
        callId,
        customerInfo: {
          name: customerInfo.nombre,
          isKnownCustomer: customerInfo.id !== 'GUEST'
        }
      }
    };

  } catch (error: any) {
    context.error('❌ Error manejando conexión de llamada:', error);
    
    const fallbackMessage = "Bienvenido, gracias por llamar. ¿En qué puedo ayudarle hoy?";
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        action: 'speak',
        message: fallbackMessage,
        callId
      }
    };
  }
}

async function handleSpeechRecognized(callId: string, customerPhone: string, transcribedText: string, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`🎤 Texto reconocido en ${callId}: "${transcribedText}"`);

  if (!transcribedText || transcribedText.trim().length === 0) {
    return {
      status: 200,
      jsonBody: {
        success: true,
        action: 'speak',
        message: "No pude escuchar claramente. ¿Podría repetir por favor?",
        callId
      }
    };
  }

  try {
    // Obtener o crear contexto de conversación
    let conversationContext = conversationStore.get(callId);
    
    if (!conversationContext) {
      // Si no existe contexto, crear uno básico
      const erpConnector = new ERPConnector();
      const customerInfo = await erpConnector.getCustomerByPhone(customerPhone);
      
      conversationContext = {
        callId,
        customerPhone,
        customerInfo,
        conversationHistory: []
      };
      
      conversationStore.set(callId, conversationContext);
    }

    // Agregar input del cliente al historial
    const customerTurn: ConversationTurn = {
      speaker: 'customer',
      text: transcribedText,
      timestamp: new Date().toISOString()
    };
    
    conversationContext.conversationHistory.push(customerTurn);

    // Procesar con el agente LLM
    const llmAgent = new LLMAgent();
    const erpConnector = new ERPConnector();

    // Obtener productos disponibles para contexto
    const availableProducts = await erpConnector.getAllProducts();
    
    const agentResponse = await llmAgent.processCustomerInput(
      conversationContext,
      transcribedText,
      availableProducts
    );

    context.log(`🤖 Respuesta del agente: ${agentResponse.intent} (${agentResponse.confidence})`);

    // Procesar acciones requeridas
    let finalMessage = agentResponse.message;
    let additionalData: any = {};

    if (agentResponse.requiresERPQuery && agentResponse.functionCall) {
      const erpResult = await handleERPFunction(agentResponse.functionCall, erpConnector, conversationContext, context);
      finalMessage = erpResult.message;
      additionalData = erpResult.data;
    }

    // Agregar respuesta del agente al historial
    const agentTurn: ConversationTurn = {
      speaker: 'agent',
      text: finalMessage,
      timestamp: new Date().toISOString(),
      metadata: {
        intent: agentResponse.intent,
        confidence: agentResponse.confidence,
        action: agentResponse.action
      }
    };
    
    conversationContext.conversationHistory.push(agentTurn);
    conversationContext.currentIntent = agentResponse.intent;

    // Determinar próxima acción
    let nextAction = 'speak';
    if (agentResponse.action === 'end_call') {
      nextAction = 'hangup';
      conversationStore.delete(callId); // Limpiar contexto
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        action: nextAction,
        message: finalMessage,
        callId,
        intent: agentResponse.intent,
        confidence: agentResponse.confidence,
        ...additionalData
      }
    };

  } catch (error: any) {
    context.error('❌ Error procesando speech:', error);
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        action: 'speak',
        message: "Disculpe, no pude procesar su solicitud. ¿Podría intentarlo de nuevo?",
        callId
      }
    };
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
          message: `El producto ${product.nombre} (${product.codigo}) está disponible. Precio: $${product.precio_unitario}, Stock disponible: ${product.stock_disponible} unidades. ¿Cuántas unidades necesita?`,
          data: { 
            productFound: true, 
            product: product 
          }
        };

      case 'search_products':
        const searchResults = await erpConnector.searchProducts(parameters.search_term);
        
        if (searchResults.length === 0) {
          return {
            message: `No encontré productos relacionados con "${parameters.search_term}". ¿Podría ser más específico o probar con otro término?`,
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
            message: `Hay algunos problemas con su pedido: ${validation.errors.join(', ')}. ¿Desea ajustar las cantidades?`,
            data: { orderValid: false, errors: validation.errors }
          };
        }

        // Calcular total
        const subtotal = validation.validatedItems.reduce((sum, item) => 
          sum + (item.quantity * item.unit_price), 0
        );
        
        const discount = subtotal * context.customerInfo.descuento;
        const total = subtotal - discount;

        let orderSummary = `Su pedido: ${validation.validatedItems.map(item => 
          `${item.quantity} x ${item.product_name}`
        ).join(', ')}. `;
        
        orderSummary += `Subtotal: $${subtotal.toFixed(2)}`;
        
        if (discount > 0) {
          orderSummary += `, Descuento: $${discount.toFixed(2)}`;
        }
        
        orderSummary += `. Total: $${total.toFixed(2)}. ¿Confirma este pedido?`;

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

async function handleCallDisconnected(callId: string, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`📴 Llamada desconectada: ${callId}`);
  
  // Limpiar contexto de conversación
  const conversationContext = conversationStore.get(callId);
  if (conversationContext) {
    context.log(`📊 Llamada completada - Turnos de conversación: ${conversationContext.conversationHistory.length}`);
    conversationStore.delete(callId);
  }

  return {
    status: 200,
    jsonBody: {
      success: true,
      message: 'Llamada finalizada',
      callId
    }
  };
}

async function handleGeneralRequest(callId: string, customerPhone: string, input: string, context: InvocationContext): Promise<HttpResponseInit> {
  // Fallback para requests generales
  return await handleSpeechRecognized(callId, customerPhone, input, context);
}

async function handleTwilioRequest(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('📞 Webhook de Twilio recibido');
  
  try {
    // Parsear datos de Twilio (form-encoded)
    const body = await request.text();
    const params = new URLSearchParams(body);
    
    const callSid = params.get('CallSid');
    const from = params.get('From');
    const speechResult = params.get('SpeechResult');
    
    context.log(`📱 Llamada: ${callSid} de ${from}`);
    
    // Si es una nueva llamada
    if (!speechResult) {
      return generateTwiMLResponse("Bienvenido, gracias por llamar. ¿En qué puedo ayudarle hoy?", true);
    }
    
    // Si hay resultado de speech-to-text, procesar con el agente
    if (speechResult) {
      const erpConnector = new ERPConnector();
      const llmAgent = new LLMAgent();
      
      const customerInfo = await erpConnector.getCustomerByPhone(from!);
      const availableProducts = await erpConnector.getAllProducts();
      
      const conversationContext: ConversationContext = {
        callId: callSid!,
        customerPhone: from!,
        customerInfo,
        conversationHistory: []
      };
      
      const agentResponse = await llmAgent.processCustomerInput(
        conversationContext,
        speechResult,
        availableProducts
      );
      
      let finalMessage = agentResponse.message;
      
      if (agentResponse.requiresERPQuery && agentResponse.functionCall) {
        const erpResult = await handleERPFunction(agentResponse.functionCall, erpConnector, conversationContext, context);
        finalMessage = erpResult.message;
      }
      
      const shouldContinue = agentResponse.action !== 'end_call';
      return generateTwiMLResponse(finalMessage, shouldContinue);
    }
    
    return generateTwiMLResponse("Lo siento, no pude procesar su solicitud.");
    
  } catch (error: any) {
    context.error('❌ Error en Twilio webhook:', error);
    return generateTwiMLResponse("Disculpe, tenemos problemas técnicos temporales.");
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

// Registrar la función con Azure Functions
app.http('callHandler', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: callHandler
});
