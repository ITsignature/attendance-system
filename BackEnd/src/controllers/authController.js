const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { asyncHandler } = require('../middleware/errorHandlerMiddleware');

const authController = {
  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const db = getDB();
    
    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    const user = users[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    const token = jwt.sign(
      { userId: user.id, clientId: user.client_id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
    
    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      }
    });
  }),

  register: asyncHandler(async (req, res) => {
    const { name, email, password, clientId } = req.body;
    const db = getDB();
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, client_id) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, clientId]
    );
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        userId: result.insertId
      }
    });
  })
};

module.exports = authController;