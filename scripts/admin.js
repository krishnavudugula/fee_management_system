// ==========================================
// SPA NAVIGATION
// ==========================================
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view-section');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(n => n.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));
        
        item.classList.add('active');
        const target = item.getAttribute('data-target');
        const targetView = document.getElementById(`view-${target}`);
        if(targetView) targetView.classList.add('active');

        if (target === 'dashboard') loadDashboardData();
        if (target === 'manage-students') loadAllStudents();
        if (target === 'verifications') loadVerificationQueue();
        if (target === 'support') loadSupportView();
    });
});
// ==========================================
// DASHBOARD: REAL-TIME DB CONNECTION
// ==========================================
let students = []; // Start completely empty!
let filteredStudents = [];

function dismissAlertedRows(rollNumbers = []) {
    const validRolls = rollNumbers.filter(Boolean);
    if (!validRolls.length) return;

    const tbody = document.getElementById('defaulter-table');
    validRolls.forEach(roll => {
        const row = tbody?.querySelector(`tr[data-roll-number="${roll}"]`);
        if (row) {
            row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            row.style.opacity = '0';
            row.style.transform = 'translateX(25px)';
            setTimeout(() => row.remove(), 300);
        }
    });

    const alertedSet = new Set(validRolls);
    students = students.filter(student => !alertedSet.has(student.id));
    filteredStudents = filteredStudents.filter(student => !alertedSet.has(student.id));

    setTimeout(() => {
        renderDefaulters(filteredStudents);
    }, 320);
}

function openStudentInspector(rollNumber) {
    if (!rollNumber) {
        showToast('Student roll number not found.', 'error');
        return;
    }
    window.location.href = `/admin/student-inspect?roll=${encodeURIComponent(rollNumber)}`;
}

async function loadDashboardData() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/dashboard-stats');
        if (!response.ok) throw new Error("Failed to fetch DB stats");
        
        const data = await response.json();
        
        // 1. Update the Big Numbers
        document.getElementById('stat-total-paid').innerText = `₹ ${data.total_paid.toLocaleString('en-IN')}`;
        document.getElementById('stat-total-due').innerText = `₹ ${data.total_due.toLocaleString('en-IN')}`;
        document.getElementById('stat-active-enrollments').innerText = data.active_enrollments.toLocaleString('en-IN');
        
        // 2. Update Progress Bars Dynamically
        const totalAllocated = data.total_allocated > 0 ? data.total_allocated : 1; // Prevent divide by zero
        const paidPercent = (data.total_paid / totalAllocated) * 100;
        const duePercent = (data.total_due / totalAllocated) * 100;
        
        document.getElementById('bar-total-paid').style.width = `${paidPercent}%`;
        document.getElementById('bar-total-due').style.width = `${duePercent}%`;

        // 3. Update the global students array and render table
        students = data.defaulters || [];
        filteredStudents = [...students];
        renderDefaulters(students);

    } catch (error) {
        console.error("Database connection error:", error);
        document.getElementById('defaulter-table').innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:30px;">Error connecting to the Database. Is the Python server running?</td></tr>`;
    }
}

// Call this function immediately when the Admin page loads
loadDashboardData();

