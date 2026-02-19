const multer = require('multer');
const FileType = require('file-type');
const path = require('path');
const fs = require('fs').promises;

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

async function validateAndSave(fileBuffer, destDir, allowed) {
  const ft = await FileType.fromBuffer(fileBuffer);
  if (!ft || !allowed.includes(ft.mime)) throw new Error('Invalid file type');
  const ext = ft.ext;
  await fs.mkdir(destDir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const filepath = path.join(destDir, filename);
  await fs.writeFile(filepath, fileBuffer, { mode: 0o600 });
  return filepath;
}

module.exports = { upload, validateAndSave };
