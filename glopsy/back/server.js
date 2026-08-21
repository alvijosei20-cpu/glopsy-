import fs from 'node:fs';
import https from 'node:https';
import app from './app.js';

const PORT = process.env.PORT || 3000;

const SSL_KEY = process.env.SSL_KEY || 'certs/localhost-key.pem';
const SSL_CERT = process.env.SSL_CERT || 'certs/localhost-cert.pem';

let server;
if (process.env.ENABLE_HTTPS && fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
  const options = {
    key: fs.readFileSync(SSL_KEY),
    cert: fs.readFileSync(SSL_CERT),
  };
  server = https.createServer(options, app);
  console.log(`🔒 Servidor backend corriendo en HTTPS: https://localhost:${PORT}`);
} else {
  server = app;
  console.log(`🌐 Servidor backend corriendo en HTTP: http://localhost:${PORT}`);
}

server.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en el puerto ${PORT}`);
  console.log(`🌐 Frontend autorizado (CORS): ${process.env.FRONTEND_URL || 'No definido'}`);
});