// ==========================================
// RENDER DEFAULTERS TABLE
// ==========================================
function renderDefaulters(list) {
    const tbody = document.getElementById('defaulter-table');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (!list || list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">No students with pending dues.</td></tr>`;
        return;
    }

    list.forEach(student => {
        const nameParts = student.name ? student.name.split(' ') : ["N", "A"];
        const initials = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];

        const row = `
            <tr data-roll-number="${student.id}">
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="background:#f1f5f9; color:#475569; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:bold;">${initials}</div>
                        <div>
                            <strong style="display:block; color:var(--text-dark);">${student.name}</strong>
                            <span style="font-size:0.8rem; color:var(--text-muted);">${student.id}</span>
                        </div>
                    </div>
                </td>
                <td>${student.branch}</td>
                <td style="color:var(--danger); font-weight:700;">₹ ${student.due.toLocaleString('en-IN')}</td>
                <td><span style="background: #fecaca; color: #b91c1c; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem;">Overdue</span></td>
                <td>
                    <button class="inspect-student-btn" data-roll-number="${encodeURIComponent(student.id || '')}" style="border:none; background:transparent; cursor:pointer; color: var(--primary); margin-right: 8px;" title="Inspect Fee Details">
                        <i class="fa-solid fa-magnifying-glass-dollar"></i>
                    </button>
                    <button class="alert-single-btn" data-student-name="${encodeURIComponent(student.name || '')}" data-roll-number="${encodeURIComponent(student.id || '')}" style="border:none; background:transparent; cursor:pointer; color: var(--text-muted);">
                        <i class="fa-regular fa-bell"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function applyRangeFilter() {
    const minInput = document.querySelector('input[placeholder="Min Due (₹)"]');
    const maxInput = document.querySelector('input[placeholder="Max Due (₹)"]');
    
    if(!minInput || !maxInput) return;

    const min = parseFloat(minInput.value) || 0;
    const max = parseFloat(maxInput.value) || 99999999;
    
    filteredStudents = students.filter(s => s.due >= min && s.due <= max);
    renderDefaulters(filteredStudents);
}

// (Keep your existing functions below this)

// ==========================================
// UNIVERSAL MODAL SYSTEM
// ==========================================
const modal = document.getElementById('confirm-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const confirmBtn = document.getElementById('modal-confirm-btn');
const modalIcon = document.getElementById('modal-icon');

let currentConfirmCallback = null;

function openConfirmModal(title, desc, iconHtml, callback, confirmText = 'Confirm') {
    modalTitle.innerText = title;
    modalDesc.innerHTML = desc;
    modalIcon.innerHTML = iconHtml;
    confirmBtn.innerText = confirmText;
    currentConfirmCallback = callback;
    modal.classList.add('active');
}

function closeConfirmModal() {
    modal.classList.remove('active');
    currentConfirmCallback = null;
}

confirmBtn.addEventListener('click', async () => {
    if(currentConfirmCallback) {
        const ogText = confirmBtn.innerText;
        confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        confirmBtn.disabled = true;
        
        setTimeout(async () => {
            try {
                await currentConfirmCallback();
            } catch (error) {
                showToast(error.message || 'Action failed. Please try again.', 'error');
            } finally {
                confirmBtn.innerText = ogText;
                confirmBtn.disabled = false;
                closeConfirmModal();
            }
        }, 800);
    }
});

// ==========================================
// ALERTS
// ==========================================
function confirmSingleAlert(name, rollNumber) {
    openConfirmModal(
        "Trigger Alert",
        `Are you sure you want to send an SMS and App Notification to <strong>${name}</strong>?`,
        '<i class="fa-solid fa-bell text-warning"></i>',
        async () => {
            const response = await fetch('http://127.0.0.1:8000/api/admin/trigger-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll_number: rollNumber })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to send alert');
            }

            dismissAlertedRows([rollNumber]);
            showToast(`Alert sent successfully to ${name}`, 'success');
        }
    );
}

function triggerBulkAlert() {
    if(filteredStudents.length === 0) {
        showToast("No students in the current filter list.", "error");
        return;
    }
    openConfirmModal(
        "Bulk Alert",
        `You are about to alert <strong>${filteredStudents.length} students</strong> currently shown in the table. Proceed?`,
        '<i class="fa-solid fa-bullhorn text-warning"></i>',
        async () => {
            const rollNumbers = filteredStudents.map(student => student.id).filter(Boolean);
            const response = await fetch('http://127.0.0.1:8000/api/admin/trigger-bulk-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll_numbers: rollNumbers })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to send bulk alerts');
            }

            dismissAlertedRows(rollNumbers);
            showToast(`Bulk alerts dispatched to ${rollNumbers.length} students!`, 'success');
        }
    );
}

// ==========================================
// PROPOSE FEE & HISTORY
// ==========================================
async function loadFeeHistory() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/fee-proposals');
        const data = await response.json();
        renderFeeHistory(data.proposals || []);
    } catch (err) {
        console.error('Failed to load fee history:', err);
    }
}

function renderFeeHistory(proposals) {
    const tbody = document.getElementById('fee-history-table');
    if(!tbody) return;
    tbody.innerHTML = '';

    if (proposals.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">No recent fee proposals.</td></tr>`;
        return;
    }

    proposals.forEach(fee => {
        tbody.innerHTML += `
            <tr>
                <td style="color:var(--text-muted); font-size:0.9rem;">${fee.date}</td>
                <td style="font-weight:600; color:var(--primary);">${fee.title}</td>
                <td><span class="badge" style="background: #e2e8f0; color: #475569;">${fee.target_audience}</span></td>
                <td style="font-weight:700;">₹ ${fee.amount.toLocaleString('en-IN')}</td>
                <td><span class="status-active">Active</span></td>
                <td>
                    <button class="btn btn-danger btn-sm" onclick="deleteFeeProposal(${fee.id})" style="padding: 5px 10px; font-size: 0.8rem; border-radius: 4px; background: #ef4444; color: white; border: none; cursor: pointer;">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    });
}

async function deleteFeeProposal(id) {
    if(!confirm("Are you sure you want to delete this fee proposal? This will also remove the pending unpaid dues for students.")) return;
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/admin/fee-proposals/${id}`, {
            method: 'DELETE',
        });
        
        if (response.ok) {
            showToast("Fee proposal deleted successfully", "success");
            loadFeeHistory();
        } else {
            const errData = await response.json();
            showToast(errData.detail || "Failed to delete fee proposal", "error");
        }
    } catch (err) {
        console.error(err);
        showToast("An error occurred", "error");
    }
}

// Load fee history on page load
loadFeeHistory();

