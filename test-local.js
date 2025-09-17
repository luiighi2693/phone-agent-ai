const axios = require('axios');

// Configuración para pruebas locales
const FUNCTION_URL = 'http://localhost:7071/api/callHandler';
const ERP_URL = 'http://localhost:3001/api';

// Simular diferentes escenarios de conversación
const testScenarios = [
  {
    name: 'Saludo inicial',
    data: {
      callId: 'test-001',
      customerPhone: '+1234567890',
      eventType: 'CallConnected'
    }
  },
  {
    name: 'Búsqueda de producto',
    data: {
      callId: 'test-001',
      customerPhone: '+1234567890',
      transcribedText: 'Hola, necesito información sobre laptops',
      eventType: 'RecognizeCompleted'
    }
  },
  {
    name: 'Consulta precio específico',
    data: {
      callId: 'test-001',
      customerPhone: '+1234567890',
      transcribedText: 'Cuánto cuesta el LAP001',
      eventType: 'RecognizeCompleted'
    }
  },
  {
    name: 'Crear pedido',
    data: {
      callId: 'test-001',
      customerPhone: '+1234567890',
      transcribedText: 'Quiero hacer un pedido de 2 LAP001',
      eventType: 'RecognizeCompleted'
    }
  },
  {
    name: 'Confirmar pedido',
    data: {
      callId: 'test-001',
      customerPhone: '+1234567890',
      transcribedText: 'Sí, confirmo el pedido',
      eventType: 'RecognizeCompleted'
    }
  },
  {
    name: 'Finalizar llamada',
    data: {
      callId: 'test-001',
      customerPhone: '+1234567890',
      transcribedText: 'Gracias, eso es todo',
      eventType: 'RecognizeCompleted'
    }
  }
];

async function testERP() {
  console.log('🏢 Probando conexión ERP...');
  
  try {
    // Probar obtener productos
    const products = await axios.get(`${ERP_URL}/products`, {
      headers: { 'Authorization': 'Bearer demo-erp-token-12345' }
    });
    console.log(`✅ ERP: ${products.data.length} productos disponibles`);
    
    // Probar búsqueda de cliente
    const customer = await axios.get(`${ERP_URL}/customers/by-phone/+1234567890`, {
      headers: { 'Authorization': 'Bearer demo-erp-token-12345' }
    });
    console.log(`✅ ERP: Cliente encontrado - ${customer.data.nombre}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error conectando ERP:', error.message);
    return false;
  }
}

async function testFunction(scenario) {
  console.log(`\n📞 Probando: ${scenario.name}`);
  
  try {
    const response = await axios.post(FUNCTION_URL, scenario.data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
    
    console.log(`✅ Status: ${response.status}`);
    console.log(`📝 Respuesta: ${response.data.message || 'Sin mensaje'}`);
    
    if (response.data.intent) {
      console.log(`🎯 Intent: ${response.data.intent} (${response.data.confidence})`);
    }
    
    if (response.data.action) {
      console.log(`🎬 Acción: ${response.data.action}`);
    }
    
    // Mostrar datos adicionales si es un pedido
    if (response.data.orderValid !== undefined) {
      console.log(`📦 Pedido válido: ${response.data.orderValid ? '✅' : '❌'}`);
      if (response.data.totals) {
        console.log(`💰 Total: $${response.data.totals.total}`);
      }
    }
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data?.error || error.message}`);
    return null;
  }
}

async function testOrderCreation() {
  console.log('\n🛒 Probando creación de pedido completo...');
  
  try {
    const orderData = {
      customer_id: 'CUST001',
      items: [
        {
          product_code: 'LAP001',
          product_name: 'Laptop Dell Inspiron 15',
          quantity: 2,
          unit_price: 899.99,
          total: 1799.98
        }
      ]
    };
    
    const response = await axios.post(`${ERP_URL}/orders`, orderData, {
      headers: { 'Authorization': 'Bearer demo-erp-token-12345' }
    });
    
    console.log(`✅ Pedido creado: ${response.data.order_id}`);
    console.log(`💰 Total: $${response.data.total}`);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error creando pedido:', error.response?.data || error.message);
    return null;
  }
}

async function runTests() {
  console.log('🧪 Iniciando pruebas locales del agente telefónico\n');
  
  // 1. Verificar ERP
  const erpOk = await testERP();
  if (!erpOk) {
    console.log('\n❌ ERP no disponible. Ejecuta: cd erp-simulator && npm start');
    return;
  }
  
  // 2. Probar creación directa de pedido en ERP
  await testOrderCreation();
  
  // 3. Probar Azure Functions
  console.log('\n🔧 Probando Azure Functions...');
  
  for (const scenario of testScenarios) {
    await testFunction(scenario);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre tests
  }
  
  console.log('\n✅ Pruebas completadas');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testERP, testFunction, runTests };