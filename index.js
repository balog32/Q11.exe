// ╔════════════════════════════════════════════════════════════════════════╗
// ║                     GYM CORE SYSTEM - v4.0                            ║
// ║          Advanced Analytics + Calendar Reports + Statistics           ║
// ╚════════════════════════��═══════════════════════════════════════════════╝

// ═══════════════════════════════════════════════════════════════════════════
// ✅ VARIABILE GLOBALE
// ═══════════════════════════════════════════════════════════════════════════

let isLoggedIn = false;
let currentUser = null;
let currentUserRole = null;
let clients = JSON.parse(localStorage.getItem('clients')) || [];
let currentCameraStream = null;
let auditLog = JSON.parse(localStorage.getItem('auditLog')) || [];
let clientCheckIns = JSON.parse(localStorage.getItem('clientCheckIns')) || {};
let users = JSON.parse(localStorage.getItem('users')) || [
    { id: 1, username: 'admin', code: '1234', role: 'admin', name: 'Administrator', createdAt: new Date().toISOString() },
    { id: 2, username: 'manager', code: '1234', role: 'manager', name: 'Manager', createdAt: new Date().toISOString() },
    { id: 3, username: 'staff', code: '1234', role: 'staff', name: 'Staff', createdAt: new Date().toISOString() }
];

let reportDateFrom = new Date();
reportDateFrom.setDate(reportDateFrom.getDate() - 30);
let reportDateTo = new Date();

const SUBSCRIPTIONS = {
    'elev_standard': { name: 'Elev Standard', duration: 30, startHour: 7, endHour: 17, endHourStrict: 16, endMinuteStrict: 40, category: 'Elev', type: 'Standard' },
    'elev_full': { name: 'Elev Full', duration: 30, startHour: 7, endHour: 21, category: 'Elev', type: 'Full' },
    'adult_standard': { name: 'Adult Standard', duration: 30, startHour: 7, endHour: 17, endHourStrict: 16, endMinuteStrict: 40, category: 'Adult', type: 'Standard' },
    'adult_full': { name: 'Adult Full', duration: 30, startHour: 7, endHour: 21, category: 'Adult', type: 'Full' },
    '2weeks': { name: '2 Săptămâni', duration: 15, startHour: 7, endHour: 17, endHourStrict: 16, endMinuteStrict: 40, category: 'Special', type: '2 Weeks' }
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═════════════════════════════════════════════════════���═════════════════════

function getTodayDate() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#00ff88' : '#ff6b6b'};
        color: #000;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        font-weight: 600;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function saveClientsToStorage() {
    localStorage.setItem('clients', JSON.stringify(clients));
}

function saveCheckIns() {
    localStorage.setItem('clientCheckIns', JSON.stringify(clientCheckIns));
}

function saveAuditLog() {
    localStorage.setItem('auditLog', JSON.stringify(auditLog));
}

function saveUsers() {
    localStorage.setItem('users', JSON.stringify(users));
}

function addToAuditLog(action, details = '') {
    const now = new Date();
    auditLog.push({
        id: Date.now(),
        timestamp: now.toISOString(),
        user: currentUser || 'GUEST',
        userRole: currentUserRole || 'GUEST',
        action: action,
        details: details
    });
    
    if (auditLog.length > 1000) {
        auditLog = auditLog.slice(-500);
    }
    
    saveAuditLog();
}

