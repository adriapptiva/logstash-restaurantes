const express = require('express');
const winston = require('winston');
const app = express();

// Configurar Winston para escribir logs en un archivo
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/app.log' })
  ]
});

// Middleware para loggear cada petición
app.use((req, res, next) => {
  logger.info('Petición recibida', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

app.get('/', (req, res) => {
  res.json({ message: 'Hola desde Node.js!' });
});

app.get('/error', (req, res) => {
  logger.error('Este es un error de ejemplo', {
    error: 'Error simulado',
    code: 500
  });
  res.status(500).json({ error: 'Error simulado' });
});

const PORT = 3000;
app.listen(PORT, () => {
  logger.info(`Servidor iniciado en puerto ${PORT}`);
});