// ╔═══════════════════════════════════════════════════════════════════╗
// ║                     GYM CORE SYSTEM - v6.0                        ║
// ║                    WITH NFC CARD READER                           ║
// ╚═══════════════════════════════════════════════════════════════════╝

//cititor //
const nfcSocket = new WebSocket("ws://localhost:8080");

nfcSocket.onopen = () => {
    console.log("✅ WebSocket conectat");
    const nfcStatus = document.getElementById('nfc-status');
    if (nfcStatus) nfcStatus.innerHTML = '🟢 NFC Online';
};

nfcSocket.onerror = (error) => {
    console.log("❌ WebSocket eroare:", error);
    const nfcStatus = document.getElementById('nfc-status');
    if (nfcStatus) nfcStatus.innerHTML = '🔴 NFC Offline';
};

nfcSocket.onclose = () => {
    console.log("🔌 WebSocket deconectat");
    const nfcStatus = document.getElementById('nfc-status');
    if (nfcStatus) nfcStatus.innerHTML = '🟡 NFC Standby';
};

nfcSocket.onmessage = (event) => {
    let tagPrimit = event.data.trim().toLowerCase();
    console.log('Tag primit:', tagPrimit);
    
    const client = clients.find(c => {
        if (!c.tag) return false;
        let tagClient = c.tag.trim().toLowerCase();
        tagClient = tagClient.replace(/9000$/, '');
        return tagPrimit === tagClient;
    });

    if (!client) {
        showNotification("Client negăsit! Tag: " + tagPrimit, "error");
        return;
    }

    console.log('Client găsit:', client.prenume, client.nume);

    if (client.nfcScansToday === undefined) client.nfcScansToday = 0;
    if (client.isInGym === undefined) client.isInGym = false;

    const today = getTodayDate();

    if (client.lastScanDate !== today) {
        client.nfcScansToday = 0;
        client.isInGym = false;
        client.lastScanDate = today;
    }

    client.nfcScansToday++;
    client.lastScanTimestamp = Date.now();

    if (client.nfcScansToday === 1) {
        client.isInGym = true;
        client.usedToday = true;
        addToAuditLog('Intrare NFC', `${client.prenume} ${client.nume} - Tag: ${tagPrimit}`);
        showNotification(`${client.prenume} a intrat în sală!`, "success");
    } else if (client.nfcScansToday === 2) {
        client.isInGym = false;
        addToAuditLog('Ieșire NFC', `${client.prenume} ${client.nume} - Tag: ${tagPrimit}`);
        showNotification(`${client.prenume} a ieșit din sală!`, "success");
    } else {
        client.isInGym = true;
        addToAuditLog('Re-intrare NFC', `${client.prenume} ${client.nume} - Abonament folosit azi`);
        showNotification("Abonament folosit azi!", "error");
    }

    saveClientsToStorage();
    saveCheckIns();
    initClientCards();
};

// ════════════════════════════════════════════════════════════════════
// ✅ VARIABILE GLOBALE
// ════════════════════════════════════════════════════════════════════

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

const SUBSCRIPTIONS = {
    'elev_standard': { name: 'Elev Standard', duration: 30, startHour: 7, endHour: 17, endHourStrict: 16, endMinuteStrict: 40, category: 'Elev', type: 'Standard' },
    'elev_full': { name: 'Elev Full', duration: 30, startHour: 7, endHour: 21, category: 'Elev', type: 'Full' },
    'adult_standard': { name: 'Adult Standard', duration: 30, startHour: 7, endHour: 17, endHourStrict: 16, endMinuteStrict: 40, category: 'Adult', type: 'Standard' },
    'adult_full': { name: 'Adult Full', duration: 30, startHour: 7, endHour: 21, category: 'Adult', type: 'Full' },
    '2weeks': { name: '2 Săptămâni', duration: 15, startHour: 7, endHour: 17, endHourStrict: 16, endMinuteStrict: 40, category: 'Special', type: '2 Weeks' }
};

// ════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════════

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
    if (auditLog.length > 2000) auditLog = auditLog.slice(-1000);
    saveAuditLog();
}

function resetDailyUsageIfNeeded() {
    const lastResetDate = localStorage.getItem('lastDailyReset');
    const todayDate = getTodayDate();
    if (lastResetDate !== todayDate) {
        clients.forEach(client => client.usedToday = false);
        clientCheckIns = {};
        saveClientsToStorage();
        saveCheckIns();
        localStorage.setItem('lastDailyReset', todayDate);
    }
}

// ════════════════════════════════════════════════════════════════════
// 🎯 MODAL FUNCTIONS
// ════════════════════════════════════════════════════════════════════

function closeAllModals() {
    const addModal = document.getElementById('addModal');
    const searchModal = document.getElementById('searchModal');
    const loginModal = document.getElementById('loginModal');
    const detailModal = document.getElementById('detailModal');
    
    if (addModal) addModal.classList.remove('active');
    if (searchModal) searchModal.classList.remove('active');
    if (loginModal) loginModal.classList.remove('active');
    if (detailModal) detailModal.classList.remove('active');
}

function openModal(html) {
    closeAllModals();
    let modal = document.getElementById('detailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'detailModal';
        modal.className = 'modal active';
        document.body.appendChild(modal);
    }
    modal.innerHTML = html;
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.classList.remove('active');
    stopCamera();
    stopEditCamera();
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('detailModal');
    if (modal && e.target === modal) closeModal();
});

// ════════════════════════════════════════════════════════════════════
// 👤 LOGIN
// ════════════════════════════════════════════════════════════════════

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
        errorDiv.innerHTML = '<p style="color: #ff6b6b; margin: 10px 0;">Completeaza user si cod!</p>';
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
        addToAuditLog('Login', `User: ${user} (${foundUser.role})`);
        showNotification(`Bine ai venit, ${foundUser.name}!`, 'success');
        initClientCards();
    } else {
        errorDiv.innerHTML = '<p style="color: #ff6b6b;">User sau cod incorect!</p>';
        document.getElementById('loginCode').value = '';
        addToAuditLog('Login Failed', `Tentativa: ${user}`);
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
    showNotification('Esti deconectat!', 'success');
    initClientCards();
}

function toggleUserMenu() {
    document.getElementById('userMenu').classList.toggle('active');
}

document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    const userArea = document.getElementById('userArea');
    if (userArea && userMenu && !e.target.closest('#userArea') && userMenu.classList.contains('active')) {
        userMenu.classList.remove('active');
    }
});

// ════════════════════════════════════════════════════════════════════
// 📷 CAMERA FUNCTIONS
// ════════════════════════════════════════════════════════════════════

function startCamera() {
    const video = document.getElementById('video');
    if (!video) return;
    
    if (currentCameraStream) stopCamera();

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
            currentCameraStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';
            video.play().catch(err => console.error('Play error:', err));
        })
        .catch(err => {
            console.error('Camera error:', err);
            showNotification('Eroare camera: ' + err.message, 'error');
        });
}

function stopCamera() {
    if (currentCameraStream) {
        currentCameraStream.getTracks().forEach(track => track.stop());
        currentCameraStream = null;
    }
}

function stopEditCamera() {
    const video = document.getElementById('editCameraVideo');
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
}

