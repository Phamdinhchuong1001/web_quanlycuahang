// public/js/dashboard.js (PHIÊN BẢN CUỐI CÙNG VÀ HOÀN CHỈNH - ĐÃ SỬA ĐỔI)

// --- KHAI BÁO BIẾN TOÀN CỤC ---
const authToken = localStorage.getItem('authToken');
const userRole = localStorage.getItem('userRole');

// --- HÀM HỖ TRỢ CHUNG: TẠO CÁC NÚT SỬA/XÓA BẰNG ICON (CHỈ ADMIN) ---
/**
 * Tạo chuỗi HTML cho các nút Sửa và Xóa dưới dạng icon.
 * @param {string} type 'product' hoặc 'user'
 * @param {number} id ID của đối tượng
 * @param {string} [currentRole] Chỉ dùng cho user, vai trò hiện tại
 * @param {string} [username] Chỉ dùng cho user, tên người dùng
 * @returns {string} Chuỗi HTML chứa các nút icon (rỗng nếu không phải admin hoặc là admin đang xem chính mình)
 */
function getAdminActionButtons(type, id, currentRole, username) {
    let editFunc, deleteFunc;
    let buttons = '';
    const isProduct = type === 'product';

    if (userRole === 'admin') {
        if (!isProduct && id === getCurrentUserId()) {
            // Admin không thể tự sửa/xóa chính mình
            return '';
        }

        if (isProduct) {
            editFunc = `editProduct(${id})`;
            deleteFunc = `deleteProduct(${id})`;
        } else { // user
            editFunc = `editUserRole(${id}, '${currentRole}', '${username}')`;
            deleteFunc = `deleteUser(${id})`;
        }

        buttons += `
            <button class="btn btn-warning btn-sm me-1 admin-only" title="Sửa" onclick="${editFunc}">
                <i class="bi bi-pencil-square"></i>
            </button>
            <button class="btn btn-danger btn-sm admin-only" title="Xóa" onclick="${deleteFunc}">
                <i class="bi bi-trash"></i>
            </button>
        `;
    }
    return buttons;
}

// --- HÀM BẢO VỆ TRANG & PHÂN QUYỀN HIỂN THỊ ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Bảo vệ trang
    if (!authToken || userRole === 'customer') {
        alert('Bạn không có quyền truy cập Dashboard. Vui lòng đăng nhập lại.');
        window.location.href = 'login.html';
        return;
    }

    // 2. Hiển thị thông tin người dùng
    document.getElementById('userInfo').textContent = `Vai trò: ${userRole.toUpperCase()}`;

    // 3. Phân quyền hiển thị
    if (userRole !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
    }

    // 4. Load dữ liệu
    loadProducts();
    loadUsers();
    loadOrders();

    // 5. Thêm listener cho form sản phẩm (Tích hợp File Upload)
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', handleProductFormSubmit);
    }

    // 6. Thêm listener reset modal
    const productModal = document.getElementById('addProductModal');
    if (productModal) {
        productModal.addEventListener('hidden.bs.modal', resetProductModal);
    }
});

// --- HÀM CHUNG: GỌI API KÈM TOKEN (Dùng cho JSON) ---
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };

    const config = { method, headers };
    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`/api/${endpoint}`, config);

        if (response.status === 401 || response.status === 403) {
            alert(`Lỗi ${response.status}: ${await response.json().then(data => data.message) || "Không có quyền truy cập hoặc phiên hết hạn."}`);
            logout();
            return null;
        }

        if (response.status === 204 || response.status === 200 && response.headers.get('content-length') === '0') {
            return { message: 'Thao tác thành công.' };
        }

        return response.json();
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

// ==========================================================
// 1. CHỨC NĂNG QUẢN LÝ SẢN PHẨM (CRUD)
// ==========================================================

