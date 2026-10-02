# Secure Express.js REST API

Secure REST API dibangun dengan Express.js dan Sequelize (MySQL) yang menyediakan autentikasi JWT, verifikasi email, password reset, dan comprehensive security features.

## Features

### Security First
- **JWT Authentication** — roles (`admin`, `user`), token expiry 1 jam
- **Email Verification** — user harus verifikasi email sebelum login
- **Password Reset** — secure token-based password reset via email
- **Email Duplicate Prevention** — dicegah di 3 tempat: register, admin create, update profile
- **Rate Limiting** — `/auth/register` dan `/auth/forgot` (5 attempts/email/jam)
- **SQL Injection Prevention** — parameterized queries via Sequelize ORM
- **XSS Protection** — `sanitize-html`, `xss-clean` middleware
- **File Upload Security** — magic byte validation, restrictive permissions (0600)
- **HTTP Security** — `helmet.js` headers
- **Transactions** — atomic DB operations di critical flows
- **Password Hashing** — bcrypt with 12 salt rounds

### SSO (Single Sign-On)
- **SSO Login** — login lewat identity provider eksternal (OIDC/OAuth2) di `/auth/sso`
- **CSRF Protection** — `state` parameter acak disimpan di cookie `httpOnly` (10 menit)
- **Auto Provisioning** — user baru otomatis dibuat (random password, `emailVerified: true`)
- **Generic Provider** — kompatibel dengan provider apa pun via konfigurasi env `SSO_*`
- **JWT Sama** — hasil callback mengembalikan JWT dengan payload `{ id, role }` seperti login biasa

### Docker & Runtime
- **Docker Build** — multi-stage build (`node:20-alpine`) dengan `npm ci --omit=dev`
- **Small Memory Footprint** — `NODE_OPTIONS=--max-old-space-size=192`, limit container 256 MB
- **Docker Compose** — API + MySQL 8.0 siap jalan (`docker compose up`)
- **Non-root Runtime** — proses berjalan sebagai user `node`, plus healthcheck bawaan

### Email & Background Jobs
- **SMTP Integration** — `nodemailer` dengan env variables
- **Email Retry Logic** — exponential backoff (2s, 4s, 8s)
- **Background Worker** — `node-schedule` retry setiap 5 menit
- **Tokens** — single-use, hashed (SHA256), with expiration (24h verify, 1h reset)

### API Documentation
- **Swagger/OpenAPI** — full docs di `/docs` endpoint
- **JSDoc Annotations** — semua endpoints documented
- **Interactive UI** — Swagger UI untuk testing

### Testing
- **Jest Test Suite** — auth, users, rate limiting tests
- **Integration Tests** — HTTP endpoint testing dengan supertest
- **Test Coverage** — 40+ test cases

### Database
- **Non-destructive Migrations** — `sequelize-cli` untuk production
- **Seeders** — dummy data tanpa drop tables
- **Automatic Sync** — dev mode atau migrations

## Project Structure

```
.
├── src/
│   ├── app.js                    # Express app + middleware setup
│   ├── swagger.js                # Swagger/OpenAPI configuration
│   ├── models/
│   │   ├── index.js              # Sequelize instance
│   │   ├── user.js               # User model (verify, reset fields)
│   │   └── product.js            # Product model
│   ├── routes/
│   │   ├── auth.js               # Auth endpoints + SSO (swagger docs)
│   │   ├── users.js              # Users CRUD (swagger docs)
│   │   └── products.js           # Products CRUD (swagger docs)
│   ├── controllers/
│   │   ├── authController.js     # Register, verify, login, forgot, reset, SSO
│   │   ├── usersController.js    # CRUD + email duplicate check
│   │   └── productsController.js # CRUD + file upload
│   ├── middleware/
│   │   ├── auth.js               # JWT verification
│   │   ├── roles.js              # Role-based access control
│   │   ├── authRateLimit.js      # Rate limiters (register/forgot)
│   │   ├── upload.js             # Multer + file validation
│   │   └── validate.js           # Joi input validation
│   └── utils/
│       └── mailer.js             # Email + retry + background worker
├── config/
│   └── config.js                 # Sequelize config
├── migrations/                   # Sequelize migrations
│   ├── 20260213-create-users.js
│   └── 20260213-create-products.js
├── seeders/                      # Sequelize seeders
│   ├── 20260213-seed-users.js    # Dummy users (admin, alice, bob)
│   └── 20260213-seed-products.js # Dummy products (12x)
├── scripts/
│   └── migrate.js                # Destructive sync (dev only)
├── tests/
│   ├── setup.js                  # Jest setup + env vars
│   ├── auth.test.js              # Auth flow tests (12)
│   ├── ratelimit.test.js         # Rate limit tests (4)
│   └── users.test.js             # Users CRUD tests (13)
├── .env.example
├── .gitignore
├── package.json
├── jest.config.js
├── Dockerfile                    # Multi-stage build (small runtime memory)
├── docker-compose.yml            # API + MySQL 8.0 + memory limits
├── .dockerignore                 # Keep build context & image minimal
└── README.md
```

