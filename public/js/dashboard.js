// --- KHAI BÁO BIẾN TOÀN CỤC ---
const authToken = localStorage.getItem('authToken');
const userRole = localStorage.getItem('userRole');
let orderItems = []; 

// --- HÀM HỖ TRỢ CHUNG: TẠO CÁC NÚT SỬA/XÓA BẰNG ICON (CHỈ ADMIN) ---
function getAdminActionButtons(type, id, currentRole, username) {
    let deleteFunc;
    let buttons = '';
    const isProduct = type === 'product';

    if (userRole === 'admin') {
        // Giả định getCurrentUserId() đã được định nghĩa và hoạt động đúng
        if (!isProduct && id === getCurrentUserId()) {
             return '';
        }

        if (isProduct) {
            buttons += `
                <button class="btn btn-warning btn-sm me-1 admin-only" title="Sửa" onclick="editProduct(${id})">
                    <i class="bi bi-pencil-square"></i>
                </button>
            `;
            deleteFunc = `deleteProduct(${id})`;
        } else { // user
            buttons += `
                <button class="btn btn-info btn-sm me-1" title="Chi tiết" onclick="viewUserDetails(${id})">
                    <i class="bi bi-eye"></i>
                </button>
            `;
            buttons += `
                <button class="btn btn-warning btn-sm me-1 admin-only" title="Đổi Vai trò" onclick="changeUserRolePrompt(${id}, '${currentRole}', '${username}')">
                    <i class="bi bi-arrow-repeat"></i>
                </button>
            `;
            deleteFunc = `deleteUser(${id})`;
        }

        buttons += `
            <button class="btn btn-danger btn-sm admin-only" title="Xóa" onclick="${deleteFunc}">
                <i class="bi bi-trash"></i>
            </button>
        `;
    }
    return buttons;
}


// --- HÀM BẢO VỆ TRANG & PHÂN QUYỀN HIỂN THỊ ---
document.addEventListener('DOMContentLoaded', () => {
    if (!authToken) {
        alert('Phiên làm việc đã hết hạn hoặc bạn không có quyền truy cập.');
        window.location.href = 'login.html';
        return;
    }

    // Cập nhật thông tin User trên Sidebar
    const userName = localStorage.getItem('username') || 'User'; 
    document.getElementById('userNameDisplay').textContent = userName;
    document.getElementById('userRoleDisplay').textContent = userRole.toUpperCase();


    if (userRole !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
    }

    // 4. Tải dữ liệu theo trang hiện tại (Dựa trên URL)
    const currentPage = window.location.pathname.split('/').pop();
    
    // Kiểm tra trang hiện tại để gọi hàm load dữ liệu tương ứng
    if (currentPage === 'dashboard.html' || currentPage === 'index.html' || currentPage === '') { 
        fetchStats();       
        loadRecentOrders(); 
    } else if (currentPage === 'manage_products.html') {
        loadProducts();
    } else if (currentPage === 'manage_users.html') {
        loadUsers();
    } else if (currentPage === 'manage_orders.html') {
        loadOrders();
    }
    
    // 5. Thêm listener cho form sản phẩm
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', handleProductFormSubmit);
    }
    
    // 6. Thêm listener reset modal Sản phẩm
    const productModal = document.getElementById('addProductModal');
    if (productModal) {
        productModal.addEventListener('hidden.bs.modal', resetProductModal);
    }

    // 7. Thêm listener cho form Đơn hàng mới
    const orderForm = document.getElementById('orderForm');
    if (orderForm) {
        orderForm.addEventListener('submit', handleOrderFormSubmit);
    }
    
    // 8. Thêm listener cho Modal Đơn hàng mới
    const orderModal = document.getElementById('addOrderModal');
    if (orderModal) {
        // Chỉ load dropdown khi modal hiện ra
        orderModal.addEventListener('show.bs.modal', loadOrdersDropdowns); 
        orderModal.addEventListener('hidden.bs.modal', resetOrderModal);
    }
    
    // 9. Thêm listener cho form Đăng ký Khách hàng 
    const registerCustomerForm = document.getElementById('registerCustomerForm');
    if (registerCustomerForm) {
        registerCustomerForm.addEventListener('submit', registerNewCustomer);
    }
    
    // 10. Load Map nếu đang ở tab store_management (CẦN TÊN TAB CHÍNH XÁC)
    // Cần thêm listener cho tab 'store_management' nếu bạn dùng tab Bootstrap
    const storeTab = document.getElementById('store_management_tab'); // Giả định ID tab
    if (storeTab) {
        storeTab.addEventListener('shown.bs.tab', initializeMap);
    }

});

