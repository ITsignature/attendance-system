const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const generateTokens = (payload) => {
  console.log('🔍 === TOKEN GENERATION DEBUG ===');
  console.log('🔍 JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN);
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

  const decoded = jwt.decode(accessToken);
  console.log('🔍 Token issued at:', new Date(decoded.iat * 1000));
  console.log('🔍 Token expires at:', new Date(decoded.exp * 1000));
  console.log('🔍 Token valid for:', (decoded.exp - decoded.iat) / 60, 'minutes');
  console.log('🔍 === END TOKEN GENERATION DEBUG ===');

  // Add this to your jwt.js temporarily for debugging
  return { accessToken, refreshToken, jti };
};

const verifyToken = (token, type = 'access') => {
  const secret = type === 'access' ? process.env.JWT_SECRET : process.env.JWT_REFRESH_SECRET;
  
  return jwt.verify(token, secret, {issuer: 'hrms-api',audience: 'hrms-client'});
};

const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateTokens,
  verifyToken,
  decodeToken
};
