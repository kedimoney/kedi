const express = require('express');
const { Op } = require('sequelize');
const { sequelize, Order, Product, User, Message } = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();

// Input validation middleware
const validateOrder = (req, res, next) => {
  const { products } = req.body;

  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: 'At least one product is required' });
  }

  for (const item of products) {
    if (!item.productId || !item.quantity || item.quantity <= 0) {
      return res.status(400).json({ message: 'Invalid product data' });
    }
  }

  next();
};

// Create order (authenticated and guest users)
router.post('/', validateOrder, async (req, res) => {
  const { products, buyerInfo } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');
  let buyerId = null;
  let user = null;

  // If authenticated, verify user
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      buyerId = decoded.id;
      user = await User.findByPk(buyerId);
    } catch (err) {
      // Invalid token, treat as guest
    }
  }

  try {
    let totalAmount = 0;
    const orderProducts = [];

    // Validate products and calculate total
    for (const item of products) {
      const product = await Product.findByPk(parseInt(item.productId));
      if (!product) {
        return res.status(404).json({ message: `Product ${item.productId} not found` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`
        });
      }

      orderProducts.push({
        productId: product.id,
        quantity: item.quantity,
        price: product.price
      });

      totalAmount += product.price * item.quantity;
    }

    // Use transaction for atomicity
    const result = await sequelize.transaction(async (transaction) => {
      // Update product stock
      for (const item of products) {
        const product = await Product.findByPk(parseInt(item.productId), { transaction });
        product.stock -= item.quantity;
        await product.save({ transaction });
      }

      // Create order
      const orderData = {
        products: JSON.stringify(orderProducts),
        totalAmount,
        status: 'pending',
        buyerInfo: buyerInfo ? JSON.stringify(buyerInfo) : null
      };

      if (buyerId) {
        orderData.buyerId = buyerId;
      }

      const order = await Order.create(orderData, { transaction });
      return order;
    });

    // Send notifications to sellers
    try {
      const orderProducts = JSON.parse(result.products);
      const sellerNotifications = new Map(); // sellerId -> products in order

      // Group products by seller
      for (const item of orderProducts) {
        const product = await Product.findByPk(item.productId, {
          attributes: ['sellerId', 'name']
        });
        if (product) {
          if (!sellerNotifications.has(product.sellerId)) {
            sellerNotifications.set(product.sellerId, []);
          }
          sellerNotifications.get(product.sellerId).push({
            name: product.name,
            quantity: item.quantity,
            price: item.price
          });
        }
      }

      // Create notification messages for each seller
      for (const [sellerId, products] of sellerNotifications) {
        const productList = products.map(p => `${p.name} (${p.quantity} x ${p.price} RWF)`).join(', ');
        const totalForSeller = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);

        await Message.create({
          senderId: buyerId || null, // null for guest orders
          receiverId: sellerId,
          productId: null, // Not specific to one product
          orderId: result.id,
          content: `New order #${result.id} received!\nProducts: ${productList}\nTotal: ${totalForSeller.toLocaleString()} RWF\nPlease approve or reject this order.`,
          isRead: false
        });
      }
    } catch (notificationError) {
      console.error('Error sending order notifications:', notificationError);
      // Don't fail the order creation if notifications fail
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: result
    });

  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's orders with pagination
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: orders } = await Order.findAndCountAll({
      where: { buyerId: req.user.id },
      limit: parseInt(limit),
      offset: offset,
      order: [['createdAt', 'DESC']]
    });

    // Parse products and add product details for each order
    const ordersWithParsedProducts = await Promise.all(
      orders.map(async (order) => {
        const orderProducts = JSON.parse(order.products);
        const productsWithDetails = await Promise.all(
          orderProducts.map(async (item) => {
            const product = await Product.findByPk(item.productId, {
              attributes: ['id', 'name', 'price']
            });
            return {
              ...item,
              product: product ? { id: product.id, name: product.name, price: product.price } : null
            };
          })
        );

        return {
          ...order.toJSON(),
          products: productsWithDetails,
          buyerInfo: order.buyerInfo ? JSON.parse(order.buyerInfo) : null
        };
      })
    );

    res.json({
      orders: ordersWithParsedProducts,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit)
      }
    });

  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get orders for seller's products