// --- HÀM CHUNG: GỌI API KÈM TOKEN (Dùng cho JSON/FormData) ---
async function apiCall(endpoint, method = 'GET', body = null, isFormData = false) {
    const headers = {};
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    let config = { method, headers };

    if (!isFormData && body) {
        headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
        config.body = body;
    }

    try {
        // Chú ý: Dùng /api/endpoint vì router của bạn đặt ở /api
        const response = await fetch(`/api/${endpoint}`, config); 

        if (response.status === 401 || response.status === 403) {
            alert(`Lỗi ${response.status}: ${await response.json().then(data => data.message) || "Không có quyền truy cập hoặc phiên hết hạn."}`);
            logout();
            return null;
        }

        if (response.status === 204 || (response.status === 200 && response.headers.get('content-length') === '0')) {
            return { message: 'Thao tác thành công.' };
        }
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
             return response.json();
        } else {
             console.warn("API returned non-JSON content:", await response.text());
             return { message: 'Lỗi phản hồi không xác định.' };
        }

    } catch (error) {
        console.error('Lỗi kết nối API:', error);
        alert('Lỗi kết nối máy chủ API.');
        return null;
    }
}


// --- HÀM ĐĂNG XUẤT ---
function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// --- HÀM HỖ TRỢ TỔNG QUAN ---
function getVietnameseStatus(status) {
    switch (status) {
        case 'pending': return 'Đang chờ';
        case 'processing': return 'Đang xử lý';
        case 'shipped': return 'Đã gửi hàng';
        case 'delivered': return 'Đã giao hàng';
        case 'cancelled': return 'Đã hủy';
        default: return status;
    }
}

// ==========================================================
// 0. CHỨC NĂNG TỔNG QUAN (DASHBOARD) - ĐÃ CẬP NHẬT ID
// ==========================================================

// 1. Tải dữ liệu thống kê (Tổng sản phẩm, Người dùng, Đơn hàng, Doanh thu)
async function fetchStats() {
    // Gọi API đã có trong routes/dashboard.js: /api/stats
    const stats = await apiCall('stats'); 

    if (!stats) return;

    // Cập nhật giá trị vào các thẻ HTML (Dùng ID từ dashboard.html: totalProductsCount, v.v.)
    // Đã sửa lỗi chính tả ID: 
    document.getElementById('totalProductsCount').textContent = stats.totalProducts.toLocaleString('vi-VN');
    document.getElementById('totalUsersCount').textContent = stats.totalUsers.toLocaleString('vi-VN');
    document.getElementById('totalOrdersCount').textContent = stats.totalOrders.toLocaleString('vi-VN');
    
    // Định dạng tổng doanh thu
    const formattedRevenue = new Intl.NumberFormat('vi-VN', { 
        style: 'currency', 
        currency: 'VND',
        minimumFractionDigits: 0 
    }).format(stats.totalRevenue || 0); 
    document.getElementById('totalRevenueCount').textContent = formattedRevenue;
}

