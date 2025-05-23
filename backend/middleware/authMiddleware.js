const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Fallback JWT secret in case the environment variable is not set
const JWT_SECRET = process.env.JWT_SECRET || '93d0e8c755b994ff1e53fe69f73b6fdb78fa834c91319453e5854f2b3d067e4a';

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token - using the local constant instead of directly accessing process.env
            const decoded = jwt.verify(token, JWT_SECRET);

            // Get user from the token (select -password to exclude password field)
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            next(); // Proceed to the next middleware or route handler
        } catch (error) {
            console.error('Token verification failed:', error.message);
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ message: 'Not authorized, token failed (invalid signature)' });
            }
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ message: 'Not authorized, token expired' });
            }
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

module.exports = { protect };
