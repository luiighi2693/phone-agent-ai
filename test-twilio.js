const axios = require('axios');

// Configuración para pruebas de Twilio
const TWILIO_WEBHOOK_URL = 'http://localhost:7071/api/twilioWebhook';

// Simular datos que Twilio envía
const twilioTestData = [
  {
    name: 'Nueva llamada',
    data: {
      CallSid: 'CA1234567890abcdef',
      From: '+1234567890',
      To: '+1987654321',
      CallStatus: 'in-progress'
    }
  },
  {
    name: 'Speech: Búsqueda de productos',
    data: {
      CallSid: 'CA1234567890abcdef',
      From: '+1234567890',
      To: '+1987654321',
      SpeechResult: 'Hola, necesito información sobre laptops'
    }
  },
  {
    name: 'Speech: Consulta precio',
    data: {
      CallSid: 'CA1234567890abcdef',
      From: '+1234567890',
      To: '+1987654321',
      SpeechResult: 'Cuánto cuesta el LAP001'
    }
  },
  {
    name: 'Speech: Crear pedido',
    data: {
      CallSid: 'CA1234567890abcdef',
      From: '+1234567890',
      To: '+1987654321',
      SpeechResult: 'Quiero hacer un pedido de 2 laptops LAP001'
    }
  },
  {
    name: 'Speech: Confirmación',
    data: {
      CallSid: 'CA1234567890abcdef',
      From: '+1234567890',
      To: '+1987654321',
      SpeechResult: 'Sí, confirmo el pedido'
    }
  }
];

async function testTwilioWebhook(testCase) {
  console.log(`\n📞 Probando: ${testCase.name}`);
  
  try {
    // Convertir datos a formato form-encoded (como Twilio)
    const formData = new URLSearchParams();
    Object.keys(testCase.data).forEach(key => {
      formData.append(key, testCase.data[key]);
    });

    const response = await axios.post(TWILIO_WEBHOOK_URL, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });
    
    console.log(`✅ Status: ${response.status}`);
    
    // Parsear respuesta TwiML
    const twimlResponse = response.data;
    console.log('📝 TwiML Response:');
    console.log(twimlResponse);
    
    // Extraer mensaje de Say
    const sayMatch = twimlResponse.match(/<Say[^>]*>(.*?)<\/Say>/);
    if (sayMatch) {
      console.log(`🗣️ Mensaje: "${sayMatch[1]}"`);
    }
    
    // Verificar si continúa escuchando
    const hasGather = twimlResponse.includes('<Gather');
    const hasHangup = twimlResponse.includes('<Hangup');
    
    if (hasGather) {
      console.log('🎤 Continúa escuchando...');
    } else if (hasHangup) {
      console.log('📴 Termina llamada');
    }
    
    return response.data;
  } catch (error) {
    console.error(`❌ Error: ${error.response?.data || error.message}`);
    return null;
  }
}

async function runTwilioTests() {
  console.log('🧪 Iniciando pruebas de Twilio webhook\n');
  
  // Verificar que el ERP esté corriendo
  try {
    await axios.get('http://localhost:3001/api/products', {
      headers: { 'Authorization': 'Bearer demo-erp-token-12345' }
    });
    console.log('✅ ERP simulado está corriendo');
  } catch (error) {
    console.log('❌ ERP no disponible. Ejecuta: cd erp-simulator && npm start');
    return;
  }
  
  // Ejecutar pruebas
  for (const testCase of twilioTestData) {
    await testTwilioWebhook(testCase);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre tests
  }
  
  console.log('\n✅ Pruebas de Twilio completadas');
  console.log('\n📞 Para probar con Twilio real:');
  console.log('1. Compra un número en console.twilio.com');
  console.log('2. Configura webhook: https://TU-FUNCTION-APP.azurewebsites.net/api/twilioWebhook');
  console.log('3. Llama a tu número Twilio');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  runTwilioTests().catch(console.error);
}

module.exports = { testTwilioWebhook, runTwilioTests };