#!/bin/bash

# Espera a que Kibana esté disponible
echo "Esperando a que Kibana esté disponible..."
until curl -s -o /dev/null -w "%{http_code}" http://localhost:5601/api/status | grep -q "200"; do
  sleep 5
done

echo "Kibana está disponible. Importando saved objects..."

# Importar los saved objects
curl -X POST "http://localhost:5601/api/saved_objects/_import?overwrite=true" \
  -H "kbn-xsrf: true" \
  -F file=@/tmp/export.ndjson

echo "Importación de saved objects completada."

tail -f /dev/null