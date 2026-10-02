const express = require('express');

const router = express.Router();
const { login, register, verifyEmail, requestPasswordReset, resetPassword, ssoAuthorize, ssoCallback } = require('../controllers/authController');
const { registerLimiter, forgotLimiter } = require('../middleware/authRateLimit');

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: User login
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: JWT token
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 *       429:
 *         description: Rate limited
 */
router.post('/register', registerLimiter, register);

/**
 * @swagger
 * /auth/verify:
 *   get:
 *     summary: Verify email
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified
 */
router.get('/verify', verifyEmail);

/**
 * @swagger
 * /auth/forgot:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset link sent if email exists
 */
router.post('/forgot', forgotLimiter, requestPasswordReset);

/**
 * @swagger
 * /auth/reset:
 *   post:
 *     summary: Reset password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated
 */
router.post('/reset', resetPassword);

/**
 * @swagger
 * /auth/sso:
 *   get:
 *     summary: Start SSO login (redirects to the identity provider)
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to the identity provider authorize endpoint
 *       503:
 *         description: SSO not enabled or not configured
 */
router.get('/sso', ssoAuthorize);

/**
 * @swagger
 * /auth/sso/callback:
 *   get:
 *     summary: SSO callback (exchanges the code and returns a JWT)
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: JWT token
 *       400:
 *         description: Invalid state or missing code
 *       401:
 *         description: Token exchange failed
 *       503:
 *         description: SSO not enabled or not configured
 */
router.get('/sso/callback', ssoCallback);

module.exports = router;
