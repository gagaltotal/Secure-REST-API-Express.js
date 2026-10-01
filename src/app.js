require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const cors = require('cors');
const { sequelize } = require('./models');
const { startEmailRetryWorker } = require('./utils/mailer');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const { setupSwagger } = require('./swagger');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(xss());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});
app.use(limiter);

app.get("/", require("./controllers/IndexController").index);
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

// Konfigurasi port
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PORT_ATTEMPTS = 10;

/**
 * Mencari port yang tersedia secara recursive
 * @param {Express} app - Express app instance
 * @param {number} startPort - Port awal
 * @param {number} maxAttempts - Maksimal percobaan
 * @returns {Promise<{server: Server, port: number}>}
 */
function findAvailablePort(app, startPort, maxAttempts = MAX_PORT_ATTEMPTS) {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let attempts = 0;

    function tryPort() {
      if (attempts >= maxAttempts) {
        reject(new Error(
          `Tidak bisa menemukan port tersedia setelah ${maxAttempts} percobaan (port ${startPort}-${currentPort - 1})`
        ));
        return;
      }

      const server = app.listen(currentPort)
        .once('listening', () => {
          if (currentPort !== startPort) {
            console.log(`\n Port ${startPort} sudah digunakan, menggunakan port ${currentPort} sebagai gantinya`);
          }
          resolve({ server, port: currentPort });
        })
        .once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${currentPort} sudah digunakan, mencoba port ${currentPort + 1}...`);
            currentPort++;
            attempts++;
            tryPort();
          } else {
            reject(err);
          }
        });
    }

    tryPort();
  });
}

async function start() {
  await sequelize.authenticate();
  await sequelize.sync();

  startEmailRetryWorker();

  try {
    const { server, port } = await findAvailablePort(app, DEFAULT_PORT);

    setupSwagger(app, port);
    
    console.log(`\n Server berjalan di port ${port}`);
    console.log(`API Docs: http://localhost:${port}/docs\n`);

    const shutdown = (signal) => {
      console.log(`\n${signal} diterima, menutup server...`);
      server.close(() => {
        console.log('Server ditutup');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    console.error('Gagal menjalankan server:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  start().catch(err => {
    console.error('Gagal memulai aplikasi:', err);
    process.exit(1);
  });
}

module.exports = app;