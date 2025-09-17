import axios from 'axios';
import { CustomerInfo, Product, OrderValidation, OrderItem } from '../types';

export class ERPConnector {
  private baseUrl: string;
  private apiToken: string;

  constructor() {
    this.baseUrl = process.env.ERP_API_BASE_URL || 'http://localhost:3001/api';
    this.apiToken = process.env.ERP_API_TOKEN || 'demo-token';
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json'
    };
  }

  async getCustomerByPhone(phone: string): Promise<CustomerInfo> {
    try {
      const response = await axios.get(`${this.baseUrl}/customers/by-phone/${phone}`, {
        headers: this.getHeaders()
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo cliente:', error.message);
      
      // Cliente invitado por defecto
      return {
        id: 'GUEST',
        nombre: 'Cliente',
        telefono: phone,
        descuento: 0,
        credito_disponible: 0
      };
    }
  }

  async getAllProducts(): Promise<Product[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/products`, {
        headers: this.getHeaders()
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Error obteniendo productos:', error.message);
      return [];
    }
  }

  async getProduct(productCode: string): Promise<Product | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/products/${productCode}`, {
        headers: this.getHeaders()
      });
      
      return response.data;
    } catch (error: any) {
      console.error(`Error obteniendo producto ${productCode}:`, error.message);
      return null;
    }
  }

  async searchProducts(searchTerm: string): Promise<Product[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/products/search`, {
        params: { q: searchTerm },
        headers: this.getHeaders()
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Error buscando productos:', error.message);
      return [];
    }
  }

  async validateOrderItems(items: any[]): Promise<OrderValidation> {
    try {
      const response = await axios.post(`${this.baseUrl}/orders/validate`, 
        { items },
        { headers: this.getHeaders() }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Error validando pedido:', error.message);
      
      return {
        valid: false,
        errors: ['Error de conexión con el sistema ERP'],
        validatedItems: []
      };
    }
  }

  async createOrder(customerId: string, items: OrderItem[]): Promise<{ success: boolean; orderId?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/orders`, 
        {
          customer_id: customerId,
          items: items
        },
        { headers: this.getHeaders() }
      );
      
      return {
        success: true,
        orderId: response.data.order_id
      };
    } catch (error: any) {
      console.error('Error creando pedido:', error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || 'Error creando pedido'
      };
    }
  }
}