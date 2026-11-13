# Academic Record Portal Backend

Secure Student Academic Record Portal Backend API

## Overview

This is the backend API for a secure student academic record portal. It provides authentication, enrollment management, grade processing, and record access for students, staff, and administrators.

## Features

- **Secure Authentication**: JWT-based authentication with email verification and MFA
- **Role-based Access Control**: Student, Staff, and Admin roles with appropriate permissions
- **Enrollment Management**: Course enrollment, grade submission, and transcript generation
- **Academic Records**: Student GPA calculation, course history, and departmental access control
- **Audit Logging**: Comprehensive logging of all system activities
- **Production Ready**: Security headers, rate limiting, and error handling

## Technology Stack

- **Node.js** (>= 18.0.0)
- **Express.js** Web Framework
- **SQLite** Database (with migrations)
- **bcryptjs** Password Hashing
- **jsonwebtoken** Authentication
- **express-validator** Input Validation
- **helmet** Security Headers
- **cors** Cross-Origin Resource Sharing

## Setup

### Prerequisites

- Node.js (>= 18.0.0)
- npm or yarn

### Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file (if not exists)
cp .env.example .env

# Edit .env with your configuration

# Run database migrations
npm run migrate

# Start the server
npm start
```

### Database

The application uses SQLite with the following schema:

- **users**: User accounts with authentication and role information
- **courses**: Course catalog with credits and department information
- **students**: Student profiles linked to user accounts
- **enrollments**: Course enrollment records with grades
- **audit_logs**: System activity logs

### API Endpoints

#### Authentication
- `POST /api/auth/login` - User login (returns OTP)
- `POST /api/auth/verify-otp` - OTP verification (returns JWT)

#### Student Routes
- `GET /api/student/profile` - Get student profile
- `PATCH /api/student/profile` - Update student profile
- `GET /api/student/enrollments` - Get student enrollments
- `POST /api/student/enrollments` - Request enrollment

#### Staff Routes
- `GET /api/records/stats` - Get department statistics
- `GET /api/records/student/:studentId` - View student records
- `GET /api/records/student/:studentId/transcript` - Generate transcript
- `POST /api/records/enrollment` - Create enrollment
- `PATCH /api/records/enrollment/:enrollmentId/grade` - Submit grade
- `GET /api/records/enrollments` - View all enrollments

#### Admin Routes
- `GET /api/admin/stats` - Get platform statistics
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:userId/status` - Update user status
- `POST /api/admin/users` - Create new user

#### Health Check
- `GET /api/health` - API health status

## Security

- **Authentication**: JWT tokens with expiration and issuer/audience validation
- **Authorization**: Role-based access control for all endpoints
- **Input Validation**: express-validator for all request bodies
- **Rate Limiting**: Express rate limiter for API endpoints
- **Security Headers**: helmet for security headers
- **Password Hashing**: bcryptjs with salt
- **Audit Logging**: All actions logged with user, IP, and details

## Development

### Scripts

- `npm start` - Start the server
- `npm run migrate` - Run database migrations
- `npm run dev` - Start the server (alias for start)

### Testing

To be implemented

## Production

For production deployment:

1. Set `NODE_ENV=production`
2. Configure proper SMTP settings for email verification
3. Use production-grade database (PostgreSQL/MySQL)
4. Set up proper CORS origin
5. Configure environment variables
6 probably need to add more security measures

## License

MIT