function resetDailyUsageIfNeeded() {
    const lastResetDate = localStorage.getItem('lastDailyReset');
    const todayDate = getTodayDate();

    if (lastResetDate !== todayDate) {
        clients.forEach(client => {
            client.usedToday = false;
        });
        saveClientsToStorage();
        localStorage.setItem('lastDailyReset', todayDate);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 MODAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function closeAllModals() {
    document.getElementById('addModal').classList.remove('active');
    document.getElementById('searchModal').classList.remove('active');
    document.getElementById('loginModal').classList.remove('active');
}

function openModal(html) {
    closeAllModals();
    let modal = document.getElementById('detailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'detailModal';
        modal.className = 'modal';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); justify-content: center; align-items: center; z-index: 9999; backdrop-filter: blur(6px); overflow-y: auto;';
        document.body.appendChild(modal);
    }
    modal.innerHTML = html;
    modal.style.display = 'flex';
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    stopCamera();
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('detailModal');
    if (modal && e.target === modal) {
        closeModal();
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// 👤 LOGIN & AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

function openLogin() {
    closeAllModals();
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('loginUser').value = '';
    document.getElementById('loginCode').value = '';
    document.getElementById('loginError').innerHTML = '';
    document.getElementById('loginUser').focus();
}

function closeLogin() {
    document.getElementById('loginModal').classList.remove('active');
}

function togglePassword() {
    const input = document.getElementById('loginCode');
    input.type = input.type === 'password' ? 'text' : 'password';
}

function login() {
    const user = document.getElementById('loginUser').value.trim();
    const code = document.getElementById('loginCode').value.trim();
    const errorDiv = document.getElementById('loginError');

    if (!user || !code) {
        errorDiv.innerHTML = '<p style="color: #ff6b6b; margin: 10px 0;">Te rog completează user și cod!</p>';
        return;
    }

    const foundUser = users.find(u => u.username === user && u.code === code);
    
    if (foundUser) {
        isLoggedIn = true;
        currentUser = user;
        currentUserRole = foundUser.role;
        document.getElementById('currentUser').textContent = user.toUpperCase();
        document.getElementById('userArea').style.display = 'block';
        document.getElementById('loginBtn').style.display = 'none';
        closeLogin();
        addToAuditLog('Login', `User: ${user} | Role: ${foundUser.role}`);
        showNotification(`✅ Bine ai venit, ${foundUser.name}!`, 'success');
        initClientCards();
    } else {
        errorDiv.innerHTML = '<p style="color: #ff6b6b; margin: 10px 0;">❌ User sau cod incorect!</p>';
        document.getElementById('loginCode').value = '';
        addToAuditLog('Login Failed', `Tentativă eșuată: ${user}`);
    }
}

function logout() {
    addToAuditLog('Logout', `User: ${currentUser}`);
    isLoggedIn = false;
    currentUser = null;
    currentUserRole = null;
    document.getElementById('userArea').style.display = 'none';
    document.getElementById('userMenu').classList.remove('active');
    document.getElementById('loginBtn').style.display = 'block';
    showNotification('✅ Ești deconectat!', 'success');
    initClientCards();
}

function toggleUserMenu() {
    document.getElementById('userMenu').classList.toggle('active');
}

document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    const userArea = document.getElementById('userArea');
    if (!e.target.closest('#userArea') && userMenu.classList.contains('active')) {
        userMenu.classList.remove('active');
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// ➕ ADD CLIENT MODAL
// ═══════════════════════════════════════════════════════════════════════════

function openAdd() {
    if (!isLoggedIn) {
        showNotification('❌ Trebuie să fii conectat!', 'error');
        return;
    }
    closeAllModals();
    document.getElementById('addModal').classList.add('active');
    resetAddForm();
    setTimeout(() => startCamera(), 500);
}

function closeAdd() {
    document.getElementById('addModal').classList.remove('active');
    stopCamera();
    resetAddForm();
}

function resetAddForm() {
    document.getElementById('name').value = '';
    document.getElementById('surname').value = '';
    document.getElementById('subscription').value = '';
    document.getElementById('tag').value = '';
    document.getElementById('preview').style.display = 'none';
    document.getElementById('video').style.display = 'block';
    localStorage.removeItem('tempPhoto');
}

function startCamera() {
    const video = document.getElementById('video');
    
    if (currentCameraStream) {
        stopCamera();
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
            currentCameraStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';
            document.getElementById('preview').style.display = 'none';
        })
        .catch(err => {
            console.error('Camera error:', err);
            showNotification('❌ Eroare acces cameră: ' + err.message, 'error');
        });
}

function stopCamera() {
    if (currentCameraStream) {
        currentCameraStream.getTracks().forEach(track => track.stop());
        currentCameraStream = null;
    }
}

function capture() {
    const video = document.getElementById('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!video.videoWidth) {
        showNotification('❌ Camera nu este gata încă!', 'error');
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const photoData = canvas.toDataURL('image/jpeg');
    const preview = document.getElementById('preview');
    preview.src = photoData;
    preview.style.display = 'block';
    video.style.display = 'none';
    
    localStorage.setItem('tempPhoto', photoData);
    stopCamera();
    
    showNotification('✅ Fotografia capturată!', 'success');
}

function saveClient() {
    const nume = document.getElementById('name').value.trim();
    const prenume = document.getElementById('surname').value.trim();
    const subscription = document.getElementById('subscription').value;
    const tag = document.getElementById('tag').value.trim();
    const photo = localStorage.getItem('tempPhoto') || '';

    if (!nume) {
        showNotification('❌ Te rog completează NUME!', 'error');
        return;
    }
    if (!prenume) {
        showNotification('❌ Te rog completează PRENUME!', 'error');
        return;
    }
    if (!subscription) {
        showNotification('❌ Te rog selectează ABONAMENT!', 'error');
        return;
    }

    const today = new Date();
    const subInfo = SUBSCRIPTIONS[subscription];
    const days = subInfo.duration;
    
    const expirationDate = new Date(today);
    expirationDate.setDate(expirationDate.getDate() + days);

    const newClient = {
        id: Date.now(),
        nume: nume,
        prenume: prenume,
        subscription: subscription,
        tag: tag,
        photo: photo,
        expiration: expirationDate.toISOString().split('T')[0],
        isPaid: true,
        usedToday: false,
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        startDate: today.toISOString().split('T')[0],
        duration: days
    };

    clients.push(newClient);
    saveClientsToStorage();
    addToAuditLog('Adaugă client', `${prenume} ${nume} - Abonament: ${subscription}`);

    showNotification(`✅ Client ${prenume} ${nume} adăugat!`, 'success');
    closeAdd();
    initClientCards();
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔍 SEARCH CLIENT
// ═══════════════════════════════════════════════════════════════════════════

function openSearch() {
    if (!isLoggedIn) {
        showNotification('❌ Trebuie să fii conectat!', 'error');
        return;
    }
    closeAllModals();
    document.getElementById('searchModal').classList.add('active');
    document.getElementById('search').value = '';
    document.getElementById('results').innerHTML = '';
    document.getElementById('search').focus();
}

function closeSearch() {
    document.getElementById('searchModal').classList.remove('active');
}

function searchClient() {
    const searchTerm = document.getElementById('search').value.toLowerCase().trim();
    const resultsDiv = document.getElementById('results');
    
    if (searchTerm.length === 0) {
        resultsDiv.innerHTML = '';
        return;
    }

    const results = clients.filter(c => 
        c.prenume.toLowerCase().includes(searchTerm) || 
        c.nume.toLowerCase().includes(searchTerm) ||
        c.tag.toLowerCase().includes(searchTerm)
    );

    if (results.length === 0) {
        resultsDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Niciun rezultat</p>';
        return;
    }

    resultsDiv.innerHTML = results.map(client => `
        <div class="client-card" onclick="searchSelectClient(${client.id})" style="cursor: pointer; margin-bottom: 10px;">
            ${client.photo ? `<img src="${client.photo}" alt="${client.prenume}" style="width: 60px; height: 60px; border-radius: 10px; object-fit: cover;">` : `<div style="width: 60px; height: 60px; background: #0f1b2e; border-radius: 10px;"></div>`}
            <div style="flex: 1;">
                <p style="font-weight: bold; margin: 0;">${client.prenume} ${client.nume}</p>
                <p style="font-size: 12px; color: #888; margin: 5px 0;">Tag: ${client.tag || 'N/A'}</p>
            </div>
        </div>
    `).join('');
}

function searchSelectClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (client) {
        closeSearch();
        showClientDetails(client);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⚙️ SETTINGS MODAL
// ═══════════════════════════════════════════════════════════════════════════

function openSettings() {
    if (!isLoggedIn) {
        showNotification('❌ Trebuie să fii conectat!', 'error');
        return;
    }
    
    if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
        showNotification('❌ Nu ai acces la setări!', 'error');
        return;
    }
    
    addToAuditLog('Deschide Setări');
    
    const settingsHTML = `
        <div class="box scroll-box" style="width: 650px; max-width: 95%;">
            <h2 style="color: #ffaa33; margin-bottom: 25px; border-bottom: 2px solid #ffaa33;">⚙️ SETĂRI SISTEM</h2>
            
            <!-- TABS -->
            <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
                <button onclick="switchSettingsTab('backup')" class="settings-tab active" style="flex: 1; min-width: 120px; padding: 10px; background: #ff8c00; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">💾 Backup</button>
                <button onclick="switchSettingsTab('audit')" class="settings-tab" style="flex: 1; min-width: 120px; padding: 10px; background: transparent; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; color: #ffaa33; font-weight: bold; font-size: 12px;">📝 Jurnal</button>
                <button onclick="switchSettingsTab('users')" class="settings-tab" style="flex: 1; min-width: 120px; padding: 10px; background: transparent; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; color: #ffaa33; font-weight: bold; font-size: 12px;">👥 Utilizatori</button>
                <button onclick="switchSettingsTab('clean')" class="settings-tab" style="flex: 1; min-width: 120px; padding: 10px; background: transparent; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; color: #ffaa33; font-weight: bold; font-size: 12px;">🗑️ Curățare</button>
            </div>
            
            <!-- BACKUP TAB -->
            <div id="backup-tab" class="settings-content" style="display: block;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">💾 Backup & Restore</h3>
                
                <div style="background: rgba(0, 255, 136, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid #00ff88;">
                    <p style="margin-bottom: 10px; font-size: 13px;">📥 <strong>Exportă toți clienții:</strong></p>
                    <button onclick="exportClientsJSON()" style="width: 100%; padding: 10px; background: #00ff88; color: black; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">⬇️ Descarcă JSON</button>
                </div>
                
                <div style="background: rgba(100, 150, 255, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid #6496ff;">
                    <p style="margin-bottom: 10px; font-size: 13px;">📤 <strong>Importă clienți din JSON:</strong></p>
                    <input type="file" id="importFile" accept=".json" style="width: 100%; padding: 8px; margin-bottom: 10px; border: 2px solid #6496ff; border-radius: 8px; background: rgba(100, 150, 255, 0.2); color: #e0e0e0; font-size: 12px;">
                    <button onclick="importClientsJSON()" style="width: 100%; padding: 10px; background: #6496ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">📥 Importă Clienți</button>
                </div>
            </div>
            
            <!-- AUDIT LOG TAB -->
            <div id="audit-tab" class="settings-content" style="display: none; max-height: 350px; overflow-y: auto;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">📝 Jurnal Audit (Ultimele 50 acțiuni)</h3>
                <div style="background: rgba(30, 41, 59, 0.7); border-radius: 8px; padding: 0; border: 1px solid rgba(255, 140, 0, 0.2);">
                    ${auditLog.length === 0 ? '<div style="padding: 15px; text-align: center; color: #888;">Niciun jurnal înregistrat</div>' : `
                        ${auditLog.slice(-50).reverse().map(log => `
                            <div style="padding: 10px; border-bottom: 1px solid rgba(255, 140, 0, 0.2); font-size: 11px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                                    <span style="color: #ffaa33; font-weight: bold;">${new Date(log.timestamp).toLocaleTimeString('ro-RO')}</span>
                                    <span style="background: ${log.userRole === 'admin' ? '#ff8c00' : log.userRole === 'manager' ? '#6496ff' : '#00ff88'}; color: black; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 10px;">${log.userRole}</span>
                                </div>
                                <div style="color: #00ff88; margin-bottom: 2px;">${log.user}</div>
                                <div style="color: #fff;">${log.action}</div>
                                ${log.details ? `<div style="color: #888; margin-top: 2px;"> ${log.details}</div>` : ''}
                            </div>
                        `).join('')}
                    `}
                </div>
                <button onclick="clearAuditLog()" style="width: 100%; padding: 10px; margin-top: 15px; background: #ff6b6b; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">🗑️ Șterge Jurnal</button>
            </div>
            
            <!-- USERS TAB -->
            <div id="users-tab" class="settings-content" style="display: none;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">👥 Utilizatori Active</h3>
                <div style="background: rgba(30, 41, 59, 0.7); border-radius: 8px; border: 1px solid rgba(255, 140, 0, 0.2); max-height: 250px; overflow-y: auto; margin-bottom: 15px;">
                    ${users.map(user => `
                        <div style="padding: 12px; border-bottom: 1px solid rgba(255, 140, 0, 0.2); display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <p style="margin: 0; font-weight: bold; color: #ffaa33; font-size: 13px;">${user.name}</p>
                                <p style="margin: 5px 0 0 0; font-size: 11px; color: #888;">User: <span style="color: #00ff88;">${user.username}</span></p>
                            </div>
                            <span style="background: ${user.role === 'admin' ? '#ff8c00' : user.role === 'manager' ? '#6496ff' : '#00ff88'}; color: black; padding: 5px 10px; border-radius: 5px; font-weight: bold; font-size: 11px;">${user.role.toUpperCase()}</span>
                        </div>
                    `).join('')}
                </div>
                
                ${currentUserRole === 'admin' ? `
                    <h3 style="color: #00ff88; margin-bottom: 15px; margin-top: 20px;">➕ Adaugă Staff Nou</h3>
                    <div style="background: rgba(0, 255, 136, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #00ff88;">
                        <input type="text" id="newStaffName" placeholder="Nume complet" style="width: 100%; padding: 10px; margin-bottom: 10px; border: 2px solid #00ff88; border-radius: 8px; background: rgba(0, 255, 136, 0.1); color: #e0e0e0;">
                        <input type="text" id="newStaffUsername" placeholder="Username (login)" style="width: 100%; padding: 10px; margin-bottom: 10px; border: 2px solid #00ff88; border-radius: 8px; background: rgba(0, 255, 136, 0.1); color: #e0e0e0;">
                        <input type="password" id="newStaffCode" placeholder="Cod (password)" style="width: 100%; padding: 10px; margin-bottom: 10px; border: 2px solid #00ff88; border-radius: 8px; background: rgba(0, 255, 136, 0.1); color: #e0e0e0;">
                        <button onclick="addNewStaff()" style="width: 100%; padding: 10px; background: #00ff88; color: black; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">✅ Salvează Staff Nou</button>
                    </div>
                ` : ''}
            </div>
            
            <!-- CLEAN TAB -->
            <div id="clean-tab" class="settings-content" style="display: none;">
                <h3 style="color: #ff6b6b; margin-bottom: 15px;">🗑️ Curățare Date</h3>
                
                <div style="background: rgba(255, 107, 107, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid #ff6b6b;">
                    <p style="margin-bottom: 10px; font-size: 12px;"><strong>Șterge clienți EXPIRAȚI</strong></p>
                    <button onclick="deleteExpiredClients()" style="width: 100%; padding: 10px; background: #ff6b6b; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">🗑️ Șterge Expirați (${clients.filter(c => getDaysLeft(c.expiration) < 0).length})</button>
                </div>
                
                <div style="background: rgba(255, 170, 0, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 4px solid #ffaa00;">
                    <p style="margin-bottom: 10px; font-size: 12px;"><strong>Reset utilizare zilei</strong></p>
                    <button onclick="resetAllUsedToday()" style="width: 100%; padding: 10px; background: #ffaa00; color: black; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">🔄 Reset Toți</button>
                </div>
                
                <div style="background: rgba(255, 50, 50, 0.15); padding: 15px; border-radius: 10px; border-left: 4px solid #ff3232;">
                    <p style="margin-bottom: 10px; font-size: 12px; color: #ff6b6b;"><strong>⚠️ PERICOL: Șterge TOȚI clienții</strong></p>
                    <button onclick="deleteAllClients()" style="width: 100%; padding: 10px; background: #ff3232; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">💀 ȘTERGE TOȚI</button>
                </div>
            </div>
            
            <!-- BUTTONS -->
            <div class="actions" style="margin-top: 20px;">
                <button onclick="closeModal()" style="flex: 1; background: #6496ff;">❌ Închide</button>
            </div>
        </div>
    `;
    
    openModal(settingsHTML);
}

function switchSettingsTab(tab) {
    document.querySelectorAll('.settings-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.settings-tab').forEach(el => {
        el.style.background = 'transparent';
        el.style.color = '#ffaa33';
        el.style.border = '2px solid #ffaa33';
    });
    
    document.getElementById(`${tab}-tab`).style.display = 'block';
    event.target.style.background = '#ff8c00';
    event.target.style.color = 'white';
    event.target.style.border = 'none';
}

function addNewStaff() {
    const name = document.getElementById('newStaffName').value.trim();
    const username = document.getElementById('newStaffUsername').value.trim();
    const code = document.getElementById('newStaffCode').value.trim();
    
    if (!name || !username || !code) {
        showNotification('❌ Completează toate câmpurile!', 'error');
        return;
    }
    
    if (users.find(u => u.username === username)) {
        showNotification('❌ Username-ul deja există!', 'error');
        return;
    }
    
    const newStaff = {
        id: Math.max(...users.map(u => u.id), 0) + 1,
        username: username,
        code: code,
        role: 'staff',
        name: name,
        createdAt: new Date().toISOString()
    };
    
    users.push(newStaff);
    saveUsers();
    addToAuditLog('Adaugă staff nou', `Username: ${username}, Nume: ${name}`);
    
    showNotification(`✅ Staff nou adăugat: ${name}!`, 'success');
    
    document.getElementById('newStaffName').value = '';
    document.getElementById('newStaffUsername').value = '';
    document.getElementById('newStaffCode').value = '';
    
    closeModal();
    openSettings();
}

function exportClientsJSON() {
    const dataStr = JSON.stringify(clients, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-backup-${getTodayDate()}.json`;
    link.click();
    
    addToAuditLog('Export clienți', `${clients.length} clienți exportați`);
    showNotification(`✅ ${clients.length} clienți exportați!`, 'success');
}

function importClientsJSON() {
    const file = document.getElementById('importFile').files[0];
    if (!file) {
        showNotification('❌ Te rog selectează un fișier!', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (confirm(`⚠️ Vei ÎNLOCUI ${clients.length} clienți cu ${imported.length} clienți noi. Continui?`)) {
                clients = imported;
                saveClientsToStorage();
                addToAuditLog('Import clienți', `${imported.length} clienți importați`);
                showNotification(`✅ ${imported.length} clienți importați!`, 'success');
                closeModal();
                initClientCards();
            }
        } catch (err) {
            showNotification(`❌ Eroare la import: ${err.message}`, 'error');
            addToAuditLog('Import eșuat', err.message);
        }
    };
    reader.readAsText(file);
}

function clearAuditLog() {
    if (confirm('⚠️ Ștergi TOATE jurnalele? Acțiunea nu se poate anula!')) {
        auditLog = [];
        saveAuditLog();
        addToAuditLog('Șterge jurnal', 'Jurnal audit golit complet');
        showNotification('🗑️ Jurnal șters!', 'success');
        closeModal();
        openSettings();
    }
}

function deleteExpiredClients() {
    const expired = clients.filter(c => getDaysLeft(c.expiration) < 0);
    if (expired.length === 0) {
        showNotification('ℹ️ Nu sunt clienți expirați!', 'success');
        return;
    }
    
    if (confirm(`⚠️ Ștergi ${expired.length} clienți expirați?`)) {
        const deletedNames = expired.map(c => `${c.prenume} ${c.nume}`).join(', ');
        clients = clients.filter(c => getDaysLeft(c.expiration) >= 0);
        saveClientsToStorage();
        addToAuditLog('Șterge expirați', `${expired.length} clienți: ${deletedNames}`);
        showNotification(`🗑️ ${expired.length} clienți expirați șterși!`, 'success');
        closeModal();
        initClientCards();
    }
}

function resetAllUsedToday() {
    if (confirm('⚠️ Reset utilizarea zilei pentru TOȚI clienții?')) {
        clients.forEach(c => c.usedToday = false);
        saveClientsToStorage();
        addToAuditLog('Reset utilizare zilei', `Toți ${clients.length} clienții au fost resetați`);
        showNotification('🔄 Toți clienții resetați!', 'success');
        closeModal();
        initClientCards();
    }
}

function deleteAllClients() {
    if (confirm('❌ ATENȚIE! Vei ȘTERGE TOȚI clienții! \n\nScrie "CONFIRM" pentru a continua:')) {
        const confirmation = prompt('Scrie "CONFIRM" pentru a confirma ștergerea tuturor clienților:');
        if (confirmation === 'CONFIRM') {
            const count = clients.length;
            clients = [];
            saveClientsToStorage();
            addToAuditLog('ȘTERGE TOȚI clienții', `${count} clienți șterși - Baza de date goală!`);
            showNotification('💀 Toți clienții șterși!', 'success');
            closeModal();
            initClientCards();
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 📊 REPORTS MODAL - ADVANCED ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════

function openReports() {
    if (!isLoggedIn) {
        showNotification('❌ Trebuie să fii conectat!', 'error');
        return;
    }
    
    addToAuditLog('Deschide Rapoarte');
    
    const reportsHTML = `
        <div class="box scroll-box" style="width: 850px; max-width: 95%;">
            <h2 style="color: #ffaa33; margin-bottom: 25px; border-bottom: 2px solid #ffaa33;">📊 RAPOARTE AVANSATE</h2>
            
            <!-- TABS -->
            <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
                <button onclick="switchReportsTab('subscriptions')" class="report-tab active" style="flex: 1; min-width: 110px; padding: 10px; background: #ff8c00; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">🎫 Abonamente</button>
                <button onclick="switchReportsTab('today')" class="report-tab" style="flex: 1; min-width: 110px; padding: 10px; background: transparent; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; color: #ffaa33; font-weight: bold; font-size: 12px;">📅 Astazi</button>
                <button onclick="switchReportsTab('activity')" class="report-tab" style="flex: 1; min-width: 110px; padding: 10px; background: transparent; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; color: #ffaa33; font-weight: bold; font-size: 12px;">📝 Activitate</button>
            </div>
            
            <!-- SUBSCRIPTIONS REPORT - ADVANCED -->
            <div id="subscriptions-report" class="report-content" style="display: block;">
                ${generateAdvancedSubscriptionsReport()}
            </div>
            
            <!-- TODAY REPORT -->
            <div id="today-report" class="report-content" style="display: none;">
                ${generateTodayReport()}
            </div>
            
            <!-- ACTIVITY REPORT -->
            <div id="activity-report" class="report-content" style="display: none; max-height: 350px; overflow-y: auto;">
                ${generateActivityReport()}
            </div>
            
            <!-- BUTTONS -->
            <div class="actions" style="margin-top: 20px;">
                <button onclick="exportReport()" style="flex: 1; background: #00ff88; color: black; font-size: 12px;">📥 Exportă Raport</button>
                <button onclick="closeModal()" style="flex: 1; background: #6496ff; font-size: 12px;">❌ Închide</button>
            </div>
        </div>
    `;
    
    openModal(reportsHTML);
}

function switchReportsTab(tab) {
    document.querySelectorAll('.report-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.report-tab').forEach(el => {
        el.style.background = 'transparent';
        el.style.color = '#ffaa33';
        el.style.border = '2px solid #ffaa33';
    });
    
    document.getElementById(`${tab}-report`).style.display = 'block';
    event.target.style.background = '#ff8c00';
    event.target.style.color = 'white';
    event.target.style.border = 'none';
}

// Functie pentru a calcula statistici pe perioada
function getSubscriptionsStats(dateFrom, dateTo) {
    const filtered = clients.filter(c => {
        const createdDate = new Date(c.createdAt).toISOString().split('T')[0];
        return createdDate >= formatDate(dateFrom) && createdDate <= formatDate(dateTo);
    });

    const stats = {
        total: filtered.length,
        byType: {
            'elev_standard': filtered.filter(c => c.subscription === 'elev_standard').length,
            'elev_full': filtered.filter(c => c.subscription === 'elev_full').length,
            'adult_standard': filtered.filter(c => c.subscription === 'adult_standard').length,
            'adult_full': filtered.filter(c => c.subscription === 'adult_full').length,
            '2weeks': filtered.filter(c => c.subscription === '2weeks').length
        },
        byCategory: {
            'Elev': filtered.filter(c => SUBSCRIPTIONS[c.subscription]?.category === 'Elev').length,
            'Adult': filtered.filter(c => SUBSCRIPTIONS[c.subscription]?.category === 'Adult').length,
            'Special': filtered.filter(c => SUBSCRIPTIONS[c.subscription]?.category === 'Special').length
        },
        byCreator: {},
        items: filtered
    };

    // Grupează după creator
    filtered.forEach(c => {
        if (!stats.byCreator[c.createdBy]) {
            stats.byCreator[c.createdBy] = 0;
        }
        stats.byCreator[c.createdBy]++;
    });

    return stats;
}

// Statistici pe ZI
function getDayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return getSubscriptionsStats(today, tomorrow);
}

// Statistici pe SĂPTĂMÂNĂ
function getWeekStats() {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59);
    return getSubscriptionsStats(monday, sunday);
}

// Statistici pe LUNĂ
function getMonthStats() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    lastDay.setHours(23, 59, 59);
    return getSubscriptionsStats(firstDay, lastDay);
}

function generateAdvancedSubscriptionsReport() {
    const dayStats = getDayStats();
    const weekStats = getWeekStats();
    const monthStats = getMonthStats();

    return `
        <h3 style="color: #ffaa33; margin-bottom: 15px;">🎫 RAPORT ABONAMENTE - STATISTICI AVANSATE</h3>
        
        <!-- SELECTOR RAPORT -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
            <button onclick="setReportView('day')" id="btn-day" style="padding: 10px; background: #ff8c00; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">📅 AZI</button>
            <button onclick="setReportView('week')" id="btn-week" style="padding: 10px; background: transparent; color: #ffaa33; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">📆 SĂPTĂMÂNA</button>
            <button onclick="setReportView('month')" id="btn-month" style="padding: 10px; background: transparent; color: #ffaa33; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px;">📊 LUNA</button>
        </div>
        
        <!-- CALENDAR SELECTOR -->
        <div style="background: rgba(100, 150, 255, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #6496ff;">
            <p style="color: #6496ff; font-weight: bold; margin-bottom: 10px;">📅 Selectează Perioada Personalizată:</p>
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                <input type="date" id="dateFrom" style="flex: 1; padding: 8px; border: 2px solid #6496ff; border-radius: 6px; background: rgba(100, 150, 255, 0.1); color: #e0e0e0;">
                <input type="date" id="dateTo" style="flex: 1; padding: 8px; border: 2px solid #6496ff; border-radius: 6px; background: rgba(100, 150, 255, 0.1); color: #e0e0e0;">
                <button onclick="applyCustomDateRange()" style="padding: 8px 15px; background: #6496ff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 11px;">✅ Aplică</button>
            </div>
        </div>
        
        <!-- CURRENT REPORT VIEW -->
        <div id="report-view" style="display: block;">
            ${generateReportView(dayStats, 'Astazi')}
        </div>
    `;
}

function generateReportView(stats, period) {
    const total = stats.total;
    const elevi = stats.byCategory['Elev'] || 0;
    const adulti = stats.byCategory['Adult'] || 0;
    const special = stats.byCategory['Special'] || 0;

    return `
        <h4 style="color: #ffaa33; margin-bottom: 15px;">📊 Raport: ${period} (Total: <span style="color: #00ff88; font-weight: bold;">${total}</span> abonamente)</h4>
        
        <!-- OVERVIEW CARDS -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="background: rgba(100, 150, 255, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #6496ff; text-align: center;">
                <div style="font-size: 11px; color: #888; margin-bottom: 5px;">👨‍🎓 ELEVI</div>
                <div style="font-size: 24px; font-weight: bold; color: #6496ff;">${elevi}</div>
            </div>
            <div style="background: rgba(255, 170, 0, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #ffaa00; text-align: center;">
                <div style="font-size: 11px; color: #888; margin-bottom: 5px;">💪 ADULȚI</div>
                <div style="font-size: 24px; font-weight: bold; color: #ffaa00;">${adulti}</div>
            </div>
            <div style="background: rgba(0, 255, 136, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #00ff88; text-align: center;">
                <div style="font-size: 11px; color: #888; margin-bottom: 5px;">🎯 SPECIAL</div>
                <div style="font-size: 24px; font-weight: bold; color: #00ff88;">${special}</div>
            </div>
        </div>
        
        <!-- DETAILED BREAKDOWN -->
        <div style="background: rgba(30, 41, 59, 0.7); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 140, 0, 0.2); margin-bottom: 20px;">
            <h5 style="color: #ffaa33; margin: 0 0 12px 0; font-size: 12px;">🔍 DETALIAT PE TIP:</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <div style="background: rgba(100, 150, 255, 0.2); padding: 8px; border-radius: 6px; font-size: 11px;">
                    <span style="color: #6496ff; font-weight: bold;">📚 Elev Standard:</span>
                    <span style="color: #00ff88; float: right; font-weight: bold;">${stats.byType['elev_standard'] || 0}</span>
                </div>
                <div style="background: rgba(100, 150, 255, 0.2); padding: 8px; border-radius: 6px; font-size: 11px;">
                    <span style="color: #6496ff; font-weight: bold;">📚 Elev Full:</span>
                    <span style="color: #00ff88; float: right; font-weight: bold;">${stats.byType['elev_full'] || 0}</span>
                </div>
                <div style="background: rgba(255, 170, 0, 0.2); padding: 8px; border-radius: 6px; font-size: 11px;">
                    <span style="color: #ffaa00; font-weight: bold;">💪 Adult Standard:</span>
                    <span style="color: #00ff88; float: right; font-weight: bold;">${stats.byType['adult_standard'] || 0}</span>
                </div>
                <div style="background: rgba(255, 170, 0, 0.2); padding: 8px; border-radius: 6px; font-size: 11px;">
                    <span style="color: #ffaa00; font-weight: bold;">💪 Adult Full:</span>
                    <span style="color: #00ff88; float: right; font-weight: bold;">${stats.byType['adult_full'] || 0}</span>
                </div>
                <div style="background: rgba(0, 255, 136, 0.2); padding: 8px; border-radius: 6px; font-size: 11px; grid-column: 1 / -1;">
                    <span style="color: #00ff88; font-weight: bold;">🎯 2 Săptămâni:</span>
                    <span style="color: #00ff88; float: right; font-weight: bold;">${stats.byType['2weeks'] || 0}</span>
                </div>
            </div>
        </div>
        
        <!-- CREATOR STATISTICS -->
        <div style="background: rgba(30, 41, 59, 0.7); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 140, 0, 0.2); margin-bottom: 20px;">
            <h5 style="color: #ffaa33; margin: 0 0 12px 0; font-size: 12px;">👤 CREAT DE (ANGAJATI):</h5>
            ${Object.entries(stats.byCreator).map(([creator, count]) => `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255, 140, 0, 0.15); font-size: 11px;">
                    <span style="color: #ffaa33; font-weight: bold;">${creator || 'UNKNOWN'}</span>
                    <span style="background: #ff8c00; color: black; padding: 2px 8px; border-radius: 4px; font-weight: bold;">${count}</span>
                </div>
            `).join('')}
        </div>
        
        <!-- DETAILED LIST -->
        <div style="background: rgba(30, 41, 59, 0.7); padding: 15px; border-radius: 8px; border: 1px solid rgba(255, 140, 0, 0.2); max-height: 250px; overflow-y: auto;">
            <h5 style="color: #ffaa33; margin: 0 0 12px 0; font-size: 12px;">📋 LISTA ABONAMENTE:</h5>
            ${stats.items.map(c => {
                const createdDate = new Date(c.createdAt);
                const createdDateFormatted = createdDate.toLocaleDateString('ro-RO');
                const createdTime = createdDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
                
                return `
                    <div style="padding: 8px; border-bottom: 1px solid rgba(255, 140, 0, 0.15); font-size: 10px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                            <span style="font-weight: bold; color: #ffaa33;">${c.prenume} ${c.nume}</span>
                            <span style="background: ${c.subscription === 'elev_standard' ? '#6496ff' : c.subscription === 'elev_full' ? '#6496ff' : c.subscription === 'adult_standard' ? '#ffaa00' : c.subscription === 'adult_full' ? '#ffaa00' : '#00ff88'}; color: black; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 9px;">${SUBSCRIPTIONS[c.subscription]?.name || 'N/A'}</span>
                        </div>
                        <div style="color: #888;">
                            👤 ${c.createdBy} • 📅 ${createdDateFormatted} • ⏰ ${createdTime}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function setReportView(type) {
    const buttons = ['day', 'week', 'month'];
    const stats = { day: getDayStats(), week: getWeekStats(), month: getMonthStats() };
    const periods = { day: 'Astazi', week: 'Aceasta Saptamana', month: 'Luna Aceasta' };

    buttons.forEach(btn => {
        const element = document.getElementById(`btn-${btn}`);
        if (element) {
            if (btn === type) {
                element.style.background = '#ff8c00';
                element.style.color = 'white';
                element.style.border = 'none';
            } else {
                element.style.background = 'transparent';
                element.style.color = '#ffaa33';
                element.style.border = '2px solid #ffaa33';
            }
        }
    });

    document.getElementById('report-view').innerHTML = generateReportView(stats[type], periods[type]);
}

function applyCustomDateRange() {
    const fromInput = document.getElementById('dateFrom').value;
    const toInput = document.getElementById('dateTo').value;

    if (!fromInput || !toInput) {
        showNotification('❌ Selectează ambele date!', 'error');
        return;
    }

    const from = new Date(fromInput);
    const to = new Date(toInput);

    if (from > to) {
        showNotification('❌ Data de început trebuie să fie mai mică!', 'error');
        return;
    }

    const customStats = getSubscriptionsStats(from, to);
    const periodText = `${from.toLocaleDateString('ro-RO')} - ${to.toLocaleDateString('ro-RO')}`;
    
    document.getElementById('report-view').innerHTML = generateReportView(customStats, `Perioada Personalizată: ${periodText}`);
}

function generateTodayReport() {
    const today = getTodayDate();
    const entryClients = clients.filter(c => c.usedToday);
    const deniedClients = clients.filter(c => !checkClientAccess(c).allowed);
    const activeClients = clients.filter(c => checkClientAccess(c).allowed);
    const expiringClients = clients.filter(c => {
        const daysLeft = getDaysLeft(c.expiration);
        return daysLeft >= 0 && daysLeft <= 3;
    });
    
    return `
        <h3 style="color: #ffaa33; margin-bottom: 15px;">📅 Raport Zilei - ${new Date(today).toLocaleDateString('ro-RO')}</h3>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px;">
            <div style="background: rgba(0, 255, 136, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #00ff88; text-align: center;">
                <div style="font-size: 11px; color: #888; margin-bottom: 5px;">INTRARI</div>
                <div style="font-size: 24px; font-weight: bold; color: #00ff88;">${entryClients.length}</div>
            </div>
            <div style="background: rgba(255, 107, 107, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #ff6b6b; text-align: center;">
                <div style="font-size: 11px; color: #888; margin-bottom: 5px;">BLOCARI</div>
                <div style="font-size: 24px; font-weight: bold; color: #ff6b6b;">${deniedClients.length}</div>
            </div>
        </div>
        
        ${expiringClients.length > 0 ? `
            <div style="background: rgba(255, 170, 0, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #ffaa00;">
                <h4 style="color: #ffaa00; margin: 0 0 10px 0; font-size: 12px;">⚠️ ABONAMENTE EXPIRA (3 ZILE)</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    ${expiringClients.map(c => `
                        <div style="background: rgba(30, 41, 59, 0.5); padding: 8px; border-radius: 6px; font-size: 11px;">
                            <strong style="color: #ffaa00;">${c.prenume}</strong><br>
                            <span style="color: #888;">${new Date(c.expiration).toLocaleDateString('ro-RO')}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '<div style="background: rgba(0, 255, 136, 0.1); padding: 12px; border-radius: 8px; text-align: center; color: #00ff88; font-size: 12px;">✅ Niciun client nu are abonament expirând</div>'}
    `;
}

function generateActivityReport() {
    if (auditLog.length === 0) {
        return '<div style="text-align: center; color: #888; padding: 20px; font-size: 12px;">Niciun jurnal de activitate</div>';
    }
    
    return `
        <h3 style="color: #ffaa33; margin-bottom: 12px;">📝 Ultimele 50 Acțiuni</h3>
        ${auditLog.slice(-50).reverse().map(log => `
            <div style="padding: 8px; border-bottom: 1px solid rgba(255, 140, 0, 0.15); font-size: 10px; background: rgba(30, 41, 59, 0.5); margin-bottom: 5px; border-radius: 6px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span style="color: #ffaa33; font-weight: bold;">${new Date(log.timestamp).toLocaleTimeString('ro-RO')}</span>
                    <span style="background: ${log.userRole === 'admin' ? '#ff8c00' : log.userRole === 'manager' ? '#6496ff' : '#00ff88'}; color: black; padding: 1px 4px; border-radius: 2px; font-weight: bold; font-size: 9px;">${log.userRole}</span>
                </div>
                <div style="color: #00ff88;">${log.user}</div>
                <div style="color: #fff; margin-top: 1px;">${log.action}</div>
                ${log.details ? `<div style="color: #888; margin-top: 1px;">${log.details}</div>` : ''}
            </div>
        `).join('')}
    `;
}

function exportReport() {
    const today = getTodayDate();
    const dayStats = getDayStats();
    const weekStats = getWeekStats();
    const monthStats = getMonthStats();
    
    const reportData = {
        generated: new Date().toISOString(),
        generatedBy: currentUser,
        userRole: currentUserRole,
        statistics: {
            today: dayStats,
            thisWeek: weekStats,
            thisMonth: monthStats
        },
        clients: clients,
        auditLog: auditLog.slice(-500)
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raport-avanzat-${today}-${currentUser}.json`;
    link.click();
    
    addToAuditLog('Export raport avanzat', `Raport complet cu statistici exportat`);
    showNotification('✅ Raport exportat!', 'success');
}

// ═══════════════════════════════════════════════════════════════════════════
// 📋 CHECK ACCESS & VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function checkClientAccess(client) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const expirationDate = new Date(client.expiration);
    
    const subInfo = SUBSCRIPTIONS[client.subscription];
    
    if (client.usedToday) {
        return {
            allowed: false,
            message: '❌ Abonament folosit azi',
            status: 'expired'
        };
    }
    
    if (!client.isPaid) {
        return {
            allowed: false,
            message: '❌ Abonament neachitat',
            status: 'expired'
        };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expirationDate.setHours(0, 0, 0, 0);
    
    const daysLeft = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) {
        return {
            allowed: false,
            message: '❌ Abonament expirat',
            status: 'expired'
        };
    }

    if (daysLeft <= 3 && daysLeft > 0) {
        return {
            allowed: true,
            message: `⚠️ Expira în ${daysLeft} zile`,
            status: 'warning',
            daysLeft
        };
    }

    if (currentHour < subInfo.startHour) {
        return {
            allowed: false,
            message: `❌ Sala se deschide la ${subInfo.startHour}:00`,
            status: 'expired'
        };
    }

    if (subInfo.endHourStrict !== undefined) {
        if (currentHour > subInfo.endHourStrict || 
            (currentHour === subInfo.endHourStrict && currentMinute >= subInfo.endMinuteStrict)) {
            return {
                allowed: false,
                message: `❌ Sala se închide la ${subInfo.endHourStrict}:${String(subInfo.endMinuteStrict).padStart(2, '0')}`,
                status: 'expired'
            };
        }
    } else {
        if (currentHour >= subInfo.endHour) {
            return {
                allowed: false,
                message: `❌ Sala se închide la ${subInfo.endHour}:00`,
                status: 'expired'
            };
        }
    }

    return {
        allowed: true,
        message: '✅ Acces permis',
        status: 'active'
    };
}

function getDaysLeft(expiration) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expirationDate = new Date(expiration);
    expirationDate.setHours(0, 0, 0, 0);
    return Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
}

function getStatusColor(client) {
    const access = checkClientAccess(client);
    if (!access.allowed) return '#ff6b6b';
    if (access.status === 'warning') return '#ffaa00';
    return '#00ff88';
}

function getStatusClass(client) {
    const access = checkClientAccess(client);
    if (!access.allowed) return 'expired';
    if (access.status === 'warning') return 'warning';
    return 'active';
}

// ═══════════════════════════════════════════════════════════════════════════
// 🎴 CLIENT CARDS DISPLAY
// ═══════════════════════════════════════════════════════════════════════════

function initClientCards() {
    if (!isLoggedIn) {
        document.getElementById('entryList').innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Te rog conectează-te pentru a vedea clienți</p>';
        document.getElementById('exitList').innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Te rog conectează-te pentru a vedea clienți</p>';
        document.getElementById('gymList').innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Te rog conectează-te pentru a vedea clienți</p>';
        return;
    }

    const entryList = document.getElementById('entryList');
    const exitList = document.getElementById('exitList');
    const gymList = document.getElementById('gymList');

    const allowedClients = clients.filter(c => checkClientAccess(c).allowed);
    const deniedClients = clients.filter(c => !checkClientAccess(c).allowed);
    const inGymClients = clients.filter(c => c.usedToday);

    // INTRARE
    if (allowedClients.length === 0) {
        entryList.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Niciun client cu acces</p>';
    } else {
        entryList.innerHTML = allowedClients.map(client => {
            const statusClass = getStatusClass(client);
            const expiration = new Date(client.expiration);
            const expirationFormatted = expiration.toLocaleDateString('ro-RO');
            
            return `
                <div class="client-card ${statusClass}" onclick="onClientClick(${client.id}, true)" style="cursor: pointer; margin-bottom: 12px; padding: 12px; display: flex; gap: 15px; align-items: center;">
                    <div style="min-width: 80px;">
                        ${client.photo ? `<img src="${client.photo}" alt="${client.prenume}" style="width: 80px; height: 80px; border-radius: 12px; object-fit: cover; border: 3px solid ${getStatusColor(client)};">` : `<div style="width: 80px; height: 80px; background: #0f1b2e; border-radius: 12px; border: 3px solid ${getStatusColor(client)};"></div>`}
                    </div>
                    <div style="flex: 1;">
                        <p style="font-weight: bold; font-size: 18px; margin: 0; color: #fff;">${client.prenume} ${client.nume}</p>
                        <p style="font-size: 14px; color: #888; margin: 5px 0;">Expira: <span style="color: #ffaa33; font-weight: bold;">${expirationFormatted}</span></p>
                        <p style="font-size: 12px; color: #888; margin: 5px 0;">${checkClientAccess(client).message}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    // IEȘIRE
    if (deniedClients.length === 0) {
        exitList.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Niciun client blocat</p>';
    } else {
        exitList.innerHTML = deniedClients.map(client => {
            const access = checkClientAccess(client);
            const expiration = new Date(client.expiration);
            const expirationFormatted = expiration.toLocaleDateString('ro-RO');
            
            return `
                <div class="client-card expired" onclick="onClientClick(${client.id}, false)" style="cursor: pointer; margin-bottom: 12px; padding: 12px; display: flex; gap: 15px; align-items: center;">
                    <div style="min-width: 80px;">
                        ${client.photo ? `<img src="${client.photo}" alt="${client.prenume}" style="width: 80px; height: 80px; border-radius: 12px; object-fit: cover; border: 3px solid #ff6b6b;">` : `<div style="width: 80px; height: 80px; background: #0f1b2e; border-radius: 12px; border: 3px solid #ff6b6b;"></div>`}
                    </div>
                    <div style="flex: 1;">
                        <p style="font-weight: bold; font-size: 18px; margin: 0; color: #fff;">${client.prenume} ${client.nume}</p>
                        <p style="font-size: 14px; color: #ff6b6b; margin: 5px 0;">Expira: <span style="font-weight: bold;">${expirationFormatted}</span></p>
                        <p style="font-size: 12px; color: #ff6b6b; margin: 5px 0;">${access.message}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ÎN SALĂ - SCROLLABIL CU ORA DE INTRARE
    if (inGymClients.length === 0) {
        gymList.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Sala este goală</p>';
    } else {
        gymList.innerHTML = inGymClients.map(client => {
            const statusClass = getStatusClass(client);
            const daysLeft = getDaysLeft(client.expiration);
            const expiration = new Date(client.expiration);
            const expirationFormatted = expiration.toLocaleDateString('ro-RO');
            const checkInTime = clientCheckIns[client.id] ? new Date(clientCheckIns[client.id]).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
            
            return `
                <div class="client-card ${statusClass}" onclick="onClientClick(${client.id}, false)" style="cursor: pointer; margin-bottom: 12px; padding: 12px; display: flex; gap: 15px; align-items: center;">
                    <div style="min-width: 80px;">
                        ${client.photo ? `<img src="${client.photo}" alt="${client.prenume}" style="width: 80px; height: 80px; border-radius: 12px; object-fit: cover; border: 3px solid ${getStatusColor(client)};">` : `<div style="width: 80px; height: 80px; background: #0f1b2e; border-radius: 12px; border: 3px solid ${getStatusColor(client)};"></div>`}
                    </div>
                    <div style="flex: 1;">
                        <p style="font-weight: bold; font-size: 18px; margin: 0; color: #fff;">${client.prenume} ${client.nume}</p>
                        <p style="font-size: 14px; color: #888; margin: 5px 0;">Expira: <span style="color: #ffaa33; font-weight: bold;">${expirationFormatted}</span></p>
                        <p style="font-size: 12px; color: #00ff88; margin: 5px 0;">⏰ Intrat la: <strong>${checkInTime}</strong></p>
                        <p style="font-size: 12px; color: #888; margin: 5px 0;">În sală • ${daysLeft} zile</p>
                    </div>
                </div>
            `;
        }).join('');
    }
}

function onClientClick(clientId, isAllowed) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (isAllowed && !client.usedToday) {
        showCheckInModal(client);
    } else {
        showClientDetails(client);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ✅ CHECK IN MODAL
// ═══════════════════════════════════════════════════════════════════════════

function showCheckInModal(client) {
    const subInfo = SUBSCRIPTIONS[client.subscription];
    
    const html = `
        <div class="box" style="text-align: center;">
            <h2 style="color: #00ff88; margin-bottom: 20px;">✅ ACCES PERMIS</h2>
            
            ${client.photo ? `<img src="${client.photo}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 10px; margin-bottom: 15px;">` : ''}
            
            <p style="font-size: 20px; font-weight: bold; color: #ffaa33; margin-bottom: 10px;">${client.prenume} ${client.nume}</p>
            
            <div style="background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 255, 136, 0.05)); padding: 15px; border-radius: 10px; border-left: 4px solid #00ff88; margin-bottom: 15px;">
                <p style="margin: 5px 0;"><strong>Abonament:</strong> ${subInfo.name}</p>
                <p style="margin: 5px 0;"><strong>Acces azi:</strong> ${subInfo.startHour}:00 - ${subInfo.endHourStrict ? subInfo.endHourStrict + ':' + subInfo.endMinuteStrict : subInfo.endHour + ':00'}</p>
            </div>

            <div class="actions">
                <button onclick="confirmCheckIn(${client.id})" style="flex: 1;">✅ Confirmare Intrare</button>
                <button onclick="showClientDetails(${client.id})" style="flex: 1;">ℹ️ Detalii</button>
                <button onclick="closeModal()" style="flex: 1;">❌ Anulează</button>
            </div>
        </div>
    `;

    openModal(html);
}

function confirmCheckIn(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    client.usedToday = true;
    const now = new Date().toISOString();
    clientCheckIns[client.id] = now;
    
    saveClientsToStorage();
    saveCheckIns();
    addToAuditLog('Intrare client', `${client.prenume} ${client.nume} - Ora: ${new Date(now).toLocaleTimeString('ro-RO')}`);
    
    showNotification(`✅ ${client.prenume} ${client.nume} - Intrare înregistrată!`, 'success');
    closeModal();
    initClientCards();
}

// ═══════════════════════════════════════════════════════════════════════════
// 📋 CLIENT DETAILS MODAL
// ═══════════════════════════════════════════════════════════════════════════

function showClientDetails(clientOrId) {
    const client = typeof clientOrId === 'number' ? clients.find(c => c.id === clientOrId) : clientOrId;
    if (!client) return;

    const subInfo = SUBSCRIPTIONS[client.subscription];
    const daysLeft = getDaysLeft(client.expiration);
    const access = checkClientAccess(client);
    const statusColor = getStatusColor(client);
    const expiration = new Date(client.expiration);
    const expirationFormatted = expiration.toLocaleDateString('ro-RO');
    const createdDate = new Date(client.createdAt);
    const createdDateFormatted = createdDate.toLocaleDateString('ro-RO');
    const createdTimeFormatted = createdDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });

    let statusText = '';
    if (!client.isPaid) {
        statusText = '❌ Neachitat';
    } else if (client.usedToday) {
        statusText = '❌ Folosit azi';
    } else if (daysLeft < 0) {
        statusText = '❌ Expirat';
    } else if (daysLeft <= 3) {
        statusText = `⚠️ ${daysLeft} zile`;
    } else {
        statusText = '✅ Activ';
    }

    const html = `
        <div class="box scroll-box">
            <h2 style="color: #ffaa33; text-align: center;">${client.prenume} ${client.nume}</h2>
            
            ${client.photo ? `<img src="${client.photo}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px; margin-bottom: 15px;">` : ''}
            
            <div style="background: linear-gradient(135deg, rgba(${statusColor === '#00ff88' ? '0, 255, 136' : statusColor === '#ffaa00' ? '255, 170, 0' : '255, 107, 107'}, 0.1), rgba(${statusColor === '#00ff88' ? '0, 255, 136' : statusColor === '#ffaa00' ? '255, 170, 0' : '255, 107, 107'}, 0.05)); padding: 15px; border-radius: 10px; border-left: 4px solid ${statusColor}; margin-bottom: 15px;">
                <p style="margin: 8px 0; font-size: 16px;"><strong>Nume:</strong> ${client.prenume} ${client.nume}</p>
                <p style="margin: 8px 0; font-size: 16px;"><strong>Abonament:</strong> ${subInfo.name}</p>
                <p style="margin: 8px 0; font-size: 16px;"><strong>Tag:</strong> ${client.tag || 'N/A'}</p>
                <p style="margin: 8px 0; font-size: 16px;"><strong>Status:</strong> ${statusText}</p>
                <p style="margin: 8px 0; font-size: 16px;"><strong>Expirare:</strong> ${expirationFormatted}</p>
                <p style="margin: 8px 0; font-size: 16px;"><strong>Zile rămase:</strong> ${daysLeft >= 0 ? daysLeft : 0}</p>
                <p style="margin: 8px 0; font-size: 16px;"><strong>Creat de:</strong> <span style="color: #00ff88;">${client.createdBy}</span></p>
                <p style="margin: 8px 0; font-size: 16px;"><strong>Data/Ora creării:</strong> ${createdDateFormatted} la ${createdTimeFormatted}</p>
            </div>

            <div class="actions">
                <button onclick="editClient(${client.id})" style="flex: 1;">✏️ Editează</button>
                <button onclick="togglePaid(${client.id})" style="flex: 1;">💳 ${client.isPaid ? 'Mark Neachitat' : 'Mark Plătit'}</button>
                <button onclick="resetUsage(${client.id})" style="flex: 1;">🔄 Reset Azi</button>
                <button onclick="deleteClient(${client.id})" style="flex: 1;">🗑️ Șterge</button>
                <button onclick="closeModal()" style="flex: 1;">❌ Închide</button>
            </div>
        </div>
    `;

    openModal(html);
}

// ═══════════════════════════════════════════════════════════════════════════
// ✏️ EDIT CLIENT
// ═══════════════════════════════════════════════════════════════════════════

function editClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const html = `
        <div class="box scroll-box">
            <h2 style="color: #ffaa33; text-align: center;">✏️ Editează Client</h2>
            
            <!-- Fotografie -->
            <div style="background: rgba(255, 140, 0, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #ffaa33; margin-bottom: 15px;">
                <p style="color: #ffaa33; font-weight: bold; margin-bottom: 10px;">FOTOGRAFIE</p>
                <div id="editPhotoPreview" style="width: 100%; height: 180px; background: #0f1b2e; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
                    ${client.photo ? `<img src="${client.photo}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="color: #888;">Fără fotografie</span>'}
                </div>
                <div class="photo-buttons">
                    <button onclick="editStartCamera(${clientId})" style="flex: 1;">📷 Cameră</button>
                    <button onclick="deletePhoto(${clientId})" style="flex: 1;">🗑️ Șterge</button>
                </div>
            </div>

            <!-- Video pentru cameră (ascuns) -->
            <video id="editCameraVideo" style="display: none; width: 100%; height: 200px; border-radius: 10px; margin-bottom: 10px;"></video>

            <!-- Date -->
            <div style="background: rgba(255, 140, 0, 0.05); padding: 15px; border-radius: 10px; margin-bottom: 15px;">
                <p style="color: #ffaa33; font-weight: bold; margin-bottom: 10px;">DATE</p>
                <input type="text" id="editNume" placeholder="Nume" value="${client.nume}" style="width: 100%; margin-bottom: 10px;">
                <input type="text" id="editPrenume" placeholder="Prenume" value="${client.prenume}" style="width: 100%; margin-bottom: 10px;">
                <input type="text" id="editTag" placeholder="Tag" value="${client.tag}" style="width: 100%;">
            </div>

            <div class="actions">
                <button onclick="saveEditClient(${clientId})" style="flex: 1;">💾 Salvează</button>
                <button onclick="showClientDetails(${clientId})" style="flex: 1;">❌ Anulează</button>
            </div>
        </div>
    `;

    openModal(html);
    setTimeout(() => initEditCamera(clientId), 500);
}

function editStartCamera(clientId) {
    const video = document.getElementById('editCameraVideo');
    
    if (currentCameraStream) {
        stopCamera();
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
            currentCameraStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';
            
            let captureBtn = document.getElementById('editCaptureBtn');
            if (!captureBtn) {
                captureBtn = document.createElement('button');
                captureBtn.id = 'editCaptureBtn';
                captureBtn.textContent = '📸 Capturează';
                captureBtn.onclick = () => editCapturePhoto(clientId);
                captureBtn.style.cssText = 'width: 100%; padding: 10px; background: #ff8c00; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; margin-bottom: 10px;';
                video.parentNode.insertBefore(captureBtn, video.nextSibling);
            }
        })
        .catch(err => {
            console.error('Camera error:', err);
            showNotification('❌ Eroare cameră', 'error');
        });
}

function initEditCamera(clientId) {
    // Initialize can be done here if needed
}

function editCapturePhoto(clientId) {
    const video = document.getElementById('editCameraVideo');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!video.videoWidth) {
        showNotification('❌ Camera nu este gata!', 'error');
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const photoData = canvas.toDataURL('image/jpeg');
    const preview = document.getElementById('editPhotoPreview');
    preview.innerHTML = `<img src="${photoData}" style="width: 100%; height: 100%; object-fit: cover;">`;
    video.style.display = 'none';
    
    localStorage.setItem('tempEditPhoto', photoData);
    stopCamera();
    
    const captureBtn = document.getElementById('editCaptureBtn');
    if (captureBtn) captureBtn.remove();
    
    showNotification('✅ Fotografia capturată!', 'success');
}

function deletePhoto(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (client) {
        client.photo = '';
        const preview = document.getElementById('editPhotoPreview');
        preview.innerHTML = '<span style="color: #888;">Fără fotografie</span>';
        localStorage.removeItem('tempEditPhoto');
        showNotification('🗑️ Fotografia ștearsă!', 'success');
    }
}

function saveEditClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const nume = document.getElementById('editNume').value.trim();
    const prenume = document.getElementById('editPrenume').value.trim();
    const tag = document.getElementById('editTag').value.trim();
    const tempPhoto = localStorage.getItem('tempEditPhoto');

    if (!nume || !prenume) {
        showNotification('❌ Te rog completează nume și prenume!', 'error');
        return;
    }

    client.nume = nume;
    client.prenume = prenume;
    client.tag = tag;
    
    if (tempPhoto) {
        client.photo = tempPhoto;
        localStorage.removeItem('tempEditPhoto');
    }

    saveClientsToStorage();
    addToAuditLog('Editează client', `${prenume} ${nume}`);
    showNotification('✅ Client actualizat!', 'success');
    closeModal();
    initClientCards();
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔧 CLIENT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function togglePaid(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    client.isPaid = !client.isPaid;
    saveClientsToStorage();
    addToAuditLog('Setare plată client', `${client.prenume} ${client.nume}: ${client.isPaid ? 'PLĂTIT' : 'NEACHITAT'}`);
    showNotification(client.isPaid ? '✅ Marcat ca plătit!' : '❌ Marcat ca neachitat!', 'success');
    closeModal();
    initClientCards();
}

function resetUsage(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (confirm('Ești sigur că vrei să reseteazi utilizarea de azi?')) {
        client.usedToday = false;
        if (clientCheckIns[client.id]) {
            delete clientCheckIns[client.id];
        }
        saveClientsToStorage();
        saveCheckIns();
        addToAuditLog('Reset utilizare client', `${client.prenume} ${client.nume}`);
        showNotification('🔄 Utilizare resetată!', 'success');
        closeModal();
        initClientCards();
    }
}

function deleteClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (confirm(`Ești sigur că vrei să ștergi ${client.prenume} ${client.nume}?`)) {
        const fullName = `${client.prenume} ${client.nume}`;
        clients = clients.filter(c => c.id !== clientId);
        if (clientCheckIns[client.id]) {
            delete clientCheckIns[client.id];
        }
        saveClientsToStorage();
        saveCheckIns();
        addToAuditLog('Șterge client', fullName);
        showNotification('🗑️ Client șters!', 'success');
        closeModal();
        initClientCards();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔌 INITIALIZATION & EVENTS
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    resetDailyUsageIfNeeded();
    initClientCards();
    
    // Setează datele inițiale în calendar
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Refresh la fiecare minut
    setInterval(() => {
        resetDailyUsageIfNeeded();
        initClientCards();
    }, 60000);
    
    console.log('✅ GYM CORE SYSTEM v4.0 Inițializat!');
    console.log('📝 Demo Login Credentials:');
    console.log('   admin / 1234 → Acces complet');
    console.log('   manager / 1234 → Rapoarte + Setări');
    console.log('   staff / 1234 → Doar verificare acces');
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeAllModals();
    }
});