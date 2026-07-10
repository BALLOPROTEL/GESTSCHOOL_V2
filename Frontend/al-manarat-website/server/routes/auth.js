// ════════════════════════════════════════
//  Routes Auth Admin (NeDB version)
// ════════════════════════════════════════
'use strict';

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { collections } = require('../database');
const { JWT_SECRET, requireAuth } = require('../middleware/auth');

const adminCol = () => collections.admins;

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  try {
    const user = await new Promise((r, j) =>
      adminCol().findOne({ email }, (e, d) => e ? j(e) : r(d))
    );

    if (!user) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      admin: { id: user._id, email: user.email, username: user.username, role: user.role }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Données invalides (min 8 caractères)' });
  }

  try {
    const user = await new Promise((r, j) =>
      adminCol().findOne({ _id: req.admin.id }, (e, d) => e ? j(e) : r(d))
    );

    if (!user || !bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    await new Promise((r, j) =>
      adminCol().update({ _id: req.admin.id }, { $set: { password: hash } }, {}, (e) => e ? j(e) : r())
    );

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
