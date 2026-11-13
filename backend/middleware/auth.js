const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { issuer: 'academic-record-portal', audience: 'academic-record-portal-client' });
    req.user = decoded;
    next();
  } catch (error) { console.error('Token verification error:', error.message); res.status(403).json({ error: 'Invalid token' }); }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
};

module.exports = { authenticateToken, requireRole };