function capture() {
    const video = document.getElementById('video');
    if (!video || !video.videoWidth) {
        showNotification('Camera nu este gata!', 'error');
        return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const photoData = canvas.toDataURL('image/jpeg');
    const preview = document.getElementById('preview');
    if (preview) {
        preview.src = photoData;
        preview.style.display = 'block';
    }
    video.style.display = 'none';
    
    localStorage.setItem('tempPhoto', photoData);
    stopCamera();
    showNotification('Fotografia capturata!', 'success');
}

// ════════════════════════════════════════════════════════════════════
// ➕ ADD CLIENT
// ════════════════════════════════════════════════════════════════════

function openAdd() {
    if (!isLoggedIn) {
        showNotification('Trebuie sa fii conectat!', 'error');
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
    document.getElementById('customDays').value = '30';
    document.getElementById('tag').value = '';
    document.getElementById('preview').style.display = 'none';
    document.getElementById('video').style.display = 'block';
    localStorage.removeItem('tempPhoto');
}

function saveClient() {
    const nume = document.getElementById('name').value.trim();
    const prenume = document.getElementById('surname').value.trim();
    const subscription = document.getElementById('subscription').value;
    const customDays = parseInt(document.getElementById('customDays').value) || 30;
    const tag = document.getElementById('tag').value.trim().toLowerCase();
    const photo = localStorage.getItem('tempPhoto') || '';

    if (!nume || !prenume || !subscription) {
        showNotification('Completeaza toate campurile obligatorii!', 'error');
        return;
    }

    const today = new Date();
    const expirationDate = new Date(today);
    expirationDate.setDate(expirationDate.getDate() + customDays);

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
        duration: customDays
    };

    clients.push(newClient);
    saveClientsToStorage();
    addToAuditLog('Adauga client', `${prenume} ${nume} - Abonament: ${customDays} zile - Tag: ${tag || 'N/A'}`);
    showNotification(`Client ${prenume} ${nume} adaugat!`, 'success');
    closeAdd();
    initClientCards();
}

// ════════════════════════════════════════════════════════════════════
// 🔍 SEARCH CLIENT
// ════════════════════════════════════════════════════════════════════

function openSearch() {
    if (!isLoggedIn) {
        showNotification('Trebuie sa fii conectat!', 'error');
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
    document.getElementById('search').value = '';
    document.getElementById('results').innerHTML = '';
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
        (c.tag && c.tag.toLowerCase().includes(searchTerm))
    );

    if (results.length === 0) {
        resultsDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Niciun rezultat</p>';
        return;
    }

    resultsDiv.innerHTML = results.map(client => `
        <div class="client-card" onclick="searchSelectClient(${client.id})" style="cursor: pointer; margin-bottom: 10px;">
            <div style="flex: 1;">
                <p style="font-weight: bold; margin: 0;">${client.prenume} ${client.nume}</p>
                <p style="font-size: 12px; color: #888; margin: 5px 0;">Tag: ${client.tag || 'N/A'} | Expira: ${new Date(client.expiration).toLocaleDateString('ro-RO')}</p>
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

// ════════════════════════════════════════════════════════════════════
// ⚙️ SETTINGS - VERSIUNE COMPLETĂ
// ════════════════════════════════════════════════════════════════════

function openSettings() {
    if (!isLoggedIn) {
        showNotification('Trebuie sa fii conectat!', 'error');
        return;
    }
    if (currentUserRole !== 'admin' && currentUserRole !== 'manager') {
        showNotification('Nu ai acces!', 'error');
        return;
    }
    
    const settingsHTML = `
        <div class="box scroll-box" style="width: 750px; max-width: 95%;">
            <h2 style="color: #ffaa33;">SETARI SISTEM</h2>
            
            <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
                <button onclick="switchSettingsTab('backup')" class="settings-tab" style="flex: 1; min-width: 100px; padding: 10px; background: #ff8c00; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Backup</button>
                <button onclick="switchSettingsTab('audit')" class="settings-tab" style="flex: 1; min-width: 100px; padding: 10px; background: transparent; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; color: #ffaa33; font-weight: bold;">Audit</button>
                <button onclick="switchSettingsTab('users')" class="settings-tab" style="flex: 1; min-width: 100px; padding: 10px; background: transparent; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; color: #ffaa33; font-weight: bold;">Utilizatori</button>
                <button onclick="switchSettingsTab('clean')" class="settings-tab" style="flex: 1; min-width: 100px; padding: 10px; background: transparent; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; color: #ffaa33; font-weight: bold;">Curatare</button>
            </div>
            
            <div id="backup-tab" class="settings-content" style="display: block;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">Backup & Restore</h3>
                <button onclick="exportClientsJSON()" style="width: 100%; padding: 10px; background: #00ff88; color: black; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 10px; font-weight: bold;">Exporta JSON</button>
                <input type="file" id="importFile" accept=".json" style="width: 100%; padding: 8px; margin-bottom: 10px; border: 2px solid #6496ff; border-radius: 8px; background: rgba(100, 150, 255, 0.1); color: #e0e0e0;">
                <button onclick="importClientsJSON()" style="width: 100%; padding: 10px; background: #6496ff; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Importa JSON</button>
            </div>
            
            <div id="audit-tab" class="settings-content" style="display: none; max-height: 400px; overflow-y: auto;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">Jurnal Audit</h3>
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                    <select id="auditFilterRole" onchange="filterAuditLog()" style="padding: 8px; border-radius: 8px;">
                        <option value="">Toate rolurile</option>
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                    </select>
                    <select id="auditFilterPeriod" onchange="filterAuditLog()" style="padding: 8px; border-radius: 8px;">
                        <option value="today">Astăzi</option>
                        <option value="week">Săptămâna aceasta</option>
                        <option value="month">Luna aceasta</option>
                        <option value="all">Toate</option>
                    </select>
                    <button onclick="exportAuditLog()" style="padding: 8px 16px;">Exporta CSV</button>
                </div>
                <div id="auditLogList"></div>
                <button onclick="clearAuditLog()" style="width: 100%; padding: 10px; background: #ff6b6b; color: white; border: none; border-radius: 8px; cursor: pointer; margin-top: 10px; font-weight: bold;">Sterge Log</button>
            </div>
            
            <div id="users-tab" class="settings-content" style="display: none;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">Gestionare Utilizatori</h3>
                <div id="usersList"></div>
                <div style="margin-top: 20px; padding: 15px; background: rgba(100, 150, 255, 0.1); border-radius: 12px;">
                    <h4 style="color: #6496ff;">➕ Adauga utilizator nou</h4>
                    <input type="text" id="newUserUsername" placeholder="Username" style="width: 100%; margin-bottom: 8px;">
                    <input type="text" id="newUserName" placeholder="Nume complet" style="width: 100%; margin-bottom: 8px;">
                    <input type="text" id="newUserCode" placeholder="Cod (pin)" style="width: 100%; margin-bottom: 8px;">
                    <select id="newUserRole" style="width: 100%; margin-bottom: 8px;">
                        <option value="staff">Staff</option>
                        <option value="manager">Manager</option>
                        ${currentUserRole === 'admin' ? '<option value="admin">Admin</option>' : ''}
                    </select>
                    <button onclick="addUser()" style="width: 100%; background: #00ff88; color: black;">Adauga utilizator</button>
                </div>
            </div>
            
            <div id="clean-tab" class="settings-content" style="display: none;">
                <h3 style="color: #ff6b6b; margin-bottom: 15px;">Curatare Date</h3>
                <button onclick="deleteExpiredClients()" style="width: 100%; padding: 10px; background: #ff6b6b; color: white; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 10px; font-weight: bold;">Sterge Expirati</button>
                <button onclick="resetAllUsedToday()" style="width: 100%; padding: 10px; background: #ffaa00; color: black; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 10px; font-weight: bold;">Reset Zi</button>
                <button onclick="deleteAllClients()" style="width: 100%; padding: 10px; background: #ff3232; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">STERGE TOTI</button>
            </div>
            
            <button onclick="closeModal()" style="width: 100%; padding: 10px; background: #6496ff; color: white; border: none; border-radius: 8px; cursor: pointer; margin-top: 15px; font-weight: bold;">Inchide</button>
        </div>
    `;
    openModal(settingsHTML);
    renderUsersList();
    renderAuditLog();
}

function switchSettingsTab(tab) {
    document.querySelectorAll('.settings-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.settings-tab').forEach(el => {
        el.style.background = 'transparent';
        el.style.color = '#ffaa33';
        el.style.border = '2px solid #ffaa33';
    });
    
    const tabElement = document.getElementById(`${tab}-tab`);
    if (tabElement) tabElement.style.display = 'block';
    
    if (event && event.target) {
        event.target.style.background = '#ff8c00';
        event.target.style.color = 'white';
        event.target.style.border = 'none';
    }
    
    if (tab === 'users') renderUsersList();
    if (tab === 'audit') renderAuditLog();
}

function renderUsersList() {
    const container = document.getElementById('usersList');
    if (!container) return;
    
    container.innerHTML = users.map(user => `
        <div style="padding: 12px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <p style="margin: 0; font-weight: bold; color: #ffaa33;">${user.name}</p>
                <p style="margin: 5px 0 0 0; font-size: 11px; color: #888;">@${user.username} | Cod: ****</p>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: #6496ff;">Rol: ${user.role} | Creat: ${new Date(user.createdAt).toLocaleDateString('ro-RO')}</p>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="editUser(${user.id})" style="padding: 6px 12px; background: #6496ff;">✏️</button>
                ${user.username !== 'admin' && user.username !== currentUser ? `<button onclick="deleteUser(${user.id})" style="padding: 6px 12px; background: #ff6b6b;">🗑️</button>` : ''}
            </div>
        </div>
    `).join('');
}

function editUser(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const newName = prompt('Nume nou:', user.name);
    const newCode = prompt('Cod nou (pin):', user.code);
    const newRole = prompt('Rol nou (admin/manager/staff):', user.role);
    
    if (newName) user.name = newName;
    if (newCode) user.code = newCode;
    if (newRole && ['admin', 'manager', 'staff'].includes(newRole)) user.role = newRole;
    
    saveUsers();
    addToAuditLog('Editare utilizator', `${user.username} - ${user.name}`);
    showNotification('Utilizator actualizat!', 'success');
    renderUsersList();
}

function deleteUser(userId) {
    if (confirm('Sigur stergi acest utilizator?')) {
        const user = users.find(u => u.id === userId);
        users = users.filter(u => u.id !== userId);
        saveUsers();
        addToAuditLog('Stergere utilizator', `${user.username} - ${user.name}`);
        showNotification('Utilizator sters!', 'success');
        renderUsersList();
    }
}

function addUser() {
    const username = document.getElementById('newUserUsername')?.value.trim();
    const name = document.getElementById('newUserName')?.value.trim();
    const code = document.getElementById('newUserCode')?.value.trim();
    const role = document.getElementById('newUserRole')?.value;
    
    if (!username || !name || !code) {
        showNotification('Completeaza toate campurile!', 'error');
        return;
    }
    
    if (users.find(u => u.username === username)) {
        showNotification('Username deja exista!', 'error');
        return;
    }
    
    const newUser = {
        id: Date.now(),
        username: username,
        code: code,
        role: role,
        name: name,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    saveUsers();
    addToAuditLog('Adaugare utilizator', `${username} - ${name} (${role})`);
    showNotification('Utilizator adaugat!', 'success');
    
    document.getElementById('newUserUsername').value = '';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserCode').value = '';
    renderUsersList();
}

function renderAuditLog() {
    const container = document.getElementById('auditLogList');
    if (!container) return;
    
    const roleFilter = document.getElementById('auditFilterRole')?.value || '';
    const periodFilter = document.getElementById('auditFilterPeriod')?.value || 'all';
    
    let filtered = [...auditLog];
    
    if (roleFilter) {
        filtered = filtered.filter(log => log.userRole === roleFilter);
    }
    
    const now = new Date();
    if (periodFilter === 'today') {
        const todayStr = getTodayDate();
        filtered = filtered.filter(log => log.timestamp.startsWith(todayStr));
    } else if (periodFilter === 'week') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        filtered = filtered.filter(log => new Date(log.timestamp) >= weekAgo);
    } else if (periodFilter === 'month') {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        filtered = filtered.filter(log => new Date(log.timestamp) >= monthAgo);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<p style="color: #888; text-align: center;">Niciun jurnal pentru filtrele selectate</p>';
        return;
    }
    
    container.innerHTML = filtered.slice(-100).reverse().map(log => `
        <div style="padding: 10px; border-bottom: 1px solid #333; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #ffaa33;"><strong>${new Date(log.timestamp).toLocaleString('ro-RO')}</strong></span>
                <span style="background: ${log.userRole === 'admin' ? '#ff8c00' : log.userRole === 'manager' ? '#6496ff' : '#00ff88'}; color: black; padding: 2px 8px; border-radius: 5px; font-size: 10px; font-weight: bold;">${log.userRole}</span>
            </div>
            <p style="margin: 5px 0; color: #00ff88;"><strong>${log.user}</strong></p>
            <p style="margin: 0; color: #fff;">${log.action}</p>
            ${log.details ? `<p style="margin: 3px 0; color: #888; font-size: 11px;">📝 ${log.details}</p>` : ''}
        </div>
    `).join('');
}

function filterAuditLog() {
    renderAuditLog();
}

function exportAuditLog() {
    const roleFilter = document.getElementById('auditFilterRole')?.value || '';
    const periodFilter = document.getElementById('auditFilterPeriod')?.value || 'all';
    
    let filtered = [...auditLog];
    if (roleFilter) filtered = filtered.filter(log => log.userRole === roleFilter);
    
    const now = new Date();
    if (periodFilter === 'today') {
        const todayStr = getTodayDate();
        filtered = filtered.filter(log => log.timestamp.startsWith(todayStr));
    } else if (periodFilter === 'week') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        filtered = filtered.filter(log => new Date(log.timestamp) >= weekAgo);
    } else if (periodFilter === 'month') {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        filtered = filtered.filter(log => new Date(log.timestamp) >= monthAgo);
    }
    
    const csv = [['Data', 'Utilizator', 'Rol', 'Actiune', 'Detalii'].join(',')];
    filtered.forEach(log => {
        csv.push([
            `"${new Date(log.timestamp).toLocaleString('ro-RO')}"`,
            `"${log.user}"`,
            `"${log.userRole}"`,
            `"${log.action}"`,
            `"${(log.details || '').replace(/"/g, '""')}"`
        ].join(','));
    });
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${getTodayDate()}.csv`;
    a.click();
    showNotification('Audit exportat!', 'success');
}

// ════════════════════════════════════════════════════════════════════
// CONTINUARE ÎN PARTEA 2... (am depășit limita)
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// ✏️ EDIT CLIENT - VERSIUNE COMPLETĂ (cu calendar pentru perioadă)
// ════════════════════════════════════════════════════════════════════

function editClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const escapeHtml = (str) => {
        if (!str) return '';
        return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };

    const currentExpDate = new Date(client.expiration);
    const formattedExpDate = currentExpDate.toISOString().split('T')[0];

    const html = `
        <div class="box scroll-box" style="width: 550px; max-width: 95%;">
            <h2 style="color: #ffaa33;">✏️ EDITEAZA CLIENT</h2>
            
            <div style="margin-bottom: 15px;">
                <p style="color: #ffaa33; font-weight: bold; margin-bottom: 10px;">📸 FOTOGRAFIE</p>
                <div id="editPhotoPreview" style="width: 100%; height: 180px; background: #1a1a2e; border-radius: 15px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 2px solid #ffaa33;">
                    ${client.photo ? `<img src="${client.photo}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="color: #888;">📷 Fără fotografie</span>'}
                </div>
                <video id="editCameraVideo" style="display: none; width: 100%; height: 180px; border-radius: 15px; margin-bottom: 10px; background: #000;"></video>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <button type="button" id="startEditCamBtn" onclick="editStartCamera(${clientId})" style="flex: 1; padding: 10px; background: #ff8c00; border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: bold;">📷 Pornește Camera</button>
                    <button type="button" onclick="deletePhoto(${clientId})" style="flex: 1; padding: 10px; background: #ff6b6b; border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: bold;">🗑️ Șterge Foto</button>
                </div>
                <button type="button" id="captureEditBtn" onclick="editCapturePhoto(${clientId})" style="width: 100%; padding: 10px; background: #00ff88; color: black; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; display: none;">📸 CAPTUREAZĂ FOTO</button>
            </div>

            <p style="color: #ffaa33; font-weight: bold; margin-bottom: 10px;">👤 DATE PERSONALE</p>
            <input type="text" id="editNume" placeholder="Nume" value="${escapeHtml(client.nume)}" style="width: 100%; margin-bottom: 10px; padding: 12px; border: 2px solid #ffaa33; border-radius: 10px; background: rgba(255, 140, 0, 0.1); color: #e0e0e0;">
            <input type="text" id="editPrenume" placeholder="Prenume" value="${escapeHtml(client.prenume)}" style="width: 100%; margin-bottom: 15px; padding: 12px; border: 2px solid #ffaa33; border-radius: 10px; background: rgba(255, 140, 0, 0.1); color: #e0e0e0;">
            
            <p style="color: #00ff88; font-weight: bold; margin: 10px 0 5px 0;">🏷️ TAG CARD NFC</p>
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <input type="text" id="editTag" placeholder="Tag card (NFC)" value="${escapeHtml(client.tag)}" style="flex: 3; padding: 12px; border: 2px solid #00ff88; border-radius: 10px; background: rgba(0, 255, 136, 0.1); color: #0f0; font-family: monospace; font-size: 14px;">
                <button type="button" onclick="scanTagForEdit()" style="flex: 1; padding: 12px; background: #00ff88; color: black; border: none; border-radius: 10px; font-weight: bold;">🔍 Scanează</button>
            </div>

            <p style="color: #6496ff; font-weight: bold; margin: 10px 0 5px 0;">📅 PERIOADA VALABILITATE</p>
            <div style="display: flex; gap: 10px; margin-bottom: 15px; align-items: center;">
                <input type="date" id="editExpiration" value="${formattedExpDate}" style="flex: 2; padding: 12px; border: 2px solid #6496ff; border-radius: 10px; background: rgba(100, 150, 255, 0.1); color: #e0e0e0;">
                <button type="button" onclick="updateExpirationFromDate(${clientId})" style="flex: 1; padding: 12px; background: #6496ff; color: white; border: none; border-radius: 10px; font-weight: bold;">✅ Setează</button>
            </div>

            <div style="background: rgba(100, 150, 255, 0.1); padding: 12px; border-radius: 10px; margin-bottom: 15px; text-align: center;">
                <span style="color: #ffaa33;">ℹ️ Status abonament: </span>
                <strong style="color: ${getStatusColor(client)}">${checkClientAccess(client).message}</strong>
            </div>

            <div class="actions" style="display: flex; gap: 10px; margin-top: 10px;">
                <button type="button" onclick="saveEditClientFull(${clientId})" style="flex: 1; padding: 14px; background: #00ff88; color: black; font-weight: bold; border-radius: 10px;">💾 SALVEAZĂ</button>
                <button type="button" onclick="showClientDetails(${clientId})" style="flex: 1; padding: 14px; background: #6496ff; color: white; font-weight: bold; border-radius: 10px;">❌ ANULEAZĂ</button>
            </div>
        </div>
    `;

    openModal(html);
}

