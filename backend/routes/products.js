const express = require('express');
const { Op } = require('sequelize');
const { Product, User, Category } = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();

// Input validation middleware
const validateProduct = (req, res, next) => {
  const { name, price, quantity, categoryId } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ message: 'Product name must be at least 2 characters' });
  }

  if (!price || price <= 0) {
    return res.status(400).json({ message: 'Valid price is required' });
  }

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ message: 'Valid quantity is required' });
  }

  if (!categoryId || categoryId <= 0) {
    return res.status(400).json({ message: 'Valid category is required' });
  }

  next();
};

// Get all products with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const {
      search,
      category,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = {};

    // Search filter
    if (search) {
      whereClause.name = { [Op.iLike]: `%${search}%` };
    }

    // Category filter
    if (category) {
      whereClause.categoryId = parseInt(category);
    }

    // Get products with pagination
    const { count, rows: products } = await Product.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: User,
          as: 'seller',
          attributes: ['name', 'phone'],
          required: false
        }
      ]
    });

    res.json({
      products,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit)
      }
    });

  } catch (err) {
    console.error('Products fetch error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get product by id
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: Category, as: 'category', attributes: ['name'] },
        { model: User, as: 'seller', attributes: ['id', 'name', 'phone', 'address'] }
      ]
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Convert to plain object to avoid Sequelize instance methods
    const plainProduct = product.get({ plain: true });

    // Parse images if they exist
    if (plainProduct.images) {
      try {
        plainProduct.images = JSON.parse(plainProduct.images);
      } catch (e) {
        plainProduct.images = [];
      }
    } else {
      plainProduct.images = [];
    }

    // Parse location if it exists
    if (plainProduct.location) {
      try {
        plainProduct.location = JSON.parse(plainProduct.location);
      } catch (e) {
        plainProduct.location = null;
      }
    }

    res.json(plainProduct);
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create product (authenticated users only)
router.post('/', auth, validateProduct, async (req, res) => {
  const { name, description, price, unit, quantity, categoryId, images } = req.body;

  try {
    // Verify user exists
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create product
    const product = await Product.create({
      name: name.trim(),
      description: description?.trim(),
      price: parseFloat(price),
      unit: unit || 'kg',
      quantity: parseInt(quantity),
      categoryId: parseInt(categoryId),
      sellerId: user.id,
      sellerPhone: user.phone,
      location: JSON.stringify({ lat: user.lat || 0, lng: user.lng || 0 }),
      images: images ? JSON.stringify(images) : null,
      stock: parseInt(quantity)
    });

    // Return product with seller info
    const productWithSeller = await Product.findByPk(product.id, {
      include: [{
        model: User,
        as: 'seller',
        attributes: ['name', 'phone']
      }]
    });

    res.status(201).json({
      message: 'Product created successfully',
      product: productWithSeller
    });

  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update product (seller only)
router.put('/:id', auth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check ownership
    if (product.sellerId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Validate update data
    const allowedFields = ['name', 'description', 'price', 'quantity', 'images'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'price' && (req.body.price <= 0 || isNaN(req.body.price))) {
          return res.status(400).json({ message: 'Invalid price' });
        }
        if (field === 'quantity' && (req.body.quantity < 0 || isNaN(req.body.quantity))) {
          return res.status(400).json({ message: 'Invalid quantity' });
        }
        updates[field] = field === 'images' ? JSON.stringify(req.body[field]) : req.body[field];
      }
    }

    // Update stock if quantity changed
    if (updates.quantity !== undefined) {
      updates.stock = updates.quantity;
    }

    await product.update(updates);

    res.json({
      message: 'Product updated successfully',
      product
    });

  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete product (seller only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    if (isNaN(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check ownership
    if (product.sellerId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if product has active orders
    // This would require checking orders table - simplified for now

    await product.destroy();

    res.json({ message: 'Product deleted successfully' });

  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get seller's products
router.get('/seller/:sellerId', async (req, res) => {
  try {
    const sellerId = parseInt(req.params.sellerId);
    if (isNaN(sellerId)) {
      return res.status(400).json({ message: 'Invalid seller ID' });
    }

    const products = await Product.findAll({
      where: { sellerId },
      include: [{
        model: User,
        as: 'seller',
        attributes: ['name', 'phone']
      }]
    });

    res.json(products);

  } catch (err) {
    console.error('Get seller products error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;