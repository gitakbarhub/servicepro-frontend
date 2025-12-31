// ==================================================
// SERVICEPRO SCRIPT.JS (With Cloud Admin Panel)
// ==================================================

// 1. CONFIGURATION
const BASE_URL = 'https://0691fb63-24ec-4728-85ea-05b3b2145c59-00-3njhq9444p5wr.pike.replit.dev'; 

const API_URL = `${BASE_URL}/api/shops`;
const AUTH_URL = `${BASE_URL}/api`; 

const DEFAULT_CENTER = { lat: 31.4880, lng: 74.3430 }; // Lahore
const CURRENT_USER_KEY = 'serviceCurrentUser';

// 2. GLOBAL VARIABLES
let map;
let markers = [];
let currentUser = null;
let tempMarker = null; 

// 3. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    checkLoginState();
    setupEventListeners();
});

function initMap() {
    map = L.map('map').setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    fetchShops();
    map.on('click', onMapClick);
}

// 4. AUTHENTICATION
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

// 5. SHOPS
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
            `);
            markers.push(marker);
        });
        
        // Update Admin Count if open
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

// 6. ADMIN PANEL LOGIC (NEW)
async function openAdminPanel() {
    if(!currentUser || currentUser.role !== 'admin') return alert("Access Denied");
    
    openModal('adminModal');
    
    // 1. Get Users Count
    try {
        const res = await fetch(`${AUTH_URL}/users`);
        const users = await res.json();
        document.getElementById('adminTotalUsers').innerText = users.length;
        
        // Setup User List Click
        document.getElementById('statUsers').onclick = () => renderAdminUserList(users);
    } catch(e) { console.error(e); }
    
    // 2. Shops Count
    fetchShops(); // Refresh shops to get count
}

function renderAdminUserList(users) {
    const container = document.getElementById('adminListContainer');
    const section = document.getElementById('adminListSection');
    section.style.display = 'block';
    container.innerHTML = '';
    
    users.forEach(user => {
        const div = document.createElement('div');
        div.style.padding = "10px";
        div.style.borderBottom = "1px solid #ccc";
        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        
        div.innerHTML = `
            <span><b>${user.username}</b> (${user.role})</span>
            ${user.username !== 'admin' ? 
            `<button onclick="deleteUser(${user.id})" style="background:red; color:white; border:none; padding:5px;">Delete</button>` : ''}
        `;
        container.appendChild(div);
    });
}

async function deleteUser(id) {
    if(!confirm("Delete this user?")) return;
    await fetch(`${AUTH_URL}/users/${id}`, { method: 'DELETE' });
    openAdminPanel(); // Refresh
}

// 7. UI HELPER FUNCTIONS
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
        
        // Show Add Shop for Provider/Admin
        if (addBtn) addBtn.style.display = (currentUser.role === 'provider' || currentUser.role === 'admin') ? 'inline-block' : 'none';
        
        // Show Admin Panel Button for Admin
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
    
    // Admin Panel Button Listener
    const adminBtn = document.getElementById('adminPanelBtn');
    if(adminBtn) adminBtn.onclick = openAdminPanel;

    document.querySelectorAll('.close').forEach(span => {
        span.onclick = function() { this.closest('.modal').style.display = 'none'; }
    });

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
