// ================= VARIABILE GLOBALE ================= 
let isLoggedIn = false;
let currentUser = null;
let clients = JSON.parse(localStorage.getItem('clients')) || [];
let currentCameraStream = null;

// Definire abonamente
const SUBSCRIPTIONS = {
    'elev_standard': {
        name: 'Elev Standard',
        duration: 30,
        startHour: 7,
        endHour: 17,
        endHourStrict: 16,
        endMinuteStrict: 40
    },
    'elev_full': {
        name: 'Elev Full',
        duration: 30,
        startHour: 7,
        endHour: 21
    },
    'adult_standard': {
        name: 'Adult Standard',
        duration: 30,
        startHour: 7,
        endHour: 17,
        endHourStrict: 16,
        endMinuteStrict: 40
    },
    'adult_full': {
        name: 'Adult Full',
        duration: 30,
        startHour: 7,
        endHour: 21
    },
    '2weeks': {
        name: '2 Săptămâni',
        duration: 15,
        startHour: 7,
        endHour: 17,
        endHourStrict: 16,
        endMinuteStrict: 40
    }
};

// ================= UTILITY FUNCTIONS ================= 
function getTodayDate() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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

function resetDailyUsageIfNeeded() {
    const lastResetDate = localStorage.getItem('lastDailyReset');
    const todayDate = getTodayDate();

    if (lastResetDate !== todayDate) {
        clients.forEach(client => {
            client.usedToday = false;
        });
        saveClientsToStorage();
        localStorage.setItem('lastDailyReset', todayDate);
        console.log('✅ Daily usage reset');
    }
}

// ================= MODAL FUNCTIONS ================= 
function closeAllModals() {
    document.getElementById('addModal').classList.remove('active');
    document.getElementById('searchModal').classList.remove('active');
    document.getElementById('loginModal').classList.remove('active');
}

// ================= ADD CLIENT ================= 
function openAdd() {
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

    // Validare
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

    // Calculează data expirării
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
        createdAt: new Date().toISOString()
    };

    clients.push(newClient);
    saveClientsToStorage();

    showNotification(`✅ Client ${prenume} ${nume} adăugat!`, 'success');
    closeAdd();
    initClientCards();
}

// ================= SEARCH ================= 
function openSearch() {
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
            ${client.photo ? `<img src="${client.photo}" alt="${client.prenume}" style="width: 60px; height: 60px; border-radius: 10px; object-fit: cover;">` : `<div style="width: 60px; height: 60px; background: #333; border-radius: 10px; display: flex; align-items: center; justify-content: center;">👤</div>`}
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

// ================= SETTINGS ================= 
function openSettings() {
    alert('⚙️ Setări - Feature în dezvoltare');
}

// ================= REPORTS ================= 
function openReports() {
    alert('📊 Rapoarte - Feature în dezvoltare');
}

// ================= LOGIN ================= 
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

    // Validare (demo: admin/1234)
    if (user === 'admin' && code === '1234') {
        isLoggedIn = true;
        currentUser = user;
        document.getElementById('currentUser').textContent = user.toUpperCase();
        document.getElementById('userArea').style.display = 'block';
        document.getElementById('loginBtn').style.display = 'none';
        closeLogin();
        showNotification(`✅ Bine ai venit, ${user}!`, 'success');
        initClientCards();
    } else {
        errorDiv.innerHTML = '<p style="color: #ff6b6b; margin: 10px 0;">❌ User sau cod incorect!</p>';
        document.getElementById('loginCode').value = '';
    }
}

function logout() {
    isLoggedIn = false;
    currentUser = null;
    document.getElementById('userArea').style.display = 'none';
    document.getElementById('userMenu').classList.remove('active');
    document.getElementById('loginBtn').style.display = 'block';
    showNotification('✅ Ești deconectat!', 'success');
    initClientCards();
}

function toggleUserMenu() {
    document.getElementById('userMenu').classList.toggle('active');
}

// Close menu on click outside
document.addEventListener('click', (e) => {
    const userMenu = document.getElementById('userMenu');
    const userArea = document.getElementById('userArea');
    if (!e.target.closest('#userArea') && userMenu.classList.contains('active')) {
        userMenu.classList.remove('active');
    }
});

