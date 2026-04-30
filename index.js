// ╔═══════════════════════════════════════════════════════════════════╗
// ║                     GYM CORE SYSTEM - v5.0                        ║
// ║                    FULL FIX - ALL BUGS RESOLVED                   ║
// ╚═══════════════════════════════════════════════════════════════════╝

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

let scannedCardNumber = '';
let cardReaderBuffer = '';

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
    if (auditLog.length > 1000) auditLog = auditLog.slice(-500);
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
    
    if (addModal) addModal.classList.remove('active');
    if (searchModal) searchModal.classList.remove('active');
    if (loginModal) loginModal.classList.remove('active');
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
        addToAuditLog('Login', `User: ${user}`);
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
    document.getElementById('tag').value = '';
    document.getElementById('preview').style.display = 'none';
    document.getElementById('video').style.display = 'block';
    localStorage.removeItem('tempPhoto');
}

function startCamera() {
    const video = document.getElementById('video');
    if (!video) return;
    
    if (currentCameraStream) stopCamera();

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => {
            currentCameraStream = stream;
            video.srcObject = stream;
            video.style.display = 'block';
            video.play();
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

function saveClient() {
    const nume = document.getElementById('name').value.trim();
    const prenume = document.getElementById('surname').value.trim();
    const subscription = document.getElementById('subscription').value;
    const tag = document.getElementById('tag').value.trim();
    const photo = localStorage.getItem('tempPhoto') || '';

    if (!nume) {
        showNotification('Completeaza NUME!', 'error');
        return;
    }
    if (!prenume) {
        showNotification('Completeaza PRENUME!', 'error');
        return;
    }
    if (!subscription) {
        showNotification('Selecteaza ABONAMENT!', 'error');
        return;
    }

    const today = new Date();
    const subInfo = SUBSCRIPTIONS[subscription];
    const expirationDate = new Date(today);
    expirationDate.setDate(expirationDate.getDate() + subInfo.duration);

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
        duration: subInfo.duration
    };

    clients.push(newClient);
    saveClientsToStorage();
    addToAuditLog('Adauga client', `${prenume} ${nume}`);
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
        c.tag.toLowerCase().includes(searchTerm)
    );

    if (results.length === 0) {
        resultsDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Niciun rezultat</p>';
        return;
    }

    resultsDiv.innerHTML = results.map(client => `
        <div class="client-card" onclick="searchSelectClient(${client.id})" style="cursor: pointer; margin-bottom: 10px;">
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

// ════════════════════════════════════════════════════════════════════
// ⚙️ SETTINGS
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
        <div class="box scroll-box" style="width: 650px; max-width: 95%;">
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
            
            <div id="audit-tab" class="settings-content" style="display: none; max-height: 300px; overflow-y: auto;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">Jurnal Audit</h3>
                ${auditLog.length === 0 ? '<p style="color: #888;">Niciun jurnal</p>' : auditLog.slice(-30).reverse().map(log => `
                    <div style="padding: 8px; border-bottom: 1px solid #333; font-size: 11px;">
                        <strong style="color: #ffaa33;">${new Date(log.timestamp).toLocaleTimeString('ro-RO')}</strong> - 
                        <span style="color: #00ff88;">${log.user}</span> - 
                        <span style="color: #fff;">${log.action}</span>
                    </div>
                `).join('')}
                <button onclick="clearAuditLog()" style="width: 100%; padding: 10px; background: #ff6b6b; color: white; border: none; border-radius: 8px; cursor: pointer; margin-top: 10px; font-weight: bold;">Sterge Log</button>
            </div>
            
            <div id="users-tab" class="settings-content" style="display: none;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">Utilizatori Activi</h3>
                ${users.map(user => `
                    <div style="padding: 10px; border-bottom: 1px solid #333; display: flex; justify-content: space-between;">
                        <div>
                            <p style="margin: 0; font-weight: bold; color: #ffaa33;">${user.name}</p>
                            <p style="margin: 5px 0 0 0; font-size: 11px; color: #888;">${user.username}</p>
                        </div>
                        <span style="background: ${user.role === 'admin' ? '#ff8c00' : user.role === 'manager' ? '#6496ff' : '#00ff88'}; color: black; padding: 5px 10px; border-radius: 5px; font-size: 11px; font-weight: bold;">${user.role}</span>
                    </div>
                `).join('')}
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
}

function exportClientsJSON() {
    const dataStr = JSON.stringify(clients, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gym-backup-${getTodayDate()}.json`;
    link.click();
    showNotification(`${clients.length} clienti exportati!`, 'success');
}

function importClientsJSON() {
    const file = document.getElementById('importFile').files[0];
    if (!file) {
        showNotification('Selecteaza un fisier!', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (confirm(`Inlocuiesti ${clients.length} clienti cu ${imported.length}?`)) {
                clients = imported;
                saveClientsToStorage();
                showNotification(`${imported.length} clienti importati!`, 'success');
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
    if (confirm('Stergi TOATE jurnalele?')) {
        auditLog = [];
        saveAuditLog();
        showNotification('Jurnal sters!', 'success');
        closeModal();
        openSettings();
    }
}

function deleteExpiredClients() {
    const expired = clients.filter(c => getDaysLeft(c.expiration) < 0);
    if (expired.length === 0) {
        showNotification('Nu sunt clienti expirati!', 'success');
        return;
    }
    if (confirm(`Stergi ${expired.length} clienti expirati?`)) {
        clients = clients.filter(c => getDaysLeft(c.expiration) >= 0);
        saveClientsToStorage();
        showNotification(`${expired.length} clienti stersi!`, 'success');
        closeModal();
        initClientCards();
    }
}

function resetAllUsedToday() {
    if (confirm('Reset utilizare pentru TOTI clientii?')) {
        clients.forEach(c => c.usedToday = false);
        clientCheckIns = {};
        saveClientsToStorage();
        saveCheckIns();
        showNotification('Clienti resetati!', 'success');
        closeModal();
        initClientCards();
    }
}

function deleteAllClients() {
    if (confirm('STERGI TOTI CLIENTII? Scrie CONFIRM:')) {
        const conf = prompt('Scrie CONFIRM:');
        if (conf === 'CONFIRM') {
            clients = [];
            clientCheckIns = {};
            saveClientsToStorage();
            saveCheckIns();
            showNotification('Toti clientii stersi!', 'success');
            closeModal();
            initClientCards();
        }
    }
}

// ════════════════════════════════════════════════════════════════════
// 📊 REPORTS
// ════════════════════════════════════════════════════════════════════

function openReports() {
    if (!isLoggedIn) {
        showNotification('Trebuie sa fii conectat!', 'error');
        return;
    }
    
    addToAuditLog('Deschide Rapoarte');
    
    const reportsHTML = `
        <div class="box scroll-box" style="width: 850px; max-width: 95%;">
            <h2 style="color: #ffaa33; margin-bottom: 25px;">RAPOARTE AVANSATE</h2>
            
            <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
                <button onclick="switchReportsTab('subscriptions')" class="report-tab active" style="flex: 1; min-width: 110px; padding: 10px; background: #ff8c00; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Abonamente</button>
                <button onclick="switchReportsTab('today')" class="report-tab" style="flex: 1; min-width: 110px; padding: 10px; background: transparent; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; color: #ffaa33; font-weight: bold;">Astazi</button>
                <button onclick="switchReportsTab('activity')" class="report-tab" style="flex: 1; min-width: 110px; padding: 10px; background: transparent; border: 2px solid #ffaa33; border-radius: 8px; cursor: pointer; color: #ffaa33; font-weight: bold;">Activitate</button>
            </div>
            
            <div id="subscriptions-report" class="report-content" style="display: block;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">Statistici Abonamente</h3>
                <div style="background: rgba(100, 150, 255, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <p><strong>Total abonamente:</strong> ${clients.length}</p>
                    <p><strong>Elevi Standard:</strong> ${clients.filter(c => c.subscription === 'elev_standard').length}</p>
                    <p><strong>Elevi Full:</strong> ${clients.filter(c => c.subscription === 'elev_full').length}</p>
                    <p><strong>Adulti Standard:</strong> ${clients.filter(c => c.subscription === 'adult_standard').length}</p>
                    <p><strong>Adulti Full:</strong> ${clients.filter(c => c.subscription === 'adult_full').length}</p>
                    <p><strong>2 Saptamani:</strong> ${clients.filter(c => c.subscription === '2weeks').length}</p>
                </div>
            </div>
            
            <div id="today-report" class="report-content" style="display: none;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">Raport Zilei</h3>
                <div style="background: rgba(100, 150, 255, 0.1); padding: 15px; border-radius: 8px;">
                    <p><strong>Clienti in sala:</strong> ${clients.filter(c => c.usedToday).length}</p>
                    <p><strong>Clienti cu acces:</strong> ${clients.filter(c => checkClientAccess(c).allowed).length}</p>
                    <p><strong>Clienti blocati:</strong> ${clients.filter(c => !checkClientAccess(c).allowed).length}</p>
                    <p><strong>Total clienti:</strong> ${clients.length}</p>
                </div>
            </div>
            
            <div id="activity-report" class="report-content" style="display: none; max-height: 350px; overflow-y: auto;">
                <h3 style="color: #ffaa33; margin-bottom: 15px;">Ultimele Actiuni</h3>
                ${auditLog.length === 0 ? '<p style="color: #888;">Niciun jurnal</p>' : auditLog.slice(-20).reverse().map(log => `
                    <div style="padding: 10px; border-bottom: 1px solid #333; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span style="color: #ffaa33;"><strong>${new Date(log.timestamp).toLocaleTimeString('ro-RO')}</strong></span>
                            <span style="background: #ff8c00; color: black; padding: 2px 6px; border-radius: 3px; font-size: 10px;">${log.userRole}</span>
                        </div>
                        <p style="margin: 5px 0; color: #00ff88;"><strong>${log.user}</strong></p>
                        <p style="margin: 0; color: #fff;">${log.action}</p>
                        ${log.details ? `<p style="margin: 3px 0; color: #888; font-size: 11px;">${log.details}</p>` : ''}
                    </div>
                `).join('')}
            </div>
            
            <div class="actions" style="margin-top: 20px;">
                <button onclick="exportReport()" style="flex: 1; background: #00ff88; color: black; font-size: 12px; font-weight: bold;">Exporta Raport</button>
                <button onclick="closeModal()" style="flex: 1; background: #6496ff; font-size: 12px; font-weight: bold;">Inchide</button>
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
    
    const tabElement = document.getElementById(`${tab}-report`);
    if (tabElement) tabElement.style.display = 'block';
    
    if (event && event.target) {
        event.target.style.background = '#ff8c00';
        event.target.style.color = 'white';
        event.target.style.border = 'none';
    }
}

function exportReport() {
    const today = getTodayDate();
    const reportData = {
        generated: new Date().toISOString(),
        generatedBy: currentUser,
        statistics: {
            totalClients: clients.length,
            clientsInGym: clients.filter(c => c.usedToday).length,
            activeClients: clients.filter(c => checkClientAccess(c).allowed).length,
            blockedClients: clients.filter(c => !checkClientAccess(c).allowed).length
        },
        clients: clients,
        auditLog: auditLog.slice(-100)
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raport-${today}-${currentUser}.json`;
    link.click();
    
    addToAuditLog('Export raport', 'Raport exportat');
    showNotification('Raport exportat!', 'success');
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
    
    if (client.usedToday) {
        return { allowed: false, message: 'Folosit azi', status: 'expired' };
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
        return { allowed: true, message: `Expira in ${daysLeft} zile`, status: 'warning', daysLeft };
    }

    if (currentHour < subInfo.startHour || currentHour >= subInfo.endHour) {
        return { allowed: false, message: 'Afara programului', status: 'expired' };
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
// 🎴 CLIENT CARDS DISPLAY
// ════════════════════════════════════════════════════════════════════

function initClientCards() {
    if (!isLoggedIn) {
        document.getElementById('entryList').innerHTML = '<p style="color: #888;">Conecteaza-te</p>';
        document.getElementById('exitList').innerHTML = '<p style="color: #888;">Conecteaza-te</p>';
        document.getElementById('gymList').innerHTML = '<p style="color: #888;">Conecteaza-te</p>';
        document.getElementById('gymCount').textContent = '0';
        return;
    }

    const allowedClients = clients.filter(c => checkClientAccess(c).allowed && !c.usedToday);
    const deniedClients = clients.filter(c => !checkClientAccess(c).allowed);
    const inGymClients = clients.filter(c => c.usedToday);

    // INTRARE
    const entryList = document.getElementById('entryList');
    if (allowedClients.length === 0) {
        entryList.innerHTML = '<p style="color: #888;">Niciun client gata</p>';
    } else {
        const latest = allowedClients[0];
        entryList.innerHTML = `
            <div class="client-card active" onclick="onClientClick(${latest.id}, true)" style="cursor: pointer; padding: 16px; display: flex; gap: 15px; width: 100%;">
                <div style="min-width: 80px;">
                    ${latest.photo ? `<img src="${latest.photo}" style="width: 80px; height: 80px; border-radius: 10px; border: 3px solid #00ff88; object-fit: cover;">` : '<div style="width: 80px; height: 80px; background: #333; border-radius: 10px; display: flex; align-items: center; justify-content: center;"><span style="font-size: 40px;">👤</span></div>'}
                </div>
                <div style="flex: 1;">
                    <p style="font-weight: bold; font-size: 18px; margin: 0; color: #fff;">${latest.prenume} ${latest.nume}</p>
                    <p style="color: #00ff88; margin: 5px 0; font-weight: bold;">GATA DE INTRARE</p>
                </div>
            </div>
        `;
    }

    // IESIRE
    const exitList = document.getElementById('exitList');
    if (deniedClients.length === 0) {
        exitList.innerHTML = '<p style="color: #888;">Niciun client blocat</p>';
    } else {
        const latest = deniedClients[0];
        const access = checkClientAccess(latest);
        exitList.innerHTML = `
            <div class="client-card expired" onclick="onClientClick(${latest.id}, false)" style="cursor: pointer; padding: 16px; display: flex; gap: 15px; width: 100%;">
                <div style="min-width: 80px;">
                    ${latest.photo ? `<img src="${latest.photo}" style="width: 80px; height: 80px; border-radius: 10px; border: 3px solid #ff6b6b; object-fit: cover;">` : '<div style="width: 80px; height: 80px; background: #333; border-radius: 10px; display: flex; align-items: center; justify-content: center;"><span style="font-size: 40px;">👤</span></div>'}
                </div>
                <div style="flex: 1;">
                    <p style="font-weight: bold; font-size: 18px; margin: 0; color: #fff;">${latest.prenume} ${latest.nume}</p>
                    <p style="color: #ff6b6b; margin: 5px 0; font-weight: bold;">${access.message}</p>
                </div>
            </div>
        `;
    }

    // GYM LIST
    const gymList = document.getElementById('gymList');
    if (inGymClients.length === 0) {
        gymList.innerHTML = '<p style="color: #888; text-align: center;">Sala este goala</p>';
    } else {
        gymList.innerHTML = inGymClients.map(client => {
            const checkInTime = clientCheckIns[client.id] ? new Date(clientCheckIns[client.id]).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
            return `
                <div class="client-card ${getStatusClass(client)}" onclick="onClientClick(${client.id}, false)" style="cursor: pointer; margin-bottom: 12px;">
                    <div style="min-width: 60px;">
                        ${client.photo ? `<img src="${client.photo}" style="width: 60px; height: 60px; border-radius: 8px; border: 2px solid ${getStatusColor(client)}; object-fit: cover;">` : '<div style="width: 60px; height: 60px; background: #333; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><span>👤</span></div>'}
                    </div>
                    <div style="flex: 1;">
                        <p style="font-weight: bold; margin: 0; color: #fff;">${client.prenume} ${client.nume}</p>
                        <p style="font-size: 11px; color: #00ff88; margin: 3px 0;">⏰ ${checkInTime}</p>
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

// ══��═════════════════════════════════════════════════════════════════
// ✅ CHECK IN
// ════════════════════════════════════════════════════════════════════

function showCheckInModal(client) {
    const subInfo = SUBSCRIPTIONS[client.subscription];
    const html = `
        <div class="box" style="text-align: center;">
            <h2 style="color: #00ff88;">ACCES PERMIS</h2>
            <p style="font-size: 20px; color: #ffaa33; margin: 20px 0;">${client.prenume} ${client.nume}</p>
            <p style="margin: 10px 0;"><strong>Abonament:</strong> ${subInfo.name}</p>
            <div class="actions">
                <button onclick="confirmCheckIn(${client.id})" style="flex: 1;">Confirma Intrare</button>
                <button onclick="showClientDetails(${client.id})" style="flex: 1;">Detalii</button>
                <button onclick="closeModal()" style="flex: 1;">Anuleaza</button>
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
    addToAuditLog('Intrare client', `${client.prenume} ${client.nume}`);
    showNotification(`${client.prenume} - Intrare inregistrata!`, 'success');
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
        <div class="box scroll-box">
            <h2 style="color: #ffaa33;">${client.prenume} ${client.nume}</h2>
            
            ${client.photo ? `<img src="${client.photo}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 10px; margin-bottom: 15px;">` : ''}
            
            <div style="background: rgba(100, 150, 255, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 15px; font-size: 14px;">
                <p><strong>Abonament:</strong> ${subInfo.name}</p>
                <p><strong>Expira:</strong> ${new Date(client.expiration).toLocaleDateString('ro-RO')}</p>
                <p><strong>Zile ramase:</strong> ${daysLeft >= 0 ? daysLeft : 0}</p>
                <p><strong>Status:</strong> ${access.message}</p>
            </div>

            <div class="actions" style="flex-wrap: wrap;">
                <button onclick="editClient(${client.id})" style="flex: 1; min-width: 100px;">Editeaza</button>
                <button onclick="togglePaid(${client.id})" style="flex: 1; min-width: 100px;">Plata: ${client.isPaid ? 'Da' : 'Nu'}</button>
                <button onclick="resetUsage(${client.id})" style="flex: 1; min-width: 100px;">Reset Zi</button>
                <button onclick="deleteClient(${client.id})" style="flex: 1; min-width: 100px;">Sterge</button>
                <button onclick="closeModal()" style="flex: 1; min-width: 100px;">Inchide</button>
            </div>
        </div>
    `;

    openModal(html);
}

// ════════════════════════════════════════════════════════════════════
// ✏️ EDIT CLIENT - FIXED CAMERA
// ════════════════════════════════════════════════════════════════════

function editClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const html = `
        <div class="box scroll-box">
            <h2 style="color: #ffaa33;">EDITEAZA CLIENT</h2>
            
            <div style="margin-bottom: 15px;">
                <p style="color: #ffaa33; font-weight: bold; margin-bottom: 10px;">FOTOGRAFIE</p>
                <div id="editPhotoPreview" style="width: 100%; height: 150px; background: #333; border-radius: 10px; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${client.photo ? `<img src="${client.photo}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="color: #888;">Fara fotografie</span>'}
                </div>
                <video id="editCameraVideo" style="display: none; width: 100%; height: 150px; border-radius: 8px; margin-bottom: 10px; background: #000;"></video>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <button id="startEditCamBtn" onclick="editStartCamera(${clientId})" style="flex: 1; padding: 10px; background: #ff8c00; border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: bold;">Camera</button>
                    <button onclick="deletePhoto(${clientId})" style="flex: 1; padding: 10px; background: #ff6b6b; border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: bold;">Sterge Foto</button>
                </div>
                <button id="captureEditBtn" onclick="editCapturePhoto(${clientId})" style="width: 100%; padding: 10px; background: #00ff88; color: black; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; display: none;">Captureaaza Foto</button>
            </div>

            <p style="color: #ffaa33; font-weight: bold; margin-bottom: 10px;">DATE</p>
            <input type="text" id="editNume" placeholder="Nume" value="${client.nume}" style="width: 100%; margin-bottom: 10px; padding: 10px; border: 2px solid #ffaa33; border-radius: 8px; background: rgba(255, 140, 0, 0.1); color: #e0e0e0;">
            <input type="text" id="editPrenume" placeholder="Prenume" value="${client.prenume}" style="width: 100%; margin-bottom: 10px; padding: 10px; border: 2px solid #ffaa33; border-radius: 8px; background: rgba(255, 140, 0, 0.1); color: #e0e0e0;">
            <input type="text" id="editTag" placeholder="Tag card" value="${client.tag}" style="width: 100%; margin-bottom: 15px; padding: 10px; border: 2px solid #ffaa33; border-radius: 8px; background: rgba(255, 140, 0, 0.1); color: #e0e0e0;">

            <div class="actions">
                <button onclick="saveEditClient(${clientId})" style="flex: 1;">Salveaza</button>
                <button onclick="showClientDetails(${clientId})" style="flex: 1;">Anuleaza</button>
            </div>
        </div>
    `;

    openModal(html);
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
            startBtn.style.display = 'none';
            captureBtn.style.display = 'block';
            showNotification('Camera pornita! Apasa Captureaaza', 'success');
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
    document.getElementById('startEditCamBtn').style.display = 'block';
    document.getElementById('captureEditBtn').style.display = 'none';
    
    localStorage.setItem('tempEditPhoto', photoData);
    stopCamera();
    showNotification('Fotografia capturata!', 'success');
}

function deletePhoto(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (client) {
        client.photo = '';
        const preview = document.getElementById('editPhotoPreview');
        if (preview) preview.innerHTML = '<span style="color: #888;">Fara fotografie</span>';
        localStorage.removeItem('tempEditPhoto');
        showNotification('Fotografia stearsa!', 'success');
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
    addToAuditLog('Editeaza client', `${prenume} ${nume}`);
    showNotification('Client actualizat!', 'success');
    closeModal();
    initClientCards();
}

// ════════════════════════════════════════════════════════════════════
// 🔧 CLIENT ACTIONS
// ════════════════════════════════════════════════════════════════════

function togglePaid(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    client.isPaid = !client.isPaid;
    saveClientsToStorage();
    addToAuditLog('Setare plata', `${client.prenume}: ${client.isPaid ? 'PLATIT' : 'NEACHITAT'}`);
    showNotification(client.isPaid ? 'Marcat ca platit!' : 'Marcat ca neachitat!', 'success');
    closeModal();
    initClientCards();
}

function resetUsage(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (confirm('Resetezi utilizarea de azi?')) {
        client.usedToday = false;
        if (clientCheckIns[client.id]) delete clientCheckIns[client.id];
        saveClientsToStorage();
        saveCheckIns();
        addToAuditLog('Reset utilizare', `${client.prenume} ${client.nume}`);
        showNotification('Utilizare resetata!', 'success');
        closeModal();
        initClientCards();
    }
}

function deleteClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (confirm(`Stergi ${client.prenume} ${client.nume}?`)) {
        clients = clients.filter(c => c.id !== clientId);
        if (clientCheckIns[client.id]) delete clientCheckIns[client.id];
        saveClientsToStorage();
        saveCheckIns();
        addToAuditLog('Sterge client', `${client.prenume} ${client.nume}`);
        showNotification('Client sters!', 'success');
        closeModal();
        initClientCards();
    }
}

// ════════════════════════════════════════════════════════════════════
// 🏷️ CARD READER SUPPORT
// ════════════════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
    // Card reader integration - accumulate scanned data
    if (e.key !== 'Enter') {
        cardReaderBuffer += e.key;
    } else if (cardReaderBuffer.length > 5) {
        // Card complete - format usually ends with Enter
        scannedCardNumber = cardReaderBuffer.trim();
        console.log('Card scanned:', scannedCardNumber);
        
        // Auto-fill tag if modal is open
        const tagInput = document.getElementById('tag');
        if (tagInput && tagInput.offsetParent !== null) {
            tagInput.value = scannedCardNumber;
            showNotification(`Card scanned: ${scannedCardNumber}`, 'success');
        }
        
        cardReaderBuffer = '';
        e.preventDefault();
    }
});

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
    
    console.log('✅ GYM CORE SYSTEM v5.0 Ready!');
    console.log('Demo: admin/1234 | manager/1234 | staff/1234');
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeAllModals();
    }
});