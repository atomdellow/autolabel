const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Fallback JWT secret in case the environment variable is not set
const JWT_SECRET = process.env.JWT_SECRET || '93d0e8c755b994ff1e53fe69f73b6fdb78fa834c91319453e5854f2b3d067e4a';

// Generate JWT
const generateToken = (id) => {
    console.log(`[authController.js] generateToken - Generating token for User ID: ${id}`);
    console.log(`[authController.js] JWT_SECRET status: ${JWT_SECRET ? 'Available' : 'Missing'}`);
    
    return jwt.sign({ id }, JWT_SECRET, {
        expiresIn: '30d', // Token expires in 30 days
    });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    console.log(`[authController.js] Enter registerUser - Body keys: ${Object.keys(req.body)}`);
    const { username, email, password } = req.body;

    try {
        // Basic validation
        if (!username || !email || !password) {
            console.log(`[authController.js] registerUser - Missing fields. Username: ${username}, Email: ${email}, Password provided: ${!!password}`);
            return res.status(400).json({ message: 'Please add all fields' });
        }

        // Check if user already exists (by email or username)
        console.log(`[authController.js] registerUser - Checking if user exists with email: ${email} or username: ${username}`);
        const userExistsByEmail = await User.findOne({ email });
        if (userExistsByEmail) {
            console.log(`[authController.js] registerUser - User with email ${email} already exists.`);
            return res.status(400).json({ message: 'User with this email already exists' });
        }
        const userExistsByUsername = await User.findOne({ username });
        if (userExistsByUsername) {
            console.log(`[authController.js] registerUser - User with username ${username} already exists.`);
            return res.status(400).json({ message: 'User with this username already exists' });
        }

        // Create user (password will be hashed by pre-save hook in User model)
        console.log(`[authController.js] registerUser - Creating user with username: ${username}, email: ${email}`);
        const user = await User.create({
            username,
            email,
            password,
        });

        if (user) {
            console.log(`[authController.js] registerUser - User ${user.username} (ID: ${user._id}) created successfully.`);
            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            console.log(`[authController.js] registerUser - User creation failed for username: ${username}.`);
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        // Handle Mongoose validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            console.error(`[authController.js] registerUser - Validation error:`, messages.join('. '));
            return res.status(400).json({ message: messages.join('. ') });
        }
        console.error(`[authController.js] registerUser - Server error:`, error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

// @desc    Authenticate a user (login)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    console.log(`[authController.js] Enter loginUser - Email: ${req.body.email}, Password provided: ${!!req.body.password}`);
    const { email, password } = req.body;

    try {
        // Basic validation
        if (!email || !password) {
            console.log(`[authController.js] loginUser - Missing email or password.`);
            return res.status(400).json({ message: 'Please provide email and password' });
        }

        // Check for user by email
        console.log(`[authController.js] loginUser - Attempting to find user with email: ${email}`);
        const user = await User.findOne({ email });

        if (user && (await user.comparePassword(password))) {
            console.log(`[authController.js] loginUser - User ${user.username} (ID: ${user._id}) authenticated successfully.`);
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                token: generateToken(user._id),
            });
        } else {
            console.log(`[authController.js] loginUser - Invalid credentials for email: ${email}. User found: ${!!user}`);
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        console.error(`[authController.js] loginUser - Server error:`, error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

module.exports = {
    registerUser,
    loginUser,
};
