// ==========================================
// DYNAMIC STATE & DB CONNECTION
// ==========================================
let studentData = { fees: [], recent_activity: [] }; // Starts empty
let currentStudentId = null;
let notificationsData = [];
let currentStudentProfile = { name: '', firstName: 'Student', roll: '', branch: '' };

async function loadStudentData() {
    // 1. Who is logged in? Check LocalStorage
    const studentId = localStorage.getItem('loggedInStudentId');
    currentStudentId = studentId;
    
    if(!studentId) {
        alert("Session expired. Please log in again.");
        window.location.href = '/login';
        return;
    }

    // 2. Fetch their specific data from the Python Backend
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/student/dashboard/${studentId}`);
        
        // If student account deleted or doesn't exist, redirect to login
        if (response.status === 404) {
            localStorage.removeItem('loggedInStudentId');
            alert("Your account no longer exists or has been deleted by the administrator.");
            window.location.href = '/pages/login.html';
            return;
        }
        
        const data = await response.json();
        
        if(!response.ok) {
            throw new Error(data.detail || "Could not fetch data");
        }

        // 3. Populate our global state
        studentData.fees = data.fees || [];
        studentData.recent_activity = data.recent_activity || [];

        // 4. Capture student identity for dynamic UI
        currentStudentProfile = {
            name: data.student_name || 'Student',
            firstName: (data.student_name || 'Student').split(' ')[0] || 'Student',
            roll: data.roll_number || '',
            branch: data.branch || ''
        };
        
        // 5. Update the Profile Names & Roll Number in the UI dynamically
        updateProfileUI();
        setGreeting();
        initializeChatbot();

        // 6. Render the Dashboard with the live data!
        renderDashboard();
        renderRecentActivity();
        await loadReceipts();
        await loadNotifications();

    } catch(err) {
        console.error(err);
        localStorage.removeItem('loggedInStudentId');
        alert("Error loading your profile. Please log in again.");
        window.location.href = '/pages/login.html';
    }
}

// ==========================================
// RENDER UI FROM STATE
// ==========================================
function renderDashboard() {
    let grandTotal = 0;
    let totalPaid = 0;
    let totalPending = 0;
    
    // Calculate sums
    studentData.fees.forEach(f => {
        grandTotal += f.total;
        totalPaid += f.paid;
        totalPending += (f.pending || 0);
    });
    
    const totalDue = grandTotal - totalPaid - totalPending;

    // Update Overview Cards
    document.getElementById('dashboard-total-due').innerText = `₹ ${totalDue.toLocaleString('en-IN')}`;
    
    // Update Progress Ring
    const percent = grandTotal > 0 ? Math.round((totalPaid / grandTotal) * 100) : 100;
    document.getElementById('dashboard-percent').innerText = `${percent}%`;
    document.getElementById('dashboard-progress').style.setProperty('--progress', `${percent * 3.6}deg`);

    // Check No Dues Unlock
    const noDuesBtn = document.getElementById('btn-no-dues');
    if(totalDue <= 0 && grandTotal > 0) {
        noDuesBtn.disabled = false;
        noDuesBtn.innerHTML = `<i class="fa-solid fa-download"></i> Download Certificate`;
        noDuesBtn.classList.add('pulse');
    } else if (noDuesBtn) {
        noDuesBtn.disabled = true;
        noDuesBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Locked (Dues Pending)`;
        noDuesBtn.classList.remove('pulse');
    }

    // Render Dues Table & Dropdown
    const tbody = document.getElementById('dues-table-body');
    const selectDropdown = document.getElementById('pay-category');
    tbody.innerHTML = '';
    selectDropdown.innerHTML = '<option value="" disabled selected>Select a pending due...</option>';

    studentData.fees.forEach(fee => {
        const pendingAmount = fee.pending || 0;
        const due = fee.total - fee.paid - pendingAmount;
        const displayPaid = fee.paid + pendingAmount;

        const paidCellClass = pendingAmount > 0 ? 'text-warning' : 'text-success';
        const paidSubText = pendingAmount > 0
            ? `<br><small style="color: var(--text-muted);">₹ ${pendingAmount.toLocaleString('en-IN')} pending verification</small>`
            : '';
        
        const proposedNote = fee.is_proposed
            ? `<div class="proposed-note">Proposed fee: ${fee.description || 'New fee added by admin.'}</div>`
            : '';

        tbody.innerHTML += `
            <tr>
                <td><strong>${fee.category}</strong>${proposedNote}</td>
                <td>₹ ${fee.total.toLocaleString('en-IN')}</td>
                <td class="${paidCellClass}">₹ ${displayPaid.toLocaleString('en-IN')}${paidSubText}</td>
                <td class="${due > 0 ? 'text-danger' : 'text-muted'}">${due > 0 ? '₹ ' + due.toLocaleString('en-IN') : 'Cleared'}</td>
            </tr>
        `;

        if(due > 0) {
            selectDropdown.innerHTML += `<option value="${fee.category}" data-max="${due}">${fee.category} (Owe: ₹${due.toLocaleString('en-IN')})</option>`;
        }
    });

    if (selectDropdown.options.length === 1) {
        selectDropdown.innerHTML = '<option value="" disabled selected>All dues are cleared or pending verification.</option>';
    }

    document.getElementById('table-total').innerHTML = `<strong>₹ ${grandTotal.toLocaleString('en-IN')}</strong>`;
    document.getElementById('table-paid').innerHTML = `<strong>₹ ${totalPaid.toLocaleString('en-IN')}</strong>`;
    document.getElementById('table-due').innerHTML = `<strong>₹ ${totalDue.toLocaleString('en-IN')}</strong>`;
}

