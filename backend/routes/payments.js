const express = require('express');
const { Payment, Order } = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();

// Input validation middleware
const validatePayment = (req, res, next) => {
  const { orderId, method } = req.body;

  if (!orderId || isNaN(parseInt(orderId))) {
    return res.status(400).json({ message: 'Valid order ID is required' });
  }

  if (!['mtn_momo', 'airtel_money', 'credit_card'].includes(method)) {
    return res.status(400).json({ message: 'Valid payment method is required' });
  }

  next();
};

// Initiate payment
router.post('/', auth, validatePayment, async (req, res) => {
  try {
    const { orderId, method } = req.body;
    const order = await Order.findByPk(parseInt(orderId));

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.buyerId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Order already paid' });
    }

    // Mock payment integration
    // In real app, integrate with MTN Momo API, Airtel Money, Stripe, etc.
    const payment = await Payment.create({
      orderId: order.id,
      amount: order.totalAmount,
      method,
      status: 'completed', // Mock as completed
      transactionId: `mock_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // Update order payment status
    await order.update({ paymentStatus: 'paid' });

    res.json({
      message: 'Payment successful',
      payment: {
        id: payment.id,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        transactionId: payment.transactionId,
        createdAt: payment.createdAt
      }
    });

  } catch (err) {
    console.error('Payment creation error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get payments for user
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Get user's orders
    const userOrders = await Order.findAll({
      where: { buyerId: req.user.id },
      attributes: ['id']
    });

    const orderIds = userOrders.map(order => order.id);

    if (orderIds.length === 0) {
      return res.json({
        payments: [],
        pagination: { total: 0, page: 1, pages: 0, limit: parseInt(limit) }
      });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows: payments } = await Payment.findAndCountAll({
      where: { orderId: orderIds },
      limit: parseInt(limit),
      offset: offset,
      order: [['createdAt', 'DESC']],
      include: [{
        model: Order,
        as: 'order',
        attributes: ['id', 'totalAmount', 'status']
      }]
    });

    res.json({
      payments,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit)
      }
    });

  } catch (err) {
    console.error('Get payments error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;