document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value; 
    const messageEl = document.getElementById('message');

    messageEl.classList.add('d-none'); 
    messageEl.classList.remove('alert-danger', 'alert-success');

    if (password !== confirmPassword) {
        messageEl.textContent = 'Mật khẩu và xác nhận mật khẩu không khớp.';
        messageEl.classList.remove('d-none');
        messageEl.classList.add('alert-danger');
        return; 
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        messageEl.textContent = data.message;
        messageEl.classList.remove('d-none');

        if (response.ok) {
            messageEl.classList.add('alert-success');
            setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        } else {
            messageEl.classList.add('alert-danger');
        }
    } catch (error) {
        messageEl.classList.remove('d-none');
        messageEl.classList.add('alert-danger');
        messageEl.textContent = 'Lỗi kết nối máy chủ.';
    }
});