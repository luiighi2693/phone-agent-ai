import axios, { AxiosInstance } from 'axios';
import { ERPProduct, ERPCustomer, OrderRequest, OrderResponse, APIResponse } from '../types';

export class ERPConnector {
  private client: AxiosInstance;
  private baseURL: string;
  private token: string;

  constructor() {
    this.baseURL = process.env.ERP_API_BASE_URL || 'http://localhost:3001/api';
    this.token = process.env.ERP_API_TOKEN || 'demo-erp-token-12345';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000, // 10 seconds
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    // Interceptor para logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`ERP Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`ERP Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        console.error(`ERP Error: ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'OK';
    } catch (error) {
      console.error('ERP Health check failed:', error);
      return false;
    }
  }

  async getProduct(productCode: string): Promise<ERPProduct | null> {
    try {
      const response = await this.client.get(`/inventory/${productCode}`);
      
      if (response.data.success) {
        return response.data.data as ERPProduct;
      }
      
      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`Producto ${productCode} no encontrado`);
        return null;
      }
      
      console.error(`Error consultando producto ${productCode}:`, error.message);
      throw new Error(`No se pudo consultar el producto: ${error.message}`);
    }
  }

  async searchProducts(query: string): Promise<ERPProduct[]> {
    try {
      const response = await this.client.get('/products/search', {
        params: { q: query }
      });
      
      if (response.data.success) {
        return response.data.data as ERPProduct[];
      }
      
      return [];
    } catch (error: any) {
      console.error(`Error buscando productos con "${query}":`, error.message);
      return [];
    }
  }

  async getAllProducts(): Promise<ERPProduct[]> {
    try {
      const response = await this.client.get('/inventory');
      
      if (response.data.success) {
        return response.data.data as ERPProduct[];
      }
      
      return [];
    } catch (error: any) {
      console.error('Error obteniendo inventario completo:', error.message);
      return [];
    }
  }

  async getCustomerByPhone(phone: string): Promise<ERPCustomer> {
    try {
      const response = await this.client.get(`/customers/${phone}`);
      
      if (response.data.success) {
        return response.data.data as ERPCustomer;
      }
      
      // Retornar cliente invitado por defecto
      return {
        id: 'GUEST',
        nombre: 'Cliente Invitado',
        telefono: phone,
        descuento: 0
      };
    } catch (error: any) {
      console.error(`Error obteniendo cliente ${phone}:`, error.message);
      
      // Retornar cliente invitado en caso de error
      return {
        id: 'GUEST',
        nombre: 'Cliente Invitado',
        telefono: phone,
        descuento: 0
      };
    }
  }

  async createOrder(orderData: OrderRequest): Promise<OrderResponse> {
    try {
      const payload = {
        customer_id: orderData.customer_id,
        items: orderData.items,
        order_date: orderData.order_date || new Date().toISOString(),
        source: orderData.source || 'phone_agent'
      };

      const response = await this.client.post('/orders', payload);
      
      if (response.data.success) {
        return response.data.data as OrderResponse;
      }
      
      throw new Error(response.data.error || 'Error desconocido creando orden');
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      
      console.error('Error creando orden:', error.message);
      throw new Error(`No se pudo crear la orden: ${error.message}`);
    }
  }

  async getCustomerOrders(customerId: string, limit: number = 5): Promise<OrderResponse[]> {
    try {
      const response = await this.client.get('/orders', {
        params: { 
          customer_id: customerId,
          limit 
        }
      });
      
      if (response.data.success) {
        return response.data.data as OrderResponse[];
      }
      
      return [];
    } catch (error: any) {
      console.error(`Error obteniendo órdenes del cliente ${customerId}:`, error.message);
      return [];
    }
  }

  // Método para verificar múltiples productos de una vez
  async validateOrderItems(items: Array<{product_code: string, quantity: number}>): Promise<{valid: boolean, errors: string[], validatedItems: any[]}> {
    const errors: string[] = [];
    const validatedItems: any[] = [];

    for (const item of items) {
      try {
        const product = await this.getProduct(item.product_code);
        
        if (!product) {
          errors.push(`Producto ${item.product_code} no encontrado`);
          continue;
        }
        
        if (product.stock_disponible < item.quantity) {
          errors.push(`Stock insuficiente para ${product.nombre}. Disponible: ${product.stock_disponible}, Solicitado: ${item.quantity}`);
          continue;
        }
        
        validatedItems.push({
          product_code: item.product_code,
          product_name: product.nombre,
          quantity: item.quantity,
          unit_price: product.precio_unitario,
          available_stock: product.stock_disponible
        });
        
      } catch (error: any) {
        errors.push(`Error validando ${item.product_code}: ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      validatedItems
    };
  }
}