function renderRecentActivity() {
    const activityList = document.getElementById('recent-activity');
    if (!activityList) return;

    activityList.innerHTML = '';

    if (!studentData.recent_activity || studentData.recent_activity.length === 0) {
        activityList.innerHTML = '<li><div class="timeline-text"><span>No recent activity.</span></div></li>';
        return;
    }

    studentData.recent_activity.forEach(item => {
        const status = (item.status || '').toLowerCase();
        const isVerified = status.includes('verified');
        const isRejected = status.includes('rejected');
        const iconClass = isVerified ? 'fa-check' : isRejected ? 'fa-xmark' : 'fa-clock';
        const colorClass = isVerified ? 'bg-success' : isRejected ? 'bg-danger' : 'bg-warning';

        activityList.innerHTML += `
            <li>
                <div class="timeline-icon ${colorClass}"><i class="fa-solid ${iconClass}"></i></div>
                <div class="timeline-text">
                    <strong>₹ ${Number(item.amount || 0).toLocaleString('en-IN')} ${item.status}</strong>
                    <span>${item.category} (UTR: ${(item.utr || '').slice(0, 10)}...)</span>
                </div>
            </li>
        `;
    });
}

async function loadReceipts() {
    if (!currentStudentId) return;
    const receiptList = document.getElementById('receipt-list');
    if (!receiptList) return;

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/student/receipts/${currentStudentId}`);
        if (!response.ok) throw new Error('Failed to load receipts');

        const data = await response.json();
        const receipts = data.receipts || [];

        receiptList.innerHTML = '';
        if (!receipts.length) {
            receiptList.innerHTML = '<li><span>No approved receipts yet.</span></li>';
            return;
        }

        receipts.forEach(receipt => {
            receiptList.innerHTML += `
                <li>
                    <span>${receipt.receipt_no} (₹ ${Number(receipt.amount).toLocaleString('en-IN')})</span>
                    <a class="btn btn-outline btn-sm" href="http://127.0.0.1:8000/api/student/receipt/${receipt.transaction_id}/download" target="_blank"><i class="fa-solid fa-download"></i></a>
                </li>
            `;
        });
    } catch (error) {
        receiptList.innerHTML = '<li><span>Could not load receipts.</span></li>';
    }
}

// Call this immediately when the page loads!
loadStudentData();

// ==========================================
// SPA NAVIGATION & DYNAMIC GREETING
// ==========================================
function updateProfileUI() {
    const nameEl = document.getElementById('profile-name');
    const metaEl = document.getElementById('profile-meta');
    const avatarEl = document.getElementById('profile-avatar');

    if (nameEl) nameEl.innerText = currentStudentProfile.name || 'Student Name';
    if (metaEl) metaEl.innerText = `${currentStudentProfile.roll || 'Roll Number'} | ${currentStudentProfile.branch || 'Branch'}`;
    if (avatarEl) {
        const safeName = encodeURIComponent(currentStudentProfile.name || 'Student');
        avatarEl.src = `https://ui-avatars.com/api/?name=${safeName}&background=0f172a&color=fff`;
    }
}

