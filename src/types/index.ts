// Tipos para el contexto de conversación
export interface ConversationContext {
  callId: string;
  customerPhone: string;
  customerInfo: CustomerInfo;
  conversationHistory: ConversationTurn[];
  currentIntent?: string;
  orderDraft?: OrderDraft;
}

export interface ConversationTurn {
  speaker: 'customer' | 'agent';
  text: string;
  timestamp: string;
  metadata?: {
    intent?: string;
    confidence?: number;
    action?: string;
  };
}

export interface ConversationState {
  phase: 'greeting' | 'product_inquiry' | 'order_creation' | 'confirmation' | 'closing';
  context: Record<string, any>;
}

// Tipos para información del cliente
export interface CustomerInfo {
  id: string;
  nombre: string;
  telefono: string;
  email?: string;
  empresa?: string;
  descuento: number;
  credito_disponible: number;
  historial_pedidos?: number;
}

// Tipos para productos
export interface Product {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  precio_unitario: number;
  stock_disponible: number;
  categoria: string;
  activo: boolean;
}

// Tipos para pedidos
export interface OrderItem {
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface OrderDraft {
  customer_id: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: 'draft' | 'confirmed' | 'sent_to_erp';
}

export interface OrderValidation {
  valid: boolean;
  errors: string[];
  validatedItems: OrderItem[];
}

// Tipos para respuestas del LLM
export interface LLMResponse {
  intent: string;
  confidence: number;
  message: string;
  action: 'speak' | 'end_call' | 'transfer';
  requiresERPQuery: boolean;
  functionCall?: {
    name: string;
    parameters: Record<string, any>;
  };
}

// Tipos para configuración
export interface AzureConfig {
  openai: {
    endpoint: string;
    key: string;
    deploymentName: string;
  };
  speech: {
    key: string;
    region: string;
  };
  communication: {
    connectionString: string;
    phoneNumber: string;
  };
}