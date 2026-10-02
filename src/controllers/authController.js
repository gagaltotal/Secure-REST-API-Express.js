const Joi = require('joi');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, sequelize } = require('../models');
const { sendMail } = require('../utils/mailer');

const loginSchema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() });

exports.login = async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const user = await User.findOne({ where: { email: value.email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.emailVerified) return res.status(403).json({ error: 'Email not verified' });

    const valid = await user.verifyPassword(value.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

    res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
  } catch (err) { next(err); }
};

// Register - create a user and send verification email
exports.register = async (req, res, next) => {
  try {
    const schema = Joi.object({ name: Joi.string().required(), email: Joi.string().email().required(), password: Joi.string().min(6).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const existing = await User.findOne({ where: { email: value.email } });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // create user inside a transaction to ensure DB atomicity
    let user;
    await sequelize.transaction(async (t) => {
      user = await User.create({ name: value.name, email: value.email, password: value.password, emailVerificationToken: tokenHash, emailVerificationExpires: expires }, { transaction: t });
    });

    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const verifyUrl = `${appUrl}/auth/verify?token=${token}&email=${encodeURIComponent(user.email)}`;

    // send email after commit; if mail fails user still exists but token present — log and return created
    try {
      await sendMail({ to: user.email, subject: 'Verify your email', html: `<p>Please verify your email by clicking <a href="${verifyUrl}">here</a>.</p>`, text: `Verify: ${verifyUrl}` });
    } catch (mailErr) {
      console.error('Failed to send verification email', mailErr);
    }

    res.status(201).json({ message: 'User created. Check email to verify.' });
  } catch (err) { next(err); }
};

// Verify email from token
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token, email } = req.query;
    if (!token || !email) return res.status(400).json({ error: 'Missing token or email' });
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({ where: { email, emailVerificationToken: tokenHash } });
    if (!user) return res.status(400).json({ error: 'Invalid token or email' });
    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) return res.status(400).json({ error: 'Token expired' });
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();
    res.json({ message: 'Email verified' });
  } catch (err) { next(err); }
};

