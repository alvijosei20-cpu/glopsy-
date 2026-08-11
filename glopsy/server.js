import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en: http://localhost:${PORT}`);
  console.log(`🌐 Frontend autorizado (CORS): ${process.env.FRONTEND_URL || 'No definido'}`);
});
