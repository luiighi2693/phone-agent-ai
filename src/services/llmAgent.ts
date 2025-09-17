import OpenAI from 'openai';
import { ConversationContext, LLMResponse, Product } from '../types';

export class LLMAgent {
  private client?: OpenAI;
  private deploymentName: string;
  private useMock: boolean;

  constructor() {
    this.useMock = !process.env.AZURE_OPENAI_KEY || process.env.USE_MOCK === 'true';
    
    if (!this.useMock) {
      this.client = new OpenAI({
        apiKey: process.env.AZURE_OPENAI_KEY,
        baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
        defaultQuery: { 'api-version': '2024-02-15-preview' },
        defaultHeaders: {
          'api-key': process.env.AZURE_OPENAI_KEY,
        },
      });
    }
    
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4-turbo';
  }

  buildWelcomeMessage(customerName: string): string {
    const companyName = process.env.COMPANY_NAME || 'nuestra empresa';
    
    if (customerName === 'Cliente') {
      return `¡Hola! Bienvenido a ${companyName}. Soy su asistente virtual y estoy aquí para ayudarle con sus pedidos. ¿En qué puedo asistirle hoy?`;
    }
    
    return `¡Hola ${customerName}! Bienvenido de nuevo a ${companyName}. Soy su asistente virtual. ¿En qué puedo ayudarle con su pedido hoy?`;
  }

  async processCustomerInput(
    context: ConversationContext,
    input: string,
    availableProducts: Product[]
  ): Promise<LLMResponse> {
    // Usar mock si no hay credenciales de Azure
    if (this.useMock) {
      return this.processMockInput(input);
    }

    try {
      const systemPrompt = this.buildSystemPrompt(context, availableProducts);
      const conversationHistory = this.buildConversationHistory(context);

      const response = await this.client!.chat.completions.create({
        model: this.deploymentName,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: input }
        ],
        temperature: 0.3,
        max_tokens: 500,
        tools: this.getToolDefinitions(),
        tool_choice: 'auto'
      });

      const message = response.choices[0].message;
      
      if (message?.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        return {
          intent: this.extractIntent(input),
          confidence: 0.8,
          message: 'Procesando su solicitud...',
          action: 'speak',
          requiresERPQuery: true,
          functionCall: {
            name: toolCall.function.name,
            parameters: JSON.parse(toolCall.function.arguments || '{}')
          }
        };
      }

      const responseText = message?.content || 'Disculpe, no pude procesar su solicitud.';
      
