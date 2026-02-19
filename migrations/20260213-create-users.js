"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.ENUM('admin', 'user'), allowNull: false, defaultValue: 'user' },
      emailVerified: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      emailVerificationToken: { type: Sequelize.STRING, allowNull: true },
      emailVerificationExpires: { type: Sequelize.DATE, allowNull: true },
      resetPasswordToken: { type: Sequelize.STRING, allowNull: true },
      resetPasswordExpires: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Users');
  }
};
