const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

function setupSwagger(app, activePort) {
  const baseUrl = process.env.APP_URL 
    ? process.env.APP_URL.replace(/:\d+$/, `:${activePort}`)
    : `http://localhost:${activePort}`;

  const options = {
    definition: {
      openapi: '3.0.0',
      info: { 
        title: 'Secure Express API', 
        version: '1.0.0', 
        description: 'Secure REST API with authentication, rate limiting, and file uploads' 
      },
      servers: [{ url: baseUrl }],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    },
    apis: ['./src/routes/*.js']
  };

  const spec = swaggerJsdoc(options);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
  
  return spec;
}

module.exports = { setupSwagger };