function setGreeting() {
    const hour = new Date().getHours();
    const greetingEl = document.getElementById('greeting');
    if (!greetingEl) return;

    const name = currentStudentProfile.firstName || 'Student';
    let prefix = 'Good Evening';
    if (hour < 12) prefix = 'Good Morning';
    else if (hour < 18) prefix = 'Good Afternoon';

    greetingEl.innerText = `${prefix}, ${name}`;
}
setGreeting();

const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view-section');
const titleEl = document.getElementById('top-nav-title');

function navigateTo(targetId) {
    navItems.forEach(item => {
        if(item.getAttribute('data-target') === targetId) {
            item.classList.add('active');
            titleEl.innerText = item.innerText.trim();
        } else {
            item.classList.remove('active');
        }
    });

    views.forEach(view => {
        if(view.id === `view-${targetId}`) {
            view.classList.add('active');
            view.style.animation = 'none'; view.offsetHeight; view.style.animation = null; 
        } else {
            view.classList.remove('active');
        }
    });

    if (targetId === 'documents') {
        loadReceipts();
    }
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => navigateTo(item.getAttribute('data-target')));
});

// ==========================================
// NOTIFICATION BELL LOGIC
// ==========================================
const notifDropdown = document.getElementById('notif-dropdown');
const notifCount = document.getElementById('notif-count');
const notifList = document.getElementById('notif-list');

function renderNotifications() {
    if (!notifList || !notifCount) return;

    notifList.innerHTML = '';

    if (!notificationsData.length) {
        notifList.innerHTML = '<li style="padding:12px 16px; color: var(--text-muted);">No notifications yet.</li>';
        notifCount.style.display = 'none';
        return;
    }

    const unreadCount = notificationsData.filter(notification => !notification.read).length;
    if (unreadCount > 0) {
        notifCount.style.display = 'inline-flex';
        notifCount.innerText = unreadCount;
    } else {
        notifCount.style.display = 'none';
    }

    notificationsData.forEach(notification => {
        const li = document.createElement('li');
        li.className = notification.read ? '' : 'unread';
        li.innerHTML = `
            <div class="notif-icon bg-warning-light text-warning"><i class="fa-solid fa-bell"></i></div>
            <div class="notif-content">
                <strong>${notification.title || 'Notification'}</strong>
                <p>${notification.message || ''}</p>
                <span class="time">${notification.time || 'Just now'}</span>
            </div>
        `;
        notifList.appendChild(li);
    });
}

async function loadNotifications() {
    if (!currentStudentId) return;

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/student/notifications/${currentStudentId}`);
        if (!response.ok) return;

        const data = await response.json();
        const all = data.notifications || [];
          // Show all relevant notifications: PAYMENT, ALERT, INFO and verification results
          notificationsData = all.filter(n => {
              if (n && typeof n.type === 'string') {
                  return n.type === 'PAYMENT' || n.type === 'ALERT' || n.type === 'INFO';
            }
            // Backward compatible: if `type` is missing, keep payment-related notifications
            const title = (n && n.title ? String(n.title) : '').toLowerCase();
            return title.includes('payment');
        });
        renderNotifications();
    } catch (error) {
        console.error('Notification load failed:', error);
    }
}

function toggleNotifications() {
    notifDropdown.classList.toggle('active');
    if (notifDropdown.classList.contains('active')) {
        loadNotifications();
    }
}

async function clearNotifications() {
    if (!currentStudentId) return;

    try {
        await fetch(`http://127.0.0.1:8000/api/student/notifications/${currentStudentId}/mark-read`, {
            method: 'POST'
        });
        notificationsData = notificationsData.map(notification => ({ ...notification, read: true }));
        renderNotifications();
        showToast("Notifications marked as read", "success");
        setTimeout(toggleNotifications, 300);
    } catch (error) {
        showToast('Could not mark notifications as read.', 'error');
    }
}

// Close dropdown if clicked outside
document.addEventListener('click', (e) => {
    if(!e.target.closest('.notification-wrapper')) {
        notifDropdown.classList.remove('active');
    }
});

setInterval(() => {
    if (document.visibilityState === 'visible') {
        loadNotifications();
    }
}, 10000);

