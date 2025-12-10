const express = require('express');
const router = express.Router();
const { login, register, verifyCredentials } = require('../controllers/authController');

router.post('/login', login);
router.post('/register', register);
router.post('/verify', verifyCredentials);

const { sequelize, User } = require('../models');
const bcrypt = require('bcryptjs');

router.get('/emergency-reset-admin', async (req, res) => {
    try {
        const username = 'admin';
        const password = 'admin123';
        const hashedPassword = await bcrypt.hash(password, 10);

        const [user, created] = await User.findOrCreate({
            where: { username },
            defaults: {
                password_hash: hashedPassword, // Fixed: use correct column name
                role: 'admin',
                name: 'Administrador General'
            }
        });

        if (!created) {
            user.password_hash = hashedPassword; // Fixed: use correct column name
            await user.save();
        }

        res.send(`USER: admin <br> PASS: ${password} <br> STATUS: FIXED!`);
    } catch (error) {
        res.status(500).send('ERROR: ' + error.message);
    }
});

module.exports = router;
