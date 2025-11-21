const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../database');
const auth = require('../middleware/auth');

const router = express.Router();

// Input validation middleware
const validateSignup = (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || name.length < 2) {
    return res.status(400).json({ message: 'Name must be at least 2 characters' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ message: 'Valid email is required' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  // No role validation since everyone can buy and sell
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  next();
};

// Signup
router.post('/signup', validateSignup, async (req, res) => {
  const { name, email, password, role, phone, address, location } = req.body;

  try {
    // Check if user exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'user',
      phone: phone?.trim(),
      address: address?.trim(),
      lat: location?.lat || null,
      lng: location?.lng || null
    });

    res.status(201).json({
      message: 'User created successfully',
      user: { id: user.id, name: user.name, role: user.role }
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
router.post('/login', validateLogin, async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('Login attempt for:', email);

    // Find user
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    console.log('User found:', user ? 'yes' : 'no');

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isValidPassword);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        isApproved: user.isApproved
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email', 'role', 'phone', 'address', 'isApproved', 'createdAt']
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });

  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user profile
router.put('/me', auth, async (req, res) => {
  const { name, phone, address, location } = req.body;

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update allowed fields
    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    if (address) user.address = address.trim();
    if (location) {
      user.lat = location.lat;
      user.lng = location.lng;
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        address: user.address
      }
    });

  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;