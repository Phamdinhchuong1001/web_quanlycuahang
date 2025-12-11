// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// API Đăng Ký
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    let role;

    if (email.endsWith('@nhanvien.com')) {
        role = 'employee';
    } else if (email.endsWith('@gmail.com')) {
        role = 'customer';
    } else if (email === 'admin@admin.com') { // Ngăn đăng ký tài khoản Admin cố định
        return res.status(400).json({ message: 'Không thể đăng ký tài khoản Admin.' });
    } else {
        return res.status(400).json({ message: 'Đuôi email không hợp lệ.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute(
            'INSERT INTO Users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, role]
        );
        res.status(201).json({ message: 'Đăng ký thành công!', role });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Email đã tồn tại.' });
        }
        console.error('Lỗi đăng ký:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

// API Đăng Nhập (Không thay đổi)
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const [rows] = await db.execute('SELECT * FROM Users WHERE email = ?', [email]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng.' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ message: 'Đăng nhập thành công', token, role: user.role });
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;