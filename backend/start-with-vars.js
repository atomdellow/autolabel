// Directly set environment variables for development
// This approach bypasses the need for dotenv 
process.env.JWT_SECRET = '93d0e8c755b994ff1e53fe69f73b6fdb78fa834c91319453e5854f2b3d067e4a';
process.env.PORT = '5001';
process.env.MONGO_URI = 'mongodb://localhost:27017/autolabel';

// Dynamically import and run the server
require('./server');