// ================= CHECK ACCESS ================= 
function checkClientAccess(client) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const expirationDate = new Date(client.expiration);
    
    const subInfo = SUBSCRIPTIONS[client.subscription];
    
    // Verifică dacă a fost folosit azi
    if (client.usedToday) {
        return {
            allowed: false,
            message: '❌ Abonament folosit azi',
            status: 'expired'
        };
    }
    
    // Verifică plată
    if (!client.isPaid) {
        return {
            allowed: false,
            message: '❌ Abonament neachitat',
            status: 'expired'
        };
    }

    // Verifică expirare
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

    // Avertisment 3 zile
    if (daysLeft <= 3 && daysLeft > 0) {
        return {
            allowed: true,
            message: `⚠️ Expira în ${daysLeft} zile`,
            status: 'warning',
            daysLeft
        };
    }

    // Verifică intervale orare
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
                message: `❌ Abonament interval orar greșit`,
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
    if (!access.allowed) return '#ff6b6b'; // Roșu
    if (access.status === 'warning') return '#ffaa00'; // Galben
    return '#00ff88'; // Verde
}

function getStatusClass(client) {
    const access = checkClientAccess(client);
    if (!access.allowed) return 'expired';
    if (access.status === 'warning') return 'warning';
    return 'active';
}

