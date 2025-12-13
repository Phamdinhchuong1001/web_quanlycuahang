
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const messageEl = document.getElementById('message');

    messageEl.classList.add('d-none');

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        messageEl.textContent = data.message;
        messageEl.classList.remove('d-none', 'alert-danger', 'alert-success');

        if (response.ok) {
            messageEl.classList.add('alert-success');

            // 1. Lưu Token và Role
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userRole', data.role);

            // 2. Chuyển hướng theo vai trò
            if (data.role === 'admin' || data.role === 'employee') {
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);
            } else if (data.role === 'customer') {
                setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            }
        } else {
            messageEl.classList.add('alert-danger');
        }
    } catch (error) {
        messageEl.classList.remove('d-none', 'alert-danger', 'alert-success');
        messageEl.classList.add('alert-danger');
        messageEl.textContent = 'Lỗi kết nối máy chủ.';
    }
});
