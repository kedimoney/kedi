const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL || 'sqlite:./database.sqlite', {
  dialect: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
  storage: process.env.DATABASE_URL ? undefined : './database.sqlite',
  logging: false,
  dialectOptions: process.env.DATABASE_URL ? {
    ssl: process.env.NODE_ENV === 'production' ? { require: true, rejectUnauthorized: false } : false
  } : undefined
});

// Test connection
sequelize.authenticate()
  .then(() => console.log('Database connection established'))
  .catch(err => console.error('Database connection failed:', err));

// Import and initialize models
const User = require('./models/User')(sequelize);
const Product = require('./models/ProductModel')(sequelize);
const Category = require('./models/Category')(sequelize);
const Order = require('./models/Order')(sequelize);
const Payment = require('./models/Payment')(sequelize);
const Message = require('./models/Message')(sequelize);

// Define associations after models are initialized
User.hasMany(Product, { foreignKey: 'sellerId', as: 'products' });
Product.belongsTo(User, { foreignKey: 'sellerId', as: 'seller' });

Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

User.hasMany(Order, { foreignKey: 'buyerId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'buyerId', as: 'buyer' });

Order.hasMany(Payment, { foreignKey: 'orderId', as: 'payments' });
Payment.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

User.hasMany(Message, { foreignKey: 'receiverId', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'receiverId', as: 'receiver' });

Product.hasMany(Message, { foreignKey: 'productId', as: 'messages' });
Message.belongsTo(Product, { foreignKey: 'productId', as: 'product' });

Order.hasMany(Message, { foreignKey: 'orderId', as: 'messages' });
Message.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });

// Associations are already defined above

// Sync database
sequelize.sync({ force: false })
  .then(() => {
    console.log('Database synced successfully');
    console.log('Available models:', Object.keys(sequelize.models));
  })
  .catch(err => {
    console.error('Database sync failed:', err);
    process.exit(1);
  });

// Export both sequelize instance and initialized models
module.exports = {
  sequelize,
  User,
  Product,
  Category,
  Order,
  Payment,
  Message
};