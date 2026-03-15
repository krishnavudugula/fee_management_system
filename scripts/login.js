const formTrack = document.getElementById('form-track');
const toggleBg = document.getElementById('toggle-bg');
const btnStudent = document.getElementById('btn-student');
const btnAdmin = document.getElementById('btn-admin');
const studentForm = document.getElementById('student-form');
const adminForm = document.getElementById('admin-form');
const modal = document.getElementById('forgot-modal');

function setRole(role) {
    if (role === 'admin') {
        formTrack.style.transform = 'translateX(-50%)';
        toggleBg.style.transform = 'translateX(100%)';
        btnAdmin.classList.add('active');
        btnStudent.classList.remove('active');
    } else {
        formTrack.style.transform = 'translateX(0)';
        toggleBg.style.transform = 'translateX(0)';
        btnStudent.classList.add('active');
        btnAdmin.classList.remove('active');
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';

    let icon = '<i class="fa-solid fa-circle-info" style="color:#2563eb"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation" style="color:#ef4444"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-shield-check" style="color:#10b981"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        toast.style.transition = '0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

studentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-submit');
    const originalContent = btn.innerHTML;

    const username = e.target.querySelectorAll('input')[0].value.trim();
    const password = e.target.querySelectorAll('input')[1].value;

    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...';
    btn.disabled = true;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.role === 'STUDENT') {
            localStorage.setItem('loggedInStudentId', data.user_id);
            showToast('Authentication successful! Redirecting...', 'success');
            setTimeout(() => { window.location.href = '/student-dashboard'; }, 800);
            return;
        }

        showToast(data.detail || 'Invalid student credentials.', 'error');
    } catch (error) {
        showToast('Server connection failed.', 'error');
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
});

adminForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-submit');
    const originalContent = btn.innerHTML;

    const username = e.target.querySelectorAll('input')[0].value.trim();
    const password = e.target.querySelectorAll('input')[1].value;

    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...';
    btn.disabled = true;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok && data.role === 'ADMIN') {
            showToast('Admin verified! Opening console...', 'success');
            setTimeout(() => { window.location.href = '/admin-dashboard'; }, 800);
            return;
        }

        showToast(data.detail || 'Access denied.', 'error');
    } catch (error) {
        showToast('Server connection failed.', 'error');
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
});

function openForgotModal() {
    modal.classList.add('active');
}

function closeForgotModal() {
    modal.classList.remove('active');
    setTimeout(() => {
        document.querySelectorAll('.forgot-step').forEach(s => s.classList.remove('active'));
        document.getElementById('step-email').classList.add('active');
    }, 300);
}

function nextForgotStep(currentStep) {
    const currentId = currentStep === 1 ? 'email' : currentStep === 2 ? 'otp' : 'new-pass';
    document.getElementById(`step-${currentId}`).classList.remove('active');

    if (currentStep === 1) {
        document.getElementById('step-otp').classList.add('active');
    } else if (currentStep === 2) {
        document.getElementById('step-new-pass').classList.add('active');
    } else {
        showToast('Password updated successfully!', 'success');
        closeForgotModal();
    }
}

window.setRole = setRole;
window.openForgotModal = openForgotModal;
window.closeForgotModal = closeForgotModal;
window.nextForgotStep = nextForgotStep;

const urlRole = new URLSearchParams(window.location.search).get('role');
if (urlRole === 'admin' || urlRole === 'student') {
    setRole(urlRole);
} else {
    setRole('student');
}