      return {
        intent: this.extractIntent(input),
        confidence: 0.9,
        message: responseText,
        action: this.determineAction(responseText),
        requiresERPQuery: false
      };

    } catch (error: any) {
      console.error('Error procesando con LLM:', error);
      
      return {
        intent: 'error',
        confidence: 0.1,
        message: 'Disculpe, tengo problemas técnicos temporales. ¿Podría repetir su solicitud?',
        action: 'speak',
        requiresERPQuery: false
      };
    }
  }

  private processMockInput(input: string): LLMResponse {
    const lowerInput = input.toLowerCase();
    
    // Detectar pedidos (más específico)
    if ((lowerInput.includes('pedido') || lowerInput.includes('comprar') || lowerInput.includes('quiero')) && 
        (lowerInput.includes('lap001') || lowerInput.includes('laptop'))) {
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
    
    // Detectar consulta de precio específico
    if (lowerInput.includes('lap001') || (lowerInput.includes('precio') && lowerInput.includes('lap001'))) {
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
    
    // Detectar búsqueda de productos
    if (lowerInput.includes('laptop') || lowerInput.includes('computadora') || lowerInput.includes('información')) {
      return {
        intent: 'product_search',
        confidence: 0.9,
        message: 'Procesando búsqueda...',
        action: 'speak',
        requiresERPQuery: true,
        functionCall: {
          name: 'search_products',
          parameters: { search_term: 'laptop' }
        }
      };
    }
    
    // Detectar confirmación
    if (lowerInput.includes('sí') || lowerInput.includes('confirmar') || lowerInput.includes('correcto')) {
      return {
        intent: 'confirmation',
        confidence: 0.9,
        message: 'Perfecto, procesando su confirmación...',
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
    
    // Detectar despedida
    if (lowerInput.includes('gracias') || lowerInput.includes('terminar') || lowerInput.includes('adiós')) {
      return {
        intent: 'end_conversation',
        confidence: 0.9,
        message: 'Gracias por llamar. ¡Que tenga un excelente día!',
        action: 'end_call',
        requiresERPQuery: false
      };
    }
    
    return {
      intent: 'general_inquiry',
      confidence: 0.7,
      message: 'Entiendo. ¿Podría ser más específico sobre lo que necesita? Puedo ayudarle con información de productos, precios o crear pedidos.',
      action: 'speak',
      requiresERPQuery: false
    };
  }

  private buildSystemPrompt(context: ConversationContext, products: Product[]): string {
    const companyName = process.env.COMPANY_NAME || 'la empresa';
    
    return `Eres un asistente telefónico profesional de ${companyName}. Tu trabajo es ayudar a clientes empresariales a realizar pedidos por teléfono.

INFORMACIÓN DEL CLIENTE:
- Nombre: ${context.customerInfo.nombre}
- Teléfono: ${context.customerPhone}
- Descuento: ${context.customerInfo.descuento * 100}%
- Crédito disponible: $${context.customerInfo.credito_disponible}

PRODUCTOS DISPONIBLES:
${products.slice(0, 10).map(p => `- ${p.codigo}: ${p.nombre} ($${p.precio_unitario})`).join('\n')}

INSTRUCCIONES:
1. Sé profesional, amable y eficiente
2. Ayuda al cliente a encontrar productos y crear pedidos
3. Confirma siempre los detalles antes de procesar
4. Si no entiendes algo, pide aclaración
5. Usa las funciones disponibles para consultar productos y crear pedidos
6. Mantén las respuestas concisas para conversación telefónica
7. Siempre confirma el pedido antes de enviarlo al ERP

FLUJO TÍPICO:
1. Saludo y identificación de necesidades
2. Búsqueda/consulta de productos
3. Confirmación de cantidades y precios
4. Creación del pedido
5. Confirmación final y despedida`;
  }

  private buildConversationHistory(context: ConversationContext): Array<{role: 'user' | 'assistant', content: string}> {
    return context.conversationHistory.slice(-6).map(turn => ({
      role: turn.speaker === 'customer' ? 'user' : 'assistant',
      content: turn.text
    }));
  }

  private getToolDefinitions() {
    return [
      {
        type: 'function' as const,
        function: {
          name: 'query_product_info',
          description: 'Consultar información detallada de un producto específico',
          parameters: {
            type: 'object',
            properties: {
              product_code: {
                type: 'string',
                description: 'Código del producto a consultar'
              }
            },
            required: ['product_code']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'search_products',
          description: 'Buscar productos por nombre o descripción',
          parameters: {
            type: 'object',
            properties: {
              search_term: {
                type: 'string',
                description: 'Término de búsqueda para encontrar productos'
              }
            },
            required: ['search_term']
          }
        }
      },
      {
        type: 'function' as const,
        function: {
          name: 'create_order_draft',
          description: 'Crear un borrador de pedido con los productos seleccionados',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    product_code: { type: 'string' },
                    quantity: { type: 'number' }
                  },
                  required: ['product_code', 'quantity']
                }
              }
            },
            required: ['items']
          }
        }
      }
    ];
  }

  private extractIntent(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('precio') || lowerInput.includes('costo') || lowerInput.includes('cuánto')) {
      return 'price_inquiry';
    }
    if (lowerInput.includes('stock') || lowerInput.includes('disponible') || lowerInput.includes('hay')) {
      return 'stock_inquiry';
    }
    if (lowerInput.includes('pedido') || lowerInput.includes('orden') || lowerInput.includes('comprar')) {
      return 'order_creation';
    }
    if (lowerInput.includes('buscar') || lowerInput.includes('necesito') || lowerInput.includes('quiero')) {
      return 'product_search';
    }
    if (lowerInput.includes('confirmar') || lowerInput.includes('sí') || lowerInput.includes('correcto')) {
      return 'confirmation';
    }
    if (lowerInput.includes('cancelar') || lowerInput.includes('no') || lowerInput.includes('terminar')) {
      return 'cancellation';
    }
    
    return 'general_inquiry';
  }

  private determineAction(responseText: string): 'speak' | 'end_call' | 'transfer' {
    const lowerResponse = responseText.toLowerCase();
    
    if (lowerResponse.includes('gracias por llamar') || 
        lowerResponse.includes('que tenga buen día') ||
        lowerResponse.includes('hasta luego')) {
      return 'end_call';
    }
    
    return 'speak';
  }
}