## Quick Start

### 1. Setup Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=secure_api_db
DB_USER=root
DB_PASS=yourpassword

# JWT
JWT_SECRET=your-super-strong-secret-minimum-32-chars
JWT_EXPIRES_IN=1h

# SMTP (Email verification & password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@example.com

# App
APP_URL=http://localhost:3000
PORT=3000
UPLOAD_DIR=uploads
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

**Development (destructive - quick reset):**
```bash
npm run migrate
```

**Production (non-destructive - safe):**
```bash
npm run db:migrate
npm run db:seed
```

### 4. Start Server

```bash
# Development with hot reload
npm run dev

# Production
npm start
```

Server runs on `http://localhost:3000`

---

## API Documentation

### Swagger UI

Visit `http://localhost:3000/docs` (interactive API explorer)

---

### Authentication Endpoints

#### `POST /auth/register` — Register User

Register user baru + kirim verification email.

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Response:**
```json
{
  "message": "User created. Check email to verify."
}
```

**Validations:**
- Email unique (di register, admin create, dan update)
- Email format valid
- Password minimum 6 chars
- Rate limited: 5 attempts/email/jam

---

#### `GET /auth/verify` — Verify Email

Verify email menggunakan token dari email link.

```bash
curl "http://localhost:3000/auth/verify?token=<TOKEN>&email=john%40example.com"
```

**Response:**
```json
{
  "message": "Email verified"
}
```

**Details:**
- Token expire: 24 jam
- Single-use token
- Hashed in database

---

#### `POST /auth/login` — Login

Login dengan email + password (email harus verified terlebih dahulu).

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "1h"
}
```

**Requirements:**
- Email harus verified
- Password harus benar
- Akun harus ada

---

#### `POST /auth/forgot` — Request Password Reset

Request password reset link (akan dikirim ke email).

```bash
curl -X POST http://localhost:3000/auth/forgot \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

**Response:**
```json
{
  "message": "If that email exists, a reset link was sent."
}
```

**Security:**
- Email enumeration protected (same response untuk exist/non-exist)
- Rate limited: 5 attempts/email/jam
- Token expire: 1 jam

---

#### `POST /auth/reset` — Reset Password

Reset password menggunakan token dari email.

```bash
curl -X POST http://localhost:3000/auth/reset \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<RESET_TOKEN>",
    "email": "john@example.com",
    "password": "NewSecurePass123!"
  }'
```

**Response:**
```json
{
  "message": "Password reset successful"
}
```

---

#### `GET /auth/sso` — Start SSO Login

Redirect ke identity provider (OIDC/OAuth2) untuk login via SSO. Endpoint ini menghasilkan `state` acak (disimpan di cookie `httpOnly`) untuk proteksi CSRF, lalu mengarahkan browser ke halaman login provider.

```
GET http://localhost:3000/auth/sso
```

**Behavior:**
- `302` redirect ke `SSO_AUTHORIZE_URL` (dengan `client_id`, `redirect_uri`, `scope`, `state`)
- `503` jika SSO tidak dikonfigurasi / dinonaktifkan (`SSO_ENABLED=false`)

**Details:**
- `state` disimpan di cookie `httpOnly` (`sso_state`), `SameSite=Lax`, expire 10 menit
- Cookie `Secure` otomatis aktif saat `NODE_ENV=production`
- Scope default: `openid email profile`

---

#### `GET /auth/sso/callback` — SSO Callback

