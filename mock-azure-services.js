// Mock de servicios Azure para pruebas locales sin credenciales reales

class MockLLMAgent {
  buildWelcomeMessage(customerName) {
    if (customerName === 'Cliente') {
      return "¡Hola! Bienvenido a nuestra empresa. Soy su asistente virtual. ¿En qué puedo ayudarle hoy?";
    }
    return `¡Hola ${customerName}! Bienvenido de nuevo. ¿En qué puedo ayudarle con su pedido hoy?`;
  }

  async processCustomerInput(context, input, availableProducts) {
    const lowerInput = input.toLowerCase();
    
    // Simular respuestas basadas en el input
    if (lowerInput.includes('laptop') || lowerInput.includes('computadora')) {
      return {
        intent: 'product_search',
        confidence: 0.9,
        message: 'Procesando búsqueda de laptops...',
        action: 'speak',
        requiresERPQuery: true,
        functionCall: {
          name: 'search_products',
          parameters: { search_term: 'laptop' }
        }
      };
    }
    
    if (lowerInput.includes('lap001') || lowerInput.includes('precio')) {
      return {
        intent: 'price_inquiry',
        confidence: 0.9,
        message: 'Consultando información del producto...',
        action: 'speak',
        requiresERPQuery: true,
        functionCall: {
          name: 'query_product_info',
          parameters: { product_code: 'LAP001' }
        }
      };
    }
    
    if (lowerInput.includes('pedido') || lowerInput.includes('comprar')) {
      return {
        intent: 'order_creation',
        confidence: 0.9,
        message: 'Creando borrador de pedido...',
        action: 'speak',
        requiresERPQuery: true,
        functionCall: {
          name: 'create_order_draft',
          parameters: {
            items: [{ product_code: 'LAP001', quantity: 2 }]
          }
        }
      };
    }
    
    if (lowerInput.includes('gracias') || lowerInput.includes('terminar')) {
      return {
        intent: 'end_conversation',
        confidence: 0.9,
        message: 'Gracias por llamar. ¡Que tenga un excelente día!',
        action: 'end_call',
        requiresERPQuery: false
      };
    }
    
    // Respuesta genérica
    return {
      intent: 'general_inquiry',
      confidence: 0.7,
      message: 'Entiendo. ¿Podría ser más específico sobre lo que necesita? Puedo ayudarle con información de productos, precios o crear pedidos.',
      action: 'speak',
      requiresERPQuery: false
    };
  }
}

// Función para verificar si usar mock o servicios reales
function shouldUseMock() {
  return !process.env.AZURE_OPENAI_KEY || process.env.USE_MOCK === 'true';
}

module.exports = {
  MockLLMAgent,
  shouldUseMock
};