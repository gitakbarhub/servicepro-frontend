// ==================================================
// SERVICEPRO COMPLETE SCRIPT.JS (Cloud Connected)
// ==================================================

// --- 1. CONFIGURATION ---
// IMPORTANT: This is your Replit Backend URL.
const API_URL = 'https://0691fb63-24ec-4728-85ea-05b3b2145c59-00-3njhq9444p5wr.pike.replit.dev/api/shops';
const REQUEST_URL = 'https://0691fb63-24ec-4728-85ea-05b3b2145c59-00-3njhq9444p5wr.pike.replit.dev/api/requests';

const DEFAULT_CENTER = { lat: 31.4880, lng: 74.3430 }; // Lahore
const CURRENT_USER_KEY = 'serviceCurrentUser';

// --- 2. GLOBAL VARIABLES ---
let map;
let markers = [];
let currentUser = null;
let tempMarker = null; // For picking a location

// --- 3. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    checkLoginState();
    setupEventListeners();
});

function initMap() {
    // Create Map
    map = L.map('map').setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);

    // Add Street Map Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Load Shops from Cloud
    fetchShops();

    // Map Click Listener (For adding shops)
    map.on('click', onMapClick);
}

// --- 4. CLOUD AUTHENTICATION FUNCTIONS (UPDATED) ---