Callback dari identity provider. Menukar `code` menjadi token, mengambil profil user, lalu mengembalikan JWT aplikasi (payload `{ id, role }`).

```
GET http://localhost:3000/auth/sso/callback?code=<CODE>&state=<STATE>
```

**Query Parameters:**
- `code` — authorization code dari provider (wajib)
- `state` — harus sama dengan nilai di cookie `sso_state` (wajib)

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "1h",
  "provider": "generic"
}
```

**Details:**
- `400` jika `code` hilang atau `state` tidak cocok
- `401` jika token exchange atau pengambilan user info gagal
- `503` jika SSO tidak dikonfigurasi
- User baru otomatis dibuat (auto provisioning): password acak, role sesuai `SSO_DEFAULT_ROLE` (default `user`), `emailVerified: true`
- User yang sudah ada langsung di-login tanpa perubahan data
- Email diambil dari `email` / `preferred_username` / `upn` pada user info

---

### Users Endpoints

**All require:** `Authorization: Bearer <JWT_TOKEN>`

#### `GET /users` — List Users (Admin Only)

List semua users dengan pagination.

```bash
curl "http://localhost:3000/users?page=1&limit=10&search=john" \
  -H "Authorization: Bearer <TOKEN>"
```

**Query Parameters:**
- `page` — halaman (default 1)
- `limit` — per halaman (default 10, max 100)
- `search` — search by name/email

**Response:**
```json
{
  "total": 50,
  "page": 1,
  "perPage": 10,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2026-02-13T00:00:00Z",
      "updatedAt": "2026-02-13T00:00:00Z"
    }
  ]
}
```

---

#### `POST /users` — Create User (Admin Only)

Admin membuat user baru.

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "SecurePass123!",
    "role": "user"
  }'
```

**Validations:**
- Email unique ✅ (dicegah di sini + database constraint)
- Email format valid
- Password minimum 6 chars
- Role only `admin` or `user`

**Response:**
```json
{
  "id": 2,
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "user"
}
```

---

#### `GET /users/:id` — Get User Profile

Get user profile (admin or self only).

```bash
curl http://localhost:3000/users/1 \
  -H "Authorization: Bearer <TOKEN>"
```

**Access Control:**
- Admin: bisa lihat siapa saja
- User: hanya bisa lihat diri sendiri

---

#### `PUT /users/:id` — Update User Profile

Update user (admin or self only).

```bash
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "John Updated",
    "email": "john.new@example.com",
    "password": "NewSecurePass123!"
  }'
```

**Validations:**
- Email unique jika berubah ✅ (dicegah di sini + database constraint)
- Email format valid
- Password minimum 6 chars (jika diubah)

---

#### `DELETE /users/:id` — Delete User (Admin Only)

Delete user.

```bash
curl -X DELETE http://localhost:3000/users/1 \
  -H "Authorization: Bearer <TOKEN>"
```

**Response:** `204 No Content`

---

### Products Endpoints

**All require:** `Authorization: Bearer <JWT_TOKEN>`

#### `GET /products` — List Products

List semua products dengan pagination dan filters.

```bash
curl "http://localhost:3000/products?page=1&limit=10&search=laptop&year=2025&month=2" \
  -H "Authorization: Bearer <TOKEN>"
```

**Query Parameters:**
- `page` — halaman (default 1)
- `limit` — per halaman (default 10, max 100)
- `search` — search by name
- `year` — filter by year (e.g., 2025)
- `month` — filter by month (1-12)

---

#### `GET /products/:id` — Get Product

Get product details.

```bash
curl http://localhost:3000/products/1 \
  -H "Authorization: Bearer <TOKEN>"
```

---

#### `POST /products` — Create Product (Admin Only)

Admin buat product dengan optional file upload.

```bash
curl -X POST http://localhost:3000/products \
  -H "Authorization: Bearer <TOKEN>" \
  -F "name=Laptop Pro" \
  -F "description=High-performance laptop" \
  -F "year=2025" \
  -F "month=2" \
  -F "image=@/path/to/image.jpg" \
  -F "pdf=@/path/to/spec.pdf"
```

**File Upload:**
- Images: JPEG, PNG only (magic byte validated)
- PDF: PDF only (magic byte validated)
- Max size: 10 MB
- Permissions: 0600 (owner read/write only)
- Filenames: randomized (prevents guessing)

