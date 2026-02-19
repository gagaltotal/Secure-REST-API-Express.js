// Set test environment variables directly (no .env.test file needed)
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3306';
process.env.DB_NAME = 'secure_api_test';
process.env.DB_USER = 'root';
process.env.DB_PASS = 'password';
process.env.JWT_SECRET = 'test-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.UPLOAD_DIR = 'uploads-test';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '1025';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASS = 'test';
process.env.SMTP_FROM = 'test@example.com';
process.env.APP_URL = 'http://localhost:3001';

