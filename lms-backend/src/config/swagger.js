import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFile);

// openapi.yaml debe estar en la misma carpeta que este archivo.
const openapiDocument = parse(
  readFileSync(join(currentDirectory, 'openapi.yaml'), 'utf8')
);

export function registerSwagger(app) {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openapiDocument, {
      explorer: true,
      swaggerOptions: { validatorUrl: null }
    })
  );
}
