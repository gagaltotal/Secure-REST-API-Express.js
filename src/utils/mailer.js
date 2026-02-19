const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Simple in-memory queue for failed emails (in production use Redis or database)
const emailQueue = [];

async function sendMailWithRetry({ to, subject, html, text }, attempt = 0, maxRetries = 3) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  
  try {
    const result = await transporter.sendMail({ from, to, subject, html, text });
    console.log(`Email sent to ${to}:`, result.messageId);
    return result;
  } catch (err) {
    console.error(`Email send failed attempt ${attempt + 1}/${maxRetries + 1}:`, err.message);
    
    if (attempt < maxRetries) {
      // Wait and retry (exponential backoff: 2s, 4s, 8s)
      const delay = Math.pow(2, attempt + 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendMailWithRetry({ to, subject, html, text }, attempt + 1, maxRetries);
    }
    
    // After max retries, queue for background retry
    const job = { to, subject, html, text, retries: 0, createdAt: new Date() };
    emailQueue.push(job);
    console.log(`Email queued for background retry (queue size: ${emailQueue.length})`);
    
    throw new Error(`Email send failed after ${maxRetries + 1} attempts: ${err.message}`);
  }
}

async function sendMail({ to, subject, html, text }) {
  return sendMailWithRetry({ to, subject, html, text });
}

// Background job to retry queued emails every 5 minutes
function startEmailRetryWorker() {
  const schedule = require('node-schedule');
  schedule.scheduleJob('*/5 * * * *', async () => {
    if (emailQueue.length === 0) return;
    
    console.log(`[EmailRetryWorker] Processing ${emailQueue.length} queued emails`);
    
    while (emailQueue.length > 0) {
      const job = emailQueue.shift();
      
      try {
        await sendMailWithRetry(job, 0, 3);
        console.log(`[EmailRetryWorker] Email sent to ${job.to}`);
      } catch (err) {
        job.retries = (job.retries || 0) + 1;
        
        // Re-queue if retries < 10
        if (job.retries < 10) {
          emailQueue.push(job);
          console.log(`[EmailRetryWorker] Re-queued email to ${job.to} (attempts: ${job.retries})`);
        } else {
          console.error(`[EmailRetryWorker] Gave up on ${job.to} after 10 attempts`);
        }
      }
    }
  });
  
  console.log('[EmailRetryWorker] Started');
}

module.exports = { sendMail, startEmailRetryWorker };
