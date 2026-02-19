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

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);

setupSwagger(app);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

const PORT = process.env.PORT || 3000;

async function start() {
  await sequelize.authenticate();
  await sequelize.sync();
  
  startEmailRetryWorker();
  
  app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
}

start().catch(err => {
  console.error('Failed to start', err);
  process.exit(1);
});

module.exports = app;