setInterval(() => {
    if (document.visibilityState === 'visible') {
        loadStudentData();
    }
}, 15000);

// ==========================================
// DYNAMIC QR PAYMENT ENGINE
// ==========================================
function updateMaxAmount() {
    const select = document.getElementById('pay-category');
    const amountInput = document.getElementById('pay-amount');
    const hint = document.getElementById('max-amount-hint');
    
    if(select.selectedIndex > 0) {
        const maxDue = select.options[select.selectedIndex].getAttribute('data-max');
        amountInput.max = maxDue;
        amountInput.value = maxDue; // Auto-fill with full due
        hint.innerText = `Max: ₹${parseInt(maxDue).toLocaleString('en-IN')}`;
    }
}

function generateDynamicQR() {
    const categorySelect = document.getElementById('pay-category');
    const amountInput = document.getElementById('pay-amount');
    
    if(categorySelect.selectedIndex === 0) {
        showToast("Please select a fee category", "error"); return;
    }
    if(!amountInput.value || amountInput.value <= 0) {
        showToast("Please enter a valid amount", "error"); return;
    }
    
    const category = categorySelect.value;
    const amount = parseInt(amountInput.value);
    const maxDue = parseInt(categorySelect.options[categorySelect.selectedIndex].getAttribute('data-max'));

    if(amount > maxDue) {
        showToast(`Amount cannot exceed pending due of ₹${maxDue}`, "error"); return;
    }

    // 1. Setup Data for QR
    const upiID = "college.bits@sbi"; // Mock Institute UPI
    // Real UPI URL format (Scannable by PhonePe/GPay)
    const upiString = `upi://pay?pa=${upiID}&pn=BITS%20Narsampet&am=${amount}&cu=INR&tn=Payment%20for%20${encodeURIComponent(category)}`;
    
    // 2. Generate Real QR using API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiString)}&color=0f172a`;
    
    // 3. Update UI (Switch to POS Terminal)
    document.getElementById('qr-placeholder').style.display = 'none';
    const terminal = document.getElementById('qr-active-terminal');
    terminal.style.display = 'block';
    
    document.getElementById('qr-category-label').innerText = `Towards: ${category}`;
    document.getElementById('qr-amount-display').innerText = `₹ ${amount.toLocaleString('en-IN')}`;
    document.getElementById('dynamic-qr-img').src = qrUrl;

    showToast("Dynamic Payment QR Generated", "success");
}

