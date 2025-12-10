const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('--- LOGIN ATTEMPT ---');
        console.log('Received:', { username, password });

        // Find user
        const user = await User.findOne({ where: { username } });
        if (!user) {
            console.log('❌ User not found in DB');
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        console.log('✅ User found:', user.username);
        console.log('Stored Hash:', user.password_hash);

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        console.log('Password Match Result:', isMatch);

        if (!isMatch) {
            console.log('❌ Password mismatch');
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name },
            process.env.JWT_SECRET || 'secret_key_change_me',
            { expiresIn: '12h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const register = async (req, res) => {
    try {
        const { username, password, name, role } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Create user
        const newUser = await User.create({
            username,
            password_hash,
            name,
            role: role || 'counter' // Default to counter if not specified
        });

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: newUser.id,
                username: newUser.username,
                role: newUser.role,
                name: newUser.name
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

const verifyCredentials = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.json({ valid: false, message: 'Credenciales inválidas' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.json({ valid: false, message: 'Credenciales inválidas' });
        }

        if (user.role !== 'admin') {
            return res.json({ valid: false, message: 'No tiene permisos de administrador' });
        }

        res.json({
            valid: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                name: user.name,
            },
        });
    } catch (error) {
        console.error('Verify error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { login, register, verifyCredentials };