async function confirmFeeProposal() {
    const desc = document.getElementById('fee-desc').value;
    const amount = document.getElementById('fee-amount').value;
    const targetSelect = document.getElementById('fee-target');
    const target = targetSelect.value;

    if(!desc || !amount || !target) {
        showToast("Please fill all fields", "error"); 
        return;
    }

    openConfirmModal(
        "Propose New Fee",
        `Apply <strong>₹${amount}</strong> for "<strong>${desc}</strong>" to <strong>${targetSelect.options[targetSelect.selectedIndex].text}</strong>?`,
        '<i class="fa-solid fa-file-invoice-dollar text-primary"></i>',
        async () => {
            try {
                const response = await fetch('http://127.0.0.1:8000/api/admin/propose-fee', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: desc,
                        description: desc,
                        amount: parseFloat(amount),
                        target_audience: target
                    })
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.detail || 'Failed to propose fee');
                }

                document.getElementById('propose-fee-form').reset();
                showToast(`Fee proposed successfully to ${data.students_count} students!`, 'success');
                loadFeeHistory();
            } catch (error) {
                showToast(error.message || 'Failed to propose fee', 'error');
            }
        }
    );
}

// ==========================================
// ENROLLMENT: FEE CALCULATOR & REGISTRATION
// ==========================================
const feeCheckboxes = document.querySelectorAll('.fee-calc-check');
const liveTotalDisplay = document.getElementById('live-total');

function calculateTotal() {
    let total = 0;
    feeCheckboxes.forEach(box => {
        if (box.checked) {
            total += parseInt(box.getAttribute('data-amount'));
        }
    });
    if(liveTotalDisplay) {
        liveTotalDisplay.innerText = `₹ ${total.toLocaleString('en-IN')}`;
    }
}

// Initialize calculator events
feeCheckboxes.forEach(box => box.addEventListener('change', calculateTotal));
calculateTotal(); // Run on load

// ==========================================
// ENROLLMENT: REAL-TIME API CONNECTION
// ==========================================
async function registerSingleStudent() {
    const form = document.getElementById('single-enroll-form');
    
    // 1. Basic HTML Validation
    if(!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // 2. Extract Data from the form inputs
    // (Assuming they are in order: Name, Roll No, Branch, Password)
    const inputs = form.querySelectorAll('.form-control');
    const fullName = inputs[0].value;
    const rollNumber = inputs[1].value;
    const branch = inputs[2].value;
    const password = inputs[3].value; // New Password Field

    // 3. Extract Selected Fees dynamically
    const selectedFees = [];
    const feeCheckboxes = document.querySelectorAll('.fee-calc-check');
    
    feeCheckboxes.forEach(box => {
        if (box.checked) {
            // Grab the text of the fee category (e.g., "Tuition Fee")
            const categoryName = box.parentElement.querySelector('.fee-name').childNodes[0].nodeValue.trim();
            const amount = parseFloat(box.getAttribute('data-amount'));
            
            selectedFees.push({ 
                category: categoryName, 
                amount: amount 
            });
        }
    });

    // 4. Construct the JSON Payload exactly as the Python backend expects
    const payload = {
        full_name: fullName,
        roll_number: rollNumber,
        branch: branch,
        password: password, // Use the real input password
        fees: selectedFees
    };

    // 5. Update UI to Loading State
    const btn = document.getElementById('btn-register-single');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving to Database...';
    btn.disabled = true;

    // 6. Send to Python Backend
    try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/register-student', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            // Success! The database saved it.
            showToast('Student account generated and saved to database!', 'success');
            
            // Reset the form
            form.reset(); 
            feeCheckboxes.forEach((box, index) => {
                box.checked = index < 4; // Reset to default 4 checks
            });
            calculateTotal();

            await loadDashboardData();
            await loadAllStudents();
            
        } else {
            // Backend rejected it (e.g., Roll number already exists)
            showToast(data.detail || "Registration failed.", 'error');
        }
        
    } catch (error) {
        console.error("API Error:", error);
        showToast("Cannot connect to server. Is FastAPI running?", 'error');
    } finally {
        // Restore button state
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// BULK CSV UPLOAD
// ==========================================
function processBulkUpload(input) {
    if(input.files.length > 0) {
        const dropzone = document.getElementById('csv-dropzone');
        const progressBox = document.getElementById('upload-progress');
        const fill = document.getElementById('upload-fill');
        const percentText = document.getElementById('upload-percent');

        dropzone.style.display = 'none';
        progressBox.style.display = 'block';

        let progress = 0;
        const interval = setInterval(() => {
            progress += 20;
            fill.style.width = `${progress}%`;
            percentText.innerText = `${progress}%`;

            if(progress >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    showToast("Batch import complete! Accounts generated.", "success");
                    dropzone.style.display = 'flex';
                    progressBox.style.display = 'none';
                    fill.style.width = '0%';
                    input.value = '';
                }, 500);
            }
        }, 400);
    }
}