async function login(username, password) {
    const baseUrl = API_URL.replace('/api/shops', ''); // Remove /api/shops to get base URL
    
    try {
        const response = await fetch(`${baseUrl}/api/login`, {
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
            alert(`Welcome back, ${currentUser.role}!`);
        } else {
            alert(data.error || "Login failed");
        }
    } catch (error) {
        console.error(error);
        alert("Network Error: Could not log in. Check your internet connection.");
    }
}

async function register(username, password, role, question, answer) {
    const baseUrl = API_URL.replace('/api/shops', '');
    
    try {
        const response = await fetch(`${baseUrl}/api/register`, {
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
            alert("Account created successfully in Cloud!");
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
    alert("Logged out successfully.");
}

function checkLoginState() {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (stored) {
        currentUser = JSON.parse(stored);
        updateUIForUser();
    }
}

// --- 5. SHOP FUNCTIONS (CLOUD) ---

async function fetchShops() {
    try {
        const response = await fetch(API_URL);
        const shops = await response.json();
        
        // Clear old markers
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        // Add new markers
        shops.forEach(shop => {
            const marker = L.marker([shop.lat, shop.lng]).addTo(map);
            
            const popupContent = `
                <div class="popup-content">
                    <h3>${shop.name}</h3>
                    <p><strong>Service:</strong> ${shop.service}</p>
                    <p><strong>Phone:</strong> ${shop.phone}</p>
                    <p>${shop.description}</p>
                    ${currentUser && currentUser.role === 'user' ? 
                      `<button onclick="requestService('${shop.id}', '${shop.name}')">Request Service</button>` : ''}
                    ${currentUser && (currentUser.id == shop.ownerId || currentUser.username === 'admin') ? 
                      `<button onclick="deleteShop(${shop.id})" style="background:red; color:white;">Delete</button>` : ''}
                </div>
            `;
            
            marker.bindPopup(popupContent);
            markers.push(marker);
        });
    } catch (error) {
        console.error("Error loading shops:", error);
    }
}

async function addShop(name, service, phone, address, desc, lat, lng) {
    if (!currentUser) return alert("Please login first");

    const newShop = {
        ownerId: currentUser.id,
        name: name,
        service: service,
        phone: phone,
        address: address,
        description: desc,
        lat: lat,
        lng: lng
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newShop)
        });

        if (response.ok) {
            alert("Shop Added to Cloud!");
            closeModal('addShopModal');
            fetchShops(); // Refresh map immediately
            if (tempMarker) map.removeLayer(tempMarker);
        } else {
            alert("Failed to save shop.");
        }
    } catch (error) {
        console.error(error);
        alert("Error saving shop.");
    }
}

async function deleteShop(id) {
    if (!confirm("Are you sure you want to delete this shop?")) return;
    
    try {
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        if (response.ok) {
            alert("Shop Deleted");
            fetchShops();
        } else {
            alert("Failed to delete");
        }
    } catch (error) {
        console.error(error);
    }
}

// --- 6. MAP INTERACTION ---

function onMapClick(e) {
    if (!currentUser || (currentUser.role !== 'provider' && currentUser.role !== 'admin')) return;
    
    // Only allow picking location if "Add Shop" modal is NOT open yet
    // Or we can just set the coordinates for the form
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // Show a temporary marker
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([lat, lng]).addTo(map).bindPopup("New Shop Location").openPopup();
    
    // Auto-fill the hidden inputs in the Add Shop form
    document.getElementById('shopLat').value = lat;
    document.getElementById('shopLng').value = lng;
    
    // Open the modal if not open
    openModal('addShopModal');
}

// --- 7. UI HELPER FUNCTIONS ---

function updateUIForUser() {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const addShopBtn = document.getElementById('addShopBtn');

    if (currentUser) {
        loginBtn.style.display = 'none';
        registerBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        logoutBtn.innerText = `Logout (${currentUser.username})`;
        
        // Only Providers and Admins can see "Add Shop" button
        if (currentUser.role === 'provider' || currentUser.role === 'admin') {
            addShopBtn.style.display = 'inline-block';
        } else {
            addShopBtn.style.display = 'none';
        }
    } else {
        loginBtn.style.display = 'inline-block';
        registerBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        addShopBtn.style.display = 'none';
    }
}

function openModal(id) {
    document.getElementById(id).style.display = 'block';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// --- 8. EVENT LISTENERS ---

function setupEventListeners() {
    // Button Clicks
    document.getElementById('loginBtn').onclick = () => openModal('loginModal');
    document.getElementById('registerBtn').onclick = () => openModal('registerModal');
    document.getElementById('addShopBtn').onclick = () => {
        alert("Click on the map to set your shop location!");
        closeModal('addShopModal'); // Close it first so they can click map
    };
    document.getElementById('logoutBtn').onclick = logout;

    // Close buttons (x)
    document.querySelectorAll('.close').forEach(span => {
        span.onclick = function() {
            this.parentElement.parentElement.style.display = 'none';
        }
    });

    // Form Submits
    document.getElementById('loginForm').onsubmit = (e) => {
        e.preventDefault();
        const u = document.getElementById('loginUser').value;
        const p = document.getElementById('loginPass').value;
        login(u, p);
    };

    document.getElementById('registerForm').onsubmit = (e) => {
        e.preventDefault();
        const u = document.getElementById('regUser').value;
        const p = document.getElementById('regPass').value;
        const r = document.getElementById('regRole').value;
        const q = document.getElementById('regQuestion').value;
        const a = document.getElementById('regAnswer').value;
        register(u, p, r, q, a);
    };

    document.getElementById('addShopForm').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('shopName').value;
        const service = document.getElementById('shopService').value;
        const phone = document.getElementById('shopPhone').value;
        const address = document.getElementById('shopAddress').value;
        const desc = document.getElementById('shopDesc').value;
        const lat = document.getElementById('shopLat').value;
        const lng = document.getElementById('shopLng').value;

        if (!lat || !lng) {
            alert("Please click on the map to set location first!");
            return;
        }
        addShop(name, service, phone, address, desc, lat, lng);
    };
}

// Global scope request function (so it works in popup)
window.requestService = async function(shopId, shopName) {
    if (!currentUser) return alert("Please login to request service");
    
    const address = prompt("Enter your address:");
    if (!address) return;

    // We use rough location or ask user (simplified for now)
    const reqData = {
        providerId: shopId, // In real app, we need provider's user ID, simplified here
        name: currentUser.username,
        phone: "000-0000", 
        address: address,
        lat: DEFAULT_CENTER.lat,
        lng: DEFAULT_CENTER.lng
    };

    try {
        const res = await fetch(REQUEST_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(reqData)
        });
        if (res.ok) alert("Request Sent to " + shopName);
        else alert("Failed to send request");
    } catch(e) { console.error(e); }
};