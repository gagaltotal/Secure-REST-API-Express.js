// "use strict";
// const bcrypt = require('bcrypt');

// module.exports = {
//   async up (queryInterface, Sequelize) {
//     const now = new Date();
//     const adminPass = await bcrypt.hash('AdminPass123!', 12);
//     const userPass = await bcrypt.hash('UserPass123!', 12);
//     await queryInterface.bulkInsert('Users', [
//       { name: 'Administrator', email: 'admin@example.com', password: adminPass, role: 'admin', emailVerified: true, createdAt: now, updatedAt: now },
//       { name: 'Alice', email: 'alice@example.com', password: userPass, role: 'user', emailVerified: true, createdAt: now, updatedAt: now },
//       { name: 'Bob', email: 'bob@example.com', password: userPass, role: 'user', emailVerified: true, createdAt: now, updatedAt: now }
//     ], {});
//   },

//   async down (queryInterface, Sequelize) {
//     await queryInterface.bulkDelete('Users', { email: ['admin@example.com','alice@example.com','bob@example.com'] }, {});
//   }
// };

"use strict";
const bcrypt = require("bcrypt");

module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    const [adminPass, userPass] = await Promise.all([
      bcrypt.hash("AdminPass123!", 12),
      bcrypt.hash("UserPass123!", 12),
    ]);

    const users = [
      {
        name: "Administrator",
        email: "admin@example.com",
        password: adminPass,
        role: "admin",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Alice",
        email: "alice@example.com",
        password: userPass,
        role: "user",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Bob",
        email: "bob@example.com",
        password: userPass,
        role: "user",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    const emails = users.map(u => u.email);

    await queryInterface.bulkDelete("Users", {
      email: { [Sequelize.Op.in]: emails },
    });

    await queryInterface.bulkInsert("Users", users);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("Users", {
      email: ["admin@example.com", "alice@example.com", "bob@example.com"],
    });
  },
};