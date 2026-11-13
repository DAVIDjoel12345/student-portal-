import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
const {BOOTSTRAP_ADMIN_LOGIN,BOOTSTRAP_ADMIN_EMAIL,BOOTSTRAP_ADMIN_PASSWORD,BOOTSTRAP_ADMIN_NAME}=process.env;
if(!BOOTSTRAP_ADMIN_LOGIN||!BOOTSTRAP_ADMIN_EMAIL||!BOOTSTRAP_ADMIN_PASSWORD||BOOTSTRAP_ADMIN_PASSWORD.length<12){console.error('Set BOOTSTRAP_ADMIN_LOGIN, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters.');process.exit(1);}
try{const hash=await bcrypt.hash(BOOTSTRAP_ADMIN_PASSWORD,12);await pool.query('INSERT INTO users(login_id,email,password_hash,role,display_name) VALUES($1,$2,$3,$4,$5) ON CONFLICT(login_id) DO NOTHING',[BOOTSTRAP_ADMIN_LOGIN,BOOTSTRAP_ADMIN_EMAIL,hash,'admin',BOOTSTRAP_ADMIN_NAME||'Portal Administrator']);console.log('Bootstrap administrator created if the login ID was unused.');}catch(error){console.error('Bootstrap failed:',error.message);process.exitCode=1;}finally{await pool.end();}
