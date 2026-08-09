import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY 
});

async function main() {
  try {
    const response = await ai.models.generateContent({
     model: 'gemini-2.0-flash-lite', // O prueba con 'gemini-2.0-flash'
      contents: '¡Hola! Confirma si recibes este mensaje.',
    });

    console.log(response.text);
  } catch (error) {
    console.error('Error al conectar:', error);
  }
}

main();
