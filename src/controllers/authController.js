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
