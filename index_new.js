// ╔═══════════════════════════════════════════════════════════════════╗
// ║                     GYM CORE SYSTEM - v6.0                        ║
// ║                    WITH NFC CARD READER                           ║
// ╚═══════════════════════════════════════════════════════════════════╝

// ════════════════════════════════════════════════════════════════════
// 🔌 NFC WEBSOCKET CU RECONECTARE AUTOMATĂ
// ════════════════════════════════════════════════════════════════════

let nfcSocket = null;
let nfcReconnectInterval = null;
let nfcReconnectAttempts = 0;

function connectNFC() {
    if (nfcSocket && nfcSocket.readyState === WebSocket.OPEN) return;
    
    nfcSocket = new WebSocket("ws://localhost:8080");
    window.nfcSocket = nfcSocket;
    
    nfcSocket.onopen = () => {
        console.log("✅ WebSocket conectat");
        nfcReconnectAttempts = 0;
        
        if (nfcReconnectInterval) {
            clearInterval(nfcReconnectInterval);
            nfcReconnectInterval = null;
        }
        
        updateNFCStatus('online');
        
        if (nfcReconnectAttempts > 0) {
            showNotification('✅ NFC reconectat cu succes!', 'success');
        }
    };
    
    nfcSocket.onerror = (error) => {
        console.log("❌ WebSocket eroare:", error);
        updateNFCStatus('offline');
    };
    
    nfcSocket.onclose = () => {
        console.log("🔌 WebSocket deconectat - reconectare automată...");
        updateNFCStatus('standby');
        startAutoReconnect();
    };
    
    nfcSocket.onmessage = handleNFCMessage;
}

function startAutoReconnect() {
    if (nfcReconnectInterval) return;
    
    nfcReconnectInterval = setInterval(() => {
        nfcReconnectAttempts++;
        console.log(`🔄 Încerc reconectare NFC... (tentativa ${nfcReconnectAttempts})`);
        updateNFCStatus('reconnecting', nfcReconnectAttempts);
        connectNFC();
    }, 5000);
}

function updateNFCStatus(status, attempts = 0) {
    const nfcStatus = document.getElementById('nfc-status');
    if (!nfcStatus) return;
    
    switch(status) {
        case 'online':
            nfcStatus.innerHTML = '🟢 NFC Online';
            nfcStatus.style.background = 'rgba(0, 255, 136, 0.2)';
            nfcStatus.style.color = '#00ff88';
            nfcStatus.style.borderColor = '#00ff88';
            break;
        case 'offline':
            nfcStatus.innerHTML = '🔴 NFC Offline';
            nfcStatus.style.background = 'rgba(255, 107, 107, 0.2)';
            nfcStatus.style.color = '#ff6b6b';
            nfcStatus.style.borderColor = '#ff6b6b';
            break;
        case 'standby':
            nfcStatus.innerHTML = '🟡 NFC Standby';
            nfcStatus.style.background = 'rgba(255, 170, 0, 0.2)';
            nfcStatus.style.color = '#ffaa00';
            nfcStatus.style.borderColor = '#ffaa00';
            break;
        case 'reconnecting':
            nfcStatus.innerHTML = `🔄 Reconectare... (${attempts})`;
            nfcStatus.style.background = 'rgba(255, 170, 0, 0.2)';
            nfcStatus.style.color = '#ffaa00';
            nfcStatus.style.borderColor = '#ffaa00';
            break;
    }
}

function handleNFCMessage(event) {
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
        if (typeof addHistoryEntry === 'function') {
            addHistoryEntry(client.id, 'checkin', `Intrare NFC - ${client.prenume} ${client.nume}`);
        }
    } else if (client.nfcScansToday === 2) {
        client.isInGym = false;
        addToAuditLog('Ieșire NFC', `${client.prenume} ${client.nume} - Tag: ${tagPrimit}`);
        showNotification(`${client.prenume} a ieșit din sală!`, "success");
        if (typeof addHistoryEntry === 'function') {
            addHistoryEntry(client.id, 'checkout', `Ieșire NFC - ${client.prenume} ${client.nume}`);
        }
    } else {
        client.isInGym = true;
        addToAuditLog('Re-intrare NFC', `${client.prenume} ${client.nume} - Abonament folosit azi`);
        showNotification("Abonament folosit azi!", "error");
        if (typeof addHistoryEntry === 'function') {
            addHistoryEntry(client.id, 'checkin', `Re-intrare NFC (a ${client.nfcScansToday}-a scanare) - ${client.prenume} ${client.nume}`);
        }
    }

    saveClientsToStorage();
    saveCheckIns();
    initClientCards();
}

// Pornește conexiunea
connectNFC();

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
    'elev_full': { name: 'Elev Full', duration: 30, startHour: 7, endHour: 22, category: 'Elev', type: 'Full' },
    'adult_standard': { name: 'Adult Standard', duration: 30, startHour: 7, endHour: 17, endHourStrict: 16, endMinuteStrict: 40, category: 'Adult', type: 'Standard' },
    'adult_full': { name: 'Adult Full', duration: 30, startHour: 7, endHour: 22, category: 'Adult', type: 'Full' },
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
        clients.forEach(client => {
            client.usedToday = false;
            client.isInGym = false;
            client.nfcScansToday = 0;
            client.lastScanDate = null;
        });
        clientCheckIns = {};
        saveClientsToStorage();
        saveCheckIns();
        localStorage.setItem('lastDailyReset', todayDate);
        console.log('✅ Reset zilnic efectuat');
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
        setTimeout(() => updateStatsCards(), 500);
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
    expirationDate.setDate(expirationDate.getDate() + customDays - 1);

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
    const subInfo = SUBSCRIPTIONS[subscription];
    addHistoryEntry(newClient.id, 'subscription_created', 
        `Abonament creat: ${subInfo?.name || subscription} - ${customDays} zile - Valabil până la ${newClient.expiration}`);
    addToAuditLog('Adauga client', `${prenume} ${nume} - Abonament: ${customDays} zile - Tag: ${tag || 'N/A'}`);
    showNotification(`Client ${prenume} ${nume} adaugat!`, 'success');
    closeAdd();
    initClientCards();
}

// ════════════════════════════════════════════════════════════════════
// 🔍 SEARCH CLIENT - VERSIUNE MODIFICATĂ
// ════════════════════════════════════════════════════════════════════

function openSearch() {
    if (!isLoggedIn) {
        showNotification('Trebuie sa fii conectat!', 'error');
        return;
    }
    closeAllModals();
    document.getElementById('searchModal').classList.add('active');
    document.getElementById('search').value = '';
    document.getElementById('searchResultsContainer').innerHTML = '';
    document.getElementById('search').focus();
}

function closeSearch() {
    document.getElementById('searchModal').classList.remove('active');
    document.getElementById('search').value = '';
    document.getElementById('searchResultsContainer').innerHTML = '';
}

