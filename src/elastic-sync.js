const { MongoClient } = require('mongodb');
const winston = require('winston');
const { Client } = require('@elastic/elasticsearch');
require('dotenv').config();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/elastic-sync.log' }),
    new winston.transports.Console()
  ]
});

const elasticClient = new Client({
  node: 'http://localhost:9200'
});

async function syncRestaurants() {
  const mongoClient = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await mongoClient.connect();
    logger.info('Conectado a MongoDB');
    
    const db = mongoClient.db();
    const collection = db.collection('todo_restaurantes_españa');
    
    // Crear índice con mapping
    await createIndex();
    
    // Procesar documentos en lotes
    const batchSize = 1000;
    let processed = 0;
    const cursor = collection.find({});
    
    while (await cursor.hasNext()) {
      const batch = [];
      while (batch.length < batchSize && await cursor.hasNext()) {
        const doc = await cursor.next();
        batch.push(transformDocument(doc));
      }
      
      if (batch.length > 0) {
        await bulkIndex(batch);
        processed += batch.length;
        logger.info(`Procesados ${processed} documentos`);
      }
    }
    
    logger.info('Sincronización completada');
    
  } catch (error) {
    logger.error('Error durante la sincronización:', error);
  } finally {
    await mongoClient.close();
  }
}

function transformDocument(doc) {
  // Transformar reviews
  const reviews = doc.reviews?.map(review => ({
    author: review[0],
    date: review[1],
    text: review[2],
    rating: review[3]
  })) || [];

  // Crear location en formato geo_point
  const location = doc.coordenadas ? {
    lat: doc.coordenadas[0],
    lon: doc.coordenadas[1]
  } : null;

  return {
    business_id: doc.id_negocio,
    name: doc.nombre,
    categorias: doc.categorias,
    rating: doc.valoracion,
    review_count: doc.numreseñas,
    location,
    direccion: doc.direccion,
    codigopostal: doc.codigopostal,
    localidad: doc.localidad,
    provincia: doc.provincia,
    telefono: doc.telefono,
    opcionesServicio: doc.opcionesServicio,
    reviews,
    dateSaved: doc.dateSaved
  };
}

async function createIndex() {
  try {
    const exists = await elasticClient.indices.exists({
      index: 'restaurantes'
    });

    if (!exists) {
      await elasticClient.indices.create({
        index: 'restaurantes',
        body: {
          mappings: {
            properties: {
              business_id: { type: 'keyword' },
              name: { 
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              categorias: { type: 'keyword' },
              rating: { type: 'float' },
              review_count: { type: 'integer' },
              location: { type: 'geo_point' },
              direccion: { type: 'text' },
              codigopostal: { type: 'keyword' },
              localidad: { type: 'keyword' },
              provincia: { type: 'keyword' },
              telefono: { type: 'keyword' },
              opcionesServicio: { type: 'keyword' },
              reviews: {
                type: 'nested',
                properties: {
                  author: { type: 'keyword' },
                  date: { type: 'text' },
                  text: { type: 'text' },
                  rating: { type: 'integer' }
                }
              },
              dateSaved: { type: 'date' }
            }
          }
        }
      });
      logger.info('Índice creado correctamente');
    }
  } catch (error) {
    logger.error('Error creando índice:', error);
    throw error;
  }
}

async function bulkIndex(documents) {
  const body = documents.flatMap(doc => [
    { index: { _index: 'restaurantes', _id: doc.business_id } },
    doc
  ]);

  try {
    const { errors, items } = await elasticClient.bulk({ body });
    if (errors) {
      const erroredDocuments = [];
      items.forEach((action, i) => {
        const operation = Object.keys(action)[0];
        if (action[operation].error) {
          erroredDocuments.push({
            status: action[operation].status,
            error: action[operation].error,
            document: body[i * 2 + 1]
          });
        }
      });
      logger.error('Error en bulk indexing:', erroredDocuments);
    }
  } catch (error) {
    logger.error('Error en bulk operation:', error);
    throw error;
  }
}

syncRestaurants().catch(console.error);