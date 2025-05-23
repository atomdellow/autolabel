// Test environment variables loading
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables with explicit path
dotenv.config({ path: path.resolve(__dirname, '.env') });

console.log('Testing environment variables:');
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('PORT:', process.env.PORT);
console.log('MONGO_URI:', process.env.MONGO_URI);
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set (not showing for security)' : 'Not set');