// ==========================================
// VERIFICATION QUEUE
// ==========================================
let queueData = [];

function isVerificationsViewActive() {
    const view = document.getElementById('view-verifications');
    return !!(view && view.classList.contains('active'));
}

function renderQueue() {
    const tbody = document.getElementById('verification-table');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if (queueData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">No pending payment verifications.</td></tr>`;
        
        // Hide badge
        const badge = document.getElementById('verification-badge');
        if(badge) badge.style.display = 'none';
        
        return;
    }

    // Show Badge
    const badge = document.getElementById('verification-badge');
    if(badge) {
        badge.innerText = queueData.length;
        badge.style.display = 'inline-block';
    }

    queueData.forEach(q => {
        tbody.innerHTML += `
            <tr id="row-${q.transaction_id}">
                <td><input type="checkbox" class="custom-chk row-chk" value="${q.transaction_id}" onchange="updateApproveBtn()"></td>
                <td style="color:var(--text-muted); font-size:0.9rem;">${q.date}</td>
                <td style="font-weight:600;">${q.student_name}<br><span style="font-size:0.8rem;color:var(--text-muted)">${q.roll_number} | ${q.branch}</span></td>
                <td><strong style="color:var(--success);">₹ ${Number(q.amount).toLocaleString('en-IN')}</strong> <br><span style="font-size:0.8rem;color:var(--text-muted)">${q.category} | UTR: ${q.utr}</span></td>
                <td>
                    <a href="${q.proof_url}" target="_blank" style="color:var(--accent); font-size:0.9rem;"><i class="fa-solid fa-image"></i> View Proof</a>
                    <div style="display:flex; gap:8px; margin-top:8px;">
                        <button class="btn btn-success btn-sm" onclick="approveTransaction(${q.transaction_id})"><i class="fa-solid fa-check"></i> Approve</button>
                        <button class="btn btn-outline btn-sm" style="color:var(--danger); border-color:#fecaca;" onclick="rejectTransaction(${q.transaction_id})"><i class="fa-solid fa-xmark"></i> Reject</button>
                    </div>
                </td>
            </tr>
        `;
    });
}
loadVerificationQueue();

// Poll the queue so new student submissions appear without refresh.
setInterval(() => {
    // Always keep the badge fresh; only re-render the table if the view is active.
    loadVerificationQueue({ renderTable: isVerificationsViewActive() });
}, 8000);

async function loadVerificationQueue(options = {}) {
    const { renderTable = true } = options;
    try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/verification-queue');
        if (!response.ok) throw new Error('Failed to load verification queue');
        const data = await response.json();
        queueData = data.queue || [];
        // Always update the badge count via renderQueue()'s logic.
        // If the table isn't currently visible, skip table rendering to avoid wiping selections.
        if (renderTable) {
            renderQueue();
            updateApproveBtn();
        } else {
            const badge = document.getElementById('verification-badge');
            if (badge) {
                if (queueData.length > 0) {
                    badge.innerText = queueData.length;
                    badge.style.display = 'inline-block';
                } else {
                    badge.style.display = 'none';
                }
            }
        }
    } catch (error) {
        console.error('Queue load error:', error);
        const tbody = document.getElementById('verification-table');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#ef4444; padding:30px;">Could not load verification queue.</td></tr>`;
        }
    }
}

function toggleSelectAll(masterChk) {
    const checkboxes = document.querySelectorAll('.row-chk');
    checkboxes.forEach(chk => chk.checked = masterChk.checked);
    updateApproveBtn();
}

function updateApproveBtn() {
    const checkedCount = document.querySelectorAll('.row-chk:checked').length;
    const btn = document.getElementById('bulk-approve-btn');
    document.getElementById('selected-count').innerText = checkedCount;
    
    if(checkedCount > 0) {
        btn.disabled = false;
        btn.classList.add('pulse');
    } else {
        btn.disabled = true;
        btn.classList.remove('pulse');
        document.getElementById('select-all').checked = false;
    }
}

