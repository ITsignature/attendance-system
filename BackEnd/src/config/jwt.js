const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const generateTokens = (payload) => {
  const jti = uuidv4(); // Unique token identifier
  
  const accessToken = jwt.sign(
    { 
      ...payload, 
      jti,
      type: 'access' 
    },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRES_IN,
      issuer: 'hrms-api',
      audience: 'hrms-client'
    }
  );

  const refreshToken = jwt.sign(
    { 
      userId: payload.userId,
      jti,
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
      issuer: 'hrms-api',
      audience: 'hrms-client'
    }
  );

  return { accessToken, refreshToken, jti };
};

const verifyToken = (token, type = 'access') => {
  const secret = type === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
  
  return jwt.verify(token, secret, {
    issuer: 'hrms-api',
    audience: 'hrms-client'
  });
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateTokens,
  verifyToken,
  decodeToken
};
