// Initialize the map variables
let map;
let satelliteLayer;
let osmLayer;
let currentLayer = 'osm';
let userLocation = null;
let providers = [];
let markers = [];
let searchRadiusCircle = null;
let isPickingLocation = false;
let tempMarker = null;
let routingControl = null;

// --- CONFIGURATION ---
const DEFAULT_CENTER = { lat: 31.4880, lng: 74.3430 }; 
const MAX_ALLOWED_RADIUS_KM = 2.5; 
const API_URL = 'https://YOUR-REPLIT-LINK-HERE/api/shops';
const REQUEST_URL = 'https://YOUR-REPLIT-LINK-HERE/api/requests';
const USERS_KEY = 'serviceUsers_v2';
const CURRENT_USER_KEY = 'serviceCurrentUser';

// --- AUTH STATE & SYSTEM STATUS ---
let currentUser = null; 
let backendStatus = "Checking...";
let recoveryUserId = null; 
let currentDetailId = null; 

// --- NEW VOICE NAVIGATION STATE ---
let isVoiceEnabled = false;

// Sample Users 
const sampleUsers = [
    { id: 101, username: 'admin', password: '123', role: 'admin', question: 'pet', answer: 'cat' },
    { id: 102, username: 'user', password: '123', role: 'user', question: 'city', answer: 'lahore' },
    { id: 103, username: 'provider', password: '123', role: 'provider', question: 'hero', answer: 'batman' }
];

const questionMap = {
    'pet': "What is your first pet's name?",
    'city': "What city were you born in?",
    'school': "What was your primary school name?",
    'hero': "Who is your childhood hero?"
};

document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeEventListeners();
    loadData(); 
    checkAuthSession(); 
    initChatbot(); 
    enableDraggableModals(); 
});

// --- HELPER: COPY TO CLIPBOARD ---
window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("Copied to clipboard: " + text);
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}

// --- DRAGGABLE MODALS ---
function enableDraggableModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        const header = modal.querySelector('.modal-header');
        const content = modal.querySelector('.modal-content');
        if (header && content) {
            setupDragLogic(header, content);
        }
    });
}

// --- REUSABLE DRAG LOGIC ---
function setupDragLogic(handleElement, targetElement) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    handleElement.addEventListener('mousedown', (e) => {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') {
            e.preventDefault(); 
        }
        
        isDragging = true;
        handleElement.style.cursor = 'grabbing';
        
        const rect = targetElement.getBoundingClientRect();
        targetElement.style.margin = '0';
        targetElement.style.position = 'fixed'; 
        
        if (!targetElement.style.left) targetElement.style.left = rect.left + 'px';
        if (!targetElement.style.top) targetElement.style.top = rect.top + 'px';

        startLeft = parseFloat(targetElement.style.left);
        startTop = parseFloat(targetElement.style.top);
        startX = e.clientX;
        startY = e.clientY;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        targetElement.style.left = (startLeft + dx) + 'px';
        targetElement.style.top = (startTop + dy) + 'px';
    }

    function onMouseUp() {
        isDragging = false;
        handleElement.style.cursor = 'move';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}