function confirmBulkApprove() {
    const checkedBoxes = document.querySelectorAll('.row-chk:checked');
    if (checkedBoxes.length === 0) {
        showToast('Select at least one transaction.', 'error');
        return;
    }

    openConfirmModal(
        "Approve Payments",
        `You are about to verify and generate receipts for <strong>${checkedBoxes.length} transactions</strong>.`,
        '<i class="fa-solid fa-check-double text-success"></i>',
        async () => {
            const ids = Array.from(checkedBoxes).map(chk => Number(chk.value));
            for (const transactionId of ids) {
                await fetch(`http://127.0.0.1:8000/api/admin/verification-action/${transactionId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'approve' })
                });
            }
            showToast("Transactions verified successfully.", "success");
            await loadVerificationQueue();
            await loadDashboardData();
        }
    );
}

async function approveTransaction(transactionId) {
    openConfirmModal(
        'Approve Payment',
        'Approve this payment and generate receipt for the student?',
        '<i class="fa-solid fa-check-double text-success"></i>',
        async () => {
            const response = await fetch(`http://127.0.0.1:8000/api/admin/verification-action/${transactionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve' })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Approval failed');

            showToast('Payment approved successfully.', 'success');
            await loadVerificationQueue();
            await loadDashboardData();
        }
    );
}

function rejectTransaction(transactionId) {
    openConfirmModal(
        'Reject Payment',
        `<div style="text-align:left;">
            <p class="mb-2">Provide rejection reason (required):</p>
            <textarea id="reject-reason-input" class="form-control" rows="3" placeholder="e.g., Screenshot is unclear / UTR mismatch"></textarea>
        </div>`,
        '<i class="fa-solid fa-triangle-exclamation text-warning"></i>',
        async () => {
            const reasonInput = document.getElementById('reject-reason-input');
            const reason = reasonInput ? reasonInput.value.trim() : '';
            if (!reason) throw new Error('Please enter a rejection reason.');

            const response = await fetch(`http://127.0.0.1:8000/api/admin/verification-action/${transactionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject', reason })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Rejection failed');

            showToast('Payment rejected and student notified.', 'success');
            await loadVerificationQueue();
        }
    );
}

// ==========================================
// REPORTS & EXPORTS
// ==========================================
function downloadBranchReport() {
    const branchSelect = document.getElementById('export-branch');
    const selectedBranch = branchSelect.value;
    const branchName = branchSelect.options[branchSelect.selectedIndex].text;

    if(!selectedBranch) {
        showToast("Please select a branch first.", "error");
        return;
    }

    const btn = document.getElementById('btn-download-csv');
    const originalText = btn.innerHTML;

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing CSV...';
    btn.disabled = true;

    const url = `http://127.0.0.1:8000/api/admin/export-dues?branch=${encodeURIComponent(selectedBranch)}`;
    window.location.href = url;
    showToast(`Download started for ${branchName}.`, "success");

    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        branchSelect.value = "";
    }, 1200);
}

// ==========================================
// SUPPORT DESK LOGIC
// ==========================================
let allTickets = [];
let currentTicket = null;

async function loadSupportTickets() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/support-tickets');
        const data = await response.json();
        allTickets = data.tickets || [];
        renderTickets();
    } catch (err) {
        console.error('Failed to load support tickets:', err);
    }
}

function renderTickets() {
    const list = document.getElementById('ticket-list');
    if(!list) return;
    list.innerHTML = '';
    
    if (allTickets.length === 0) {
        list.innerHTML = `<li style="text-align:center; padding: 20px; color: var(--text-muted);">No new support tickets.</li>`;
        
        // Hide Badge
        const badge = document.getElementById('support-badge');
        if(badge) badge.style.display = 'none';

        return;
    }

    // Show Badge for open tickets
    const openTickets = allTickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
    const badge = document.getElementById('support-badge');
    if(badge) {
        if (openTickets.length > 0) {
            badge.innerText = openTickets.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    allTickets.forEach((ticket, index) => {
        const isUrgent = ticket.status === 'OPEN';
        const statusClass = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? 'resolved' : '';
        list.innerHTML += `
            <li class="${isUrgent && ticket.status === 'OPEN' ? 'urgent' : ''} ${statusClass}" id="tck-btn-${index}" onclick="openTicket(${index})">
                <div class="ticket-header">
                    <span>${ticket.ticket_number}</span>
                    ${isUrgent && ticket.status === 'OPEN' ? '<span class="text-danger"><i class="fa-solid fa-circle-exclamation"></i> New</span>' : ''}
                    ${ticket.status === 'IN_PROGRESS' ? '<span class="text-warning"><i class="fa-solid fa-clock"></i> In Progress</span>' : ''}
                    ${ticket.status === 'RESOLVED' ? '<span class="text-success"><i class="fa-solid fa-check"></i> Resolved</span>' : ''}
                </div>
                <div class="ticket-title">${ticket.subject}</div>
                <div class="ticket-preview">${ticket.student_name} (${ticket.student_roll})</div>
            </li>
        `;
    });
}

// Load tickets on page load when support view is active
function loadSupportView() {
    loadSupportTickets();
}

function openTicket(index) {
    currentTicket = allTickets[index];
    
    // UI Highlights
    document.querySelectorAll('.ticket-list li').forEach(li => li.classList.remove('active-ticket'));
    const ticketBtn = document.getElementById(`tck-btn-${index}`);
    if (ticketBtn) ticketBtn.classList.add('active-ticket');

    // Switch Panes
    const emptyThread = document.getElementById('empty-thread');
    const thread = document.getElementById('active-thread');
    if (emptyThread) emptyThread.style.display = 'none';
    if (thread) thread.style.display = 'flex';

    // Populate Header Data
    const threadSubject = document.getElementById('thread-subject');
    const threadStudent = document.getElementById('thread-student');
    const threadId = document.getElementById('thread-id');
    
    if (threadSubject) threadSubject.innerText = currentTicket.subject;
    if (threadStudent) threadStudent.innerText = `${currentTicket.student_name} (${currentTicket.student_roll})`;
    if (threadId) threadId.innerText = `#${currentTicket.ticket_number}`;
    
    // Load message history from database
    loadTicketMessages();
    
    // Clear the textarea for NEW replies
    const responseArea = document.getElementById('response-area');
    if (responseArea) {
        responseArea.value = '';
        responseArea.focus();
    }
}

async function loadTicketMessages() {
    if (!currentTicket) return;
    
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/ticket/${currentTicket.id}/messages`);
        if (!response.ok) throw new Error('Failed to load messages');
        
        const data = await response.json();
        const messages = data.messages || [];
        
        const threadMessages = document.getElementById('thread-messages');
        if (threadMessages) {
            threadMessages.innerHTML = '';
            
            // Always show the initial ticket description first
            const studentMsgDiv = document.createElement('div');
            studentMsgDiv.className = 'message-box student-msg';
            studentMsgDiv.style.marginBottom = '15px';
            studentMsgDiv.innerHTML = `
                <strong style="display: block; margin-bottom: 8px; color: var(--primary);">Student: ${currentTicket.student_name}</strong>
                <p style="margin: 0; white-space: pre-wrap;">${currentTicket.description}</p>
                <small style="color: var(--text-muted); display: block; margin-top: 8px;">${currentTicket.created_at}</small>
            `;
            threadMessages.appendChild(studentMsgDiv);
            
            // Display all messages in order
            messages.forEach(msg => {
                const msgDiv = document.createElement('div');
                msgDiv.className = msg.sender_type === 'ADMIN' ? 'message-box admin-msg' : 'message-box student-msg';
                msgDiv.style.marginBottom = '15px';
                msgDiv.innerHTML = `
                    <strong style="display: block; margin-bottom: 8px; color: ${msg.sender_type === 'ADMIN' ? 'var(--success)' : 'var(--primary)'};">
                        ${msg.sender_type === 'ADMIN' ? 'You (Admin)' : 'Student: ' + msg.sender_name}
                    </strong>
                    <p style="margin: 0; white-space: pre-wrap;">${msg.message_text}</p>
                    <small style="color: var(--text-muted); display: block; margin-top: 8px;">${msg.created_at}</small>
                `;
                threadMessages.appendChild(msgDiv);
            });
            
            // Auto-scroll to bottom
            threadMessages.scrollTop = threadMessages.scrollHeight;
        }
    } catch (err) {
        console.error('Failed to load message history:', err);
        showToast('Failed to load messages', 'error');
    }
}

async function deleteTicketAdmin() {
    if (!currentTicket) return;
    
    openConfirmModal(
        "Delete Chat",
        `Are you sure you want to permanently delete ticket <strong>#${currentTicket.ticket_number}</strong> and all its messages?`,
        '<i class="fa-solid fa-trash text-danger"></i>',
        async () => {
            try {
                const res = await fetch(`http://127.0.0.1:8000/api/ticket/${currentTicket.id}`, {
                    method: 'DELETE'
                });
                
                if (!res.ok) throw new Error('Failed to delete chat');
                
                showToast("Chat deleted successfully", "success");
                
                // Hide active thread and fetch updated tickets
                document.getElementById('active-thread').style.display = 'none';
                document.getElementById('empty-thread').style.display = 'block';
                currentTicket = null;
                
                fetchSupportTickets();
            } catch (error) {
                showToast(error.message || 'Error deleting chat', 'error');
            }
        }
    );
}

async function resolveTicket() {
    if(!currentTicket) return;
    
    const response = document.getElementById('response-area').value;
    if (!response || !response.trim()) {
        showToast('Please enter a response before resolving', 'error');
        return;
    }
    
    openConfirmModal(
        "Resolve Ticket",
        `Mark ticket <strong>#${currentTicket.ticket_number}</strong> as resolved?`,
        '<i class="fa-solid fa-check-circle text-success"></i>',
        async () => {
            try {
                const res = await fetch(`http://127.0.0.1:8000/api/admin/ticket/${currentTicket.id}/respond`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        response: response,
                        status: 'RESOLVED'
                    })
                });

                if (!res.ok) throw new Error('Failed to resolve ticket');

                showToast("Ticket marked as resolved.", "success");
                await loadSupportTickets();
                
                // Reset right pane
                document.getElementById('active-thread').style.display = 'none';
                document.getElementById('empty-thread').style.display = 'flex';
                currentTicket = null;
            } catch (error) {
                showToast(error.message || 'Failed to resolve ticket', 'error');
            }
        }
    );
}

