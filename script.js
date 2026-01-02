// ==================================================
// SERVICEPRO COMPLETE SCRIPT (Cloud DB + All UI Features)
// ==================================================

// --- 1. CONFIGURATION ---
const BASE_URL = 'https://0691fb63-24ec-4728-85ea-05b3b2145c59-00-3njhq9444p5wr.pike.replit.dev';
const API_URL = `${BASE_URL}/api/shops`;
const AUTH_URL = `${BASE_URL}/api`;

const DEFAULT_CENTER = { lat: 31.4880, lng: 74.3430 }; // Lahore
const CURRENT_USER_KEY = 'serviceCurrentUser';
const MAX_ALLOWED_RADIUS_KM = 2.5;

// --- 2. GLOBAL VARIABLES ---
let map;
let markers = [];
let currentUser = null;
let tempMarker = null;
let satelliteLayer, osmLayer;
let currentLayer = 'osm';
let userLocation = null;
let searchRadiusCircle = null;
let isVoiceEnabled = false;
let routingControl = null;
let currentDetailId = null;

// --- 3. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    checkLoginState();
    setupEventListeners();
    initChatbot(); // Restored Chatbot
    enableDraggableModals(); // Restored Dragging
});

// --- 4. MAP & LAYERS ---
function initMap() {
    map = L.map('map').setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);
    
    osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri, Maxar'
    });

    updateMapRadius(1);
    fetchShops();
    map.on('click', onMapClick);
}

function setBasemap(layerName) {
    if (currentLayer === layerName) return;
    if (layerName === 'osm') {
        if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
        map.addLayer(osmLayer);
        currentLayer = 'osm';
        document.getElementById('setOsmMap').classList.add('active');
        document.getElementById('setSatelliteMap').classList.remove('active');
    } else {
        if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);
        map.addLayer(satelliteLayer);
        currentLayer = 'satellite';
        document.getElementById('setOsmMap').classList.remove('active');
        document.getElementById('setSatelliteMap').classList.add('active');
    }
}

// --- 5. AUTHENTICATION (Cloud Connected) ---
async function login(username, password) {
    try {
        const response = await fetch(`${AUTH_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
            updateUIForUser();
            closeModal('loginModal');
            document.getElementById('loginForm').reset();
            alert(`Welcome, ${currentUser.username}!`);
        } else {
            alert(data.error || "Login failed");
        }
    } catch (error) {
        console.error(error);
        alert("Network Error: Is Replit Running?");
    }
}

async function register(username, password, role, question, answer) {
    try {
        const response = await fetch(`${AUTH_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role, question, answer })
        });
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data;
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
            updateUIForUser();
            closeModal('registerModal');
            document.getElementById('registerForm').reset();
            alert("Account created!");
        } else {
            alert(data.error || "Registration failed");
        }
    } catch (error) { console.error(error); }
}

function logout() {
    currentUser = null;
    localStorage.removeItem(CURRENT_USER_KEY);
    updateUIForUser();
    alert("Logged out.");
}

function checkLoginState() {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (stored) {
        currentUser = JSON.parse(stored);
        updateUIForUser();
    }
}

// --- 6. SHOPS & DATA (Cloud Connected) ---
async function fetchShops() {
    try {
        const response = await fetch(API_URL);
        const shops = await response.json();
        
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        shops.forEach(shop => {
            const marker = L.marker([shop.lat, shop.lng]).addTo(map);
            marker.bindPopup(`
                <b>${shop.name}</b><br>
                ${shop.service}<br>
                ${shop.phone}<br>
                ${currentUser && (currentUser.role === 'admin' || currentUser.id == shop.owner_id) ? 
                `<button onclick="deleteShop(${shop.id})" style="color:red">Delete</button>` : ''}
                <br><button onclick="routeToShop(${shop.lat}, ${shop.lng})" style="margin-top:5px;">Get Directions</button>
            `);
            markers.push(marker);
        });
        
        const countSpan = document.getElementById('adminTotalShops');
        if(countSpan) countSpan.innerText = shops.length;

    } catch (error) { console.error("Error loading shops:", error); }
}

