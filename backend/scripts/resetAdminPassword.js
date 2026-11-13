import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

const loginId = process.env.RESET_ADMIN_LOGIN?.trim();
const password = process.env.RESET_ADMIN_PASSWORD;

if (!loginId || !password || password.length < 12 || password.length > 128) {
  console.error('Set RESET_ADMIN_LOGIN and RESET_ADMIN_PASSWORD (12–128 characters).');
  process.exitCode = 1;
} else {
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `UPDATE users
       SET password_hash=$1, otp_hash=NULL, otp_expires_at=NULL,
           otp_attempts=0, locked_until=NULL, updated_at=NOW()
       WHERE login_id=$2 AND role='admin'
       RETURNING id`,
      [passwordHash, loginId],
    );
    if (!result.rowCount) {
      console.error(`No administrator account found with login ID "${loginId}". No account was changed.`);
      process.exitCode = 1;
    } else {
      console.log(`Password reset successfully for administrator "${loginId}".`);
    }
  } catch (error) {
    console.error('Administrator password reset failed:', error.message || error.code || 'Unknown database error');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