async function sendReplyOnly() {
    if(!currentTicket) return;
    
    const responseText = document.getElementById('response-area').value;
    if (!responseText || !responseText.trim()) {
        showToast('Please enter a response', 'error');
        return;
    }

    try {
        const res = await fetch(`http://127.0.0.1:8000/api/admin/ticket/${currentTicket.id}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                response: responseText,
                status: currentTicket.status  // Keep current status
            })
        });

        if (!res.ok) throw new Error('Failed to send reply');

        showToast('Reply sent successfully', "success");
        
        // Clear the textarea
        const responseArea = document.getElementById('response-area');
        if (responseArea) responseArea.value = '';
        
        // Reload message thread to show the new message
        await loadTicketMessages();
    } catch (error) {
        showToast(error.message || 'Failed to send reply', 'error');
    }
}

async function updateTicketStatus(status) {
    if(!currentTicket) return;
    
    const responseText = document.getElementById('response-area').value;
    if (!responseText || !responseText.trim()) {
        showToast('Please enter a response', 'error');
        return;
    }

    try {
        const res = await fetch(`http://127.0.0.1:8000/api/admin/ticket/${currentTicket.id}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                response: responseText,
                status: status
            })
        });

        if (!res.ok) throw new Error('Failed to update ticket');

        showToast(`Ticket updated to ${status}`, "success");
        
        // Clear the textarea
        const responseArea = document.getElementById('response-area');
        if (responseArea) responseArea.value = '';
        
        // Reload message thread to show the new message
        await loadTicketMessages();
    } catch (error) {
        showToast(error.message || 'Failed to update ticket', 'error');
    }
}

