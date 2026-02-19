const Joi = require('joi');
const sanitizeHtml = require('sanitize-html');
const path = require('path');
const { Product } = require('../models');
const { validateAndSave } = require('../middleware/upload');

const listSchema = Joi.object({ page: Joi.number().min(1).default(1), limit: Joi.number().min(1).max(100).default(10), search: Joi.string().allow('', null), year: Joi.number().integer().min(1900).max(9999), month: Joi.number().integer().min(1).max(12) });

exports.list = async (req, res, next) => {
  try {
    const { error, value } = listSchema.validate(req.query);
    if (error) return res.status(400).json({ error: error.message });
    const where = {};
    if (value.search) where.name = { [require('sequelize').Op.like]: `%${value.search}%` };
    if (value.year) where.year = value.year;
    if (value.month) where.month = value.month;
    const offset = (value.page - 1) * value.limit;
    const { count, rows } = await Product.findAndCountAll({ where, limit: value.limit, offset });
    res.json({ total: count, page: value.page, perPage: value.limit, data: rows });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const schema = Joi.object({ name: Joi.string().required(), description: Joi.string().allow('', null), year: Joi.number().integer().min(1900).max(9999), month: Joi.number().integer().min(1).max(12) });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    value.name = sanitizeHtml(value.name);
    value.description = sanitizeHtml(value.description || '');

    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    if (req.files && req.files.image && req.files.image[0]) {
      const buf = req.files.image[0].buffer;
      value.imagePath = await validateAndSave(buf, uploadDir, ['image/jpeg','image/png']);
    }
    if (req.files && req.files.pdf && req.files.pdf[0]) {
      const buf = req.files.pdf[0].buffer;
      value.pdfPath = await validateAndSave(buf, uploadDir, ['application/pdf']);
    }

    const product = await Product.create(value);
    res.status(201).json(product);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    const schema = Joi.object({ name: Joi.string(), description: Joi.string().allow('', null), year: Joi.number().integer().min(1900).max(9999), month: Joi.number().integer().min(1).max(12) });
    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.message });
    if (value.name) product.name = sanitizeHtml(value.name);
    if (value.description !== undefined) product.description = sanitizeHtml(value.description);
    if (value.year) product.year = value.year;
    if (value.month) product.month = value.month;

    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    if (req.files && req.files.image && req.files.image[0]) {
      const buf = req.files.image[0].buffer;
      product.imagePath = await validateAndSave(buf, uploadDir, ['image/jpeg','image/png']);
    }
    if (req.files && req.files.pdf && req.files.pdf[0]) {
      const buf = req.files.pdf[0].buffer;
      product.pdfPath = await validateAndSave(buf, uploadDir, ['application/pdf']);
    }

    await product.save();
    res.json(product);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    await product.destroy();
    res.status(204).end();
  } catch (err) { next(err); }
};
