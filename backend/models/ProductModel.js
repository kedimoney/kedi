const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Product = sequelize.define('Product', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: DataTypes.TEXT,
    price: { type: DataTypes.FLOAT, allowNull: false },
    unit: { type: DataTypes.ENUM('kg', 'piece'), defaultValue: 'kg' },
    quantity: { type: DataTypes.FLOAT, allowNull: false },
    categoryId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Categories', key: 'id' } },
    sellerId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' } },
    sellerPhone: DataTypes.STRING,
    location: DataTypes.TEXT, // JSON string for lat/lng
    images: { type: DataTypes.TEXT }, // JSON string
    stock: { type: DataTypes.INTEGER, defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  });

  return Product;
};