router.get('/seller', auth, async (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all products by this seller
    const sellerProducts = await Product.findAll({
      where: { sellerId: req.user.id },
      attributes: ['id']
    });

    const productIds = sellerProducts.map(p => p.id);

    if (productIds.length === 0) {
      return res.json({ orders: [] });
    }

    // Find orders containing these products
    const allOrders = await Order.findAll({
      order: [['createdAt', 'DESC']]
    });

    // Filter orders that contain seller's products
    const sellerOrders = allOrders.filter(order => {
      const orderProducts = JSON.parse(order.products);
      return orderProducts.some(item => productIds.includes(item.productId));
    });

    // Add product details to orders
    const ordersWithDetails = await Promise.all(
      sellerOrders.map(async (order) => {
        const orderProducts = JSON.parse(order.products);
        const productsWithDetails = await Promise.all(
          orderProducts.map(async (item) => {
            const product = await Product.findByPk(item.productId, {
              attributes: ['id', 'name', 'price']
            });
            return {
              ...item,
              product: product ? { id: product.id, name: product.name, price: product.price } : null
            };
          })
        );

        return {
          ...order.toJSON(),
          products: productsWithDetails,
          buyerInfo: order.buyerInfo ? JSON.parse(order.buyerInfo) : null
        };
      })
    );

    res.json({ orders: ordersWithDetails });

  } catch (err) {
    console.error('Get seller orders error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update order status (seller or admin) - supports approve/reject actions
router.put('/:id', auth, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Invalid order ID' });
    }

    const { status, action } = req.body;

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check permissions
    let hasPermission = req.user.role === 'admin';

    if (!hasPermission && req.user.role === 'seller') {
      // Check if seller has products in this order
      const orderProducts = JSON.parse(order.products);
      const productIds = orderProducts.map(item => item.productId);

      const sellerProducts = await Product.findAll({
        where: {
          id: productIds,
          sellerId: req.user.id
        }
      });

      hasPermission = sellerProducts.length > 0;
    }

    // Allow buyer to cancel their own pending order
    if (!hasPermission && action === 'cancel' && order.status === 'pending' && req.user.id === order.buyerId) {
      hasPermission = true;
    }

    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }

    let newStatus = status;
    let actionMessage = 'Order status updated successfully';

    // Handle approve/reject/cancel actions
    if (action === 'approve' && order.status === 'pending') {
      newStatus = 'confirmed';
      actionMessage = 'Order approved successfully';
    } else if (action === 'reject' && order.status === 'pending') {
      newStatus = 'cancelled';
      actionMessage = 'Order rejected and stock restored';

      // Restore stock for rejected orders
      const orderProducts = JSON.parse(order.products);
      for (const item of orderProducts) {
        const product = await Product.findByPk(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    } else if (action === 'cancel' && order.status === 'pending') {
      newStatus = 'cancelled';
      actionMessage = 'Order cancelled successfully';

      // Restore stock for cancelled orders
      const orderProducts = JSON.parse(order.products);
      for (const item of orderProducts) {
        const product = await Product.findByPk(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    } else if (status && ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      newStatus = status;
    } else {
      return res.status(400).json({ message: 'Invalid action or status' });
    }

    await order.update({ status: newStatus });

    res.json({
      message: actionMessage,
      order: {
        ...order.toJSON(),
        products: JSON.parse(order.products),
        buyerInfo: order.buyerInfo ? JSON.parse(order.buyerInfo) : null
      }
    });

  } catch (err) {
    console.error('Update order error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;