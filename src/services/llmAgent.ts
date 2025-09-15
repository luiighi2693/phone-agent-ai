import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { ConversationContext, AgentResponse, ERPProduct } from '../types';

export class LLMAgent {
  private client: OpenAIClient;
  private deploymentName: string;
  private companyName: string;

  constructor() {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT!;
    const apiKey = process.env.AZURE_OPENAI_KEY!;
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4-turbo';
    this.companyName = process.env.COMPANY_NAME || 'Su Empresa';

    this.client = new OpenAIClient(endpoint, new AzureKeyCredential(apiKey));
  }

  async processCustomerInput(
    context: ConversationContext, 
    userInput: string,
    availableProducts?: ERPProduct[]
  ): Promise<AgentResponse> {
    try {
      const systemPrompt = this.buildSystemPrompt(context, availableProducts);
      const conversationHistory = this.buildConversationHistory(context, userInput);

      const response = await this.client.getChatCompletions(
        this.deploymentName,
        conversationHistory,
        {
          maxTokens: 800,
          temperature: 0.3,
          topP: 0.9,
          functions: this.getFunctionDefinitions(),
          functionCall: 'auto'
        }
      );

      const choice = response.choices[0];
      
      if (choice.message?.functionCall) {
        return this.parseFunctionCall(choice.message.functionCall);
      }

      return this.parseTextResponse(choice.message?.content || 'Lo siento, no pude procesar su solicitud.');
      
    } catch (error: any) {
      console.error('Error en LLM Agent:', error);
      return {
        message: 'Disculpe, tenemos problemas técnicos temporales. ¿Podría repetir su solicitud?',
        intent: 'error',
        confidence: 0,
        requiresERPQuery: false,
        action: 'clarify'
      };
    }
  }

  private buildSystemPrompt(context: ConversationContext, availableProducts?: ERPProduct[]): string {
    const productList = availableProducts 
      ? availableProducts.slice(0, 10).map(p => `- ${p.codigo}: ${p.nombre} ($${p.precio_unitario}, Stock: ${p.stock_disponible})`).join('\n')
      : '';

    return `Eres un asistente telefónico especializado en tomar pedidos para ${this.companyName}.

INFORMACIÓN DEL CLIENTE:
- Nombre: ${context.customerInfo.nombre}
- Teléfono: ${context.customerInfo.telefono}
- Descuento aplicable: ${(context.customerInfo.descuento * 100).toFixed(0)}%

${productList ? `PRODUCTOS DISPONIBLES:\n${productList}` : ''}

INSTRUCCIONES:
1. Mantén un tono profesional pero amigable
2. Si es el inicio de la conversación, saluda al cliente por su nombre
3. Identifica la intención del cliente: consultar precios, verificar stock, hacer pedido
4. Para pedidos, captura: código del producto, cantidad, especificaciones
5. Siempre confirma los detalles antes de procesar
6. Si no entiendes algo, pide aclaración educadamente
7. Al finalizar un pedido, proporciona un resumen completo

IMPORTANTE:
- Usa los códigos de producto exactos (ej: ABC-123)
- Confirma disponibilidad antes de comprometerte
- Calcula totales incluyendo descuentos si aplican
- Mantén las respuestas concisas pero completas`;
  }

  private buildConversationHistory(context: ConversationContext, userInput: string) {
    const messages = [
      { role: 'system', content: this.buildSystemPrompt(context) }
    ];

    // Agregar historial de conversación
    context.conversationHistory.forEach(turn => {
      messages.push({
        role: turn.speaker === 'customer' ? 'user' : 'assistant',
        content: turn.text
      });
    });

    // Agregar input actual del usuario
    messages.push({
      role: 'user',
      content: userInput
    });

    return messages;
  }

