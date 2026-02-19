// "use strict";

// module.exports = {
//   async up (queryInterface, Sequelize) {
//     const now = new Date();
//     const products = [];
//     for (let i = 1; i <= 12; i++) {
//       products.push({ name: `Product ${i}`, description: `Dummy description ${i}`, year: 2025, month: ((i-1)%12)+1, createdAt: now, updatedAt: now });
//     }
//     await queryInterface.bulkInsert('Products', products, {});
//   },

//   async down (queryInterface, Sequelize) {
//     await queryInterface.bulkDelete('Products', null, {});
//   }
// };

"use strict";

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    
    await queryInterface.bulkDelete("Products", null, {});

    const products = [];
    for (let i = 1; i <= 12; i++) {
      products.push({
        name: `Product ${i}`,
        description: `Dummy description for product ${i}`,
        year: 2025,
        month: ((i - 1) % 12) + 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    await queryInterface.bulkInsert("Products", products);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("Products", null, {});
  },
};