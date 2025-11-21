const express = require('express');
const { Message, User, Product, Order } = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();

// Send a message
router.post('/', auth, async (req, res) => {
  const { receiverId, productId, content } = req.body;

  try {
    // Validate receiver exists
    const receiver = await User.findByPk(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // If productId is provided, validate it exists
    if (productId) {
      const product = await Product.findByPk(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
    }

    // Create message
    const message = await Message.create({
      senderId: req.user.id,
      receiverId,
      productId: productId || null,
      content: content.trim()
    });

    // Return message with sender info
    const messageWithSender = await Message.findByPk(message.id, {
      include: [{
        model: User,
        as: 'sender',
        attributes: ['name']
      }]
    });

    res.status(201).json({
      message: 'Message sent successfully',
      message: messageWithSender
    });

  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get user's messages (sent and received)
router.get('/', auth, async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: {
        [require('sequelize').Op.or]: [
          { senderId: req.user.id },
          { receiverId: req.user.id }
        ]
      },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['name']
        },
        {
          model: User,
          as: 'receiver',
          attributes: ['name']
        },
        {
          model: Product,
          as: 'product',
          attributes: ['name']
        },
        {
          model: Order,
          as: 'order',
          attributes: ['id', 'status', 'totalAmount', 'products']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(messages);

  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get conversation between two users (optionally about a specific product)
router.get('/conversation/:otherUserId', auth, async (req, res) => {
  const { otherUserId } = req.params;
  const { productId } = req.query;

  try {
    const whereClause = {
      [require('sequelize').Op.or]: [
        { senderId: req.user.id, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: req.user.id }
      ]
    };

    if (productId) {
      whereClause.productId = productId;
    }

    const messages = await Message.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['name']
        },
        {
          model: Product,
          as: 'product',
          attributes: ['name']
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    res.json(messages);

  } catch (err) {
    console.error('Get conversation error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark messages as read
router.put('/read/:otherUserId', auth, async (req, res) => {
  const { otherUserId } = req.params;

  try {
    await Message.update(
      { isRead: true },
      {
        where: {
          senderId: otherUserId,
          receiverId: req.user.id,
          isRead: false
        }
      }
    );

    res.json({ message: 'Messages marked as read' });

  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Handle order actions from messages (approve/reject)
router.put('/order/:messageId', auth, async (req, res) => {
  const { messageId } = req.params;
  const { action } = req.body; // 'approve' or 'reject'

  try {
    const message = await Message.findByPk(messageId, {
      include: [{
        model: Order,
        as: 'order'
      }]
    });

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (!message.orderId) {
      return res.status(400).json({ message: 'This message is not related to an order' });
    }

    if (message.receiverId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if user has products in this order
    const orderProducts = JSON.parse(message.order.products);
    const productIds = orderProducts.map(item => item.productId);

    const sellerProducts = await Product.findAll({
      where: {
        id: productIds,
        sellerId: req.user.id
      }
    });

    if (sellerProducts.length === 0) {
      return res.status(403).json({ message: 'You do not have products in this order' });
    }

    // Update order status
    let newStatus;
    let actionMessage;

    if (action === 'approve' && message.order.status === 'pending') {
      newStatus = 'confirmed';
      actionMessage = 'Order approved successfully';
    } else if (action === 'reject' && message.order.status === 'pending') {
      newStatus = 'cancelled';
      actionMessage = 'Order rejected and stock restored';

      // Restore stock
      for (const item of orderProducts) {
        const product = await Product.findByPk(item.productId);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      }
    } else {
      return res.status(400).json({ message: 'Invalid action or order status' });
    }

    await message.order.update({ status: newStatus });

    // Mark message as read
    await message.update({ isRead: true });

    res.json({
      message: actionMessage,
      order: {
        ...message.order.toJSON(),
        products: orderProducts
      }
    });

  } catch (err) {
    console.error('Order action from message error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;