function searchClient() {
    const searchTerm = document.getElementById('search').value.toLowerCase().trim();
    const resultsDiv = document.getElementById('searchResultsContainer');
    
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
        resultsDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #888;">🔍 Niciun rezultat găsit</div>';
        return;
    }

    resultsDiv.innerHTML = `
        <div style="max-height: 400px; overflow-y: auto; border-radius: 12px;">
            ${results.map(client => `
                <div class="search-result-item" onclick="searchSelectClient(${client.id})" style="cursor: pointer; margin-bottom: 8px; display: flex; align-items: center; gap: 15px; padding: 12px; background: rgba(30, 41, 59, 0.8); border-radius: 12px; transition: all 0.2s;">
                    <div style="min-width: 50px;">
                        ${client.photo ? `<img src="${client.photo}" style="width: 50px; height: 50px; border-radius: 12px; object-fit: cover;">` : '<div style="width: 50px; height: 50px; background: #333; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>'}
                    </div>
                    <div style="flex: 1;">
                        <p style="font-weight: bold; margin: 0; color: #fff;">${client.prenume} ${client.nume}</p>
                        <p style="font-size: 11px; color: #888; margin: 3px 0;">🏷️ Tag: ${client.tag || 'N/A'} | 📅 Expiră: ${new Date(client.expiration).toLocaleDateString('ro-RO')}</p>
                        <p style="font-size: 10px; color: ${getStatusColor(client)};">${checkClientAccess(client).message}</p>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
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
               <h3 style="color: #ffaa33; margin-bottom: 15px;">💾 Backup & Restore</h3>
    
               <div id="storageIndicator" style="margin-bottom: 15px;"></div>
    
               <button onclick="doManualBackup()" style="width:100%; padding:12px; background:#00ff88; color:black; border:none; border-radius:8px; cursor:pointer; margin-bottom:10px; font-weight:bold; font-size:14px;">💾 Backup Manual Acum</button>
    
               <div style="background: rgba(100,150,255,0.1); padding: 15px; border-radius: 12px; margin-bottom: 15px;">
                  <h4 style="color: #6496ff; margin-bottom: 10px;">📥 Restaurare din backup</h4>
                  <input type="file" id="restoreFile" accept=".json" style="width:100%; padding:8px; margin-bottom:10px; border:2px solid #6496ff; border-radius:8px; background:rgba(100,150,255,0.1); color:#e0e0e0;">
                  <button onclick="restoreFromBackup(document.getElementById('restoreFile').files[0])" style="width:100%; padding:10px; background:#6496ff; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">📥 Restaurează</button>
            </div>
    
    <div style="background: rgba(255,170,0,0.1); padding: 12px; border-radius: 10px;">
        <p style="color: #ffaa33; font-size: 12px; margin: 0;">⚠️ Backup-ul se face automat la prima deschidere a zilei. Fișierele se salvează în folderul Downloads.</p>
    </div>
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
    if (tab === 'backup') showStorageIndicator();
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

    const oldNume = client.nume;
    const oldPrenume = client.prenume;
    const oldTag = client.tag;
    const oldExpiration = client.expiration;
    
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
    
    const newExpiration = document.getElementById('editExpiration')?.value;
    if (newExpiration && newExpiration !== oldExpiration) {
        client.expiration = newExpiration;
        addHistoryEntry(clientId, 'subscription_extended', 
            `Prelungire abonament: de la ${oldExpiration} la ${newExpiration}`);
    }
    
    let changes = [];
    if (oldNume !== nume || oldPrenume !== prenume) changes.push(`Nume: ${oldPrenume} ${oldNume} → ${prenume} ${nume}`);
    if (oldTag !== tag) changes.push(`Tag: ${oldTag || 'N/A'} → ${tag || 'N/A'}`);
    
    if (changes.length > 0) {
        addHistoryEntry(clientId, 'edited', `Date modificate: ${changes.join(', ')}`);
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
        <div class="box scroll-box" style="width: 950px; max-width: 95%;">
            <h2 style="color: #ffaa33; margin-bottom: 20px;">📊 RAPOARTE</h2>
            
            <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
                <button onclick="switchReportsTab('abonamente')" class="report-tab" id="tab-abonamente" style="flex:1; min-width:100px; padding:10px; background:#ff8c00; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">📦 Abonamente</button>
                <button onclick="switchReportsTab('azi')" class="report-tab" id="tab-azi" style="flex:1; min-width:100px; padding:10px; background:transparent; border:2px solid #ffaa33; border-radius:8px; cursor:pointer; color:#ffaa33; font-weight:bold;">📅 Azi</button>
                <button onclick="switchReportsTab('comparatii')" class="report-tab" id="tab-comparatii" style="flex:1; min-width:100px; padding:10px; background:transparent; border:2px solid #ffaa33; border-radius:8px; cursor:pointer; color:#ffaa33; font-weight:bold;">📈 Comparații</button>
                <button onclick="switchReportsTab('tendinte')" class="report-tab" id="tab-tendinte" style="flex:1; min-width:100px; padding:10px; background:transparent; border:2px solid #ffaa33; border-radius:8px; cursor:pointer; color:#ffaa33; font-weight:bold;">📉 Tendințe</button>
                <button onclick="switchReportsTab('perioada')" class="report-tab" id="tab-perioada" style="flex:1; min-width:100px; padding:10px; background:transparent; border:2px solid #ffaa33; border-radius:8px; cursor:pointer; color:#ffaa33; font-weight:bold;">🗓️ Perioadă</button>
                <button onclick="switchReportsTab('activitate')" class="report-tab" id="tab-activitate" style="flex:1; min-width:100px; padding:10px; background:transparent; border:2px solid #ffaa33; border-radius:8px; cursor:pointer; color:#ffaa33; font-weight:bold;">👤 Activitate</button>
            </div>
            
            <div id="report-content"></div>
            
            <div style="margin-top:15px;">
                <button onclick="closeModal()" style="width:100%; padding:10px; background:#6496ff; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">❌ Închide</button>
            </div>
        </div>
    `;
    
    openModal(reportsHTML);
    switchReportsTab('abonamente');
}

function switchReportsTab(tab) {
    document.querySelectorAll('.report-tab').forEach(el => {
        el.style.background = 'transparent';
        el.style.color = '#ffaa33';
        el.style.border = '2px solid #ffaa33';
    });
    const activeBtn = document.getElementById(`tab-${tab}`);
    if (activeBtn) {
        activeBtn.style.background = '#ff8c00';
        activeBtn.style.color = 'white';
        activeBtn.style.border = 'none';
    }
    
    const content = document.getElementById('report-content');
    if (!content) return;
    
    switch(tab) {
        case 'abonamente': content.innerHTML = renderTabAbonamente(); break;
        case 'azi': content.innerHTML = renderTabAzi(); break;
        case 'comparatii': content.innerHTML = renderTabComparatii(); break;
        case 'tendinte': content.innerHTML = renderTabTendinte(); break;
        case 'perioada': content.innerHTML = renderTabPerioada(); break;
        case 'activitate': content.innerHTML = renderTabActivitate(); break;
    }
}

function renderTabAbonamente() {
    const activeClients = clients.filter(c => getClientDaysLeft(c) > 0 && c.isPaid);
    const expiredClients = clients.filter(c => getClientDaysLeft(c) === 0 || !c.isPaid);
    const thisMonth = new Date().toISOString().substring(0, 7);
    const thisMonthPayments = getMonthPayments(thisMonth);
    const createdThisMonth = thisMonthPayments.total;
    
    const subCounts = {};
    clients.forEach(c => {
        const name = SUBSCRIPTIONS[c.subscription]?.name || c.subscription || 'Necunoscut';
        subCounts[name] = (subCounts[name] || 0) + 1;
    });
    
    const colors = ['#3266ad','#1d9e75','#ba7517','#993556','#888780'];
    const subEntries = Object.entries(subCounts);
    const last6 = getLast6Months();
    const maxVal = Math.max(...last6.map(m => m.count), 1);
    
    return `
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:15px;">
            <div onclick="toggleReportList('active')" style="cursor:pointer; text-align:center; background:rgba(0,255,136,0.1); border:2px solid rgba(0,255,136,0.3); border-radius:12px; padding:15px; transition:0.2s;" onmouseover="this.style.background='rgba(0,255,136,0.2)'" onmouseout="this.style.background='rgba(0,255,136,0.1)'">
                <div style="font-size:32px; font-weight:bold; color:#00ff88;">${activeClients.length}</div>
                <div style="font-size:12px; color:#00ff88;">✅ Active</div>
                <div style="font-size:10px; color:#888; margin-top:4px;">Click pentru listă</div>
            </div>
            <div onclick="toggleReportList('expired')" style="cursor:pointer; text-align:center; background:rgba(255,107,107,0.1); border:2px solid rgba(255,107,107,0.3); border-radius:12px; padding:15px; transition:0.2s;" onmouseover="this.style.background='rgba(255,107,107,0.2)'" onmouseout="this.style.background='rgba(255,107,107,0.1)'">
                <div style="font-size:32px; font-weight:bold; color:#ff6b6b;">${expiredClients.length}</div>
                <div style="font-size:12px; color:#ff6b6b;">❌ Expirate</div>
                <div style="font-size:10px; color:#888; margin-top:4px;">Click pentru listă</div>
            </div>
            <div style="text-align:center; background:rgba(100,150,255,0.1); border:1px solid rgba(100,150,255,0.3); border-radius:12px; padding:15px;">
                <div style="font-size:32px; font-weight:bold; color:#6496ff;">${clients.length}</div>
                <div style="font-size:12px; color:#6496ff;">👥 Total clienți</div>
            </div>
            <div style="text-align:center; background:rgba(255,170,0,0.1); border:1px solid rgba(255,170,0,0.3); border-radius:12px; padding:15px;">
                <div style="font-size:32px; font-weight:bold; color:#ffaa00;">${createdThisMonth}</div>
                <div style="font-size:12px; color:#ffaa00;">📅 Create luna asta</div>
            </div>
        </div>
        
        <div id="reportClientList" style="margin-bottom:15px;"></div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px;">
                <h4 style="color:#ffaa33; margin-bottom:12px;">Distribuție tipuri abonament</h4>
                ${subEntries.map(([name, count], i) => `
                    <div style="margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
                            <span style="color:#e0e0e0;">${name}</span>
                            <span style="color:${colors[i % colors.length]}; font-weight:bold;">${count}</span>
                        </div>
                        <div style="background:rgba(255,255,255,0.1); border-radius:4px; height:8px;">
                            <div style="width:${Math.round(count/clients.length*100)}%; height:100%; background:${colors[i % colors.length]}; border-radius:4px;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px;">
                <h4 style="color:#ffaa33; margin-bottom:12px;">Abonamente achitate — ultimele 6 luni</h4>
                <div style="display:flex; align-items:flex-end; gap:6px; height:120px;">
                    ${last6.map(m => {
                        const hTotal = Math.round((m.count / maxVal) * 100);
                        const hCreated = m.count > 0 ? Math.round((m.created / m.count) * hTotal) : 0;
                        const hRenewed = hTotal - hCreated;
                        return `
                            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
                                <span style="font-size:10px; color:${m.isCurrentMonth ? '#00ff88' : '#ffaa33'};">${m.count}</span>
                                <div style="width:100%; display:flex; flex-direction:column; height:${hTotal}px; border-radius:4px 4px 0 0; overflow:hidden; min-height:${m.count > 0 ? '4' : '1'}px;">
                                    <div style="width:100%; height:${hRenewed}px; background:#ffaa00;"></div>
                                    <div style="width:100%; height:${hCreated}px; background:#00ff88;"></div>
                                </div>
                                <span style="font-size:10px; color:#888;">${m.label}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="display:flex; gap:15px; margin-top:10px;">
                    <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#888;">
                        <span style="width:10px;height:8px;background:#00ff88;border-radius:2px;display:inline-block;"></span>Create noi
                    </span>
                    <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#888;">
                        <span style="width:10px;height:8px;background:#ffaa00;border-radius:2px;display:inline-block;"></span>Reînnoite
                    </span>
                </div>
            </div>
        </div>
    `;
}

function getLast6Months() {
    const result = [];
    const now = new Date();
    const monthNames = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const payments = getMonthPayments(key);
        
        result.push({
            label: monthNames[d.getMonth()],
            key,
            count: payments.total,
            created: payments.created,
            renewed: payments.renewed,
            isCurrentMonth: i === 0
        });
    }
    return result;
}

function toggleReportList(type) {
    const container = document.getElementById('reportClientList');
    if (!container) return;
    
    if (container.dataset.current === type) {
        container.innerHTML = '';
        container.dataset.current = '';
        return;
    }
    
    container.dataset.current = type;
    
    let clientsList, title, color;
    if (type === 'active') {
        clientsList = clients.filter(c => getClientDaysLeft(c) > 0 && c.isPaid)
            .sort((a,b) => getClientDaysLeft(a) - getClientDaysLeft(b));
        title = `✅ Abonamente Active (${clientsList.length})`;
        color = '#00ff88';
    } else {
        clientsList = clients.filter(c => getClientDaysLeft(c) === 0 || !c.isPaid)
            .sort((a,b) => new Date(b.expiration) - new Date(a.expiration));
        title = `❌ Abonamente Expirate (${clientsList.length})`;
        color = '#ff6b6b';
    }
    
    container.innerHTML = `
        <div style="background:rgba(30,41,59,0.8); border-radius:12px; padding:15px; border:1px solid ${color}40;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="color:${color}; margin:0;">${title}</h4>
                <button onclick="document.getElementById('reportClientList').innerHTML=''; document.getElementById('reportClientList').dataset.current='';" 
                    style="background:transparent; border:1px solid #666; color:#888; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:11px;">✕ Închide</button>
            </div>
            <div style="max-height:250px; overflow-y:auto;">
                ${clientsList.map(client => {
                    const daysLeft = getClientDaysLeft(client);
                    const expDate = new Date(client.expiration + 'T12:00:00').toLocaleDateString('ro-RO');
                    return `
                        <div onclick="closeModal(); setTimeout(()=>showClientDetails(${client.id}), 100);" 
                            style="display:flex; align-items:center; gap:12px; padding:10px; margin-bottom:6px; background:rgba(255,255,255,0.03); border-radius:10px; cursor:pointer; border:1px solid rgba(255,255,255,0.05); transition:0.2s;"
                            onmouseover="this.style.background='rgba(255,255,255,0.08)'"
                            onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                            <div style="min-width:45px;">
                                ${client.photo ? `<img src="${client.photo}" style="width:45px;height:45px;border-radius:10px;object-fit:cover;border:2px solid ${color}40;">` : `<div style="width:45px;height:45px;background:#333;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">👤</div>`}
                            </div>
                            <div style="flex:1;">
                                <p style="font-weight:bold; margin:0; color:#fff; font-size:14px;">${client.prenume} ${client.nume}</p>
                                <p style="font-size:11px; color:#888; margin:2px 0;">📦 ${SUBSCRIPTIONS[client.subscription]?.name || client.subscription}</p>
                                <p style="font-size:11px; margin:2px 0; color:${color};">📅 ${expDate} ${type === 'active' ? `(${daysLeft} zile rămase)` : '(expirat)'}</p>
                            </div>
                            <span style="color:#888; font-size:18px;">›</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// ════════ TAB 2 — AZI ════════
function renderTabAzi() {
    const todayStr = getTodayDate();
    const todayEntries = auditLog.filter(l => l.timestamp.startsWith(todayStr) && l.action.includes('Intrare'));
    const inGymNow = clients.filter(c => c.isInGym === true && c.nfcScansToday === 1);
    const todayPayments = getMonthPayments(todayStr.substring(0,7));
    const createdToday = todayPayments.clients.filter(c => {
    const startDate = c.startDate || '';
       return startDate.startsWith(todayStr);
    });
    
    const hourCounts = {};
    todayEntries.forEach(l => {
        const hour = new Date(l.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    const maxHour = Math.max(...Object.values(hourCounts), 1);
    
    return `
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:15px;">
            <div style="text-align:center; background:rgba(0,255,136,0.1); border:1px solid rgba(0,255,136,0.3); border-radius:12px; padding:15px;">
                <div style="font-size:32px; font-weight:bold; color:#00ff88;">${inGymNow.length}</div>
                <div style="font-size:12px; color:#00ff88;">🏋️ În sală acum</div>
            </div>
            <div style="text-align:center; background:rgba(100,150,255,0.1); border:1px solid rgba(100,150,255,0.3); border-radius:12px; padding:15px;">
                <div style="font-size:32px; font-weight:bold; color:#6496ff;">${todayEntries.length}</div>
                <div style="font-size:12px; color:#6496ff;">⬆️ Intrări azi</div>
            </div>
            <div style="text-align:center; background:rgba(255,170,0,0.1); border:1px solid rgba(255,170,0,0.3); border-radius:12px; padding:15px;">
                  <div style="font-size:32px; font-weight:bold; color:#ffaa00;">${createdToday.length}</div>
                  <div style="font-size:12px; color:#ffaa00;">📋 Create/Reînn. azi</div>
            </div>
        </div>
        
        <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px; margin-bottom:15px;">
            <h4 style="color:#ffaa33; margin-bottom:12px;">🕐 Ore de vârf azi</h4>
            <div style="display:flex; align-items:flex-end; gap:4px; height:80px;">
                ${Array.from({length:15}, (_,i) => i+7).map(hour => {
                    const count = hourCounts[hour] || 0;
                    const height = count > 0 ? Math.round((count/maxHour)*70) : 2;
                    const isVarf = count === Math.max(...Object.values(hourCounts), 0) && count > 0;
                    return `
                        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                            ${count > 0 ? `<span style="font-size:9px; color:#ffaa33;">${count}</span>` : ''}
                            <div style="width:100%; height:${height}px; background:${isVarf ? '#ffaa00' : '#3266ad'}; border-radius:2px 2px 0 0;"></div>
                            <span style="font-size:9px; color:#666;">${hour}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px;">
            <h4 style="color:#6496ff; margin-bottom:12px;">🏋️ Clienți în sală acum (${inGymNow.length})</h4>
            ${inGymNow.length === 0 ? '<p style="color:#888; text-align:center;">Sala este goală</p>' : 
                inGymNow.sort((a,b) => (b.lastScanTimestamp||0)-(a.lastScanTimestamp||0)).map(client => {
                    const scanTime = client.lastScanTimestamp ? new Date(client.lastScanTimestamp).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'}) : 'N/A';
                    return `
                        <div onclick="closeModal(); setTimeout(()=>showClientDetails(${client.id}),100);" style="display:flex; align-items:center; gap:10px; padding:8px; margin-bottom:6px; background:rgba(0,255,136,0.05); border-radius:8px; cursor:pointer; border:1px solid rgba(0,255,136,0.15);">
                            ${client.photo ? `<img src="${client.photo}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;">` : '<div style="width:40px;height:40px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;">👤</div>'}
                            <div style="flex:1;">
                                <p style="margin:0; font-weight:bold; font-size:13px;">${client.prenume} ${client.nume}</p>
                                <p style="margin:0; font-size:11px; color:#00ff88;">⏰ Intrat la: ${scanTime}</p>
                            </div>
                            <span style="font-size:11px; color:#ffaa33;">${getClientDaysLeft(client)} zile</span>
                        </div>
                    `;
                }).join('')
            }
        </div>
    `;
}

// ════════ TAB 3 — COMPARAȚII ════════
function renderTabComparatii() {
    const now = new Date();
    const monthNames = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];
    
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,'0')}`;
    const sameLastYearKey = `${now.getFullYear()-1}-${String(now.getMonth()+1).padStart(2,'0')}`;
    
    const curr = getMonthPayments(currentMonthKey);
    const last = getMonthPayments(lastMonthKey);
    const sameLastYear = getMonthPayments(sameLastYearKey);
    
    const currYearTotal = Array.from({length:12}, (_,i) => {
        const d = new Date(now.getFullYear(), i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        return getMonthPayments(key).total;
    }).reduce((a,b) => a+b, 0);
    
    const lastYearTotal = Array.from({length:12}, (_,i) => {
        const d = new Date(now.getFullYear()-1, i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        return getMonthPayments(key).total;
    }).reduce((a,b) => a+b, 0);
    
    const pct = (a, b) => b === 0 ? '—' : `${a >= b ? '+' : ''}${Math.round((a-b)/b*100)}%`;
    const colors = {'Adult Full':'#3266ad','Elev Full':'#993556','Adult Standard':'#ba7517','Elev Standard':'#1d9e75','2 Săptămâni':'#888780'};
    
    const last12 = Array.from({length:12}, (_,i) => {
        const d = new Date(now.getFullYear(), now.getMonth()-11+i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const keyLY = `${d.getFullYear()-1}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const p = getMonthPayments(key);
        const pLY = getMonthPayments(keyLY);
        return { label: monthNames[d.getMonth()], curr: p.total, currCreated: p.created, currRenewed: p.renewed, prev: pLY.total, isCurrent: i === 11 };
    });
    const maxVal = Math.max(...last12.map(m => Math.max(m.curr, m.prev)), 1);
    
    const currByType = Object.entries(curr.byType);
    const totalTypes = curr.total;
    
    return `
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:15px;">
            <div onclick="toggleComparatiuList('current', '${currentMonthKey}')" style="cursor:pointer; text-align:center; background:rgba(0,255,136,0.1); border:2px solid rgba(0,255,136,0.3); border-radius:12px; padding:15px;" onmouseover="this.style.background='rgba(0,255,136,0.2)'" onmouseout="this.style.background='rgba(0,255,136,0.1)'">
                <div style="font-size:11px; color:#888; margin-bottom:5px;">Luna curentă (${monthNames[now.getMonth()]})</div>
                <div style="font-size:32px; font-weight:bold; color:#00ff88;">${curr.total}</div>
                <div style="font-size:11px; color:#888; margin-top:5px;">🆕 ${curr.created} noi | 🔄 ${curr.renewed} reînn.</div>
                <div style="font-size:10px; color:#888; margin-top:3px;">Click pentru listă</div>
            </div>
            <div onclick="toggleComparatiuList('last', '${lastMonthKey}')" style="cursor:pointer; text-align:center; background:rgba(100,150,255,0.1); border:1px solid rgba(100,150,255,0.3); border-radius:12px; padding:15px;" onmouseover="this.style.background='rgba(100,150,255,0.2)'" onmouseout="this.style.background='rgba(100,150,255,0.1)'">
                <div style="font-size:11px; color:#888; margin-bottom:5px;">Luna trecută (${monthNames[lastMonthDate.getMonth()]})</div>
                <div style="font-size:32px; font-weight:bold; color:#6496ff;">${last.total}</div>
                <div style="font-size:11px; color:${curr.total >= last.total ? '#00ff88' : '#ff6b6b'}; margin-top:5px;">${pct(curr.total, last.total)} față de luna trecută</div>
                <div style="font-size:10px; color:#888; margin-top:3px;">Click pentru listă</div>
            </div>
            <div onclick="toggleComparatiuList('lastyear', '${sameLastYearKey}')" style="cursor:pointer; text-align:center; background:rgba(255,170,0,0.1); border:1px solid rgba(255,170,0,0.3); border-radius:12px; padding:15px;" onmouseover="this.style.background='rgba(255,170,0,0.2)'" onmouseout="this.style.background='rgba(255,170,0,0.1)'">
                <div style="font-size:11px; color:#888; margin-bottom:5px;">Aceeași lună an trecut</div>
                <div style="font-size:32px; font-weight:bold; color:#ffaa00;">${sameLastYear.total}</div>
                <div style="font-size:11px; color:${curr.total >= sameLastYear.total ? '#00ff88' : '#ff6b6b'}; margin-top:5px;">${pct(curr.total, sameLastYear.total)} față de an trecut</div>
                <div style="font-size:10px; color:#888; margin-top:3px;">Click pentru listă</div>
            </div>
        </div>
        
        <div id="comparatiiClientList" style="margin-bottom:15px;"></div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:15px;">
            <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px;">
                <h4 style="color:#ffaa33; margin-bottom:12px;">📊 Distribuție tipuri — luna curentă</h4>
                ${currByType.length === 0 ? '<p style="color:#888;text-align:center;">Nicio tranzacție</p>' :
                    currByType.sort((a,b) => b[1]-a[1]).map(([name, count]) => {
                        const pctVal = Math.round(count/totalTypes*100);
                        const color = colors[name] || '#888';
                        return `
                            <div style="margin-bottom:10px;">
                                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                                    <span style="color:#e0e0e0;">${name}</span>
                                    <span style="color:${color}; font-weight:bold;">${count} <span style="color:#888;">(${pctVal}%)</span></span>
                                </div>
                                <div style="background:rgba(255,255,255,0.1); border-radius:4px; height:10px;">
                                    <div style="width:${pctVal}%; height:100%; background:${color}; border-radius:4px;"></div>
                                </div>
                            </div>
                        `;
                    }).join('')
                }
                <div style="margin-top:12px; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px;">
                    <div style="font-size:11px; color:#888; margin-bottom:6px;">Create vs Reînnoite</div>
                    <div style="display:flex; height:14px; border-radius:6px; overflow:hidden;">
                        <div style="flex:${curr.created||1}; background:#00ff88;"></div>
                        <div style="flex:${curr.renewed||1}; background:#ffaa00;"></div>
                    </div>
                    <div style="display:flex; justify-content:space-around; font-size:11px; margin-top:6px;">
                        <span style="color:#00ff88;">🆕 ${curr.created} noi (${curr.total > 0 ? Math.round(curr.created/curr.total*100) : 0}%)</span>
                        <span style="color:#ffaa00;">🔄 ${curr.renewed} reînn. (${curr.total > 0 ? Math.round(curr.renewed/curr.total*100) : 0}%)</span>
                    </div>
                </div>
            </div>
            
            <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px;">
                <h4 style="color:#ffaa33; margin-bottom:12px;">📅 Total ani</h4>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
                    <div style="text-align:center; background:rgba(0,255,136,0.1); border-radius:10px; padding:12px;">
                        <div style="font-size:11px; color:#888;">Anul ${now.getFullYear()}</div>
                        <div style="font-size:28px; font-weight:bold; color:#00ff88;">${currYearTotal}</div>
                        <div style="font-size:10px; color:#888;">abonamente</div>
                    </div>
                    <div style="text-align:center; background:rgba(100,150,255,0.1); border-radius:10px; padding:12px;">
                        <div style="font-size:11px; color:#888;">Anul ${now.getFullYear()-1}</div>
                        <div style="font-size:28px; font-weight:bold; color:#6496ff;">${lastYearTotal}</div>
                        <div style="font-size:11px; color:${currYearTotal >= lastYearTotal ? '#00ff88' : '#ff6b6b'};">${pct(currYearTotal, lastYearTotal)}</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px;">
            <h4 style="color:#ffaa33; margin-bottom:15px;">📊 Ultimele 12 luni vs același an trecut</h4>
            <div style="display:flex; align-items:flex-end; gap:4px; height:120px;">
                ${last12.map(m => {
                    const hCurr = Math.round((m.curr/maxVal)*100);
                    const hPrev = Math.round((m.prev/maxVal)*100);
                    return `
                        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                            <div style="width:100%; display:flex; gap:1px; align-items:flex-end; height:110px; justify-content:center;">
                                <div style="flex:1; display:flex; flex-direction:column; height:${hCurr}px; border-radius:2px 2px 0 0; overflow:hidden; min-height:${m.curr>0?'3':'0'}px; ${m.isCurrent ? 'outline:1px solid #ffaa33;' : ''}">
                                    <div style="flex:${m.currRenewed||1}; background:#ffaa00;"></div>
                                    <div style="flex:${m.currCreated||1}; background:#1d9e75;"></div>
                                </div>
                                <div style="flex:1; height:${hPrev}px; background:#b4b2a9; border-radius:2px 2px 0 0; min-height:${m.prev>0?'3':'0'}px;"></div>
                            </div>
                            <span style="font-size:9px; color:${m.isCurrent ? '#ffaa33' : '#666'};">${m.label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="display:flex; gap:15px; margin-top:10px; flex-wrap:wrap;">
                <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#888;"><span style="width:10px;height:8px;background:#1d9e75;border-radius:2px;display:inline-block;"></span>Create noi</span>
                <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#888;"><span style="width:10px;height:8px;background:#ffaa00;border-radius:2px;display:inline-block;"></span>Reînnoite</span>
                <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#888;"><span style="width:10px;height:8px;background:#b4b2a9;border-radius:2px;display:inline-block;"></span>Anul trecut</span>
            </div>
        </div>
    `;
}

function toggleComparatiuList(type, monthKey) {
    const container = document.getElementById('comparatiiClientList');
    if (!container) return;
    
    if (container.dataset.current === type) {
        container.innerHTML = '';
        container.dataset.current = '';
        return;
    }
    
    container.dataset.current = type;
    const payments = getMonthPayments(monthKey);
    const monthNames = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];
    const [year, month] = monthKey.split('-');
    const monthLabel = `${monthNames[parseInt(month)-1]} ${year}`;
    const colors = {'Adult Full':'#3266ad','Elev Full':'#993556','Adult Standard':'#ba7517','Elev Standard':'#1d9e75','2 Săptămâni':'#888780'};
    
    container.innerHTML = `
        <div style="background:rgba(30,41,59,0.8); border-radius:12px; padding:15px; border:1px solid rgba(255,170,0,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="color:#ffaa33; margin:0;">📋 ${monthLabel} — Total: ${payments.total} abonamente</h4>
                <button onclick="document.getElementById('comparatiiClientList').innerHTML=''; document.getElementById('comparatiiClientList').dataset.current='';"
                    style="background:transparent; border:1px solid #666; color:#888; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:11px;">✕</button>
            </div>
            
            <div style="display:flex; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
                <span style="background:rgba(0,255,136,0.15); color:#00ff88; padding:5px 14px; border-radius:20px; font-size:12px; font-weight:bold;">🆕 Create noi: ${payments.created}</span>
                <span style="background:rgba(255,170,0,0.15); color:#ffaa00; padding:5px 14px; border-radius:20px; font-size:12px; font-weight:bold;">🔄 Reînnoite: ${payments.renewed}</span>
                ${Object.entries(payments.byType).sort((a,b)=>b[1]-a[1]).map(([name, count]) => `
                    <span style="background:rgba(255,255,255,0.05); color:${colors[name]||'#888'}; padding:5px 14px; border-radius:20px; font-size:12px;">
                        ${name}: ${count} (${Math.round(count/payments.total*100)}%)
                    </span>
                `).join('')}
            </div>
            
            <div style="display:flex; gap:8px; margin-bottom:10px;">
                <button onclick="filterComparatiuList('all')" id="filter-all" style="padding:5px 12px; background:#ff8c00; color:white; border:none; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">Toți (${payments.total})</button>
                <button onclick="filterComparatiuList('new')" id="filter-new" style="padding:5px 12px; background:transparent; border:1px solid #00ff88; color:#00ff88; border-radius:6px; cursor:pointer; font-size:11px;">🆕 Noi (${payments.created})</button>
                <button onclick="filterComparatiuList('renewed')" id="filter-renewed" style="padding:5px 12px; background:transparent; border:1px solid #ffaa00; color:#ffaa00; border-radius:6px; cursor:pointer; font-size:11px;">🔄 Reînn. (${payments.renewed})</button>
            </div>
            
            <div id="comparatiiClientsList" style="max-height:280px; overflow-y:auto;">
                ${renderComparatiuClients(payments.clients)}
            </div>
        </div>
    `;
    
    window._comparatiiPayments = payments;
}

function filterComparatiuList(filter) {
    const payments = window._comparatiiPayments;
    if (!payments) return;
    
    let list;
    if (filter === 'new') list = payments.clients.filter(c => c.createdAt && c.startDate && c.createdAt.substring(0,7) === c.startDate.substring(0,7));
    else if (filter === 'renewed') list = payments.clients.filter(c => c.createdAt && c.startDate && c.createdAt.substring(0,7) !== c.startDate.substring(0,7));
    else list = payments.clients;
    
    document.getElementById('comparatiiClientsList').innerHTML = renderComparatiuClients(list);
    
    ['all','new','renewed'].forEach(f => {
        const btn = document.getElementById(`filter-${f}`);
        if (btn) {
            btn.style.background = f === filter ? '#ff8c00' : 'transparent';
            btn.style.color = f === filter ? 'white' : (f === 'new' ? '#00ff88' : f === 'renewed' ? '#ffaa00' : '#888');
            btn.style.border = f === filter ? 'none' : `1px solid ${f === 'new' ? '#00ff88' : f === 'renewed' ? '#ffaa00' : '#666'}`;
        }
    });
}

function renderComparatiuClients(list) {
    const colors = {'Adult Full':'#3266ad','Elev Full':'#993556','Adult Standard':'#ba7517','Elev Standard':'#1d9e75','2 Săptămâni':'#888780'};
    if (list.length === 0) return '<p style="color:#888; text-align:center; padding:20px;">Niciun client în această categorie</p>';
    
    return list.map(c => {
        const isNew = c.createdAt && c.startDate && c.createdAt.substring(0,7) === c.startDate.substring(0,7);
        const subName = SUBSCRIPTIONS[c.subscription]?.name || c.subscription;
        const subColor = colors[subName] || '#888';
        return `
            <div onclick="closeModal(); setTimeout(()=>showClientDetails(${c.id}),100);"
                style="display:flex; align-items:center; gap:10px; padding:9px; margin-bottom:6px; background:rgba(255,255,255,0.03); border-radius:10px; cursor:pointer; border:1px solid rgba(255,255,255,0.05);"
                onmouseover="this.style.background='rgba(255,255,255,0.08)'"
                onmouseout="this.style.background='rgba(255,255,255,0.03)'">
                <div style="min-width:40px;">
                    ${c.photo ? `<img src="${c.photo}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;">` : '<div style="width:40px;height:40px;background:#333;border-radius:8px;display:flex;align-items:center;justify-content:center;">👤</div>'}
                </div>
                <div style="flex:1;">
                    <p style="margin:0; font-weight:bold; font-size:13px; color:#fff;">${c.prenume} ${c.nume}</p>
                    <p style="margin:2px 0; font-size:11px; color:${subColor};">📦 ${subName}</p>
                    <p style="margin:0; font-size:10px; color:#888;">📅 ${c.startDate} → ${c.expiration}</p>
                </div>
                <span style="font-size:11px; padding:3px 8px; border-radius:10px; background:${isNew ? 'rgba(0,255,136,0.15)' : 'rgba(255,170,0,0.15)'}; color:${isNew ? '#00ff88' : '#ffaa00'};">${isNew ? '🆕 Nou' : '🔄 Reînn.'}</span>
            </div>
        `;
    }).join('');
}

window.toggleComparatiuList = toggleComparatiuList;
window.filterComparatiuList = filterComparatiuList;

// ════════ TAB 4 — TENDINȚE ════════
function renderTabTendinte() {
    const monthNames = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];
    const now = new Date();
    
    const last6 = Array.from({length:6}, (_,i) => {
        const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const p = getMonthPayments(key);
        return { label: monthNames[d.getMonth()], key, count: p.total, created: p.created, renewed: p.renewed, isCurrentMonth: i === 5 };
    });
    const maxLast6 = Math.max(...last6.map(m => m.count), 1);
    
    const dowCounts = [0,0,0,0,0,0,0];
    auditLog.filter(l => l.action.includes('Intrare')).forEach(l => {
        dowCounts[new Date(l.timestamp).getDay()]++;
    });
    const maxDow = Math.max(...dowCounts, 1);
    const dowNames = ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'];
    
    const hourCounts = new Array(24).fill(0);
    auditLog.filter(l => l.action.includes('Intrare')).forEach(l => {
        hourCounts[new Date(l.timestamp).getHours()]++;
    });
    const hoursToShow = hourCounts.slice(7, 22);
    const maxHourAll = Math.max(...hoursToShow, 1);
    
    return `
        <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px; margin-bottom:15px;">
            <h4 style="color:#ffaa33; margin-bottom:12px;">📈 Abonamente achitate — ultimele 6 luni</h4>
            <div style="display:flex; align-items:flex-end; gap:8px; height:120px;">
                ${last6.map(m => {
                    const hTotal = Math.round((m.count/maxLast6)*100);
                    const hRenewed = m.count > 0 ? Math.round((m.renewed/m.count)*hTotal) : 0;
                    const hCreated = hTotal - hRenewed;
                    return `
                        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; cursor:pointer;" onclick="showMonthDetail('${m.key}')">
                            <span style="font-size:11px; color:${m.isCurrentMonth ? '#ffaa33' : '#888'}; font-weight:${m.isCurrentMonth ? 'bold' : 'normal'};">${m.count}</span>
                            <div style="width:100%; display:flex; flex-direction:column; height:${hTotal}px; border-radius:4px 4px 0 0; overflow:hidden; min-height:${m.count>0?'4':'1'}px; ${m.isCurrentMonth ? 'outline:2px solid #ffaa33;' : ''}">
                                <div style="height:${hRenewed}px; background:#ffaa00;"></div>
                                <div style="height:${hCreated}px; background:#1d9e75;"></div>
                            </div>
                            <span style="font-size:10px; color:${m.isCurrentMonth ? '#ffaa33' : '#666'};">${m.label}</span>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="display:flex; gap:15px; margin-top:10px; flex-wrap:wrap;">
                <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#888;"><span style="width:10px;height:8px;background:#1d9e75;border-radius:2px;display:inline-block;"></span>Create noi</span>
                <span style="display:flex;align-items:center;gap:4px;font-size:11px;color:#888;"><span style="width:10px;height:8px;background:#ffaa00;border-radius:2px;display:inline-block;"></span>Reînnoite</span>
                <span style="font-size:11px; color:#888;">Click pe bară pentru detalii</span>
            </div>
        </div>
        
        <div id="tendintaMonthDetail" style="margin-bottom:15px;"></div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px;">
                <h4 style="color:#ffaa33; margin-bottom:12px;">🕐 Ore de vârf (toate timpurile)</h4>
                <div style="display:flex; align-items:flex-end; gap:3px; height:80px;">
                    ${hoursToShow.map((count, i) => {
                        const h = count > 0 ? Math.round((count/maxHourAll)*70) : 2;
                        const isVarf = count === Math.max(...hoursToShow) && count > 0;
                        return `
                            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                                <div style="width:100%; height:${h}px; background:${isVarf ? '#ffaa00' : '#3266ad'}; border-radius:2px 2px 0 0;"></div>
                                <span style="font-size:8px; color:#666;">${i+7}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px;">
                <h4 style="color:#ffaa33; margin-bottom:12px;">📅 Zile active din săptămână</h4>
                <div style="display:flex; align-items:flex-end; gap:5px; height:80px;">
                    ${[1,2,3,4,5,6,0].map(dow => {
                        const count = dowCounts[dow];
                        const h = count > 0 ? Math.round((count/maxDow)*70) : 2;
                        return `
                            <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                                <div style="width:100%; height:${h}px; background:#3266ad; border-radius:2px 2px 0 0;"></div>
                                <span style="font-size:10px; color:#888;">${dowNames[dow]}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

function showMonthDetail(monthKey) {
    const payments = getMonthPayments(monthKey);
    const monthNames = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];
    const [year, month] = monthKey.split('-');
    const monthLabel = `${monthNames[parseInt(month)-1]} ${year}`;
    const colors = {'Adult Full':'#3266ad','Elev Full':'#993556','Adult Standard':'#ba7517','Elev Standard':'#1d9e75','2 Săptămâni':'#888780'};
    const container = document.getElementById('tendintaMonthDetail');
    if (!container) return;
    
    if (container.dataset.month === monthKey) {
        container.innerHTML = '';
        container.dataset.month = '';
        return;
    }
    container.dataset.month = monthKey;
    
    container.innerHTML = `
        <div style="background:rgba(30,41,59,0.8); border-radius:12px; padding:15px; border:1px solid rgba(255,170,0,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="color:#ffaa33; margin:0;">📋 ${monthLabel} — Total: ${payments.total}</h4>
                <button onclick="document.getElementById('tendintaMonthDetail').innerHTML=''; document.getElementById('tendintaMonthDetail').dataset.month='';" style="background:transparent; border:1px solid #666; color:#888; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:11px;">✕</button>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
                <span style="background:rgba(0,255,136,0.15); color:#00ff88; padding:5px 14px; border-radius:20px; font-size:12px; font-weight:bold;">🆕 Noi: ${payments.created}</span>
                <span style="background:rgba(255,170,0,0.15); color:#ffaa00; padding:5px 14px; border-radius:20px; font-size:12px; font-weight:bold;">🔄 Reînn.: ${payments.renewed}</span>
                ${Object.entries(payments.byType).sort((a,b)=>b[1]-a[1]).map(([name, count]) => `
                    <span style="background:rgba(255,255,255,0.05); color:${colors[name]||'#888'}; padding:5px 12px; border-radius:20px; font-size:11px;">${name}: ${count}</span>
                `).join('')}
            </div>
            <div style="max-height:220px; overflow-y:auto;">
                ${renderComparatiuClients(payments.clients)}
            </div>
        </div>
    `;
}

window.showMonthDetail = showMonthDetail;
window.toggleComparatiuList = toggleComparatiuList;
window.filterComparatiuList = filterComparatiuList;

// ════════ TAB 5 — PERIOADĂ PERSONALIZATĂ ════════
function renderTabPerioada() {
    const today = getTodayDate();
    const firstOfMonth = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`;
    
    return `
        <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px; margin-bottom:15px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:15px;">
                <div>
                    <label style="font-size:11px; color:#888; display:block; margin-bottom:4px;">De la:</label>
                    <input type="date" id="periodStart" value="${firstOfMonth}" style="padding:8px; border-radius:8px; border:1px solid #ffaa33; background:rgba(255,170,0,0.1); color:#e0e0e0;">
                </div>
                <div>
                    <label style="font-size:11px; color:#888; display:block; margin-bottom:4px;">Până la:</label>
                    <input type="date" id="periodEnd" value="${today}" style="padding:8px; border-radius:8px; border:1px solid #ffaa33; background:rgba(255,170,0,0.1); color:#e0e0e0;">
                </div>
                <button onclick="generatePeriodReport()" style="padding:8px 16px; background:#ff8c00; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">🔍 Generează</button>
                <button onclick="exportPeriodCSV()" style="padding:8px 16px; background:#00ff88; color:black; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">📥 CSV</button>
            </div>
            <div id="periodResults">
                <p style="color:#888; text-align:center;">Selectează perioada și apasă Generează</p>
            </div>
        </div>
    `;
}

function generatePeriodReport() {
    const startStr = document.getElementById('periodStart')?.value;
    const endStr = document.getElementById('periodEnd')?.value;
    if (!startStr || !endStr) return;
    
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T23:59:59');
    
    const allInPeriod = clients.filter(c => {
        const startDate = c.startDate ? new Date(c.startDate + 'T12:00:00') : null;
        const createdDate = c.createdAt ? new Date(c.createdAt) : null;
        const updatedDate = c.updatedAt ? new Date(c.updatedAt) : null;
        
        if (startDate && startDate >= start && startDate <= end) return true;
        if (createdDate && createdDate >= start && createdDate <= end) return true;
        if (updatedDate && updatedDate >= start && updatedDate <= end) return true;
        return false;
    });
    
    const createdNew = allInPeriod.filter(c => 
        c.createdAt && new Date(c.createdAt) >= start && new Date(c.createdAt) <= end &&
        c.startDate && new Date(c.startDate + 'T12:00:00') >= start
    );
    
    const renewed = allInPeriod.filter(c => 
        !createdNew.includes(c)
    );
    
    const byType = {};
    allInPeriod.forEach(c => {
        const name = SUBSCRIPTIONS[c.subscription]?.name || c.subscription || 'Necunoscut';
        byType[name] = (byType[name] || 0) + 1;
    });
    
    const entries = auditLog.filter(l => l.action.includes('Intrare') && new Date(l.timestamp) >= start && new Date(l.timestamp) <= end);
    const colors = {'Adult Full':'#3266ad','Elev Full':'#993556','Adult Standard':'#ba7517','Elev Standard':'#1d9e75','2 Săptămâni':'#888780'};
    
    const days = Math.ceil((end-start)/(1000*60*60*24));
    const dailyCounts = {};
    entries.forEach(l => {
        const d = l.timestamp.split('T')[0];
        dailyCounts[d] = (dailyCounts[d] || 0) + 1;
    });
    const maxDay = Math.max(...Object.values(dailyCounts), 1);
    const dayLabels = [];
    for (let i = 0; i < Math.min(days, 31); i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        dayLabels.push(d.toISOString().split('T')[0]);
    }
    
    window._periodAll = allInPeriod;
    window._periodNew = createdNew;
    window._periodRenewed = renewed;
    
    document.getElementById('periodResults').innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:15px;">
            <div onclick="filterPeriodList('all')" style="cursor:pointer; text-align:center; background:rgba(255,170,0,0.1); border:2px solid rgba(255,170,0,0.3); border-radius:10px; padding:12px;" onmouseover="this.style.background='rgba(255,170,0,0.2)'" onmouseout="this.style.background='rgba(255,170,0,0.1)'">
                <div style="font-size:28px; font-weight:bold; color:#ffaa00;">${allInPeriod.length}</div>
                <div style="font-size:11px; color:#ffaa00;">Total abonamente</div>
                <div style="font-size:10px; color:#888;">Click pentru listă</div>
            </div>
            <div onclick="filterPeriodList('new')" style="cursor:pointer; text-align:center; background:rgba(0,255,136,0.1); border-radius:10px; padding:12px;" onmouseover="this.style.background='rgba(0,255,136,0.2)'" onmouseout="this.style.background='rgba(0,255,136,0.1)'">
                <div style="font-size:28px; font-weight:bold; color:#00ff88;">${createdNew.length}</div>
                <div style="font-size:11px; color:#00ff88;">🆕 Create noi</div>
                <div style="font-size:10px; color:#888;">Click pentru listă</div>
            </div>
            <div onclick="filterPeriodList('renewed')" style="cursor:pointer; text-align:center; background:rgba(255,170,0,0.1); border-radius:10px; padding:12px;" onmouseover="this.style.background='rgba(255,170,0,0.2)'" onmouseout="this.style.background='rgba(255,170,0,0.1)'">
                <div style="font-size:28px; font-weight:bold; color:#ffaa00;">${renewed.length}</div>
                <div style="font-size:11px; color:#ffaa00;">🔄 Reînnoite</div>
                <div style="font-size:10px; color:#888;">Click pentru listă</div>
            </div>
            <div style="text-align:center; background:rgba(100,150,255,0.1); border-radius:10px; padding:12px;">
                <div style="font-size:28px; font-weight:bold; color:#6496ff;">${entries.length}</div>
                <div style="font-size:11px; color:#6496ff;">Intrări sală</div>
            </div>
        </div>
        
        <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px; margin-bottom:15px;">
            <h4 style="color:#ffaa33; margin-bottom:10px;">📊 Distribuție tipuri abonament</h4>
            ${Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([name, count]) => {
                const pctVal = Math.round(count/allInPeriod.length*100);
                const color = colors[name] || '#888';
                return `
                    <div style="margin-bottom:8px;">
                        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
                            <span style="color:#e0e0e0;">${name}</span>
                            <span style="color:${color}; font-weight:bold;">${count} (${pctVal}%)</span>
                        </div>
                        <div style="background:rgba(255,255,255,0.1); border-radius:4px; height:8px;">
                            <div style="width:${pctVal}%; height:100%; background:${color}; border-radius:4px;"></div>
                        </div>
                    </div>
                `;
            }).join('') || '<p style="color:#888;text-align:center;">Nicio tranzacție</p>'}
        </div>
        
        <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px; margin-bottom:15px;">
            <h4 style="color:#ffaa33; margin-bottom:10px;">Intrări zilnice în perioadă</h4>
            <div style="display:flex; align-items:flex-end; gap:3px; height:60px; overflow-x:auto;">
                ${dayLabels.map(d => {
                    const count = dailyCounts[d] || 0;
                    const h = count > 0 ? Math.round((count/maxDay)*50) : 2;
                    const dayNum = new Date(d + 'T12:00:00').getDate();
                    return `
                        <div style="min-width:16px; flex:1; display:flex; flex-direction:column; align-items:center; gap:2px;">
                            <div style="width:100%; height:${h}px; background:${count > 0 ? '#3266ad' : 'rgba(255,255,255,0.05)'}; border-radius:2px 2px 0 0;"></div>
                            <span style="font-size:8px; color:#666;">${dayNum}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <div id="periodClientList"></div>
    `;
}

function filterPeriodList(filter) {
    const container = document.getElementById('periodClientList');
    if (!container) return;
    
    if (container.dataset.filter === filter) {
        container.innerHTML = '';
        container.dataset.filter = '';
        return;
    }
    container.dataset.filter = filter;
    
    let list, title, color;
    if (filter === 'new') { list = window._periodNew; title = `🆕 Create noi (${list.length})`; color = '#00ff88'; }
    else if (filter === 'renewed') { list = window._periodRenewed; title = `🔄 Reînnoite (${list.length})`; color = '#ffaa00'; }
    else { list = window._periodAll; title = `📋 Toate abonamentele (${list.length})`; color = '#ffaa33'; }
    
    container.innerHTML = `
        <div style="background:rgba(30,41,59,0.8); border-radius:12px; padding:15px; border:1px solid ${color}40;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="color:${color}; margin:0;">${title}</h4>
                <button onclick="document.getElementById('periodClientList').innerHTML=''; document.getElementById('periodClientList').dataset.filter='';" style="background:transparent; border:1px solid #666; color:#888; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:11px;">✕</button>
            </div>
            <div style="max-height:250px; overflow-y:auto;">
                ${renderComparatiuClients(list || [])}
            </div>
        </div>
    `;
}

window.filterPeriodList = filterPeriodList;

function exportPeriodCSV() {
    const startStr = document.getElementById('periodStart')?.value;
    const endStr = document.getElementById('periodEnd')?.value;
    if (!startStr || !endStr) { showNotification('Selectează perioada!', 'error'); return; }
    
    const start = new Date(startStr + 'T00:00:00');
    const end = new Date(endStr + 'T23:59:59');
    const created = clients.filter(c => c.createdAt && new Date(c.createdAt) >= start && new Date(c.createdAt) <= end);
    
    const csv = [['Nume','Prenume','Abonament','Data creare','Creat de','Expirare'].join(',')];
    created.forEach(c => {
        csv.push([`"${c.nume}"`,`"${c.prenume}"`,`"${SUBSCRIPTIONS[c.subscription]?.name || c.subscription}"`,`"${new Date(c.createdAt).toLocaleDateString('ro-RO')}"`,`"${c.createdBy||'N/A'}"`,`"${new Date(c.expiration).toLocaleDateString('ro-RO')}"`].join(','));
    });
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `raport_${startStr}_${endStr}.csv`;
    a.click();
    showNotification('CSV exportat!', 'success');
}

// ════════ TAB 6 — ACTIVITATE UTILIZATORI ════════
function renderTabActivitate() {
    const today = getTodayDate();
    const usersList = [...new Set(auditLog.map(l => l.user))].filter(u => u !== 'GUEST');
    
    return `
        <div style="background:rgba(30,41,59,0.6); border-radius:12px; padding:15px; margin-bottom:15px;">
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin-bottom:15px;">
                <div>
                    <label style="font-size:11px; color:#888; display:block; margin-bottom:4px;">Ziua:</label>
                    <input type="date" id="activityDate" value="${today}" style="padding:8px; border-radius:8px; border:1px solid #ffaa33; background:rgba(255,170,0,0.1); color:#e0e0e0;">
                </div>
                <div>
                    <label style="font-size:11px; color:#888; display:block; margin-bottom:4px;">Utilizator:</label>
                    <select id="activityUser" style="padding:8px; border-radius:8px; border:1px solid #ffaa33; background:rgba(20,30,50,0.9); color:#e0e0e0;">
                        <option value="">Toți utilizatorii</option>
                        ${usersList.map(u => `<option value="${u}">${u}</option>`).join('')}
                    </select>
                </div>
                <button onclick="generateActivityReport()" style="padding:8px 16px; background:#ff8c00; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">🔍 Vezi activitate</button>
            </div>
            <div id="activityResults">
                <p style="color:#888; text-align:center;">Selectează ziua și utilizatorul</p>
            </div>
        </div>
    `;
}

function generateActivityReport() {
    const dateStr = document.getElementById('activityDate')?.value;
    const selectedUser = document.getElementById('activityUser')?.value;
    if (!dateStr) return;
    
    let filtered = auditLog.filter(l => l.timestamp.startsWith(dateStr));
    if (selectedUser) filtered = filtered.filter(l => l.user === selectedUser);
    
    filtered = filtered.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Grupează pe utilizator
    const byUser = {};
    filtered.forEach(l => {
        if (!byUser[l.user]) byUser[l.user] = [];
        byUser[l.user].push(l);
    });
    
    // Abonamente create în ziua respectivă
    const createdThatDay = clients.filter(c => c.createdAt && c.createdAt.startsWith(dateStr));
    const renewedThatDay = clients.filter(c => c.updatedAt && c.updatedAt.startsWith(dateStr));
    
    if (filtered.length === 0) {
        document.getElementById('activityResults').innerHTML = '<p style="color:#888; text-align:center;">Nicio activitate înregistrată pentru ziua și utilizatorul selectat</p>';
        return;
    }
    
    document.getElementById('activityResults').innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:15px;">
            <div style="text-align:center; background:rgba(100,150,255,0.1); border-radius:10px; padding:12px;">
                <div style="font-size:24px; font-weight:bold; color:#6496ff;">${filtered.length}</div>
                <div style="font-size:11px; color:#6496ff;">Acțiuni totale</div>
            </div>
            <div onclick="toggleActivitySection('created-${dateStr}')" style="cursor:pointer; text-align:center; background:rgba(0,255,136,0.1); border-radius:10px; padding:12px;" onmouseover="this.style.background='rgba(0,255,136,0.2)'" onmouseout="this.style.background='rgba(0,255,136,0.1)'">
                <div style="font-size:24px; font-weight:bold; color:#00ff88;">${createdThatDay.length}</div>
                <div style="font-size:11px; color:#00ff88;">Abonamente create</div>
                <div style="font-size:10px; color:#888;">Click pentru listă</div>
            </div>
            <div onclick="toggleActivitySection('renewed-${dateStr}')" style="cursor:pointer; text-align:center; background:rgba(255,170,0,0.1); border-radius:10px; padding:12px;" onmouseover="this.style.background='rgba(255,170,0,0.2)'" onmouseout="this.style.background='rgba(255,170,0,0.1)'">
                <div style="font-size:24px; font-weight:bold; color:#ffaa00;">${renewedThatDay.length}</div>
                <div style="font-size:11px; color:#ffaa00;">Reînnoite</div>
                <div style="font-size:10px; color:#888;">Click pentru listă</div>
            </div>
        </div>
        
        <div id="activity-created-${dateStr}" style="display:none; margin-bottom:15px;"></div>
        <div id="activity-renewed-${dateStr}" style="display:none; margin-bottom:15px;"></div>
        
        ${Object.entries(byUser).map(([user, logs]) => {
            const userRole = logs[0]?.userRole || '';
            const roleColor = userRole === 'admin' ? '#ff8c00' : userRole === 'manager' ? '#6496ff' : '#00ff88';
            
            const actionSummary = {};
            logs.forEach(l => {
                actionSummary[l.action] = (actionSummary[l.action] || 0) + 1;
            });
            
            return `
                <div style="background:rgba(20,30,50,0.8); border-radius:12px; padding:15px; margin-bottom:10px; border-left:4px solid ${roleColor};">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="background:${roleColor}; color:black; padding:3px 10px; border-radius:6px; font-size:11px; font-weight:bold;">${userRole.toUpperCase()}</span>
                            <strong style="color:#fff; font-size:15px;">👤 ${user}</strong>
                        </div>
                        <span style="color:#888; font-size:12px;">${logs.length} acțiuni</span>
                    </div>
                    
                    <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">
                        ${Object.entries(actionSummary).map(([action, count]) => `
                            <span style="background:rgba(255,255,255,0.08); padding:3px 10px; border-radius:15px; font-size:11px; color:#ccc;">
                                ${action}: <strong style="color:#ffaa33;">${count}</strong>
                            </span>
                        `).join('')}
                    </div>
                    
                    <div style="max-height:200px; overflow-y:auto;">
                        ${logs.map(l => `
                            <div style="display:flex; gap:10px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px;">
                                <span style="color:#ffaa33; min-width:55px; flex-shrink:0;">${new Date(l.timestamp).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}</span>
                                <span style="color:#fff;">${l.action}</span>
                                ${l.details ? `<span style="color:#888; font-size:11px;">— ${l.details.substring(0,60)}${l.details.length>60?'...':''}</span>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('')}
    `;
    
    window._activityCreated = createdThatDay;
    window._activityRenewed = renewedThatDay;
}

function toggleActivitySection(sectionId) {
    const el = document.getElementById(`activity-${sectionId}`);
    if (!el) return;
    
    if (el.style.display !== 'none') {
        el.style.display = 'none';
        return;
    }
    
    const isCreated = sectionId.startsWith('created');
    const list = isCreated ? window._activityCreated : window._activityRenewed;
    const color = isCreated ? '#00ff88' : '#ffaa00';
    const title = isCreated ? 'Abonamente create' : 'Abonamente reînnoite';
    
    el.style.display = 'block';
    el.innerHTML = `
        <div style="background:rgba(30,41,59,0.8); border-radius:10px; padding:12px; border:1px solid ${color}40;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <h4 style="color:${color}; margin:0;">${title} (${list.length})</h4>
                <button onclick="document.getElementById('activity-${sectionId}').style.display='none'" style="background:transparent; border:1px solid #666; color:#888; padding:2px 8px; border-radius:5px; cursor:pointer; font-size:11px;">✕</button>
            </div>
            ${list.map(c => `
                <div onclick="closeModal(); setTimeout(()=>showClientDetails(${c.id}),100);" style="display:flex; align-items:center; gap:10px; padding:7px; margin-bottom:5px; background:rgba(255,255,255,0.03); border-radius:8px; cursor:pointer;">
                    ${c.photo ? `<img src="${c.photo}" style="width:35px;height:35px;border-radius:7px;object-fit:cover;">` : '<div style="width:35px;height:35px;background:#333;border-radius:7px;display:flex;align-items:center;justify-content:center;">👤</div>'}
                    <div style="flex:1;">
                        <p style="margin:0; font-weight:bold; font-size:13px;">${c.prenume} ${c.nume}</p>
                        <p style="margin:0; font-size:11px; color:#888;">📦 ${SUBSCRIPTIONS[c.subscription]?.name || c.subscription} | 👤 ${c.createdBy||'N/A'}</p>
                    </div>
                    <span style="font-size:11px; color:${color};">${isCreated ? new Date(c.createdAt).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'}) : new Date(c.updatedAt).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}</span>
                </div>
            `).join('') || `<p style="color:#888; text-align:center;">Niciun abonament</p>`}
        </div>
    `;
}

window.toggleReportList = toggleReportList;
window.generatePeriodReport = generatePeriodReport;
window.exportPeriodCSV = exportPeriodCSV;
window.generateActivityReport = generateActivityReport;
window.toggleActivitySection = toggleActivitySection;


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

    // INTRARE - ultimul client cu scanare impară (1,3,5... = intrare)
    const entryClients = clients.filter(c => 
         c.nfcScansToday >= 1 && 
         c.lastScanTimestamp &&
         c.nfcScansToday % 2 === 1
     );
    const sortedEntry = [...entryClients].sort((a, b) => (b.lastScanTimestamp || 0) - (a.lastScanTimestamp || 0));
    const latestEntry = sortedEntry[0];

    const entryList = document.getElementById('entryList');
      if (!latestEntry) {
         entryList.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">⏳ Niciun client la intrare</p>';
    } else {
    const daysLeft = getClientDaysLeft(latestEntry);
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

// IEȘIRE - ultimul client cu scanare pară (2,4,6... = ieșire)
    const exitClients = clients.filter(c => 
      c.nfcScansToday >= 2 && 
      c.lastScanTimestamp &&
      c.nfcScansToday % 2 === 0
    );
    const sortedExit = [...exitClients].sort((a, b) => (b.lastScanTimestamp || 0) - (a.lastScanTimestamp || 0));
    const latestExit = sortedExit[0];

    const exitList = document.getElementById('exitList');
       if (!latestExit) {
          exitList.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">⏳ Niciun client la ieșire</p>';
      } else {
    const daysLeft = getClientDaysLeft(latestExit);
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

    // CLIENȚI ÎN SALĂ - sortează după ora intrării
    const inGymClients = clients.filter(c => c.isInGym === true && c.nfcScansToday === 1);
    const sortedGymClients = [...inGymClients].sort((a, b) => {
    const timeA = a.lastScanTimestamp || 0;
    const timeB = b.lastScanTimestamp || 0;
    return timeB - timeA; // Cel mai recent primul
   });
    
    const gymList = document.getElementById('gymList');
    if (sortedGymClients.length === 0) {
        gymList.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">🏋️ Sala este goală</p>';
    } else {
        gymList.innerHTML = sortedGymClients.map(client => {
            const checkInTime = clientCheckIns[client.id] ? new Date(clientCheckIns[client.id]).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
            const daysLeft = getClientDaysLeft(client);
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

    document.getElementById('gymCount').textContent = sortedGymClients.length;
    
    updateStatsCards();
}

function updateStatsCards() {
    const todayStr = getTodayDate();
    const todayEntries = auditLog.filter(l => 
        l.timestamp.startsWith(todayStr) && l.action.includes('Intrare')
    ).length;

    const todayEl = document.getElementById('statTodayEntries');
    if (todayEl) todayEl.textContent = todayEntries;

    const weekChart = document.getElementById('weekChart');
    if (weekChart) {
        const dayCounts = [1,2,3,4,5,6,0].map(dow => {
            const d = new Date();
            const diff = (d.getDay() - dow + 7) % 7;
            const dayDate = new Date(d);
            dayDate.setDate(d.getDate() - diff);
            const dayStr = dayDate.toISOString().split('T')[0];
            return auditLog.filter(l => 
                l.timestamp.startsWith(dayStr) && l.action.includes('Intrare')
            ).length;
        });
        
        const maxCount = Math.max(...dayCounts, 1);
        const todayIndex = [1,2,3,4,5,6,0].indexOf(new Date().getDay());
        
        weekChart.innerHTML = dayCounts.map((count, i) => {
            const height = Math.max(Math.round((count / maxCount) * 30), count > 0 ? 3 : 1);
            const isToday = i === todayIndex;
            const color = isToday ? '#ffaa00' : 'rgba(255,170,0,0.4)';
            return `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:35px;">
                    ${count > 0 ? `<span style="font-size:8px; color:#ffaa00;">${count}</span>` : ''}
                    <div style="width:100%; height:${height}px; background:${color}; border-radius:2px 2px 0 0;"></div>
                </div>
            `;
        }).join('');
    }

}

  function getClientDaysLeft(client) {
    if (!client.expiration) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expirationDate = new Date(client.expiration);
    expirationDate.setHours(0, 0, 0, 0);
    
    const timeDiff = expirationDate - today;
    const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
    
    return daysLeft <= 0 ? 0 : daysLeft;
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
    // Update carduri statistici
    const todayStr = getTodayDate();
    const todayEntries = auditLog.filter(l => 
        l.timestamp.startsWith(todayStr) && l.action.includes('Intrare')
    ).length;

    const todayEl = document.getElementById('statTodayEntries');
    if (todayEl) todayEl.textContent = todayEntries;

    // Grafic săptămânal - Lu=1, Ma=2, Mi=3, Jo=4, Vi=5, Sâ=6, Du=0
    const weekChart = document.getElementById('weekChart');
    if (weekChart) {
        const dayCounts = [1,2,3,4,5,6,0].map(dow => {
            const d = new Date();
            const diff = (d.getDay() - dow + 7) % 7;
            const dayDate = new Date(d);
            dayDate.setDate(d.getDate() - diff);
            const dayStr = dayDate.toISOString().split('T')[0];
            return auditLog.filter(l => 
                l.timestamp.startsWith(dayStr) && l.action.includes('Intrare')
            ).length;
        });
        
        const maxCount = Math.max(...dayCounts, 1);
        const today = new Date().getDay();
        const todayIndex = [1,2,3,4,5,6,0].indexOf(today);
        
        weekChart.innerHTML = dayCounts.map((count, i) => {
            const height = Math.max(Math.round((count / maxCount) * 30), count > 0 ? 3 : 1);
            const isToday = i === todayIndex;
            const color = isToday ? '#ffaa00' : 'rgba(255,170,0,0.4)';
            return `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:35px;">
                    ${count > 0 ? `<span style="font-size:8px; color:#ffaa00;">${count}</span>` : ''}
                    <div style="width:100%; height:${height}px; background:${color}; border-radius:2px 2px 0 0;"></div>
                </div>
            `;
        }).join('');
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
    client.isInGym = true;
    clientCheckIns[client.id] = new Date().toISOString();
    addHistoryEntry(clientId, 'checkin', `Intrare în sală - ${client.prenume} ${client.nume}`);
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
    const daysLeft = getClientDaysLeft(client);
    const access = checkClientAccess(client);
    const statusColor = getStatusColor(client);
    const historyCount = (clientHistory[client.id] || []).length;

    const html = `
        <div class="box scroll-box" style="width: 500px; max-width: 95%;">
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
                <p><strong>📜 Evenimente în istoric:</strong> ${historyCount}</p>
            </div>

            <div class="actions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="editClient(${client.id})" style="flex: 1; min-width: 70px; background: #ff8c00; color: white; border: none; border-radius: 8px; cursor: pointer; padding: 10px;">✏️ Editează</button>
                <button onclick="openClientHistory(${client.id})" style="flex: 1; min-width: 70px; background: #6496ff; color: white; border: none; border-radius: 8px; cursor: pointer; padding: 10px;">📜 Istoric</button>
                <button onclick="openRenewalModal(${client.id})" style="flex: 1; min-width: 70px; background: #00d4ff; color: black; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; padding: 10px;">🔄 Reînnoire</button>
                <button onclick="togglePaid(${client.id})" style="flex: 1; min-width: 70px; background: #00ff88; color: black; border: none; border-radius: 8px; cursor: pointer; padding: 10px;">💰 Plată</button>
                <button onclick="resetUsage(${client.id})" style="flex: 1; min-width: 70px; background: #ffaa00; color: black; border: none; border-radius: 8px; cursor: pointer; padding: 10px;">🔄 Reset Zi</button>
                <button onclick="deleteClient(${client.id})" style="flex: 1; min-width: 70px; background: #ff6b6b; color: white; border: none; border-radius: 8px; cursor: pointer; padding: 10px;">🗑️ Șterge</button>
                <button onclick="closeModal()" style="flex: 1; min-width: 70px; background: #666; color: white; border: none; border-radius: 8px; cursor: pointer; padding: 10px;">❌ Închide</button>
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
    const expired = clients.filter(c => getClientDaysLeft(c) === 0);
    if (expired.length === 0) {
        showNotification('Nu sunt clienți expirați!', 'success');
        return;
    }
    if (confirm(`Ștergi ${expired.length} clienți expirați?`)) {
        clients = clients.filter(c => getClientDaysLeft(c) > 0);
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
    const subInfo = SUBSCRIPTIONS[client.subscription];
    
    if (!subInfo) {
        return { allowed: false, message: 'Abonament invalid', status: 'expired', daysLeft: 0 };
    }

    if (!client.isPaid) {
        return { allowed: false, message: 'Neachitat', status: 'expired', daysLeft: 0 };
    }

    const daysLeft = getClientDaysLeft(client);

    if (daysLeft === 0) {
        return { allowed: false, message: 'Expirat', status: 'expired', daysLeft: 0 };
    }

    if (daysLeft <= 3) {
        return { allowed: true, message: `Expiră în ${daysLeft} ${daysLeft === 1 ? 'zi' : 'zile'}`, status: 'warning', daysLeft };
    }

    if (currentHour < subInfo.startHour || currentHour >= subInfo.endHour) {
        return { allowed: false, message: 'În afara programului', status: 'schedule', daysLeft };
    }

    return { allowed: true, message: 'Acces permis', status: 'active', daysLeft };
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

    setTimeout(() => checkAndDoAutoBackup(), 3000);
    
    console.log('✅ GYM CORE SYSTEM v6.0 Ready!');
    console.log('Demo: admin/1234 | manager/1234 | staff/1234');
});

function scanTagForAdd() {
    showNotification('🟢 Scanează cardul NFC...', 'success');
    
    const originalOnMessage = nfcSocket.onmessage;
    
    nfcSocket.onmessage = (event) => {
        const tag = event.data.trim().toLowerCase();
        const tagInput = document.getElementById('tag');
        if (tagInput) {
            tagInput.value = tag;
            showNotification(`✅ Tag preluat: ${tag}`, 'success');
            tagInput.style.borderColor = '#00ff88';
            tagInput.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.5)';
            setTimeout(() => {
                tagInput.style.borderColor = '';
                tagInput.style.boxShadow = '';
            }, 2000);
        }
        nfcSocket.onmessage = originalOnMessage;
    };
    
    setTimeout(() => {
        if (nfcSocket.onmessage !== originalOnMessage) {
            nfcSocket.onmessage = originalOnMessage;
            showNotification('⏰ Scanare anulată (timeout)', 'error');
        }
    }, 10000);
}

function reconnectNFC() {
    //console.log('🔄 Încercare reconectare NFC...');
    const nfcStatusText = document.getElementById('nfc-status-text');
    const reconnectBtn = document.getElementById('nfc-reconnect-btn');
    
    if (nfcStatusText) {
        nfcStatusText.innerHTML = '🟡 Se reconectează...';
        nfcStatusText.style.color = '#ffaa00';
    }
    if (reconnectBtn) {
        reconnectBtn.disabled = true;
        reconnectBtn.style.opacity = '0.5';
    }
    
    if (nfcSocket && nfcSocket.readyState === WebSocket.OPEN) {
        nfcSocket.close();
    }
    
    const newSocket = new WebSocket("ws://localhost:5500");
    
    newSocket.onopen = () => {
        console.log("✅ WebSocket reconectat cu succes!");
        if (nfcStatusText) {
            nfcStatusText.innerHTML = '🟢 NFC Online';
            nfcStatusText.style.color = '#00ff88';
        }
        if (reconnectBtn) {
            reconnectBtn.disabled = false;
            reconnectBtn.style.opacity = '1';
        }
        showNotification('✅ Conexiune NFC restabilită!', 'success');
    };
    
    newSocket.onerror = () => {
        console.log("❌ Eroare la reconectare");
        if (nfcStatusText) {
            nfcStatusText.innerHTML = '🔴 NFC Offline';
            nfcStatusText.style.color = '#ff6b6b';
        }
        if (reconnectBtn) {
            reconnectBtn.disabled = false;
            reconnectBtn.style.opacity = '1';
        }
        showNotification('❌ Nu se poate conecta la serverul NFC!', 'error');
    };
    
    newSocket.onmessage = nfcSocket.onmessage;
    
    window.nfcSocket = newSocket;
}



document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeAllModals();
    }
});

// ================= ISTORIC CLIENTI =================
let clientHistory = JSON.parse(localStorage.getItem('clientHistory')) || {};

function saveClientHistory() {
    localStorage.setItem('clientHistory', JSON.stringify(clientHistory));
}

function addHistoryEntry(clientId, type, details = '') {
    if (!clientHistory[clientId]) {
        clientHistory[clientId] = [];
    }
    
    clientHistory[clientId].push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: type,
        details: details,
        user: currentUser || 'SYSTEM',
        date: getTodayDate(),
        time: new Date().toLocaleTimeString('ro-RO')
    });
    
    saveClientHistory();
}

function openClientHistory(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const history = clientHistory[clientId] || [];
    
    // Calculează statistici
    const checkins = history.filter(h => h.type === 'checkin');
    const checkouts = history.filter(h => h.type === 'checkout');
    const uniqueDays = [...new Set(checkins.map(h => h.date))];
    
    // Grupează pe luni
    const byMonth = {};
    checkins.forEach(h => {
        const month = h.date.substring(0, 7);
        if (!byMonth[month]) byMonth[month] = new Set();
        byMonth[month].add(h.date);
    });
    
    const months = Object.keys(byMonth).sort().reverse();
    const currentMonth = new Date().toISOString().substring(0, 7);
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().substring(0, 7);
    
    const daysCurrentMonth = byMonth[currentMonth] ? byMonth[currentMonth].size : 0;
    const daysLastMonth = byMonth[lastMonth] ? byMonth[lastMonth].size : 0;
    
    // Calculează ore de intrare
    const hourCounts = {};
    checkins.forEach(h => {
        const hour = h.time ? h.time.substring(0, 2) : '00';
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const html = `
        <div class="box scroll-box" style="width: 900px; max-width: 95%;">
            <h2 style="color: #ffaa33;">📜 ISTORIC CLIENT</h2>
            
            <!-- Header client -->
            <div style="display: flex; gap: 15px; margin-bottom: 20px; padding: 15px; background: rgba(255,140,0,0.1); border-radius: 15px; align-items: center;">
                <div>
                    ${client.photo ? `<img src="${client.photo}" style="width: 80px; height: 80px; border-radius: 15px; object-fit: cover;">` : '<div style="width:80px;height:80px;background:#333;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:40px;">👤</div>'}
                </div>
                <div>
                    <p style="font-size: 20px; font-weight: bold; margin: 0;">${client.prenume} ${client.nume}</p>
                    <p style="font-size: 12px; color: #888; margin: 5px 0;">🏷️ Tag: ${client.tag || 'N/A'}</p>
                    <p style="font-size: 12px; color: #ffaa33;">📦 ${SUBSCRIPTIONS[client.subscription]?.name || client.subscription}</p>
                </div>
                <div style="margin-left: auto; display: flex; gap: 15px; flex-wrap: wrap;">
                    <div style="text-align: center; background: rgba(0,255,136,0.1); padding: 12px 20px; border-radius: 12px;">
                        <div style="font-size: 28px; font-weight: bold; color: #00ff88;">${uniqueDays.length}</div>
                        <div style="font-size: 11px; color: #00ff88;">Zile totale</div>
                    </div>
                    <div style="text-align: center; background: rgba(100,150,255,0.1); padding: 12px 20px; border-radius: 12px;">
                        <div style="font-size: 28px; font-weight: bold; color: #6496ff;">${daysCurrentMonth}</div>
                        <div style="font-size: 11px; color: #6496ff;">Luna aceasta</div>
                    </div>
                    <div style="text-align: center; background: rgba(255,170,0,0.1); padding: 12px 20px; border-radius: 12px;">
                        <div style="font-size: 28px; font-weight: bold; color: #ffaa33;">${daysLastMonth}</div>
                        <div style="font-size: 11px; color: #ffaa33;">Luna trecută</div>
                    </div>
                </div>
            </div>
            
            <!-- Tab-uri -->
            <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
                <button onclick="switchHistoryTab('calendar', ${clientId})" id="historyTabCalendar" style="flex:1; padding:12px; background:#ff8c00; color:white; border:none; border-radius:10px; cursor:pointer; font-weight:bold;">📅 Calendar</button>
                <button onclick="switchHistoryTab('grafice', ${clientId})" id="historyTabGrafice" style="flex:1; padding:12px; background:transparent; border:2px solid #ffaa33; border-radius:10px; cursor:pointer; color:#ffaa33; font-weight:bold;">📊 Grafice</button>
                <button onclick="switchHistoryTab('access', ${clientId})" id="historyTabAccess" style="flex:1; padding:12px; background:transparent; border:2px solid #ffaa33; border-radius:10px; cursor:pointer; color:#ffaa33; font-weight:bold;">🚪 Intrări/Ieșiri</button>
                <button onclick="switchHistoryTab('subscriptions', ${clientId})" id="historyTabSubscriptions" style="flex:1; padding:12px; background:transparent; border:2px solid #ffaa33; border-radius:10px; cursor:pointer; color:#ffaa33; font-weight:bold;">📦 Abonamente</button>
                <button onclick="switchHistoryTab('stats', ${clientId})" id="historyTabStats" style="flex:1; padding:12px; background:transparent; border:2px solid #ffaa33; border-radius:10px; cursor:pointer; color:#ffaa33; font-weight:bold;">📈 Statistici</button>
            </div>
            
            <div id="historyContent" style="max-height: 500px; overflow-y: auto;">
                ${renderHistoryContent(history, 'calendar', client)}
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button onclick="exportClientHistory(${clientId})" style="flex:1; background:#00ff88; color:black; padding:10px; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">📥 Exportă CSV</button>
                <button onclick="showClientDetails(${clientId})" style="flex:1; background:#6496ff; color:white; padding:10px; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">◀ Înapoi</button>
            </div>
        </div>
    `;
    
    openModal(html);
    window.currentHistoryClientId = clientId;
}

function renderHistoryContent(history, type, client) {
    const checkins = history.filter(h => h.type === 'checkin');
    const uniqueDays = [...new Set(checkins.map(h => h.date))];
    
    // Grupează pe luni
    const byMonth = {};
    checkins.forEach(h => {
        const month = h.date.substring(0, 7);
        if (!byMonth[month]) byMonth[month] = new Set();
        byMonth[month].add(h.date);
    });
    
    // ════════ CALENDAR ════════
    if (type === 'calendar') {
        const months = Object.keys(byMonth).sort().reverse();
        const allMonths = [];
        
        // Adaugă și luna curentă și luna trecută chiar dacă nu are prezențe
        const now = new Date();
        for (let i = 0; i < 3; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = d.toISOString().substring(0, 7);
            if (!allMonths.includes(key)) allMonths.push(key);
        }
        months.forEach(m => { if (!allMonths.includes(m)) allMonths.push(m); });
        allMonths.sort().reverse();
        
        const monthNames = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
        const dayNames = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du'];
        
        return allMonths.map(monthKey => {
            const [year, month] = monthKey.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            const firstDay = new Date(year, month - 1, 1).getDay();
            const startOffset = firstDay === 0 ? 6 : firstDay - 1;
            const presentDays = byMonth[monthKey] ? byMonth[monthKey].size : 0;
            
            let calendarHTML = `
                <div style="margin-bottom: 25px; background: rgba(30,41,59,0.6); border-radius: 15px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="color: #ffaa33; margin: 0;">${monthNames[month-1]} ${year}</h3>
                        <div style="display: flex; gap: 15px;">
                            <span style="background: rgba(0,255,136,0.2); color: #00ff88; padding: 5px 15px; border-radius: 20px; font-weight: bold;">✅ ${presentDays} zile prezent</span>
                            <span style="background: rgba(255,107,107,0.2); color: #ff6b6b; padding: 5px 15px; border-radius: 20px; font-weight: bold;">❌ ${daysInMonth - presentDays} zile absent</span>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center;">
            `;
            
            // Zilele săptămânii
            dayNames.forEach(d => {
                calendarHTML += `<div style="color: #888; font-size: 11px; font-weight: bold; padding: 5px 0;">${d}</div>`;
            });
            
            // Celule goale la început
            for (let i = 0; i < startOffset; i++) {
                calendarHTML += `<div></div>`;
            }
            
            // Zilele lunii
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const isPresent = byMonth[monthKey] && byMonth[monthKey].has(dateStr);
                const isToday = dateStr === new Date().toISOString().split('T')[0];
                
                // Găsește ora intrării pentru această zi
                const checkinEntry = checkins.find(h => h.date === dateStr);
                const hour = checkinEntry && checkinEntry.time ? checkinEntry.time.substring(0,5) : '';
                
                calendarHTML += `
                    <div style="
                        background: ${isPresent ? 'rgba(0,255,136,0.25)' : 'rgba(255,255,255,0.03)'};
                        border: ${isToday ? '2px solid #ffaa33' : isPresent ? '1px solid rgba(0,255,136,0.4)' : '1px solid rgba(255,255,255,0.05)'};
                        border-radius: 8px;
                        padding: 6px 2px;
                        min-height: 45px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                    ">
                        <span style="font-size: 13px; font-weight: bold; color: ${isPresent ? '#00ff88' : isToday ? '#ffaa33' : '#666'};">${day}</span>
                        ${isPresent ? `<span style="font-size: 9px; color: #00cc66;">${hour}</span>` : ''}
                    </div>
                `;
            }
            
            calendarHTML += `</div></div>`;
            return calendarHTML;
        }).join('');
    }
    
    // ════════ GRAFICE ════════
    if (type === 'grafice') {
        const months = Object.keys(byMonth).sort();
        const monthNames = ['Ian','Feb','Mar','Apr','Mai','Iun','Iul','Aug','Sep','Oct','Nov','Dec'];
        
        // Grafic bare - zile pe lună
        const maxDays = Math.max(...Object.values(byMonth).map(s => s.size), 1);
        
        // Grafic ore
        const hourCounts = {};
        checkins.forEach(h => {
            const hour = h.time ? parseInt(h.time.substring(0,2)) : 0;
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });
        const maxHour = Math.max(...Object.values(hourCounts), 1);
        
        // Comparație luna curentă vs luna trecută
        const now = new Date();
        const currentMonth = now.toISOString().substring(0, 7);
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().substring(0, 7);
        const daysCurrentMonth = byMonth[currentMonth] ? byMonth[currentMonth].size : 0;
        const daysLastMonth = byMonth[lastMonth] ? byMonth[lastMonth].size : 0;
        const diff = daysCurrentMonth - daysLastMonth;
        
        return `
            <div style="padding: 10px;">
                
                <!-- Grafic zile pe lună -->
                <div style="background: rgba(30,41,59,0.6); border-radius: 15px; padding: 15px; margin-bottom: 20px;">
                    <h4 style="color: #ffaa33; margin-bottom: 15px;">📊 Zile prezență pe lună</h4>
                    <div style="display: flex; align-items: flex-end; gap: 8px; height: 150px; padding: 0 10px;">
                        ${months.map(m => {
                            const [y, mo] = m.split('-');
                            const days = byMonth[m].size;
                            const height = Math.round((days / maxDays) * 130);
                            const isCurrentMonth = m === currentMonth;
                            return `
                                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px;">
                                    <span style="font-size: 11px; color: ${isCurrentMonth ? '#00ff88' : '#ffaa33'}; font-weight: bold;">${days}</span>
                                    <div style="width: 100%; height: ${height}px; background: ${isCurrentMonth ? '#00ff88' : '#6496ff'}; border-radius: 6px 6px 0 0; min-height: 4px; transition: height 0.3s;"></div>
                                    <span style="font-size: 10px; color: #888;">${monthNames[parseInt(mo)-1]}</span>
                                </div>
                            `;
                        }).join('')}
                        ${months.length === 0 ? '<p style="color:#888;text-align:center;width:100%;">Nicio prezență înregistrată</p>' : ''}
                    </div>
                </div>
                
                <!-- Comparație luna curentă vs trecută -->
                <div style="background: rgba(30,41,59,0.6); border-radius: 15px; padding: 15px; margin-bottom: 20px;">
                    <h4 style="color: #ffaa33; margin-bottom: 15px;">📈 Comparație luni</h4>
                    <div style="display: flex; gap: 15px;">
                        <div style="flex: 1; text-align: center; background: rgba(0,255,136,0.1); padding: 15px; border-radius: 12px;">
                            <div style="font-size: 36px; font-weight: bold; color: #00ff88;">${daysCurrentMonth}</div>
                            <div style="color: #00ff88; font-size: 12px;">Luna aceasta</div>
                        </div>
                        <div style="flex: 1; text-align: center; background: rgba(100,150,255,0.1); padding: 15px; border-radius: 12px;">
                            <div style="font-size: 36px; font-weight: bold; color: #6496ff;">${daysLastMonth}</div>
                            <div style="color: #6496ff; font-size: 12px;">Luna trecută</div>
                        </div>
                        <div style="flex: 1; text-align: center; background: ${diff >= 0 ? 'rgba(0,255,136,0.1)' : 'rgba(255,107,107,0.1)'}; padding: 15px; border-radius: 12px;">
                            <div style="font-size: 36px; font-weight: bold; color: ${diff >= 0 ? '#00ff88' : '#ff6b6b'};">${diff >= 0 ? '+' : ''}${diff}</div>
                            <div style="color: #888; font-size: 12px;">${diff >= 0 ? '📈 Mai activ' : '📉 Mai puțin activ'}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Grafic ore intrare -->
                <div style="background: rgba(30,41,59,0.6); border-radius: 15px; padding: 15px;">
                    <h4 style="color: #ffaa33; margin-bottom: 15px;">🕐 Ore preferate de intrare</h4>
                    <div style="display: flex; align-items: flex-end; gap: 4px; height: 100px;">
                        ${Array.from({length: 16}, (_, i) => i + 6).map(hour => {
                            const count = hourCounts[hour] || 0;
                            const height = count > 0 ? Math.round((count / maxHour) * 80) : 0;
                            return `
                                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;">
                                    ${count > 0 ? `<span style="font-size: 9px; color: #ffaa33;">${count}</span>` : ''}
                                    <div style="width: 100%; height: ${height}px; background: #ffaa33; border-radius: 3px 3px 0 0; min-height: ${count > 0 ? '4' : '0'}px;"></div>
                                    <span style="font-size: 9px; color: #666;">${hour}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <p style="color: #888; font-size: 11px; margin-top: 8px; text-align: center;">Ora intrării (6:00 - 21:00)</p>
                </div>
            </div>
        `;
    }
    
    // ════════ INTRĂRI/IEȘIRI ════════
    if (type === 'access') {
        const accessHistory = history.filter(h => h.type === 'checkin' || h.type === 'checkout');
        if (accessHistory.length === 0) {
            return '<p style="color:#888;text-align:center;padding:40px;">🚪 Nicio intrare/ieșire înregistrată</p>';
        }
        
        // Grupează pe zile
        const byDay = {};
        accessHistory.forEach(h => {
            if (!byDay[h.date]) byDay[h.date] = [];
            byDay[h.date].push(h);
        });
        
        const sortedDays = Object.keys(byDay).sort().reverse();
        
        return sortedDays.map(date => {
            const entries = byDay[date];
            const checkin = entries.find(e => e.type === 'checkin');
            const checkout = entries.find(e => e.type === 'checkout');
            
            let duration = '';
            if (checkin && checkout) {
                const inTime = new Date(`${date}T${checkin.time}`);
                const outTime = new Date(`${date}T${checkout.time}`);
                const mins = Math.round((outTime - inTime) / 60000);
                if (mins > 0) duration = `⏱️ ${mins} min`;
            }
            
            return `
                <div style="padding: 12px; margin-bottom: 8px; background: rgba(30,41,59,0.6); border-radius: 10px; border-left: 4px solid #00ff88;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: #ffaa33;">📅 ${new Date(date + 'T12:00:00').toLocaleDateString('ro-RO', {weekday:'long', day:'numeric', month:'long'})}</strong>
                        ${duration ? `<span style="color: #6496ff; font-size: 12px;">${duration}</span>` : ''}
                    </div>
                    <div style="display: flex; gap: 20px; margin-top: 8px;">
                        ${checkin ? `<span style="color: #00ff88;">✅ Intrare: ${checkin.time}</span>` : '<span style="color:#666;">✅ N/A</span>'}
                        ${checkout ? `<span style="color: #ff6b6b;">❌ Ieșire: ${checkout.time}</span>` : '<span style="color:#666;">❌ N/A</span>'}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // ════════ ABONAMENTE ════════
    if (type === 'subscriptions') {
        const subsHistory = history.filter(h => h.type === 'subscription_created' || h.type === 'subscription_extended');
        if (subsHistory.length === 0) {
            return '<p style="color:#888;text-align:center;padding:40px;">📦 Niciun abonament înregistrat</p>';
        }
        return subsHistory.map(entry => `
            <div style="padding: 15px; margin-bottom: 12px; background: rgba(100,150,255,0.1); border-radius: 12px; border-left: 4px solid #6496ff;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="font-weight:bold; color:#6496ff;">${entry.type === 'subscription_created' ? '➕ CREARE' : '🔄 REÎNNOIRE'}</span>
                    <span style="color:#888;">${entry.date} ${entry.time}</span>
                </div>
                <p style="margin: 8px 0 0 0;">${entry.details}</p>
                <p style="margin: 5px 0 0 0; color:#ffaa33;">👤 ${entry.user}</p>
            </div>
        `).join('');
    }
    
    // ════════ STATISTICI ════════
    if (type === 'stats') {
        const totalVisits = uniqueDays.length;
        const firstVisit = checkins.length > 0 ? checkins[0] : null;
        const lastVisit = checkins.length > 0 ? checkins[checkins.length-1] : null;
        
        // Zile pe săptămână
        const dayOfWeekCount = {0:0,1:0,2:0,3:0,4:0,5:0,6:0};
        checkins.forEach(h => {
            const dow = new Date(h.date + 'T12:00:00').getDay();
            dayOfWeekCount[dow]++;
        });
        const dowNames = ['Du','Lu','Ma','Mi','Jo','Vi','Sâ'];
        const maxDow = Math.max(...Object.values(dayOfWeekCount), 1);
        
        // Cea mai activă lună
        let bestMonth = '-';
        let bestMonthDays = 0;
        const monthNames = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
        Object.entries(byMonth).forEach(([m, days]) => {
            if (days.size > bestMonthDays) {
                bestMonthDays = days.size;
                const [y, mo] = m.split('-');
                bestMonth = `${monthNames[parseInt(mo)-1]} ${y} (${days.size} zile)`;
            }
        });
        
        return `
            <div style="padding: 10px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                    <div style="background: rgba(0,255,136,0.1); padding: 15px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; color: #00ff88;">${totalVisits}</div>
                        <div style="color: #00ff88;">Total zile la sală</div>
                    </div>
                    <div style="background: rgba(100,150,255,0.1); padding: 15px; border-radius: 12px; text-align: center;">
                        <div style="font-size: 32px; font-weight: bold; color: #6496ff;">${Object.keys(byMonth).length}</div>
                        <div style="color: #6496ff;">Luni active</div>
                    </div>
                    <div style="background: rgba(255,170,0,0.1); padding: 15px; border-radius: 12px;">
                        <div style="font-size: 12px; color: #888;">🌟 Prima vizită</div>
                        <div style="color: #ffaa33; font-weight: bold;">${firstVisit ? new Date(firstVisit.date + 'T12:00:00').toLocaleDateString('ro-RO') : 'N/A'}</div>
                    </div>
                    <div style="background: rgba(255,170,0,0.1); padding: 15px; border-radius: 12px;">
                        <div style="font-size: 12px; color: #888;">🕐 Ultima vizită</div>
                        <div style="color: #ffaa33; font-weight: bold;">${lastVisit ? new Date(lastVisit.date + 'T12:00:00').toLocaleDateString('ro-RO') : 'N/A'}</div>
                    </div>
                </div>
                
                <div style="background: rgba(30,41,59,0.6); border-radius: 15px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="color: #ffaa33; margin-bottom: 10px;">🏆 Cea mai activă lună</h4>
                    <p style="color: #00ff88; font-weight: bold;">${bestMonth}</p>
                </div>
                
                <div style="background: rgba(30,41,59,0.6); border-radius: 15px; padding: 15px;">
                    <h4 style="color: #ffaa33; margin-bottom: 15px;">📅 Zile preferate din săptămână</h4>
                    <div style="display: flex; align-items: flex-end; gap: 8px; height: 80px;">
                        ${[1,2,3,4,5,6,0].map(dow => {
                            const count = dayOfWeekCount[dow];
                            const height = Math.round((count / maxDow) * 60);
                            return `
                                <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
                                    ${count > 0 ? `<span style="font-size:10px;color:#ffaa33;">${count}</span>` : ''}
                                    <div style="width:100%; height:${height}px; background:#ffaa33; border-radius:4px 4px 0 0; min-height:${count>0?'4':'0'}px;"></div>
                                    <span style="font-size:11px;color:#888;">${dowNames[dow]}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }
    
    return '<p style="color:#888;text-align:center;">Selectează o categorie</p>';
}

function switchHistoryTab(tab, clientId) {
    const history = clientHistory[clientId] || [];
    const client = clients.find(c => c.id === clientId);
    const content = document.getElementById('historyContent');
    if (content) {
        content.innerHTML = renderHistoryContent(history, tab, client);
    }
    
    const tabMap = {
        'calendar': 'historyTabCalendar',
        'grafice': 'historyTabGrafice', 
        'access': 'historyTabAccess',
        'subscriptions': 'historyTabSubscriptions',
        'stats': 'historyTabStats'
    };
    
    Object.entries(tabMap).forEach(([t, btnId]) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        if (t === tab) {
            btn.style.background = '#ff8c00';
            btn.style.color = 'white';
            btn.style.border = 'none';
        } else {
            btn.style.background = 'transparent';
            btn.style.color = '#ffaa33';
            btn.style.border = '2px solid #ffaa33';
        }
    });
}

function getHistoryTypeIcon(type) {
    switch(type) {
        case 'checkin': return '✅';
        case 'checkout': return '❌';
        case 'subscription_created': return '➕';
        case 'subscription_extended': return '✏️';
        case 'edited': return '📝';
        default: return '📌';
    }
}

function getHistoryTypeName(type) {
    switch(type) {
        case 'checkin': return 'Intrare sală';
        case 'checkout': return 'Ieșire sală';
        case 'subscription_created': return 'Abonament creat';
        case 'subscription_extended': return 'Abonament prelungit';
        case 'edited': return 'Date modificate';
        default: return 'Eveniment';
    }
}

function getHistoryTypeColor(type) {
    switch(type) {
        case 'checkin': return '#00ff88';
        case 'checkout': return '#ff6b6b';
        case 'subscription_created': return '#6496ff';
        case 'subscription_extended': return '#ffaa33';
        case 'edited': return '#ffaa33';
        default: return '#888';
    }
}

function exportClientHistory(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const history = clientHistory[clientId] || [];
    
    const csv = [['Data', 'Ora', 'Tip', 'Detalii', 'Utilizator'].join(',')];
    history.forEach(entry => {
        csv.push([
            `"${entry.date}"`,
            `"${entry.time}"`,
            `"${getHistoryTypeName(entry.type)}"`,
            `"${entry.details.replace(/"/g, '""')}"`,
            `"${entry.user}"`
        ].join(','));
    });
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `istoric_${client.prenume}_${client.nume}_${getTodayDate()}.csv`;
    a.click();
    showNotification('Istoric exportat!', 'success');
}

// ========== REÎNNOIRE ABONAMENT ==========

let currentRenewalClient = null;

function openRenewalModal(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expireDate = new Date(client.expiration);
    expireDate.setHours(0, 0, 0, 0);
    
    // Verifică dacă abonamentul este activ
    if (expireDate > today) {
        showNotification(`❌ Abonament activ până la ${expireDate.toLocaleDateString('ro-RO')}. Poți reînnoi doar după expirare!`, 'error');
        return;
    }
    
    currentRenewalClient = { ...client };
    
    const renewalModal = document.getElementById('renewalModal');
    if (!renewalModal) {
        showNotification('Eroare: Modal reînnoire negăsit!', 'error');
        return;
    }
    
    const clientNameSpan = document.getElementById('renewalClientName');
    const currentSubSpan = document.getElementById('renewalCurrentSub');
    
    if (clientNameSpan) clientNameSpan.innerHTML = `${client.prenume} ${client.nume}`;
    if (currentSubSpan) {
        const subName = SUBSCRIPTIONS[client.subscription]?.name || client.subscription;
        currentSubSpan.innerHTML = `Abonament curent: ${subName} (expiră ${new Date(client.expiration).toLocaleDateString('ro-RO')})`;
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('renewalStartDate');
    if (startDateInput) startDateInput.value = todayStr;
    
    const subSelect = document.getElementById('renewalSubscription');
    if (subSelect) {
        if (client.subscription && [...subSelect.options].some(opt => opt.value === client.subscription)) {
            subSelect.value = client.subscription;
        } else {
            subSelect.value = 'adult_standard';
        }
    }
    
    updateRenewalDays();
    updateRenewalExpirePreview();
    
    renewalModal.style.display = 'flex';
}

function updateRenewalDays() {
    const subType = document.getElementById('renewalSubscription')?.value;
    let days = 30;
    
    switch(subType) {
        case 'elev_standard':
        case 'elev_full':
        case 'adult_standard':
        case 'adult_full':
            days = 30;
            break;
        case '2weeks':
            days = 15;
            break;
        default:
            days = 30;
    }
    
    const daysInput = document.getElementById('renewalDays');
    if (daysInput) daysInput.value = days;
    updateRenewalExpirePreview();
}

function updateRenewalExpirePreview() {
    const startDateStr = document.getElementById('renewalStartDate')?.value;
    const days = parseInt(document.getElementById('renewalDays')?.value || 30);
    
    if (!startDateStr) return;
    
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    
    const expireDate = new Date(startDate);
    expireDate.setDate(expireDate.getDate() + days);
    
    const formattedExpire = expireDate.toLocaleDateString('ro-RO');
    const previewSpan = document.getElementById('renewalExpirePreview');
    if (previewSpan) {
        previewSpan.innerHTML = formattedExpire;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        previewSpan.style.color = expireDate < today ? '#ff6b6b' : '#00ff88';
    }
}

function confirmRenewal() {
    if (!currentRenewalClient) return;
    
    const newSubType = document.getElementById('renewalSubscription')?.value;
    const startDateStr = document.getElementById('renewalStartDate')?.value;
    const days = parseInt(document.getElementById('renewalDays')?.value || 30);
    
    if (!startDateStr) {
        showNotification('Te rog selectează data început!', 'error');
        return;
    }
    
    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    
    const expireDate = new Date(startDate);
    expireDate.setDate(expireDate.getDate() + days);
    
    const originalClient = clients.find(c => c.id === currentRenewalClient.id);
    if (!originalClient) return;
    
    const oldSubName = SUBSCRIPTIONS[originalClient.subscription]?.name || originalClient.subscription;
    const newSubName = SUBSCRIPTIONS[newSubType]?.name || newSubType;
    
    addHistoryEntry(originalClient.id, 'subscription_extended', 
        `Reînnoire abonament: ${oldSubName} → ${newSubName} | Valabil de la ${startDate.toLocaleDateString('ro-RO')} până la ${expireDate.toLocaleDateString('ro-RO')} (${days} zile)`);
    
    originalClient.subscription = newSubType;
    originalClient.startDate = startDateStr; // folosește string-ul direct din input, fără conversie
    originalClient.expiration = new Date(startDateStr + 'T12:00:00');
    originalClient.expiration.setDate(originalClient.expiration.getDate() + days -1);
    originalClient.expiration = originalClient.expiration.toISOString().split('T')[0];
    originalClient.duration = days;
    
    originalClient.usedToday = false;
    originalClient.isInGym = false;
    originalClient.nfcScansToday = 0;
    
    saveClientsToStorage();
    addToAuditLog('Reînnoire abonament', `${originalClient.prenume} ${originalClient.nume} - ${newSubName} - ${days} zile - Expiră: ${originalClient.expiration}`);
    showNotification(`✅ Abonament reînnoit cu succes!\n📅 Valabil până la ${expireDate.toLocaleDateString('ro-RO')}`, 'success');
    
    closeRenewalModal();
    initClientCards();
    
    closeModal();
    setTimeout(() => showClientDetails(originalClient.id), 100);
}

function closeRenewalModal() {
    const modal = document.getElementById('renewalModal');
    if (modal) modal.style.display = 'none';
    currentRenewalClient = null;
}

function initRenewalModalEvents() {
    const subSelect = document.getElementById('renewalSubscription');
    if (subSelect) {
        subSelect.removeEventListener('change', updateRenewalDays);
        subSelect.addEventListener('change', updateRenewalDays);
    }
    
    const startDateInput = document.getElementById('renewalStartDate');
    if (startDateInput) {
        startDateInput.removeEventListener('change', updateRenewalExpirePreview);
        startDateInput.addEventListener('change', updateRenewalExpirePreview);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRenewalModalEvents);
} else {
    initRenewalModalEvents();
}

window.openRenewalModal = openRenewalModal;
window.confirmRenewal = confirmRenewal;
window.closeRenewalModal = closeRenewalModal;
window.updateRenewalDays = updateRenewalDays;
window.updateRenewalExpirePreview = updateRenewalExpirePreview;

window.openClientHistory = openClientHistory;
window.switchHistoryTab = switchHistoryTab;
window.exportClientHistory = exportClientHistory;
window.toggleSubscriptionsList = toggleSubscriptionsList;
window.showTodayCreatedList = showTodayCreatedList;
window.showTodayActivityList = showTodayActivityList;
window.showClientsInGymList = showClientsInGymList;
window.generateCustomPeriodReport = generateCustomPeriodReport;
window.compareMonths = compareMonths;
window.compareYears = compareYears;

// Funcția getDaysLeft rămâne pentru compatibilitate
function getDaysLeft(expiration) {
    if (!expiration) return 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expirationDate = new Date(expiration);
    expirationDate.setHours(0, 0, 0, 0);
    
    const timeDiff = expirationDate - today;
    const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
    
    return daysLeft <= 0 ? 0 : daysLeft;
}

function getMonthPayments(monthKey) {
    const all = clients.filter(c => {
        const isNew = c.startDate && c.startDate.startsWith(monthKey) && 
                      c.createdAt && c.createdAt.startsWith(monthKey);
        
        const isRenewed = c.startDate && c.startDate.startsWith(monthKey) && 
                          c.createdAt && !c.createdAt.startsWith(monthKey);
        
        const isRenewedByUpdate = c.updatedAt && c.updatedAt.startsWith(monthKey) &&
                                   c.createdAt && !c.createdAt.startsWith(monthKey);
        
        return isNew || isRenewed || isRenewedByUpdate;
    });
    
    const createdNew = all.filter(c => 
        c.createdAt && c.createdAt.startsWith(monthKey)
    );
    
    const renewed = all.filter(c => 
        c.createdAt && !c.createdAt.startsWith(monthKey)
    );
    
    const byType = {};
    all.forEach(c => {
        const name = SUBSCRIPTIONS[c.subscription]?.name || c.subscription || 'Necunoscut';
        byType[name] = (byType[name] || 0) + 1;
    });
    
    return {
        total: all.length,
        created: createdNew.length,
        renewed: renewed.length,
        byType,
        clients: all
    };
}

window.getMonthPayments = getMonthPayments;

// ════════════════════════════════════════════════════════════════════
// 💾 BACKUP AUTOMAT ZILNIC
// ════════════════════════════════════════════════════════════════════

function checkAndDoAutoBackup() {
    const lastBackup = localStorage.getItem('lastAutoBackup');
    const today = getTodayDate();
    
    if (lastBackup === today) return; // Deja s-a făcut azi
    
    // Calculează câte zile au trecut de la ultimul backup
    const daysSinceBackup = lastBackup ? 
        Math.floor((new Date(today) - new Date(lastBackup)) / (1000 * 60 * 60 * 24)) : 999;
    
    // Fă backup automat
    doAutoBackup();
    
    // Arată avertisment dacă nu s-a făcut backup de 2+ zile
    if (daysSinceBackup >= 2) {
        showBackupWarning(daysSinceBackup);
    }
}

function doAutoBackup() {
    try {
        const today = getTodayDate();
        
        const backupData = {
            backupDate: new Date().toISOString(),
            version: '6.0',
            clients: clients,
            users: users,
            auditLog: auditLog.slice(-500), // ultimele 500 intrări
            clientHistory: clientHistory
        };
        
        const dataStr = JSON.stringify(backupData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gym_backup_${today}.json`;
        
        // Descarcă silențios
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Salvează data ultimului backup
        localStorage.setItem('lastAutoBackup', today);
        localStorage.setItem('lastAutoBackupSize', (dataStr.length / 1024).toFixed(1));
        
        console.log(`✅ Backup automat făcut: gym_backup_${today}.json`);
        
    } catch (err) {
        console.error('❌ Eroare backup automat:', err);
    }
}

function showBackupWarning(days) {
    const warning = document.createElement('div');
    warning.id = 'backupWarning';
    warning.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #ff4444, #cc0000);
        color: white;
        padding: 15px 20px;
        text-align: center;
        z-index: 99999;
        font-weight: bold;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
        box-shadow: 0 4px 20px rgba(255,0,0,0.4);
    `;
    warning.innerHTML = `
        <span>⚠️ ATENȚIE: Nu s-a făcut backup de ${days} zile! Datele pot fi pierdute!</span>
        <button onclick="doManualBackup()" style="
            background: white;
            color: #cc0000;
            border: none;
            padding: 8px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            font-size: 13px;
        ">💾 Fă Backup Acum</button>
        <button onclick="document.getElementById('backupWarning').remove()" style="
            background: rgba(255,255,255,0.2);
            color: white;
            border: 1px solid white;
            padding: 8px 15px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
        ">✕ Închide</button>
    `;
    document.body.appendChild(warning);
}

function doManualBackup() {
    doAutoBackup();
    const warning = document.getElementById('backupWarning');
    if (warning) warning.remove();
    showNotification('✅ Backup salvat cu succes!', 'success');
}

function getStorageUsage() {
    let total = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            total += localStorage[key].length + key.length;
        }
    }
    return (total / 1024).toFixed(1); // KB
}

function showStorageIndicator() {
    const usedKB = parseFloat(getStorageUsage());
    const usedMB = (usedKB / 1024).toFixed(2);
    const percentUsed = ((usedKB / 1024) / 5 * 100).toFixed(1);
    const lastBackup = localStorage.getItem('lastAutoBackup') || 'Niciodată';
    
    let color = '#00ff88';
    let status = '✅ OK';
    if (percentUsed > 60) { color = '#ffaa00'; status = '⚠️ Atenție'; }
    if (percentUsed > 80) { color = '#ff6b6b'; status = '🔴 Critic'; }
    
    const indicator = document.getElementById('storageIndicator');
    if (indicator) {
        indicator.innerHTML = `
            <div style="padding: 15px; background: rgba(30,41,59,0.9); border-radius: 12px;">
                <h4 style="color: #ffaa33; margin-bottom: 15px;">💾 Spațiu localStorage</h4>
                <div style="background: rgba(255,255,255,0.1); border-radius: 10px; height: 20px; margin-bottom: 10px; overflow: hidden;">
                    <div style="width: ${percentUsed}%; height: 100%; background: ${color}; border-radius: 10px; transition: width 0.3s;"></div>
                </div>
                <p style="color: ${color}; margin: 5px 0;">${status} — ${usedMB}MB din 5MB (${percentUsed}%)</p>
                <p style="color: #888; font-size: 12px; margin: 5px 0;">📅 Ultimul backup: ${lastBackup}</p>
                <p style="color: #888; font-size: 12px; margin: 5px 0;">👥 Clienți: ${clients.length}</p>
                <button onclick="doManualBackup()" style="
                    width: 100%;
                    padding: 10px;
                    background: #00ff88;
                    color: black;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    margin-top: 10px;
                ">💾 Backup Manual Acum</button>
            </div>
        `;
    }
}

function restoreFromBackup(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            
            // Verifică dacă e un backup valid
            if (!backup.clients || !backup.version) {
                showNotification('❌ Fișier backup invalid!', 'error');
                return;
            }
            
            const backupDate = new Date(backup.backupDate).toLocaleDateString('ro-RO');
            
            if (confirm(`Restaurezi backup din ${backupDate}?\n${backup.clients.length} clienți vor fi restaurați.\nDatele curente vor fi înlocuite!`)) {
                clients = backup.clients;
                if (backup.users) users = backup.users;
                if (backup.auditLog) auditLog = backup.auditLog;
                if (backup.clientHistory) clientHistory = backup.clientHistory;
                
                saveClientsToStorage();
                saveUsers();
                saveAuditLog();
                saveClientHistory();
                
                addToAuditLog('Restaurare backup', `Backup din ${backupDate} - ${clients.length} clienți`);
                showNotification(`✅ Backup restaurat! ${clients.length} clienți restaurați.`, 'success');
                closeModal();
                initClientCards();
            }
        } catch (err) {
            showNotification('❌ Eroare la restaurare: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
}