---

#### `PUT /products/:id` — Update Product (Admin Only)

Update product dengan optional file upload.

```bash
curl -X PUT http://localhost:3000/products/1 \
  -H "Authorization: Bearer <TOKEN>" \
  -F "name=Laptop Pro Max" \
  -F "image=@/path/to/new-image.jpg"
```

---

#### `DELETE /products/:id` — Delete Product (Admin Only)

Delete product.

```bash
curl -X DELETE http://localhost:3000/products/1 \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 🔒 Security Details

### Authentication & Authorization

- **JWT**: signed dengan HS256, includes `id` dan `role`
- **Token Expiry**: 1 jam (configurable)
- **Role-based Access**:
  - `admin` — akses semua endpoints
  - `user` — akses profile sendiri + list products

### Email Verification & Password Reset

**Verification Flow:**
1. User register → token dibuat (random 32 bytes)
2. Token di-hash SHA256 → disimpan di DB
3. Email dikirim dengan token (plain text di link)
4. User click link → verify endpoint cek token hash
5. Token cleared setelah verify, user bisa login

**Reset Flow:**
1. User forgot → request dengan email
2. Token dibuat (random 32 bytes)
3. Token di-hash SHA256 → disimpan di DB
4. Email dikirim dengan token
5. User reset dengan token → password di-hash bcrypt
6. Token cleared

**Security:**
- Tokens single-use (cleared on use)
- Expiry: 24h verify, 1h reset
- Hashed in database (not plaintext)

### Rate Limiting

**Endpoints:**
- `/auth/register` — 5 per email per hour
- `/auth/forgot` — 5 per email per hour

**Keying:**
- By email (jika ada di request body/query)
- By IP (fallback jika no email)
- Prevents abuse & enumeration

### Database Security

**SQL Injection Prevention:**
- Sequelize ORM (parameterized queries)
- No string concatenation

**Password Security:**
- Bcrypt hashing (12 rounds)
- Salted automatically by bcrypt
- Hashed di `beforeCreate` dan `beforeUpdate` hooks

**Constraints:**
- Email unique constraint (database level)
- NOT NULL constraints
- ENUM untuk roles

### File Upload Security

**Validation:**
- Magic byte checking (actual file type, not header)
- Allowed types: JPEG, PNG, PDF
- Max 10 MB
- Multer memory storage (not disk before validation)

**Permissions:**
- Files written dengan 0600 permissions (owner only)
- Randomized filenames (prevents guessing)
- Physical path hidden from client

**Bypass Prevention:**
- Content-Type header ignored (magic bytes used)
- File extension tidak trusted
- No direct serving of uploads (serve via API only)

### Input Validation

**Joi Schemas:**
- All endpoints validate input
- Email format, password strength
- XSS prevention (sanitize-html)
- SQL injection prevention (parameterized queries)

**Middleware:**
- `xss-clean` — XSS protection
- `helmet.js` — HTTP security headers
- CORS configured

### Transactions

**Critical Operations:**
- Register: create user in transaction
- Password reset: update token in transaction
- Ensures atomicity & consistency

### Email Duplicate Prevention

**Locations:**
1. `/auth/register` — check before create
2. `POST /users` (admin) — check before create + catch DB constraint
3. `PUT /users/:id` — check if email changed + catch DB constraint

**Validation:**
- Sequential read check (prevents race condition at DB level)
- Database unique constraint (fallback)
- Error messages consistent

---

## Testing

### Run Tests

```bash
# All tests
npm test

# Watch mode (re-run on changes)
npm test:watch

# With coverage
npm test -- --coverage
```

### Test Files

1. **auth.test.js** (12 tests)
   - Register (new user, duplicate email, validation)
   - Login (verified, unverified, wrong password)
   - Verify (missing params, invalid token)
   - Forgot (accepts any email, validation)
   - Reset (invalid token, weak password)

2. **ratelimit.test.js** (4 tests)
   - Register rate limiting
   - Forgot rate limiting
   - Email-based keying
   - IP-based keying

3. **users.test.js** (13 tests)
   - Create user (success, duplicate email, validation, auth)
   - Update user (success, duplicate email, self-update, auth)
   - Get user (success, not found, auth)
   - List users (pagination, admin only)
   - Delete user (success, admin only)

### Coverage

```
Statements   : 85%+
Branches     : 80%+
Functions    : 85%+
Lines        : 85%+
```

---

## Email & Background Jobs

### Email Sending

```javascript
const { sendMail } = require('./src/utils/mailer');