async function addShop(name, service, phone, address, desc, lat, lng) {
    if (!currentUser) return alert("Login first");
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ownerId: currentUser.id,
                name, service, phone, address, description: desc, lat, lng
            })
        });

        if (response.ok) {
            alert("Shop Added!");
            closeModal('addProviderModal'); 
            fetchShops();
            if (tempMarker) map.removeLayer(tempMarker);
        } else {
            alert("Failed to add shop");
        }
    } catch (e) { console.error(e); }
}

async function deleteShop(id) {
    if(!confirm("Delete this shop?")) return;
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    fetchShops();
}

// --- 7. ADMIN PANEL (Cloud Connected) ---
async function openAdminPanel() {
    if(!currentUser || currentUser.role !== 'admin') return alert("Access Denied");
    
    openModal('adminModal');
    
    try {
        const res = await fetch(`${AUTH_URL}/users`);
        const users = await res.json();
        const userCountSpan = document.getElementById('adminTotalUsers');
        if(userCountSpan) userCountSpan.innerText = users.length;
        
        const statUsersBtn = document.getElementById('statUsers');
        if(statUsersBtn) statUsersBtn.onclick = () => renderAdminUserList(users);
    } catch(e) { console.error(e); }
    
    fetchShops();
}

function renderAdminUserList(users) {
    const container = document.getElementById('adminListContainer');
    const section = document.getElementById('adminListSection');
    if(section) section.style.display = 'block';
    if(container) {
        container.innerHTML = '';
        users.forEach(user => {
            const div = document.createElement('div');
            div.className = 'admin-list-item';
            div.style.padding = "10px";
            div.style.borderBottom = "1px solid #ccc";
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            div.innerHTML = `
                <span><b>${user.username}</b> (${user.role})</span>
                ${user.username !== 'admin' ? 
                `<button onclick="deleteUser(${user.id})" style="color:red;">Delete</button>` : ''}
            `;
            container.appendChild(div);
        });
    }
}

async function deleteUser(id) {
    if(!confirm("Delete this user?")) return;
    await fetch(`${AUTH_URL}/users/${id}`, { method: 'DELETE' });
    openAdminPanel();
}

// --- 8. VOICE & ROUTING (Restored from Old Code) ---
function toggleVoiceNavigation() {
    isVoiceEnabled = !isVoiceEnabled;
    const btn = document.getElementById('voiceToggleBtn');
    if (isVoiceEnabled) {
        btn.classList.add('active-voice');
        btn.innerHTML = '<i class="fas fa-volume-up"></i>';
        const utterance = new SpeechSynthesisUtterance("Voice navigation enabled.");
        window.speechSynthesis.speak(utterance);
    } else {
        btn.classList.remove('active-voice');
        btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        window.speechSynthesis.cancel();
    }
}

function locateUser() {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        userLocation = { lat, lng };
        map.setView([lat, lng], 16);
        if(window.userMarker) map.removeLayer(window.userMarker);
        window.userMarker = L.marker([lat, lng]).addTo(map).bindPopup("You are here").openPopup();
    }, () => alert('Unable to get location'));
}

function routeToShop(lat, lng) {
    if (!userLocation) {
        alert("Please click 'Locate Me' (Arrow Icon) first.");
        return;
    }
    
    if (routingControl) map.removeControl(routingControl);
    
    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(userLocation.lat, userLocation.lng),
            L.latLng(lat, lng)
        ],
        lineOptions: { styles: [{color: '#667eea', opacity: 1, weight: 5}] },
        createMarker: function() { return null; } // Hide default routing markers
    }).addTo(map);
    
    routingControl.on('routesfound', function(e) {
        if (isVoiceEnabled && e.routes && e.routes.length > 0) {
            const summary = e.routes[0].summary;
            const dist = (summary.totalDistance / 1000).toFixed(1) + " kilometers";
            const time = Math.round(summary.totalTime / 60) + " minutes";
            const utterance = new SpeechSynthesisUtterance(`Route calculated. Destination is ${dist} away. Travel time is about ${time}.`);
            window.speechSynthesis.speak(utterance);
        }
    });
}

