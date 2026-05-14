const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Date lipsă' });
  try {
    const { rows } = await db.query(
      'SELECT * FROM utilizatori WHERE email=$1 AND activ=TRUE',
      [email.toLowerCase().trim()]
    );
    if (!rows.length)
      return res.status(401).json({ success: false, message: 'Credențiale invalide' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Credențiale invalide' });
    await db.query('UPDATE utilizatori SET ultima_autentificare=NOW() WHERE id=$1', [user.id]);
    await db.query(
      "INSERT INTO audit_log(id_utilizator,actiune,entitate,detalii,ip_client) VALUES($1,'LOGIN_SUCCESS','utilizatori',$2,$3)",
      [user.id, JSON.stringify({ email: user.email }), req.ip]
    );
    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol, id_farmacie: user.id_farmacie },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '8h' }
    );
    res.json({
      success: true, token,
      user: { id: user.id, email: user.email, rol: user.rol, id_farmacie: user.id_farmacie, nume: user.nume }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Eroare server' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id,email,rol,id_farmacie,nume,ultima_autentificare FROM utilizatori WHERE id=$1',
      [req.user.id]
    );
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