function scanTagForEdit() {
    showNotification('Scanează cardul NFC pentru a prelua tag-ul...', 'success');
    
    const originalOnMessage = nfcSocket.onmessage;
    
    nfcSocket.onmessage = (event) => {
        const tag = event.data.trim().toLowerCase();
        const tagInput = document.getElementById('editTag');
        if (tagInput) {
            tagInput.value = tag;
            showNotification(`Tag preluat: ${tag}`, 'success');
        }
        nfcSocket.onmessage = originalOnMessage;
    };
    
    setTimeout(() => {
        if (nfcSocket.onmessage !== originalOnMessage) {
            nfcSocket.onmessage = originalOnMessage;
        }
    }, 10000);
}

function updateExpirationFromDate(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const newExpiration = document.getElementById('editExpiration').value;
    if (newExpiration) {
        client.expiration = newExpiration;
        const startDate = new Date();
        const expDate = new Date(newExpiration);
        const diffDays = Math.ceil((expDate - startDate) / (1000 * 60 * 60 * 24));
        client.duration = diffDays;
        saveClientsToStorage();
        addToAuditLog('Modificare perioada', `${client.prenume} ${client.nume} - Expira: ${newExpiration}`);
        showNotification(`Perioada actualizata! Expira: ${newExpiration}`, 'success');
        initClientCards();
    }
}