// 2. Tải và hiển thị đơn hàng GẦN ĐÂY cho trang TỔNG QUAN
async function loadRecentOrders() {
    // API endpoint: /dashboard/orders (Backend đã sắp xếp DESC)
    const orders = await apiCall('orders'); 
    const tableBody = document.getElementById('recentOrdersTableBody'); 
    tableBody.innerHTML = '';

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center">Chưa có đơn hàng nào được tạo.</td></tr>';
        return;
    }

    // Chỉ hiển thị tối đa 5 đơn hàng gần đây nhất trên Dashboard
    const recentOrders = orders.slice(0, 5); 

    recentOrders.forEach(o => {
        let statusColor = 'secondary';
        if (o.status === 'processing' || o.status === 'shipped') statusColor = 'warning';
        else if (o.status === 'delivered') statusColor = 'success';
        else if (o.status === 'cancelled') statusColor = 'danger';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${o.id}</td>
            <td>${o.customer_name}</td>
            <td>${o.total_amount.toLocaleString('vi-VN')} VND</td>
            <td>${new Date(o.order_date).toLocaleDateString()}</td>
            <td><span class="badge text-bg-${statusColor}">${getVietnameseStatus(o.status)}</span></td>
           <td class="text-center"> 
                <button class="btn btn-sm btn-info" onclick="viewOrderDetails(${o.id})" title="Xem Chi tiết"><i class="bi bi-eye"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}


// ==========================================================
// 1. CHỨC NĂNG QUẢN LÝ SẢN PHẨM (CRUD) - GIỮ NGUYÊN
// ==========================================================
// ... (Các hàm loadProducts, editProduct, deleteProduct, viewProductDetails, 
// ... handleProductFormSubmit, resetProductModal giữ nguyên) ...

async function viewProductDetails(id) {
    const product = await apiCall(`products/${id}`);
    
    if (!product) {
        alert("Không tìm thấy chi tiết sản phẩm.");
        return;
    }

    const placeholderUrl = 'assets/image/placeholder.png'; 

    document.getElementById('detailProductName').textContent = product.name;
    document.getElementById('detailProductId').textContent = product.id;
    document.getElementById('detailProductPrice').textContent = `${product.price.toLocaleString('vi-VN')} VND`;
    document.getElementById('detailProductQuantity').textContent = product.quantity;
    document.getElementById('detailProductDescription').textContent = product.description || 'Không có mô tả chi tiết.';
    
    document.getElementById('detailProductImage').src = product.image_url || placeholderUrl;

    const modalElement = document.getElementById('viewProductModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

async function loadProducts() {
    const products = await apiCall('products');
    const tableBody = document.getElementById('productsTableBody');
    tableBody.innerHTML = '';

    if (!products || !Array.isArray(products)) return;

    products.forEach(p => {
        let actions = `
            <button class="btn btn-info btn-sm me-1" title="Chi tiết" onclick="viewProductDetails(${p.id})">
                <i class="bi bi-eye"></i>
            </button>
        `;

        actions += getAdminActionButtons('product', p.id);
        
        const imageUrl = p.image_url ? p.image_url : 'assets/image/placeholder.png'; 

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${p.id}</td>
            <td>${p.name}</td>
            <td>${p.price.toLocaleString('vi-VN')} VND</td>
            <td>${p.quantity}</td>
            <td>${p.description || 'N/A'}</td>
            <td>
                <img src="${imageUrl}" style="max-height: 50px; max-width: 50px; object-fit: cover;">
            </td>
            <td>
                <div class="d-flex justify-content-center">${actions}</div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function handleProductFormSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('productId').value;
    const formData = new FormData();
    const imageFile = document.getElementById('productImageFile').files[0];

    formData.append('name', document.getElementById('productName').value);
    formData.append('price', parseFloat(document.getElementById('productPrice').value));
    formData.append('quantity', parseInt(document.getElementById('productQuantity').value));
    formData.append('description', document.getElementById('productDesc').value);

    if (imageFile) {
        formData.append('imageFile', imageFile);
    }
    else if (productId && document.getElementById('currentImageUrl').value) {
        formData.append('current_image_url', document.getElementById('currentImageUrl').value);
    }

    let url = `/api/products`;
    let method = 'POST';

    if (productId) {
        url = `/api/products/${productId}`;
        method = 'PUT'; 
    }

    const config = {
        method: method,
        headers: {
            'Authorization': `Bearer ${authToken}` 
        },
        body: formData
    };

    let result;
    try {
        const response = await fetch(url, config);
        const contentLength = response.headers.get('content-length');

        if (response.status === 204 || (response.status === 200 && contentLength === '0')) {
             result = { message: 'Thao tác thành công.' };
        } else {
             result = await response.json();
        }

        if (response.status === 401 || response.status === 403) {
             alert(result.message || "Không có quyền truy cập.");
             return logout();
        }

    } catch (error) {
        console.error('Lỗi fetch:', error);
        alert('Lỗi kết nối máy chủ API.');
        return null;
    }


    if (result && result.message) {
        alert(result.message);

        const modalElement = document.getElementById('addProductModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        }
        loadProducts();
    }
}


async function editProduct(id) {
    const productData = await apiCall(`products/${id}`);

    if (!productData) return;

    document.getElementById('addProductModalLabel').textContent = 'Cập nhật Sản phẩm';
    document.getElementById('productId').value = productData.id;
    document.getElementById('productName').value = productData.name;
    document.getElementById('productPrice').value = productData.price;
    document.getElementById('productQuantity').value = productData.quantity;
    document.getElementById('productDesc').value = productData.description || '';

    document.getElementById('currentImageUrl').value = productData.image_url || '';
    document.getElementById('productImageFile').value = ''; 

    const modalElement = document.getElementById('addProductModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

async function deleteProduct(id) {
    if (confirm("Bạn có chắc chắn muốn xóa sản phẩm ID: " + id + "?")) {
        const result = await apiCall(`products/${id}`, 'DELETE');
        if (result) {
            alert(result.message);
            loadProducts();
        }
    }
}

function resetProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('currentImageUrl').value = '';
    document.getElementById('addProductModalLabel').textContent = 'Thêm Sản phẩm Mới';
}


// ==========================================================
// 2. CHỨC NĂNG QUẢN LÝ NGƯỜI DÙNG (CRUD ROLE) - GIỮ NGUYÊN
// ==========================================================
// ... (Các hàm getCurrentUserId, viewUserDetails, loadUsers, 
// ... changeUserRolePrompt, deleteUser, registerNewCustomer giữ nguyên) ...

function getCurrentUserId() {
    if (!authToken) return null;

    try {
        const base64Url = authToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        return JSON.parse(jsonPayload).id;
    } catch (e) {
        return null;
    }
}

async function viewUserDetails(id) {
    const user = await apiCall(`users/${id}`);
    
    if (!user) {
        alert("Không tìm thấy chi tiết người dùng.");
        return;
    }
    
    document.getElementById('detailUserName').textContent = user.username;
    document.getElementById('detailUserEmail').textContent = user.email;
    document.getElementById('detailUserId').textContent = user.id;
    document.getElementById('detailUserRole').textContent = user.role.toUpperCase();
    document.getElementById('detailUserCreatedAt').textContent = new Date(user.created_at).toLocaleDateString();

    const modalElement = document.getElementById('viewUserModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}


async function loadUsers(role = '') {
    let endpoint = 'users';

    if (role) {
        endpoint = `users?role=${role}`;
    }

    const users = await apiCall(endpoint);
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '';

    if (!users || !Array.isArray(users)) return;

    users.forEach(u => {
        if (u.role === 'customer') return;
        
        const roleColor = u.role === 'admin' ? 'danger' : u.role === 'employee' ? 'info' : 'secondary';

        const adminButtons = getAdminActionButtons('user', u.id, u.role, u.username);

        const content = adminButtons || (userRole === 'admin' && u.id === getCurrentUserId() ? '<span class="text-muted">N/A</span>' : '');

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${u.id}</td>
            <td>${u.username}</td>
            <td>${u.email}</td>
            <td><span class="badge text-bg-${roleColor}">${u.role.toUpperCase()}</span></td>
            <td>
                <div class="d-flex justify-content-center">${content}</div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function changeUserRolePrompt(id, currentRole, username) {
    const newRole = prompt(`Cập nhật vai trò cho User: ${username} (ID: ${id})\n\nVai trò hiện tại: ${currentRole}\n\nNhập vai trò mới (admin hoặc employee):`);
    
    const validRoles = ['employee', 'admin']; 

    if (newRole && validRoles.includes(newRole.toLowerCase())) {
        const result = await apiCall(`users/${id}`, 'PUT', {
            role: newRole.toLowerCase(),
            username: username
        });

        if (result) {
            alert(result.message);
            loadUsers(document.getElementById('roleFilter') ? document.getElementById('roleFilter').value : '');
        }
    } else if (newRole !== null) {
        alert("Vai trò không hợp lệ. Vui lòng chỉ nhập 'admin' hoặc 'employee'.");
    }
}

async function deleteUser(id) {
    if (confirm(`Bạn có chắc chắn muốn xóa User ID: ${id} không?`)) {
        const result = await apiCall(`users/${id}`, 'DELETE');

        if (result) {
            alert(result.message);
            loadUsers(document.getElementById('roleFilter') ? document.getElementById('roleFilter').value : '');
        }
    }
}

async function registerNewCustomer(e) {
    e.preventDefault();

    const username = document.getElementById('customerUsername').value;
    const email = document.getElementById('customerEmail').value;
    const password = document.getElementById('customerPassword').value;

    const userData = { username, email, password };
    
    const result = await apiCall('users/register-customer', 'POST', userData);

    if (result && result.id) {
        alert(`Đăng ký khách hàng ${result.username} thành công (ID: ${result.id}).`);
        
        const regModalElement = document.getElementById('registerCustomerModal');
        const regModalInstance = bootstrap.Modal.getInstance(regModalElement);
        if (regModalInstance) {
            regModalInstance.hide();
        }
        
        await loadOrdersDropdowns(); 
        
        const userSelect = document.getElementById('orderUserSelect');
        const newOption = userSelect.querySelector(`option[value="${result.id}"]`);
        if (newOption) {
            userSelect.value = result.id;
        }

    } else if (result && result.message) {
        alert(result.message);
    }
}


// ==========================================================
// 3. CHỨC NĂNG QUẢN LÝ ĐƠN HÀNG (CREATE ORDER) - GIỮ NGUYÊN
// ==========================================================
// ... (Các hàm addProductToOrder, renderOrderItemsList, removeOrderItem, 
// ... loadOrdersDropdowns, handleOrderFormSubmit, resetOrderModal, 
// ... loadOrders, updateOrderStatus, viewOrderDetails giữ nguyên) ...

function addProductToOrder() {
    const productSelect = document.getElementById('orderProductSelect');
    const quantityInput = document.getElementById('orderProductQuantity');

    const productId = productSelect.value;
    const quantity = parseInt(quantityInput.value);

    if (!productId || quantity <= 0 || isNaN(quantity)) {
        alert("Vui lòng chọn sản phẩm và nhập số lượng hợp lệ.");
        return;
    }

    const productName = productSelect.options[productSelect.selectedIndex].text.split(' (')[0];
    const currentPrice = parseFloat(productSelect.options[productSelect.selectedIndex].getAttribute('data-price'));
    
    const existingIndex = orderItems.findIndex(item => item.product_id === parseInt(productId));

    if (existingIndex > -1) {
        orderItems[existingIndex].quantity += quantity;
    } else {
        orderItems.push({
            product_id: parseInt(productId),
            product_name: productName,
            quantity: quantity,
            price: currentPrice
        });
    }

    renderOrderItemsList();
    quantityInput.value = 1; 
}

function renderOrderItemsList() {
    const listBody = document.getElementById('orderItemsListBody');
    listBody.innerHTML = '';
    let grandTotal = 0;

    orderItems.forEach((item, index) => {
        const subtotal = item.quantity * item.price;
        grandTotal += subtotal;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.product_name}</td>
            <td>${item.quantity}</td>
            <td>${item.price.toLocaleString('vi-VN')} VND</td>
            <td>${subtotal.toLocaleString('vi-VN')} VND</td>
            <td>
                <button type="button" class="btn btn-danger btn-sm" onclick="removeOrderItem(${index})">Xóa</button>
            </td>
        `;
        listBody.appendChild(row);
    });

    document.getElementById('orderTotalAmount').textContent = `${grandTotal.toLocaleString('vi-VN')} VND`;
}

function removeOrderItem(index) {
    orderItems.splice(index, 1);
    renderOrderItemsList();
}

async function loadOrdersDropdowns() {
    const userSelect = document.getElementById('orderUserSelect');
    const productSelect = document.getElementById('orderProductSelect');

    userSelect.innerHTML = '<option value="">Chọn Khách hàng</option>';
    productSelect.innerHTML = '<option value="">Chọn Sản phẩm</option>';
    
    // 1. Tải Người dùng (chỉ lấy role customer)
    const users = await apiCall('users?role=customer');
    if (users && Array.isArray(users)) {
        users.forEach(u => {
            const option = document.createElement('option');
            option.value = u.id;
            option.textContent = `${u.username} (${u.email})`;
            userSelect.appendChild(option);
        });
    }

    // 2. Tải Sản phẩm
    const products = await apiCall('products');
    if (products && Array.isArray(products)) {
        products.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.name} (${p.quantity} tồn)`;
            option.setAttribute('data-price', p.price);
            productSelect.appendChild(option);
        });
    }

    orderItems = []; 
    renderOrderItemsList();
}

async function handleOrderFormSubmit(e) {
    e.preventDefault();

    const userId = document.getElementById('orderUserSelect').value;
    
    if (!userId) {
        alert("Vui lòng chọn khách hàng.");
        return;
    }

    if (orderItems.length === 0) {
        alert("Vui lòng thêm ít nhất một sản phẩm vào đơn hàng.");
        return;
    }

    const orderData = {
        user_id: parseInt(userId),
        items: orderItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price
        }))
    };

    const result = await apiCall('orders', 'POST', orderData);

    if (result && result.order_id) {
        alert(result.message);
        
        const modalElement = document.getElementById('addOrderModal');
        const modalInstance = bootstrap.Modal.getInstance(modalElement);
        if (modalInstance) {
            modalInstance.hide();
        }
        
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'dashboard.html' || currentPage === 'index.html' || currentPage === '') {
             fetchStats(); // Tải lại stats để cập nhật Total Orders
             loadRecentOrders(); 
        } else if (currentPage === 'manage_orders.html') {
             loadOrders();
        }

    } else if (result && result.message) {
         alert(result.message);
    }
}

function resetOrderModal() {
    document.getElementById('orderForm').reset();
    orderItems = [];
    renderOrderItemsList();
}


// Load Đơn hàng (Dùng cho trang Quản lý Đơn hàng)
async function loadOrders() {
    const orders = await apiCall('orders');
    const tableBody = document.getElementById('ordersTableBody'); 
    tableBody.innerHTML = '';

    if (!orders || !Array.isArray(orders)) return;

    orders.forEach(o => {
        let actions = `
            <button class="btn btn-info btn-sm me-1" title="Chi tiết" onclick="viewOrderDetails(${o.id})">
                <i class="bi bi-eye"></i>
            </button>
        `;

        if (userRole === 'admin') {
            actions += `
                <button class="btn btn-warning btn-sm admin-only" title="Cập nhật trạng thái" onclick="updateOrderStatus(${o.id}, '${o.status}')">
                    <i class="bi bi-arrow-repeat"></i>
                </button>
            `;
        }

        let statusColor = 'secondary';
        if (o.status === 'processing' || o.status === 'shipped') statusColor = 'warning';
        else if (o.status === 'delivered') statusColor = 'success';
        else if (o.status === 'cancelled') statusColor = 'danger';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${o.id}</td>
            <td>${o.customer_name} (${o.customer_email})</td>
            <td>${o.total_amount.toLocaleString('vi-VN')} VND</td>
            <td>${new Date(o.order_date).toLocaleDateString()}</td>
            <td><span class="badge text-bg-${statusColor}">${getVietnameseStatus(o.status)}</span></td>
            <td><div class="d-flex justify-content-center">${actions}</div></td> 
        `;
        tableBody.appendChild(row);
    });
}

async function updateOrderStatus(id, currentStatus) {
    const newStatus = prompt(`Cập nhật trạng thái cho Đơn hàng ID: ${id}. Trạng thái hiện tại: ${getVietnameseStatus(currentStatus)}\n\nNhập trạng thái mới (pending, processing, shipped, delivered, cancelled):`);

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    if (newStatus && validStatuses.includes(newStatus.toLowerCase())) {
        const result = await apiCall(`orders/${id}/status`, 'PUT', { status: newStatus.toLowerCase() });

        if (result) {
            alert(result.message);
            loadOrders();
        }
    } else if (newStatus !== null) {
        alert("Trạng thái không hợp lệ. Vui lòng nhập một trong các giá trị: pending, processing, shipped, delivered, cancelled.");
    }
}

// READ: Xem chi tiết đơn hàng (ĐÃ SỬA LỖI 404 và forEach)
async function viewOrderDetails(id) {
    // GỌI API ĐÚNG: Thay vì /orders/id/details, ta gọi /orders/id
    const details = await apiCall(`orders/${id}`); 

    // XỬ LÝ LỖI FOREACH: Kiểm tra nếu không phải mảng
    if (!details || !Array.isArray(details) || details.length === 0) {
        alert("Không tìm thấy chi tiết đơn hàng hoặc dữ liệu đơn hàng không hợp lệ.");
        return;
    }

    const modalBody = document.getElementById('detailOrderItemsList');
    modalBody.innerHTML = ''; 
    let grandTotal = 0;

    details.forEach(item => {
        const subtotal = item.quantity * item.price;
        grandTotal += subtotal;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.product_name}</td>
            <td>${item.quantity}</td>
            <td>${item.price.toLocaleString('vi-VN')} VND</td>
            <td>${subtotal.toLocaleString('vi-VN')} VND</td>
        `;
        modalBody.appendChild(row);
    });
    
    document.getElementById('detailOrderTitle').textContent = `Chi Tiết Đơn hàng #${id}`;
    document.getElementById('detailOrderTotalAmount').textContent = `${grandTotal.toLocaleString('vi-VN')} VND`;

    // Hiển thị Modal
    const modalElement = document.getElementById('viewOrderDetailsModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

// ==========================================================
// 4. CHỨC NĂNG MAPS (CẦN TÙY CHỈNH)
// ==========================================================
// Bạn đã import LeafletJS, đây là một hàm mẫu để khởi tạo bản đồ
let mapInstance = null;
function initializeMap() {
    if (mapInstance !== null) {
        mapInstance.remove(); // Xóa instance cũ nếu có
    }
    
    const centerLat = 10.8231; // Vĩ độ mẫu: TP.HCM
    const centerLng = 106.6297; // Kinh độ mẫu: TP.HCM

    mapInstance = L.map('osmMap').setView([centerLat, centerLng], 13);
    
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mapInstance);
    
    // Thêm ví dụ marker cho một cửa hàng
    L.marker([centerLat, centerLng]).addTo(mapInstance)
        .bindPopup("<b>Chi nhánh Chợ Lớn</b><br>123 Đường Nguyễn Trãi.").openPopup();
        
    // Cập nhật danh sách cửa hàng
    document.getElementById('storeListContainer').innerHTML = `
        <li class="list-group-item">Chi nhánh Chợ Lớn (123 Nguyễn Trãi)</li>
        <li class="list-group-item">Chi nhánh Quận 1 (456 Lê Lợi)</li>
    `;
}