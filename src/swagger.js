const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Secure Express API', version: '1.0.0', description: 'Secure REST API with authentication, rate limiting, and file uploads' },
    servers: [{ url: process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}` }],
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

function setupSwagger(app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}

module.exports = { setupSwagger, spec };
