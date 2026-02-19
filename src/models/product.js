const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    year: { type: DataTypes.INTEGER, allowNull: true },
    month: { type: DataTypes.INTEGER, allowNull: true },
    imagePath: { type: DataTypes.STRING, allowNull: true },
    pdfPath: { type: DataTypes.STRING, allowNull: true }
  }, { timestamps: true });

  return Product;
};
