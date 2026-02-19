const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const jwt = require('jsonwebtoken');

describe('Users Endpoints', () => {
  let adminToken;
  let userId;

  beforeAll(async () => {
    await sequelize.sync({ force: true });

    // Create an admin user for testing
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'AdminPass123!',
      role: 'admin',
      emailVerified: true
    });

    // Create a regular user for testing
    const user = await User.create({
      name: 'Regular User',
      email: 'user@test.com',
      password: 'UserPass123!',
      role: 'user',
      emailVerified: true
    });

    userId = user.id;

    // Generate admin token
    adminToken = jwt.sign(
      { id: admin.id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /users - Create user (admin only)', () => {
    it('should create a new user with valid data', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New User',
          email: 'newuser@test.com',
          password: 'Password123!',
          role: 'user'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.email).toBe('newuser@test.com');
      expect(res.body.id).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate User',
          email: 'user@test.com', // Email already exists
          password: 'Password123!',
          role: 'user'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Email already in use');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test',
          email: 'not-an-email',
          password: 'Password123!',
          role: 'user'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test',
          email: 'test2@test.com',
          password: '123',
          role: 'user'
        });

      expect(res.statusCode).toBe(400);
    });

    it('should reject non-admin users', async () => {
      const userToken = jwt.sign(
        { id: userId, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .post('/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Unauthorized User',
          email: 'unauth@test.com',
          password: 'Password123!',
          role: 'user'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('PUT /users/:id - Update user', () => {
    it('should update user profile', async () => {
      const res = await request(app)
        .put(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Name',
          email: 'updated@test.com'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.email).toBe('updated@test.com');
    });

    it('should reject duplicate email during update', async () => {
      // First create another user
      const newUser = await User.create({
        name: 'Another User',
        email: 'another@test.com',
        password: 'Password123!',
        role: 'user',
        emailVerified: true
      });

      // Try to update user with email that already exists
      const res = await request(app)
        .put(`/users/${newUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'admin@test.com' // Email of existing admin user
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Email already in use');
    });

    it('should allow user to update their own profile', async () => {
      const userToken = jwt.sign(
        { id: userId, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .put(`/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Self Updated Name'
        });

      expect(res.statusCode).toBe(200);
    });

    it('should reject user updating other user profile', async () => {
      const otherUser = await User.create({
        name: 'Other User',
        email: 'otheruser@test.com',
        password: 'Password123!',
        role: 'user',
        emailVerified: true
      });

      const userToken = jwt.sign(
        { id: userId, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .put(`/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Hacked Name'
        });

      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /users/:id - Get user', () => {
    it('should get user profile', async () => {
      const res = await request(app)
        .get(`/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(userId);
      expect(res.body.password).toBeUndefined(); // Password should not be returned
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .get('/users/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /users - List users (admin only)', () => {
    it('should list users with pagination', async () => {
      const res = await request(app)
        .get('/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data[0].password).toBeUndefined();
    });

    it('should reject non-admin users', async () => {
      const userToken = jwt.sign(
        { id: userId, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/users?page=1&limit=10')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('DELETE /users/:id - Delete user (admin only)', () => {
    it('should delete user', async () => {
      const tempUser = await User.create({
        name: 'Temp User',
        email: 'temp@test.com',
        password: 'Password123!',
        role: 'user',
        emailVerified: true
      });

      const res = await request(app)
        .delete(`/users/${tempUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toBe(204);

      // Verify user is deleted
      const getRes = await request(app)
        .get(`/users/${tempUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.statusCode).toBe(404);
    });

    it('should reject non-admin deletion', async () => {
      const userToken = jwt.sign(
        { id: userId, role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .delete(`/users/${userId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(403);
    });
  });
});