// ================= CLIENT CARDS ================= 
function initClientCards() {
    const entryList = document.getElementById('entryList');
    const exitList = document.getElementById('exitList');
    const gymList = document.getElementById('gymList');

    // Filtrează clienți după acces
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
                        ${client.photo ? `<img src="${client.photo}" alt="${client.prenume}" style="width: 80px; height: 80px; border-radius: 12px; object-fit: cover; border: 3px solid ${getStatusColor(client)};">` : `<div style="width: 80px; height: 80px; background: #333; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 3px solid ${getStatusColor(client)};">👤</div>`}
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
        exitList.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Niciun client cu acces nepermiş</p>';
    } else {
        exitList.innerHTML = deniedClients.map(client => {
            const access = checkClientAccess(client);
            const expiration = new Date(client.expiration);
            const expirationFormatted = expiration.toLocaleDateString('ro-RO');
            
            return `
                <div class="client-card expired" onclick="onClientClick(${client.id}, false)" style="cursor: pointer; margin-bottom: 12px; padding: 12px; display: flex; gap: 15px; align-items: center;">
                    <div style="min-width: 80px;">
                        ${client.photo ? `<img src="${client.photo}" alt="${client.prenume}" style="width: 80px; height: 80px; border-radius: 12px; object-fit: cover; border: 3px solid #ff6b6b;">` : `<div style="width: 80px; height: 80px; background: #333; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 3px solid #ff6b6b;">👤</div>`}
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

    // ÎN SALĂ
    if (inGymClients.length === 0) {
        gymList.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">Sala este goală</p>';
    } else {
        gymList.innerHTML = inGymClients.map(client => {
            const statusClass = getStatusClass(client);
            const daysLeft = getDaysLeft(client.expiration);
            const expiration = new Date(client.expiration);
            const expirationFormatted = expiration.toLocaleDateString('ro-RO');
            
            return `
                <div class="client-card ${statusClass}" onclick="onClientClick(${client.id}, false)" style="cursor: pointer; margin-bottom: 12px; padding: 12px; display: flex; gap: 15px; align-items: center;">
                    <div style="min-width: 80px;">
                        ${client.photo ? `<img src="${client.photo}" alt="${client.prenume}" style="width: 80px; height: 80px; border-radius: 12px; object-fit: cover; border: 3px solid ${getStatusColor(client)};">` : `<div style="width: 80px; height: 80px; background: #333; border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 3px solid ${getStatusColor(client)};">👤</div>`}
                    </div>
                    <div style="flex: 1;">
                        <p style="font-weight: bold; font-size: 18px; margin: 0; color: #fff;">${client.prenume} ${client.nume}</p>
                        <p style="font-size: 14px; color: #888; margin: 5px 0;">Expira: <span style="color: #ffaa33; font-weight: bold;">${expirationFormatted}</span></p>
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

// ================= CHECK IN MODAL ================= 
function showCheckInModal(client) {
    const subInfo = SUBSCRIPTIONS[client.subscription];
    
    const html = `
        <div class="box" style="text-align: center;">
            <h2 style="color: #00ff88; margin-bottom: 20px;">✅ ACCES PERMIS</h2>
            
            ${client.photo ? `<img src="${client.photo}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 10px; margin-bottom: 15px;">` : ''}
            
            <p style="font-size: 20px; font-weight: bold; color: #ffaa33; margin-bottom: 10px;">${client.prenume} ${client.nume}</p>
            
            <div style="background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 255, 136, 0.05)); padding: 15px; border-radius: 10px; border-left: 4px solid #00ff88; margin-bottom: 15px;">
                <p><strong>Abonament:</strong> ${subInfo.name}</p>
                <p><strong>Acces azi:</strong> ${subInfo.startHour}:00 - ${subInfo.endHourStrict ? subInfo.endHourStrict + ':' + subInfo.endMinuteStrict : subInfo.endHour + ':00'}</p>
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
    saveClientsToStorage();
    
    showNotification(`✅ ${client.prenume} ${client.nume} - Intrare înregistrată!`, 'success');
    closeModal();
    initClientCards();
}

// ================= CLIENT DETAILS ================= 
function showClientDetails(clientOrId) {
    const client = typeof clientOrId === 'number' ? clients.find(c => c.id === clientOrId) : clientOrId;
    if (!client) return;

    const subInfo = SUBSCRIPTIONS[client.subscription];
    const daysLeft = getDaysLeft(client.expiration);
    const access = checkClientAccess(client);
    const statusColor = getStatusColor(client);
    const expiration = new Date(client.expiration);
    const expirationFormatted = expiration.toLocaleDateString('ro-RO');

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
            </div>

            <div class="actions">
                <button onclick="editClient(${client.id})" style="flex: 1;">✏️ Editează</button>
                <button onclick="togglePaid(${client.id})" style="flex: 1;">💳 ${client.isPaid ? 'Neachitat' : 'Plătit'}</button>
                <button onclick="resetUsage(${client.id})" style="flex: 1;">🔄 Reset Azi</button>
                <button onclick="deleteClient(${client.id})" style="flex: 1;">🗑️ Șterge</button>
                <button onclick="closeModal()" style="flex: 1;">❌ Închide</button>
            </div>
        </div>
    `;

    openModal(html);
}

// ================= EDIT CLIENT ================= 
function editClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const html = `
        <div class="box scroll-box">
            <h2 style="color: #ffaa33; text-align: center;">✏️ Editează Client</h2>
            
            <!-- Fotografie -->
            <div style="background: rgba(255, 140, 0, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #ffaa33; margin-bottom: 15px;">
                <p style="color: #ffaa33; font-weight: bold; margin-bottom: 10px;">FOTOGRAFIE</p>
                <div id="editPhotoPreview" style="width: 100%; height: 180px; background: #0f1b2e; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; border: 2px dashed rgba(255, 140, 0, 0.3); overflow: hidden;">
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
            
            // Adaugă buton capture
            let captureBtn = document.getElementById('editCaptureBtn');
            if (!captureBtn) {
                captureBtn = document.createElement('button');
                captureBtn.id = 'editCaptureBtn';
                captureBtn.textContent = '📸 Capturează';
                captureBtn.onclick = () => editCapturePhoto(clientId);
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
    showNotification('✅ Client actualizat!', 'success');
    closeModal();
    initClientCards();
}

// ================= CLIENT ACTIONS ================= 
function togglePaid(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    client.isPaid = !client.isPaid;
    saveClientsToStorage();
    showNotification(client.isPaid ? '✅ Marcat ca plătit!' : '❌ Marcat ca neachitat!', 'success');
    closeModal();
    initClientCards();
}

function resetUsage(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (confirm('Ești sigur că vrei să reseteazi utilizarea de azi?')) {
        client.usedToday = false;
        saveClientsToStorage();
        showNotification('🔄 Utilizare resetată!', 'success');
        closeModal();
        initClientCards();
    }
}

function deleteClient(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    if (confirm(`Ești sigur că vrei să ștergi ${client.prenume} ${client.nume}?`)) {
        clients = clients.filter(c => c.id !== clientId);
        saveClientsToStorage();
        showNotification('🗑️ Client șters!', 'success');
        closeModal();
        initClientCards();
    }
}

// ================= MODAL HELPER ================= 
function openModal(html) {
    closeAllModals();
    let modal = document.getElementById('detailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'detailModal';
        modal.className = 'modal';
        modal.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); justify-content: center; align-items: center; z-index: 9999; backdrop-filter: blur(6px); overflow: auto;';
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

// Close modal on click outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('detailModal');
    if (modal && e.target === modal) {
        closeModal();
    }
});

// ================= PAGE INIT ================= 
document.addEventListener('DOMContentLoaded', () => {
    resetDailyUsageIfNeeded();
    initClientCards();
    
    // Refresh la fiecare minut
    setInterval(() => {
        resetDailyUsageIfNeeded();
        initClientCards();
    }, 60000);
    
    console.log('✅ Sistem inițializat!');
    console.log('📝 Demo Login - User: admin | Cod: 1234');
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeAllModals();
    }
});