function updateMapRadius(radiusKm) {
    if (searchRadiusCircle) map.removeLayer(searchRadiusCircle);
    searchRadiusCircle = L.circle([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], { 
        color: '#667eea', 
        fillColor: '#667eea', 
        fillOpacity: 0.15, 
        radius: radiusKm * 1000 
    }).addTo(map);
}

// --- 9. CHATBOT (Fully Restored with Image Paste) ---
function initChatbot() {
    const toggleBtn = document.getElementById('chatbotToggle');
    const chatWindow = document.getElementById('chatWindow');
    const closeBtn = document.getElementById('closeChatBtn');
    const sendBtn = document.getElementById('sendChatBtn');
    const input = document.getElementById('chatInput');

    if(toggleBtn) toggleBtn.onclick = () => chatWindow.classList.toggle('open');
    if(closeBtn) closeBtn.onclick = () => chatWindow.classList.remove('open');
    if(sendBtn) sendBtn.onclick = handleUserSend;
    if(input) input.onkeypress = (e) => { if (e.key === 'Enter') handleUserSend(); };

    // Image Paste Handler
    input.addEventListener('paste', function(e) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.includes('image/')) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = function(event) {
                    const imgUrl = event.target.result;
                    appendMessage(`<img src="${imgUrl}" style="max-width:100%">`, 'user-msg');
                    setTimeout(() => appendMessage("I see your screenshot! 🧐", 'bot-msg'), 600);
                };
                reader.readAsDataURL(blob);
            }
        }
    });

    function handleUserSend() {
        const text = input.value.trim();
        if (!text) return;
        appendMessage(text, 'user-msg');
        input.value = '';
        setTimeout(() => {
            const response = processChatCommand(text.toLowerCase());
            appendMessage(response, 'bot-msg');
        }, 500);
    }

    function appendMessage(text, className) {
        const div = document.createElement('div');
        div.className = `message-bubble ${className}`;
        div.innerHTML = text;
        document.getElementById('chatMessages').appendChild(div);
        div.scrollIntoView({behavior: "smooth"});
    }
}

function processChatCommand(cmd) {
    if (cmd.includes('plumber')) return "I can filter for Plumbers! Use the dropdown on the left.";
    if (cmd.includes('mechanic')) return "Looking for Mechanics? Check the 'Service Type' filter.";
    if (cmd.includes('voice')) return "Click the Speaker icon on the map to enable Voice Navigation.";
    if (cmd.includes('admin')) return "Login as 'admin' to see the Admin Panel.";
    if (cmd.includes('hello') || cmd.includes('hi')) return "Hi there! I am ServiceBot. How can I help?";
    return "I can help with shops, voice nav, or filters. Try asking 'Where are plumbers?'";
}

// --- 10. DRAGGABLE MODALS (Restored) ---
function enableDraggableModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        const header = modal.querySelector('.modal-header');
        const content = modal.querySelector('.modal-content');
        if (header && content) setupDragLogic(header, content);
    });
}

function setupDragLogic(handle, target) {
    let isDragging = false, startX, startY, startLeft, startTop;
    handle.onmousedown = (e) => {
        isDragging = true;
        handle.style.cursor = 'grabbing';
        const rect = target.getBoundingClientRect();
        target.style.position = 'fixed';
        target.style.margin = '0';
        target.style.left = rect.left + 'px';
        target.style.top = rect.top + 'px';
        startX = e.clientX; startY = e.clientY;
        startLeft = rect.left; startTop = rect.top;
        document.onmousemove = onMouseMove;
        document.onmouseup = onMouseUp;
    };
    function onMouseMove(e) {
        if (!isDragging) return;
        target.style.left = (startLeft + e.clientX - startX) + 'px';
        target.style.top = (startTop + e.clientY - startY) + 'px';
    }
    function onMouseUp() {
        isDragging = false;
        handle.style.cursor = 'move';
        document.onmousemove = null;
        document.onmouseup = null;
    }
}

