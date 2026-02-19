const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

describe('Auth Endpoints', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'Password123!'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('User created. Check email to verify.');
    });

    it('should reject duplicate email', async () => {
      await User.create({
        name: 'Existing',
        email: 'existing@example.com',
        password: 'hashedpw',
        emailVerified: false
      });

      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test',
          email: 'existing@example.com',
          password: 'Password123!'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Email already in use');
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test',
          email: 'not-an-email',
          password: 'Password123!'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test',
          email: 'test2@example.com',
          password: '123'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await sequelize.sync({ force: true });
      
      const user = await User.create({
        name: 'Login Test',
        email: 'login@example.com',
        password: 'Password123!',
        emailVerified: true
      });
    });

    it('should login verified user and return token', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Password123!'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.expiresIn).toBeDefined();
    });

    it('should reject unverified user', async () => {
      await User.create({
        name: 'Unverified',
        email: 'unverified@example.com',
        password: 'Password123!',
        emailVerified: false
      });

      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'unverified@example.com',
          password: 'Password123!'
        });

      expect(res.statusCode).toBe(403);
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword!'
        });

      expect(res.statusCode).toBe(401);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!'
        });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /auth/verify', () => {
    it('should reject missing parameters', async () => {
      const res = await request(app)
        .get('/auth/verify')
        .query({});

      expect(res.statusCode).toBe(400);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/auth/verify')
        .query({
          token: 'invalid-token',
          email: 'test@example.com'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /auth/forgot', () => {
    it('should accept request without confirming if user exists', async () => {
      const res = await request(app)
        .post('/auth/forgot')
        .send({
          email: 'nonexistent@example.com'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('If that email exists');
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/auth/forgot')
        .send({
          email: 'not-an-email'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /auth/reset', () => {
    it('should reject invalid token', async () => {
      const res = await request(app)
        .post('/auth/reset')
        .send({
          token: 'invalid-token',
          email: 'test@example.com',
          password: 'NewPassword123!'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/auth/reset')
        .send({
          token: 'valid-token',
          email: 'test@example.com',
          password: '123'
        });

      expect(res.statusCode).toBe(400);
    });
  });
});
