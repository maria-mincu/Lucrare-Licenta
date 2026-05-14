const jwt = require('jsonwebtoken');
const db  = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Token lipsă' });
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const { rows } = await db.query(
      'SELECT id, email, rol, id_farmacie, activ, nume FROM utilizatori WHERE id=$1',
      [decoded.id]
    );
    if (!rows.length || !rows[0].activ)
      return res.status(401).json({ success: false, message: 'Utilizator invalid' });
    req.user = rows[0];
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.rol))
    return res.status(403).json({ success: false, message: 'Acces interzis' });
  next();
};

module.exports = { authenticate, authorize };