function saveEditClientFull(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const nume = document.getElementById('editNume')?.value.trim() || '';
    const prenume = document.getElementById('editPrenume')?.value.trim() || '';
    const tag = document.getElementById('editTag')?.value.trim().toLowerCase() || '';
    const tempPhoto = localStorage.getItem('tempEditPhoto');

    if (!nume || !prenume) {
        showNotification('Completeaza nume si prenume!', 'error');
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
    addToAuditLog('Editeaza client', `${prenume} ${nume} - Tag: ${tag || 'N/A'}`);
    showNotification(`✅ Client actualizat! Tag: ${tag || 'N/A'}`, 'success');
    
    closeModal();
    initClientCards();
}

function editStartCamera(clientId) {
    const video = document.getElementById('editCameraVideo');
    const startBtn = document.getElementById('startEditCamBtn');
    const captureBtn = document.getElementById('captureEditBtn');
    
    if (!video) return;
    
    if (currentCameraStream) stopCamera();

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
            currentCameraStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';
            video.play().catch(err => console.error('Play error:', err));
            if (startBtn) startBtn.style.display = 'none';
            if (captureBtn) captureBtn.style.display = 'block';
            showNotification('Camera pornita! Apasa Captureaza', 'success');
        })
        .catch(err => {
            console.error('Camera error:', err);
            showNotification('Eroare camera: ' + err.message, 'error');
        });
}

