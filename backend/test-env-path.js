require('dotenv').config({ path: __dirname + '/.env' });
console.log('All environment variables after explicit path:', process.env.JWT_SECRET);
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('PORT:', process.env.PORT);
console.log('MONGO_URI:', process.env.MONGO_URI);