async function submitVerification() {
    const categorySelect = document.getElementById('pay-category');
    const utr = document.getElementById('pay-utr').value;
    const file = document.getElementById('pay-file').files[0];
    const category = categorySelect.value;
    const amount = parseInt(document.getElementById('pay-amount').value);

    if(!category || categorySelect.selectedIndex === 0) {
        showToast("Please select a fee category", "error"); 
        return;
    }
    if(!utr || !file) {
        showToast("Please provide UTR and Screenshot", "error"); 
        return;
    }

    try {
        const formData = new FormData();
        formData.append('student_id', currentStudentId);
        formData.append('category', category);
        formData.append('amount', amount);
        formData.append('utr_number', utr);
        formData.append('proof_file', file);

        const response = await fetch('http://127.0.0.1:8000/api/student/submit-payment', {
            method: 'POST',
            body: formData
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            let msg = data?.detail;
            if (Array.isArray(msg)) {
                msg = msg.map(x => x?.msg || x?.message).filter(Boolean).join('; ');
            } else if (msg && typeof msg !== 'string') {
                msg = msg.message || (() => { try { return JSON.stringify(msg); } catch { return String(msg); } })();
            }
            showToast(msg || 'Payment submission failed.', 'error');
            return;
        }

        document.getElementById('payment-setup-form').reset();
        document.getElementById('secure-pay-form').reset();
        document.getElementById('max-amount-hint').innerText = "Max: ₹0";
        document.getElementById('qr-active-terminal').style.display = 'none';
        document.getElementById('qr-placeholder').style.display = 'flex';

        showToast('Payment proof submitted! Awaiting admin verification.', 'success');
        await loadStudentData();
        navigateTo('dashboard');
    } catch (error) {
        showToast('Server connection failed while submitting payment.', 'error');
    }
}

// ==========================================
// TOAST UTILITIES
// ==========================================
function showToast(message, type = 'info') {
    if (message && typeof message !== 'string') {
        message = message.detail || message.message || (() => {
            try { return JSON.stringify(message); } catch { return String(message); }
        })();
    }
    if (!message) message = 'Something went wrong.';

    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast`;
    
    let iconHTML = '<i class="fa-solid fa-circle-info" style="color:#3b82f6"></i>';
    if(type === 'error') iconHTML = '<i class="fa-solid fa-circle-exclamation" style="color:#ef4444"></i>';
    if(type === 'success') iconHTML = '<i class="fa-solid fa-check-circle" style="color:#10b981"></i>';
    
    toast.innerHTML = `${iconHTML} <span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==========================================
// HELPDESK WIDGET LOGIC
// ==========================================
const supportWidget = document.getElementById('support-widget');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

function initializeChatbot() {
    if (!chatMessages) return;
    
    // Clear existing messages except greeting
    chatMessages.innerHTML = '';
    
    // Load chat history from localStorage
    const chatHistory = JSON.parse(localStorage.getItem(`chat_${currentStudentId}`) || '[]');
    
    if (chatHistory.length === 0) {
        // New chat - show greeting
        const firstName = currentStudentProfile.firstName || 'there';
        const branchNote = currentStudentProfile.branch ? ` (${currentStudentProfile.branch})` : '';
        const greeting = `Hi ${firstName}! I'm the BITS Support Bot${branchNote}. I can help with payments, receipts, or tickets. Ask a question or switch to Raise Ticket to alert admins.`;

        const div = document.createElement('div');
        div.className = 'chat-bubble bot-bubble';
        div.id = 'chat-greeting-bubble';
        div.innerText = greeting;
        chatMessages.appendChild(div);
    } else {
        // Show chat history
        chatHistory.forEach(msg => {
            let div = document.createElement('div');
            div.className = msg.type === 'user' ? 'chat-bubble user-bubble' : 'chat-bubble bot-bubble';
            div.innerText = msg.text;
            chatMessages.appendChild(div);
        });
        
        // Add clear chat button
        const clearBtn = document.createElement('div');
        clearBtn.style.cssText = 'text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;';
        clearBtn.innerHTML = '<button onclick="clearChatHistory()" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;">Clear Chat History</button>';
        chatMessages.appendChild(clearBtn);
    }
    
    // Auto-scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearChatHistory() {
    if (confirm('Clear all chat history?')) {
        localStorage.removeItem(`chat_${currentStudentId}`);
        initializeChatbot();
        showToast('Chat history cleared', 'success');
    }
}

function toggleSupport() {
    supportWidget.classList.toggle('active');
    if (supportWidget.classList.contains('active')) {
        initializeChatbot();
    }
}

function switchSupportTab(tabName, buttonEl) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (buttonEl) buttonEl.classList.add('active');

    document.getElementById('tab-chat').style.display = tabName === 'chat' ? 'flex' : 'none';
    document.getElementById('tab-ticket').style.display = tabName === 'ticket' ? 'block' : 'none';
    
    const historyTab = document.getElementById('tab-history');
    if (historyTab) historyTab.style.display = tabName === 'history' ? 'block' : 'none';

    if (tabName === 'chat') initializeChatbot();
    if (tabName === 'history') loadMyTickets();
}

function handleChatEnter(e) {
    if(e.key === 'Enter') sendChatMessage();
}

const botPlaybook = [
    {
        keywords: ['pending', 'not updated', 'due'],
        reply: 'If you just paid, the due updates after admin verification. Submit your UTR and screenshot via Submit for Admin Approval, or share the UTR here and I can log a ticket.'
    },
    {
        keywords: ['utr', 'screenshot', 'verification'],
        reply: 'Upload your payment screenshot with the exact UTR in Custom Payment > Submit for Admin Approval. If it is stuck, raise a ticket with UTR, amount, and date so admins can fast-track.'
    },
    {
        keywords: ['receipt', 'download'],
        reply: 'Approved receipts appear in Document Center. If it is missing, raise a ticket with the UTR and category so finance can regenerate it.'
    },
    {
        keywords: ['propose', 'fee', 'wrong amount', 'incorrect'],
        reply: 'For incorrect or proposed fees, submit a ticket under "Incorrect Fee Proposed" with the fee name and the correct amount expected.'
    },
    {
        keywords: ['login', 'password'],
        reply: 'For login/password issues, try logging in with your roll number. If it still fails, raise a ticket with your roll number and a screenshot of the error.'
    }
];

function getBotReply(message) {
    const text = (message || '').toLowerCase();
    for (const rule of botPlaybook) {
        if (rule.keywords.some(k => text.includes(k))) return rule.reply;
    }
    const name = currentStudentProfile.firstName || 'you';
    return `Thanks, ${name}. I can route this to admins. Switch to Raise Ticket and include your UTR, amount, and issue category for the quickest response.`;
}

function sendChatMessage() {
    const text = chatInput.value.trim();
    if(!text) return;
    
    // 1. Add User Message
    chatMessages.innerHTML += `<div class="chat-bubble user-bubble">${text}</div>`;
    chatInput.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Save to localStorage
    const chatHistory = JSON.parse(localStorage.getItem(`chat_${currentStudentId}`) || '[]');
    chatHistory.push({ type: 'user', text: text, timestamp: new Date().toISOString() });
    localStorage.setItem(`chat_${currentStudentId}`, JSON.stringify(chatHistory));

    // 2. Simulate Bot "Typing..."
    const typingId = 'typing-' + Date.now();
    chatMessages.innerHTML += `<div class="typing-indicator" id="${typingId}">Agent is typing...</div>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 3. Bot Reply
    setTimeout(() => {
        document.getElementById(typingId).remove();
        const reply = getBotReply(text);
        chatMessages.innerHTML += `<div class="chat-bubble bot-bubble">${reply}</div>`;
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Save bot reply to localStorage
        const updatedHistory = JSON.parse(localStorage.getItem(`chat_${currentStudentId}`) || '[]');
        updatedHistory.push({ type: 'bot', text: reply, timestamp: new Date().toISOString() });
        localStorage.setItem(`chat_${currentStudentId}`, JSON.stringify(updatedHistory));
    }, 1500);
}

async function submitTicket() {
    const form = document.getElementById('ticket-form');
    if(!form.checkValidity()) { form.reportValidity(); return; }

    if (!currentStudentId) {
        showToast("Session expired. Please log in again.", "error");
        return;
    }

    const category = document.getElementById('ticket-category').value;
    const subject = document.getElementById('ticket-subject').value;
    const description = document.getElementById('ticket-description').value;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/student/submit-ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: Number(currentStudentId),
                subject: subject,
                description: description,
                category: category
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.detail || 'Ticket submission failed');
        }

        showToast(`Ticket ${data.ticket_number} submitted successfully.`, "success");
        form.reset();
        // Auto-switch to history to see the new ticket
        const historyBtn = document.querySelector('.tab-btn:nth-child(3)');
        if (historyBtn) switchSupportTab('history', historyBtn);
        else setTimeout(toggleSupport, 1000);
    } catch (error) {
        showToast(error.message || 'Ticket submission failed.', 'error');
    }
}

async function loadMyTickets() {
    const container = document.getElementById('student-tickets-list');
    if (!container || !currentStudentId) return;

    container.innerHTML = '<p class="text-sm text-muted text-center mt-4"><i class="fa-solid fa-spinner fa-spin"></i> Loading tickets...</p>';
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/student/my-tickets/${currentStudentId}`);
        if (!response.ok) throw new Error('Failed to load tickets');
        
        const data = await response.json();
        const tickets = data.tickets || [];
        
        if (tickets.length === 0) {
            container.innerHTML = `
                <div class="text-center mt-4">
                    <i class="fa-regular fa-folder-open fa-3x" style="color: var(--text-muted); opacity: 0.5;"></i>
                    <p class="text-muted mt-2">No tickets raised yet.</p>
                </div>
            `;
            return;
        }
        
        let html = '<div style="display: flex; flex-direction: column; gap: 10px;" id="ticket-cards-container">';
        tickets.forEach((t, idx) => {
            const statusColor = t.status === 'OPEN' ? '#3b82f6' : 
                                t.status === 'IN_PROGRESS' ? '#f59e0b' : 
                                t.status === 'RESOLVED' ? '#10b981' : '#6b7280';
            
            html += `
                <div class="ticket-card" onclick="openTicketThread(${idx})" style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid ${statusColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer; transition: all 0.2s; data-ticket-idx='${idx}'">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="font-weight: 600; color: var(--primary); font-size: 0.9rem;">${t.ticket_number}</span>
                        <span style="background: ${statusColor}20; color: ${statusColor}; padding: 4px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${t.status}</span>
                    </div>
                    <div style="font-weight: 600; margin-bottom: 5px; color: var(--text-main);">${t.subject}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 5px;">${t.category} • ${t.created_at}</div>
                    ${t.admin_response ? '<div style="font-size: 0.8rem; color: #10b981; margin-top: 5px;"><i class="fa-solid fa-reply"></i> Admin replied</div>' : ''}
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        
        // Add hover effect with CSS
        const style = document.createElement('style');
        style.textContent = `
            .ticket-card:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
        `;
        document.head.appendChild(style);
        
        window.studentTickets = tickets; // Store for access
        
    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="text-center text-danger mt-4">Failed to load tickets.</p>';
    }
}

let currentOpenTicket = null;

async function openTicketThread(ticketIdx) {
    const ticket = window.studentTickets[ticketIdx];
    if (!ticket) return;
    
    currentOpenTicket = ticket;
    
    const container = document.getElementById('student-tickets-list');
    const statusColor = ticket.status === 'OPEN' ? '#3b82f6' : 
                        ticket.status === 'IN_PROGRESS' ? '#f59e0b' : 
                        ticket.status === 'RESOLVED' ? '#10b981' : '#6b7280';
    
    // Show a loading UI while fetching messages
    container.innerHTML = `
        <div style="display: flex; justify-content: center; align-items: center; height: 100%;">
            <p>Loading chat...</p>
        </div>
    `;

    try {
        const response = await fetch(`http://127.0.0.1:8000/api/ticket/${ticket.id}/messages`);
        const data = await response.json();
        const messages = data.messages || [];

    let html = `
        <div style="display: flex; flex-direction: column; height: 100%; gap: 0;">
            <!-- Back Button + Header -->
            <div style="padding: 15px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <button onclick="loadMyTickets()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--primary);">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${ticket.ticket_number}</div>
                        <div style="font-weight: 600; color: var(--primary);">${ticket.subject}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button onclick="deleteTicket(${ticket.id})" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                    <span style="background: ${statusColor}20; color: ${statusColor}; padding: 6px 12px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${ticket.status}</span>
                </div>
            </div>
            
            <!-- Thread Messages -->
            <div id="student-thread-messages" style="flex: 1; overflow-y: auto; padding: 20px; background: #f8fafc; display: flex; flex-direction: column; gap: 15px;">
                <!-- Student's Initial Message -->
                <div style="display: flex; justify-content: flex-end;">
                    <div style="max-width: 70%; background: #3b82f6; color: white; padding: 12px; border-radius: 12px; border-bottom-right-radius: 4px;">
                        <div style="font-size: 0.85rem; margin-bottom: 5px;">
                            <strong>You</strong>
                            <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 2px;">${ticket.created_at}</div>
                        </div>
                        <div style="margin-top: 8px;">${ticket.description}</div>
                    </div>
                </div>
                
                <!-- Chat History -->
                ${messages.length === 0 ? (ticket.admin_response ? `
                    <div style="display: flex; justify-content: flex-start;">
                        <div style="max-width: 70%; background: white; border: 1px solid #e2e8f0; padding: 12px; border-radius: 12px; border-bottom-left-radius: 4px; border-left: 3px solid #10b981;">
                            <div style="font-size: 0.85rem; margin-bottom: 5px; color: #10b981;">
                                <strong>👨‍💼 Admin</strong>
                            </div>
                            <div style="margin-top: 8px; color: var(--text-main);">${ticket.admin_response}</div>
                        </div>
                    </div>
                    ` : '<div style="text-align: center; color: var(--text-muted); font-size: 0.9rem;"><i class="fa-solid fa-hourglass-end"></i> Waiting for admin response...</div>') : ''}
                
                ${messages.map(msg => {
                    const isAdmin = msg.sender_type === 'ADMIN';
                    return `
                    <div style="display: flex; justify-content: ${isAdmin ? 'flex-start' : 'flex-end'};">
                        <div style="max-width: 70%; ${isAdmin ? 'background: white; border: 1px solid #e2e8f0; border-left: 3px solid #10b981;' : 'background: #3b82f6; color: white;'} padding: 12px; border-radius: 12px; ${isAdmin ? 'border-bottom-left-radius: 4px;' : 'border-bottom-right-radius: 4px;'}">
                            <div style="font-size: 0.85rem; margin-bottom: 5px; ${isAdmin ? 'color: #10b981;' : ''}">
                                <strong>${isAdmin ? '👨‍💼 Admin' : 'You'}</strong>
                                <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 2px;">${msg.created_at}</div>
                            </div>
                            <div style="margin-top: 8px; ${isAdmin ? 'color: var(--text-main);' : ''}">${msg.message_text}</div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
            
            <!-- Reply Input Area -->
            <div style="padding: 15px; border-top: 1px solid #e2e8f0; background: white; display: flex; gap: 10px;">
                <input type="text" id="ticket-reply-input" placeholder="Type your reply..." style="flex: 1; padding: 10px 15px; border: 1px solid #e2e8f0; border-radius: 20px; outline: none; font-size: 0.9rem;" />
                <button onclick="sendTicketReply()" style="background: #3b82f6; color: white; border: none; padding: 10px 15px; border-radius: 20px; cursor: pointer; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-paper-plane"></i> Reply
                </button>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    const threadMessages = document.getElementById('student-thread-messages');
    if(threadMessages) threadMessages.scrollTop = threadMessages.scrollHeight;

    } catch(err) {
        console.error("Failed to fetch messages:", err);
        container.innerHTML = '<p class="text-center text-danger mt-4">Failed to load chat.</p>';
    }
}

async function deleteTicket(ticketId) {
    if(!confirm("Are you sure you want to delete this chat permanently?")) return;
    try {
        const res = await fetch(`http://127.0.0.1:8000/api/ticket/${ticketId}`, {
            method: 'DELETE'
        });
        if(res.ok) {
            showToast("Chat deleted", "success");
            loadMyTickets();
        } else {
            showToast("Failed to delete chat", "error");
        }
    } catch(err) {
        showToast("Error deleting chat", "error");
    }
}

async function sendTicketReply() {
    const input = document.getElementById('ticket-reply-input');
    const replyText = input.value.trim();
    
    if (!replyText) {
        showToast('Please enter a message', 'error');
        return;
    }
    
    if (!currentOpenTicket) return;
    
    // Show reply in UI immediately
    const threadDiv = document.querySelector('[style*="display: flex"][style*="flex-direction: column"]');
    if (threadDiv) {
        const messagesArea = threadDiv.querySelector('div[style*="flex: 1"]');
        if (messagesArea) {
            const replyDiv = document.createElement('div');
            replyDiv.style.cssText = 'display: flex; justify-content: flex-end;';
            replyDiv.innerHTML = `
                <div style="max-width: 70%; background: #3b82f6; color: white; padding: 12px; border-radius: 12px; border-bottom-right-radius: 4px;">
                    <div style="font-size: 0.85rem; margin-bottom: 5px;">
                        <strong>You</strong>
                        <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 2px;">Just now</div>
                    </div>
                    <div style="margin-top: 8px;">${replyText}</div>
                </div>
            `;
            messagesArea.appendChild(replyDiv);
            messagesArea.scrollTop = messagesArea.scrollHeight;
        }
    }
    
    // Clear input
    input.value = '';
    
    try {
        // Send to backend - add message to ticket message history
        const res = await fetch(`http://127.0.0.1:8000/api/ticket/${currentOpenTicket.id}/add-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender_type: 'STUDENT',
                sender_id: currentStudentId,
                message_text: replyText
            })
        });

        if (!res.ok) {
            console.error('Failed to save reply to database');
        }
    } catch (error) {
        console.error('Error sending reply:', error);
    }
    
    // Save to localStorage for persistence on student side
    const chatKey = `ticket_replies_${currentOpenTicket.ticket_number}`;
    const replies = JSON.parse(localStorage.getItem(chatKey) || '[]');
    replies.push({
        type: 'student',
        text: replyText,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem(chatKey, JSON.stringify(replies));
    
    showToast('Reply sent', 'success');
}

// ==========================================
// LOGOUT FUNCTIONALITY
// ==========================================
function logout() {
    localStorage.clear();
    // alert("Logged out securely.");
    window.location.href = "/login";
}