function editCapturePhoto(clientId) {
    const video = document.getElementById('editCameraVideo');
    
    if (!video || !video.videoWidth || !video.videoHeight) {
        showNotification('Camera nu este gata! Asteapta 2 secunde...', 'error');
        return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    const photoData = canvas.toDataURL('image/jpeg');
    const preview = document.getElementById('editPhotoPreview');
    if (preview) {
        preview.innerHTML = `<img src="${photoData}" style="width: 100%; height: 100%; object-fit: cover;">`;
    }
    
    video.style.display = 'none';
    const startBtn = document.getElementById('startEditCamBtn');
    const captureBtn = document.getElementById('captureEditBtn');
    if (startBtn) startBtn.style.display = 'block';
    if (captureBtn) captureBtn.style.display = 'none';
    
    localStorage.setItem('tempEditPhoto', photoData);
    stopCamera();
    showNotification('Fotografia capturata!', 'success');
}

function deletePhoto(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (client) {
        client.photo = '';
        const preview = document.getElementById('editPhotoPreview');
        if (preview) preview.innerHTML = '<span style="color: #888;">📷 Fără fotografie</span>';
        localStorage.removeItem('tempEditPhoto');
        saveClientsToStorage();
        showNotification('Fotografia stearsa!', 'success');
    }
}

// ════════════════════════════════════════════════════════════════════
// 📊 REPORTS - VERSIUNE ÎMBUNĂTĂȚITĂ
// ════════════════════════════════════════════════════════════════════

function openReports() {
    if (!isLoggedIn) {
        showNotification('Trebuie sa fii conectat!', 'error');
        return;
    }
    
    addToAuditLog('Deschide Rapoarte');
    
    const reportsHTML = `
        <div class="box scroll-box" style="width: 900px; max-width: 95%;">
            <h2 style="color: #ffaa33; margin-bottom: 25px;">📊 RAPOARTE AVANSATE</h2>
            
            <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                <button onclick="switchReportsTab('subscriptions')" class="report-tab active" style="flex: 1; min-width: 110px; padding: 12px; background: #ff8c00; color: white; border: none; border-radius: 10px; cursor: pointer; font-weight: bold;">📈 Abonamente</button>
                <button onclick="switchReportsTab('today')" class="report-tab" style="flex: 1; min-width: 110px; padding: 12px; background: transparent; border: 2px solid #ffaa33; border-radius: 10px; cursor: pointer; color: #ffaa33; font-weight: bold;">📅 Astăzi</button>
                <button onclick="switchReportsTab('activity')" class="report-tab" style="flex: 1; min-width: 110px; padding: 12px; background: transparent; border: 2px solid #ffaa33; border-radius: 10px; cursor: pointer; color: #ffaa33; font-weight: bold;">🕒 Activitate</button>
                <button onclick="switchReportsTab('subscriptionsCreated')" class="report-tab" style="flex: 1; min-width: 110px; padding: 12px; background: transparent; border: 2px solid #ffaa33; border-radius: 10px; cursor: pointer; color: #ffaa33; font-weight: bold;">📋 Abonamente Create</button>
            </div>
            
            <div id="subscriptions-report" class="report-content" style="display: block;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">📊 Statistici Abonamente Active</h3>
                <div id="activeSubscriptionsStats" style="background: rgba(100, 150, 255, 0.1); padding: 15px; border-radius: 12px; margin-bottom: 15px;"></div>
                <div id="activeSubscriptionsList" style="max-height: 300px; overflow-y: auto;"></div>
            </div>
            
            <div id="today-report" class="report-content" style="display: none;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">📅 Raport Zilnic - ${getTodayDate()}</h3>
                <div id="todayStats" style="background: rgba(100, 150, 255, 0.1); padding: 15px; border-radius: 12px; margin-bottom: 15px;"></div>
                <div id="todaySubscriptionsList" style="max-height: 300px; overflow-y: auto;"></div>
            </div>
            
            <div id="activity-report" class="report-content" style="display: none; max-height: 350px; overflow-y: auto;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">🕒 Ultimele Actiuni</h3>
                <div id="activityList"></div>
            </div>
            
            <div id="subscriptionsCreated-report" class="report-content" style="display: none;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">📋 Raport Abonamente Create</h3>
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                    <select id="subsReportPeriod" onchange="filterSubscriptionsReport()" style="padding: 10px; border-radius: 8px; background: #1a1a2e; color: white;">
                        <option value="today">Astăzi</option>
                        <option value="week">Săptămâna aceasta</option>
                        <option value="month">Luna aceasta</option>
                        <option value="all">Toate</option>
                    </select>
                    <button onclick="exportSubscriptionsReport()" style="padding: 10px 20px; background: #00ff88; color: black;">📥 Exportă CSV</button>
                </div>
                <div id="subscriptionsCreatedList" style="max-height: 350px; overflow-y: auto;"></div>
                <div id="subscriptionsCreatedTotal" style="background: rgba(255, 140, 0, 0.2); padding: 12px; border-radius: 10px; margin-top: 15px; text-align: center; font-weight: bold;"></div>
            </div>
            
            <div class="actions" style="margin-top: 20px;">
                <button onclick="exportFullReport()" style="flex: 1; background: #00ff88; color: black; font-size: 14px; font-weight: bold;">📥 Exportă Raport Complet</button>
                <button onclick="closeModal()" style="flex: 1; background: #6496ff; font-size: 14px; font-weight: bold;">❌ Închide</button>
            </div>
        </div>
    `;
    
    openModal(reportsHTML);
    renderActiveSubscriptionsReport();
    renderTodayReport();
    renderActivityReport();
    renderSubscriptionsCreatedReport();
}

function switchReportsTab(tab) {
    document.querySelectorAll('.report-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.report-tab').forEach(el => {
        el.style.background = 'transparent';
        el.style.color = '#ffaa33';
        el.style.border = '2px solid #ffaa33';
    });
    
    const tabElement = document.getElementById(`${tab}-report`);
    if (tabElement) tabElement.style.display = 'block';
    
    if (event && event.target) {
        event.target.style.background = '#ff8c00';
        event.target.style.color = 'white';
        event.target.style.border = 'none';
    }
    
    if (tab === 'subscriptions') renderActiveSubscriptionsReport();
    if (tab === 'today') renderTodayReport();
    if (tab === 'activity') renderActivityReport();
    if (tab === 'subscriptionsCreated') renderSubscriptionsCreatedReport();
}

function renderActiveSubscriptionsReport() {
    const activeClients = clients.filter(c => checkClientAccess(c).allowed);
    const expiredClients = clients.filter(c => !checkClientAccess(c).allowed);
    
    const statsHtml = `
        <p><strong>✅ Abonamente active:</strong> ${activeClients.length}</p>
        <p><strong>❌ Abonamente expirate:</strong> ${expiredClients.length}</p>
        <p><strong>📊 Total clienți:</strong> ${clients.length}</p>
    `;
    
    const listHtml = activeClients.map(client => `
        <div class="client-card ${getStatusClass(client)}" style="margin-bottom: 8px; cursor: pointer;" onclick="showClientDetails(${client.id})">
            <div style="min-width: 50px;">
                ${client.photo ? `<img src="${client.photo}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">` : '<div style="width: 50px; height: 50px; background: #333; border-radius: 8px; display: flex; align-items: center; justify-content: center;">👤</div>'}
            </div>
            <div style="flex: 1;">
                <p style="font-weight: bold; margin: 0;">${client.prenume} ${client.nume}</p>
                <p style="font-size: 11px; margin: 2px 0;">📅 Expiră: ${new Date(client.expiration).toLocaleDateString('ro-RO')}</p>
                <p style="font-size: 10px; color: ${getStatusColor(client)};">${checkClientAccess(client).message}</p>
            </div>
        </div>
    `).join('');
    
    document.getElementById('activeSubscriptionsStats').innerHTML = statsHtml;
    document.getElementById('activeSubscriptionsList').innerHTML = listHtml || '<p style="color: #888;">Niciun abonament activ</p>';
}

function renderTodayReport() {
    const todayStr = getTodayDate();
    const todayCreated = clients.filter(c => c.createdAt && c.createdAt.startsWith(todayStr));
    const todayActivity = auditLog.filter(log => log.timestamp.startsWith(todayStr));
    
    const statsHtml = `
        <p><strong>📊 Abonamente create azi:</strong> ${todayCreated.length}</p>
        <p><strong>🕒 Acțiuni înregistrate azi:</strong> ${todayActivity.length}</p>
        <p><strong>🏋️ Clienți în sală acum:</strong> ${clients.filter(c => c.isInGym === true && c.nfcScansToday === 1).length}</p>
    `;
    
    const listHtml = todayCreated.map(client => `
        <div class="client-card" style="margin-bottom: 8px;">
            <div style="flex: 1;">
                <p style="font-weight: bold; margin: 0;">${client.prenume} ${client.nume}</p>
                <p style="font-size: 11px; margin: 2px 0;">📦 ${SUBSCRIPTIONS[client.subscription]?.name || client.subscription}</p>
                <p style="font-size: 10px; color: #6496ff;">👤 Creat de: ${client.createdBy || 'N/A'}</p>
            </div>
        </div>
    `).join('');
    
    document.getElementById('todayStats').innerHTML = statsHtml;
    document.getElementById('todaySubscriptionsList').innerHTML = listHtml || '<p style="color: #888;">Niciun abonament creat azi</p>';
}

function renderActivityReport() {
    const container = document.getElementById('activityList');
    if (!container) return;
    
    const recentLogs = auditLog.slice(-30).reverse();
    container.innerHTML = recentLogs.map(log => `
        <div style="padding: 10px; border-bottom: 1px solid #333; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
                <span style="color: #ffaa33;"><strong>${new Date(log.timestamp).toLocaleString('ro-RO')}</strong></span>
                <span style="background: ${log.userRole === 'admin' ? '#ff8c00' : log.userRole === 'manager' ? '#6496ff' : '#00ff88'}; color: black; padding: 2px 8px; border-radius: 5px; font-size: 10px;">${log.userRole}</span>
            </div>
            <p style="margin: 5px 0; color: #00ff88;">👤 ${log.user}</p>
            <p style="margin: 0; color: #fff;">📌 ${log.action}</p>
            ${log.details ? `<p style="margin: 3px 0; color: #888; font-size: 11px;">📝 ${log.details}</p>` : ''}
        </div>
    `).join('');
}

function renderSubscriptionsCreatedReport() {
    const period = document.getElementById('subsReportPeriod')?.value || 'today';
    const now = new Date();
    let filtered = [...clients];
    
    if (period === 'today') {
        const todayStr = getTodayDate();
        filtered = clients.filter(c => c.createdAt && c.createdAt.startsWith(todayStr));
    } else if (period === 'week') {
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        filtered = clients.filter(c => c.createdAt && new Date(c.createdAt) >= weekAgo);
    } else if (period === 'month') {
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        filtered = clients.filter(c => c.createdAt && new Date(c.createdAt) >= monthAgo);
    }
    
    const summary = {};
    filtered.forEach(c => {
        const subName = SUBSCRIPTIONS[c.subscription]?.name || c.subscription;
        summary[subName] = (summary[subName] || 0) + 1;
    });
    
    const listHtml = filtered.map(client => `
        <div class="client-card" style="margin-bottom: 8px;">
            <div style="flex: 1;">
                <p style="font-weight: bold; margin: 0;">${client.prenume} ${client.nume}</p>
                <p style="font-size: 11px; margin: 2px 0;">📦 ${SUBSCRIPTIONS[client.subscription]?.name || client.subscription}</p>
                <p style="font-size: 10px; color: #6496ff;">📅 Creat: ${new Date(client.createdAt).toLocaleDateString('ro-RO')} | 👤 ${client.createdBy || 'N/A'}</p>
            </div>
        </div>
    `).join('');
    
    const summaryHtml = Object.entries(summary).map(([name, count]) => 
        `<span style="display: inline-block; background: rgba(255, 140, 0, 0.2); padding: 5px 12px; border-radius: 20px; margin: 5px;">${name}: ${count}</span>`
    ).join('');
    
    document.getElementById('subscriptionsCreatedList').innerHTML = listHtml || '<p style="color: #888;">Nu există abonamente în perioada selectată</p>';
    document.getElementById('subscriptionsCreatedTotal').innerHTML = `<strong>📊 Total abonamente: ${filtered.length}</strong><br>${summaryHtml}`;
}

function filterSubscriptionsReport() {
    renderSubscriptionsCreatedReport();
}

function exportSubscriptionsReport() {
    const period = document.getElementById('subsReportPeriod')?.value || 'today';
    let filtered = [...clients];
    
    if (period === 'today') {
        const todayStr = getTodayDate();
        filtered = clients.filter(c => c.createdAt && c.createdAt.startsWith(todayStr));
    } else if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filtered = clients.filter(c => c.createdAt && new Date(c.createdAt) >= weekAgo);
    } else if (period === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filtered = clients.filter(c => c.createdAt && new Date(c.createdAt) >= monthAgo);
    }
    
    const csv = [['Nume', 'Prenume', 'Abonament', 'Data creare', 'Creat de', 'Expirare'].join(',')];
    filtered.forEach(c => {
        csv.push([
            `"${c.nume}"`,
            `"${c.prenume}"`,
            `"${SUBSCRIPTIONS[c.subscription]?.name || c.subscription}"`,
            `"${new Date(c.createdAt).toLocaleDateString('ro-RO')}"`,
            `"${c.createdBy || 'N/A'}"`,
            `"${new Date(c.expiration).toLocaleDateString('ro-RO')}"`
        ].join(','));
    });
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `abonamente_${period}_${getTodayDate()}.csv`;
    a.click();
    showNotification('Raport exportat!', 'success');
}

