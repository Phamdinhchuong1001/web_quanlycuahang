// routes/dashboard.js (PHIÊN BẢN CUỐI CÙNG VỚI FIX LỖI UPLOAD)

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, checkAdminRole, checkDashboardAccess } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cấu hình Multer để lưu file vào public/uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'public/uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
const ADMIN_FIXED_ID = 1;

// Áp dụng Middleware bảo vệ cho tất cả API Dashboard
router.use(authenticateToken);
router.use(checkDashboardAccess);

// ==========================================================
// 1. API QUẢN LÝ SẢN PHẨM (Products) - ĐÃ FIX LỖI UPLOAD
// ==========================================================

// GET: Lấy tất cả sản phẩm (READ: Admin/Employee)
router.get('/products', async (req, res) => {
    try {
        const [products] = await db.execute('SELECT * FROM Products');
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

// GET: Lấy chi tiết 1 sản phẩm 
router.get('/products/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.execute('SELECT * FROM Products WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Sản phẩm không tồn tại.' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


// POST: Thêm sản phẩm (CREATE: Chỉ Admin) - ĐÃ THÊM upload.single
router.post('/products', checkAdminRole, upload.single('imageFile'), async (req, res) => {
    const { name, price, quantity, description } = req.body;
    // Lấy URL nếu có file
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const [result] = await db.execute(
            'INSERT INTO Products (name, price, quantity, description, image_url) VALUES (?, ?, ?, ?, ?)',
            [name, price, quantity, description, image_url]
        );
        res.status(201).json({ message: 'Thêm sản phẩm thành công', id: result.insertId });
    } catch (error) {
        console.error('Lỗi POST sản phẩm:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

// PUT: Cập nhật sản phẩm (UPDATE: Chỉ Admin) - ĐÃ THÊM upload.single
router.put('/products/:id', checkAdminRole, upload.single('imageFile'), async (req, res) => {
    const { id } = req.params;
    const { name, price, quantity, description } = req.body;

    // Nếu không upload file mới, giữ nguyên URL cũ
    let image_url = req.body.current_image_url;

    if (req.file) {
        image_url = `/uploads/${req.file.filename}`;
    }

    try {
        const [result] = await db.execute(
            'UPDATE Products SET name=?, price=?, quantity=?, description=?, image_url=? WHERE id=?',
            [name, price, quantity, description, image_url, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
        res.json({ message: 'Cập nhật sản phẩm thành công' });
    } catch (error) {
        console.error('Lỗi PUT sản phẩm:', error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

// DELETE: Xóa sản phẩm (DELETE: Chỉ Admin)
router.delete('/products/:id', checkAdminRole, async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.execute('DELETE FROM Products WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
        res.json({ message: 'Xóa sản phẩm thành công' });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


// ==========================================================
// 2. API QUẢN LÝ NGƯỜI DÙNG (Users) - Giữ nguyên
// ==========================================================

// ... (Các API QL Người dùng giữ nguyên) ...
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.execute('SELECT id, username, email, role, created_at FROM Users');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/users/:id', checkAdminRole, async (req, res) => {
    const { username, role } = req.body;
    const userId = parseInt(req.params.id);

    if (userId === ADMIN_FIXED_ID || userId === req.user.id) {
        return res.status(403).json({ message: 'Không được phép sửa đổi vai trò của tài khoản Admin cố định hoặc tài khoản đang đăng nhập.' });
    }

    if (role === 'admin') {
        return res.status(400).json({ message: 'Không thể nâng cấp vai trò lên Admin bằng API này.' });
    }

    try {
        const [result] = await db.execute(
            'UPDATE Users SET username=?, role=? WHERE id=?',
            [username, role, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng để cập nhật.' });
        }

        res.json({ message: 'Cập nhật người dùng thành công' });
    } catch (error) {
        console.error('Lỗi cập nhật người dùng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.delete('/users/:id', checkAdminRole, async (req, res) => {
    const userId = parseInt(req.params.id);

    if (userId === ADMIN_FIXED_ID || userId === req.user.id) {
        return res.status(403).json({ message: 'Không được phép xóa tài khoản Admin cố định hoặc tài khoản đang đăng nhập.' });
    }

    try {
        const [result] = await db.execute('DELETE FROM Users WHERE id = ?', [userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng để xóa.' });
        }

        res.json({ message: 'Xóa người dùng thành công' });
    } catch (error) {
        console.error('Lỗi xóa người dùng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


// ==========================================================
// 3. API QUẢN LÝ ĐƠN HÀNG (Orders) - Giữ nguyên
// ==========================================================



router.get('/orders', async (req, res) => {
    try {
        const [orders] = await db.execute(`
            SELECT 
                O.id, O.order_date, O.total_amount, O.status, U.username as customer_name, U.email as customer_email
            FROM Orders O
            JOIN Users U ON O.user_id = U.id
            ORDER BY O.order_date DESC
        `);
        res.json(orders);
    } catch (error) {
        console.error('Lỗi lấy đơn hàng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.get('/orders/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [details] = await db.execute(`
            SELECT 
                OD.quantity, OD.price, P.name as product_name
            FROM OrderDetails OD
            JOIN Products P ON OD.product_id = P.id
            WHERE OD.order_id = ?
        `, [id]);
        res.json(details);
    } catch (error) {
        console.error('Lỗi lấy chi tiết đơn hàng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

router.put('/orders/:id/status', checkAdminRole, async (req, res) => {
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái đơn hàng không hợp lệ.' });
    }

    try {
        const [result] = await db.execute('UPDATE Orders SET status=? WHERE id=?', [status, id]);

        if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });

        res.json({ message: `Cập nhật trạng thái đơn hàng #${id} thành công: ${status}` });
    } catch (error) {
        console.error('Lỗi cập nhật trạng thái đơn hàng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

module.exports = router;