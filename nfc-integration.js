// NFC WebSocket connection
const ws = new WebSocket("ws://localhost:8080");

ws.onopen = () => {
    console.log("NFC WebSocket conectat");
    updateNFCStatus("🟢 NFC Connected");
};

ws.onclose = () => {
    console.log("NFC WebSocket deconectat");
    updateNFCStatus("🔴 NFC Offline");
};

ws.onerror = (err) => {
    console.error("NFC WebSocket error:", err);
    updateNFCStatus("🔴 NFC Error");
};

ws.onmessage = (event) => {
    const uid = event.data;
    console.log("TAG primit:", uid);

    handleNFCTag(uid);
};

// pune UID în input automat
function handleNFCTag(uid) {
    const tagInput = document.getElementById("tag");

    if (tagInput) {
        tagInput.value = uid;
        tagInput.focus();
    }

    // dacă search e deschis
    const searchInput = document.getElementById("search");
    if (searchInput && document.getElementById("searchModal").classList.contains("active")) {
        searchInput.value = uid;
        searchClient();
    }

    updateNFCStatus("🟡 Tag citit: " + uid);
}

// status UI
function updateNFCStatus(text) {
    const el = document.getElementById("nfc-status");
    if (el) el.textContent = text;
}