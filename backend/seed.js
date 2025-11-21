const bcrypt = require('bcryptjs');
const { sequelize, User, Product, Category } = require('./database');

async function seedDatabase() {
  try {
    console.log('🌱 Seeding database...');

    // Force sync database to ensure tables exist
    await sequelize.sync({ force: true });
    console.log('✅ Database synced');

    // Hash passwords
    const hashedPassword123 = await bcrypt.hash('password123', 10);
    const hashedAdmin123 = await bcrypt.hash('admin123', 10);

    // Create categories
    const categories = await Category.bulkCreate([
      { name: 'Agriculture', description: 'Fresh produce and crops' },
      { name: 'Livestock', description: 'Meat, dairy, and animal products' },
      { name: 'Services', description: 'Agricultural services and equipment' },
      { name: 'Others', description: 'Miscellaneous agricultural products' }
    ], { ignoreDuplicates: true });

    console.log('✅ Categories created');

    // Create test users
    const users = await User.bulkCreate([
      {
        name: 'John Farmer',
        email: 'john@example.com',
        password: hashedPassword123,
        role: 'seller',
        phone: '+250788123456',
        address: 'Kigali, Rwanda',
        isApproved: true
      },
      {
        name: 'Mary Buyer',
        email: 'mary@example.com',
        password: hashedPassword123,
        role: 'buyer',
        phone: '+250789654321'
      },
      {
        name: 'Admin User',
        email: 'admin@kedi.com',
        password: hashedAdmin123,
        role: 'admin'
      }
    ], { ignoreDuplicates: true });

    console.log('✅ Users created');

    // Create sample products
    const products = await Product.bulkCreate([
      {
        name: 'Fresh Tomatoes',
        description: 'Organic tomatoes grown locally in Rwanda. Perfect for salads and cooking.',
        price: 1500,
        unit: 'kg',
        quantity: 50,
        categoryId: 1, // Agriculture
        sellerId: 1, // John Farmer
        images: JSON.stringify(['/uploads/1763616966338-AN313-Tomatoes-732x549-Thumb-732x549.avif']),
        stock: 50
      },
      {
        name: 'Local Honey',
        description: 'Pure honey from Rwandan bees. Rich flavor and natural sweetness.',
        price: 8000,
        unit: 'jar',
        quantity: 20,
        categoryId: 4, // Others
        sellerId: 1, // John Farmer
        images: JSON.stringify(['/uploads/1763617020176-AN313-Tomatoes-732x549-Thumb-732x549.avif']),
        stock: 20
      },
      {
        name: 'Fresh Milk',
        description: 'Fresh cow milk delivered daily. Perfect for drinking or making dairy products.',
        price: 1200,
        unit: 'liter',
        quantity: 30,
        categoryId: 2, // Livestock
        sellerId: 1, // John Farmer
        images: JSON.stringify(['/uploads/1763617206768-AN313-Tomatoes-732x549-Thumb-732x549.avif']),
        stock: 30
      }
    ]);

    console.log('✅ Products created');
    console.log('🎉 Database seeded successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('Seller: john@example.com / password123');
    console.log('Buyer: mary@example.com / password123');
    console.log('Admin: admin@kedi.com / admin123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await sequelize.close();
  }
}

// Run seeder
seedDatabase();