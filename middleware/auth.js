const jwt = require('jsonwebtoken');
require('dotenv').config();

// Xác thực Token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Token không được cung cấp.' });
    }
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' }); 
        }
        req.user = user; // Lưu thông tin người dùng (id, role)
        next();
    });
};

// Phân quyền Admin
const checkAdminRole = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Chỉ Admin mới có quyền thực hiện thao tác này.' });
    }
    next();
};

// Phân quyền Dashboard 
const checkDashboardAccess = (req, res, next) => {
    next();
};

module.exports = { authenticateToken, checkAdminRole, checkDashboardAccess };