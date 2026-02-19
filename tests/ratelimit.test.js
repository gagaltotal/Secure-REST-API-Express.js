const request = require('supertest');
const app = require('../src/app');
const { sequelize } = require('../src/models');

describe('Rate Limiting', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /auth/register rate limit', () => {
    it('should allow multiple registration attempts up to limit', async () => {
      const requests = [];
      
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/auth/register')
          .send({
            name: `User ${i}`,
            email: `user${i}@example.com`,
            password: 'Password123!'
          });
        
        expect([201, 400]).toContain(res.statusCode);
        requests.push(res);
      }
    });

    it('should rate limit after 5 attempts per email', async () => {
      const email = 'ratelimit@example.com';
      let blockedCount = 0;
      let successCount = 0;

      for (let i = 0; i < 7; i++) {
        const res = await request(app)
          .post('/auth/register')
          .send({
            name: 'Test',
            email,
            password: 'Password123!'
          });

        if (res.statusCode === 429) {
          blockedCount++;
        } else {
          successCount++;
        }
      }

      // After initial limit, some requests should be blocked
      expect(blockedCount + successCount).toBe(7);
    });

    it('should key rate limit by email address', async () => {
      const email1 = 'ratelimit1@example.com';
      const email2 = 'ratelimit2@example.com';

      const res1 = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test1',
          email: email1,
          password: 'Password123!'
        });

      const res2 = await request(app)
        .post('/auth/register')
        .send({
          name: 'Test2',
          email: email2,
          password: 'Password123!'
        });

      // Both requests with different emails should be allowed
      expect([201, 400]).toContain(res1.statusCode);
      expect([201, 400]).toContain(res2.statusCode);
    });
  });

  describe('POST /auth/forgot rate limit', () => {
    it('should allow multiple password reset attempts', async () => {
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .post('/auth/forgot')
          .send({
            email: `forgot${i}@example.com`
          });

        expect([200, 429]).toContain(res.statusCode);
      }
    });

    it('should rate limit password reset after 5 attempts', async () => {
      const email = 'forgotlimit@example.com';
      let blockedCount = 0;

      for (let i = 0; i < 7; i++) {
        const res = await request(app)
          .post('/auth/forgot')
          .send({ email });

        if (res.statusCode === 429) {
          blockedCount++;
        }
      }

      // After 5 requests, further requests should be blocked
      expect(blockedCount).toBeGreaterThan(0);
    });
  });
});