// Request password reset - send email with token
exports.requestPasswordReset = async (req, res, next) => {
  try {
    const schema = Joi.object({ email: Joi.string().email().required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const user = await User.findOne({ where: { email: value.email } });
    if (!user) return res.status(200).json({ message: 'If that email exists, a reset link was sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    // update reset token inside a transaction
    await sequelize.transaction(async (t) => {
      user.resetPasswordToken = tokenHash;
      user.resetPasswordExpires = expires;
      await user.save({ transaction: t });
    });

    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const resetUrl = `${appUrl}/auth/reset?token=${token}&email=${encodeURIComponent(user.email)}`;
    try {
      await sendMail({ to: user.email, subject: 'Password reset', html: `<p>Reset your password: <a href="${resetUrl}">Reset</a></p>`, text: `Reset: ${resetUrl}` });
    } catch (mailErr) {
      console.error('Failed to send reset email', mailErr);
    }

    res.json({ message: 'If that email exists, a reset link was sent.' });
  } catch (err) { next(err); }
};

// Reset password using token
exports.resetPassword = async (req, res, next) => {
  try {
    const schema = Joi.object({ token: Joi.string().required(), email: Joi.string().email().required(), password: Joi.string().min(6).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });

    const tokenHash = crypto.createHash('sha256').update(value.token).digest('hex');
    const user = await User.findOne({ where: { email: value.email, resetPasswordToken: tokenHash } });
    if (!user) return res.status(400).json({ error: 'Invalid token or email' });
    if (user.resetPasswordExpires && new Date() > user.resetPasswordExpires) return res.status(400).json({ error: 'Token expired' });

    user.password = value.password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) { next(err); }
};

// ---------------------------------------------------------------------------
// SSO (Single Sign-On) via OAuth2 / OpenID Connect
// Uses only built-in modules (crypto, global fetch) plus jsonwebtoken.
// Configured through the SSO_* environment variables.
// ---------------------------------------------------------------------------

const SSO_STATE_COOKIE = 'sso_state';

// Minimal cookie reader so we don't need an extra dependency (cookie-parser).
const readCookie = (req, name) => {
  const header = req.headers && req.headers.cookie;
  if (!header) return undefined;
  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return undefined;
};

const ssoConfig = () => ({
  enabled: String(process.env.SSO_ENABLED || 'false').toLowerCase() === 'true',
  provider: process.env.SSO_PROVIDER || 'generic',
  clientId: process.env.SSO_CLIENT_ID || '',
  clientSecret: process.env.SSO_CLIENT_SECRET || '',
  redirectUri: process.env.SSO_REDIRECT_URI || '',
  authorizeUrl: process.env.SSO_AUTHORIZE_URL || '',
  tokenUrl: process.env.SSO_TOKEN_URL || '',
  userInfoUrl: process.env.SSO_USERINFO_URL || '',
  scope: process.env.SSO_SCOPE || 'openid email profile',
  defaultRole: process.env.SSO_DEFAULT_ROLE || 'user'
});

const isSsoConfigured = (cfg) => Boolean(cfg.enabled && cfg.clientId && cfg.authorizeUrl && cfg.tokenUrl && cfg.userInfoUrl);

// Step 1: redirect the browser to the identity provider's authorize endpoint.
exports.ssoAuthorize = async (req, res, next) => {
  try {
    const cfg = ssoConfig();
    if (!isSsoConfigured(cfg)) return res.status(503).json({ error: 'SSO is not enabled or not configured' });

    const state = crypto.randomBytes(24).toString('hex');
    const redirectUri = cfg.redirectUri || `${process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`}/auth/sso/callback`;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: cfg.clientId,
      redirect_uri: redirectUri,
      scope: cfg.scope,
      state
    });

    // Store state in a short-lived httpOnly cookie to protect against CSRF.
    res.cookie(SSO_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000
    });

    const authorizeUrl = `${cfg.authorizeUrl}${cfg.authorizeUrl.includes('?') ? '&' : '?'}${params.toString()}`;
    return res.redirect(authorizeUrl);
  } catch (err) { next(err); }
};

// Step 2: handle the provider callback, exchange the code, provision the user and issue a JWT.
exports.ssoCallback = async (req, res, next) => {
  try {
    const cfg = ssoConfig();
    if (!isSsoConfigured(cfg)) return res.status(503).json({ error: 'SSO is not enabled or not configured' });

    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    const expectedState = readCookie(req, SSO_STATE_COOKIE);
    if (!state || !expectedState || state !== expectedState) {
      return res.status(400).json({ error: 'Invalid SSO state' });
    }
    res.clearCookie(SSO_STATE_COOKIE);

    const redirectUri = cfg.redirectUri || `${process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`}/auth/sso/callback`;

    // Exchange the authorization code for an access token.
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: redirectUri,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret
      })
    });
    if (!tokenRes.ok) return res.status(401).json({ error: 'SSO token exchange failed' });
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) return res.status(401).json({ error: 'SSO token exchange failed' });

    // Fetch the user profile from the provider's userinfo endpoint.
    const userInfoRes = await fetch(cfg.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
    });
    if (!userInfoRes.ok) return res.status(401).json({ error: 'SSO userinfo request failed' });
    const profile = await userInfoRes.json();

    const email = profile.email || profile.preferred_username || profile.upn;
    if (!email) return res.status(400).json({ error: 'SSO provider did not return an email' });
    const name = profile.name || profile.display_name || email.split('@')[0];

    // Find or provision the local user. SSO users get a random password so the
    // existing NOT NULL constraint on the password column is respected.
    let user = await User.findOne({ where: { email } });
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      user = await User.create({
        name,
        email,
        password: randomPassword,
        role: cfg.defaultRole,
        emailVerified: true
      });
    } else if (!user.emailVerified) {
      user.emailVerified = true;
      await user.save();
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

    res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN || '1h', provider: cfg.provider });
  } catch (err) { next(err); }
};