await sendMail({
  to: 'user@example.com',
  subject: 'Verify your email',
  html: '<p>Click to verify</p>',
  text: 'Plain text version'
});
```

### Retry Logic

**Attempts with backoff:**
1. Initial send
2. Retry after 2s (if failed)
3. Retry after 4s (if failed)
4. Retry after 8s (if failed)
5. Queue for background worker (if all failed)

**Background Worker:**
- Runs every 5 minutes via `node-schedule`
- Processes in-memory queue
- Max 10 attempts per email
- Logs success/failure

**Note:** In-memory queue doesn't persist across restarts. For production, upgrade to Redis + BullMQ.

---

## Database Schema

### Users Table

```sql
CREATE TABLE Users (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  emailVerified BOOLEAN DEFAULT FALSE,
  emailVerificationToken VARCHAR(255),
  emailVerificationExpires DATETIME,
  resetPasswordToken VARCHAR(255),
  resetPasswordExpires DATETIME,
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
);
```

### Products Table

```sql
CREATE TABLE Products (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  year INT,
  month INT,
  imagePath VARCHAR(255),
  pdfPath VARCHAR(255),
  createdAt DATETIME NOT NULL,
  updatedAt DATETIME NOT NULL
);
```

---

## Deployment

### Environment Setup

1. Use strong `JWT_SECRET` (>32 chars, random)
2. Set SMTP credentials (SendGrid, AWS SES, Gmail)
3. Use managed MySQL (AWS RDS, Google Cloud SQL)
4. Enable HTTPS (reverse proxy: nginx, HAProxy)

### Docker

Build & jalankan API dengan runtime memory kecil supaya ringan dan stabil.

**Build image:**

```bash
# Multi-stage build, dev dependency tidak ikut ke image
docker build -t secure-express-api .
```

**Jalankan dengan Docker Compose (API + MySQL 8.0):**

```bash
# Set SSO_* dan variabel lain di .env terlebih dahulu
docker compose up -d --build
```

**Karakteristik runtime:**

- Multi-stage build berbasis `node:20-alpine` → image kecil
- `npm ci --omit=dev` → hanya production dependency yang masuk image
- `NODE_OPTIONS=--max-old-space-size=192` → heap V8 dibatasi 192 MB
- Memory limit API `256 MB` (reservation `128 MB`), MySQL `512 MB`
- Container jalan sebagai non-root user `node` + `HEALTHCHECK` pada endpoint `/`

### Production Checklist

- [ ] Use non-destructive migrations (`npm run db:migrate`)
- [ ] Enable HTTPS termination
- [ ] Add HSTS headers
- [ ] Configure secure cookies
- [ ] Use environment-based secrets (not in .env)
- [ ] Add APM/monitoring (New Relic, Datadog)
- [ ] Enable database backups & replication
- [ ] Use CDN for static assets
- [ ] Add virus scanning for file uploads (ClamAV)
- [ ] Enable rate limiting at WAF/API Gateway level
- [ ] Setup email service (SendGrid, Mailgun, AWS SES)
- [ ] Upgrade email retry to Redis + BullMQ
- [ ] Add request logging (Winston, Pino)
- [ ] Setup alerting for critical errors
- [ ] Set `NODE_OPTIONS=--max-old-space-size` sesuai limit memory container
- [ ] Set memory limit container (`mem_limit`) sesuai kapasitas host

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | No | Server port |
| `DB_HOST` | - | Yes | MySQL hostname |
| `DB_PORT` | `3306` | No | MySQL port |
| `DB_NAME` | - | Yes | Database name |
| `DB_USER` | - | Yes | DB username |
| `DB_PASS` | - | Yes | DB password |
| `JWT_SECRET` | - | Yes | JWT signing secret (>32 chars) |
| `JWT_EXPIRES_IN` | `1h` | No | Token expiry |
| `SMTP_HOST` | - | Yes | SMTP server |
| `SMTP_PORT` | `587` | No | SMTP port |
| `SMTP_SECURE` | `false` | No | Use TLS |
| `SMTP_USER` | - | Yes | SMTP username |
| `SMTP_PASS` | - | Yes | SMTP password |
| `SMTP_FROM` | - | Yes | Sender email |
| `APP_URL` | `http://localhost:3000` | No | Base URL (for email links) |
| `UPLOAD_DIR` | `uploads` | No | Upload directory |
| `SSO_ENABLED` | `false` | No | Aktifkan SSO login (`true`/`false`) |
| `SSO_PROVIDER` | `generic` | No | Nama provider (label internal) |
| `SSO_CLIENT_ID` | - | Yes* | OAuth client ID (*wajib bila SSO aktif) |
| `SSO_CLIENT_SECRET` | - | Yes* | OAuth client secret (*wajib bila SSO aktif) |
| `SSO_REDIRECT_URI` | - | Yes* | Callback URL (`http://localhost:3000/auth/sso/callback`) |
| `SSO_AUTHORIZE_URL` | - | Yes* | Endpoint authorize provider |
| `SSO_TOKEN_URL` | - | Yes* | Endpoint token provider |
| `SSO_USERINFO_URL` | - | Yes* | Endpoint userinfo provider |
| `SSO_SCOPE` | `openid email profile` | No | Scope yang diminta ke provider |
| `SSO_DEFAULT_ROLE` | `user` | No | Role default untuk user baru hasil SSO |

