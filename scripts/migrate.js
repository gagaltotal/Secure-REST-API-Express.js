require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, User, Product } = require('../src/models');

async function run() {
  console.log('Connecting to DB...');
  await sequelize.authenticate();
  console.log('Syncing models (force=true) — this will DROP existing tables');
  await sequelize.sync({ force: true });

  console.log('Seeding users...');
  const adminPassword = await bcrypt.hash('AdminPass123!', 12);
  const userPassword = await bcrypt.hash('UserPass123!', 12);

  const admin = await User.create({ name: 'Administrator', email: 'admin@example.com', password: adminPassword, role: 'admin' });
  const user1 = await User.create({ name: 'Alice', email: 'alice@example.com', password: userPassword, role: 'user' });
  const user2 = await User.create({ name: 'Bob', email: 'bob@example.com', password: userPassword, role: 'user' });

  console.log('Seeding products...');
  const products = [];
  for (let i = 1; i <= 12; i++) {
    products.push({
      name: `Product ${i}`,
      description: `Dummy description for product ${i}`,
      year: 2025,
      month: ((i - 1) % 12) + 1
    });
  }
  await Product.bulkCreate(products);

  console.log('Done. Created:', { admin: admin.email, users: 2, products: products.length });
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed', err);
  process.exit(1);
});
