// ==================================================
// SERVICEPRO FINAL SCRIPT.JS (Connected & Fixed)
// ==================================================

// 1. CONFIGURATION
// I have put your exact Replit URL here:
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
        alert("Network Error: Replit might be asleep. Go to Replit and click Run.");
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
            alert("Account created successfully!");
        } else {
            alert(data.error || "Registration failed");
        }
    } catch (error) {
        console.error(error);
        alert("Network Error: Could not register.");
    }
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
        if (!response.ok) throw new Error("Failed to fetch");
        const shops = await response.json();
        
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        shops.forEach(shop => {
            const marker = L.marker([shop.lat, shop.lng]).addTo(map);
            marker.bindPopup(`
                <b>${shop.name}</b><br>
                ${shop.service}<br>
                ${shop.phone}<br>
                ${currentUser && currentUser.id == shop.owner_id ? 
                `<button onclick="deleteShop(${shop.id})" style="color:red">Delete</button>` : ''}
            `);
            markers.push(marker);
        });
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

// 6. MAP CLICK & UI
function onMapClick(e) {
    if (!currentUser || (currentUser.role !== 'provider' && currentUser.role !== 'admin')) return;
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([lat, lng]).addTo(map).bindPopup("New Location").openPopup();
    
    // FILLING THE CORRECT HTML INPUTS
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

    if (currentUser) {
        if(loggedOutView) loggedOutView.style.display = 'none';
        if(loggedInView) loggedInView.style.display = 'block';
        if(welcomeUser) welcomeUser.innerText = `Hi, ${currentUser.username}`;
        
        if (addBtn) {
            addBtn.style.display = (currentUser.role === 'provider' || currentUser.role === 'admin') ? 'inline-block' : 'none';
        }
    } else {
        if(loggedOutView) loggedOutView.style.display = 'block';
        if(loggedInView) loggedInView.style.display = 'none';
        if(addBtn) addBtn.style.display = 'none';
    }
}

// 7. LISTENERS
function setupEventListeners() {
    // Nav Buttons
    const loginBtn = document.getElementById('loginBtnNav');
    const regBtn = document.getElementById('registerBtnNav');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if(loginBtn) loginBtn.onclick = () => openModal('loginModal');
    if(regBtn) regBtn.onclick = () => openModal('registerModal');
    if(logoutBtn) logoutBtn.onclick = logout;

    // Close Modals
    document.querySelectorAll('.close').forEach(span => {
        span.onclick = function() { this.closest('.modal').style.display = 'none'; }
    });

    // Login Submit
    const loginForm = document.getElementById('loginForm');
    if(loginForm) loginForm.onsubmit = (e) => {
        e.preventDefault();
        const u = document.getElementById('loginUsername').value;
        const p = document.getElementById('loginPassword').value;
        login(u, p);
    };

    // Register Submit
    const regForm = document.getElementById('registerForm');
    if(regForm) regForm.onsubmit = (e) => {
        e.preventDefault();
        const u = document.getElementById('regUsername').value;
        const p = document.getElementById('regPassword').value;
        const r = document.getElementById('regRole').value;
        const q = document.getElementById('regQuestion').value;
        const a = document.getElementById('regAnswer').value;
        register(u, p, r, q, a);
    };

    // Add Shop Submit
    const providerForm = document.getElementById('providerForm');
    if(providerForm) providerForm.onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('providerName').value;
        const service = document.getElementById('providerService').value;
        const phone = document.getElementById('providerPhone').value;
        const address = document.getElementById('providerAddress').value;
        const desc = document.getElementById('providerDescription').value;
        const lat = document.getElementById('inputLat').value;
        const lng = document.getElementById('inputLng').value;

        addShop(name, service, phone, address, desc, lat, lng);
    };
    
    // Add Shop Button (Manual Click)
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
