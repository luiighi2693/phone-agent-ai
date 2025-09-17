import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

export async function webhookHandler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('🔔 Webhook de Communication Services recibido');
  
  try {
    const body = await request.json() as any;
    const eventType = body.eventType || body.type;
    
    context.log(`📨 Tipo de evento: ${eventType}`);
    
    // Manejar diferentes tipos de eventos de Azure Communication Services
    switch (eventType) {
      case 'Microsoft.Communication.IncomingCall':
        return await handleIncomingCall(body, context);
      
      case 'Microsoft.Communication.CallConnected':
        return await handleCallConnected(body, context);
      
      case 'Microsoft.Communication.CallDisconnected':
        return await handleCallDisconnected(body, context);
      
      case 'Microsoft.Communication.RecognizeCompleted':
        return await handleRecognizeCompleted(body, context);
      
      case 'Microsoft.Communication.PlayCompleted':
        return await handlePlayCompleted(body, context);
      
      default:
        context.log(`⚠️ Evento no manejado: ${eventType}`);
        return {
          status: 200,
          jsonBody: {
            success: true,
            message: 'Evento recibido pero no procesado'
          }
        };
    }

  } catch (error: any) {
    context.error('❌ Error en webhook handler:', error);
    
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Error procesando webhook'
      }
    };
  }
}

async function handleIncomingCall(eventData: any, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('📞 Llamada entrante detectada');
  
  const { incomingCallContext, from, to } = eventData.data;
  const callId = eventData.data.callConnectionId || generateCallId();
  
  context.log(`📱 De: ${from?.phoneNumber} Para: ${to?.phoneNumber}`);
  
  // Responder automáticamente la llamada
  const callbackUri = `${process.env.FUNCTION_APP_URL}/api/webhookHandler`;
  
  const answerCallAction = {
    action: "answer",
    callbackUri: callbackUri,
    operationContext: callId
  };
  
  // Iniciar grabación y reconocimiento de voz
  const recognizeAction = {
    action: "recognize",
    recognizeOptions: {
      interruptPrompt: true,
      initialSilenceTimeoutInSeconds: 5,
      targetParticipant: from,
      speechOptions: {
        endSilenceTimeoutInMs: 1000
      }
    },
    playPrompt: {
      kind: "text",
      text: "Por favor espere mientras le conecto con nuestro asistente.",
      voiceName: "es-ES-ElviraNeural"
    },
    operationContext: `recognize-${callId}`
  };

  return {
    status: 200,
    jsonBody: [answerCallAction, recognizeAction]
  };
}

async function handleCallConnected(eventData: any, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('🔗 Llamada conectada exitosamente');
  
  const callId = eventData.data.callConnectionId;
  const from = eventData.data.from?.phoneNumber;
  
  // Llamar a nuestra función principal para procesar la conexión
  try {
    const functionUrl = `${process.env.FUNCTION_APP_URL}/api/callHandler`;
    
    await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-functions-key': process.env.FUNCTION_KEY || ''
      },
      body: JSON.stringify({
        callId,
        customerPhone: from,
        eventType: 'CallConnected'
      })
    });
    
  } catch (error) {
    context.error('❌ Error llamando a callHandler:', error);
  }
  
  return {
    status: 200,
    jsonBody: {
      success: true,
      message: 'Llamada conectada procesada'
    }
  };
}