// --- DATABASE FUNCTIONS ---
async function loadData() {
    console.log("Fetching shops from PostgreSQL Server...");
    backendStatus = "Connecting...";
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Server status: ${response.status}`);
        const dbShops = await response.json();
        providers = dbShops.map(shop => ({
            ...shop,
            lat: parseFloat(shop.lat),
            lng: parseFloat(shop.lng),
            rating: shop.rating ? parseFloat(shop.rating) : 0,
            userReviews: [],
            ownerId: shop.ownerId ? parseInt(shop.ownerId) : null 
        }));
        console.log(`Loaded ${providers.length} shops from Database.`);
        backendStatus = "Online";
        applyFilters(); 
    } catch (error) {
        console.error("Error loading from Database:", error);
        backendStatus = "Offline";
        providers = [];
        applyFilters();
    }
    const storedUsers = localStorage.getItem(USERS_KEY);
    if (!storedUsers) localStorage.setItem(USERS_KEY, JSON.stringify(sampleUsers));
}

// --- AUTHENTICATION SYSTEM ---
function checkAuthSession() {
    const session = localStorage.getItem(CURRENT_USER_KEY);
    if (session) {
        currentUser = JSON.parse(session);
        updateUIForUser();
    } else {
        updateUIForGuest();
    }
}
function login(username, password) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
        updateUIForUser();
        document.getElementById('loginModal').style.display = 'none';
        document.getElementById('loginForm').reset();
        alert(`Welcome back, ${user.role}!`);
    } else {
        alert("Invalid credentials.");
    }
}
function register(username, password, role, question, answer) {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    if (users.find(u => u.username === username)) { alert("Username already exists."); return; }
    const newUser = { id: Date.now(), username: username, password: password, role: role, question: question, answer: answer.toLowerCase().trim() };
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    currentUser = newUser;
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
    updateUIForUser();
    document.getElementById('registerModal').style.display = 'none';
    document.getElementById('registerForm').reset();
    alert("Account created successfully!");
}
function logout() {
    currentUser = null;
    localStorage.removeItem(CURRENT_USER_KEY);
    updateUIForGuest();
    document.getElementById('addProviderModal').style.display = 'none';
    document.getElementById('adminModal').style.display = 'none';
    alert("Logged out.");
}
function openRecoveryModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('forgotPasswordModal').style.display = 'block';
    document.getElementById('recoveryStep1').style.display = 'block';
    document.getElementById('recoveryStep2').style.display = 'none';
    document.getElementById('recoveryStep3').style.display = 'none';
    document.getElementById('recoveryUserForm').reset();
    document.getElementById('recoveryQuestionForm').reset();
    document.getElementById('recoveryResetForm').reset();
    recoveryUserId = null;
}
function checkRecoveryUser(e) {
    e.preventDefault();
    const username = document.getElementById('recoveryUsername').value.trim();
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const user = users.find(u => u.username === username);
    if (user) {
        if (!user.question || !user.answer) { alert("Contact Admin."); return; }
        recoveryUserId = user.id;
        document.getElementById('securityQuestionDisplay').textContent = questionMap[user.question] || "Unknown Question";
        document.getElementById('recoveryStep1').style.display = 'none';
        document.getElementById('recoveryStep2').style.display = 'block';
    } else { alert("Username not found."); }
}
function verifyRecoveryAnswer(e) {
    e.preventDefault();
    const answer = document.getElementById('recoveryAnswer').value.trim().toLowerCase();
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const user = users.find(u => u.id === recoveryUserId);
    if (user && user.answer === answer) {
        document.getElementById('recoveryStep2').style.display = 'none';
        document.getElementById('recoveryStep3').style.display = 'block';
    } else { alert("Incorrect answer."); }
}
function resetPassword(e) {
    e.preventDefault();
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;
    if (newPass !== confirmPass) { alert("Passwords do not match!"); return; }
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    const userIndex = users.findIndex(u => u.id === recoveryUserId);
    if (userIndex !== -1) {
        users[userIndex].password = newPass;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        alert("Password reset successfully! Please login.");
        document.getElementById('forgotPasswordModal').style.display = 'none';
        document.getElementById('loginModal').style.display = 'block';
    }
}
function updateUIForUser() {
    document.getElementById('loggedOutView').style.display = 'none';
    document.getElementById('loggedInView').style.display = 'flex';
    document.getElementById('welcomeUser').textContent = `Hi, ${currentUser.username} (${currentUser.role})`;
    document.getElementById('addProviderBtn').style.display = (currentUser.role === 'admin' || currentUser.role === 'provider') ? 'inline-block' : 'none';
    document.getElementById('adminPanelBtn').style.display = (currentUser.role === 'admin') ? 'inline-block' : 'none';
}
function updateUIForGuest() {
    document.getElementById('loggedOutView').style.display = 'block';
    document.getElementById('loggedInView').style.display = 'none';
    document.getElementById('addProviderBtn').style.display = 'none';
    document.getElementById('adminPanelBtn').style.display = 'none';
}

function initializeMap() {
    map = L.map('map').setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 16);
    osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 });
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri, Maxar', maxZoom: 19 });
    osmLayer.addTo(map);
    const initialRadius = parseFloat(document.getElementById('searchRadius').value);
    updateMapRadius(initialRadius);
    map.on('click', function(e) { if (isPickingLocation) confirmLocationPick(e.latlng); });
}

function initializeEventListeners() {
    document.getElementById('searchBtn').addEventListener('click', performSearch);
    document.getElementById('searchInput').addEventListener('keypress', function(e) { if (e.key === 'Enter') performSearch(); });
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('searchRadius').addEventListener('change', applyFilters);
    document.getElementById('locateMe').addEventListener('click', locateUser);
    document.getElementById('resetMapBtn').addEventListener('click', resetMapView);
    document.getElementById('setOsmMap').addEventListener('click', () => setBasemap('osm'));
    document.getElementById('setSatelliteMap').addEventListener('click', () => setBasemap('satellite'));
    
    // --- NEW VOICE TOGGLE LISTENER ---
    document.getElementById('voiceToggleBtn').addEventListener('click', toggleVoiceNavigation);

    document.getElementById('searchRadius').addEventListener('input', function() {
        document.getElementById('radiusValue').textContent = `${this.value} km`;
        updateMapRadius(parseFloat(this.value));
    });

    document.getElementById('addProviderBtn').addEventListener('click', () => openAddProviderModal(false));
    document.getElementById('cancelAdd').addEventListener('click', closeAddProviderModal);
    document.getElementById('providerForm').addEventListener('submit', handleProviderSubmit);
    document.getElementById('pickLocationBtn').addEventListener('click', toggleLocationPicker);
    
    document.getElementById('requestServiceBtn').addEventListener('click', openRequestModal);
    document.getElementById('requestServiceForm').addEventListener('submit', handleRequestSubmit);

    document.getElementById('submitReviewBtn').addEventListener('click', submitReview);
    document.getElementById('deleteProviderBtn').addEventListener('click', deleteCurrentProvider);
    document.getElementById('editProviderBtn').addEventListener('click', editCurrentProvider);
    document.getElementById('getDirectionsBtn').addEventListener('click', function() { if(currentDetailId) routeToShop(currentDetailId); });

    document.getElementById('loginBtnNav').addEventListener('click', () => document.getElementById('loginModal').style.display = 'block');
    document.getElementById('registerBtnNav').addEventListener('click', () => document.getElementById('registerModal').style.display = 'block');
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('adminPanelBtn').addEventListener('click', openAdminPanel);
    document.getElementById('resetSystemBtn').addEventListener('click', resetSystemData);
    document.getElementById('statUsers').addEventListener('click', renderAdminUserList);
    document.getElementById('statShops').addEventListener('click', renderAdminShopList);

    document.getElementById('loginForm').addEventListener('submit', function(e) { e.preventDefault(); login(document.getElementById('loginUsername').value, document.getElementById('loginPassword').value); });
    document.getElementById('registerForm').addEventListener('submit', function(e) { 
        e.preventDefault(); 
        register(document.getElementById('regUsername').value, document.getElementById('regPassword').value, document.getElementById('regRole').value, document.getElementById('regQuestion').value, document.getElementById('regAnswer').value); 
    });

    document.getElementById('forgotPasswordLink').addEventListener('click', openRecoveryModal);
    document.getElementById('recoveryUserForm').addEventListener('submit', checkRecoveryUser);
    document.getElementById('recoveryQuestionForm').addEventListener('submit', verifyRecoveryAnswer);
    document.getElementById('recoveryResetForm').addEventListener('submit', resetPassword);

    document.querySelectorAll('.close').forEach(closeBtn => { closeBtn.addEventListener('click', function() { document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none'); }); });
    window.addEventListener('click', function(event) { document.querySelectorAll('.modal').forEach(modal => { if (event.target === modal) modal.style.display = 'none'; }); });

    document.querySelectorAll('.rating-stars .star').forEach(star => {
        star.addEventListener('click', function() {
            const rating = parseInt(this.getAttribute('data-rating'));
            updateStarVisuals(rating);
            this.parentElement.setAttribute('data-selected-rating', rating);
        });
    });
}

function openAdminPanel() {
    const users = JSON.parse(localStorage.getItem(USERS_KEY));
    document.getElementById('adminTotalUsers').textContent = users.length;
    document.getElementById('adminTotalShops').textContent = providers.length; 
    document.getElementById('adminListSection').style.display = 'none';
    document.getElementById('adminModal').style.display = 'block';
}
function resetSystemData() {
    if(confirm("DANGER: This only clears User logins. To clear shops, you must delete the Database tables.")) {
        localStorage.clear();
        location.reload();
    }
}
function renderAdminUserList() {
    const listSection = document.getElementById('adminListSection');
    const container = document.getElementById('adminListContainer');
    document.getElementById('adminListTitle').textContent = "Manage Users";
    listSection.style.display = 'block';
    container.innerHTML = '';
    JSON.parse(localStorage.getItem(USERS_KEY)).forEach(user => {
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        const deleteBtn = (currentUser && user.id === currentUser.id) ? `<span style="color:#cbd5e0;">(You)</span>` : `<button class="btn-sm-danger" onclick="adminDeleteUser(${user.id})">Delete</button>`;
        item.innerHTML = `<div class="item-info"><strong>${user.username}</strong><small>${user.role}</small></div><div>${deleteBtn}</div>`;
        container.appendChild(item);
    });
}
function renderAdminShopList() {
    const listSection = document.getElementById('adminListSection');
    const container = document.getElementById('adminListContainer');
    document.getElementById('adminListTitle').textContent = "Manage Shops (DB View)";
    listSection.style.display = 'block';
    container.innerHTML = '';
    if (providers.length === 0) { container.innerHTML = '<div style="padding:15px; text-align:center;">No shops found in DB.</div>'; return; }
    providers.forEach(p => {
        const item = document.createElement('div');
        item.className = 'admin-list-item';
        item.innerHTML = `<div class="item-info"><strong>${p.name}</strong><small>${getServiceDisplayName(p.service)}</small></div><div><button class="btn-sm-danger" onclick="adminDeleteShop(${p.id})">Delete</button></div>`;
        container.appendChild(item);
    });
}
function adminDeleteUser(userId) {
    if(!confirm("Delete this user?")) return;
    let users = JSON.parse(localStorage.getItem(USERS_KEY));
    users = users.filter(u => u.id !== userId);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    document.getElementById('adminTotalUsers').textContent = users.length;
    renderAdminUserList();
}
async function adminDeleteShop(shopId) {
    if(!confirm("Are you sure you want to delete this shop permanently?")) return;
    try {
        const response = await fetch(`${API_URL}/${shopId}`, { method: 'DELETE' });
        if (response.ok) { alert("Shop deleted from database."); loadData(); openAdminPanel(); } else { alert("Failed to delete shop."); }
    } catch (error) { console.error(error); alert("Error connecting to server."); }
}

function updateMapRadius(radiusKm) {
    if (searchRadiusCircle) map.removeLayer(searchRadiusCircle);
    searchRadiusCircle = L.circle([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], { color: '#667eea', fillColor: '#667eea', fillOpacity: 0.15, radius: radiusKm * 1000 }).addTo(map);
}

// --- NEW FUNCTION: TOGGLE VOICE ---
function toggleVoiceNavigation() {
    const btn = document.getElementById('voiceToggleBtn');
    isVoiceEnabled = !isVoiceEnabled;
    
    if (isVoiceEnabled) {
        // Voice is NOW ON
        btn.classList.add('active-voice');
        btn.innerHTML = '<i class="fas fa-volume-up"></i>';
        
        // Optional: Speak test
        const utterance = new SpeechSynthesisUtterance("Voice navigation enabled.");
        window.speechSynthesis.speak(utterance);
    } else {
        // Voice is NOW OFF
        btn.classList.remove('active-voice');
        btn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        window.speechSynthesis.cancel(); // Stop current speech
    }
}

// --- NARRATOR / TTS FUNCTION ---
function speakRouteSummary(summary, instructions) {
    if (!('speechSynthesis' in window)) return;
    
    // CHECK TOGGLE STATE FIRST
    if (!isVoiceEnabled) {
        window.speechSynthesis.cancel();
        return;
    }

    window.speechSynthesis.cancel(); // Stop previous

    const distance = summary.totalDistance < 1000 
        ? Math.round(summary.totalDistance) + ' meters' 
        : (summary.totalDistance / 1000).toFixed(1) + ' kilometers';
    
    const time = Math.round(summary.totalTime / 60) + ' minutes';
    
    const text = `Route calculated. Destination is ${distance} away. It will take about ${time}. ${instructions[0] ? 'First step: ' + instructions[0].text : ''}`;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

// --- ROUTING FUNCTION ---
function routeToShop(providerId) {
    if (!userLocation) {
        alert("We need your location first. Please allow access.");
        locateUser(function(success) { if(success) executeRouting(providerId); });
        return;
    }
    executeRouting(providerId);
}
function executeRouting(providerId) {
    const provider = providers.find(p => p.id == providerId);
    if (!provider) return;
    if (routingControl) map.removeControl(routingControl);
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
    
    try {
        routingControl = L.Routing.control({
            waypoints: [L.latLng(userLocation.lat, userLocation.lng), L.latLng(provider.lat, provider.lng)],
            routeWhileDragging: false,
            lineOptions: { styles: [{color: '#667eea', opacity: 1, weight: 5}] },
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            containerClassName: 'leaflet-routing-container'
        }).addTo(map);

        routingControl.on('routesfound', function(e) {
            const routes = e.routes;
            const bounds = L.latLngBounds([[userLocation.lat, userLocation.lng], [provider.lat, provider.lng]]);
            map.fitBounds(bounds, { padding: [50, 50] });
            
            // Trigger Narrator
            if (routes && routes.length > 0) {
                speakRouteSummary(routes[0].summary, routes[0].instructions);
            }

            // Make Draggable
            setTimeout(() => {
                const routingContainer = document.querySelector('.leaflet-routing-container');
                if (routingContainer) {
                    routingContainer.classList.add('draggable-enabled');
                    routingContainer.style.position = 'absolute';
                    routingContainer.style.zIndex = '10000';
                    routingContainer.style.right = '10px';
                    routingContainer.style.top = '10px';
                    // Apply drag logic
                    setupDragLogic(routingContainer, routingContainer);
                }
            }, 500);
        });
        
        routingControl.on('routingerror', function(e) {
            console.error("Routing Error:", e);
            alert("Could not calculate route.");
        });
    } catch (e) {
        console.error("Routing module error:", e);
        alert("Routing failed to initialize.");
    }
}

// --- LOCATE USER ---
function locateUser(callback) {
    if (!navigator.geolocation) { alert('Geolocation not supported'); if(callback) callback(false); return; }
    navigator.geolocation.getCurrentPosition(
        function(position) {
            userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            if(window.userMarker) map.removeLayer(window.userMarker);
            const latStr = userLocation.lat.toFixed(5);
            const lngStr = userLocation.lng.toFixed(5);
            const coordsText = `${latStr}, ${lngStr}`;
            
            window.userMarker = L.marker([userLocation.lat, userLocation.lng], {
                icon: L.divIcon({ className: 'user-marker', html: '<i class="fas fa-dot-circle" style="color:#4285F4; font-size:24px; text-shadow:0 0 5px white;"></i>', iconSize: [24, 24] })
            }).addTo(map).bindPopup(`
                <div style="text-align:center">
                    <b>You are here</b><br>
                    ${latStr}, ${lngStr}<br>
                    <button class="btn-copy" onclick="copyToClipboard('${coordsText}')"><i class="fas fa-copy"></i> Copy</button>
                </div>
            `).openPopup();
            
            map.setView([userLocation.lat, userLocation.lng], 16);
            if(callback) callback(true);
        },
        function() { alert('Unable to get location'); if(callback) callback(false); }
    );
}

function applyFilters() {
    const serviceType = document.getElementById('serviceType').value;
    const minRating = parseFloat(document.getElementById('ratingFilter').value);
    const radiusKm = parseFloat(document.getElementById('searchRadius').value);
    const centerPoint = L.latLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
    const filtered = providers.filter(p => {
        const matchService = (serviceType === 'all') || (p.service === serviceType);
        const matchRating = (p.rating >= minRating);
        const providerPoint = L.latLng(p.lat, p.lng);
        const distanceMeters = centerPoint.distanceTo(providerPoint);
        return matchService && matchRating && distanceMeters <= (radiusKm * 1000);
    });
    renderProvidersList(filtered);
    addProvidersToMap(filtered);
}
function renderProvidersList(listToRender) {
    const container = document.getElementById('providersContainer');
    container.innerHTML = '';
    if(listToRender.length === 0) { container.innerHTML = "<p style='text-align:center; color:#666;'>No shops found.</p>"; return; }
    listToRender.forEach(provider => {
         const card = document.createElement('div');
         card.className = 'provider-card';
         card.setAttribute('data-id', provider.id);
         const stars = '★'.repeat(Math.floor(provider.rating)) + '☆'.repeat(5 - Math.floor(provider.rating));
         card.innerHTML = `<div class="provider-header"><div><div class="provider-name">${provider.name}</div><span class="provider-service">${getServiceDisplayName(provider.service)}</span></div></div><div class="provider-rating"><span class="stars">${stars}</span><span>${provider.rating}</span></div><div class="provider-address"><i class="fas fa-map-marker-alt"></i> ${provider.address}</div>`;
         card.addEventListener('click', function() { showProviderOnMap(provider.id); highlightProviderCard(provider.id); });
         container.appendChild(card);
    });
}
function addProvidersToMap(listToRender) {
    const data = listToRender || providers;
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    data.forEach(provider => {
        const marker = L.marker([provider.lat, provider.lng]).addTo(map).bindPopup(createPopupContent(provider));
        marker.providerId = provider.id;
        marker.on('click', function() { highlightProviderCard(provider.id); });
        markers.push(marker);
    });
}

// --- OPEN ADD MODAL (WITH NEW INPUT RESET) ---
function openAddProviderModal(isEdit = false, shopId = null) {
    const modal = document.getElementById('addProviderModal');
    const form = document.getElementById('providerForm');
    const content = modal.querySelector('.modal-content');
    content.style.position = ''; content.style.left = ''; content.style.top = ''; content.style.margin = '5% auto';
    
    if (isEdit && shopId) {
        const provider = providers.find(p => p.id == shopId);
        if (!provider) return;
        document.getElementById('modalTitle').textContent = "Edit Shop Details";
        document.getElementById('submitProviderBtn').textContent = "Update Shop";
        document.getElementById('editProviderId').value = shopId;
        document.getElementById('providerName').value = provider.name;
        document.getElementById('providerService').value = provider.service;
        document.getElementById('providerPhone').value = provider.phone;
        document.getElementById('providerAddress').value = provider.address;
        document.getElementById('providerDescription').value = provider.description || "";
        
        // --- NEW: Fill Visible Inputs ---
        document.getElementById('inputLat').value = provider.lat;
        document.getElementById('inputLng').value = provider.lng;
        
    } else {
        if(!document.getElementById('providerName').value) {
             form.reset();
             document.getElementById('modalTitle').textContent = "Add Service Provider";
             document.getElementById('submitProviderBtn').textContent = "Add Shop";
             document.getElementById('editProviderId').value = ""; 
             
             // --- NEW: Clear Visible Inputs ---
             document.getElementById('inputLat').value = "";
             document.getElementById('inputLng').value = "";
        }
    }
    modal.style.display = 'block';
}
function closeAddProviderModal() { 
    document.getElementById('addProviderModal').style.display = 'none'; 
    document.getElementById('providerForm').reset(); 
    if (tempMarker) map.removeLayer(tempMarker); 
}

// --- HANDLE PROVIDER SUBMIT (WITH MANUAL INPUTS) ---
async function handleProviderSubmit(e) {
    e.preventDefault();
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'provider')) { alert("Permission denied."); return; }
    
    const editId = document.getElementById('editProviderId').value; 
    
    // --- READ FROM NEW VISIBLE INPUTS ---
    const latVal = document.getElementById('inputLat').value;
    const lngVal = document.getElementById('inputLng').value;

    if (!latVal || !lngVal) { alert("Please enter coordinates or pick a location!"); return; }
    
    const lat = parseFloat(latVal);
    const lng = parseFloat(lngVal);
    const centerPoint = L.latLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
    const newPoint = L.latLng(lat, lng);
    const distMeters = centerPoint.distanceTo(newPoint);
    
    if (distMeters > (MAX_ALLOWED_RADIUS_KM * 1000)) { alert(`Location Rejected: Shop is ${Math.round(distMeters)}m away from Area Center.\nMax allowed distance is ${MAX_ALLOWED_RADIUS_KM} km.`); return; }
    
    const providerData = { ownerId: currentUser.id, name: document.getElementById('providerName').value, service: document.getElementById('providerService').value, phone: document.getElementById('providerPhone').value, address: document.getElementById('providerAddress').value, description: document.getElementById('providerDescription').value, lat: lat, lng: lng };
    
    try {
        let url = API_URL;
        let method = 'POST';
        if (editId) { url = `${API_URL}/${editId}`; method = 'PUT'; } 
        
        const response = await fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(providerData) });
        if (response.ok) {
            alert(editId ? "Shop Updated Successfully!" : "Shop Added Successfully!");
            loadData(); 
            document.getElementById('addProviderModal').style.display = 'none';
            document.getElementById('providerForm').reset();
            if(editId) document.getElementById('providerDetailsModal').style.display = 'none';
        } else {
            console.error("Server Response Error:", response.status, response.statusText);
            alert(`Server Error: Could not save data.`);
        }
    } catch (error) {
        console.error("Fetch Error:", error);
        alert("Network Error: Could not connect to the server.");
    }
}

// --- NEW REQUEST FORM HANDLING ---
function openRequestModal() {
    if(!userLocation) {
        alert("We need your location first. Please click the 'Locate Me' icon on the map.");
        locateUser((success) => { if(success) openRequestModal(); });
        return;
    }
    const locStr = `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`;
    document.getElementById('reqLocationDisplay').value = locStr;
    document.getElementById('providerDetailsModal').style.display = 'none';
    document.getElementById('requestServiceModal').style.display = 'block';
}

async function handleRequestSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('reqName').value;
    const phone = document.getElementById('reqPhone').value;
    const address = document.getElementById('reqAddress').value;
    
    if (!currentDetailId || !userLocation) { alert("Error: Missing provider or location."); return; }

    const reqData = {
        providerId: currentDetailId,
        name: name,
        phone: phone,
        address: address,
        lat: userLocation.lat,
        lng: userLocation.lng
    };

    try {
        const response = await fetch(REQUEST_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(reqData)
        });
        if(response.ok) {
            alert("Request Sent! The shop owner will contact you.");
            document.getElementById('requestServiceModal').style.display = 'none';
            document.getElementById('requestServiceForm').reset();
        } else {
            alert("Failed to send request. Server Error.");
        }
    } catch(err) {
        console.error(err);
        alert("Network error.");
    }
}

function editCurrentProvider() { 
    if (!currentDetailId) return; 
    openAddProviderModal(true, currentDetailId); 
    document.getElementById('providerDetailsModal').style.display = 'none';
}

function showProviderDetails(providerId) {
    currentDetailId = providerId;
    const provider = providers.find(p => p.id == providerId);
    if (!provider) return;
    document.getElementById('detailName').textContent = provider.name;
    document.getElementById('detailService').textContent = getServiceDisplayName(provider.service);
    document.getElementById('detailPhone').textContent = provider.phone;
    document.getElementById('detailAddress').textContent = provider.address;
    document.getElementById('detailImageContainer').style.display = 'none';
    const stars = '★'.repeat(Math.floor(provider.rating)) + '☆'.repeat(5 - Math.floor(provider.rating));
    document.getElementById('detailRating').innerHTML = stars;
    document.getElementById('detailRatingValue').textContent = `(${provider.rating} / 5)`;
    renderReviews(provider.userReviews || []);
    const reviewSection = document.getElementById('reviewSection');
    const loginMsg = document.getElementById('loginToReviewMsg');
    if (currentUser && (currentUser.role === 'user' || currentUser.role === 'admin')) { reviewSection.style.display = 'block'; loginMsg.style.display = 'none'; }
    else if (currentUser && currentUser.role === 'provider') { reviewSection.style.display = 'none'; loginMsg.style.display = 'none'; }
    else { reviewSection.style.display = 'none'; loginMsg.style.display = 'block'; }
    const ownerActions = document.getElementById('ownerActions');
    if (currentUser && (currentUser.role === 'admin' || currentUser.id === provider.ownerId)) { ownerActions.style.display = 'block'; } else { ownerActions.style.display = 'none'; }
    document.getElementById('reviewText').value = "";
    updateStarVisuals(0);
    document.getElementById('providerDetailsModal').style.display = 'block';
}
function submitReview() {
    alert("Review feature is Local-Only currently.");
    if (!currentUser) return;
    const rating = parseInt(document.querySelector('.rating-stars').getAttribute('data-selected-rating') || 0);
    const text = document.getElementById('reviewText').value.trim();
    if (rating === 0) { alert("Please select a rating."); return; }
    const provider = providers.find(p => p.id == currentDetailId);
    if(provider) { provider.userReviews = provider.userReviews || []; provider.userReviews.push({ user: currentUser.username, rating: rating, text: text }); renderReviews(provider.userReviews); }
}
async function deleteCurrentProvider() {
    if (!currentDetailId) return;
    if (confirm("Are you sure you want to delete your shop permanently?")) {
        try { const response = await fetch(`${API_URL}/${currentDetailId}`, { method: 'DELETE' }); if (response.ok) { alert("Shop deleted."); providers = providers.filter(p => p.id !== currentDetailId); applyFilters(); document.getElementById('providerDetailsModal').style.display = 'none'; currentDetailId = null; } else { alert("Failed to delete."); } } catch (e) { console.error(e); alert("Error connecting to server."); }
    }
}
function resetMapView() { map.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 16); document.getElementById('searchRadius').value = 1; document.getElementById('radiusValue').textContent = "1 km"; document.getElementById('serviceType').value = "all"; document.getElementById('ratingFilter').value = "0"; updateMapRadius(1); applyFilters(); }
function createPopupContent(provider) { const stars = '★'.repeat(Math.floor(provider.rating)) + '☆'.repeat(5 - Math.floor(provider.rating)); return `<div class="popup-content"><h3>${provider.name}</h3><div class="popup-rating">${stars} (${provider.rating})</div><div class="popup-service"><i class="fas fa-tools"></i> ${getServiceDisplayName(provider.service)}</div><div class="popup-actions"><button class="popup-btn primary" onclick="showProviderDetails('${provider.id}')">View Details</button><button class="popup-btn secondary" style="margin-top:5px; width:100%" onclick="routeToShop('${provider.id}')"><i class="fas fa-directions"></i> Route</button></div></div>`; }
function getServiceDisplayName(serviceType) { const serviceNames = { 'electrician': 'Electrician', 'plumber': 'Plumber', 'mechanic': 'Mechanic', 'carwash': 'Car/Bike Wash' }; return serviceNames[serviceType] || serviceType; }
function showProviderOnMap(providerId) { const provider = providers.find(p => p.id == providerId); if (provider) { map.setView([provider.lat, provider.lng], 16); markers.forEach(marker => { if (marker.providerId == providerId) marker.openPopup(); }); } }
function highlightProviderCard(providerId) { document.querySelectorAll('.provider-card').forEach(card => card.classList.remove('active')); const activeCard = document.querySelector(`.provider-card[data-id="${providerId}"]`); if (activeCard) { activeCard.classList.add('active'); activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
function setBasemap(layerName) { if (currentLayer === layerName) return; if (layerName === 'osm') { if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer); map.addLayer(osmLayer); currentLayer = 'osm'; document.getElementById('setOsmMap').classList.add('active'); document.getElementById('setSatelliteMap').classList.remove('active'); } else { if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer); map.addLayer(satelliteLayer); currentLayer = 'satellite'; document.getElementById('setOsmMap').classList.remove('active'); document.getElementById('setSatelliteMap').classList.add('active'); } }
function performSearch() { const query = document.getElementById('searchInput').value.toLowerCase().trim(); if (query) { const filtered = providers.filter(provider => provider.name.toLowerCase().includes(query) || provider.service.toLowerCase().includes(query)); renderProvidersList(filtered); addProvidersToMap(filtered); if (filtered.length > 0) { map.setView([filtered[0].lat, filtered[0].lng], 16); highlightProviderCard(filtered[0].id); } } }

// --- UPDATED LOCATION PICKER LOGIC ---
function toggleLocationPicker() { 
    isPickingLocation = true; 
    document.getElementById('addProviderModal').style.display = 'none'; 
    document.getElementById('locationPickerMessage').style.display = 'block'; 
    document.body.style.cursor = 'crosshair'; 
}

function confirmLocationPick(latlng) { 
    // --- MODIFIED: Fill Visible Inputs ---
    document.getElementById('inputLat').value = latlng.lat; 
    document.getElementById('inputLng').value = latlng.lng; 
    
    if (tempMarker) map.removeLayer(tempMarker); 
    tempMarker = L.marker(latlng).addTo(map).bindPopup("Selected Location").openPopup(); 
    
    isPickingLocation = false; 
    document.body.style.cursor = 'default'; 
    document.getElementById('locationPickerMessage').style.display = 'none'; 
    
    document.getElementById('addProviderModal').style.display = 'block'; 
}

function renderReviews(reviewsArr) { const list = document.getElementById('reviewsList'); list.innerHTML = ""; if(!reviewsArr || reviewsArr.length === 0) { list.innerHTML = "<p style='color:#777; font-style:italic;'>No reviews yet.</p>"; return; } reviewsArr.forEach(r => { const item = document.createElement('div'); item.className = 'review-item'; item.innerHTML = `<div class="review-header"><strong>${r.user}</strong><span style="color:#fbbf24;">${'★'.repeat(r.rating)}</span></div><div class="review-text">${r.text}</div>`; list.appendChild(item); }); }
function updateStarVisuals(rating) { document.querySelectorAll('.rating-stars .star').forEach(star => { const starRating = parseInt(star.getAttribute('data-rating')); if (starRating <= rating) star.classList.add('active'); else star.classList.remove('active'); }); }

// ==========================================
//           UPDATED INTELLIGENT CHATBOT
// ==========================================

function initChatbot() {
    const toggleBtn = document.getElementById('chatbotToggle');
    const chatWindow = document.getElementById('chatWindow');
    const closeBtn = document.getElementById('closeChatBtn');
    const sendBtn = document.getElementById('sendChatBtn');
    const input = document.getElementById('chatInput');

    toggleBtn.addEventListener('click', () => {
        chatWindow.classList.toggle('open');
        if (chatWindow.classList.contains('open') && document.getElementById('chatMessages').children.length === 0) {
            appendBotMessage("👋 Hi! I'm ServiceBot.");
            appendBotMessage("I can help with <b>Shops</b>, <b>Manual Coordinates</b>, and <b>Voice Navigation</b>. Try asking:<br><i>'How do I hear the route?'</i> or <i>'Can I type latitude?'</i>");
        }
    });

    closeBtn.addEventListener('click', () => chatWindow.classList.remove('open'));
    sendBtn.addEventListener('click', handleUserSend);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleUserSend(); });

    // --- PASTE HANDLER FOR SCREENSHOTS ---
    input.addEventListener('paste', function(e) {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.includes('image/')) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = function(event) {
                    const imgUrl = event.target.result;
                    appendUserMessage(`<img src="${imgUrl}">`);
                    setTimeout(() => {
                        appendBotMessage("I see you pasted an image! 🧐<br>If this is an <b>Error Screenshot</b>:");
                        appendBotMessage("• <b>'Server Error'</b>: This means your backend Node.js server is NOT running or doesn't support Updates (PUT).<br>• <b>'Routing Error'</b>: Check your internet.");
                    }, 600);
                };
                reader.readAsDataURL(blob);
            }
        }
    });

    function handleUserSend() {
        const text = input.value.trim();
        if (!text) return;
        appendUserMessage(text);
        input.value = '';
        setTimeout(() => {
            const response = processChatCommand(text.toLowerCase());
            appendBotMessage(response);
        }, 500);
    }
}

function appendUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'message-bubble user-msg';
    div.innerHTML = text; // Allow HTML for images
    document.getElementById('chatMessages').appendChild(div);
    div.scrollIntoView({behavior: "smooth"});
}
function appendBotMessage(htmlText) {
    const div = document.createElement('div');
    div.className = 'message-bubble bot-msg';
    div.innerHTML = htmlText;
    document.getElementById('chatMessages').appendChild(div);
    div.scrollIntoView({behavior: "smooth"});
}

// --- NEW SMART COMMAND PROCESSOR (TRAINED FOR NEW FEATURES) ---
function processChatCommand(cmd) {
    // 1. Service Searches
    const services = [
        { key: 'plumber', display: 'Plumbers' },
        { key: 'electrician', display: 'Electricians' },
        { key: 'mechanic', display: 'Mechanics' },
        { key: 'carwash', display: 'Car Washes' }
    ];

    for (let service of services) {
        if (cmd.includes(service.key)) {
            document.getElementById('serviceType').value = service.key;
            applyFilters();
            const count = providers.filter(p => p.service === service.key).length;
            if (count > 0) {
                return `I found <b>${count} ${service.display}</b> for you! 🛠️<br>I've filtered the map to show only them. Click on a marker to see details.`;
            } else {
                return `I looked through the database, but sorry, <b>no ${service.display}</b> were found in this area. 😔`;
            }
        }
    }

    // 2. NEW: Voice Navigation Help
    if (cmd.includes('voice') || cmd.includes('speak') || cmd.includes('narrator') || cmd.includes('hear') || cmd.includes('sound') || cmd.includes('volume')) {
        return `<b>🔊 Voice Navigation:</b><br>
        1. Click the <b>Speaker Icon</b> <i class="fas fa-volume-mute"></i> on the right side of the map.<br>
        2. When it turns <b>Green</b> <i class="fas fa-volume-up"></i>, voice is ON.<br>
        3. Create a route, and I will read the directions to you!`;
    }

    // 3. NEW: Manual Coordinates Help
    if (cmd.includes('coordinate') || cmd.includes('lat') || cmd.includes('lng') || cmd.includes('manual') || cmd.includes('type location') || cmd.includes('edit location')) {
        return `<b>📍 Manual Coordinates:</b><br>
        Yes! When adding or editing a shop, you can now <b>manually type</b> the Latitude and Longitude numbers in the form.<br>
        Or, use the <b>"Pick on Map"</b> button to auto-fill them.`;
    }

    // 4. Error Handling
    if (cmd.includes('error') || cmd.includes('fail') || cmd.includes('not save') || cmd.includes('problem')) {
        return `<b>Troubleshooting Errors:</b><br>
        1. <b>"Server Error":</b> Backend is offline. Run 'node server.js'.<br>
        2. <b>"Routing Error":</b> Internet issue or map server busy.`;
    }

    // 5. App Features & Help
    if (cmd.includes('location') || cmd.includes('where am i') || cmd.includes('coords')) {
        if (userLocation) {
            const coords = `${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`;
            return `<b>Your Location:</b><br>${coords}<br><button class="btn-copy" onclick="copyToClipboard('${coords}')"><i class="fas fa-copy"></i> Copy</button>`;
        } else {
            return `Click the <i class="fas fa-location-arrow"></i> icon on the map first so I can find you!`;
        }
    }

    if (cmd.includes('add shop') || cmd.includes('create shop') || cmd.includes('register shop')) {
        return "To add a shop:<br>1. <b>Register</b> as a 'Service Provider'.<br>2. <b>Login</b>.<br>3. Click the <b>'Add Shop'</b> button that appears in the top right.";
    }

    if (cmd.includes('login') || cmd.includes('sign in')) {
        return "Click the <b>Login</b> button in the top right corner. Default admin user is: <i>admin / 123</i>";
    }

    if (cmd.includes('admin') || cmd.includes('manage')) {
        return "Admin Panel allows deleting users or shops. You must log in as an Admin (try <i>admin / 123</i>).";
    }

    // Default Fallback
    return "I'm not sure about that. Try asking for <b>plumbers</b>, <b>voice navigation</b>, or <b>manual coordinates</b>.";
}

window.showProviderDetails = showProviderDetails;
window.routeToShop = routeToShop;
window.adminDeleteUser = adminDeleteUser;
window.adminDeleteShop = adminDeleteShop;
window.renderAdminUserList = renderAdminUserList;
window.renderAdminShopList = renderAdminShopList;
window.toggleVoiceNavigation = toggleVoiceNavigation;