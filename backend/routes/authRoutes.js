const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { get, run } = require('../config/db');

const router = express.Router();
const hashOtp = (value) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(value).digest('hex');

const { BrevoClient } = require('@getbrevo/brevo');
const brevoClient = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

const sendOtpEmail = async (email, otp, isProduction) => {
  const isConfigured = process.env.BREVO_API_KEY && !process.env.BREVO_API_KEY.includes('your-brevo-api-key') && process.env.BREVO_FROM_EMAIL && !process.env.BREVO_FROM_EMAIL.includes('your-verified-sender');
  if (!isProduction || !isConfigured) {
    console.info(`Development OTP for ${email}: ${otp}`);
    if (isProduction && !isConfigured) {
      console.warn('Brevo email is not configured; OTP logged to console instead.');
    }
    return;
  }
  await brevoClient.transactionalEmails.sendTransacEmail({
    sender: { name: process.env.BREVO_FROM_NAME || 'Academic Record Portal', email: process.env.BREVO_FROM_EMAIL },
    to: [{ email }],
    subject: 'Your academic portal verification code',
    textContent: `Your sign-in code is ${otp}. It expires in five minutes.`
  });
};

router.post('/login', [body('loginId').trim().notEmpty().isLength({ max: 100 }), body('password').isString().isLength({ min: 8, max: 128 })], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid login details' });
  const { loginId, password } = req.body;
  try {
    const user = await get('SELECT id,login_id,email,password_hash,role,display_name,status,otp_attempts,locked_until,token_version FROM users WHERE login_id=?', [loginId.trim()]);
    const passwordMatches = await bcrypt.compare(password, user?.password_hash || '');
    if (!user || user.status !== 'active' || (user.locked_until && new Date(user.locked_until) > new Date()) || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials or temporarily locked account' });
    }
    const isAdmin = user.role === 'admin';
    const otp = String(crypto.randomInt(100000, 1000000));
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await run("UPDATE users SET otp_hash=?, otp_expires_at=?, otp_attempts=0 WHERE id=?", [hashOtp(otp), otpExpires, user.id]);
    const otpEmail = isAdmin ? process.env.ADMIN_EMAIL : user.email;
    await sendOtpEmail(otpEmail, otp, process.env.NODE_ENV === 'production');
    res.json({ mfaRequired: true, userId: user.id, message: 'A verification code was sent to your registered email.' });
  } catch (error) { console.error('Login error:', error.message); res.status(500).json({ error: 'Unable to start sign in' }); }
});

router.post('/verify-otp', [body('userId').isInt({ min: 1 }), body('otp').matches(/^\d{6}$/)], async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'A valid account and six-digit code are required' });
  const { userId, otp } = req.body;
  try {
    const user = await get('SELECT id,login_id,role,display_name,status,otp_hash,otp_expires_at,otp_attempts,locked_until,token_version FROM users WHERE id=?', [userId]);
    if (!user || user.status !== 'active' || (user.locked_until && new Date(user.locked_until) > new Date()) || !user.otp_expires_at || new Date(user.otp_expires_at) < new Date()) return res.status(401).json({ error: 'Code expired or account temporarily locked' });
    if (hashOtp(otp) !== user.otp_hash) {
      await run("UPDATE users SET otp_attempts=otp_attempts+1 WHERE id=?", [user.id]);
      return res.status(401).json({ error: 'Incorrect verification code' });
    }
    const consumed = await run('UPDATE users SET otp_hash=NULL,otp_expires_at=NULL,otp_attempts=0,locked_until=NULL WHERE id=? AND otp_hash=? AND otp_expires_at>? AND (locked_until IS NULL OR locked_until<=?) RETURNING id',[user.id,hashOtp(otp),new Date().toISOString(),new Date().toISOString()]);
    if(!consumed.changes) return res.status(401).json({error:'Code has already been used or expired'});
    const token = jwt.sign({ id: user.id, role: user.role, loginId: user.login_id, version: user.token_version || 0 }, process.env.JWT_SECRET, { expiresIn: '2h', issuer: 'academic-record-portal', audience: 'academic-record-portal-client' });
    res.json({ token, user: { id: user.id, loginId: user.login_id, role: user.role, displayName: user.display_name } });
  } catch (error) { console.error('OTP verification error:', error.message); res.status(500).json({ error: 'Unable to verify code' }); }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'academic-record-portal', audience: 'academic-record-portal-client' });
    const user = await get('SELECT id,login_id,email,role,display_name,program,department,status FROM users WHERE id=?', [decoded.id]);
    res.json(user);
  } catch (error) { console.error('Get current user error:', error.message); res.status(500).json({ error: 'Unable to get user profile' }); }
});

module.exports = router;