// --- 11. UI HELPERS & LISTENERS ---
function onMapClick(e) {
    if (!currentUser || (currentUser.role !== 'provider' && currentUser.role !== 'admin')) return;
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([lat, lng]).addTo(map).bindPopup("New Location").openPopup();
    
    const latInput = document.getElementById('inputLat'); 
    const lngInput = document.getElementById('inputLng'); 
    if(latInput) latInput.value = lat;
    if(lngInput) lngInput.value = lng;
    
    openModal('addProviderModal'); 
}

function updateUIForUser() {
    const loggedOutView = document.getElementById('loggedOutView');
    const loggedInView = document.getElementById('loggedInView');
    const welcomeUser = document.getElementById('welcomeUser');
    const addBtn = document.getElementById('addProviderBtn');
    const adminBtn = document.getElementById('adminPanelBtn');

    if (currentUser) {
        loggedOutView.style.display = 'none';
        loggedInView.style.display = 'block';
        welcomeUser.innerText = `Hi, ${currentUser.username}`;
        
        if (addBtn) addBtn.style.display = (currentUser.role === 'provider' || currentUser.role === 'admin') ? 'inline-block' : 'none';
        if (adminBtn) adminBtn.style.display = (currentUser.role === 'admin') ? 'inline-block' : 'none';
        
    } else {
        loggedOutView.style.display = 'block';
        loggedInView.style.display = 'none';
        if(addBtn) addBtn.style.display = 'none';
        if(adminBtn) adminBtn.style.display = 'none';
    }
}

function setupEventListeners() {
    document.getElementById('loginBtnNav').onclick = () => openModal('loginModal');
    document.getElementById('registerBtnNav').onclick = () => openModal('registerModal');
    document.getElementById('logoutBtn').onclick = logout;
    
    const adminBtn = document.getElementById('adminPanelBtn');
    if(adminBtn) adminBtn.onclick = openAdminPanel;

    // Map Controls (RESTORED)
    document.getElementById('locateMe').onclick = locateUser;
    document.getElementById('setOsmMap').onclick = () => setBasemap('osm');
    document.getElementById('setSatelliteMap').onclick = () => setBasemap('satellite');
    document.getElementById('voiceToggleBtn').onclick = toggleVoiceNavigation;
    document.getElementById('resetMapBtn').onclick = () => {
        map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);
        updateMapRadius(1);
    };
    
    // Forms
    document.getElementById('loginForm').onsubmit = (e) => {
        e.preventDefault();
        login(document.getElementById('loginUsername').value, document.getElementById('loginPassword').value);
    };

    document.getElementById('registerForm').onsubmit = (e) => {
        e.preventDefault();
        register(document.getElementById('regUsername').value, document.getElementById('regPassword').value, document.getElementById('regRole').value, document.getElementById('regQuestion').value, document.getElementById('regAnswer').value);
    };

    const providerForm = document.getElementById('providerForm');
    if(providerForm) providerForm.onsubmit = (e) => {
        e.preventDefault();
        addShop(
            document.getElementById('providerName').value,
            document.getElementById('providerService').value,
            document.getElementById('providerPhone').value,
            document.getElementById('providerAddress').value,
            document.getElementById('providerDescription').value,
            document.getElementById('inputLat').value,
            document.getElementById('inputLng').value
        );
    };
    
    const manualAddBtn = document.getElementById('addProviderBtn');
    if(manualAddBtn) manualAddBtn.onclick = () => {
         alert("Click the map to pick a location!");
         closeModal('addProviderModal');
    };

    document.querySelectorAll('.close').forEach(span => {
        span.onclick = function() { this.closest('.modal').style.display = 'none'; }
    });
}

function openModal(id) {
    const el = document.getElementById(id);
    if(el) el.style.display = 'block';
}
function closeModal(id) {
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
}

// Global functions for HTML onclicks
window.deleteShop = deleteShop;
window.deleteUser = deleteUser;
window.renderAdminUserList = renderAdminUserList;
window.routeToShop = routeToShop;

