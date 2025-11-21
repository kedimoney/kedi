const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    buyerId: { type: DataTypes.INTEGER, allowNull: true }, // Reference to User (buyer)
    products: { type: DataTypes.TEXT, allowNull: false }, // JSON string
    totalAmount: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'), defaultValue: 'pending' },
    paymentStatus: { type: DataTypes.ENUM('pending', 'paid', 'failed'), defaultValue: 'pending' },
    buyerInfo: DataTypes.TEXT, // JSON string for guest buyers
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  });

  return Order;
};