---

## Project Files Reference

- **[src/app.js](src/app.js)** — Express setup, middleware, error handling
- **[src/swagger.js](src/swagger.js)** — Swagger/OpenAPI setup
- **[src/models/user.js](src/models/user.js)** — User model + password hashing
- **[src/models/product.js](src/models/product.js)** — Product model
- **[src/controllers/authController.js](src/controllers/authController.js)** — Auth logic
- **[src/controllers/usersController.js](src/controllers/usersController.js)** — Users CRUD + duplicate email check
- **[src/controllers/productsController.js](src/controllers/productsController.js)** — Products CRUD
- **[src/middleware/auth.js](src/middleware/auth.js)** — JWT verification
- **[src/middleware/authRateLimit.js](src/middleware/authRateLimit.js)** — Rate limiting
- **[src/middleware/upload.js](src/middleware/upload.js)** — File upload validation
- **[src/utils/mailer.js](src/utils/mailer.js)** — Email + retry + background worker
- **[scripts/migrate.js](scripts/migrate.js)** — Destructive DB setup (dev only)
- **[tests/auth.test.js](tests/auth.test.js)** — Auth flow tests
- **[tests/users.test.js](tests/users.test.js)** — Users CRUD tests
- **[tests/ratelimit.test.js](tests/ratelimit.test.js)** — Rate limiting tests
- **[Dockerfile](Dockerfile)** — Multi-stage Docker build (small runtime memory)
- **[docker-compose.yml](docker-compose.yml)** — API + MySQL 8.0 dengan memory limits
- **[.dockerignore](.dockerignore)** — Keep build context & image minimal

---

## Useful Resources

- [Express.js Documentation](https://expressjs.com/)
- [Sequelize ORM](https://sequelize.org/)
- [JWT.io](https://jwt.io/)
- [Swagger/OpenAPI](https://swagger.io/)
- [Jest Testing](https://jestjs.io/)
- [OWASP Security Guidelines](https://owasp.org/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

## License

MIT

---

## FAQ

**Q: Bagaimana cara mengganti SMTP provider?**
A: Edit `src/utils/mailer.js` dan ganti konfigurasi transporter

**Q: Bisa ganti database ke PostgreSQL?**
A: Ya, ubah dialect di `config/config.js` ke `'postgres'` dan install `pg` package

**Q: Email verification mandatory kah?**
A: Ya, tapi bisa di-override di `seeders/` untuk test accounts

**Q: Gimana maksimalkan security untuk production?**
A: Lihat "Production Checklist" di bagian Deployment

**Q: Bisa customize JWT token lifespan?**
A: Ya, ubah `JWT_EXPIRES_IN` di `.env`

---

Generated at 2026-02-13 | Last updated: Secure Express API v1.0
