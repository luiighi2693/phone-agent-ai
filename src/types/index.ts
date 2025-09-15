// Tipos para Communication Services
export interface CallEvent {
  callId: string;
  from: string;
  to: string;
  eventType: 'IncomingCall' | 'CallConnected' | 'CallDisconnected' | 'RecognizeCompleted';
  timestamp: string;
  data?: any;
}

export interface AudioData {
  audioFormat: string;
  audioData: Buffer;
  sampleRate: number;
}

// Tipos para ERP
export interface ERPProduct {
  codigo: string;
  nombre: string;
  stock_disponible: number;
  precio_unitario: number;
  moneda: string;
  categoria?: string;
}

export interface ERPCustomer {
  id: string;
  nombre: string;
  telefono: string;
  email?: string;
  descuento: number;
}

export interface OrderItem {
  product_code: string;
  quantity: number;
  unit_price?: number;
}

export interface OrderRequest {
  customer_id: string;
  items: OrderItem[];
  order_date?: string;
  source?: string;
}

export interface OrderResponse {
  id: string;
  customer_id: string;
  items: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  total_amount: number;
  currency: string;
  status: string;
  order_date: string;
  source: string;
  created_at: string;
}

// Tipos para el Agente LLM
export interface ConversationContext {
  callId: string;
  customerPhone: string;
  customerInfo: ERPCustomer;
  conversationHistory: ConversationTurn[];
  currentIntent?: string;
  extractedData?: any;
}

export interface ConversationTurn {
  speaker: 'customer' | 'agent';
  text: string;
  timestamp: string;
  metadata?: any;
}

export interface AgentResponse {
  message: string;
  intent: string;
  confidence: number;
  requiresERPQuery: boolean;
  productCode?: string;
  quantity?: number;
  action?: 'query_inventory' | 'create_order' | 'get_customer_info' | 'clarify' | 'end_call';
  functionCall?: {
    name: string;
    parameters: any;
  };
}

// Tipos para Speech Services
export interface SpeechConfig {
  subscriptionKey: string;
  region: string;
  language: string;
  voiceName?: string;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  offset: number;
  duration: number;
}

// Tipos de utilidad
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  callId?: string;
  customerPhone?: string;
  metadata?: any;
  timestamp: string;
}

// Configuración del sistema
export interface SystemConfig {
  companyName: string;
  welcomeMessage: string;
  maxCallDuration: number;
  speechTimeout: number;
  retryAttempts: number;
}

// Estados de la conversación
export enum ConversationState {
  INITIALIZING = 'initializing',
  GREETING = 'greeting',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  QUERYING_ERP = 'querying_erp',
  CONFIRMING_ORDER = 'confirming_order',
  CREATING_ORDER = 'creating_order',
  ENDING = 'ending',
  ERROR = 'error'
}
