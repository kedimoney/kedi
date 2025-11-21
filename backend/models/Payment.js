const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    method: { type: DataTypes.ENUM('mtn_momo', 'airtel_money', 'credit_card'), allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'completed', 'failed'), defaultValue: 'pending' },
    transactionId: DataTypes.STRING,
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  });

  return Payment;
};