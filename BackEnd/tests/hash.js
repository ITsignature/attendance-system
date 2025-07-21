const bcrypt = require('bcryptjs');

const testPassword = async () => {
  const password = 'password123';
  const hash = await bcrypt.hash(password, 12);
  console.log('Password:', password);
  console.log('Generated hash:', hash);
  
  // Test the hash
  const isValid = await bcrypt.compare(password, hash);
  console.log('Hash validation:', isValid);
};

testPassword();