  private getFunctionDefinitions() {
    return [
      {
        name: 'query_product_info',
        description: 'Consulta información de un producto específico en el inventario',
        parameters: {
          type: 'object',
          properties: {
            product_code: {
              type: 'string',
              description: 'Código del producto a consultar (ej: ABC-123)'
            }
          },
          required: ['product_code']
        }
      },
      {
        name: 'search_products',
        description: 'Busca productos por nombre o descripción',
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
      },
      {
        name: 'create_order_draft',
        description: 'Crea un borrador de pedido con los productos y cantidades especificados',
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
                }
              }
            },
            customer_notes: {
              type: 'string',
              description: 'Notas adicionales del cliente'
            }
          },
          required: ['items']
        }
      },
      {
        name: 'calculate_order_total',
        description: 'Calcula el total de un pedido incluyendo descuentos',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_code: { type: 'string' },
                  quantity: { type: 'number' },
                  unit_price: { type: 'number' }
                }
              }
            },
            customer_discount: {
              type: 'number',
              description: 'Porcentaje de descuento del cliente (0.1 = 10%)'
            }
          },
          required: ['items']
        }
      }
    ];
  }

  private parseFunctionCall(functionCall: any): AgentResponse {
    const { name, arguments: args } = functionCall;
    const parameters = JSON.parse(args);

    switch (name) {
      case 'query_product_info':
        return {
          message: `Consultando información del producto ${parameters.product_code}...`,
          intent: 'query_product',
          confidence: 0.9,
          requiresERPQuery: true,
          productCode: parameters.product_code,
          action: 'query_inventory',
          functionCall: { name, parameters }
        };

      case 'search_products':
        return {
          message: `Buscando productos relacionados con "${parameters.search_term}"...`,
          intent: 'search_products',
          confidence: 0.8,
          requiresERPQuery: true,
          action: 'query_inventory',
          functionCall: { name, parameters }
        };

      case 'create_order_draft':
        return {
          message: 'Preparando su pedido...',
          intent: 'create_order',
          confidence: 0.9,
          requiresERPQuery: true,
          action: 'create_order',
          functionCall: { name, parameters }
        };

      case 'calculate_order_total':
        return {
          message: 'Calculando el total de su pedido...',
          intent: 'calculate_total',
          confidence: 0.9,
          requiresERPQuery: false,
          action: 'clarify',
          functionCall: { name, parameters }
        };

      default:
        return this.parseTextResponse('Procesando su solicitud...');
    }
  }

  private parseTextResponse(content: string): AgentResponse {
    // Análisis simple de intención basado en palabras clave
    const lowerContent = content.toLowerCase();
    
    let intent = 'general';
    let action: AgentResponse['action'] = 'clarify';
    let requiresERPQuery = false;

    if (lowerContent.includes('pedido') || lowerContent.includes('orden') || lowerContent.includes('comprar')) {
      intent = 'order_intent';
      action = 'clarify';
    } else if (lowerContent.includes('precio') || lowerContent.includes('costo')) {
      intent = 'price_inquiry';
      requiresERPQuery = true;
      action = 'query_inventory';
    } else if (lowerContent.includes('stock') || lowerContent.includes('disponible')) {
      intent = 'stock_inquiry';
      requiresERPQuery = true;
      action = 'query_inventory';
    } else if (lowerContent.includes('adiós') || lowerContent.includes('terminar') || lowerContent.includes('gracias')) {
      intent = 'end_conversation';
      action = 'end_call';
    }

    return {
      message: content,
      intent,
      confidence: 0.7,
      requiresERPQuery,
      action
    };
  }

  buildWelcomeMessage(customerName: string): string {
    const welcomeMessages = [
      `¡Hola ${customerName}! Gracias por llamar a ${this.companyName}. Soy su asistente virtual y estoy aquí para ayudarle con sus pedidos. ¿En qué puedo asistirle hoy?`,
      `Buenos días ${customerName}, bienvenido a ${this.companyName}. Soy su asistente para pedidos telefónicos. ¿Cómo puedo ayudarle?`,
      `Hola ${customerName}, gracias por contactar a ${this.companyName}. Estoy listo para tomar su pedido o responder sus consultas. ¿Qué necesita hoy?`
    ];

    return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  }

  buildOrderSummary(orderData: any, customerDiscount: number = 0): string {
    const items = orderData.items.map((item: any) => 
      `- ${item.product_name}: ${item.quantity} unidades a $${item.unit_price} c/u = $${item.total_price}`
    ).join('\n');

    const subtotal = orderData.total_amount;
    const discount = subtotal * customerDiscount;
    const total = subtotal - discount;

    let summary = `Resumen de su pedido:\n${items}\n\nSubtotal: $${subtotal.toFixed(2)}`;
    
    if (discount > 0) {
      summary += `\nDescuento (${(customerDiscount * 100).toFixed(0)}%): -$${discount.toFixed(2)}`;
    }
    
    summary += `\nTotal: $${total.toFixed(2)}\n\n¿Confirma este pedido?`;
    
    return summary;
  }
}