// READ: Load Sản phẩm (Đã sửa để dùng icon và căn giữa)
async function loadProducts() {
    const products = await apiCall('products');
    const tableBody = document.getElementById('productsTableBody');
    tableBody.innerHTML = '';

    if (!products || !Array.isArray(products)) return;

    products.forEach(p => {
        // 1. Nút Chi tiết (Icon)
        let actions = `
            <button class="btn btn-info btn-sm me-1" title="Chi tiết">
                <i class="bi bi-eye"></i>
            </button>
        `;

        // 2. Nút Sửa/Xóa (Icon - chỉ Admin)
        actions += getAdminActionButtons('product', p.id);

        tableBody.innerHTML += `
            <tr>
                <td>${p.id}</td>
                <td>${p.name}</td>
                <td>${p.price}</td>
                <td>${p.quantity}</td>
                <td>${p.description || 'N/A'}</td>
                <td>
                    <div class="d-flex justify-content-center">${actions}</div>
                </td>
            </tr>
        `;
    });
}

// CREATE / UPDATE: Xử lý Form Thêm/Sửa Sản phẩm (Xử lý File Upload)
async function handleProductFormSubmit(e) {
    e.preventDefault();

    const productId = document.getElementById('productId').value;
    const formData = new FormData();
    const imageFile = document.getElementById('productImageFile').files[0];

    // Thêm các trường dữ liệu text vào FormData
    formData.append('name', document.getElementById('productName').value);
    formData.append('price', parseFloat(document.getElementById('productPrice').value));
    formData.append('quantity', parseInt(document.getElementById('productQuantity').value));
    formData.append('description', document.getElementById('productDesc').value);

    // Nếu có file, thêm file đó vào FormData
    if (imageFile) {
        formData.append('imageFile', imageFile);
    }
    // Nếu là UPDATE và không có file mới, gửi URL cũ để Backend giữ nguyên
    else if (productId && document.getElementById('currentImageUrl').value) {
        formData.append('current_image_url', document.getElementById('currentImageUrl').value);
    }

    let url = `/api/products`;
    let method = 'POST';

    if (productId) {
        url = `/api/products/${productId}`;
        method = 'PUT'; // Dùng PUT cho cập nhật
    }

    // Cấu hình fetch (Dùng cho FormData)
    const config = {
        method: method,
        headers: {
            'Authorization': `Bearer ${authToken}` // Gửi Token xác thực
        },
        body: formData
    };

    let result;
    try {
        const response = await fetch(url, config);
        // Kiểm tra Content-Length trước khi gọi response.json()
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


// UPDATE: Chuẩn bị dữ liệu cho Modal Sửa
async function editProduct(id) {
    const productData = await apiCall(`products/${id}`);

    if (!productData) return;

    document.getElementById('addProductModalLabel').textContent = 'Cập nhật Sản phẩm';
    document.getElementById('productId').value = productData.id;
    document.getElementById('productName').value = productData.name;
    document.getElementById('productPrice').value = productData.price;
    document.getElementById('productQuantity').value = productData.quantity;
    document.getElementById('productDesc').value = productData.description || '';

    // Thêm hidden field để lưu URL hiện tại (cho logic UPDATE)
    document.getElementById('currentImageUrl').value = productData.image_url || '';
    document.getElementById('productImageFile').value = ''; // Reset input file

    // Hiển thị Modal
    const modalElement = document.getElementById('addProductModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

// DELETE: Xóa Sản phẩm (Chỉ Admin)
async function deleteProduct(id) {
    if (confirm("Bạn có chắc chắn muốn xóa sản phẩm ID: " + id + "?")) {
        const result = await apiCall(`products/${id}`, 'DELETE');
        if (result) {
            alert(result.message);
            loadProducts();
        }
    }
}

// Hàm hỗ trợ để reset Modal khi đóng
function resetProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('productId').value = '';
    document.getElementById('currentImageUrl').value = '';
    document.getElementById('addProductModalLabel').textContent = 'Thêm Sản phẩm Mới';
}

// ==========================================================
// 2. CHỨC NĂNG QUẢN LÝ NGƯỜI DÙNG (CRUD ROLE)
// ==========================================================

// HÀM HỖ TRỢ: Lấy ID người dùng hiện tại từ Token
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

// READ: Load Danh sách Người dùng (Đã sửa để dùng icon và căn giữa)
async function loadUsers() {
    const users = await apiCall('users');
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = '';

    if (!users || !Array.isArray(users)) return;

    users.forEach(u => {
        const roleColor = u.role === 'admin' ? 'danger' : u.role === 'employee' ? 'info' : 'secondary';

        // Dùng hàm hỗ trợ mới (chỉ Sửa/Xóa)
        const adminButtons = getAdminActionButtons('user', u.id, u.role, u.username);

        // Hiển thị N/A nếu là Admin đang xem chính mình và không có nút
        const content = adminButtons || (userRole === 'admin' && u.id === getCurrentUserId() ? '<span class="text-muted">N/A</span>' : '');

        tableBody.innerHTML += `
            <tr>
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.email}</td>
                <td><span class="badge text-bg-${roleColor}">${u.role.toUpperCase()}</span></td>
                <td>
                    <div class="d-flex justify-content-center">${content}</div>
                </td>
            </tr>
        `;
    });
}

// UPDATE: Sửa Vai trò Người dùng (Chỉ Admin)
async function editUserRole(id, currentRole, username) {
    const newRole = prompt(`Cập nhật vai trò cho User: ${username} (ID: ${id})\n\nVai trò hiện tại: ${currentRole}\n\nNhập vai trò mới (employee hoặc customer):`);

    if (newRole && (newRole === 'employee' || newRole === 'customer')) {
        const result = await apiCall(`users/${id}`, 'PUT', {
            role: newRole,
            username: username
        });

        if (result) {
            alert(result.message);
            loadUsers();
        }
    } else if (newRole !== null) {
        alert("Vai trò không hợp lệ. Vui lòng nhập 'employee' hoặc 'customer'.");
    }
}

// DELETE: Xóa Người dùng (Chỉ Admin)
async function deleteUser(id) {
    if (confirm(`Bạn có chắc chắn muốn xóa User ID: ${id} không?`)) {
        const result = await apiCall(`users/${id}`, 'DELETE');

        if (result) {
            alert(result.message);
            loadUsers();
        }
    }
}

// ==========================================================
// 3. CHỨC NĂNG QUẢN LÝ ĐƠN HÀNG (HOÀN THIỆN)
// ==========================================================

// Load Đơn hàng (Đã sửa để dùng icon và căn giữa)
async function loadOrders() {
    const orders = await apiCall('orders');
    const tableBody = document.getElementById('ordersTableBody');
    tableBody.innerHTML = '';

    if (!orders || !Array.isArray(orders)) return;

    orders.forEach(o => {
        // Nút Chi tiết (Icon)
        let actions = `
            <button class="btn btn-info btn-sm me-1" title="Chi tiết" onclick="viewOrderDetails(${o.id})">
                <i class="bi bi-eye"></i>
            </button>
        `;

        // Nút Cập nhật Trạng thái (Icon - chỉ Admin)
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

        tableBody.innerHTML += `
            <tr>
                <td>${o.id}</td>
                <td>${o.customer_name} (${o.customer_email})</td>
                <td>${o.total_amount}</td>
                <td>${new Date(o.order_date).toLocaleDateString()}</td>
                <td><span class="badge text-bg-${statusColor}">${o.status.toUpperCase()}</span></td>
                <td><div class="d-flex justify-content-center">${actions}</div></td> 
            </tr>
        `;
    });
}

async function updateOrderStatus(id, currentStatus) {
    const newStatus = prompt(`Cập nhật trạng thái cho Đơn hàng ID: ${id}. Trạng thái hiện tại: ${currentStatus}\n\nNhập trạng thái mới (pending, processing, shipped, delivered, cancelled):`);

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

async function viewOrderDetails(id) {
    const details = await apiCall(`orders/${id}`);

    if (!details || details.length === 0) {
        alert("Không tìm thấy chi tiết đơn hàng.");
        return;
    }

    let detailList = `Chi tiết Đơn hàng #${id}:\n\n`;
    details.forEach(item => {
        detailList += `- ${item.product_name}: ${item.quantity} x ${item.price}\n`;
    });

    alert(detailList);
}