// ==========================================
// LOGOUT FUNCTIONALITY
// ==========================================
function logout() {
    localStorage.clear();
    window.location.href = "/login";
}

// ==========================================
// TOAST UTILITIES
// ==========================================
function showToast(message, type = 'success') {
    if (message && typeof message !== 'string') {
        message = message.detail || message.message || (() => {
            try { return JSON.stringify(message); } catch { return String(message); }
        })();
    }
    if (!message) message = 'Something went wrong.';

    const container = document.getElementById('toast-container');
    if(!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconHTML = type === 'error' ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-check-circle"></i>';
    
    toast.innerHTML = `${iconHTML} <span>${message}</span>`;
    
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });
    
    // After 3.5 seconds, fade out and slide away
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        // Remove after animation completes
        setTimeout(() => {
            if(toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, 3500);
}

// ==========================================
// STUDENT MANAGEMENT
// ==========================================
let allStudents = [];

async function loadAllStudents() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/admin/all-students');
        if (!response.ok) throw new Error("Failed to fetch students");
        
        const data = await response.json();
        allStudents = data.students || [];
        renderStudentsTable(allStudents);
        
    } catch (error) {
        console.error("Error loading students:", error);
        document.getElementById('students-table-body').innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ef4444; padding:30px;">Error loading students. Is the server running?</td></tr>`;
    }
}

