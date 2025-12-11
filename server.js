// server.js 

const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

// MIDDLEWARE XỬ LÝ DỮ LIỆU VÀ FILE TĨNH
// 1. Phân tích cú pháp JSON (Dùng cho login, register, và các API PUT/POST không có file)
app.use(express.json());

// 2. Phân tích cú pháp URL-encoded data (Cần thiết cho dữ liệu form)
app.use(express.urlencoded({ extended: true }));

// 3. Phục vụ các file tĩnh (HTML, CSS, JS, và quan trọng nhất là thư mục /uploads)
app.use(express.static(path.join(__dirname, 'public')));

// ROUTES API
app.use('/api/auth', authRoutes);      // API Đăng ký, Đăng nhập
app.use('/api', dashboardRoutes);      // API QL Sản phẩm, Người dùng, Đơn hàng

// API mặc định (Chuyển hướng về trang chủ)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Khởi động server
app.listen(port, () => {
    console.log(`Server chạy tại http://localhost:${port}`);
});