function exportFullReport() {
    const reportData = {
        generated: new Date().toISOString(),
        generatedBy: currentUser,
        totalClients: clients.length,
        activeSubscriptions: clients.filter(c => checkClientAccess(c).allowed).length,
        clientsInGym: clients.filter(c => c.isInGym === true).length,
        subscriptionsByType: Object.keys(SUBSCRIPTIONS).reduce((acc, key) => {
            acc[SUBSCRIPTIONS[key].name] = clients.filter(c => c.subscription === key).length;
            return acc;
        }, {}),
        recentAuditLog: auditLog.slice(-50)
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raport_complet_${getTodayDate()}.json`;
    link.click();
    addToAuditLog('Export raport complet', 'Raport complet exportat');
    showNotification('Raport complet exportat!', 'success');
}

// ════════════════════════════════════════════════════════════════════
// 🎴 CLIENT CARDS DISPLAY - CARDURI MĂRITE
// ════════════════════════════════════════════════════════════════════

function initClientCards() {
    if (!isLoggedIn) {
        document.getElementById('entryList').innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">🔐 Conectează-te pentru a vedea clienții</p>';
        document.getElementById('exitList').innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">🔐 Conectează-te pentru a vedea clienții</p>';
        document.getElementById('gymList').innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">🔐 Conectează-te pentru a vedea clienții</p>';
        document.getElementById('gymCount').textContent = '0';
        return;
    }

    // INTRARE
    const entryClients = clients.filter(c => c.nfcScansToday === 1 || c.nfcScansToday >= 3);
    const sortedEntry = [...entryClients].sort((a, b) => (b.lastScanTimestamp || 0) - (a.lastScanTimestamp || 0));
    const latestEntry = sortedEntry[0];
    
    const entryList = document.getElementById('entryList');
    if (!latestEntry) {
        entryList.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">⏳ Niciun client la intrare</p>';
    } else {
        const daysLeft = getDaysLeft(latestEntry.expiration);
        const expDate = new Date(latestEntry.expiration).toLocaleDateString('ro-RO');
        const isReEntry = latestEntry.nfcScansToday >= 3;
        entryList.innerHTML = `
            <div class="client-card-large ${isReEntry ? 'warning' : 'active'}" onclick="onClientClick(${latestEntry.id}, true)" style="cursor: pointer; margin-bottom: 12px; padding: 20px; display: flex; gap: 20px; align-items: center;">
                <div style="min-width: 100px;">
                    ${latestEntry.photo ? `<img src="${latestEntry.photo}" style="width: 100px; height: 100px; border-radius: 15px; border: 3px solid ${isReEntry ? '#ffaa00' : '#00ff88'}; object-fit: cover;">` : '<div style="width: 100px; height: 100px; background: linear-gradient(145deg, #2c3e66, #1a2a4a); border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 48px;">👤</div>'}
                </div>
                <div style="flex: 1;">
                    <p style="font-weight: bold; font-size: 22px; margin: 0; color: #fff;">${latestEntry.prenume} ${latestEntry.nume}</p>
                    <p style="font-size: 14px; color: ${isReEntry ? '#ffaa00' : '#00ff88'}; margin: 8px 0; font-weight: bold;">${isReEntry ? '⚠️ REINTRARE' : '✅ INTRARE'}</p>
                    <p style="font-size: 13px; color: #ffaa33; margin: 5px 0;">📅 Expiră: ${expDate} (${daysLeft} zile)</p>
                    <p style="font-size: 12px; color: #888; margin: 3px 0;">🏷️ Tag: ${latestEntry.tag || 'N/A'}</p>
                </div>
            </div>
        `;
    }

    // IEȘIRE
    const exitClients = clients.filter(c => c.nfcScansToday === 2 && c.isInGym === false);
    const sortedExit = [...exitClients].sort((a, b) => (b.lastScanTimestamp || 0) - (a.lastScanTimestamp || 0));
    const latestExit = sortedExit[0];
    
    const exitList = document.getElementById('exitList');
    if (!latestExit) {
        exitList.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">⏳ Niciun client la ieșire</p>';
    } else {
        const daysLeft = getDaysLeft(latestExit.expiration);
        const expDate = new Date(latestExit.expiration).toLocaleDateString('ro-RO');
        exitList.innerHTML = `
            <div class="client-card-large" onclick="onClientClick(${latestExit.id}, false)" style="cursor: pointer; margin-bottom: 12px; padding: 20px; display: flex; gap: 20px; align-items: center; background: linear-gradient(145deg, rgba(45, 47, 59, 0.9), rgba(30, 41, 59, 0.9)); border-left: 8px solid #6496ff; border-radius: 16px;">
                <div style="min-width: 100px;">
                    ${latestExit.photo ? `<img src="${latestExit.photo}" style="width: 100px; height: 100px; border-radius: 15px; border: 3px solid #6496ff; object-fit: cover;">` : '<div style="width: 100px; height: 100px; background: linear-gradient(145deg, #2c3e66, #1a2a4a); border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 48px;">👤</div>'}
                </div>
                <div style="flex: 1;">
                    <p style="font-weight: bold; font-size: 22px; margin: 0; color: #fff;">${latestExit.prenume} ${latestExit.nume}</p>
                    <p style="font-size: 14px; color: #6496ff; margin: 8px 0; font-weight: bold;">❌ IEȘIRE</p>
                    <p style="font-size: 13px; color: #ffaa33; margin: 5px 0;">📅 Expiră: ${expDate} (${daysLeft} zile)</p>
                    <p style="font-size: 12px; color: #888; margin: 3px 0;">🏷️ Tag: ${latestExit.tag || 'N/A'}</p>
                </div>
            </div>
        `;
    }

    // CLIENȚI ÎN SALĂ
    const inGymClients = clients.filter(c => c.isInGym === true && c.nfcScansToday === 1);
    const gymList = document.getElementById('gymList');
    if (inGymClients.length === 0) {
        gymList.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">🏋️ Sala este goală</p>';
    } else {
        gymList.innerHTML = inGymClients.map(client => {
            const checkInTime = clientCheckIns[client.id] ? new Date(clientCheckIns[client.id]).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
            const daysLeft = getDaysLeft(client.expiration);
            const expDate = new Date(client.expiration).toLocaleDateString('ro-RO');
            return `
                <div class="client-card ${getStatusClass(client)}" onclick="onClientClick(${client.id}, false)" style="cursor: pointer; margin-bottom: 12px; padding: 15px; display: flex; gap: 15px; align-items: center;">
                    <div style="min-width: 70px;">
                        ${client.photo ? `<img src="${client.photo}" style="width: 70px; height: 70px; border-radius: 12px; border: 2px solid ${getStatusColor(client)}; object-fit: cover;">` : '<div style="width: 70px; height: 70px; background: #333; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 32px;">👤</div>'}
                    </div>
                    <div style="flex: 1;">
                        <p style="font-weight: bold; font-size: 16px; margin: 0; color: #fff;">${client.prenume} ${client.nume}</p>
                        <p style="font-size: 12px; color: #00ff88; margin: 5px 0;">⏰ Intrat la: ${checkInTime}</p>
                        <p style="font-size: 11px; color: #ffaa33; margin: 2px 0;">📅 Expiră: ${expDate} (${daysLeft} zile)</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    document.getElementById('gymCount').textContent = inGymClients.length;
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

// ════════════════════════════════════════════════════════════════════
// ✅ CHECK IN
// ════════════════════════════════════════════════════════════════════

function showCheckInModal(client) {
    const subInfo = SUBSCRIPTIONS[client.subscription];
    const html = `
        <div class="box" style="text-align: center; width: 400px;">
            <h2 style="color: #00ff88;">✅ ACCES PERMIS</h2>
            <div style="margin: 20px 0;">
                ${client.photo ? `<img src="${client.photo}" style="width: 120px; height: 120px; border-radius: 60px; object-fit: cover; margin-bottom: 15px;">` : ''}
                <p style="font-size: 24px; color: #ffaa33; margin: 10px 0;">${client.prenume} ${client.nume}</p>
                <p style="margin: 10px 0;"><strong>📦 Abonament:</strong> ${subInfo.name}</p>
                <p style="margin: 5px 0;"><strong>📅 Expiră:</strong> ${new Date(client.expiration).toLocaleDateString('ro-RO')}</p>
            </div>
            <div class="actions" style="display: flex; gap: 10px;">
                <button onclick="confirmCheckIn(${client.id})" style="flex: 1; background: #00ff88; color: black;">✅ Confirmă Intrare</button>
                <button onclick="showClientDetails(${client.id})" style="flex: 1;">📋 Detalii</button>
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
    clientCheckIns[client.id] = new Date().toISOString();
    saveClientsToStorage();
    saveCheckIns();
    addToAuditLog('Intrare client (manuală)', `${client.prenume} ${client.nume}`);
    showNotification(`${client.prenume} - Intrare înregistrată!`, 'success');
    closeModal();
    initClientCards();
}

// ════════════════════════════════════════════════════════════════════
// 📋 CLIENT DETAILS
// ════════════════════════════════════════════════════════════════════

function showClientDetails(clientOrId) {
    const client = typeof clientOrId === 'number' ? clients.find(c => c.id === clientOrId) : clientOrId;
    if (!client) return;

    const subInfo = SUBSCRIPTIONS[client.subscription];
    const daysLeft = getDaysLeft(client.expiration);
    const access = checkClientAccess(client);
    const statusColor = getStatusColor(client);

    const html = `
        <div class="box scroll-box" style="width: 480px; max-width: 95%;">
            <h2 style="color: #ffaa33;">📋 ${client.prenume} ${client.nume}</h2>
            
            <div style="text-align: center; margin-bottom: 15px;">
                ${client.photo ? `<img src="${client.photo}" style="width: 150px; height: 150px; border-radius: 20px; object-fit: cover; border: 3px solid ${statusColor}; margin-bottom: 10px;">` : '<div style="width: 150px; height: 150px; background: linear-gradient(145deg, #2c3e66, #1a2a4a); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px auto; font-size: 60px;">👤</div>'}
            </div>
            
            <div style="background: rgba(100, 150, 255, 0.1); padding: 15px; border-radius: 12px; margin-bottom: 15px; font-size: 14px;">
                <p><strong>📦 Abonament:</strong> ${subInfo.name}</p>
                <p><strong>📅 Expiră:</strong> ${new Date(client.expiration).toLocaleDateString('ro-RO')}</p>
                <p><strong>⏳ Zile rămase:</strong> ${daysLeft >= 0 ? daysLeft : 0}</p>
                <p><strong>📊 Status:</strong> <span style="color: ${statusColor};">${access.message}</span></p>
                <p><strong>🏷️ Tag:</strong> <span style="font-family: monospace;">${client.tag || 'N/A'}</span></p>
                <p><strong>👤 Creat de:</strong> ${client.createdBy || 'N/A'}</p>
                <p><strong>📅 Creat la:</strong> ${new Date(client.createdAt).toLocaleDateString('ro-RO')}</p>
            </div>

            <div class="actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="editClient(${client.id})" style="flex: 1; min-width: 80px;">✏️ Editează</button>
                <button onclick="togglePaid(${client.id})" style="flex: 1; min-width: 80px;">💰 Plată: ${client.isPaid ? 'Da' : 'Nu'}</button>
                <button onclick="resetUsage(${client.id})" style="flex: 1; min-width: 80px;">🔄 Reset Zi</button>
                <button onclick="deleteClient(${client.id})" style="flex: 1; min-width: 80px;">🗑️ Șterge</button>
                <button onclick="closeModal()" style="flex: 1; min-width: 80px;">❌ Închide</button>
            </div>
        </div>
    `;

    openModal(html);
}

// ════════════════════════════════════════════════════════════════════
// 🔧 BACKUP & RESTORE FUNCTIONS
// ════════════════════════════════════════════════════════════════════

function exportClientsJSON() {
    const dataStr = JSON.stringify(clients, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-backup-${getTodayDate()}.json`;
    link.click();
    showNotification(`${clients.length} clienți exportați!`, 'success');
}

function importClientsJSON() {
    const file = document.getElementById('importFile').files[0];
    if (!file) {
        showNotification('Selectează un fișier!', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (confirm(`Înlocuiești ${clients.length} clienți cu ${imported.length}?`)) {
                clients = imported;
                saveClientsToStorage();
                showNotification(`${imported.length} clienți importați!`, 'success');
                closeModal();
                initClientCards();
            }
        } catch (err) {
            showNotification(`Eroare: ${err.message}`, 'error');
        }
    };
    reader.readAsText(file);
}

function clearAuditLog() {
    if (confirm('Ștergi TOATE jurnalele?')) {
        auditLog = [];
        saveAuditLog();
        showNotification('Jurnal șters!', 'success');
        closeModal();
        openSettings();
    }
}

function deleteExpiredClients() {
    const expired = clients.filter(c => getDaysLeft(c.expiration) < 0);
    if (expired.length === 0) {
        showNotification('Nu sunt clienți expirați!', 'success');
        return;
    }
    if (confirm(`Ștergi ${expired.length} clienți expirați?`)) {
        clients = clients.filter(c => getDaysLeft(c.expiration) >= 0);
        saveClientsToStorage();
        showNotification(`${expired.length} clienți șterși!`, 'success');
        closeModal();
        initClientCards();
    }
}

function resetAllUsedToday() {
    if (confirm('Resetezi utilizarea pentru TOȚI clienții?')) {
        clients.forEach(c => c.usedToday = false);
        clientCheckIns = {};
        saveClientsToStorage();
        saveCheckIns();
        showNotification('Clienți resetați!', 'success');
        closeModal();
        initClientCards();
    }
}

function deleteAllClients() {
    if (confirm('ȘTERGI TOȚI CLIENTII? Scrie CONFIRM:')) {
        const conf = prompt('Scrie CONFIRM:');
        if (conf === 'CONFIRM') {
            clients = [];
            clientCheckIns = {};
            saveClientsToStorage();
            saveCheckIns();
            showNotification('Toți clienții șterși!', 'success');
            closeModal();
            initClientCards();
        }
    }
}

function togglePaid(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    client.isPaid = !client.isPaid;
    saveClientsToStorage();
    addToAuditLog('Setare plată', `${client.prenume} ${client.nume}: ${client.isPaid ? 'PLĂTIT' : 'NEACHITAT'}`);
    showNotification(client.isPaid ? '✅ Marcat ca plătit!' : '❌ Marcat ca neachitat!', 'success');
    closeModal();
    initClientCards();
}

function resetUsage(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (confirm('Resetezi utilizarea de azi pentru acest client?')) {
        client.usedToday = false;
        if (clientCheckIns[client.id]) delete clientCheckIns[client.id];
        saveClientsToStorage();
        saveCheckIns();
        addToAuditLog('Reset utilizare', `${client.prenume} ${client.nume}`);
        showNotification('Utilizare resetată!', 'success');
        closeModal();
        initClientCards();
    }
}

function deleteClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (confirm(`Ștergi pe ${client.prenume} ${client.nume}?`)) {
        clients = clients.filter(c => c.id !== clientId);
        if (clientCheckIns[client.id]) delete clientCheckIns[client.id];
        saveClientsToStorage();
        saveCheckIns();
        addToAuditLog('Șterge client', `${client.prenume} ${client.nume}`);
        showNotification('Client șters!', 'success');
        closeModal();
        initClientCards();
    }
}

// ════════════════════════════════════════════════════════════════════
// 📋 CHECK ACCESS & VALIDATION
// ════════════════════════════════════════════════════════════════════

function checkClientAccess(client) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const expirationDate = new Date(client.expiration);
    const subInfo = SUBSCRIPTIONS[client.subscription];
    
    if (!subInfo) {
        return { allowed: false, message: 'Abonament invalid', status: 'expired' };
    }

    if (!client.isPaid) {
        return { allowed: false, message: 'Neachitat', status: 'expired' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expirationDate.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) {
        return { allowed: false, message: 'Expirat', status: 'expired' };
    }

    if (daysLeft <= 3) {
        return { allowed: true, message: `Expiră în ${daysLeft} zile`, status: 'warning', daysLeft };
    }

    if (currentHour < subInfo.startHour || currentHour >= subInfo.endHour) {
        return { allowed: false, message: 'În afara programului', status: 'expired' };
    }

    return { allowed: true, message: 'Acces permis', status: 'active' };
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

// ════════════════════════════════════════════════════════════════════
// 🔌 INITIALIZATION
// ════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    resetDailyUsageIfNeeded();
    initClientCards();
    
    setInterval(() => {
        resetDailyUsageIfNeeded();
        initClientCards();
    }, 60000);
    
    console.log('✅ GYM CORE SYSTEM v6.0 Ready!');
    console.log('Demo: admin/1234 | manager/1234 | staff/1234');
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeAllModals();
    }
});