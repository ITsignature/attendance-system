const bcrypt = require('bcryptjs');

// Generate password hash for a given password
const generateHash = async (password) => {
  const hash = await bcrypt.hash(password, 12);
  console.log('');
  console.log('====================================');
  console.log('Password Hash Generator');
  console.log('====================================');
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
  console.log('====================================');
  console.log('');
  console.log('Copy this hash to use in your SQL script:');
  console.log(hash);
  console.log('');
};

// Get password from command line argument or use default
const password = process.argv[2] || 'admin123';
generateHash(password);
