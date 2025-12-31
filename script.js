// ==================================================
// SERVICEPRO CORRECTED SCRIPT.JS (Matches your HTML)
// ==================================================

// --- 1. CONFIGURATION ---
const API_URL = 'https://0691fb63-24ec-4728-85ea-05b3b2145c59-00-3njhq9444p5wr.pike.replit.dev/api/shops';
const REQUEST_URL = 'https://0691fb63-24ec-4728-85ea-05b3b2145c59-00-3njhq9444p5wr.pike.replit.dev/api/requests';

const DEFAULT_CENTER = { lat: 31.4880, lng: 74.3430 }; // Lahore
const CURRENT_USER_KEY = 'serviceCurrentUser';

// --- 2. GLOBAL VARIABLES ---
let map;
let markers = [];
let currentUser = null;
let tempMarker = null; 

// --- 3. INITIALIZATION ---
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

    // Map Click Listener (For adding shops)
    map.on('click', onMapClick);
}

// --- 4. CLOUD AUTHENTICATION ---

async function login(username, password) {
    const baseUrl = API_URL.replace('/api/shops', '');
    
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
        alert("Network Error: Is Replit Running?");
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
    alert("Logged out successfully.");
}

function checkLoginState() {
    const stored = localStorage.getItem(CURRENT_USER_KEY);
    if (stored) {
        currentUser = JSON.parse(stored);
        updateUIForUser();
    }
}

// --- 5. SHOP FUNCTIONS ---

async function fetchShops() {
    try {
        const response = await fetch(API_URL);
        const shops = await response.json();
        
        markers.forEach(m => map.removeLayer(m));
        markers = [];

        shops.forEach(shop => {
            const marker = L.marker([shop.lat, shop.lng]).addTo(map);
            
            const popupContent = `
                <div class="popup-content">
                    <h3>${shop.name}</h3>
                    <p><strong>Service:</strong> ${shop.service}</p>
                    <p><strong>Phone:</strong> ${shop.phone}</p>
                    <p>${shop.description}</p>
                    ${currentUser && currentUser.role === 'user' ? 
                      `<button onclick="requestService('${shop.id}', '${shop.name}')" class="btn-primary" style="margin-top:5px;">Request Service</button>` : ''}
                    ${currentUser && (currentUser.id == shop.ownerId || currentUser.username === 'admin') ? 
                      `<button onclick="deleteShop(${shop.id})" class="btn-danger" style="margin-top:5px;">Delete</button>` : ''}
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
            closeModal('addProviderModal');
            fetchShops(); 
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
    } catch (error) { console.error(error); }
}

// --- 6. MAP INTERACTION ---

function onMapClick(e) {
    // Only providers can click to add
    if (!currentUser || (currentUser.role !== 'provider' && currentUser.role !== 'admin')) return;
    
    // Check if modal is already open to prevent accidental clicks
    if(document.getElementById('addProviderModal').style.display === 'block') return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker([lat, lng]).addTo(map).bindPopup("New Location").openPopup();
    
    // Fill the hidden inputs in YOUR specific HTML form
    document.getElementById('inputLat').value = lat;
    document.getElementById('inputLng').value = lng;
    
    openModal('addProviderModal');
}

// --- 7. UI HELPER FUNCTIONS ---

function updateUIForUser() {
    // Correct IDs based on your HTML
    const loggedOutView = document.getElementById('loggedOutView');
    const loggedInView = document.getElementById('loggedInView');
    const welcomeUser = document.getElementById('welcomeUser');
    const addProviderBtn = document.getElementById('addProviderBtn');

    if (currentUser) {
        loggedOutView.style.display = 'none';
        loggedInView.style.display = 'block'; // Show the logged-in container
        welcomeUser.innerText = `Hi, ${currentUser.username}`;
        
        // Only Providers see "Add Shop"
        if (currentUser.role === 'provider' || currentUser.role === 'admin') {
            addProviderBtn.style.display = 'inline-block';
        } else {
            addProviderBtn.style.display = 'none';
        }
    } else {
        loggedOutView.style.display = 'block';
        loggedInView.style.display = 'none';
        addProviderBtn.style.display = 'none';
    }
}

function openModal(id) {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'block';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if(modal) modal.style.display = 'none';
}

// --- 8. EVENT LISTENERS ---

function setupEventListeners() {
    // 1. Navigation Buttons (Corrected IDs)
    document.getElementById('loginBtnNav').onclick = () => openModal('loginModal');
    document.getElementById('registerBtnNav').onclick = () => openModal('registerModal');
    document.getElementById('logoutBtn').onclick = logout;
    
    // 2. Add Shop Button
    const addBtn = document.getElementById('addProviderBtn');
    if(addBtn) {
        addBtn.onclick = () => {
            alert("Click on the map to set your shop location!");
            closeModal('addProviderModal');
        };
    }

    // 3. Close Modals (The 'x' buttons)
    document.querySelectorAll('.close').forEach(span => {
        span.onclick = function() {
            // Closes the closest modal parent
            this.closest('.modal').style.display = 'none';
        }
    });

    // 4. Login Form Submit
    document.getElementById('loginForm').onsubmit = (e) => {
        e.preventDefault();
        const u = document.getElementById('loginUsername').value; // Corrected ID
        const p = document.getElementById('loginPassword').value; // Corrected ID
        login(u, p);
    };

    // 5. Register Form Submit
    document.getElementById('registerForm').onsubmit = (e) => {
        e.preventDefault();
        const u = document.getElementById('regUsername').value; // Corrected ID
        const p = document.getElementById('regPassword').value; // Corrected ID
        const r = document.getElementById('regRole').value;
        const q = document.getElementById('regQuestion').value;
        const a = document.getElementById('regAnswer').value;
        register(u, p, r, q, a);
    };

    // 6. Add Shop Form Submit
    document.getElementById('providerForm').onsubmit = (e) => {
        e.preventDefault();
        const name = document.getElementById('providerName').value;
        const service = document.getElementById('providerService').value;
        const phone = document.getElementById('providerPhone').value;
        const address = document.getElementById('providerAddress').value;
        const desc = document.getElementById('providerDescription').value;
        const lat = document.getElementById('inputLat').value;
        const lng = document.getElementById('inputLng').value;

        if (!lat || !lng) {
            alert("Please click on the map to set location first!");
            return;
        }
        addShop(name, service, phone, address, desc, lat, lng);
    };
}

// Global scope request function
window.requestService = async function(shopId, shopName) {
    if (!currentUser) return alert("Please login to request service");
    const address = prompt("Enter your address:");
    if (!address) return;
    
    // Simplified Request
    try {
        const res = await fetch(REQUEST_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                providerId: shopId, 
                name: currentUser.username,
                phone: "000-0000", 
                address: address,
                lat: DEFAULT_CENTER.lat,
                lng: DEFAULT_CENTER.lng
            })
        });
        if (res.ok) alert("Request Sent!");
        else alert("Failed to send request");
    } catch(e) { console.error(e); }
};
