const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, checkAdminRole, checkDashboardAccess } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt'); 


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
// 0. API TỔNG QUAN (Statistics) 
// ==========================================================

router.get('/stats', async (req, res) => {
    try {
        const [totalProductsResult] = await db.execute('SELECT COUNT(id) AS total FROM Products');
        const [totalUsersResult] = await db.execute('SELECT COUNT(id) AS total FROM Users');
        const [totalOrdersResult] = await db.execute('SELECT COUNT(id) AS total FROM Orders');
        const [totalRevenueResult] = await db.execute('SELECT SUM(total_amount) AS revenue FROM Orders WHERE status = "delivered"');

        const stats = {
            totalProducts: totalProductsResult[0].total,
            totalUsers: totalUsersResult[0].total,
            totalOrders: totalOrdersResult[0].total,
            totalRevenue: totalRevenueResult[0].revenue || 0 
        };

        res.json(stats);
    } catch (error) {
        console.error('Lỗi lấy thống kê:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi lấy thống kê.' });
    }
});


// ==========================================================
// 1. API QUẢN LÝ SẢN PHẨM (Products)
// ==========================================================

// GET: Lấy tất cả sản phẩm
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

// POST: Thêm sản phẩm (Chỉ Admin)
router.post('/products', checkAdminRole, upload.single('imageFile'), async (req, res) => {
    const { name, price, quantity, description } = req.body;
    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    try {
        const [result] = await db.execute(
            'INSERT INTO Products (name, price, quantity, description, image_url) VALUES (?, ?, ?, ?, ?)',
            [name, price, quantity, description, image_url]
        );
        res.status(201).json({ message: 'Thêm sản phẩm thành công', id: result.insertId });
    } catch (error) {
        console.error('Lỗi POST sản phẩm:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
             if (req.file) fs.unlinkSync(req.file.path);
             return res.status(409).json({ message: 'Lỗi: Tên sản phẩm đã tồn tại.' });
        }
        
        if (req.file) fs.unlinkSync(req.file.path);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

// PUT: Cập nhật sản phẩm (Chỉ Admin)
router.put('/products/:id', checkAdminRole, upload.single('imageFile'), async (req, res) => {
    const { id } = req.params;
    const { name, price, quantity, description } = req.body;

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

// DELETE: Xóa sản phẩm (Chỉ Admin)
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
// 2. API QUẢN LÝ NGƯỜI DÙNG (Users)
// ==========================================================

// GET: Lấy tất cả người dùng (READ: Admin/Employee) 
router.get('/users', async (req, res) => {
    const { role } = req.query; 
    
    let query = 'SELECT id, username, email, role, created_at FROM Users';
    let params = [];

    if (role) {
        query += ' WHERE role = ?';
        params.push(role);
    }
    
    try {
        const [users] = await db.execute(query, params);
        res.json(users);
    } catch (error) {
        console.error('Lỗi lấy người dùng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

// GET: Lấy chi tiết 1 người dùng
router.get('/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.execute('SELECT id, username, email, role, created_at FROM Users WHERE id = ?', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Người dùng không tồn tại.' });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});

// PUT: Cập nhật người dùng (UPDATE: Chỉ Admin)
router.put('/users/:id', checkAdminRole, async (req, res) => {
    const { username, role } = req.body;
    const userId = parseInt(req.params.id);
    
    const validRoles = ['employee', 'admin']; 
    if (role && !validRoles.includes(role)) {
        return res.status(400).json({ message: 'Vai trò cập nhật không hợp lệ (Chỉ chấp nhận admin hoặc employee).' });
    }

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

// DELETE: Xóa người dùng (Chỉ Admin)
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

// MỚI: POST: Đăng ký Khách hàng mới (Sử dụng bởi Admin/Employee trong Dashboard)
router.post('/users/register-customer', async (req, res) => {
    const { username, email, password } = req.body;
    const defaultRole = 'customer'; 
    
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ Tên, Email và Mật khẩu.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await db.execute(
            'INSERT INTO Users (username, email, password, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, defaultRole]
        );
        
        res.status(201).json({ 
            message: 'Đăng ký khách hàng thành công.', 
            id: result.insertId,
            username: username,
            email: email
        });
    } catch (error) {
        console.error('Lỗi đăng ký khách hàng:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Lỗi: Email đã được sử dụng.' });
        }
        res.status(500).json({ message: 'Lỗi máy chủ khi đăng ký.' });
    }
});


// ==========================================================
// 3. API QUẢN LÝ ĐƠN HÀNG (Orders)
// ==========================================================

// POST: Thêm Đơn hàng (CREATE: Admin/Employee)
router.post('/orders', async (req, res) => {
    const { user_id, items } = req.body; 
    
    if (!user_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Dữ liệu đơn hàng không hợp lệ.' });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction(); 

        let total_amount = 0;
        const products_in_order = [];

        // 1. Kiểm tra tồn kho và tính tổng tiền
        for (const item of items) {
            const [product_rows] = await connection.execute('SELECT name, price, quantity FROM Products WHERE id = ?', [item.product_id]);
            
            if (product_rows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ message: `Sản phẩm ID ${item.product_id} không tồn tại.` });
            }

            const product = product_rows[0];
            if (product.quantity < item.quantity) {
                await connection.rollback();
                return res.status(400).json({ message: `Sản phẩm ${product.name} chỉ còn ${product.quantity} sản phẩm. Vui lòng giảm số lượng.` });
            }

            const item_price = product.price; 
            total_amount += item.quantity * item_price;
            products_in_order.push({ ...item, price: item_price, current_stock: product.quantity, name: product.name });
        }

        // 2. Thêm vào bảng Orders
        const [order_result] = await connection.execute(
            'INSERT INTO Orders (user_id, total_amount, status) VALUES (?, ?, "pending")',
            [user_id, total_amount]
        );
        const order_id = order_result.insertId;

        // 3. Thêm vào bảng OrderDetails và cập nhật tồn kho
        for (const item of products_in_order) {
            await connection.execute(
                'INSERT INTO OrderDetails (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
                [order_id, item.product_id, item.quantity, item.price]
            );

            // Cập nhật tồn kho
            const new_quantity = item.current_stock - item.quantity;
            await connection.execute(
                'UPDATE Products SET quantity = ? WHERE id = ?',
                [new_quantity, item.product_id]
            );
        }

        await connection.commit(); 
        res.status(201).json({ message: `Thêm đơn hàng #${order_id} thành công.`, order_id });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Lỗi POST đơn hàng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ khi tạo đơn hàng.' });
    } finally {
        if (connection) connection.release();
    }
});


// GET: Lấy danh sách Đơn hàng
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

// GET: Lấy chi tiết 1 Đơn hàng
router.get('/orders/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [details] = await db.execute(`
            SELECT 
                OD.quantity, OD.price, P.name as product_name, P.image_url
            FROM OrderDetails OD
            JOIN Products P ON OD.product_id = P.id
            WHERE OD.order_id = ?
        `, [id]);
        res.json(details);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ.' });
    }
});


// PUT: Cập nhật trạng thái Đơn hàng (Chỉ Admin)
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