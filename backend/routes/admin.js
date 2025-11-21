const express = require('express');
const { Op } = require('sequelize');
const { User, Order, Product } = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin access
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Get all sellers with pagination
router.get('/sellers', auth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = { role: 'seller' };
    if (status === 'approved') whereClause.isApproved = true;
    if (status === 'pending') whereClause.isApproved = false;

    const { count, rows: sellers } = await User.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'phone', 'address', 'isApproved', 'createdAt']
    });

    res.json({
      sellers,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit)
      }
    });

  } catch (err) {
    console.error('Get sellers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Approve/Reject seller
router.put('/sellers/:id/status', auth, requireAdmin, async (req, res) => {
  try {
    const sellerId = parseInt(req.params.id);
    const { approved } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ message: 'Approved status must be boolean' });
    }

    const seller = await User.findByPk(sellerId);
    if (!seller || seller.role !== 'seller') {
      return res.status(404).json({ message: 'Seller not found' });
    }

    await seller.update({ isApproved: approved });

    res.json({
      message: `Seller ${approved ? 'approved' : 'rejected'} successfully`,
      seller: {
        id: seller.id,
        name: seller.name,
        email: seller.email,
        isApproved: seller.isApproved
      }
    });

  } catch (err) {
    console.error('Update seller status error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all users (admin only)
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = {};
    if (role) whereClause.role = role;

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit),
      offset: offset,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'name', 'email', 'role', 'phone', 'isApproved', 'createdAt']
    });

    res.json({
      users,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit)
      }
    });

  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Sales reports
router.get('/reports/sales', auth, requireAdmin, async (req, res) => {
  try {
    const { period = 'daily' } = req.query;

    let dateFilter;
    const now = new Date();

    switch (period) {
      case 'daily':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    const orders = await Order.findAll({
      where: {
        createdAt: { [Op.gte]: dateFilter }
      },
      attributes: ['totalAmount', 'createdAt']
    });

    const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const orderCount = orders.length;
    const averageOrderValue = orderCount > 0 ? totalSales / orderCount : 0;

    res.json({
      period,
      totalSales,
      orderCount,
      averageOrderValue,
      dateRange: {
        from: dateFilter.toISOString(),
        to: now.toISOString()
      }
    });

  } catch (err) {
    console.error('Sales report error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Platform statistics
router.get('/stats', auth, requireAdmin, async (req, res) => {
  try {
    const [
      totalUsers,
      totalSellers,
      approvedSellers,
      totalProducts,
      totalOrders,
      recentOrders
    ] = await Promise.all([
      User.count(),
      User.count({ where: { role: 'seller' } }),
      User.count({ where: { role: 'seller', isApproved: true } }),
      Product.count(),
      Order.count(),
      Order.count({
        where: {
          createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    res.json({
      users: {
        total: totalUsers,
        sellers: {
          total: totalSellers,
          approved: approvedSellers,
          pending: totalSellers - approvedSellers
        }
      },
      products: totalProducts,
      orders: {
        total: totalOrders,
        recent: recentOrders
      }
    });

  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;