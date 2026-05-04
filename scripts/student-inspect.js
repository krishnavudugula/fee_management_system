const params = new URLSearchParams(window.location.search);
const rollNumber = params.get('roll');

const summaryName = document.getElementById('summary-name');
const summaryRoll = document.getElementById('summary-roll');
const summaryAllocated = document.getElementById('summary-allocated');
const summaryPaid = document.getElementById('summary-paid');
const summaryDue = document.getElementById('summary-due');
const subtitle = document.getElementById('student-subtitle');
const duesTableBody = document.getElementById('dues-table-body');
const transactionsTableBody = document.getElementById('transactions-table-body');
const sendAlertBtn = document.getElementById('send-alert-btn');

function formatCurrency(value) {
    return `₹ ${Number(value || 0).toLocaleString('en-IN')}`;
}

function normalizeStatus(status) {
    return String(status || '').toUpperCase();
}

function getStatusBadge(status) {
    const value = normalizeStatus(status);
    if (value === 'VERIFIED' || value === 'CLEARED') {
        return '<span class="badge badge-verified">Verified</span>';
    }
    if (value === 'REJECTED') {
        return '<span class="badge badge-rejected">Rejected</span>';
    }
    if (value === 'PENDING_APPROVAL' || value === 'PENDING') {
        return '<span class="badge badge-pending">Pending</span>';
    }
    return `<span class="badge badge-cleared">${value || 'NA'}</span>`;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
}

function renderDues(dues) {
    if (!dues || dues.length === 0) {
        duesTableBody.innerHTML = '<tr><td colspan="6" class="empty">No fee records found for this student.</td></tr>';
        return;
    }

    duesTableBody.innerHTML = dues.map((due) => {
        return `
            <tr>
                <td>${due.category}</td>
                <td>${formatCurrency(due.total)}</td>
                <td>${formatCurrency(due.paid)}</td>
                <td style="color:${due.remaining > 0 ? '#dc2626' : '#059669'}; font-weight:600;">${formatCurrency(due.remaining)}</td>
                <td>${formatCurrency(due.pending_approval)}</td>
                <td>${getStatusBadge(due.status)}</td>
            </tr>
        `;
    }).join('');
}

function renderTransactions(transactions) {
    if (!transactions || transactions.length === 0) {
        transactionsTableBody.innerHTML = '<tr><td colspan="6" class="empty">No transactions recorded yet.</td></tr>';
        return;
    }

    transactionsTableBody.innerHTML = transactions.map((txn) => {
        const proofCell = txn.proof_url
            ? `<a href="${txn.proof_url}" target="_blank" rel="noopener noreferrer">View Proof</a>`
            : '-';

        return `
            <tr>
                <td>${txn.submitted_at || '-'}</td>
                <td>${txn.category}</td>
                <td>${formatCurrency(txn.amount)}</td>
                <td>${txn.utr || '-'}</td>
                <td>${getStatusBadge(txn.status)}</td>
                <td>${proofCell}</td>
            </tr>
        `;
    }).join('');
}

async function sendAlert() {
    if (!rollNumber) return;

    try {
        const response = await fetch('/api/admin/trigger-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roll_number: rollNumber })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'Failed to send alert');
        }
        showToast('Alert sent successfully.');
    } catch (error) {
        showToast(error.message || 'Could not send alert.');
    }
}

async function loadInspection() {
    if (!rollNumber) {
        subtitle.textContent = 'No roll number provided in URL. Please open this page from Admin dashboard.';
        duesTableBody.innerHTML = '<tr><td colspan="6" class="empty">Missing roll number.</td></tr>';
        transactionsTableBody.innerHTML = '<tr><td colspan="6" class="empty">Missing roll number.</td></tr>';
        return;
    }

    try {
        const response = await fetch(`/api/admin/student-fee-details/${encodeURIComponent(rollNumber)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Failed to load student details');
        }

        const student = data.student;
        const summary = data.summary;

        summaryName.textContent = student.full_name;
        summaryRoll.textContent = `${student.roll_number} | ${student.branch} | ${student.email}`;
        summaryAllocated.textContent = formatCurrency(summary.total_allocated);
        summaryPaid.textContent = formatCurrency(summary.total_paid);
        summaryDue.textContent = formatCurrency(summary.total_due);
        subtitle.textContent = `Inspection view for ${student.full_name} (${student.roll_number}).`;

        renderDues(data.dues);
        renderTransactions(data.transactions);

        sendAlertBtn.disabled = false;
        sendAlertBtn.addEventListener('click', sendAlert);
    } catch (error) {
        subtitle.textContent = error.message || 'Could not load student details.';
        duesTableBody.innerHTML = `<tr><td colspan="6" class="empty">${error.message || 'Failed to load details.'}</td></tr>`;
        transactionsTableBody.innerHTML = `<tr><td colspan="6" class="empty">${error.message || 'Failed to load details.'}</td></tr>`;
    }
}

loadInspection();
