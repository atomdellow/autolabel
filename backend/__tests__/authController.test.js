const authController = require('../controllers/authController');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const httpMocks = require('node-mocks-http');

jest.mock('../models/User');
jest.mock('jsonwebtoken');

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = httpMocks.createRequest();
    res = httpMocks.createResponse();
    next = jest.fn();
    User.findOne.mockClear();
    User.create.mockClear();
    jwt.sign.mockClear();
    process.env.JWT_SECRET = 'testsecret';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('registerUser', () => {
    it('should return 400 if username, email, or password is not provided', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      await authController.registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Please add all fields');

      req.body = { username: 'TestUser', password: 'password123' };
      await authController.registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Please add all fields');

      req.body = { username: 'TestUser', email: 'test@example.com' };
      await authController.registerUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Please add all fields');
    });

    it('should return 400 if user with the same email already exists', async () => {
      req.body = { username: 'TestUser', email: 'test@example.com', password: 'password123' };
      User.findOne.mockResolvedValueOnce({ _id: 'someId', email: 'test@example.com' });
      await authController.registerUser(req, res);
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('User with this email already exists');
    });

    it('should return 400 if user with the same username already exists', async () => {
      req.body = { username: 'ExistingUser', email: 'new@example.com', password: 'password123' };
      User.findOne.mockResolvedValueOnce(null);
      User.findOne.mockResolvedValueOnce({ _id: 'someId', username: 'ExistingUser' });
      await authController.registerUser(req, res);
      expect(User.findOne).toHaveBeenCalledWith({ email: 'new@example.com' });
      expect(User.findOne).toHaveBeenCalledWith({ username: 'ExistingUser' });
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('User with this username already exists');
    });

    it('should create a new user and return 201 with token', async () => {
      req.body = { username: 'NewUser', email: 'new@example.com', password: 'password123' };
      User.findOne.mockResolvedValue(null);
      const mockUser = { _id: 'newUserId', username: 'NewUser', email: 'new@example.com' };
      User.create.mockResolvedValue(mockUser);
      jwt.sign.mockReturnValue('mocktoken');

      await authController.registerUser(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'new@example.com' });
      expect(User.findOne).toHaveBeenCalledWith({ username: 'NewUser' });
      expect(User.create).toHaveBeenCalledWith({
        username: 'NewUser',
        email: 'new@example.com',
        password: 'password123',
      });
      expect(jwt.sign).toHaveBeenCalledWith({ id: 'newUserId' }, 'testsecret', { expiresIn: '30d' });
      expect(res.statusCode).toBe(201);
      expect(res._getJSONData()).toEqual({
        _id: 'newUserId',
        username: 'NewUser',
        email: 'new@example.com',
        token: 'mocktoken',
      });
    });

    it('should return 400 if User.create returns null (invalid user data scenario)', async () => {
      req.body = { username: 'InvalidUser', email: 'invalid@example.com', password: 'password123' };
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(null);

      await authController.registerUser(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Invalid user data');
    });

    it('should handle Mongoose validation errors during registration', async () => {
      req.body = { username: 'BadData', email: 'baddata@example.com', password: 'short' };
      const validationError = {
        name: 'ValidationError',
        errors: {
          password: { message: 'Password too short' },
          email: { message: 'Invalid email format' }
        }
      };
      User.findOne.mockResolvedValue(null);
      User.create.mockRejectedValue(validationError);

      await authController.registerUser(req, res);

      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Password too short. Invalid email format');
    });

    it('should handle other server errors during registration', async () => {
      req.body = { username: 'ErrorUser', email: 'error@example.com', password: 'password123' };
      User.findOne.mockResolvedValue(null);
      User.create.mockRejectedValue(new Error('Generic database error'));
      
      await authController.registerUser(req, res);
      
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData().message).toBe('Server error during registration'); 
    });
  });

  describe('loginUser', () => {
    it('should return 400 if email or password is not provided', async () => {
      req.body = { password: 'password123' };
      await authController.loginUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Please provide email and password');

      req.body = { email: 'test@example.com' };
      await authController.loginUser(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Please provide email and password');
    });

    it('should return 401 for invalid credentials (user not found)', async () => {
      req.body = { email: 'nonexistent@example.com', password: 'password123' };
      User.findOne.mockResolvedValue(null);
      
      await authController.loginUser(req, res);
      
      expect(User.findOne).toHaveBeenCalledWith({ email: 'nonexistent@example.com' });
      expect(res.statusCode).toBe(401);
      expect(res._getJSONData().message).toBe('Invalid email or password');
    });

    it('should return 401 for invalid credentials (password incorrect)', async () => {
      req.body = { email: 'test@example.com', password: 'wrongpassword' };
      const mockUserInstance = { 
        _id: 'userId', 
        username: 'TestUser', 
        email: 'test@example.com', 
        comparePassword: jest.fn().mockResolvedValue(false)
      };
      User.findOne.mockResolvedValue(mockUserInstance);
      
      await authController.loginUser(req, res);
      
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockUserInstance.comparePassword).toHaveBeenCalledWith('wrongpassword');
      expect(res.statusCode).toBe(401);
      expect(res._getJSONData().message).toBe('Invalid email or password');
    });

    it('should login user and return 200 with token', async () => {
      req.body = { email: 'test@example.com', password: 'password123' };
      const mockUserInstance = { 
        _id: 'userId', 
        username: 'TestUser', 
        email: 'test@example.com',
        comparePassword: jest.fn().mockResolvedValue(true)
      };
      User.findOne.mockResolvedValue(mockUserInstance);
      jwt.sign.mockReturnValue('mocklogintoken');

      await authController.loginUser(req, res);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(mockUserInstance.comparePassword).toHaveBeenCalledWith('password123');
      expect(jwt.sign).toHaveBeenCalledWith({ id: 'userId' }, 'testsecret', { expiresIn: '30d' });
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual({
        _id: 'userId',
        username: 'TestUser',
        email: 'test@example.com',
        token: 'mocklogintoken',
      });
    });

    it('should handle errors during login (e.g., User.findOne fails)', async () => {
      req.body = { email: 'error@example.com', password: 'password123' };
      User.findOne.mockRejectedValue(new Error('Database find error'));
      
      await authController.loginUser(req, res);
      
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData().message).toBe('Server error during login');
    });

    it('should handle errors during login (e.g., comparePassword fails)', async () => {
      req.body = { email: 'error@example.com', password: 'password123' };
      const mockUserInstance = { 
        _id: 'userId', 
        username: 'TestUser', 
        email: 'test@example.com',
        comparePassword: jest.fn().mockRejectedValue(new Error('bcrypt error'))
      };
      User.findOne.mockResolvedValue(mockUserInstance);
      
      await authController.loginUser(req, res);
      
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData().message).toBe('Server error during login');
    });
  });
});
