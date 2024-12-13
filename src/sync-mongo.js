require('dotenv').config();
const { MongoClient } = require('mongodb');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/mongo-sync.log' }),
    new winston.transports.Console()
  ]
});

async function getCollections() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    logger.info('Conectado a MongoDB');
    
    const db = client.db();
    const collections = await db.listCollections().toArray();
    
    logger.info('Colecciones disponibles:', {
      collections: collections.map(col => col.name)
    });

    // Obtener una muestra de documentos de cada colección
    for (const collection of collections) {
      const sample = await db.collection(collection.name)
        .find()
        .limit(1)
        .toArray();
      
      logger.info(`Estructura de documentos en ${collection.name}:`, {
        collectionName: collection.name,
        sampleDocument: sample[0]
      });
    }

  } catch (error) {
    logger.error('Error al conectar con MongoDB:', error);
  } finally {
    await client.close();
  }
}

getCollections();