async function handleRecognizeCompleted(eventData: any, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('🎤 Reconocimiento de voz completado');
  
  const { callConnectionId, recognizeResult } = eventData.data;
  const transcribedText = recognizeResult?.speech?.text || '';
  const from = eventData.data.from?.phoneNumber;
  
  context.log(`📝 Texto reconocido: "${transcribedText}"`);
  
  if (!transcribedText) {
    // Si no se reconoció nada, pedir al usuario que hable de nuevo
    return {
      status: 200,
      jsonBody: [{
        action: "playToAll",
        playSource: {
          kind: "text",
          text: "No pude escucharle claramente. Por favor, hable después del tono.",
          voiceName: "es-ES-ElviraNeural"
        },
        operationContext: `play-${callConnectionId}`
      }, {
        action: "recognize",
        recognizeOptions: {
          interruptPrompt: true,
          initialSilenceTimeoutInSeconds: 5,
          targetParticipant: eventData.data.from,
          speechOptions: {
            endSilenceTimeoutInMs: 1500
          }
        },
        operationContext: `recognize-${callConnectionId}`
      }]
    };
  }
  
  try {
    // Llamar a nuestra función principal para procesar el texto
    const functionUrl = `${process.env.FUNCTION_APP_URL}/api/callHandler`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-functions-key': process.env.FUNCTION_KEY || ''
      },
      body: JSON.stringify({
        callId: callConnectionId,
        customerPhone: from,
        transcribedText,
        eventType: 'RecognizeCompleted'
      })
    });
    
    const result = await response.json() as any;
    
    if (result.success) {
      const actions = [];
      
      if (result.action === 'speak') {
        // Reproducir respuesta del agente
        actions.push({
          action: "playToAll",
          playSource: {
            kind: "text",
            text: result.message,
            voiceName: "es-ES-ElviraNeural"
          },
          operationContext: `play-${callConnectionId}`
        });
        
        // Continuar escuchando (a menos que sea el final de la llamada)
        if (result.intent !== 'end_conversation') {
          actions.push({
            action: "recognize",
            recognizeOptions: {
              interruptPrompt: true,
              initialSilenceTimeoutInSeconds: 10,
              targetParticipant: eventData.data.from,
              speechOptions: {
                endSilenceTimeoutInMs: 2000
              }
            },
            operationContext: `recognize-${callConnectionId}`
          });
        }
      } else if (result.action === 'hangup') {
        // Finalizar llamada
        actions.push({
          action: "hangUp",
          operationContext: `hangup-${callConnectionId}`
        });
      }
      
      return {
        status: 200,
        jsonBody: actions
      };
    }
    
  } catch (error) {
    context.error('❌ Error procesando texto reconocido:', error);
  }
  
  // Fallback en caso de error
  return {
    status: 200,
    jsonBody: [{
      action: "playToAll",
      playSource: {
        kind: "text",
        text: "Disculpe, tengo problemas técnicos. Por favor intente más tarde.",
        voiceName: "es-ES-ElviraNeural"
      },
      operationContext: `error-play-${callConnectionId}`
    }, {
      action: "hangUp",
      operationContext: `error-hangup-${callConnectionId}`
    }]
  };
}

async function handlePlayCompleted(eventData: any, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('🔊 Reproducción de audio completada');
  
  const { callConnectionId, operationContext } = eventData.data;
  
  // Si la reproducción se completó y no es un mensaje de error/cierre,
  // automáticamente continuar escuchando
  if (!operationContext?.includes('error') && !operationContext?.includes('hangup')) {
    return {
      status: 200,
      jsonBody: [{
        action: "recognize",
        recognizeOptions: {
          interruptPrompt: true,
          initialSilenceTimeoutInSeconds: 10,
          targetParticipant: eventData.data.from,
          speechOptions: {
            endSilenceTimeoutInMs: 2000
          }
        },
        operationContext: `recognize-${callConnectionId}`
      }]
    };
  }
  
  return {
    status: 200,
    jsonBody: {
      success: true,
      message: 'Play completado'
    }
  };
}

async function handleCallDisconnected(eventData: any, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('📴 Llamada desconectada');
  
  const callId = eventData.data.callConnectionId;
  const from = eventData.data.from?.phoneNumber;
  
  // Notificar a nuestra función principal sobre la desconexión
  try {
    const functionUrl = `${process.env.FUNCTION_APP_URL}/api/callHandler`;
    
    await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-functions-key': process.env.FUNCTION_KEY || ''
      },
      body: JSON.stringify({
        callId,
        customerPhone: from,
        eventType: 'CallDisconnected'
      })
    });
    
  } catch (error) {
    context.error('❌ Error notificando desconexión:', error);
  }
  
  return {
    status: 200,
    jsonBody: {
      success: true,
      message: 'Desconexión procesada'
    }
  };
}

function generateCallId(): string {
  return `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Registrar la función
app.http('webhookHandler', {
  methods: ['POST'],
  authLevel: 'function',
  handler: webhookHandler
});
