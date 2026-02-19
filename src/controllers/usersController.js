const Joi = require('joi');
const { User } = require('../models');
const sanitizeHtml = require('sanitize-html');

const listSchema = Joi.object({ page: Joi.number().min(1).default(1), limit: Joi.number().min(1).max(100).default(10), search: Joi.string().allow('', null) });

exports.list = async (req, res, next) => {
  try {
    const { error, value } = listSchema.validate(req.query);
    if (error) return res.status(400).json({ error: error.message });

    const where = {};
    if (value.search) where[Symbol.for('search')] = value.search; // placeholder

    const offset = (value.page - 1) * value.limit;
    const { count, rows } = await User.findAndCountAll({ limit: value.limit, offset, attributes: { exclude: ['password'] } });
    res.json({ total: count, page: value.page, perPage: value.limit, data: rows });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const schema = Joi.object({ name: Joi.string().required(), email: Joi.string().email().required(), password: Joi.string().min(6).required(), role: Joi.string().valid('admin','user').default('user') });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    
    // Check if email already exists
    const existing = await User.findOne({ where: { email: value.email } });
    if (existing) return res.status(400).json({ error: 'Email already in use' });
    
    value.name = sanitizeHtml(value.name);
    const user = await User.create(value);
    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) { 
    // Handle unique constraint error from database
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Email already in use' });
    }
    next(err); 
  }
};

exports.get = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.user.role !== 'admin' && req.user.id !== id) return res.status(403).json({ error: 'Forbidden' });
    const user = await User.findByPk(id, { attributes: { exclude: ['password'] } });
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.user.role !== 'admin' && req.user.id !== id) return res.status(403).json({ error: 'Forbidden' });
    const schema = Joi.object({ name: Joi.string(), email: Joi.string().email(), password: Joi.string().min(6) });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    
    // Check if new email is already in use by another user
    if (value.email && value.email !== user.email) {
      const existing = await User.findOne({ where: { email: value.email } });
      if (existing) return res.status(400).json({ error: 'Email already in use' });
    }
    
    if (value.name) value.name = sanitizeHtml(value.name);
    if (value.password) user.password = value.password; // will be hashed in model hook when saved via save
    if (value.name) user.name = value.name;
    if (value.email) user.email = value.email;
    await user.save();
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) { 
    // Handle unique constraint error from database
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Email already in use' });
    }
    next(err); 
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    await user.destroy();
    res.status(204).end();
  } catch (err) { next(err); }
};