function renderStudentsTable(studentsList) {
    const tbody = document.getElementById('students-table-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    if (!studentsList || studentsList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px; color: var(--text-muted);">No students found.</td></tr>`;
        return;
    }

    studentsList.forEach(student => {
        const nameParts = student.full_name.split(' ');
        const initials = nameParts.length > 1 ? nameParts[0][0] + nameParts[1][0] : nameParts[0][0];
        
        const dueStatus = student.total_due > 0 ? `<span style="color: var(--danger); font-weight: 600;">₹ ${student.total_due.toLocaleString('en-IN')}</span>` : '<span style="color: var(--success);">Cleared</span>';
        
        const row = `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="background:#f1f5f9; color:#475569; width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.9rem; font-weight:bold;">${initials}</div>
                        <div>
                            <strong>${student.full_name}</strong><br>
                            <span style="font-size:0.85rem; color:var(--text-muted);">${student.email}</span>
                        </div>
                    </div>
                </td>
                <td><code style="background:#f1f5f9; padding: 2px 6px; border-radius: 3px;">${student.roll_number}</code></td>
                <td>${student.branch}</td>
                <td>${dueStatus}</td>
                <td>₹ ${student.paid_amount.toLocaleString('en-IN')}</td>
                <td>
                    <button class="view-btn" data-student-id="${student.id}" style="border:none; background:transparent; cursor:pointer; color: var(--primary); padding: 5px 10px; margin-right: 5px;" title="View Details">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                    <button class="inspect-student-btn" data-roll-number="${encodeURIComponent(student.roll_number)}" style="border:none; background:transparent; cursor:pointer; color: var(--primary); padding: 5px 10px;" title="Inspect Fee Details">
                        <i class="fa-solid fa-magnifying-glass-dollar"></i>
                    </button>
                    <button class="send-alert-btn" data-student-name="${encodeURIComponent(student.full_name)}" data-roll-number="${encodeURIComponent(student.roll_number)}" style="border:none; background:transparent; cursor:pointer; color: #f59e0b; padding: 5px 10px;" title="Send Alert">
                        <i class="fa-solid fa-bell"></i>
                    </button>
                    <button class="delete-btn" data-student-id="${student.id}" data-student-name="${student.full_name}" style="border:none; background:transparent; cursor:pointer; color: var(--danger); padding: 5px 10px;" title="Delete Student">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function filterStudents() {
    const departmentFilter = document.getElementById('filter-department').value.toLowerCase();
    const nameSearch = document.getElementById('search-name').value.toLowerCase();
    const rollSearch = document.getElementById('search-roll').value.toLowerCase();
    
    const filtered = allStudents.filter(student => {
        const matchDept = !departmentFilter || student.branch.toLowerCase() === departmentFilter;
        const matchName = !nameSearch || student.full_name.toLowerCase().includes(nameSearch);
        const matchRoll = !rollSearch || student.roll_number.toLowerCase().includes(rollSearch);
        
        return matchDept && matchName && matchRoll;
    });
    
    renderStudentsTable(filtered);
}



function deleteStudentRecord(studentId, studentName) {
    openConfirmModal(
        "Delete Student Record",
        `Are you sure you want to permanently delete <strong>${studentName}</strong>'s entire record? This action cannot be undone.`,
        '<i class="fa-solid fa-trash" style="color: var(--danger);"></i>',
        () => performDelete(studentId, studentName)
    );
}

async function performDelete(studentId, studentName) {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/admin/delete-student/${parseInt(studentId)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if(response.ok) {
            allStudents = allStudents.filter(s => s.id !== parseInt(studentId));
            renderStudentsTable(allStudents);
            await loadDashboardData();
            showToast(`${studentName}'s record deleted successfully.`, 'success');
        } else {
            const errorText = await response.text();
            let detail = 'Unknown error';
            try {
                const parsed = JSON.parse(errorText);
                detail = parsed.detail || detail;
            } catch {
                detail = errorText || detail;
            }
            showToast(`Failed to delete: ${detail}`, 'error');
        }
    } catch(error) {
        console.error("Delete error:", error);
        showToast("Error deleting student. Check console for details.", 'error');
    }
}

// Event delegation for table buttons
document.addEventListener('click', (e) => {
    if(e.target.closest('.inspect-student-btn')) {
        const btn = e.target.closest('.inspect-student-btn');
        const rollNumber = decodeURIComponent(btn.getAttribute('data-roll-number') || '');
        openStudentInspector(rollNumber);
        return;
    }
    if(e.target.closest('.alert-single-btn')) {
        const btn = e.target.closest('.alert-single-btn');
        const studentName = decodeURIComponent(btn.getAttribute('data-student-name') || 'Student');
        const rollNumber = decodeURIComponent(btn.getAttribute('data-roll-number') || '');
        if (!rollNumber) {
            showToast('Student roll number not found.', 'error');
            return;
        }
        confirmSingleAlert(studentName, rollNumber);
    }
    if(e.target.closest('.delete-btn')) {
        const btn = e.target.closest('.delete-btn');
        const studentId = btn.getAttribute('data-student-id');
        const studentName = btn.getAttribute('data-student-name');
        deleteStudentRecord(studentId, studentName);
    }
    if(e.target.closest('.send-alert-btn')) {
        const btn = e.target.closest('.send-alert-btn');
        const studentName = decodeURIComponent(btn.getAttribute('data-student-name') || 'Student');
        const rollNumber = decodeURIComponent(btn.getAttribute('data-roll-number') || '');
        if (!rollNumber) {
            showToast('Student roll number not found.', 'error');
            return;
        }
        confirmSingleAlert(studentName, rollNumber);
    }
    if(e.target.closest('.view-btn')) {
        const btn = e.target.closest('.view-btn');
        const studentId = parseInt(btn.getAttribute('data-student-id'));
        viewStudentDetails(studentId);
    }
});

function viewStudentDetails(studentId) {
    const student = allStudents.find(s => parseInt(s.id) === parseInt(studentId));
    if(!student) {
        showToast('Student not found.', 'error');
        return;
    }
    
    openConfirmModal(
        student.full_name,
        `
            <div style="text-align: left;">
                <p><strong>Roll Number:</strong> ${student.roll_number}</p>
                <p><strong>Branch:</strong> ${student.branch}</p>
                <p><strong>Email:</strong> ${student.email}</p>
                <p><strong>Total Allocated:</strong> ₹ ${student.total_allocated.toLocaleString('en-IN')}</p>
                <p><strong>Paid Amount:</strong> ₹ ${student.paid_amount.toLocaleString('en-IN')}</p>
                <p><strong>Outstanding Due:</strong> <span style="color: ${student.total_due > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: 600;">₹ ${student.total_due.toLocaleString('en-IN')}</span></p>
            </div>
        `,
        '<i class="fa-solid fa-user" style="color: var(--primary);"></i>',
        () => confirmSingleAlert(student.full_name, student.roll_number),
        'Send Alert'
    );
}

// Load students when page loads
loadAllStudents();

setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    loadDashboardData();
    loadAllStudents();
    loadVerificationQueue();
}, 15000);