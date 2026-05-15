// ===== walls.js - FULL WALLS + BIDDING + SAVED SEARCHES & NOTIFICATIONS =====
window.WW_APP = window.WW_APP || {};

// ============= OAUTH / AUTH BACKEND CONFIG =============
// Google: only the CLIENT ID is used in browser (Google Identity Services).
// NEVER put your Google client SECRET in this file — it would be public.
// Email auth: set EMAIL_LOGIN_URL and EMAIL_REGISTER_URL to your backend endpoints.
//   - POST EMAIL_LOGIN_URL    body { email, password } -> returns { user: {...} } on 200
//   - POST EMAIL_REGISTER_URL body { name, email, phone, password } -> returns { user: {...} } on 200
// Optionally set GOOGLE_VERIFY_URL to a backend that validates the Google id_token.
window.WW_OAUTH = window.WW_OAUTH || {
  GOOGLE_CLIENT_ID: '463654130792-2ct7p5m2556nnrtmpm3ocuj6rfa2tisl.apps.googleusercontent.com',
  GOOGLE_VERIFY_URL: 'https://walls-marketplace.onrender.com/api/auth/google/verify',
  EMAIL_LOGIN_URL: 'https://walls-marketplace.onrender.com/api/login',
  EMAIL_REGISTER_URL: 'https://walls-marketplace.onrender.com/api/register'
};

// Lazy script loader
function _wwLoadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (id && document.getElementById(id)) return resolve();
    const s = document.createElement('script');
    if (id) s.id = id;
    s.src = src; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

// Helper functions
if (typeof window.$ === 'undefined') {
  window.$ = function(sel, root) { return (root || document).querySelector(sel); };
}
if (typeof window.$$ === 'undefined') {
  window.$$ = function(sel, root) { return Array.from((root || document).querySelectorAll(sel)); };
}
if (typeof window.$id === 'undefined') {
  window.$id = function(id) { return document.getElementById(id); };
}

// Toast notification function
function showToast(msg, type = 'info') {
  var toast = document.createElement('div');
  toast.className = 'toast-message';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : 'rgba(0,0,0,0.8)'};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    z-index: 9999;
    font-size: 14px;
    animation: fadeInUp 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  
  $$('.toast-message').forEach(t => t.remove());
  document.body.appendChild(toast);
  
  setTimeout(function() {
    toast.style.animation = 'fadeOutDown 0.3s ease';
    setTimeout(function() {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// Add toast animations if not present
if (!document.querySelector('#toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    @keyframes fadeOutDown {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
    }
  `;
  document.head.appendChild(style);
}

// Country codes for phone inputs
const COUNTRY_CODES = [
  { code: '+263', flag: '🇿🇼', name: 'Zimbabwe' },
  { code: '+27', flag: '🇿🇦', name: 'South Africa' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+255', flag: '🇹🇿', name: 'Tanzania' },
  { code: '+256', flag: '🇺🇬', name: 'Uganda' },
  { code: '+260', flag: '🇿🇲', name: 'Zambia' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+1', flag: '🇺🇸', name: 'USA' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+91', flag: '🇮🇳', name: 'India' }
];

// Modal functions
function openLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
}

function closeLoginModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'auto';
  }
}

function openCreateAccountModal() {
  const modal = document.getElementById('createAccountModal');
  if (modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    const phoneCodeSelect = $id('regPhoneCode');
    const phoneAltCodeSelect = $id('regPhoneAltCode');
    
    if (phoneCodeSelect) {
      phoneCodeSelect.innerHTML = COUNTRY_CODES.map(country => 
        `<option value="${country.code}">${country.flag} ${country.code}</option>`
      ).join('');
    }
    
    if (phoneAltCodeSelect) {
      phoneAltCodeSelect.innerHTML = COUNTRY_CODES.map(country => 
        `<option value="${country.code}">${country.flag} ${country.code}</option>`
      ).join('');
    }
  }
}

function closeCreateAccountModal() {
  const modal = document.getElementById('createAccountModal');
  if (modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'auto';
  }
}

// Main App Object
window.WW_APP = {
  initialized: false,
  currentView: 'app',
  currentCategory: null,
  currentMode: 'buy',
  listings: [],
  filteredListings: [],
  filters: {
    category: 'All',
    location: 'Anywhere',
    price: 'Any price',
    type: 'All types'
  },
  searchTerm: '',
  user: null,
  deferredPrompt: null,
  installPromptShown: false,
  likes: {},
  currentImageIndex: 0,
  displayMode: 'grid',
  adminView: 'listings',
  
  // Bidding related
  bidTimers: {},
  
  // Saved searches (new)
  savedSearches: [],
  
  // Helper to get default walls categories (NO SCHOOLS, includes services, new categories)
  _getDefaultWallsCategories: function() {
    return [
      { key: 'rentalsHouses', label: 'Full Houses to Rent', icon: 'fas fa-house-user', type: 'rental' },
      { key: 'rentalsFlats', label: 'Rent Flats', icon: 'fas fa-building', type: 'rental' },
      { key: 'rentalsRooms', label: 'Rent Rooms', icon: 'fas fa-door-open', type: 'rental' },
      { key: 'singleRoomsToRent', label: 'Single Rooms to Rent', icon: 'fas fa-door-closed', type: 'rental' },
      { key: 'cottagesToRent', label: 'Cottages to Rent', icon: 'fas fa-home', type: 'rental' },
      { key: 'bnb', label: 'BNB', icon: 'fas fa-bed', type: 'rental' },
      { key: 'sellingHouses', label: 'Full Houses for Sale', icon: 'fas fa-home', type: 'sale' },
      { key: 'sellingFlats', label: 'Sell Flats', icon: 'fas fa-building', type: 'sale' },
      { key: 'cottagesToSale', label: 'Cottages to Sale', icon: 'fas fa-home', type: 'sale' },
      { key: 'residentialStands', label: 'Residential Stands', icon: 'fas fa-map-marker-alt', type: 'sale' },
      { key: 'farmPlots', label: 'Farm Plots', icon: 'fas fa-seedling', type: 'sale' },
      { key: 'boardingHouses', label: 'Boarding Houses', icon: 'fas fa-school', type: 'rental' },
      // Service categories
      { key: 'househelp', label: 'Househelp Services', icon: 'fas fa-broom', type: 'service' },
      { key: 'construction', label: 'Construction Services', icon: 'fas fa-hard-hat', type: 'service' },
      { key: 'boreholeServices', label: 'Borehole Services', icon: 'fas fa-water', type: 'service' },
      { key: 'indriveDriver', label: 'InDrive Driver', icon: 'fas fa-car', type: 'service' }
    ];
  },
  
  // Helper to identify categories that require ownership verification
  _getSaleCategoriesRequiringVerification: function() {
    return ['sellingHouses', 'sellingFlats', 'cottagesToSale', 'residentialStands', 'farmPlots'];
  },
  
  // Helper to identify rental categories that can have occupancy status
  _getRentalCategories: function() {
    return ['rentalsHouses', 'rentalsFlats', 'rentalsRooms', 'singleRoomsToRent', 'cottagesToRent', 'bnb', 'boardingHouses'];
  },
  
  // Return the appropriate price suffix based on category
  _getPriceSuffix: function(category) {
    if (category === 'bnb') return '/day';
    if (this._getRentalCategories().includes(category)) return '/month';
    return ''; // sales and services
  },
  
  // Format price for display, adding correct suffix and dollar sign
  formatPrice: function(listing) {
    if (!listing.price || listing.price === 'Price on request') return 'Price on request';
    let numeric = listing.price.replace(/[^0-9.]/g, '');
    if (!numeric) return listing.price;
    let formatted = '$' + numeric;
    let suffix = this._getPriceSuffix(listing.category);
    if (suffix) formatted += suffix;
    return formatted;
  },
  
  // Initialize the app
  init: function() {
    console.log('Initializing Walls app...');
    
    if (this.initialized) {
      console.log('App already initialized');
      return;
    }
    
    try {
      this.initialized = true;
      this.setupInstallPrompt();
      this.loadUserState();
      this.loadUsers();
      this.loadLikes();
      this.loadListingsFromStorage();
      this.loadSupportContacts();
      this.loadHelpCenterData();
      this.loadCategories(); // load and merge defaults (no schools, includes services)
      this.loadSavedSearches(); // load saved searches
      this.setupEventListeners();
      this.updateUI();
      this.showAllListings(); // initial view: all listings (landing hidden)
      this.showInstallPromptIfAvailable();
      this.createAdminView(); // creates the admin panel UI and inserts it into <main>
      this.updateNavHighlight();
      this.startBidTimerLoop();
      this.injectMenuButton(); // add hamburger menu before logo
      this.adjustNavTabsForMobile(); // ensure labels visible below icons, full width
      this.generateManifestIfNeeded(); // create manifest for PWA install
      this.fixLanguageDropdownDirection(); // make language dropdown open upward
      console.log('App initialized successfully');
    } catch (error) {
      console.error('Error during app initialization:', error);
      showToast('Error initializing app. Please refresh the page.', 'error');
    }
  },

  // Fix language dropdown to open upwards
  fixLanguageDropdownDirection: function() {
    if (document.getElementById('langDropdownDownwardStyle')) return;
    const style = document.createElement('style');
    style.id = 'langDropdownDownwardStyle';
    style.textContent = `
      .lang-dropdown {
        top: 100% !important;
        bottom: auto !important;
        margin-top: 5px;
        margin-bottom: 0;
      }
    `;
    document.head.appendChild(style);
  },
  
  // Inject hamburger menu button before the logo
  injectMenuButton: function() {
    const navLeft = document.querySelector('.nav-left');
    if (!navLeft) return;
    if (navLeft.querySelector('.menu-toggle-btn')) return;
    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-toggle-btn';
    menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
    menuBtn.setAttribute('aria-label', 'Menu');
    menuBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #333;
      padding: 8px;
      margin-right: 12px;
      display: flex;
      align-items: center;
    `;
    navLeft.insertBefore(menuBtn, navLeft.firstChild);
    
    menuBtn.addEventListener('click', () => {
      const existing = document.getElementById('hamburgerMenuOverlay');
      if (existing) {
        existing.remove();
        return;
      }
      const overlay = document.createElement('div');
      overlay.id = 'hamburgerMenuOverlay';
      overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000;';
      const panel = document.createElement('div');
      panel.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 80%;
        max-width: 300px;
        height: 100%;
        background: white;
        box-shadow: 2px 0 20px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        padding: 20px;
        overflow-y: auto;
      `;
      panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <span class="brand-name" style="font-size: 20px; font-weight: 600;">Walls</span>
          <button id="closeMenuPanel" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
        </div>
        <button class="dropdown-item" id="menuBtnHelp"><i class="fas fa-question-circle"></i> Help Center</button>
        <button class="dropdown-item" id="menuBtnSupport"><i class="fas fa-headset"></i> Support Contacts</button>
        <button class="dropdown-item" id="menuBtnShare"><i class="fas fa-share-alt"></i> Share App</button>
        <button class="dropdown-item" id="menuBtnInstall"><i class="fas fa-download"></i> Install App</button>
        <button class="dropdown-item" id="menuBtnLogin"><i class="fas fa-sign-in-alt"></i> Log in</button>
        <button class="dropdown-item" id="menuBtnCreate"><i class="fas fa-user-plus"></i> Create account</button>
      `;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      
      const closePanel = () => overlay.remove();
      panel.querySelector('#closeMenuPanel').addEventListener('click', closePanel);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closePanel(); });
      
      panel.querySelector('#menuBtnHelp').addEventListener('click', () => { this.showHelpCenter(); closePanel(); });
      panel.querySelector('#menuBtnSupport').addEventListener('click', () => { this.showSupportContacts(); closePanel(); });
      panel.querySelector('#menuBtnShare').addEventListener('click', () => { this.showShareModal(); closePanel(); });
      panel.querySelector('#menuBtnInstall').addEventListener('click', () => { this.showInstallAppModal(); closePanel(); });
      panel.querySelector('#menuBtnLogin').addEventListener('click', () => { openLoginModal(); closePanel(); });
      panel.querySelector('#menuBtnCreate').addEventListener('click', () => { openCreateAccountModal(); closePanel(); });
    });
  },
  
  // Adjust nav tabs: ensure labels show below icons, full width, always
  adjustNavTabsForMobile: function() {
    const navTabs = document.querySelector('.nav-tabs');
    if (!navTabs) return;
    if (!document.getElementById('nav-mobile-styles')) {
      const style = document.createElement('style');
      style.id = 'nav-mobile-styles';
      style.textContent = `
        .nav-tabs {
          display: flex;
          justify-content: space-around;
          width: 100%;
        }
        .nav-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 12px 4px;
          font-size: 12px;
          gap: 4px;
          color: #555;
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-tab.active {
          color: #2E7D32;
          font-weight: 600;
        }
        .nav-tab i {
          font-size: 22px;
        }
        .tab-label {
          display: block !important;
          font-size: 11px;
          white-space: nowrap;
        }
      `;
      document.head.appendChild(style);
    }
  },
  
  // Generate a PWA-compliant manifest + register a minimal service worker
  // so desktop Chrome / Edge will show the install button.
  generateManifestIfNeeded: function() {
    if (!document.querySelector('link[rel="manifest"]')) {
      const makeIcon = (size) => {
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        // background
        ctx.fillStyle = '#2E7D32';
        ctx.fillRect(0, 0, size, size);
        // simple house glyph
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(4, size * 0.04);
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const s = size;
        ctx.moveTo(s*0.22, s*0.55);
        ctx.lineTo(s*0.5, s*0.22);
        ctx.lineTo(s*0.78, s*0.55);
        ctx.stroke();
        ctx.strokeRect(s*0.28, s*0.55, s*0.44, s*0.36);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(s*0.42, s*0.7, s*0.16, s*0.21);
        return c.toDataURL('image/png');
      };
      const icon192 = makeIcon(192);
      const icon512 = makeIcon(512);
      const manifest = {
        name: 'Walls - Property Marketplace',
        short_name: 'Walls',
        start_url: window.location.pathname,
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#ffffff',
        theme_color: '#2E7D32',
        description: 'Find homes, rentals and properties on Walls.',
        icons: [
          { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      };
      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = url;
      document.head.appendChild(link);

      // theme-color meta (helps install criteria on some browsers)
      if (!document.querySelector('meta[name="theme-color"]')) {
        const m = document.createElement('meta');
        m.name = 'theme-color';
        m.content = '#2E7D32';
        document.head.appendChild(m);
      }
      // apple-touch-icon for iOS Add-to-Home-Screen
      if (!document.querySelector('link[rel="apple-touch-icon"]')) {
        const al = document.createElement('link');
        al.rel = 'apple-touch-icon';
        al.href = icon192;
        document.head.appendChild(al);
      }
    }

    // Register a tiny service worker (required for desktop install prompt).
    // Some browsers reject blob: SW URLs; wrap in try/catch and fail silently.
    if ('serviceWorker' in navigator && !this._swRegistered) {
      this._swRegistered = true;
      try {
        const swCode = `self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});`;
        const swBlob = new Blob([swCode], { type: 'text/javascript' });
        const swUrl = URL.createObjectURL(swBlob);
        navigator.serviceWorker.register(swUrl).catch(() => {
          // Fallback: try a relative file if the host serves one
          navigator.serviceWorker.register('sw.js').catch(() => {});
        });
      } catch (e) { /* ignore */ }
    }
  },
  
  // Start global interval to update bid timers on cards/detail
  startBidTimerLoop: function() {
    setInterval(() => {
      this.updateAllBidTimers();
      this.checkSavedSearchesForVacancies(); // periodic notification check
    }, 10000); // check every 10 seconds
  },
  
  updateAllBidTimers: function() {
    const now = Date.now();
    $$('.bid-timer').forEach(el => {
      const endTime = parseInt(el.getAttribute('data-endtime'));
      if (!endTime) return;
      const diff = endTime - now;
      if (diff <= 0) {
        el.innerHTML = '<i class="fas fa-clock"></i> Ended';
        el.classList.add('expired');
      } else {
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        el.innerHTML = `<i class="fas fa-clock"></i> ${hours}h ${mins}m ${secs}s`;
        el.classList.remove('expired');
      }
    });
    
    const detailTimer = $id('bidDetailTimer');
    if (detailTimer) {
      const endTime = parseInt(detailTimer.getAttribute('data-endtime'));
      const diff = endTime - Date.now();
      if (diff <= 0) {
        detailTimer.innerHTML = 'Bidding ended';
        detailTimer.style.color = '#999';
      } else {
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        detailTimer.innerHTML = `${hours}h ${mins}m ${secs}s`;
      }
    }
  },
  
  // Load Saved Searches from localStorage (new)
  loadSavedSearches: function() {
    try {
      const data = localStorage.getItem('ww_saved_searches');
      if (data) {
        this.savedSearches = JSON.parse(data);
      } else {
        this.savedSearches = [];
      }
    } catch (e) {
      console.warn('Error loading saved searches:', e);
      this.savedSearches = [];
    }
  },
  
  saveSavedSearches: function() {
    try {
      localStorage.setItem('ww_saved_searches', JSON.stringify(this.savedSearches));
    } catch (e) {
      console.warn('Error saving saved searches:', e);
    }
  },
  
  // Check all saved searches against current listings and notify (called periodically)
  checkSavedSearchesForVacancies: function() {
    if (!this.savedSearches || this.savedSearches.length === 0) return;
    const visibleListings = this.listings.filter(l => this.isListingVisibleToUser(l));
    
    this.savedSearches.forEach(search => {
      const matchedListings = visibleListings.filter(listing => this.listingMatchesSearch(listing, search));
      const newMatches = matchedListings.length - (search.lastMatchCount || 0);
      if (newMatches > 0) {
        showToast(`New listing(s) found for your saved search "${search.label || 'Untitled'}"!`, 'info');
      }
      search.lastMatchCount = matchedListings.length;
    });
    this.saveSavedSearches();
  },
  
  // Check if a listing matches the saved search criteria
  listingMatchesSearch: function(listing, search) {
    if (search.keyword && !this._doesTextMatch(listing.title, search.keyword) && 
        (!listing.description || !this._doesTextMatch(listing.description, search.keyword))) return false;
    if (search.category && search.category !== 'All' && listing.category !== search.category) return false;
    if (search.location && search.location !== 'Anywhere' && listing.location !== search.location) return false;
    if (search.priceMin != null || search.priceMax != null) {
      const price = listing.price ? parseFloat(listing.price.replace(/[^0-9.]/g, '')) : null;
      if (price == null) return false;
      if (search.priceMin != null && price < search.priceMin) return false;
      if (search.priceMax != null && price > search.priceMax) return false;
    }
    if (search.occupancyStatus === 'vacant' && listing.occupancyStatus !== 'vacant') return false;
    if (search.type && search.type !== 'All types') {
      const saleCats = ['sellingHouses','sellingFlats','cottagesToSale','residentialStands','farmPlots'];
      const rentCats = ['rentalsHouses','rentalsFlats','rentalsRooms','singleRoomsToRent','cottagesToRent','bnb','boardingHouses'];
      const serviceCats = ['househelp','construction','boreholeServices','indriveDriver'];
      if (search.type === 'For Sale' && !saleCats.includes(listing.category)) return false;
      if (search.type === 'For Rent' && !rentCats.includes(listing.category)) return false;
      if (search.type === 'Services' && !serviceCats.includes(listing.category)) return false;
    }
    return true;
  },
  
  // Load and merge categories from localStorage, keeping only walls+services, no schools
  loadCategories: function() {
    try {
      const categoriesData = localStorage.getItem('ww_categories');
      let wallsCategories = this._getDefaultWallsCategories();
      
      if (categoriesData) {
        const parsed = JSON.parse(categoriesData);
        const savedWalls = Array.isArray(parsed.walls) ? parsed.walls : [];
        const savedKeys = new Set(savedWalls.map(c => c.key));
        const merged = [...savedWalls];
        wallsCategories.forEach(defCat => {
          if (!savedKeys.has(defCat.key)) {
            merged.push(defCat);
          }
        });
        wallsCategories = merged;
      }
      
      this.categories = { walls: wallsCategories };
    } catch (e) {
      console.warn('Error loading categories:', e);
      this.categories = { walls: this._getDefaultWallsCategories() };
    }
  },
  
  saveCategories: function() {
    try {
      localStorage.setItem('ww_categories', JSON.stringify(this.categories));
    } catch (e) {
      console.warn('Error saving categories:', e);
    }
  },
  
  // Load user state from localStorage
  loadUserState: function() {
    try {
      const userData = localStorage.getItem('ww_user');
      if (userData) {
        this.user = JSON.parse(userData);
        this.updateUserMenu();
      }
    } catch (e) {
      console.warn('Error loading user state:', e);
      this.user = null;
    }
  },
  
  // Load users from localStorage
  loadUsers: function() {
    try {
      const usersData = localStorage.getItem('ww_users');
      if (usersData) {
        this.allUsers = JSON.parse(usersData);
      } else {
        this.allUsers = [
          {
            id: 'admin_1',
            name: 'Admin Xtron',
            email: 'mickeyxtron@gmail.com',
            password: 'admin123',
            phone: '+263771593139',
            isAdmin: true,
            isBlocked: false,
            priority: 0,
            createdAt: new Date().toISOString()
          }
        ];
        this.saveUsers();
      }
    } catch (e) {
      console.warn('Error loading users:', e);
      this.allUsers = [];
    }
  },
  
  saveUsers: function() {
    try {
      localStorage.setItem('ww_users', JSON.stringify(this.allUsers));
    } catch (e) {
      console.warn('Error saving users:', e);
    }
  },
  
  // Load likes from localStorage. New shape: { [listingId]: { count: n, users: [id,...] } }
  // Migrates old shape: { [listingId]: number }
  loadLikes: function() {
    try {
      const likesData = localStorage.getItem('ww_likes');
      if (likesData) {
        const parsed = JSON.parse(likesData);
        const migrated = {};
        Object.keys(parsed || {}).forEach(k => {
          const v = parsed[k];
          if (typeof v === 'number') migrated[k] = { count: v, users: [] };
          else if (v && typeof v === 'object') migrated[k] = { count: v.count || 0, users: Array.isArray(v.users) ? v.users : [] };
        });
        this.likes = migrated;
      }
    } catch (e) {
      console.warn('Error loading likes:', e);
      this.likes = {};
    }
  },

  saveLikes: function() {
    try {
      localStorage.setItem('ww_likes', JSON.stringify(this.likes));
    } catch (e) {
      console.warn('Error saving likes:', e);
    }
  },

  // Stable identifier even when not logged in
  _getLikerId: function() {
    if (this.user && this.user.id) return this.user.id;
    let anon = localStorage.getItem('ww_anon_id');
    if (!anon) { anon = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('ww_anon_id', anon); }
    return anon;
  },

  _getLikeCount: function(listingId) {
    const e = this.likes[listingId];
    if (!e) return 0;
    return typeof e === 'number' ? e : (e.count || 0);
  },

  _hasLiked: function(listingId) {
    const e = this.likes[listingId];
    if (!e || typeof e === 'number') return false;
    return (e.users || []).indexOf(this._getLikerId()) !== -1;
  },
  
  // Load listings from localStorage
  loadListingsFromStorage: function() {
    try {
      const listingsData = localStorage.getItem('ww_listings_v2');
      if (listingsData) {
        this.listings = JSON.parse(listingsData);
        this.listings.forEach(l => {
          if (!l.contact) l.contact = { name: '', email: '', phone: '' };
          if (l.bidEnabled === undefined) l.bidEnabled = false;
          if (!l.bids) l.bids = [];
          if (!l.bidEndTime) l.bidEndTime = null;
          if (l.verificationStatus === undefined) {
            l.verificationStatus = this._getSaleCategoriesRequiringVerification().includes(l.category) ? 'pending' : null;
          }
          if (!l.verificationDocs) l.verificationDocs = [];
          if (l.occupancyStatus === undefined && this._getRentalCategories().includes(l.category)) {
            l.occupancyStatus = 'vacant';
          }
        });
        this.sortListings();
      } else {
        this.listings = [];
      }
    } catch (e) {
      console.warn('Error loading listings:', e);
      this.listings = [];
    }
  },
  
  // Sort listings by priority, ads, and likes
  sortListings: function() {
    this.listings.sort((a, b) => {
      const priorityA = a.adminPriority || 0;
      const priorityB = b.adminPriority || 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      const isAdA = a.isAd || false;
      const isAdB = b.isAd || false;
      if (isAdA !== isAdB) {
        return isAdB ? -1 : 1;
      }
      
      const likesA = this._getLikeCount(a.id);
      const likesB = this._getLikeCount(b.id);
      return likesB - likesA;
    });
  },
  
  saveListingsToStorage: function() {
    try {
      this.sortListings();
      localStorage.setItem('ww_listings_v2', JSON.stringify(this.listings));
      this.updateAdminStats();
    } catch (e) {
      console.warn('Error saving listings:', e);
    }
  },
  
  // Load support contacts from localStorage
  loadSupportContacts: function() {
    try {
      const contactsData = localStorage.getItem('ww_support_contacts');
      if (contactsData) {
        this.supportContacts = JSON.parse(contactsData);
      }
    } catch (e) {
      console.warn('Error loading support contacts:', e);
    }
  },
  
  saveSupportContacts: function() {
    try {
      localStorage.setItem('ww_support_contacts', JSON.stringify(this.supportContacts));
    } catch (e) {
      console.warn('Error saving support contacts:', e);
    }
  },
  
  // Load help center data from localStorage
  loadHelpCenterData: function() {
    try {
      const helpData = localStorage.getItem('ww_help_center');
      if (helpData) {
        const data = JSON.parse(helpData);
        this.helpCenterVideo = data.video || null;
        this.userQuestions = data.questions || [];
      }
    } catch (e) {
      console.warn('Error loading help center data:', e);
      this.helpCenterVideo = null;
      this.userQuestions = [];
    }
  },
  
  saveHelpCenterData: function() {
    try {
      const data = {
        video: this.helpCenterVideo,
        questions: this.userQuestions
      };
      localStorage.setItem('ww_help_center', JSON.stringify(data));
    } catch (e) {
      console.warn('Error saving help center data:', e);
    }
  },
  
  createAdminView: function() {
    if ($id('adminView')) return; // already exists

    const adminHTML = `
      <div id="adminView" style="display:none;">
        <div class="admin-view">
          <div class="admin-container">
            <div class="admin-header">
              <h2><i class="fas fa-cog"></i> Admin Panel</h2>
              <div class="admin-tabs">
                <button class="admin-tab active" id="adminListingsTabBtn" data-tab="listings">
                  <i class="fas fa-list"></i> Manage Listings
                </button>
                <button class="admin-tab" id="adminUsersTabBtn" data-tab="users">
                  <i class="fas fa-users"></i> Manage Users
                </button>
                <button class="admin-tab" id="adminSupportTabBtn" data-tab="support">
                  <i class="fas fa-headset"></i> Support Contacts
                </button>
                <button class="admin-tab" id="adminHelpTabBtn" data-tab="help">
                  <i class="fas fa-question-circle"></i> Help Center
                </button>
                <button class="admin-tab" id="adminCategoriesTabBtn" data-tab="categories">
                  <i class="fas fa-tags"></i> Categories
                </button>
                <button class="admin-tab" id="adminVerificationTabBtn" data-tab="verification">
                  <i class="fas fa-file-contract"></i> Verification
                </button>
              </div>
            </div>

            <div class="admin-content">
              <!-- Listings Section -->
              <div class="admin-section" id="adminListingsSection">
                <div class="admin-toolbar">
                  <div class="admin-search">
                    <div class="search-box">
                      <div class="search-icon"><i class="fas fa-search"></i></div>
                      <input type="text" id="adminListingsSearch" placeholder="Search listings...">
                    </div>
                  </div>
                  <div class="admin-stats">
                    <div class="stat-card">
                      <i class="fas fa-list"></i>
                      <span id="totalListingsCount">0</span>
                      <small>Total Listings</small>
                    </div>
                    <div class="stat-card">
                      <i class="fas fa-ad"></i>
                      <span id="adListingsCount">0</span>
                      <small>Promoted Ads</small>
                    </div>
                    <div class="stat-card">
                      <i class="fas fa-users"></i>
                      <span id="activeUsersCount">0</span>
                      <small>Active Users</small>
                    </div>
                  </div>
                </div>

                <div class="admin-table-container">
                  <table class="admin-table" id="adminListingsTable">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Location</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Bid Info</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="adminListingsBody"></tbody>
                  </table>
                </div>
              </div>

              <!-- Users Section -->
              <div class="admin-section" id="adminUsersSection" style="display: none;">
                <div class="admin-toolbar">
                  <div class="admin-search">
                    <div class="search-box">
                      <div class="search-icon"><i class="fas fa-search"></i></div>
                      <input type="text" id="adminUsersSearch" placeholder="Search users...">
                    </div>
                  </div>
                  <div class="admin-stats">
                    <div class="stat-card">
                      <i class="fas fa-user-check"></i>
                      <span id="totalUsersCount">0</span>
                      <small>Total Users</small>
                    </div>
                    <div class="stat-card">
                      <i class="fas fa-user-shield"></i>
                      <span id="adminUsersCount">0</span>
                      <small>Admins</small>
                    </div>
                    <div class="stat-card">
                      <i class="fas fa-user-slash"></i>
                      <span id="blockedUsersCount">0</span>
                      <small>Blocked Users</small>
                    </div>
                  </div>
                </div>

                <div class="admin-table-container">
                  <table class="admin-table" id="adminUsersTable">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="adminUsersBody"></tbody>
                  </table>
                </div>
              </div>

              <!-- Support Section -->
              <div class="admin-section" id="adminSupportSection" style="display: none;">
                <div class="admin-toolbar">
                  <h3>Support Contacts</h3>
                  <button class="btn btn-primary" id="addSupportContactBtn">
                    <i class="fas fa-plus"></i> Add Contact
                  </button>
                </div>
                <div class="admin-table-container">
                  <table class="admin-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Description</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody id="adminSupportBody"></tbody>
                  </table>
                </div>
              </div>

              <!-- Help Section -->
              <div class="admin-section" id="adminHelpSection" style="display: none;">
                <div class="admin-toolbar">
                  <h3>Help Center Management</h3>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                  <div class="admin-card">
                    <h4><i class="fas fa-video"></i> Help Center Video</h4>
                    <div id="videoPreview" style="margin: 16px 0; min-height: 200px; background: #f5f5f5; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                      ${this.helpCenterVideo ? 
                        `<video controls style="max-width: 100%; max-height: 200px; border-radius: 8px;">
                          <source src="${this.helpCenterVideo}" type="video/mp4">
                        </video>` : 
                        '<p>No video uploaded</p>'
                      }
                    </div>
                    <div class="form-group">
                      <label>Upload Video</label>
                      <input type="file" id="helpVideoUpload" accept="video/*" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
                    </div>
                    <button class="btn btn-primary" id="uploadVideoBtn" style="margin-top: 12px;">
                      <i class="fas fa-upload"></i> Upload Video
                    </button>
                  </div>

                  <div class="admin-card">
                    <h4><i class="fas fa-question"></i> User Questions</h4>
                    <div style="max-height: 400px; overflow-y: auto;">
                      <div id="userQuestionsList"></div>
                    </div>
                  </div>
                </div>

                <div class="admin-card" style="margin-top: 24px;">
                  <h4><i class="fas fa-file-alt"></i> Help Guide Content</h4>
                  <textarea id="helpGuideContent" rows="10" style="width: 100%; padding: 16px; border: 1px solid #ddd; border-radius: 8px; font-family: inherit;">${localStorage.getItem('ww_help_guide') || this.getDefaultHelpGuide()}</textarea>
                  <button class="btn btn-primary" id="saveHelpGuideBtn" style="margin-top: 12px;">
                    <i class="fas fa-save"></i> Save Guide
                  </button>
                </div>
              </div>

              <!-- Categories Section -->
              <div class="admin-section" id="adminCategoriesSection" style="display: none;">
                <div class="admin-toolbar">
                  <h3>Walls Categories</h3>
                  <button class="btn btn-primary" id="addCategoryBtn">
                    <i class="fas fa-plus"></i> Add Category
                  </button>
                </div>
                <div id="wallsCategoriesList"></div>
              </div>
              
              <!-- Verification Section -->
              <div class="admin-section" id="adminVerificationSection" style="display: none;">
                <div class="admin-toolbar">
                  <h3>Pending Verification Documents</h3>
                </div>
                <div id="verificationList"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Insert admin styles if not already present
    if (!document.querySelector('#admin-styles')) {
      const style = document.createElement('style');
      style.id = 'admin-styles';
      style.textContent = `
        .admin-view { padding: 20px; max-width: 1400px; margin: 0 auto; }
        .admin-container { background: white; border-radius: 12px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); overflow: hidden; }
        .admin-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; }
        .admin-header h2 { margin: 0 0 20px 0; font-size: 28px; }
        .admin-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .admin-tab { padding: 12px 24px; background: rgba(255,255,255,0.2); border: none; border-radius: 8px; color: white; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.3s; }
        .admin-tab:hover { background: rgba(255,255,255,0.3); }
        .admin-tab.active { background: white; color: #667eea; }
        .admin-content { padding: 24px; }
        .admin-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 20px; }
        .admin-search .search-box { width: 300px; }
        .admin-stats { display: flex; gap: 16px; }
        .stat-card { background: #f8f9fa; padding: 16px; border-radius: 8px; text-align: center; min-width: 120px; }
        .stat-card i { font-size: 24px; color: #667eea; margin-bottom: 8px; }
        .stat-card span { display: block; font-size: 24px; font-weight: 700; color: #333; }
        .stat-card small { color: #666; font-size: 12px; }
        .admin-table-container { overflow-x: auto; border-radius: 8px; border: 1px solid #e0e0e0; }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th { background: #f8f9fa; padding: 16px; text-align: left; font-weight: 600; color: #333; border-bottom: 2px solid #e0e0e0; }
        .admin-table td { padding: 16px; border-bottom: 1px solid #e0e0e0; }
        .admin-table tr:hover { background: #f8f9fa; }
        .admin-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .admin-btn { padding: 6px 12px; border-radius: 6px; border: none; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.3s; }
        .admin-btn.edit { background: #2196F3; color: white; }
        .admin-btn.edit:hover { background: #1976D2; }
        .admin-btn.delete { background: #F44336; color: white; }
        .admin-btn.delete:hover { background: #D32F2F; }
        .admin-btn.ad { background: #FF9800; color: white; }
        .admin-btn.ad:hover { background: #F57C00; }
        .admin-btn.block { background: #9E9E9E; color: white; }
        .admin-btn.block:hover { background: #757575; }
        .admin-btn.priority { background: #4CAF50; color: white; }
        .admin-btn.priority:hover { background: #388E3C; }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .status-active { background: #4CAF50; color: white; }
        .status-inactive { background: #F44336; color: white; }
        .status-blocked { background: #9E9E9E; color: white; }
        .status-ad { background: #FF9800; color: white; }
        .priority-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; background: #E3F2FD; color: #1976D2; }
        .priority-high { background: #FFF3E0; color: #F57C00; }
        .priority-top { background: #E8F5E9; color: #388E3C; }
        .admin-card { background: #f8f9fa; padding: 20px; border-radius: 12px; border: 1px solid #e0e0e0; }
        .categories-list { margin-top: 16px; }
        .category-item-admin { display: flex; align-items: center; justify-content: space-between; padding: 12px; background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 8px; }
        .category-item-admin:hover { background: #f8f9fa; }
        .category-info { display: flex; align-items: center; gap: 12px; }
        .category-icon { width: 40px; height: 40px; background: #667eea; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
        .verification-card { background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        .verification-docs img { max-height: 150px; border: 1px solid #ddd; border-radius: 6px; margin: 4px; }
        .occ-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        .occ-vacant { background: #4CAF50; color: white; }
        .occ-occupied { background: #F44336; color: white; }
        @media (max-width: 768px) {
          .admin-toolbar { flex-direction: column; align-items: stretch; }
          .admin-search .search-box { width: 100%; }
          .admin-stats { justify-content: center; flex-wrap: wrap; }
          .stat-card { min-width: 100px; }
          .admin-tabs { flex-wrap: wrap; }
          .admin-tab { flex: 1; min-width: 140px; justify-content: center; }
        }
      `;
      document.head.appendChild(style);
    }

    const temp = document.createElement('div');
    temp.innerHTML = adminHTML.trim();
    const adminViewEl = temp.firstElementChild;

    const mainEl = document.querySelector('main.main-content');
    if (mainEl) {
      mainEl.appendChild(adminViewEl);
    } else {
      document.body.appendChild(adminViewEl);
    }

    this.renderAdminCategories();
    this.switchAdminTab('listings');
  },
  
  setupEventListeners: function() {
    // Navigation tabs
    $id('navBuy').addEventListener('click', () => this.switchToMode('buy'));
    $id('navSell').addEventListener('click', () => this.switchToMode('sell'));
    $id('navRecent').addEventListener('click', () => this.switchToMode('recent'));
    $id('navMyListings').addEventListener('click', () => this.switchToMode('mylistings'));
    
    // User menu
    $id('userMenuBtn').addEventListener('click', (e) => this.toggleUserMenu(e));
    
    // Dropdown menu items
    $id('dropdownLogin').addEventListener('click', () => openLoginModal());
    $id('dropdownCreate').addEventListener('click', () => openCreateAccountModal());
    $id('dropdownShare').addEventListener('click', () => this.showShareModal());
    $id('dropdownInstallAppMenu').addEventListener('click', () => this.showInstallAppModal());
    $id('dropdownProfile').addEventListener('click', () => this.showProfile());
    $id('dropdownMyListings').addEventListener('click', () => this.switchToMode('mylistings')); // updated to open saved searches
    $id('dropdownShareApp').addEventListener('click', () => this.showShareModal());
    $id('dropdownInstallAppLoggedIn').addEventListener('click', () => this.showInstallAppModal());
    $id('dropdownLogout').addEventListener('click', () => this.logout());

    // Help Center buttons in dropdown
    $id('dropdownHelpCenter').addEventListener('click', () => this.showHelpCenter());
    $id('dropdownHelpCenterLoggedIn').addEventListener('click', () => this.showHelpCenter());
    
    // Support contacts
    document.addEventListener('click', (e) => {
      if (e.target.closest('.support-contacts-btn')) {
        e.preventDefault();
        this.showSupportContacts();
        const userDropdown = $id('userDropdown');
        if (userDropdown) userDropdown.style.display = 'none';
      }
    });
    
    // Hero buttons
    $id('heroCreateAccount').addEventListener('click', () => openCreateAccountModal());
    $id('heroLogin').addEventListener('click', () => openLoginModal());
    
    // Login modal
    $id('loginModalClose').addEventListener('click', () => closeLoginModal());
    $id('loginForm').addEventListener('submit', (e) => this.handleLoginSubmit(e));
    $id('createAccountFromLogin').addEventListener('click', (e) => {
      e.preventDefault();
      closeLoginModal();
      openCreateAccountModal();
    });
    
    // Create account modal
    $id('createAccountModalClose').addEventListener('click', () => closeCreateAccountModal());
    $id('createAccountForm').addEventListener('submit', (e) => this.handleCreateAccountSubmit(e));
    $id('loginFromCreateAccount').addEventListener('click', (e) => {
      e.preventDefault();
      closeCreateAccountModal();
      openLoginModal();
    });
    
    // Profile photo upload
    const profilePhotoInput = $id('profilePhotoInput');
    if (profilePhotoInput) {
      profilePhotoInput.addEventListener('change', (e) => this.handleProfilePhotoUpload(e));
    }
    
    // Listing and image modals
    $id('listingModalClose').addEventListener('click', () => this.closeListingModal());
    $id('imageModalClose').addEventListener('click', () => this.closeImageModal());
    
    // Filters – bind safely because some HTML versions do not include the old inline category dropdown
    const closeFilterMenu = () => {
      const filterDropdownContainer = $id('filterDropdownContainer');
      const advancedFiltersBtn = $id('advancedFilters');
      if (filterDropdownContainer) filterDropdownContainer.classList.remove('visible');
      if (advancedFiltersBtn) advancedFiltersBtn.innerHTML = '<i class="fas fa-sliders-h"></i><span>Filters</span>';
    };

    const filterCategoryBtn = $id('filterCategory');
    if (filterCategoryBtn) {
      filterCategoryBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeFilterMenu();
        this.toggleCategoryDropdown();
      });
    }

    const closeCategoryBtn = $id('closeCategory');
    if (closeCategoryBtn) {
      closeCategoryBtn.addEventListener('click', () => this.closeCategoryDropdown());
    }
    
    // Category listeners
    this.setupCategoryListeners();
    
    const filterLocationBtn = $id('filterLocation');
    if (filterLocationBtn) {
      filterLocationBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeFilterMenu();
        this.showLocationFilter();
      });
    }

    const filterPriceBtn = $id('filterPrice');
    if (filterPriceBtn) {
      filterPriceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeFilterMenu();
        this.showPriceFilter();
      });
    }

    const filterTypeBtn = $id('filterType');
    if (filterTypeBtn) {
      filterTypeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeFilterMenu();
        this.showTypeFilter();
      });
    }
    // No longer adding a listener for advancedFilters – HTML handles toggle via class
    
    // Search
    $id('mainSearch').addEventListener('input', (e) => this.handleSearch(e));
    
    // No longer adding a listener for searchIconBtn – HTML handles toggle of search box
    
    // Load more button
    const loadMoreBtn = $id('loadMoreBtn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.loadMoreListings());
    }
    
    // Document click handler
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this.navigateImages(e.key);
      }
    });
    
    // Modal click outside to close
    $$('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
          modal.setAttribute('aria-hidden', 'true');
          document.body.style.overflow = 'auto';
        }
      });
    });
    
    // Window resize
    window.addEventListener('resize', () => this.handleResize());
    
    // Install prompt
    const installBtn = $id('installBtn');
    const installClose = $id('installClose');
    if (installBtn) installBtn.addEventListener('click', () => this.handleInstallClick());
    if (installClose) installClose.addEventListener('click', () => this.hideInstallPrompt());
    
    // Share modal
    const shareModalClose = $id('shareModalClose');
    if (shareModalClose) {
      shareModalClose.addEventListener('click', () => this.closeShareModal());
    }
    $$('.share-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleShare(e));
    });
    
    // Social login buttons (Google only — Facebook removed)
    const googleLoginBtn = $id('googleLoginBtn');
    const googleSignupBtn = $id('googleSignupBtn');

    if (googleLoginBtn) googleLoginBtn.addEventListener('click', () => this.loginWithGoogle());
    if (googleSignupBtn) googleSignupBtn.addEventListener('click', () => this.loginWithGoogle());
    
    // Footer help center
    const footerHelpCenter = $id('footerHelpCenter');
    if (footerHelpCenter) {
      footerHelpCenter.addEventListener('click', (e) => {
        e.preventDefault();
        this.showHelpCenter();
      });
    }
    
    // Setup admin event listeners after a delay
    setTimeout(() => {
      this.setupAdminEventListeners();
    }, 100);
  },
  
  // Fuzzy search helper: checks if any word in the text contains or starts with the search term
  _doesTextMatch: function(text, searchTerm) {
    if (!text || !searchTerm) return false;
    const normalizedText = text.toLowerCase();
    const term = searchTerm.toLowerCase().trim();
    if (normalizedText.includes(term)) return true;
    // Split into words and check if any word starts with the search term
    const words = normalizedText.split(/\s+/);
    return words.some(word => word.startsWith(term));
  },
  
  setupCategoryListeners: function() {
    const categoryItems = $$('.category-item');
    categoryItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const categoryKey = e.currentTarget.getAttribute('data-category');
        this.selectCategory(categoryKey);
      });
    });
  },
  
  setupAdminEventListeners: function() {
    const listingsTabBtn = $id('adminListingsTabBtn');
    const usersTabBtn = $id('adminUsersTabBtn');
    const supportTabBtn = $id('adminSupportTabBtn');
    const helpTabBtn = $id('adminHelpTabBtn');
    const categoriesTabBtn = $id('adminCategoriesTabBtn');
    const verificationTabBtn = $id('adminVerificationTabBtn');
    
    if (listingsTabBtn) {
      listingsTabBtn.addEventListener('click', () => this.switchAdminTab('listings'));
    }
    if (usersTabBtn) {
      usersTabBtn.addEventListener('click', () => this.switchAdminTab('users'));
    }
    if (supportTabBtn) {
      supportTabBtn.addEventListener('click', () => this.switchAdminTab('support'));
    }
    if (helpTabBtn) {
      helpTabBtn.addEventListener('click', () => this.switchAdminTab('help'));
    }
    if (categoriesTabBtn) {
      categoriesTabBtn.addEventListener('click', () => this.switchAdminTab('categories'));
    }
    if (verificationTabBtn) {
      verificationTabBtn.addEventListener('click', () => this.switchAdminTab('verification'));
    }
    
    const listingsSearch = $id('adminListingsSearch');
    const usersSearch = $id('adminUsersSearch');
    
    if (listingsSearch) {
      listingsSearch.addEventListener('input', (e) => this.filterAdminListings(e.target.value));
    }
    if (usersSearch) {
      usersSearch.addEventListener('input', (e) => this.filterAdminUsers(e.target.value));
    }
    
    const addSupportContactBtn = $id('addSupportContactBtn');
    if (addSupportContactBtn) {
      addSupportContactBtn.addEventListener('click', () => this.showAddSupportContactModal());
    }
    
    const uploadVideoBtn = $id('uploadVideoBtn');
    if (uploadVideoBtn) {
      uploadVideoBtn.addEventListener('click', () => this.uploadHelpVideo());
    }
    
    const saveHelpGuideBtn = $id('saveHelpGuideBtn');
    if (saveHelpGuideBtn) {
      saveHelpGuideBtn.addEventListener('click', () => this.saveHelpGuide());
    }
    
    const addCategoryBtn = $id('addCategoryBtn');
    if (addCategoryBtn) {
      addCategoryBtn.addEventListener('click', () => this.showAddCategoryModal());
    }
  },
  
  switchAdminTab: function(tab) {
    this.adminView = tab;
    
    $$('.admin-tab').forEach(tabBtn => {
      tabBtn.classList.remove('active');
    });
    
    const activeTabBtn = $(`#admin${tab.charAt(0).toUpperCase() + tab.slice(1)}TabBtn`);
    if (activeTabBtn) activeTabBtn.classList.add('active');
    
    const sections = ['adminListingsSection', 'adminUsersSection', 'adminSupportSection', 'adminHelpSection', 'adminCategoriesSection', 'adminVerificationSection'];
    sections.forEach(section => {
      const el = $id(section);
      if (el) el.style.display = 'none';
    });
    
    const activeSection = $id(`admin${tab.charAt(0).toUpperCase() + tab.slice(1)}Section`);
    if (activeSection) activeSection.style.display = 'block';
    
    if (tab === 'listings') {
      this.renderAdminListings();
    } else if (tab === 'users') {
      this.renderAdminUsers();
    } else if (tab === 'support') {
      this.renderAdminSupport();
    } else if (tab === 'help') {
      this.renderAdminHelp();
    } else if (tab === 'categories') {
      this.renderAdminCategories();
    } else if (tab === 'verification') {
      this.renderAdminVerification();
    }
  },
  
  renderAdminListings: function(searchTerm = '') {
    const listingsBody = $id('adminListingsBody');
    if (!listingsBody) return;
    
    let filteredListings = [...this.listings];
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredListings = filteredListings.filter(listing => 
        listing.title.toLowerCase().includes(search) ||
        (listing.description && listing.description.toLowerCase().includes(search)) ||
        (listing.location && listing.location.toLowerCase().includes(search)) ||
        (listing.contact?.name && listing.contact.name.toLowerCase().includes(search)) ||
        (listing.contact?.email && listing.contact.email.toLowerCase().includes(search))
      );
    }
    
    if (filteredListings.length === 0) {
      listingsBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
            <i class="fas fa-search" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
            <p>No listings found</p>
          </td>
        </tr>
      `;
      return;
    }
    
    listingsBody.innerHTML = filteredListings.map(listing => {
      const isAd = listing.isAd || false;
      const adminPriority = listing.adminPriority || 0;
      const status = listing.status || 'active';
      const bidInfo = listing.bidEnabled ? `Bids: ${listing.bids ? listing.bids.length : 0} | Ends: ${listing.bidEndTime ? new Date(listing.bidEndTime).toLocaleString() : 'N/A'}` : 'No bids';
      
      let priorityClass = 'priority-badge';
      if (adminPriority >= 3) priorityClass += ' priority-top';
      else if (adminPriority >= 2) priorityClass += ' priority-high';
      
      let verificationInfo = '';
      if (this._getSaleCategoriesRequiringVerification().includes(listing.category)) {
        verificationInfo = `<div style="margin-top:4px;font-size:11px;">Verify: ${listing.verificationStatus || 'pending'}</div>`;
      }
      
      const displayPrice = this.formatPrice(listing);
      
      return `
        <tr>
          <td>
            <strong>${listing.title}</strong>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
              ${listing.categoryLabel || 'Uncategorized'}
            </div>
            ${verificationInfo}
          </td>
          <td>${listing.categoryLabel || 'N/A'}</td>
          <td>
            ${listing.price ? 
              `<span style="color: #4CAF50; font-weight: bold;">${displayPrice}</span>` : 
              'N/A'
            }
          </td>
          <td>${listing.location || 'N/A'}</td>
          <td>
            <div>${listing.contact?.name || 'N/A'}</div>
            <div style="font-size: 12px; color: #666;">${listing.contact?.email || ''}</div>
          </td>
          <td>
            <span class="status-badge ${isAd ? 'status-ad' : status === 'active' ? 'status-active' : 'status-inactive'}">
              ${isAd ? 'AD' : status === 'active' ? 'Active' : 'Inactive'}
            </span>
            ${adminPriority > 0 ? `<span class="${priorityClass}" style="margin-left: 8px;">P${adminPriority}</span>` : ''}
          </td>
          <td>${bidInfo}</td>
          <td>
            <div class="admin-actions">
              <button class="admin-btn edit" onclick="window.WW_APP.adminEditListing('${listing.id}')">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button class="admin-btn ad" onclick="window.WW_APP.toggleAd('${listing.id}')">
                <i class="fas fa-ad"></i> ${isAd ? 'Remove Ad' : 'Make Ad'}
              </button>
              <button class="admin-btn priority" onclick="window.WW_APP.showPriorityModal('${listing.id}')">
                <i class="fas fa-star"></i> Priority
              </button>
              <button class="admin-btn delete" onclick="window.WW_APP.adminDeleteListing('${listing.id}')">
                <i class="fas fa-trash"></i> Delete
              </button>
              <button class="admin-btn edit" onclick="window.WW_APP.toggleBidListing('${listing.id}')">
                <i class="fas fa-gavel"></i> Bid
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },
  
  filterAdminListings: function(searchTerm) {
    this.renderAdminListings(searchTerm);
  },
  
  renderAdminUsers: function(searchTerm = '') {
    const usersBody = $id('adminUsersBody');
    if (!usersBody) return;
    
    let filteredUsers = [...this.allUsers];
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filteredUsers = filteredUsers.filter(user => 
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search) ||
        (user.phone && user.phone.toLowerCase().includes(search))
      );
    }
    
    if (filteredUsers.length === 0) {
      usersBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: #666;">
            <i class="fas fa-users" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
            <p>No users found</p>
          </td>
        </tr>
      `;
      return;
    }
    
    usersBody.innerHTML = filteredUsers.map(user => {
      const isCurrentUser = this.user && this.user.email === user.email;
      const priority = user.priority || 0;
      
      let priorityClass = 'priority-badge';
      if (priority >= 3) priorityClass += ' priority-top';
      else if (priority >= 2) priorityClass += ' priority-high';
      
      return `
        <tr>
          <td>
            <strong>${user.name}</strong>
            ${user.isAdmin ? '<span style="margin-left: 8px; background: #667eea; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px;">ADMIN</span>' : ''}
            ${isCurrentUser ? '<span style="margin-left: 8px; background: #4CAF50; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px;">YOU</span>' : ''}
          </td>
          <td>${user.email}</td>
          <td>${user.phone || 'N/A'}</td>
          <td>${user.isAdmin ? 'Administrator' : 'Regular User'}</td>
          <td>
            <span class="status-badge ${user.isBlocked ? 'status-blocked' : 'status-active'}">
              ${user.isBlocked ? 'Blocked' : 'Active'}
            </span>
          </td>
          <td>
            ${priority > 0 ? `<span class="${priorityClass}">P${priority}</span>` : 'Normal'}
          </td>
          <td>
            <div class="admin-actions">
              ${!user.isAdmin ? `
                <button class="admin-btn ${user.isBlocked ? 'priority' : 'block'}" onclick="window.WW_APP.toggleUserBlock('${user.id}')">
                  <i class="fas ${user.isBlocked ? 'fa-check' : 'fa-ban'}"></i> ${user.isBlocked ? 'Unblock' : 'Block'}
                </button>
                <button class="admin-btn priority" onclick="window.WW_APP.showUserPriorityModal('${user.id}')">
                  <i class="fas fa-star"></i> Priority
                </button>
              ` : ''}
              ${!user.isAdmin && !isCurrentUser ? `
                <button class="admin-btn delete" onclick="window.WW_APP.adminDeleteUser('${user.id}')">
                  <i class="fas fa-trash"></i> Delete
                </button>
              ` : ''}
              ${user.isAdmin && !isCurrentUser ? `
                <button class="admin-btn block" onclick="window.WW_APP.revokeAdmin('${user.id}')">
                  <i class="fas fa-user-times"></i> Revoke Admin
                </button>
              ` : ''}
              ${!user.isAdmin ? `
                <button class="admin-btn edit" onclick="window.WW_APP.makeAdmin('${user.id}')">
                  <i class="fas fa-user-shield"></i> Make Admin
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },
  
  filterAdminUsers: function(searchTerm) {
    this.renderAdminUsers(searchTerm);
  },
  
  renderAdminSupport: function() {
    const supportBody = $id('adminSupportBody');
    if (!supportBody) return;
    
    if (this.supportContacts.length === 0) {
      supportBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 40px; color: #666;">
            <i class="fas fa-headset" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
            <p>No support contacts added</p>
          </td>
        </tr>
      `;
      return;
    }
    
    supportBody.innerHTML = this.supportContacts.map(contact => `
      <tr>
        <td><strong>${contact.type}</strong></td>
        <td>${contact.name}</td>
        <td>${contact.phone}</td>
        <td>${contact.description}</td>
        <td>
          <div class="admin-actions">
            <button class="admin-btn edit" onclick="window.WW_APP.editSupportContact('${contact.id}')">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="admin-btn delete" onclick="window.WW_APP.deleteSupportContact('${contact.id}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },
  
  renderAdminHelp: function() {
    const questionsList = $id('userQuestionsList');
    if (!questionsList) return;
    
    if (this.userQuestions.length === 0) {
      questionsList.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
          <i class="fas fa-question-circle" style="font-size: 36px; margin-bottom: 12px; opacity: 0.5;"></i>
          <p>No questions from users yet</p>
        </div>
      `;
      return;
    }
    
    questionsList.innerHTML = this.userQuestions.map((q, index) => `
      <div class="question-item" style="padding: 16px; background: white; border-radius: 8px; margin-bottom: 12px; border: 1px solid #e0e0e0;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
          <div>
            <strong>${q.userName || 'Anonymous'}</strong>
            <div style="font-size: 12px; color: #666;">${q.email || 'No email'}</div>
          </div>
          <div style="font-size: 12px; color: #999;">${new Date(q.date).toLocaleDateString()}</div>
        </div>
        <p style="margin: 0; color: #333;">${q.question}</p>
        ${q.answer ? `
          <div style="margin-top: 12px; padding: 12px; background: #f0f8ff; border-radius: 6px; border-left: 4px solid #2196F3;">
            <strong style="color: #2196F3;">Admin Response:</strong>
            <p style="margin: 8px 0 0 0; color: #333;">${q.answer}</p>
          </div>
        ` : `
          <div style="margin-top: 12px;">
            <textarea id="answer_${index}" placeholder="Type your answer here..." rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;"></textarea>
            <button class="btn btn-primary" onclick="window.WW_APP.answerQuestion(${index})" style="margin-top: 8px; padding: 6px 16px; font-size: 12px;">
              <i class="fas fa-reply"></i> Reply
            </button>
          </div>
        `}
      </div>
    `).join('');
  },
  
  renderAdminCategories: function() {
    const renderCategoryList = (containerId) => {
      const container = $id(containerId);
      if (!container) return;
      
      const categories = this.categories.walls || [];
      if (categories.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">No categories</p>';
        return;
      }
      
      container.innerHTML = categories.map(cat => `
        <div class="category-item-admin">
          <div class="category-info">
            <div class="category-icon">
              <i class="${cat.icon}"></i>
            </div>
            <div>
              <strong>${cat.label}</strong>
              <div style="font-size: 12px; color: #666;">Key: ${cat.key}</div>
            </div>
          </div>
          <div class="admin-actions">
            <button class="admin-btn edit" onclick="window.WW_APP.editCategory('${cat.key}')">
              <i class="fas fa-edit"></i>
            </button>
            <button class="admin-btn delete" onclick="window.WW_APP.deleteCategory('${cat.key}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `).join('');
    };
    
    renderCategoryList('wallsCategoriesList');
  },
  
  renderAdminVerification: function() {
    const container = $id('verificationList');
    if (!container) return;
    
    const pendingListings = this.listings.filter(l => 
      this._getSaleCategoriesRequiringVerification().includes(l.category) && 
      l.verificationStatus === 'pending'
    );
    
    if (pendingListings.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#666;">No pending verification requests.</p>';
      return;
    }
    
    container.innerHTML = pendingListings.map(listing => {
      const docsHtml = listing.verificationDocs && listing.verificationDocs.length > 0
        ? listing.verificationDocs.map((doc, i) => `
            <div style="display:inline-block;margin:4px;">
              <a href="${doc}" target="_blank" style="display:block;">
                <img src="${doc}" style="max-height:150px;border:1px solid #ddd;border-radius:6px;" />
              </a>
              <div style="font-size:11px;text-align:center;">Doc ${i+1}</div>
            </div>
          `).join('')
        : '<p>No documents uploaded.</p>';
      
      return `
        <div class="verification-card">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <h4>${listing.title}</h4>
              <p><strong>Category:</strong> ${listing.categoryLabel} | <strong>Price:</strong> ${this.formatPrice(listing)}</p>
              <p><strong>Seller:</strong> ${listing.contact?.name || 'Unknown'} (${listing.contact?.email || ''})</p>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="admin-btn priority" onclick="window.WW_APP.approveVerification('${listing.id}')">
                <i class="fas fa-check"></i> Approve
              </button>
              <button class="admin-btn delete" onclick="window.WW_APP.rejectVerification('${listing.id}')">
                <i class="fas fa-times"></i> Reject
              </button>
            </div>
          </div>
          <div class="verification-docs" style="margin-top:12px;">
            <h5>Title Deeds / Proof of Ownership</h5>
            ${docsHtml}
          </div>
        </div>
      `;
    }).join('');
  },
  
  approveVerification: function(listingId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) return;
    listing.verificationStatus = 'approved';
    this.saveListingsToStorage();
    showToast('Verification approved. Listing is now visible.', 'success');
    this.renderAdminVerification();
  },
  
  rejectVerification: function(listingId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) return;
    listing.verificationStatus = 'rejected';
    this.saveListingsToStorage();
    showToast('Verification rejected. Listing will remain hidden.', 'error');
    this.renderAdminVerification();
  },
  
  updateAdminStats: function() {
    const totalListings = this.listings.length;
    const adListings = this.listings.filter(l => l.isAd).length;
    const activeUsers = this.allUsers.filter(u => !u.isBlocked).length;
    
    const totalListingsCount = $id('totalListingsCount');
    const adListingsCount = $id('adListingsCount');
    const activeUsersCount = $id('activeUsersCount');
    
    if (totalListingsCount) totalListingsCount.textContent = totalListings;
    if (adListingsCount) adListingsCount.textContent = adListings;
    if (activeUsersCount) activeUsersCount.textContent = activeUsers;
    
    const totalUsers = this.allUsers.length;
    const adminUsers = this.allUsers.filter(u => u.isAdmin).length;
    const blockedUsers = this.allUsers.filter(u => u.isBlocked).length;
    
    const totalUsersCount = $id('totalUsersCount');
    const adminUsersCount = $id('adminUsersCount');
    const blockedUsersCount = $id('blockedUsersCount');
    
    if (totalUsersCount) totalUsersCount.textContent = totalUsers;
    if (adminUsersCount) adminUsersCount.textContent = adminUsers;
    if (blockedUsersCount) blockedUsersCount.textContent = blockedUsers;
  },
  
  toggleAd: function(listingId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) {
      showToast('Listing not found', 'error');
      return;
    }
    
    listing.isAd = !listing.isAd;
    this.saveListingsToStorage();
    
    showToast(`Listing ${listing.isAd ? 'marked as ad' : 'removed from ads'}`, 'success');
    this.renderAdminListings($id('adminListingsSearch')?.value || '');
  },
  
  showPriorityModal: function(listingId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) {
      showToast('Listing not found', 'error');
      return;
    }
    
    const currentPriority = listing.adminPriority || 0;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Set Listing Priority</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 20px; color: #666;">
            Higher priority listings appear first in search results.
          </p>
          
          <div style="margin-bottom: 24px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Priority Level (0-5)</label>
            <div style="display: flex; align-items: center; gap: 12px;">
              <input type="range" id="priorityRange" min="0" max="5" value="${currentPriority}" 
                     style="flex: 1;">
              <span id="priorityValue" style="font-weight: bold; font-size: 18px; min-width: 30px;">${currentPriority}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #666;">
              <span>Normal</span>
              <span>Highest</span>
            </div>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-outline" id="cancelPriority" style="flex: 1;">Cancel</button>
            <button class="btn btn-primary" id="savePriority" style="flex: 1;">Save Priority</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const priorityRange = modal.querySelector('#priorityRange');
    const priorityValue = modal.querySelector('#priorityValue');
    
    priorityRange.addEventListener('input', function() {
      priorityValue.textContent = this.value;
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancelPriority').addEventListener('click', () => modal.remove());
    modal.querySelector('#savePriority').addEventListener('click', () => {
      const priority = parseInt(priorityRange.value);
      listing.adminPriority = priority;
      this.saveListingsToStorage();
      showToast(`Priority set to ${priority}`, 'success');
      modal.remove();
      this.renderAdminListings($id('adminListingsSearch')?.value || '');
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },
  
  showUserPriorityModal: function(userId) {
    const user = this.allUsers.find(u => u.id === userId);
    if (!user) {
      showToast('User not found', 'error');
      return;
    }
    
    const currentPriority = user.priority || 0;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Set User Priority</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 20px; color: #666;">
            Higher priority users have their listings appear first.
          </p>
          
          <div style="margin-bottom: 24px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Priority Level (0-5)</label>
            <div style="display: flex; align-items: center; gap: 12px;">
              <input type="range" id="userPriorityRange" min="0" max="5" value="${currentPriority}" 
                     style="flex: 1;">
              <span id="userPriorityValue" style="font-weight: bold; font-size: 18px; min-width: 30px;">${currentPriority}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #666;">
              <span>Normal</span>
              <span>Highest</span>
            </div>
          </div>
          
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-outline" id="cancelUserPriority" style="flex: 1;">Cancel</button>
            <button class="btn btn-primary" id="saveUserPriority" style="flex: 1;">Save Priority</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const priorityRange = modal.querySelector('#userPriorityRange');
    const priorityValue = modal.querySelector('#userPriorityValue');
    
    priorityRange.addEventListener('input', function() {
      priorityValue.textContent = this.value;
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancelUserPriority').addEventListener('click', () => modal.remove());
    modal.querySelector('#saveUserPriority').addEventListener('click', () => {
      const priority = parseInt(priorityRange.value);
      user.priority = priority;
      this.saveUsers();
      
      this.listings.forEach(listing => {
        if (listing.createdBy === user.email) {
          listing.adminPriority = Math.max(listing.adminPriority || 0, priority);
        }
      });
      
      this.saveListingsToStorage();
      showToast(`Priority set to ${priority} for ${user.name}`, 'success');
      modal.remove();
      this.renderAdminUsers($id('adminUsersSearch')?.value || '');
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },
  
  toggleUserBlock: function(userId) {
    const user = this.allUsers.find(u => u.id === userId);
    if (!user) {
      showToast('User not found', 'error');
      return;
    }
    
    if (user.isAdmin) {
      showToast('Cannot block administrators', 'error');
      return;
    }
    
    user.isBlocked = !user.isBlocked;
    this.saveUsers();
    
    showToast(`User ${user.isBlocked ? 'blocked' : 'unblocked'}`, 'success');
    this.renderAdminUsers($id('adminUsersSearch')?.value || '');
  },
  
  makeAdmin: function(userId) {
    const user = this.allUsers.find(u => u.id === userId);
    if (!user) {
      showToast('User not found', 'error');
      return;
    }
    
    if (confirm(`Make ${user.name} an administrator?`)) {
      user.isAdmin = true;
      user.priority = 0;
      this.saveUsers();
      showToast(`${user.name} is now an administrator`, 'success');
      this.renderAdminUsers($id('adminUsersSearch')?.value || '');
    }
  },
  
  revokeAdmin: function(userId) {
    const user = this.allUsers.find(u => u.id === userId);
    if (!user) {
      showToast('User not found', 'error');
      return;
    }
    
    if (user.email === this.user.email) {
      showToast('Cannot revoke your own admin privileges', 'error');
      return;
    }
    
    if (confirm(`Revoke admin privileges from ${user.name}?`)) {
      user.isAdmin = false;
      this.saveUsers();
      showToast(`Admin privileges revoked from ${user.name}`, 'success');
      this.renderAdminUsers($id('adminUsersSearch')?.value || '');
    }
  },
  
  adminDeleteListing: function(listingId) {
    if (confirm('Are you sure you want to delete this listing? This action cannot be undone.')) {
      this.listings = this.listings.filter(listing => listing.id !== listingId);
      this.saveListingsToStorage();
      showToast('Listing deleted successfully', 'success');
      this.renderAdminListings($id('adminListingsSearch')?.value || '');
    }
  },
  
  adminDeleteUser: function(userId) {
    const user = this.allUsers.find(u => u.id === userId);
    if (!user) {
      showToast('User not found', 'error');
      return;
    }
    
    if (user.isAdmin) {
      showToast('Cannot delete administrators', 'error');
      return;
    }
    
    if (confirm(`Delete user ${user.name}? All their listings will also be deleted.`)) {
      this.listings = this.listings.filter(listing => listing.createdBy !== user.email);
      this.allUsers = this.allUsers.filter(u => u.id !== userId);
      this.saveUsers();
      this.saveListingsToStorage();
      
      showToast('User and their listings deleted', 'success');
      this.renderAdminUsers($id('adminUsersSearch')?.value || '');
    }
  },
  
  adminEditListing: function(listingId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) {
      showToast('Listing not found', 'error');
      return;
    }
    
    if (!listing.contact) {
      listing.contact = { name: '', email: '', phone: '' };
    }
    if (listing.bidEnabled === undefined) listing.bidEnabled = false;
    if (!listing.bids) listing.bids = [];
    if (!listing.bidEndTime) listing.bidEndTime = null;
    
    const isRental = this._getRentalCategories().includes(listing.category);
    const occupancyOptions = isRental ? `
      <div class="form-group">
        <label>Occupancy Status</label>
        <select id="editOccupancy" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
          <option value="vacant" ${listing.occupancyStatus === 'vacant' ? 'selected' : ''}>Vacant</option>
          <option value="occupied" ${listing.occupancyStatus === 'occupied' ? 'selected' : ''}>Occupied</option>
        </select>
      </div>
    ` : '';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Edit Listing: ${listing.title}</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="adminEditForm">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Title</label>
                <input type="text" id="editTitle" value="${listing.title}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Price</label>
                <input type="text" id="editPrice" value="${listing.price || ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Location</label>
                <input type="text" id="editLocation" value="${listing.location || ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Status</label>
                <select id="editStatus" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                  <option value="active" ${listing.status === 'active' ? 'selected' : ''}>Active</option>
                  <option value="inactive" ${listing.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                  <option value="sold" ${listing.status === 'sold' ? 'selected' : ''}>Sold</option>
                  <option value="rented" ${listing.status === 'rented' ? 'selected' : ''}>Rented</option>
                </select>
              </div>
              ${occupancyOptions}
            </div>
            
            <div style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Description</label>
              <textarea id="editDescription" rows="4" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; resize: vertical;">${listing.description || ''}</textarea>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Seller Name</label>
                <input type="text" id="editSellerName" value="${listing.contact.name || ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Seller Email</label>
                <input type="email" id="editSellerEmail" value="${listing.contact.email || ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Seller Phone</label>
                <input type="tel" id="editSellerPhone" value="${listing.contact.phone || ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              </div>
              <div>
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <input type="checkbox" id="editIsAd" ${listing.isAd ? 'checked' : ''}>
                  <span style="font-weight: 500;">Promote as Advertisement</span>
                </label>
                <div style="margin-top: 8px;">
                  <label style="display: block; margin-bottom: 8px; font-weight: 500;">Admin Priority (0-5)</label>
                  <input type="number" id="editAdminPriority" min="0" max="5" value="${listing.adminPriority || 0}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                </div>
              </div>
            </div>
            <div style="margin-bottom: 20px; padding: 16px; background: #f9f9f9; border-radius: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-weight: 600;">
                <input type="checkbox" id="editBidEnabled" ${listing.bidEnabled ? 'checked' : ''}>
                Enable Bidding
              </label>
              <div id="bidEndContainer" style="${listing.bidEnabled ? '' : 'display: none;'}">
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Bid End Date & Time</label>
                <input type="datetime-local" id="editBidEndTime" value="${listing.bidEndTime ? new Date(listing.bidEndTime).toISOString().slice(0, 16) : ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              </div>
            </div>
            
            <div style="display: flex; gap: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <button type="button" class="btn btn-outline" id="cancelEdit" style="flex: 1;">Cancel</button>
              <button type="submit" class="btn btn-primary" style="flex: 1;">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const bidEnabledCheckbox = modal.querySelector('#editBidEnabled');
    const bidEndContainer = modal.querySelector('#bidEndContainer');
    if (bidEnabledCheckbox) {
      bidEnabledCheckbox.addEventListener('change', function() {
        bidEndContainer.style.display = this.checked ? 'block' : 'none';
      });
    }
    
    modal.querySelector('#adminEditForm').addEventListener('submit', (e) => {
      e.preventDefault();
      
      listing.title = modal.querySelector('#editTitle').value;
      listing.price = modal.querySelector('#editPrice').value;
      listing.location = modal.querySelector('#editLocation').value;
      listing.status = modal.querySelector('#editStatus').value;
      listing.description = modal.querySelector('#editDescription').value;
      listing.isAd = modal.querySelector('#editIsAd').checked;
      listing.adminPriority = parseInt(modal.querySelector('#editAdminPriority').value) || 0;
      
      listing.contact.name = modal.querySelector('#editSellerName').value;
      listing.contact.email = modal.querySelector('#editSellerEmail').value;
      listing.contact.phone = modal.querySelector('#editSellerPhone').value;
      
      listing.bidEnabled = modal.querySelector('#editBidEnabled').checked;
      if (listing.bidEnabled) {
        listing.bidEndTime = modal.querySelector('#editBidEndTime').value || new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0, 16);
        if (!listing.bids) listing.bids = [];
      } else {
        listing.bidEndTime = null;
        listing.bids = [];
      }
      
      if (isRental) {
        listing.occupancyStatus = modal.querySelector('#editOccupancy')?.value || 'vacant';
      }
      
      this.saveListingsToStorage();
      this.checkSavedSearchesForVacancies();
      showToast('Listing updated successfully', 'success');
      modal.remove();
      this.renderAdminListings($id('adminListingsSearch')?.value || '');
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancelEdit').addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },
  
  showAddSupportContactModal: function(contact = null) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">${contact ? 'Edit' : 'Add'} Support Contact</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="supportContactForm">
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Contact Type</label>
              <select id="contactType" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
                <option value="Legal Practitioner">Legal Practitioner</option>
                <option value="Police">Police</option>
                <option value="Consultant">Consultant</option>
                <option value="Lawyer">Lawyer</option>
                <option value="Emergency">Emergency</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Name</label>
              <input type="text" id="contactName" value="${contact ? contact.name : ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
            </div>
            
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Phone Number</label>
              <input type="text" id="contactPhone" value="${contact ? contact.phone : ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
            </div>
            
            <div style="margin-bottom: 24px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Description</label>
              <textarea id="contactDescription" rows="3" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">${contact ? contact.description : ''}</textarea>
            </div>
            
            <div style="display: flex; gap: 12px;">
              <button type="button" class="btn btn-outline" id="cancelContact" style="flex: 1;">Cancel</button>
              <button type="submit" class="btn btn-primary" style="flex: 1;">${contact ? 'Update' : 'Add'} Contact</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    if (contact) {
      modal.querySelector('#contactType').value = contact.type;
    }
    
    modal.querySelector('#supportContactForm').addEventListener('submit', (e) => {
      e.preventDefault();
      
      const newContact = {
        id: contact ? contact.id : 'contact_' + Date.now(),
        type: modal.querySelector('#contactType').value,
        name: modal.querySelector('#contactName').value,
        phone: modal.querySelector('#contactPhone').value,
        description: modal.querySelector('#contactDescription').value
      };
      
      if (contact) {
        const index = this.supportContacts.findIndex(c => c.id === contact.id);
        if (index !== -1) {
          this.supportContacts[index] = newContact;
        }
      } else {
        this.supportContacts.push(newContact);
      }
      
      this.saveSupportContacts();
      showToast(`Contact ${contact ? 'updated' : 'added'} successfully`, 'success');
      modal.remove();
      this.renderAdminSupport();
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancelContact').addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },
  
  editSupportContact: function(contactId) {
    const contact = this.supportContacts.find(c => c.id === contactId);
    if (!contact) {
      showToast('Contact not found', 'error');
      return;
    }
    
    this.showAddSupportContactModal(contact);
  },
  
  deleteSupportContact: function(contactId) {
    if (confirm('Are you sure you want to delete this support contact?')) {
      this.supportContacts = this.supportContacts.filter(c => c.id !== contactId);
      this.saveSupportContacts();
      showToast('Support contact deleted', 'success');
      this.renderAdminSupport();
    }
  },
  
  uploadHelpVideo: function() {
    const videoInput = $id('helpVideoUpload');
    if (!videoInput || !videoInput.files[0]) {
      showToast('Please select a video file', 'error');
      return;
    }
    
    const file = videoInput.files[0];
    if (file.size > 50 * 1024 * 1024) {
      showToast('Video must be less than 50MB', 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      this.helpCenterVideo = e.target.result;
      this.saveHelpCenterData();
      
      const videoPreview = $id('videoPreview');
      if (videoPreview) {
        videoPreview.innerHTML = `
          <video controls style="max-width: 100%; max-height: 200px; border-radius: 8px;">
            <source src="${this.helpCenterVideo}" type="video/mp4">
          </video>
        `;
      }
      
      showToast('Video uploaded successfully', 'success');
    };
    reader.readAsDataURL(file);
  },
  
  saveHelpGuide: function() {
    const guideContent = $id('helpGuideContent').value;
    localStorage.setItem('ww_help_guide', guideContent);
    showToast('Help guide saved successfully', 'success');
  },
  
  getDefaultHelpGuide: function() {
    return `Welcome to Walls — Your Property Marketplace!

HOW TO USE THE APP:

1. BROWSE LISTINGS:
   - Click "BUY" to view all available property listings
   - Use filters to narrow down by category, location, price

2. SEARCH FUNCTIONALITY:
   - Use the search bar at the top to find specific properties

3. VIEW LISTING DETAILS:
   - Click any listing card to see full details
   - Contact seller via Call, WhatsApp, or Copy Number

4. SAVE ENQUIRIES:
   - Click "Save Enquiry" to save listings for later

5. SELL YOUR PROPERTY:
   - Click "SELL" to create a new listing
   - Select category and fill in all details

6. MANAGE YOUR ACCOUNT:
   - Create account or login to save preferences

7. SUPPORT:
   - Access support contacts for legal, police, emergency

8. ADMIN FEATURES (Admin only):
   - Manage all listings and users
   - Add support contacts
   - Upload help videos
   - Enable bidding on listings`;
  },
  
  answerQuestion: function(index) {
    const answerInput = $(`#answer_${index}`);
    if (!answerInput || !answerInput.value.trim()) {
      showToast('Please enter an answer', 'error');
      return;
    }
    
    this.userQuestions[index].answer = answerInput.value;
    this.userQuestions[index].answeredBy = this.user.name;
    this.userQuestions[index].answeredAt = new Date().toISOString();
    
    this.saveHelpCenterData();
    showToast('Question answered', 'success');
    this.renderAdminHelp();
  },
  
  showAddCategoryModal: function(categoryKey = null) {
    const category = categoryKey ? 
      this.categories.walls.find(c => c.key === categoryKey) : null;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">${category ? 'Edit' : 'Add'} Category</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="categoryForm">
            <input type="hidden" id="categoryGroup" value="walls">
            
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Category Key (Unique)</label>
              <input type="text" id="categoryKey" value="${category ? category.key : ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;" ${category ? 'readonly' : ''}>
            </div>
            
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Category Label</label>
              <input type="text" id="categoryLabel" value="${category ? category.label : ''}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
            </div>
            
            <div style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Icon Class (Font Awesome)</label>
              <input type="text" id="categoryIcon" value="${category ? category.icon : 'fas fa-tag'}" placeholder="fas fa-home" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              <small style="display: block; margin-top: 4px; color: #666;">Use Font Awesome icon classes like: fas fa-home, fas fa-building</small>
            </div>
            
            <div style="margin-bottom: 24px;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500;">Type</label>
              <input type="text" id="categoryItemType" value="${category ? category.type : 'general'}" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
            </div>
            
            <div style="display: flex; gap: 12px;">
              <button type="button" class="btn btn-outline" id="cancelCategory" style="flex: 1;">Cancel</button>
              <button type="submit" class="btn btn-primary" style="flex: 1;">${category ? 'Update' : 'Add'} Category</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#categoryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      
      const group = 'walls';
      const key = modal.querySelector('#categoryKey').value;
      const label = modal.querySelector('#categoryLabel').value;
      const icon = modal.querySelector('#categoryIcon').value;
      const type = modal.querySelector('#categoryItemType').value;
      
      if (!key || !label) {
        showToast('Please fill in all required fields', 'error');
        return;
      }
      
      const newCategory = {
        key: key,
        label: label,
        icon: icon,
        type: type
      };
      
      if (category) {
        const index = this.categories.walls.findIndex(c => c.key === category.key);
        if (index !== -1) {
          this.categories.walls[index] = newCategory;
        }
      } else {
        if (this.categories.walls.some(c => c.key === key)) {
          showToast('Category key already exists', 'error');
          return;
        }
        this.categories.walls.push(newCategory);
      }
      
      this.saveCategories();
      showToast(`Category ${category ? 'updated' : 'added'} successfully`, 'success');
      modal.remove();
      this.renderAdminCategories();
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancelCategory').addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },
  
  editCategory: function(key) {
    this.showAddCategoryModal(key);
  },
  
  deleteCategory: function(key) {
    if (confirm('Are you sure you want to delete this category? Existing listings in this category will become uncategorized.')) {
      this.categories.walls = this.categories.walls.filter(c => c.key !== key);
      this.saveCategories();
      
      this.listings.forEach(listing => {
        if (listing.category === key) {
          listing.category = 'uncategorized';
          listing.categoryLabel = 'Uncategorized';
        }
      });
      
      this.saveListingsToStorage();
      showToast('Category deleted', 'success');
      this.renderAdminCategories();
    }
  },
  
  showHelpCenter: function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;';
    
    const savedGuide = localStorage.getItem('ww_help_guide') || this.getDefaultHelpGuide();
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #333;"><i class="fas fa-question-circle" style="color:#C8B897;"></i> Help Center</h2>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div style="display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 32px;">
            <div style="flex: 1; min-width: 300px;">
              <div style="background: #f8f9fa; padding: 24px; border-radius: 12px;">
                <h3 style="margin-top: 0;"><i class="fas fa-book" style="color:#C8B897;"></i> How to Use Walls</h3>
                <div style="white-space: pre-line; color: #555; line-height: 1.6; max-height: 400px; overflow-y: auto;">${savedGuide}</div>
              </div>
            </div>
            
            <div style="flex: 1; min-width: 300px;">
              ${this.helpCenterVideo ? `
                <div style="background: #f8f9fa; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
                  <h3 style="margin-top: 0;"><i class="fas fa-video" style="color:#C8B897;"></i> Tutorial Video</h3>
                  <video controls style="width: 100%; border-radius: 8px; margin-top: 12px;">
                    <source src="${this.helpCenterVideo}" type="video/mp4">
                  </video>
                </div>
              ` : ''}
              
              <div style="background: #f8f9fa; padding: 24px; border-radius: 12px;">
                <h3 style="margin-top: 0;"><i class="fas fa-question" style="color:#C8B897;"></i> Ask a Question</h3>
                <p style="color: #666; margin-bottom: 16px;">Can't find what you're looking for? Ask us directly!</p>
                
                <div style="margin-bottom: 16px;">
                  <label style="display: block; margin-bottom: 8px; font-weight: 500;">Your Name</label>
                  <input type="text" id="questionName" placeholder="Enter your name" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
                </div>
                
                <div style="margin-bottom: 16px;">
                  <label style="display: block; margin-bottom: 8px; font-weight: 500;">Email (Optional)</label>
                  <input type="email" id="questionEmail" placeholder="Enter your email" style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px;">
                </div>
                
                <div style="margin-bottom: 24px;">
                  <label style="display: block; margin-bottom: 8px; font-weight: 500;">Your Question</label>
                  <textarea id="questionText" rows="4" placeholder="Type your question here..." style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 8px; resize: vertical;"></textarea>
                </div>
                
                <button class="btn btn-primary" id="submitQuestionBtn" style="width: 100%; padding: 14px;"><i class="fas fa-paper-plane"></i> Submit Question</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#submitQuestionBtn').addEventListener('click', () => {
      const name = modal.querySelector('#questionName').value.trim();
      const email = modal.querySelector('#questionEmail').value.trim();
      const question = modal.querySelector('#questionText').value.trim();
      
      if (!name || !question) {
        showToast('Please enter your name and question', 'error');
        return;
      }
      
      const newQuestion = {
        id: 'question_' + Date.now(),
        userName: name,
        email: email,
        question: question,
        date: new Date().toISOString(),
        answer: null,
        answeredBy: null,
        answeredAt: null
      };
      
      this.userQuestions.unshift(newQuestion);
      this.saveHelpCenterData();
      
      modal.querySelector('#questionName').value = '';
      modal.querySelector('#questionEmail').value = '';
      modal.querySelector('#questionText').value = '';
      
      showToast('Question submitted successfully! Admin will respond soon.', 'success');
      
      if (this.user && this.user.isAdmin) {
        this.renderAdminHelp();
      }
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },
  
  showSupportContacts: function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 700px; width: 100%; max-height: 80vh; overflow-y: auto;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #333;"><i class="fas fa-headset" style="color:#C8B897;"></i> Support Contacts</h2>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <p style="color: #666; margin-bottom: 24px;">Need assistance? Contact these support services.</p>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
            ${this.supportContacts.map(contact => {
              const whatsappNumber = contact.phone.replace(/\D/g, '');
              
              return `
                <div style="background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 4px solid #C8B897;">
                  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                    <div style="width: 40px; height: 40px; background: #C8B897; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                      <i class="fas fa-phone" style="color: white; font-size: 16px;"></i>
                    </div>
                    <div>
                      <strong style="color: #333; font-size: 16px;">${contact.type}</strong>
                      <div style="font-size: 14px; color: #666;">${contact.name}</div>
                    </div>
                  </div>
                  
                  <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <a href="tel:${contact.phone}" 
                       style="flex: 1; padding: 12px; background: #4CAF50; color: white; text-decoration: none; border-radius: 8px; text-align: center; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px;">
                      <i class="fas fa-phone-alt"></i> Call
                    </a>
                    <a href="https://wa.me/${whatsappNumber}" 
                       target="_blank"
                       style="flex: 1; padding: 12px; background: #25D366; color: white; text-decoration: none; border-radius: 8px; text-align: center; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px;">
                      <i class="fab fa-whatsapp"></i> WhatsApp
                    </a>
                  </div>
                  
                  ${contact.description ? `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0;">
                      <p style="margin: 0; color: #666; font-size: 14px;">${contact.description}</p>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
          
          <div style="margin-top: 32px; padding: 20px; background: #f8f9fa; border-radius: 12px;">
            <h3 style="margin-top: 0;">Emergency Numbers</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
              <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border-radius: 8px;">
                <i class="fas fa-ambulance" style="color: #F44336; font-size: 20px;"></i>
                <div>
                  <div style="font-weight: 500;">Ambulance</div>
                  <a href="tel:112" style="color: #F44336; font-weight: bold; text-decoration: none;">112</a>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border-radius: 8px;">
                <i class="fas fa-shield-alt" style="color: #2196F3; font-size: 20px;"></i>
                <div>
                  <div style="font-weight: 500;">Police</div>
                  <a href="tel:999" style="color: #2196F3; font-weight: bold; text-decoration: none;">999</a>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: white; border-radius: 8px;">
                <i class="fas fa-fire" style="color: #FF9800; font-size: 20px;"></i>
                <div>
                  <div style="font-weight: 500;">Fire Brigade</div>
                  <a href="tel:993" style="color: #FF9800; font-weight: bold; text-decoration: none;">993</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },
  
  showAdminPanel: function() {
    if (!this.user || !this.user.isAdmin) {
      showToast('Access denied. Admin privileges required.', 'error');
      return;
    }
    
    const landingView = $id('landingView');
    const appView = $id('appView');
    const sellerView = $id('sellerView');
    const adminView = $id('adminView');
    
    if (landingView) landingView.style.display = 'none';
    if (appView) appView.style.display = 'none';
    if (sellerView) sellerView.style.display = 'none';
    if (adminView) adminView.style.display = 'block';
    
    this.currentView = 'admin';
    this.updateAdminStats();
    
    if (this.adminView === 'listings') {
      this.renderAdminListings();
    } else if (this.adminView === 'users') {
      this.renderAdminUsers();
    } else if (this.adminView === 'support') {
      this.renderAdminSupport();
    } else if (this.adminView === 'help') {
      this.renderAdminHelp();
    } else if (this.adminView === 'categories') {
      this.renderAdminCategories();
    } else if (this.adminView === 'verification') {
      this.renderAdminVerification();
    }
  },
  
  updateNavHighlight: function() {
    $$('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
      const tabMode = tab.getAttribute('data-tab');
      if (tabMode === this.currentMode) {
        tab.classList.add('active');
      }
    });
    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) {
      bottomNav.querySelectorAll('.bottom-nav-tab').forEach(tab => {
        tab.classList.remove('active');
      });
      const activeBottom = bottomNav.querySelector(`#nav${this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1)}`);
      if (activeBottom) activeBottom.classList.add('active');
    }
  },
  
  handleDocumentClick: function(e) {
    const userDropdown = $id('userDropdown');
    const userMenuBtn = $id('userMenuBtn');
    if (userDropdown && userMenuBtn && 
        !userDropdown.contains(e.target) && 
        !userMenuBtn.contains(e.target)) {
      userDropdown.style.display = 'none';
      userDropdown.setAttribute('aria-hidden', 'true');
      userMenuBtn.setAttribute('aria-expanded', 'false');
    }
    
    const categoryDropdown = $id('categoryDropdown');
    const filterCategory = $id('filterCategory');
    if (categoryDropdown && filterCategory &&
        !categoryDropdown.contains(e.target) &&
        !filterCategory.contains(e.target)) {
      this.closeCategoryDropdown();
    }
  },
  
  toggleUserMenu: function(e) {
    e.stopPropagation();
    const dropdown = $id('userDropdown');
    const isHidden = dropdown.getAttribute('aria-hidden') === 'true';
    
    if (isHidden) {
      dropdown.style.display = 'block';
      dropdown.setAttribute('aria-hidden', 'false');
      $id('userMenuBtn').setAttribute('aria-expanded', 'true');
    } else {
      dropdown.style.display = 'none';
      dropdown.setAttribute('aria-hidden', 'true');
      $id('userMenuBtn').setAttribute('aria-expanded', 'false');
    }
  },
  
  isAppInstalled: function() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
  },
  
  updateUserMenu: function() {
    const userMenuBtn = $id('userMenuBtn');
    const userAvatar = $id('userAvatar');
    const loggedOutMenu = $id('loggedOutMenu');
    const loggedInMenu = $id('loggedInMenu');
    const userGreeting = $id('userGreeting');
    const userEmail = $id('userEmail');
    
    if (this.user && this.user.isLoggedIn) {
      if (userMenuBtn) {
        userMenuBtn.style.border = '2px solid #C8B897';
      }
      
      // Profile picture display in the menu button
      if (this.user.profilePicture) {
        if (userMenuBtn) {
          userMenuBtn.innerHTML = `
            <img src="${this.user.profilePicture}" alt="${this.user.name}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;margin-bottom:4px;">
            <span>Profile</span>
          `;
        }
      } else {
        // Reset to default icon if no picture
        if (userMenuBtn) {
          userMenuBtn.innerHTML = `<i class="fas fa-user-circle"></i><span>Profile</span>`;
        }
      }
      
      if (loggedOutMenu) loggedOutMenu.style.display = 'none';
      if (loggedInMenu) loggedInMenu.style.display = 'block';
      
      if (userGreeting) userGreeting.textContent = `Hello, ${this.user.name || 'User'}!`;
      if (userEmail) userEmail.textContent = this.user.email || '';
      
      if (this.user.isAdmin) {
        let adminMenuItem = $('#dropdownAdminPanel');
        if (!adminMenuItem && loggedInMenu) {
          const divider = document.createElement('div');
          divider.className = 'dropdown-divider';

          const adminItem = document.createElement('button');
          adminItem.className = 'dropdown-item';
          adminItem.id = 'dropdownAdminPanel';
          adminItem.style.cssText = 'background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-weight:600;';
          adminItem.innerHTML = '<i class="fas fa-cog"></i><span>Admin Panel</span>';
          adminItem.addEventListener('click', () => {
            this.showAdminPanel();
            const dd = $id('userDropdown');
            if (dd) dd.style.display = 'none';
          });

          const userInfo = loggedInMenu.querySelector('.user-info');
          if (userInfo && userInfo.parentNode) {
            userInfo.parentNode.insertBefore(divider, userInfo.nextSibling);
            userInfo.parentNode.insertBefore(adminItem, divider.nextSibling);
          } else {
            // Fallback: prepend so it's always visible for admins
            loggedInMenu.insertBefore(adminItem, loggedInMenu.firstChild);
            loggedInMenu.insertBefore(divider, adminItem.nextSibling);
          }
        }
      } else {
        // Remove admin item if user is no longer admin
        const existingAdmin = $('#dropdownAdminPanel');
        if (existingAdmin) existingAdmin.remove();
      }
      
    } else {
      if (userMenuBtn) {
        userMenuBtn.style.border = '1px solid var(--border)';
        userMenuBtn.innerHTML = `<i class="fas fa-user-circle"></i><span>Profile</span>`;
      }
      if (loggedOutMenu) loggedOutMenu.style.display = 'block';
      if (loggedInMenu) loggedInMenu.style.display = 'none';
    }
  },
  
  handleProfilePhotoUpload: function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = $id('profilePhotoPreview');
      if (preview) {
        preview.innerHTML = `<img src="${e.target.result}" alt="Profile Preview" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        preview.classList.add('has-image');
      }
    };
    reader.readAsDataURL(file);
  },
  
  switchToMode: function(mode) {
    this.currentMode = mode;
    this.updateNavHighlight();
    
    switch(mode) {
      case 'buy':
        // Show category popup before browsing
        this.showBuyCategoryPopup();
        break;
      case 'sell':
        if (!this.requireLogin('sell items')) return;
        this.showSellerView();
        break;
      case 'recent':
        this.showRecentEnquiries();
        break;
      case 'mylistings':
        this.showSavedSearches();
        break;
    }
  },
  
  // New: Category popup when Buy is pressed
  showBuyCategoryPopup: function() {
    // Remove any existing popup
    const existing = document.querySelector('.buy-category-popup');
    if (existing) existing.remove();
    
    const categories = this.categories.walls;
    const modal = document.createElement('div');
    modal.className = 'modal buy-category-popup';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    // "All Available Listings" button
    const allBtn = document.createElement('button');
    allBtn.className = 'btn btn-primary btn-large';
    allBtn.innerHTML = '<i class="fas fa-globe"></i> All Available Listings';
    allBtn.style.cssText = 'width:100%; padding:16px; font-size:16px; margin-bottom:16px;';
    
    // Grid for categories
    const grid = document.createElement('div');
    grid.className = 'category-grid-popup';
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0;';
    
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-item-btn';
      btn.style.cssText = 'display: flex; flex-direction: column; align-items: center; padding: 20px; border: 2px solid #e0e0e0; border-radius: 8px; background: white; cursor: pointer; transition: all 0.3s;';
      btn.innerHTML = `
        <div style="width:50px;height:50px;background:#C8B897;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:12px;">
          <i class="${cat.icon}" style="font-size: 20px; color: white;"></i>
        </div>
        <span style="font-weight: 500; font-size: 14px; text-align: center;">${cat.label}</span>
      `;
      btn.addEventListener('click', () => {
        modal.remove();
        this.selectCategory(cat.key);
      });
      // Hover effects
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = '#C8B897';
        btn.style.transform = 'translateY(-2px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = '#e0e0e0';
        btn.style.transform = 'translateY(0)';
      });
      grid.appendChild(btn);
    });
    
    const container = document.createElement('div');
    container.className = 'modal-content';
    container.style.cssText = 'background: white; border-radius: 12px; padding: 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;';
    
    const title = document.createElement('h3');
    title.textContent = 'Choose a Category';
    title.style.cssText = 'margin-top:0; text-align:center; margin-bottom:20px;';
    
    allBtn.addEventListener('click', () => {
      modal.remove();
      this.showAllListings();
    });
    
    container.appendChild(title);
    container.appendChild(allBtn);
    container.appendChild(grid);
    modal.appendChild(container);
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  },
  
  // Saved Searches View (new)
  showSavedSearches: function() {
    if (!this.user) {
      showToast('Please log in to view your saved searches', 'error');
      openLoginModal();
      return;
    }
    
    const landingView = $id('landingView');
    const appView = $id('appView');
    const sellerView = $id('sellerView');
    const adminView = $id('adminView');
    
    if (landingView) landingView.style.display = 'none';
    if (appView) appView.style.display = 'block';
    if (sellerView) sellerView.style.display = 'none';
    if (adminView) adminView.style.display = 'none';
    
    this.currentView = 'app';
    this.currentMode = 'mylistings';
    this.updateNavHighlight();
    
    const currentCategoryTitle = $id('currentCategoryTitle');
    if (currentCategoryTitle) currentCategoryTitle.textContent = 'My Saved Searches';
    
    const listingsCount = $id('listingsCount');
    if (listingsCount) listingsCount.textContent = this.savedSearches.length;
    
    const listingsGrid = $id('listingsGrid');
    const noListings = $id('noListings');
    const loadMoreContainer = $id('loadMoreContainer');
    
    if (listingsGrid) listingsGrid.innerHTML = '';
    
    if (this.savedSearches.length === 0) {
      if (noListings) {
        noListings.style.display = 'block';
        noListings.innerHTML = '<i class="fas fa-search"></i><h3>No saved searches</h3><p>Use the Filters and click "Save This Search" to get notified when new listings match.</p>';
      }
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      return;
    }
    
    if (noListings) noListings.style.display = 'none';
    if (loadMoreContainer) loadMoreContainer.style.display = 'none';
    
    const container = document.createElement('div');
    container.className = 'vertical-listings-grid';
    container.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; margin-top: 16px;';
    
    this.savedSearches.forEach((search, index) => {
      const card = document.createElement('div');
      card.style.cssText = 'background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);';
      
      let criteriaHTML = '';
      if (search.keyword) criteriaHTML += `<span style="background:#f0f0f0;padding:4px 8px;border-radius:6px;margin-right:6px;">🔍 "${search.keyword}"</span>`;
      if (search.category && search.category !== 'All') criteriaHTML += `<span style="background:#e8f5e9;padding:4px 8px;border-radius:6px;margin-right:6px;">${search.categoryLabel || search.category}</span>`;
      if (search.location && search.location !== 'Anywhere') criteriaHTML += `<span style="background:#e3f2fd;padding:4px 8px;border-radius:6px;margin-right:6px;">📍 ${search.location}</span>`;
      if (search.priceMin != null) criteriaHTML += `<span style="background:#fff3e0;padding:4px 8px;border-radius:6px;margin-right:6px;">≥ $${search.priceMin}</span>`;
      if (search.priceMax != null) criteriaHTML += `<span style="background:#fff3e0;padding:4px 8px;border-radius:6px;margin-right:6px;">≤ $${search.priceMax}</span>`;
      if (search.type && search.type !== 'All types') criteriaHTML += `<span style="background:#f3e5f5;padding:4px 8px;border-radius:6px;">${search.type}</span>`;
      
      const visible = this.listings.filter(l => this.isListingVisibleToUser(l));
      const matchCount = visible.filter(l => this.listingMatchesSearch(l, search)).length;
      
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <h4 style="margin: 0;">${search.label || 'Saved Search'}</h4>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-outline" style="padding: 4px 8px; font-size: 12px;" onclick="window.WW_APP.applySavedSearch(${index})"><i class="fas fa-play"></i> VIEW</button>
            <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="window.WW_APP.deleteSavedSearch(${index})"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div style="margin-bottom: 8px;">${criteriaHTML || '<em>No specific criteria</em>'}</div>
        <div style="font-size: 14px; color: #666;">📌 ${matchCount} matching listing(s) currently</div>
        <div style="font-size: 12px; color: #999; margin-top: 4px;">Created ${new Date(search.createdAt).toLocaleDateString()}</div>
      `;
      
      container.appendChild(card);
    });
    
    if (listingsGrid) listingsGrid.appendChild(container);
  },
  
  applySavedSearch: function(index) {
    const search = this.savedSearches[index];
    if (!search) return;
    
    this.searchTerm = search.keyword || '';
    const searchInput = $id('mainSearch');
    if (searchInput) searchInput.value = this.searchTerm;
    
    this.filters.category = search.category || 'All';
    this.filters.location = search.location || 'Anywhere';
    this.filters.price = 'Any price';
    this.filters.type = search.type || 'All types';
    
    const catBtn = $id('filterCategory');
    if (catBtn) catBtn.innerHTML = `<i class="fas fa-tag"></i> ${this.filters.category}`;
    const locBtn = $id('filterLocation');
    if (locBtn) locBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${this.filters.location}`;
    const typeBtn = $id('filterType');
    if (typeBtn) typeBtn.innerHTML = `<i class="fas fa-filter"></i> ${this.filters.type}`;
    
    this.applyFilters();
    this.switchToMode('buy');
  },
  
  deleteSavedSearch: function(index) {
    if (confirm('Delete this saved search?')) {
      this.savedSearches.splice(index, 1);
      this.saveSavedSearches();
      this.showSavedSearches();
    }
  },
  
  // Save current filter state as a saved search (called from UI)
  saveCurrentSearch: function(label) {
    if (!this.user) {
      showToast('Please log in to save searches', 'error');
      return;
    }
    
    const search = {
      id: 'search_' + Date.now(),
      label: label || `Search ${new Date().toLocaleDateString()}`,
      keyword: this.searchTerm || null,
      category: this.filters.category,
      categoryLabel: this.currentCategory ? this.currentCategory.label : null,
      location: this.filters.location,
      type: this.filters.type,
      priceMin: null,
      priceMax: null,
      occupancyStatus: null,
      createdAt: new Date().toISOString(),
      lastMatchCount: 0
    };
    
    if (this.filters.price && this.filters.price !== 'Any price') {
      const match = this.filters.price.match(/under\s+\$?([\d,]+)/i);
      if (match) search.priceMax = parseInt(match[1].replace(/,/g, ''));
      else {
        const parts = this.filters.price.split('-');
        if (parts.length === 2) {
          search.priceMin = parseInt(parts[0].replace(/[^\d]/g, ''));
          search.priceMax = parseInt(parts[1].replace(/[^\d]/g, ''));
        } else if (this.filters.price.includes('Over')) {
          search.priceMin = parseInt(this.filters.price.replace(/[^\d]/g, ''));
        }
      }
    }
    
    this.savedSearches.unshift(search);
    this.saveSavedSearches();
    showToast('Search saved! You will be notified when new listings match.', 'success');
  },
  
  // Helper function to check if a listing should be visible to the current user
  isListingVisibleToUser: function(listing) {
    const requiresVerification = this._getSaleCategoriesRequiringVerification().includes(listing.category);
    if (!requiresVerification) return true;
    if (listing.verificationStatus === 'approved') return true;
    if (this.user && this.user.isAdmin) return true;
    if (this.user && listing.createdBy === this.user.email) return true;
    return false;
  },
  
  showAllListings: function() {
    const landingView = $id('landingView');
    const appView = $id('appView');
    const sellerView = $id('sellerView');
    const adminView = $id('adminView');
    
    if (landingView) landingView.style.display = 'none';
    if (appView) appView.style.display = 'block';
    if (sellerView) sellerView.style.display = 'none';
    if (adminView) adminView.style.display = 'none';
    
    this.currentView = 'app';
    this.currentMode = 'buy';
    this.currentCategory = null;
    this.displayMode = 'horizontal';
    
    this.updateNavHighlight();
    
    const currentCategoryTitle = $id('currentCategoryTitle');
    if (currentCategoryTitle) {
      currentCategoryTitle.textContent = 'All Available Properties';
    }
    
    const visibleListings = this.listings.filter(l => this.isListingVisibleToUser(l));
    
    const listingsGrid = $id('listingsGrid');
    const loadingState = $id('loadingState');
    const noListings = $id('noListings');
    const loadMoreContainer = $id('loadMoreContainer');
    
    if (listingsGrid) listingsGrid.innerHTML = '';
    if (loadingState) loadingState.style.display = 'block';
    if (noListings) noListings.style.display = 'none';
    if (loadMoreContainer) loadMoreContainer.style.display = 'none';
    
    setTimeout(() => {
      if (loadingState) loadingState.style.display = 'none';
      
      if (visibleListings.length === 0) {
        if (noListings) noListings.style.display = 'block';
        const listingsCount = $id('listingsCount');
        if (listingsCount) listingsCount.textContent = '0';
        return;
      }
      
      const listingsCount = $id('listingsCount');
      if (listingsCount) listingsCount.textContent = visibleListings.length;
      
      if (listingsGrid) {
        listingsGrid.innerHTML = '';
        listingsGrid.style.cssText = 'display: block; margin-bottom: 40px;';
        
        const categories = {};
        visibleListings.forEach(listing => {
          const category = listing.categoryLabel || 'Uncategorized';
          if (!categories[category]) {
            categories[category] = [];
          }
          categories[category].push(listing);
        });
        
        Object.keys(categories).sort().forEach(categoryName => {
          const categoryItems = categories[categoryName];
          
          const categorySection = document.createElement('div');
          categorySection.className = 'category-section-horizontal';
          
          const categoryHeader = document.createElement('div');
          categoryHeader.className = 'category-header-horizontal';
          
          const headerText = document.createElement('h3');
          headerText.style.cssText = 'margin: 0; font-size: 20px; font-weight: 600; color: #222222; display: flex; align-items: center; gap: 8px;';
          
          const icon = this.getCategoryIcon(categoryName);
          headerText.innerHTML = `${icon} ${categoryName}`;
          
          const countBadge = document.createElement('span');
          countBadge.className = 'count-badge';
          countBadge.style.cssText = 'background: #C8B897; color: white; padding: 4px 12px; border-radius: 12px; font-size: 14px; font-weight: 600; margin-left: 8px;';
          countBadge.textContent = categoryItems.length;
          
          headerText.appendChild(countBadge);
          categoryHeader.appendChild(headerText);
          categorySection.appendChild(categoryHeader);
          
          const scrollContainer = document.createElement('div');
          scrollContainer.className = 'horizontal-scroll-container';
          
          const horizontalGrid = document.createElement('div');
          horizontalGrid.className = 'horizontal-listings-grid';
          
          categoryItems.forEach(listing => {
            const card = this.createListingCard(listing);
            horizontalGrid.appendChild(card);
          });
          
          scrollContainer.appendChild(horizontalGrid);
          categorySection.appendChild(scrollContainer);
          listingsGrid.appendChild(categorySection);
        });
        
        if (Object.keys(categories).length === 0) {
          const allSection = document.createElement('div');
          allSection.className = 'category-section-horizontal';
          
          const header = document.createElement('div');
          header.className = 'category-header-horizontal';
          header.innerHTML = '<h3>All Listings</h3>';
          allSection.appendChild(header);
          
          const scrollContainer = document.createElement('div');
          scrollContainer.className = 'horizontal-scroll-container';
          
          const horizontalGrid = document.createElement('div');
          horizontalGrid.className = 'horizontal-listings-grid';
          
          visibleListings.forEach(listing => {
            const card = this.createListingCard(listing);
            horizontalGrid.appendChild(card);
          });
          
          scrollContainer.appendChild(horizontalGrid);
          allSection.appendChild(scrollContainer);
          listingsGrid.appendChild(allSection);
        }
      }
    }, 100);
  },
  
  getCategoryIcon: function(categoryName) {
    const icons = {
      'Full Houses to Rent': '🏠',
      'Rent Flats': '🏢',
      'Rent Rooms': '🚪',
      'Single Rooms to Rent': '🚪',
      'Cottages to Rent': '🏡',
      'BNB': '🛏️',
      'Full Houses for Sale': '🏠',
      'Sell Flats': '🏢',
      'Cottages to Sale': '🏡',
      'Residential Stands': '📍',
      'Farm Plots': '🌱',
      'Boarding Houses': '🏫',
      'Househelp Services': '🧹',
      'Construction Services': '👷',
      'Borehole Services': '💧',
      'InDrive Driver': '🚗'
    };
    return icons[categoryName] || '📋';
  },
  
  createListingCard: function(listing) {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) return this.createMobileListingCard(listing);
    return this.createDesktopListingCard(listing);
  },
  
  createDesktopListingCard: function(listing) {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.dataset.id = listing.id;
    card.style.cssText = 'position: relative; cursor: pointer; flex: 0 0 auto; width: 240px; margin: 8px;';
    
    const imgContainer = document.createElement('div');
    imgContainer.className = 'listing-image';
    imgContainer.style.cssText = 'position: relative; width: 100%; height: 160px; overflow: hidden; border-radius: 12px;';
    
    imgContainer.addEventListener('click', () => { this.showListingDetails(listing); });
    imgContainer.addEventListener('mouseenter', () => {
      imgContainer.style.transform = 'translateY(-4px)';
      imgContainer.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
      const img = imgContainer.querySelector('img');
      if (img) img.style.transform = 'scale(1.05)';
    });
    imgContainer.addEventListener('mouseleave', () => {
      imgContainer.style.transform = 'translateY(0)';
      imgContainer.style.boxShadow = 'none';
      const img = imgContainer.querySelector('img');
      if (img) img.style.transform = 'scale(1)';
    });
    
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = listing.images && listing.images[0] ? listing.images[0] : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="%23f5f5f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" fill="%23999">No Image</text></svg>';
    img.alt = listing.title;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;';
    
    const categoryBadge = document.createElement('div');
    categoryBadge.textContent = listing.categoryLabel ? listing.categoryLabel.substring(0, 12) : 'Property';
    categoryBadge.style.cssText = 'position: absolute; top: 8px; left: 8px; background: rgba(200,184,151,0.95); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; z-index: 2; backdrop-filter: blur(4px);';
    imgContainer.appendChild(categoryBadge);
    
    if (listing.isAd) {
      const adBadge = document.createElement('div');
      adBadge.innerHTML = '<i class="fas fa-ad"></i> AD';
      adBadge.style.cssText = 'position: absolute; top: 8px; right: 8px; background: rgba(255,152,0,0.95); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; z-index: 2; display: flex; align-items: center; gap: 4px; backdrop-filter: blur(4px);';
      imgContainer.appendChild(adBadge);
    }
    
    if (listing.bidEnabled) {
      const bidBadge = document.createElement('div');
      bidBadge.innerHTML = '<i class="fas fa-gavel"></i> BID';
      bidBadge.style.cssText = 'position: absolute; top: 8px; right: 8px; background: #F44336; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; z-index: 2; display: flex; align-items: center; gap: 4px; backdrop-filter: blur(4px);';
      imgContainer.appendChild(bidBadge);
    }
    
    if (this._getRentalCategories().includes(listing.category) && listing.occupancyStatus) {
      const occBadge = document.createElement('div');
      const isOccupied = listing.occupancyStatus === 'occupied';
      occBadge.innerHTML = isOccupied ? 'Occupied' : 'Vacant';
      occBadge.style.cssText = `position: absolute; top: 32px; left: 8px; background: ${isOccupied ? '#F44336' : '#4CAF50'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; z-index: 2;`;
      imgContainer.appendChild(occBadge);
    }
    
    const likeButton = document.createElement('button');
    likeButton.className = 'like-button';
    likeButton.style.cssText = `position: absolute; ${listing.isAd || listing.bidEnabled ? 'top: 40px;' : 'top: 8px;'} right: 8px; width: 32px; height: 32px; background: rgba(255,255,255,0.95); border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 3; font-size: 14px; backdrop-filter: blur(4px); transition: all 0.2s;`;
    likeButton.addEventListener('mouseenter', () => { likeButton.style.transform = 'scale(1.1)'; });
    likeButton.addEventListener('mouseleave', () => { likeButton.style.transform = 'scale(1)'; });
    
    const likeCount = this._getLikeCount(listing.id);
    const liked = this._hasLiked(listing.id);
    if (likeCount > 0) {
      likeButton.innerHTML = '<i class="' + (liked ? 'fas' : 'far') + ' fa-heart" style="color:#C8B897;"></i>';
      const badge = document.createElement('div');
      badge.textContent = likeCount;
      badge.style.cssText = 'position: absolute; top: -5px; right: -5px; background: rgba(200,184,151,0.9); color: white; padding: 1px 5px; border-radius: 10px; font-size: 9px; font-weight: 600; min-width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; z-index: 4; border: 2px solid white;';
      likeButton.appendChild(badge);
    } else {
      likeButton.innerHTML = '<i class="' + (liked ? 'fas' : 'far') + ' fa-heart"></i>';
    }
    likeButton.addEventListener('click', (e) => { e.stopPropagation(); this.toggleLike(listing.id); });
    
    imgContainer.appendChild(likeButton);
    imgContainer.appendChild(img);
    
    const overlay = document.createElement('div');
    overlay.className = 'listing-overlay';
    overlay.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; padding: 12px; background: linear-gradient(transparent, rgba(0,0,0,0.8)); border-radius: 0 0 12px 12px; color: white; display: flex; flex-direction: column; gap: 4px; z-index: 2;';
    
    if (listing.price) {
      const priceContainer = document.createElement('div');
      priceContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; font-weight: bold; font-size: 16px; margin-bottom: 4px;';
      const dollarSign = document.createElement('span'); dollarSign.textContent = '$'; dollarSign.style.cssText = 'color: #4CAF50; font-weight: bold; font-size: 14px;';
      const priceAmount = document.createElement('span'); 
      priceAmount.textContent = this.formatPrice(listing).replace('$', '').substring(0, 15);
      priceAmount.style.cssText = 'color: white; font-weight: 600; font-size: 15px;';
      priceContainer.appendChild(dollarSign);
      priceContainer.appendChild(priceAmount);
      overlay.appendChild(priceContainer);
    }
    
    const locationContainer = document.createElement('div');
    locationContainer.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.9);';
    locationContainer.innerHTML = '<i class="fas fa-map-marker-alt" style="color:#FF6B6B;font-size:11px;"></i> ';
    const locSpan = document.createElement('span');
    locSpan.textContent = listing.location ? listing.location.split(',')[0] : 'Location';
    locSpan.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;';
    locationContainer.appendChild(locSpan);
    overlay.appendChild(locationContainer);
    
    imgContainer.appendChild(overlay);
    card.appendChild(imgContainer);
    
    const titleEl = document.createElement('div');
    titleEl.textContent = listing.title.length > 40 ? listing.title.substring(0, 40) + '...' : listing.title;
    titleEl.style.cssText = 'margin: 4px 0 0 0; font-size: 14px; font-weight: 600; color: #222; line-height: 1.3; text-align: left; padding: 0 2px;';
    card.appendChild(titleEl);

    // Posted date
    if (listing.createdAt) {
      const dateEl = document.createElement('div');
      dateEl.textContent = 'Posted ' + this.formatRelativeTime(listing.createdAt);
      dateEl.style.cssText = 'font-size: 11px; color: #888; margin: 2px 2px 0; padding: 0 2px;';
      card.appendChild(dateEl);
    }
    
    if (listing.bidEnabled && listing.bidEndTime) {
      const timer = document.createElement('div');
      timer.className = 'bid-timer';
      timer.setAttribute('data-endtime', new Date(listing.bidEndTime).getTime());
      const now = Date.now();
      const end = new Date(listing.bidEndTime).getTime();
      const diff = end - now;
      if (diff <= 0) {
        timer.innerHTML = '<i class="fas fa-clock"></i> Ended';
        timer.classList.add('expired');
      } else {
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        timer.innerHTML = `<i class="fas fa-clock"></i> ${hours}h ${mins}m ${secs}s`;
      }
      timer.style.cssText = 'display: flex; align-items: center; gap: 4px; font-size: 12px; color: #F44336; font-weight: 600; margin-top: 4px; padding: 0 2px;';
      card.appendChild(timer);
    }
    
    return card;
  },
  
  createMobileListingCard: function(listing) {
    const card = document.createElement('div');
    card.className = 'listing-card mobile';
    card.dataset.id = listing.id;
    card.style.cssText = 'position: relative; cursor: pointer; flex: 0 0 auto; width: calc((100% / 2) - 10px); margin: 5px;';
    
    const imgContainer = document.createElement('div');
    imgContainer.className = 'listing-image';
    imgContainer.style.cssText = 'position: relative; width: 100%; height: 140px; overflow: hidden; border-radius: 10px;';
    imgContainer.addEventListener('click', () => this.showListingDetails(listing));
    
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = listing.images && listing.images[0] ? listing.images[0] : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="%23f5f5f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" fill="%23999">No Image</text></svg>';
    img.alt = listing.title;
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
    
    const catBadge = document.createElement('div');
    catBadge.textContent = listing.categoryLabel ? listing.categoryLabel.substring(0, 8) : 'Property';
    catBadge.style.cssText = 'position: absolute; top: 6px; left: 6px; background: rgba(200,184,151,0.95); color: white; padding: 3px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; text-transform: uppercase; z-index: 2;';
    imgContainer.appendChild(catBadge);
    
    if (listing.isAd) {
      const adBadge = document.createElement('div');
      adBadge.innerHTML = '<i class="fas fa-ad"></i>';
      adBadge.style.cssText = 'position: absolute; top: 6px; right: 6px; background: rgba(255,152,0,0.95); color: white; padding: 3px 6px; border-radius: 4px; font-size: 9px; z-index: 2;';
      imgContainer.appendChild(adBadge);
    }
    if (listing.bidEnabled) {
      const bidBadge = document.createElement('div');
      bidBadge.innerHTML = '<i class="fas fa-gavel"></i>';
      bidBadge.style.cssText = 'position: absolute; top: 6px; right: 6px; background: #F44336; color: white; padding: 3px 6px; border-radius: 4px; font-size: 9px; z-index: 2;';
      imgContainer.appendChild(bidBadge);
    }
    
    if (this._getRentalCategories().includes(listing.category) && listing.occupancyStatus) {
      const occBadge = document.createElement('div');
      const isOccupied = listing.occupancyStatus === 'occupied';
      occBadge.innerHTML = isOccupied ? 'Occ' : 'Vac';
      occBadge.style.cssText = `position: absolute; top: 30px; left: 6px; background: ${isOccupied ? '#F44336' : '#4CAF50'}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; z-index: 2;`;
      imgContainer.appendChild(occBadge);
    }
    
    const likeButton = document.createElement('button');
    likeButton.className = 'like-button';
    likeButton.style.cssText = `position: absolute; ${listing.isAd || listing.bidEnabled ? 'top: 30px;' : 'top: 6px;'} right: 6px; width: 28px; height: 28px; background: rgba(255,255,255,0.95); border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 3; font-size: 12px;`;
    const likeCount = this._getLikeCount(listing.id);
    const liked = this._hasLiked(listing.id);
    if (likeCount > 0) {
      likeButton.innerHTML = '<i class="' + (liked ? 'fas' : 'far') + ' fa-heart" style="color:#C8B897;"></i>';
    } else {
      likeButton.innerHTML = '<i class="' + (liked ? 'fas' : 'far') + ' fa-heart"></i>';
    }
    likeButton.addEventListener('click', (e) => { e.stopPropagation(); this.toggleLike(listing.id); });
    imgContainer.appendChild(likeButton);
    imgContainer.appendChild(img);
    
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; padding: 8px; background: linear-gradient(transparent, rgba(0,0,0,0.8)); border-radius: 0 0 10px 10px; color: white; display: flex; flex-direction: column; gap: 2px; z-index: 2; font-size: 11px;';
    
    if (listing.price) {
      const priceDiv = document.createElement('div');
      priceDiv.style.cssText = 'display: flex; align-items: center; gap: 2px; font-weight: bold;';
      priceDiv.innerHTML = '<span style="color:#4CAF50;">$</span><span style="color:white; font-weight:600; font-size:12px;">' + this.formatPrice(listing).replace('$', '').substring(0, 10) + '</span>';
      overlay.appendChild(priceDiv);
    }
    const locDiv = document.createElement('div');
    locDiv.style.cssText = 'display: flex; align-items: center; gap: 4px; font-size: 10px; color: rgba(255,255,255,0.9);';
    locDiv.innerHTML = '<i class="fas fa-map-marker-alt" style="color:#FF6B6B;font-size:9px;"></i>' + (listing.location ? listing.location.split(',')[0].substring(0, 12) : 'Location');
    overlay.appendChild(locDiv);
    
    imgContainer.appendChild(overlay);
    card.appendChild(imgContainer);
    
    const title = document.createElement('div');
    title.textContent = listing.title.length > 30 ? listing.title.substring(0, 30) + '...' : listing.title;
    title.style.cssText = 'font-size: 12px; font-weight: 600; color: #222; line-height: 1.2; margin: 4px 2px;';
    card.appendChild(title);

    if (listing.createdAt) {
      const dateEl = document.createElement('div');
      dateEl.textContent = 'Posted ' + this.formatRelativeTime(listing.createdAt);
      dateEl.style.cssText = 'font-size: 10px; color: #888; margin: 0 2px 2px;';
      card.appendChild(dateEl);
    }

    if (listing.bidEnabled) {
      const timer = document.createElement('div');
      timer.className = 'bid-timer';
      timer.setAttribute('data-endtime', new Date(listing.bidEndTime).getTime());
      const now = Date.now();
      const end = new Date(listing.bidEndTime).getTime();
      const diff = end - now;
      if (diff <= 0) {
        timer.innerHTML = '<i class="fas fa-clock"></i> Ended';
        timer.classList.add('expired');
      } else {
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 600000);
        timer.innerHTML = `<i class="fas fa-clock"></i> ${hours}h ${mins}m`;
      }
      timer.style.cssText = 'font-size: 10px; color: #F44336; margin: 2px 2px;';
      card.appendChild(timer);
    }
    
    return card;
  },
  
  toggleLike: function(listingId) {
    const liker = this._getLikerId();
    let entry = this.likes[listingId];
    if (!entry || typeof entry === 'number') {
      entry = { count: typeof entry === 'number' ? entry : 0, users: [] };
    }
    entry.users = entry.users || [];
    const idx = entry.users.indexOf(liker);
    let nowLiked;
    if (idx === -1) {
      entry.users.push(liker);
      entry.count = entry.users.length;
      nowLiked = true;
    } else {
      entry.users.splice(idx, 1);
      entry.count = entry.users.length;
      nowLiked = false;
    }
    this.likes[listingId] = entry;
    this.saveLikes();
    this.sortListings();
    const cards = $$(`.listing-card[data-id="${listingId}"]`);
    cards.forEach(card => {
      const likeButton = card.querySelector('.like-button');
      if (likeButton) {
        const likeCount = entry.count;
        const existingBadge = likeButton.querySelector('div');
        if (existingBadge) existingBadge.remove();
        const iconClass = nowLiked ? 'fas' : 'far';
        if (likeCount > 0) {
          likeButton.innerHTML = '<i class="' + iconClass + ' fa-heart" style="color:#C8B897;"></i>';
          const badge = document.createElement('div');
          badge.textContent = likeCount;
          badge.style.cssText = 'position: absolute; top: -5px; right: -5px; background: rgba(200,184,151,0.9); color: white; padding: 1px 5px; border-radius: 10px; font-size: 9px; font-weight: 600; min-width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; z-index: 4; border: 2px solid white;';
          likeButton.appendChild(badge);
        } else {
          likeButton.innerHTML = '<i class="' + iconClass + ' fa-heart"></i>';
        }
      }
    });
    this.saveListingsToStorage();
    showToast(nowLiked ? 'Added to favorites!' : 'Removed from favorites', nowLiked ? 'success' : 'info');
  },

  // Format a timestamp as "5 minutes ago", "2 days ago", etc.
  formatRelativeTime: function(iso) {
    try {
      const t = new Date(iso).getTime();
      if (!t) return '';
      const diff = Math.max(0, Date.now() - t);
      const m = Math.floor(diff / 60000);
      if (m < 1) return 'just now';
      if (m < 60) return m + ' minute' + (m === 1 ? '' : 's') + ' ago';
      const h = Math.floor(m / 60);
      if (h < 24) return h + ' hour' + (h === 1 ? '' : 's') + ' ago';
      const d = Math.floor(h / 24);
      if (d < 7) return d + ' day' + (d === 1 ? '' : 's') + ' ago';
      if (d < 30) { const w = Math.floor(d / 7); return w + ' week' + (w === 1 ? '' : 's') + ' ago'; }
      if (d < 365) { const mo = Math.floor(d / 30); return mo + ' month' + (mo === 1 ? '' : 's') + ' ago'; }
      const y = Math.floor(d / 365); return y + ' year' + (y === 1 ? '' : 's') + ' ago';
    } catch (e) { return ''; }
  },
  
  showFilteredListings: function(listings, title, isCategorySelected = false) {
    const visible = listings.filter(l => this.isListingVisibleToUser(l));
    
    const currentCategoryTitle = $id('currentCategoryTitle');
    if (currentCategoryTitle) currentCategoryTitle.textContent = title + ' Listings';
    const listingsCount = $id('listingsCount');
    if (listingsCount) listingsCount.textContent = visible.length;
    
    const listingsGrid = $id('listingsGrid');
    const noListings = $id('noListings');
    const loadMoreContainer = $id('loadMoreContainer');
    
    if (listingsGrid) listingsGrid.innerHTML = '';
    if (visible.length === 0) {
      if (noListings) noListings.style.display = 'block';
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      return;
    }
    
    if (noListings) noListings.style.display = 'none';
    if (loadMoreContainer) loadMoreContainer.style.display = 'none';
    
    const landingView = $id('landingView');
    const appView = $id('appView');
    const sellerView = $id('sellerView');
    const adminView = $id('adminView');
    
    if (landingView) landingView.style.display = 'none';
    if (appView) appView.style.display = 'block';
    if (sellerView) sellerView.style.display = 'none';
    if (adminView) adminView.style.display = 'none';
    
    if (isCategorySelected) {
      this.displayMode = 'grid';
      if (listingsGrid) {
        const container = document.createElement('div');
        container.className = 'vertical-listings-grid';
        let columns = 4;
        if (window.innerWidth <= 1200) columns = 3;
        if (window.innerWidth <= 992) columns = 2;
        if (window.innerWidth <= 768) columns = 2;
        if (window.innerWidth <= 480) columns = 1;
        container.style.cssText = `display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 20px; margin-top: 16px;`;
        visible.forEach(listing => {
          container.appendChild(this.createListingCard(listing));
        });
        listingsGrid.appendChild(container);
      }
    } else {
      this.displayMode = 'horizontal';
      this.showAllListings();
    }
  },
  
  showListingDetails: function(listing) {
    const modal = $id('listingModal');
    const modalBody = $id('listingModalBody');
    if (!modal || !modalBody) return;
    
    const isMobile = window.innerWidth <= 768;
    this.currentImageIndex = 0;
    this.currentListingImages = listing.images || [];
    
    let featuresHTML = '';
    if (listing.features && listing.features.length > 0) {
      featuresHTML = `
        <div class="listing-features" style="margin-bottom:20px;">
          <h3 style="margin-bottom:12px;font-size:16px;">Features</h3>
          <ul style="list-style:none;padding:0;margin:0;">
            ${listing.features.map(f => `<li style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0;"><i class="fas fa-check" style="color:#4CAF50;font-size:14px;"></i> <span>${f}</span></li>`).join('')}
          </ul>
        </div>`;
    }
    
    let customFieldsHTML = '';
    if (listing.category === 'househelp') {
      let fields = [];
      if (listing.househelpTypes) {
        fields.push(`<div><strong>Helper Types:</strong> ${listing.househelpTypes.join(', ')}</div>`);
      }
      if (listing.stayType) {
        fields.push(`<div><strong>Stay Type:</strong> ${listing.stayType}</div>`);
      }
      if (listing.englishSpeakingStars !== undefined) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
          starsHtml += i <= listing.englishSpeakingStars ? '<i class="fas fa-star" style="color:#FFD700;"></i>' : '<i class="far fa-star" style="color:#ccc;"></i>';
        }
        fields.push(`<div><strong>English Speaking:</strong> ${starsHtml}</div>`);
      }
      if (listing.education) {
        fields.push(`<div><strong>Education:</strong> ${listing.education}</div>`);
      }
      if (listing.experience) {
        fields.push(`<div><strong>Experience:</strong> ${listing.experience}</div>`);
      }
      if (listing.age) {
        fields.push(`<div><strong>Age:</strong> ${listing.age}</div>`);
      }
      if (fields.length) {
        customFieldsHTML = `<div class="custom-fields" style="margin-bottom:20px;padding:16px;background:#f9f9f9;border-radius:12px;">${fields.join('')}</div>`;
      }
    } else if (listing.category === 'indriveDriver') {
      let fields = [];
      if (listing.englishSpeakingStars !== undefined) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
          starsHtml += i <= listing.englishSpeakingStars ? '<i class="fas fa-star" style="color:#FFD700;"></i>' : '<i class="far fa-star" style="color:#ccc;"></i>';
        }
        fields.push(`<div><strong>English Speaking:</strong> ${starsHtml}</div>`);
      }
      if (listing.experience) {
        fields.push(`<div><strong>Experience:</strong> ${listing.experience}</div>`);
      }
      if (listing.age) {
        fields.push(`<div><strong>Age:</strong> ${listing.age}</div>`);
      }
      if (listing.hasLicense) {
        fields.push(`<div><strong>Driver's License:</strong> Yes</div>`);
      } else if (listing.hasLicense === false) {
        fields.push(`<div><strong>Driver's License:</strong> No</div>`);
      }
      if (listing.carModel) {
        fields.push(`<div><strong>Car Model:</strong> ${listing.carModel}</div>`);
      }
      if (fields.length) {
        customFieldsHTML = `<div class="custom-fields" style="margin-bottom:20px;padding:16px;background:#f9f9f9;border-radius:12px;">${fields.join('')}</div>`;
      }
    } else if (listing.category === 'construction') {
      let fields = [];
      if (listing.constructionServices) {
        fields.push(`<div><strong>Services Offered:</strong> ${listing.constructionServices.join(', ')}</div>`);
      }
      if (fields.length) {
        customFieldsHTML = `<div class="custom-fields" style="margin-bottom:20px;padding:16px;background:#f9f9f9;border-radius:12px;">${fields.join('')}</div>`;
      }
    } else if (listing.category === 'boreholeServices') {
      let fields = [];
      if (listing.boreholeServices) {
        fields.push(`<div><strong>Services:</strong> ${listing.boreholeServices.join(', ')}</div>`);
      }
      if (listing.serviceDetails) {
        fields.push(`<div><strong>Details:</strong> ${listing.serviceDetails}</div>`);
      }
      if (fields.length) {
        customFieldsHTML = `<div class="custom-fields" style="margin-bottom:20px;padding:16px;background:#f9f9f9;border-radius:12px;">${fields.join('')}</div>`;
      }
    }
    
    let gpsLocation = '';
    if (listing.gpsCoordinates) {
      gpsLocation = `
        <div class="gps-location" style="margin-bottom:20px;padding:16px;background:#f0f8ff;border-radius:12px;border-left:4px solid #2196F3;">
          <h3 style="margin-bottom:12px;font-size:16px;color:#2196F3;display:flex;align-items:center;gap:8px;"><i class="fas fa-map-marker-alt"></i> GPS Location</h3>
          <code style="background:#fff;padding:6px 12px;border-radius:6px;border:1px solid #2196F3;color:#2196F3;font-weight:bold;">${listing.gpsCoordinates}</code>
          <div style="display:flex;gap:12px;margin-top:12px;"><a href="https://maps.google.com/?q=${encodeURIComponent(listing.gpsCoordinates)}" target="_blank" style="background:#2196F3;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;">View on Google Maps</a><button onclick="window.WW_APP.copyToClipboard('${listing.gpsCoordinates}')" style="background:#f0f0f0;border:1px solid #ddd;border-radius:8px;padding:10px 16px;cursor:pointer;">Copy Coordinates</button></div>
        </div>`;
    }
    
    let imagesHTML = '';
    if (listing.images && listing.images.length > 0) {
      imagesHTML = `
        <div class="listing-images-slider" style="position:relative;">
          <div class="main-image" style="position:relative;">
            <img src="${listing.images[0]}" alt="${listing.title}" id="mainListingImage" style="width:100%;height:${isMobile ? '250px' : '400px'};object-fit:cover;border-radius:12px;cursor:pointer">
            ${listing.images.length > 1 ? `<button class="prev-image" onclick="window.WW_APP.navigateImages('prev')" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.7);color:white;border:none;border-radius:50%;width:40px;height:40px;font-size:20px;cursor:pointer;">❮</button>
            <button class="next-image" onclick="window.WW_APP.navigateImages('next')" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.7);color:white;border:none;border-radius:50%;width:40px;height:40px;font-size:20px;cursor:pointer;">❯</button>
            <div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:4px 12px;border-radius:12px;font-size:14px;">1 / ${listing.images.length}</div>` : ''}
          </div>
          ${listing.images.length > 1 ? `<div class="image-thumbnails" style="display:flex;gap:8px;margin-top:12px;overflow-x:auto;padding-bottom:8px;">${listing.images.map((img, i) => `<img src="${img}" alt="Thumbnail" onclick="window.WW_APP.showImage(${i})" style="width:80px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;border:${i===0?'2px solid #C8B897':'1px solid #ddd'};">`).join('')}</div>` : ''}
        </div>`;
    } else {
      imagesHTML = '<div class="no-image" style="background:#f0f0f0;border-radius:12px;padding:40px;text-align:center;color:#666;"><i class="fas fa-image" style="font-size:48px;margin-bottom:16px;"></i><p>No images available</p></div>';
    }
    
    let bidSectionHTML = '';
    if (listing.bidEnabled) {
      const now = Date.now();
      const endTime = listing.bidEndTime ? new Date(listing.bidEndTime).getTime() : now;
      const diff = endTime - now;
      const expired = diff <= 0;
      const timerHtml = expired ? 'Bidding ended' : `<span id="bidDetailTimer" data-endtime="${endTime}">...</span>`;
      
      let bidsHTML = '<p>No bids yet.</p>';
      if (listing.bids && listing.bids.length > 0) {
        bidsHTML = listing.bids.map(bid => {
          const statusClass = bid.status === 'accepted' ? 'accepted' : bid.status === 'rejected' ? 'rejected' : '';
          const isOwner = this.user && listing.contact && listing.contact.email === this.user.email;
          return `
            <div class="bid-card ${statusClass}">
              <div class="bid-amount">$${bid.amount}</div>
              <div>by ${bid.userName || 'Anonymous'}</div>
              ${bid.message ? `<div style="font-size:13px;color:#555;">${bid.message}</div>` : ''}
              <div class="bid-meta">${new Date(bid.createdAt).toLocaleString()} - ${bid.status || 'pending'}</div>
              ${isOwner && bid.status === 'pending' ? `<div style="margin-top:8px;"><button class="btn btn-success" onclick="window.WW_APP.acceptBid('${listing.id}','${bid.id}')" style="margin-right:8px;">Accept</button><button class="btn btn-danger" onclick="window.WW_APP.rejectBid('${listing.id}','${bid.id}')">Reject</button></div>` : ''}
            </div>`;
        }).join('');
      }
      
      const bidForm = (!expired && this.user) ? `
        <div style="margin-top:20px;padding:20px;background:#f9f9f9;border-radius:12px;">
          <h4>Place a Bid</h4>
          <div class="form-group">
            <label>Bid Amount ($)</label>
            <input type="number" id="bidAmount" placeholder="Your offer" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;">
          </div>
          <div class="form-group">
            <label>Message (optional)</label>
            <textarea id="bidMessage" rows="2" placeholder="Add a note..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;"></textarea>
          </div>
          <button class="btn btn-primary" onclick="window.WW_APP.placeBid('${listing.id}')">Place Bid</button>
        </div>` : '';
      
      bidSectionHTML = `
        <div style="background:#fff3e0;padding:20px;border-radius:12px;margin-bottom:20px;">
          <h3 style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><i class="fas fa-gavel" style="color:#F44336;"></i> Bidding</h3>
          <div class="bid-timer" style="font-size:18px;font-weight:600;margin-bottom:16px;">${timerHtml}</div>
          <div style="margin-bottom:16px;"><strong>Current Bids (${listing.bids ? listing.bids.length : 0})</strong></div>
          ${bidsHTML}
          ${bidForm}
        </div>`;
    }
    
    // Occupancy info for rentals
    let occupancyHTML = '';
    if (this._getRentalCategories().includes(listing.category)) {
      const occStatus = listing.occupancyStatus || 'vacant';
      const occColor = occStatus === 'occupied' ? '#F44336' : '#4CAF50';
      occupancyHTML = `
        <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:16px;padding:6px 12px;background:${occColor};color:white;border-radius:6px;font-size:14px;font-weight:600;">
          <i class="fas ${occStatus === 'occupied' ? 'fa-bed' : 'fa-check-circle'}"></i>
          ${occStatus === 'occupied' ? 'Currently Occupied' : 'Currently Vacant'}
        </div>`;
    }
    
    const displayPrice = this.formatPrice(listing);
    
    modalBody.innerHTML = imagesHTML + `
      <div class="listing-info" style="margin-top:24px;">
        <h2 style="margin-bottom:8px;font-size:${isMobile ? '20px' : '28px'};line-height:1.2;">${listing.title}</h2>
        <div class="price-location" style="margin-bottom:20px;">
          <div class="price" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><span style="color:#4CAF50;font-weight:bold;font-size:20px;">$</span><strong style="font-size:${isMobile ? '24px' : '28px'};">${listing.price ? displayPrice.replace('$', '') : 'Price on request'}</strong></div>
          <div class="location" style="display:flex;align-items:center;gap:8px;margin-bottom:12px;"><i class="fas fa-map-marker-alt" style="color:#FF6B6B;font-size:16px;"></i><span style="font-size:16px;color:#555;">${listing.location || 'Location not specified'}</span></div>
        </div>
        ${occupancyHTML}
        ${featuresHTML}
        ${customFieldsHTML}
        ${gpsLocation}
        ${bidSectionHTML}
        <div class="description" style="margin-bottom:20px;padding:16px;background:#f9f9f9;border-radius:12px;">
          <h3 style="margin-bottom:12px;font-size:18px;color:#333;"><i class="fas fa-align-left" style="color:#C8B897;"></i> Description</h3>
          <p style="line-height:1.6;color:#555;font-size:15px;white-space:pre-line;">${listing.description || 'No description provided.'}</p>
        </div>
        <div class="contact-info" style="background:#f9f9f9;padding:20px;border-radius:12px;margin-bottom:20px;">
          <h3 style="margin-bottom:16px;"><i class="fas fa-address-card" style="color:#C8B897;"></i> Contact</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:16px;">
            <div style="display:flex;align-items:center;gap:10px;padding:10px;background:white;border-radius:8px;"><div style="width:40px;height:40px;background:#C8B897;border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-user" style="color:white;"></i></div><div><div style="font-size:12px;color:#666;">Name</div><div style="font-weight:600;">${listing.contact?.name || 'Not provided'}</div></div></div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px;background:white;border-radius:8px;"><div style="width:40px;height:40px;background:#4CAF50;border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-phone" style="color:white;"></i></div><div><div style="font-size:12px;color:#666;">Phone</div><div style="font-weight:600;">${listing.contact?.phone || 'Not provided'}</div></div></div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px;background:white;border-radius:8px;"><div style="width:40px;height:40px;background:#2196F3;border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-envelope" style="color:white;"></i></div><div><div style="font-size:12px;color:#666;">Email</div><div style="font-weight:600;">${listing.contact?.email || 'Not provided'}</div></div></div>
          </div>
        </div>
        <div class="action-buttons" style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;">
          <button class="btn btn-primary" onclick="window.WW_APP.callSeller('${listing.contact?.phone || ''}')" style="flex:1;min-width:120px;"><i class="fas fa-phone"></i> Call Seller</button>
          <button class="btn btn-success" style="background:#25D366;border:none;flex:1;min-width:120px;" onclick="window.WW_APP.whatsappSeller('${listing.contact?.phone || ''}', '${listing.title}', '${displayPrice}', '${listing.contact?.name || ''}')"><i class="fab fa-whatsapp"></i> WhatsApp</button>
          <button class="btn btn-outline" onclick="window.WW_APP.copyPhoneNumber('${listing.contact?.phone || ''}')" style="flex:1;min-width:120px;"><i class="fas fa-copy"></i> Copy Number</button>
          <button class="btn btn-outline" onclick="window.WW_APP.saveEnquiry(${JSON.stringify(listing).replace(/'/g, "\\'")})" style="flex:1;min-width:120px;"><i class="fas fa-save"></i> Save Enquiry</button>
        </div>
      </div>
    `;
    
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  },
  
  copyToClipboard: function(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success')).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copied!', 'success');
    });
  },
  
  showImage: function(index) {
    const mainImg = $id('mainListingImage');
    if (mainImg && this.currentListingImages[index]) {
      mainImg.src = this.currentListingImages[index];
      this.currentImageIndex = index;
      
      $$('.image-thumbnails img').forEach((img, i) => {
        img.style.border = i === index ? '2px solid #C8B897' : '1px solid #ddd';
      });
      
      const counter = document.querySelector('.listing-images-slider .main-image > div');
      if (counter) {
        counter.textContent = `${index + 1} / ${this.currentListingImages.length}`;
      }
    }
  },
  
  navigateImages: function(direction) {
    if (!this.currentListingImages || this.currentListingImages.length <= 1) return;
    if (direction === 'prev') {
      this.currentImageIndex = (this.currentImageIndex - 1 + this.currentListingImages.length) % this.currentListingImages.length;
    } else if (direction === 'next') {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.currentListingImages.length;
    }
    this.showImage(this.currentImageIndex);
  },
  
  closeListingModal: function() {
    const modal = $id('listingModal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = 'auto';
    }
  },
  
  openImageModal: function(imageSrc) {
    const modal = $id('imageModal');
    const modalImage = $id('modalImage');
    if (modal && modalImage) {
      modalImage.src = imageSrc;
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  },
  
  closeImageModal: function() {
    const modal = $id('imageModal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = 'auto';
    }
  },
  
  closeAllModals: function() {
    closeLoginModal();
    closeCreateAccountModal();
    this.closeListingModal();
    this.closeImageModal();
    this.closeCategoryDropdown();
    this.closeShareModal();
  },
  
  callSeller: function(phone) {
    if (phone) window.location.href = `tel:${phone}`;
    else showToast('Phone number not available', 'error');
  },
  
  whatsappSeller: function(phone, listingTitle, price, sellerName) {
    if (!phone) {
      showToast('Phone number not available', 'error');
      return;
    }
    const cleaned = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Hi ${sellerName || ''}, I'm interested in "${listingTitle}" listed for ${price} on Walls.`);
    window.open(`https://wa.me/${cleaned}?text=${message}`, '_blank');
  },
  
  copyPhoneNumber: function(phone) {
    this.copyToClipboard(phone);
  },
  
  saveEnquiry: function(listing) {
    let saved = JSON.parse(localStorage.getItem('ww_enquiries') || '[]');
    if (saved.some(e => e.id === listing.id)) {
      showToast('Already saved!', 'info');
      return;
    }
    saved.unshift(listing);
    localStorage.setItem('ww_enquiries', JSON.stringify(saved));
    showToast('Enquiry saved!', 'success');
  },
  
  showRecentEnquiries: function() {
    const landingView = $id('landingView');
    const appView = $id('appView');
    const sellerView = $id('sellerView');
    const adminView = $id('adminView');
    
    if (landingView) landingView.style.display = 'none';
    if (appView) appView.style.display = 'block';
    if (sellerView) sellerView.style.display = 'none';
    if (adminView) adminView.style.display = 'none';
    
    this.currentView = 'app';
    this.currentMode = 'recent';
    this.updateNavHighlight();
    
    const saved = JSON.parse(localStorage.getItem('ww_enquiries') || '[]');
    const currentCategoryTitle = $id('currentCategoryTitle');
    if (currentCategoryTitle) currentCategoryTitle.textContent = 'Saved Enquiries';
    
    const listingsCount = $id('listingsCount');
    if (listingsCount) listingsCount.textContent = saved.length;
    
    const listingsGrid = $id('listingsGrid');
    const noListings = $id('noListings');
    const loadMoreContainer = $id('loadMoreContainer');
    
    if (listingsGrid) listingsGrid.innerHTML = '';
    if (saved.length === 0) {
      if (noListings) noListings.style.display = 'block';
      if (loadMoreContainer) loadMoreContainer.style.display = 'none';
      return;
    }
    if (noListings) noListings.style.display = 'none';
    if (loadMoreContainer) loadMoreContainer.style.display = 'none';
    
    this.displayMode = 'grid';
    if (listingsGrid) {
      const container = document.createElement('div');
      container.className = 'vertical-listings-grid';
      let columns = 4;
      if (window.innerWidth <= 1200) columns = 3;
      if (window.innerWidth <= 992) columns = 2;
      if (window.innerWidth <= 768) columns = 2;
      if (window.innerWidth <= 480) columns = 1;
      container.style.cssText = `display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 20px; margin-top: 16px;`;
      saved.forEach(enquiry => {
        container.appendChild(this.createListingCard(enquiry));
      });
      listingsGrid.appendChild(container);
    }
  },
  
  removeEnquiry: function(enquiryId) {
    let saved = JSON.parse(localStorage.getItem('ww_enquiries') || '[]');
    saved = saved.filter(e => e.id !== enquiryId);
    localStorage.setItem('ww_enquiries', JSON.stringify(saved));
    showToast('Enquiry removed', 'info');
    this.showRecentEnquiries();
  },
  
  showSellerView: function() {
    const landingView = $id('landingView');
    const appView = $id('appView');
    const sellerView = $id('sellerView');
    const adminView = $id('adminView');
    
    if (landingView) landingView.style.display = 'none';
    if (appView) appView.style.display = 'none';
    if (sellerView) sellerView.style.display = 'block';
    if (adminView) adminView.style.display = 'none';
    
    this.currentView = 'seller';
    this.renderCategorySelection('walls', 'sell');
  },
  
  renderCategorySelection: function(categoryType, mode) {
    $$('.ww-popup').forEach(p => p.remove());
    const categories = this.categories.walls;
    if (!categories) return;
    
    const popup = document.createElement('div');
    popup.className = 'ww-popup';
    popup.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    const content = document.createElement('div');
    content.className = 'ww-popup-content';
    content.style.cssText = 'background: white; border-radius: 12px; padding: 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;';
    
    const title = document.createElement('h3');
    title.textContent = mode === 'sell' ? 'Select category to list your service or property' : 'Select category to browse';
    title.style.marginTop = '0';
    title.style.textAlign = 'center';
    title.style.marginBottom = '20px';
    
    const grid = document.createElement('div');
    grid.className = 'category-grid-popup';
    grid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0;';
    
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-item-btn';
      btn.style.cssText = 'display: flex; flex-direction: column; align-items: center; padding: 20px; border: 2px solid #e0e0e0; border-radius: 8px; background: white; cursor: pointer; transition: all 0.3s;';
      btn.innerHTML = `
        <div style="width:50px;height:50px;background:#C8B897;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:12px;">
          <i class="${cat.icon}" style="font-size: 20px; color: white;"></i>
        </div>
        <span style="font-weight: 500; font-size: 14px; text-align: center;">${cat.label}</span>
      `;
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = '#C8B897';
        btn.style.transform = 'translateY(-2px)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = '#e0e0e0';
        btn.style.transform = 'translateY(0)';
      });
      btn.addEventListener('click', () => {
        popup.remove();
        if (mode === 'sell') {
          this.currentCategory = cat;
          this.renderSellerForm('walls');
        } else {
          this.selectCategory(cat.key);
        }
      });
      grid.appendChild(btn);
    });
    
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-outline';
    backBtn.textContent = 'Cancel';
    backBtn.style.cssText = 'width:100%;margin-top:16px;padding:12px;';
    backBtn.addEventListener('click', () => popup.remove());
    
    content.appendChild(title);
    content.appendChild(grid);
    content.appendChild(backBtn);
    popup.appendChild(content);
    document.body.appendChild(popup);
    
    popup.addEventListener('click', (e) => {
      if (e.target === popup) popup.remove();
    });
  },
  
  // Property features array for seller form
  propertyFeatures: [
    "Air Conditioning", "Alarm System", "Balcony", "Borehole", "Built-in Cupboards",
    "Carpeted", "CCTV", "Electric Gate", "Electric Fence", "Fenced", "Garden",
    "Gas Stove", "Generator", "Guest Toilet", "Internet Ready", "Irrigation System",
    "Kitchen Units", "Laundry Room", "Main Ensuite", "Own Entrance", "Pantry",
    "Parking Garage", "Paved", "Pet Friendly", "Pool", "Prepaid Electricity",
    "Security Gate", "Servants Quarters", "Solar Panels", "Staff Quarters",
    "Study", "Tiled Floors", "Water Tank", "Wheelchair Access", "Window Coverings",
    "Wooden Floors"
  ],
  
  renderSellerForm: function(categoryType) {
    const sellerForm = $id('sellerForm');
    if (!sellerForm || !this.currentCategory) return;
    
    const catKey = this.currentCategory.key;
    const requiresVerification = this._getSaleCategoriesRequiringVerification().includes(catKey);
    
    let categorySpecificFields = '';
    
    if (['rentalsHouses','rentalsFlats','rentalsRooms','singleRoomsToRent','cottagesToRent','bnb','sellingHouses','sellingFlats','cottagesToSale','boardingHouses','residentialStands','farmPlots'].includes(catKey)) {
      categorySpecificFields += `
        <div class="form-group">
          <label style="display:block;font-size:14px;font-weight:500;margin-bottom:8px;color:#333;">Property Features (Select all that apply)</label>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:8px;padding:12px;background:#f9f9f9;border-radius:8px;max-height:200px;overflow-y:auto;">
            ${this.propertyFeatures.map(feature => `
              <label style="display:flex;align-items:center;gap:8px;padding:8px;background:white;border-radius:6px;border:1px solid #e0e0e0;cursor:pointer;transition:all 0.3s;">
                <input type="checkbox" name="features[]" value="${feature}" style="width:18px;height:18px;">
                <span style="font-size:14px;">${feature}</span>
              </label>
            `).join('')}
          </div>
        </div>
        
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label for="bedrooms">Bedrooms</label>
            <input type="number" id="bedrooms" name="bedrooms" min="0" placeholder="e.g., 3" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
          </div>
          <div class="form-group">
            <label for="bathrooms">Bathrooms</label>
            <input type="number" id="bathrooms" name="bathrooms" min="0" placeholder="e.g., 2" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
          </div>
        </div>
      `;
    } else if (catKey === 'househelp') {
      const helperTypes = ['Housemaid', 'Care Taker', 'Gardener', 'Cook', 'Nanny', 'Driver', 'Cleaner', 'Laundry Worker', 'Elderly Caregiver'];
      categorySpecificFields += `
        <div class="form-group">
          <label style="display:block;font-size:14px;font-weight:500;margin-bottom:8px;color:#333;">Helper Type(s) (Select all that apply)</label>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:8px;padding:12px;background:#f9f9f9;border-radius:8px;max-height:200px;overflow-y:auto;">
            ${helperTypes.map(type => `
              <label style="display:flex;align-items:center;gap:8px;padding:8px;background:white;border-radius:6px;border:1px solid #e0e0e0;cursor:pointer;transition:all 0.3s;">
                <input type="checkbox" name="househelpTypes[]" value="${type}" style="width:18px;height:18px;">
                <span style="font-size:14px;">${type}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label style="display:block;font-size:14px;font-weight:500;margin-bottom:8px;color:#333;">Stay Type</label>
          <div style="display:flex;gap:16px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:8px;padding:10px;background:white;border-radius:8px;border:1px solid #e0e0e0;cursor:pointer;">
              <input type="radio" name="stayType" value="Stay-in" style="width:18px;height:18px;">
              <span>Stay-in</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:10px;background:white;border-radius:8px;border:1px solid #e0e0e0;cursor:pointer;">
              <input type="radio" name="stayType" value="Stay-out" style="width:18px;height:18px;">
              <span>Stay-out</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;padding:10px;background:white;border-radius:8px;border:1px solid #e0e0e0;cursor:pointer;">
              <input type="radio" name="stayType" value="Flexible" style="width:18px;height:18px;">
              <span>Flexible</span>
            </label>
          </div>
        </div>
        <div class="form-group">
          <label style="display:block;font-size:14px;font-weight:500;margin-bottom:8px;color:#333;">English Speaking (1-5 stars)</label>
          <select name="englishSpeakingStars" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;" required>
            <option value="1">★☆☆☆☆</option>
            <option value="2">★★☆☆☆</option>
            <option value="3" selected>★★★☆☆</option>
            <option value="4">★★★★☆</option>
            <option value="5">★★★★★</option>
          </select>
        </div>
        <div class="form-group">
          <label for="education">Education (Optional)</label>
          <input type="text" name="education" placeholder="e.g., High School, Diploma" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
        </div>
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label for="experience">Experience (e.g., 5 years)</label>
            <input type="text" name="experience" placeholder="e.g., 5 years" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
          </div>
          <div class="form-group">
            <label for="age">Age</label>
            <input type="number" name="age" min="18" max="100" placeholder="e.g., 30" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
          </div>
        </div>
      `;
    } else if (catKey === 'indriveDriver') {
      categorySpecificFields += `
        <div class="form-group">
          <label style="display:block;font-size:14px;font-weight:500;margin-bottom:8px;color:#333;">English Speaking (1-5 stars)</label>
          <select name="englishSpeakingStars" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;" required>
            <option value="1">★☆☆☆☆</option>
            <option value="2">★★☆☆☆</option>
            <option value="3" selected>★★★☆☆</option>
            <option value="4">★★★★☆</option>
            <option value="5">★★★★★</option>
          </select>
        </div>
        <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label for="experience">Experience (e.g., 5 years)</label>
            <input type="text" name="experience" placeholder="e.g., 5 years" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
          </div>
          <div class="form-group">
            <label for="age">Age</label>
            <input type="number" name="age" min="18" max="100" placeholder="e.g., 30" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
          </div>
        </div>
        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;padding:10px;background:white;border-radius:8px;border:1px solid #e0e0e0;">
            <input type="checkbox" name="hasLicense" value="yes" style="width:18px;height:18px;">
            <span style="font-size:14px;">Has driver's license</span>
          </label>
        </div>
        <div class="form-group">
          <label for="carModel">Car Model</label>
          <input type="text" name="carModel" placeholder="e.g., Toyota Corolla" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
        </div>
      `;
    } else if (catKey === 'construction') {
      const services = ['Plumber', 'Roofer', 'Builder', 'Tiler', 'Electrician', 'Painter', 'Carpenter', 'Bricklayer', 'Plasterer', 'Welder', 'Flooring', 'Renovation', 'Architectural Design'];
      categorySpecificFields += `
        <div class="form-group">
          <label style="display:block;font-size:14px;font-weight:500;margin-bottom:8px;color:#333;">Services Offered (Select all that apply)</label>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:8px;padding:12px;background:#f9f9f9;border-radius:8px;max-height:200px;overflow-y:auto;">
            ${services.map(service => `
              <label style="display:flex;align-items:center;gap:8px;padding:8px;background:white;border-radius:6px;border:1px solid #e0e0e0;cursor:pointer;transition:all 0.3s;">
                <input type="checkbox" name="constructionServices[]" value="${service}" style="width:18px;height:18px;">
                <span style="font-size:14px;">${service}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `;
    } else if (catKey === 'boreholeServices') {
      const services = ['Borehole Drilling', 'Borehole Installation', 'Pump Installation', 'Borehole Repairs', 'Water Testing', 'Borehole Cleaning', 'PVC Casing', 'Steel Casing', 'Geological Survey'];
      categorySpecificFields += `
        <div class="form-group">
          <label style="display:block;font-size:14px;font-weight:500;margin-bottom:8px;color:#333;">Services (Select all that apply)</label>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:8px;padding:12px;background:#f9f9f9;border-radius:8px;max-height:200px;overflow-y:auto;">
            ${services.map(service => `
              <label style="display:flex;align-items:center;gap:8px;padding:8px;background:white;border-radius:6px;border:1px solid #e0e0e0;cursor:pointer;transition:all 0.3s;">
                <input type="checkbox" name="boreholeServices[]" value="${service}" style="width:18px;height:18px;">
                <span style="font-size:14px;">${service}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label for="serviceDetails">Additional Service Details (Optional)</label>
          <textarea id="serviceDetails" name="serviceDetails" rows="3" placeholder="Describe your borehole services, equipment, depth capabilities, etc." style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;"></textarea>
        </div>
      `;
    }
    
    let verificationUploadHTML = '';
    if (requiresVerification) {
      verificationUploadHTML = `
        <div class="form-section" style="background:#fff3e0;padding:20px;border-radius:12px;border-left:4px solid #FF9800;margin-bottom:24px;">
          <h3 style="margin-top:0;"><i class="fas fa-file-contract"></i> Proof of Ownership (Title Deeds)</h3>
          <p style="font-size:13px;color:#666;">For property sale listings, you must upload clear copies of title deeds or proof of ownership. These documents will be reviewed by the admin before the listing becomes visible.</p>
          <div class="form-group">
            <label>Upload Title Deeds (scans or clear photos) *</label>
            <input type="file" id="verificationDocs" name="verificationDocs" accept="image/*,.pdf" multiple required style="width:100%;padding:12px;border:2px dashed #FF9800;border-radius:8px;background:#fff;cursor:pointer;">
            <div id="verificationDocsPreview" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:12px;"></div>
          </div>
        </div>
      `;
    }
    
    // Build the title/name field label and placeholder based on category
    const isHousehelp = catKey === 'househelp';
    const titleLabel = isHousehelp ? 'Name *' : 'Title *';
    const titlePlaceholder = isHousehelp ? 'e.g., Experienced Housemaid' : 'e.g., Experienced Housemaid / Borehole Drilling Services';
    
    // Build price field with appropriate label
    let priceFieldHTML = '';
    if (catKey === 'househelp' || catKey === 'indriveDriver' || catKey === 'construction' || catKey === 'boreholeServices') {
      priceFieldHTML = `
        <div class="form-group">
          <label for="price">Price (Optional)</label>
          <div style="position:relative;">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#4CAF50;font-weight:bold;">$</span>
            <input type="text" id="price" name="price" placeholder="e.g., 50 or negotiable" style="width:100%;padding:12px 12px 12px 30px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
          </div>
        </div>`;
    } else {
      const isRental = this._getRentalCategories().includes(catKey);
      const isBnb = catKey === 'bnb';
      const priceLabel = isBnb ? 'Rent per Day *' : (isRental ? 'Rent per Month *' : 'Price *');
      const pricePlaceholder = isBnb ? 'e.g., 80/day' : (isRental ? 'e.g., 800/month' : 'e.g., 15,000 or 800/month');
      priceFieldHTML = `
        <div class="form-group">
          <label for="price">${priceLabel}</label>
          <div style="position:relative;">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#4CAF50;font-weight:bold;">$</span>
            <input type="text" id="price" name="price" required placeholder="${pricePlaceholder}" style="width:100%;padding:12px 12px 12px 30px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
          </div>
        </div>`;
    }
    
    sellerForm.innerHTML = `
      <div class="form-section" style="background:#f9f9f9;padding:20px;border-radius:12px;border-left:4px solid #C8B897;margin-bottom:24px;">
        <h3 style="font-size:20px;font-weight:600;margin-bottom:8px;color:#333;display:flex;align-items:center;gap:10px;">
          <i class="${this.currentCategory.icon}" style="color:#C8B897;"></i> 
          ${this.currentCategory.label}
        </h3>
        <p style="color:#666;font-size:14px;">Fill in the details to list your service or property</p>
      </div>
      
      <div class="form-group">
        <label for="title">${titleLabel}</label>
        <input type="text" id="title" name="title" required placeholder="${titlePlaceholder}" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
      </div>
      
      <div class="form-group">
        <label for="description">Description *</label>
        <textarea id="description" name="description" required placeholder="Describe your services..." rows="4" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;resize:vertical;"></textarea>
      </div>
      
      ${categorySpecificFields}
      
      <div class="form-row" style="display:grid;grid-template-columns:${catKey !== 'househelp' && catKey !== 'indriveDriver' && catKey !== 'construction' && catKey !== 'boreholeServices' ? '1fr 1fr' : '1fr'};gap:16px;">
        ${priceFieldHTML}
        <div class="form-group">
          <label for="location">Location *</label>
          <input type="text" id="location" name="location" required placeholder="e.g., Harare, Borrowdale" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
        </div>
      </div>
      
      <div class="form-group">
        <label for="gpsLocation" style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500;margin-bottom:8px;color:#333;">
          <i class="fas fa-map-marker-alt" style="color:#2196F3;"></i> GPS Location (Optional)
        </label>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="text" id="gpsCoordinates" name="gpsCoordinates" placeholder="e.g., -17.825166, 31.033510" style="flex:1;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
          <button type="button" id="getCurrentLocation" style="padding:12px 16px;background:#2196F3;color:white;border:none;border-radius:8px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:8px;">
            <i class="fas fa-crosshairs"></i> Get Location
          </button>
        </div>
        <small>Click the button to automatically get your current GPS coordinates</small>
      </div>
      
      ${verificationUploadHTML}
      
      ${(function(){
        const _serviceCats = ['househelp','indriveDriver','construction','boreholeServices'];
        const _isService = _serviceCats.includes(catKey);
        const _label = _isService ? 'Upload a Photo (Optional)' : 'Images (Upload up to 6 photos) *';
        const _required = _isService ? '' : 'required';
        const _multiple = _isService ? '' : 'multiple';
        return `
      <div class="form-group">
        <label for="images">${_label}</label>
        <input type="file" id="images" name="images" accept="image/*" ${_multiple} ${_required} style="width:100%;padding:12px;border:2px dashed #e0e0e0;border-radius:8px;background:#f9f9f9;cursor:pointer;">
        <div id="imagePreview" class="image-preview" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(100px, 1fr));gap:12px;margin-top:16px;"></div>
      </div>`;
      })()}
      
      <div class="form-section" style="background:#f9f9f9;padding:20px;border-radius:12px;border-left:4px solid #2196F3;margin-bottom:24px;">
        <h3 style="font-size:20px;font-weight:600;margin-bottom:8px;color:#333;display:flex;align-items:center;gap:10px;">
          <i class="fas fa-user" style="color:#2196F3;"></i> Contact Information
        </h3>
        <p style="color:#666;font-size:14px;">This information will be visible to potential clients</p>
      </div>
      
      <div class="form-group">
        <label for="contactName">Your Name *</label>
        <input type="text" id="contactName" name="contactName" required value="${this.user ? this.user.name : ''}" placeholder="e.g., John Doe" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
      </div>
      
      <div class="form-group">
        <label for="contactPhone">Phone Number *</label>
        <input type="tel" id="contactPhone" name="contactPhone" required value="${this.user ? this.user.phone : ''}" placeholder="e.g., +263712345678" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
      </div>
      
      <div class="form-group">
        <label for="contactEmail">Email Address</label>
        <input type="email" id="contactEmail" name="contactEmail" value="${this.user ? this.user.email : ''}" placeholder="e.g., john@example.com" style="width:100%;padding:12px;border:1px solid #e0e0e0;border-radius:8px;font-size:14px;">
      </div>
      
      <div class="form-group" style="margin-top:32px;">
        <button type="submit" class="btn btn-primary" style="width:100%;padding:16px;font-size:16px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:10px;">
          <i class="fas fa-paper-plane"></i> Submit Listing
        </button>
      </div>
    `;
    
    if (requiresVerification) {
      const verificationInput = sellerForm.querySelector('#verificationDocs');
      const verificationPreview = sellerForm.querySelector('#verificationDocsPreview');
      if (verificationInput && verificationPreview) {
        verificationInput.addEventListener('change', function() {
          verificationPreview.innerHTML = '';
          const files = Array.from(this.files).slice(0, 6);
          files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
              const imgContainer = document.createElement('div');
              imgContainer.style.position = 'relative';
              const img = document.createElement('img');
              img.src = e.target.result;
              img.style.width = '100px';
              img.style.height = '100px';
              img.style.objectFit = 'cover';
              const removeBtn = document.createElement('button');
              removeBtn.innerHTML = '<i class="fas fa-times"></i>';
              removeBtn.style.cssText = 'position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; cursor: pointer;';
              removeBtn.addEventListener('click', () => imgContainer.remove());
              imgContainer.appendChild(img);
              imgContainer.appendChild(removeBtn);
              verificationPreview.appendChild(imgContainer);
            };
            reader.readAsDataURL(file);
          });
        });
      }
    }
    
    const getLocationBtn = sellerForm.querySelector('#getCurrentLocation');
    if (getLocationBtn) {
      getLocationBtn.addEventListener('click', () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((position) => {
            const gpsInput = sellerForm.querySelector('#gpsCoordinates');
            if (gpsInput) {
              gpsInput.value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
              showToast('GPS coordinates captured successfully!', 'success');
            }
          }, () => {
            showToast('Unable to get your location. Please enter manually.', 'error');
          });
        }
      });
    }
    
    const imagesInput = sellerForm.querySelector('#images');
    const imagePreview = sellerForm.querySelector('#imagePreview');
    if (imagesInput && imagePreview) {
      imagesInput.addEventListener('change', function() {
        imagePreview.innerHTML = '';
        const files = Array.from(this.files).slice(0, 6);
        files.forEach((file, index) => {
          const reader = new FileReader();
          reader.onload = function(e) {
            const imgContainer = document.createElement('div');
            imgContainer.style.position = 'relative';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100%';
            img.style.height = '80px';
            img.style.objectFit = 'cover';
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.style.cssText = 'position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 10px; cursor: pointer;';
            removeBtn.addEventListener('click', () => imgContainer.remove());
            imgContainer.appendChild(img);
            imgContainer.appendChild(removeBtn);
            imagePreview.appendChild(imgContainer);
          };
          reader.readAsDataURL(file);
        });
      });
    }
    
    sellerForm.onsubmit = (e) => {
      e.preventDefault();
      if (!this.user) {
        showToast('Please login to create a listing', 'error');
        openLoginModal();
        return;
      }
      
      const formData = new FormData(e.target);
      const listing = {
        id: 'listing_' + Date.now(),
        title: formData.get('title'),
        description: formData.get('description'),
        category: catKey,
        categoryLabel: this.currentCategory.label,
        price: formData.get('price') || 'Price on request',
        location: formData.get('location'),
        gpsCoordinates: formData.get('gpsCoordinates'),
        contact: {
          name: formData.get('contactName'),
          phone: formData.get('contactPhone'),
          email: formData.get('contactEmail')
        },
        createdBy: this.user.email,
        createdAt: new Date().toISOString(),
        status: 'active',
        isAd: false,
        adminPriority: 0,
        images: [],
        bidEnabled: false,
        bids: [],
        verificationStatus: requiresVerification ? 'pending' : null,
        verificationDocs: [],
        occupancyStatus: this._getRentalCategories().includes(catKey) ? 'vacant' : undefined
      };
      
      if (catKey === 'househelp') {
        listing.househelpTypes = formData.getAll('househelpTypes[]');
        listing.stayType = formData.get('stayType');
        listing.englishSpeakingStars = parseInt(formData.get('englishSpeakingStars')) || 3;
        listing.education = formData.get('education') || '';
        listing.experience = formData.get('experience') || '';
        listing.age = formData.get('age') || '';
      } else if (catKey === 'indriveDriver') {
        listing.englishSpeakingStars = parseInt(formData.get('englishSpeakingStars')) || 3;
        listing.experience = formData.get('experience') || '';
        listing.age = formData.get('age') || '';
        listing.hasLicense = formData.get('hasLicense') === 'yes';
        listing.carModel = formData.get('carModel') || '';
      } else if (catKey === 'construction') {
        listing.constructionServices = formData.getAll('constructionServices[]');
      } else if (catKey === 'boreholeServices') {
        listing.boreholeServices = formData.getAll('boreholeServices[]');
        listing.serviceDetails = formData.get('serviceDetails') || '';
      } else {
        listing.features = formData.getAll('features[]');
        listing.bedrooms = formData.get('bedrooms') || '';
        listing.bathrooms = formData.get('bathrooms') || '';
      }
      
      if (requiresVerification) {
        const verificationInput = sellerForm.querySelector('#verificationDocs');
        if (!verificationInput || verificationInput.files.length === 0) {
          showToast('Please upload title deeds or proof of ownership', 'error');
          return;
        }
      }
      
      const imagesInputEl = e.target.querySelector('#images');
      const _serviceCatsForImg = ['househelp','indriveDriver','construction','boreholeServices'];
      const _isServiceForImg = _serviceCatsForImg.includes(catKey);
      if (!_isServiceForImg && imagesInputEl.files.length === 0) {
        showToast('Please upload at least one image', 'error');
        return;
      }
      
      const files = Array.from(imagesInputEl.files).slice(0, 6);
      const imagePromises = files.map(file => new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.readAsDataURL(file);
      }));
      
      let verificationPromises = [];
      if (requiresVerification) {
        const verifInput = sellerForm.querySelector('#verificationDocs');
        const verifFiles = Array.from(verifInput.files).slice(0, 6);
        verificationPromises = verifFiles.map(file => new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(file);
        }));
      }
      
      Promise.all(imagePromises).then(images => {
        listing.images = images;
        if (verificationPromises.length > 0) {
          return Promise.all(verificationPromises).then(docs => {
            listing.verificationDocs = docs;
            return listing;
          });
        }
        return listing;
      }).then(finalListing => {
        this.listings.unshift(finalListing);
        this.saveListingsToStorage();
        this.checkSavedSearchesForVacancies();
        e.target.reset();
        if (imagePreview) imagePreview.innerHTML = '';
        if (requiresVerification) {
          const verifPreview = sellerForm.querySelector('#verificationDocsPreview');
          if (verifPreview) verifPreview.innerHTML = '';
        }
        if (requiresVerification) {
          showToast('Listing submitted for verification. It will appear after admin approval.', 'success');
        } else {
          showToast('Listing created successfully!', 'success');
        }
        this.switchToMode('buy');
      });
    };
  },
  
  selectCategory: function(categoryKey) {
    let category = null;
    for (const cat of this.categories.walls) {
      if (cat.key === categoryKey) {
        category = cat;
        break;
      }
    }
    if (!category) {
      showToast('Category not found', 'error');
      return;
    }
    
    this.currentCategory = category;
    const filtered = this.listings.filter(listing => listing.category === categoryKey);
    this.showFilteredListings(filtered, category.label, true);
  },
  
  toggleCategoryDropdown: function() {
    // Always render as a popup modal (consistent with other filters)
    this.showCategoryFilter();
  },

  closeCategoryDropdown: function() {
    const dropdown = $id('categoryDropdown');
    if (dropdown) {
      dropdown.style.display = 'none';
      dropdown.setAttribute('aria-hidden', 'true');
    }
    $$('.modal.category-filter-modal').forEach(m => m.remove());
  },

  showCategoryFilter: function() {
    const cats = (this.categories && this.categories.walls) ? this.categories.walls : [];
    const visible = this.listings.filter(l => this.isListingVisibleToUser(l));

    const modal = document.createElement('div');
    modal.className = 'modal category-filter-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';

    const rows = [
      `<div class="filter-option" style="padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;" onclick="window.WW_APP.filterByCategory('All')"><strong>All Categories</strong> <span style="float:right;color:#666;">${visible.length} listings</span></div>`
    ].concat(cats.map(cat => {
      const count = visible.filter(l => l.category === cat.key).length;
      const icon = cat.icon ? `<i class="${cat.icon}" style="margin-right:8px;color:#666;"></i>` : '';
      return `<div class="filter-option" style="padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;" onclick="window.WW_APP.filterByCategory('${cat.key}')">${icon}<strong>${cat.label}</strong> <span style="float:right;color:#666;">${count} listings</span></div>`;
    })).join('');

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 460px; width: 90%; background:#fff; border-radius:12px; padding:20px;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0;">Filter by Category</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div style="max-height: 60vh; overflow-y: auto;">${rows}</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },

  filterByCategory: function(categoryKey) {
    $$('.modal.category-filter-modal').forEach(m => m.remove());
    const filterBtn = $id('filterCategory');
    if (categoryKey === 'All') {
      this.currentCategory = null;
      this.filters.category = 'All';
      if (filterBtn) filterBtn.innerHTML = `<i class="fas fa-th-large"></i> All`;
    } else {
      const cat = (this.categories.walls || []).find(c => c.key === categoryKey);
      if (!cat) { showToast('Category not found', 'error'); return; }
      this.currentCategory = cat;
      this.filters.category = cat.label;
      if (filterBtn) filterBtn.innerHTML = `<i class="fas fa-th-large"></i> ${cat.label}`;
    }
    this.applyFilters();
  },
  
  showLocationFilter: function() {
    const locations = [...new Set(this.listings.map(l => l.location).filter(Boolean))];
    
    const modal = document.createElement('div');
    modal.className = 'modal location-filter-modal';
    modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.8) !important; display: flex !important; align-items: center; justify-content: center; z-index: 9999 !important;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px; width: 90%; background:#fff; border-radius:12px; padding:20px;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Filter by Location</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div style="max-height: 400px; overflow-y: auto;">
            <div class="filter-option" style="padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;" onclick="window.WW_APP.filterByLocation('Anywhere')"><strong>Anywhere</strong> <span style="float:right;color:#666;">${this.listings.length} listings</span></div>
            ${locations.map(location => {
              const count = this.listings.filter(l => l.location === location && this.isListingVisibleToUser(l)).length;
              return `<div class="filter-option" style="padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;" onclick="window.WW_APP.filterByLocation('${location}')"><strong>${location}</strong> <span style="float:right;color:#666;">${count} listings</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  
  filterByLocation: function(location) {
    this.filters.location = location;
    const filterBtn = $id('filterLocation');
    if (filterBtn) filterBtn.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${location}`;
    $$('.modal').forEach(m => m.remove());
    this.applyFilters();
  },
  
  showPriceFilter: function() {
    const priceRanges = [
      { label: 'Any price', min: 0, max: Infinity },
      { label: 'Under $1,000', min: 0, max: 1000 },
      { label: '$1,000 - $5,000', min: 1000, max: 5000 },
      { label: '$5,000 - $10,000', min: 5000, max: 10000 },
      { label: '$10,000 - $20,000', min: 10000, max: 20000 },
      { label: 'Over $20,000', min: 20000, max: Infinity }
    ];
    
    const modal = document.createElement('div');
    modal.className = 'modal price-filter-modal';
    modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.8) !important; display: flex !important; align-items: center; justify-content: center; z-index: 9999 !important;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px; width: 90%; background:#fff; border-radius:12px; padding:20px;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Filter by Price</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div style="max-height: 400px; overflow-y: auto;">
            ${priceRanges.map(range => {
              const count = this.listings.filter(listing => {
                if (!listing.price || listing.price === 'Price on request') return range.label === 'Any price';
                const price = parseInt(listing.price.replace(/[^0-9]/g, ''));
                return price >= range.min && price <= range.max;
              }).length;
              return `<div class="filter-option" style="padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;" onclick="window.WW_APP.filterByPrice('${range.label}')"><strong>${range.label}</strong> <span style="float:right;color:#666;">${count} listings</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  
  filterByPrice: function(priceRange) {
    this.filters.price = priceRange;
    const filterBtn = $id('filterPrice');
    if (filterBtn) filterBtn.innerHTML = `<i class="fas fa-tag"></i> ${priceRange}`;
    $$('.modal').forEach(m => m.remove());
    this.applyFilters();
  },
  
  showTypeFilter: function() {
    const types = ['All types', 'For Sale', 'For Rent', 'Services'];
    
    const modal = document.createElement('div');
    modal.className = 'modal type-filter-modal';
    modal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0,0,0,0.8) !important; display: flex !important; align-items: center; justify-content: center; z-index: 9999 !important;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px; width: 90%; background:#fff; border-radius:12px; padding:20px;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Filter by Type</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div style="max-height: 400px; overflow-y: auto;">
            ${types.map(type => {
              let count = 0;
              if (type === 'All types') count = this.listings.length;
              else if (type === 'For Sale') {
                count = this.listings.filter(l => ['sellingHouses', 'sellingFlats', 'cottagesToSale', 'residentialStands', 'farmPlots'].includes(l.category)).length;
              } else if (type === 'For Rent') {
                count = this.listings.filter(l => ['rentalsHouses', 'rentalsFlats', 'rentalsRooms', 'singleRoomsToRent', 'cottagesToRent', 'bnb', 'boardingHouses'].includes(l.category)).length;
              } else if (type === 'Services') {
                count = this.listings.filter(l => ['househelp', 'construction', 'boreholeServices', 'indriveDriver'].includes(l.category)).length;
              }
              return `<div class="filter-option" style="padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;" onclick="window.WW_APP.filterByType('${type}')"><strong>${type}</strong> <span style="float:right;color:#666;">${count} listings</span></div>`;
            }).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  
  filterByType: function(type) {
    this.filters.type = type;
    const filterBtn = $id('filterType');
    if (filterBtn) filterBtn.innerHTML = `<i class="fas fa-filter"></i> ${type}`;
    $$('.modal').forEach(m => m.remove());
    this.applyFilters();
  },
  
  applyFilters: function() {
    let filtered = [...this.listings];
    
    if (this.currentCategory) {
      filtered = filtered.filter(listing => listing.category === this.currentCategory.key);
    }
    
    if (this.filters.location !== 'Anywhere') {
      filtered = filtered.filter(listing => listing.location === this.filters.location);
    }
    
    if (this.filters.price !== 'Any price') {
      filtered = filtered.filter(listing => {
        if (!listing.price || listing.price === 'Price on request') return false;
        const price = parseInt(listing.price.replace(/[^0-9]/g, ''));
        switch(this.filters.price) {
          case 'Under $1,000': return price < 1000;
          case '$1,000 - $5,000': return price >= 1000 && price <= 5000;
          case '$5,000 - $10,000': return price >= 5000 && price <= 10000;
          case '$10,000 - $20,000': return price >= 10000 && price <= 20000;
          case 'Over $20,000': return price > 20000;
          default: return true;
        }
      });
    }
    
    if (this.filters.type !== 'All types') {
      filtered = filtered.filter(listing => {
        if (this.filters.type === 'For Sale') {
          return ['sellingHouses', 'sellingFlats', 'cottagesToSale', 'residentialStands', 'farmPlots'].includes(listing.category);
        } else if (this.filters.type === 'For Rent') {
          return ['rentalsHouses', 'rentalsFlats', 'rentalsRooms', 'singleRoomsToRent', 'cottagesToRent', 'bnb', 'boardingHouses'].includes(listing.category);
        } else if (this.filters.type === 'Services') {
          return ['househelp', 'construction', 'boreholeServices', 'indriveDriver'].includes(listing.category);
        }
        return true;
      });
    }
    
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(listing => 
        this._doesTextMatch(listing.title, search) ||
        this._doesTextMatch(listing.description, search) ||
        this._doesTextMatch(listing.location, search)
      );
    }
    
    filtered = filtered.filter(l => this.isListingVisibleToUser(l));
    
    this.filteredListings = filtered;
    
    if (this.currentCategory) {
      this.showFilteredListings(filtered, this.currentCategory.label, true);
    } else {
      this.showFilteredListings(filtered, 'Filtered', false);
    }
  },
  
  showAdvancedFilters: function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Advanced Filters</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Min Price</label>
            <input type="number" id="minPrice" placeholder="e.g., 1000" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
          </div>
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Max Price</label>
            <input type="number" id="maxPrice" placeholder="e.g., 10000" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
          </div>
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Date Posted</label>
            <select id="datePosted" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
              <option value="any">Any time</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>
          <div style="margin-bottom: 24px;">
            <label style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" id="showAdsOnly" style="width: 18px; height: 18px;">
              <span style="font-weight: 500;">Show promoted ads only</span>
            </label>
          </div>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-outline" id="resetAdvancedFilters" style="flex: 1;">Reset</button>
            <button class="btn btn-primary" id="applyAdvancedFilters" style="flex: 1;">Apply Filters</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#resetAdvancedFilters').addEventListener('click', () => {
      modal.querySelector('#minPrice').value = '';
      modal.querySelector('#maxPrice').value = '';
      modal.querySelector('#datePosted').value = 'any';
      modal.querySelector('#showAdsOnly').checked = false;
    });
    modal.querySelector('#applyAdvancedFilters').addEventListener('click', () => {
      const minPrice = modal.querySelector('#minPrice').value;
      const maxPrice = modal.querySelector('#maxPrice').value;
      const datePosted = modal.querySelector('#datePosted').value;
      const showAdsOnly = modal.querySelector('#showAdsOnly').checked;
      
      let filtered = [...this.listings];
      
      if (minPrice) {
        filtered = filtered.filter(listing => {
          if (!listing.price || listing.price === 'Price on request') return false;
          const price = parseInt(listing.price.replace(/[^0-9]/g, ''));
          return price >= parseInt(minPrice);
        });
      }
      if (maxPrice) {
        filtered = filtered.filter(listing => {
          if (!listing.price || listing.price === 'Price on request') return false;
          const price = parseInt(listing.price.replace(/[^0-9]/g, ''));
          return price <= parseInt(maxPrice);
        });
      }
      if (datePosted !== 'any') {
        const now = new Date();
        filtered = filtered.filter(listing => {
          if (!listing.createdAt) return false;
          const created = new Date(listing.createdAt);
          switch(datePosted) {
            case 'today': return created.toDateString() === now.toDateString();
            case 'week': return created >= new Date(now.getTime() - 7*24*60*60*1000);
            case 'month': return created >= new Date(now.getTime() - 30*24*60*60*1000);
            default: return true;
          }
        });
      }
      if (showAdsOnly) {
        filtered = filtered.filter(listing => listing.isAd);
      }
      
      filtered = filtered.filter(l => this.isListingVisibleToUser(l));
      
      this.filteredListings = filtered;
      this.showFilteredListings(filtered, 'Advanced Filter', false);
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  
  handleSearch: function(e) {
    this.searchTerm = e.target.value;
    this.applyFilters();
  },
  
  loadMoreListings: function() {
    showToast('Loading more listings...', 'info');
  },
  
  handleResize: function() {
    if (this.currentView === 'app') {
      if (this.currentCategory) {
        const filtered = this.listings.filter(listing => listing.category === this.currentCategory.key);
        this.showFilteredListings(filtered, this.currentCategory.label, true);
      } else {
        this.showAllListings();
      }
    }
  },
  
  // Install prompt related
  setupInstallPrompt: function() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallPromptIfAvailable();
    });
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      showToast('App installed successfully!', 'success');
    });
  },
  
  showInstallPromptIfAvailable: function() {
    if (this.deferredPrompt && !this.installPromptShown && !this.isAppInstalled()) {
      const installBanner = $id('installBanner');
      if (installBanner) {
        installBanner.style.display = 'flex';
        this.installPromptShown = true;
      }
    }
  },
  
  hideInstallPrompt: function() {
    const installBanner = $id('installBanner');
    if (installBanner) installBanner.style.display = 'none';
  },
  
  handleInstallClick: function() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          showToast('App installation started!', 'success');
        } else {
          showToast('App installation cancelled', 'info');
        }
        this.deferredPrompt = null;
        this.hideInstallPrompt();
      });
    } else {
      if (this.isAppInstalled()) {
        showToast('App is already installed.', 'info');
        return;
      }
      showToast('To install this app, use your browser menu (e.g., "Add to Home Screen").', 'info');
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
      modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; width: 90%;">
          <div class="modal-header"><h3>Install Walls</h3><button class="modal-close" style="background:none;border:none;font-size:20px;">×</button></div>
          <div class="modal-body">
            <p>This app can be installed for quick access.</p>
            <p><strong>On Android:</strong> Tap the menu (⋮) in Chrome and select "Add to Home screen".</p>
            <p><strong>On iPhone/iPad:</strong> Tap the share button and select "Add to Home Screen".</p>
            <p><strong>On Desktop:</strong> Look for the install icon in the address bar.</p>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }
  },
  
  showShareModal: function() {
    const modal = $id('shareModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  },
  
  closeShareModal: function() {
    const modal = $id('shareModal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = 'auto';
    }
  },
  
  handleShare: function(e) {
    const platform = e.currentTarget.getAttribute('data-platform');
    const url = window.location.href;
    const title = 'Walls - Property & Real Estate Marketplace';
    const text = 'Find your next home or property on Walls!';
    
    let shareUrl = '';
    switch(platform) {
      case 'whatsapp': shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`; break;
      case 'facebook': shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`; break;
      case 'twitter': shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`; break;
      case 'telegram': shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`; break;
      case 'copy':
        navigator.clipboard.writeText(url).then(() => { showToast('Link copied!', 'success'); this.closeShareModal(); }).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = url;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast('Link copied!', 'success');
          this.closeShareModal();
        });
        return;
    }
    if (shareUrl) {
      window.open(shareUrl, '_blank');
      this.closeShareModal();
    }
  },
  
  showInstallAppModal: function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Install Walls App</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 80px; height: 80px; background: #C8B897; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
              <i class="fas fa-home" style="font-size: 36px; color: white;"></i>
            </div>
            <h4 style="margin-bottom: 8px;">Walls</h4>
            <p style="color: #666;">Get the app for a better property search experience</p>
          </div>
          <div style="background: #f9f9f9; padding: 16px; border-radius: 12px; margin-bottom: 24px;">
            <h4 style="margin-bottom: 12px;">App Features:</h4>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="display: flex; align-items: center; gap: 8px; padding: 8px 0;"><i class="fas fa-check" style="color:#4CAF50;"></i> Faster loading</li>
              <li style="display: flex; align-items: center; gap: 8px; padding: 8px 0;"><i class="fas fa-check" style="color:#4CAF50;"></i> Offline access</li>
              <li style="display: flex; align-items: center; gap: 8px; padding: 8px 0;"><i class="fas fa-check" style="color:#4CAF50;"></i> Push notifications</li>
              <li style="display: flex; align-items: center; gap: 8px; padding: 8px 0;"><i class="fas fa-check" style="color:#4CAF50;"></i> Home screen access</li>
            </ul>
          </div>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-outline" id="cancelInstall" style="flex: 1;">Not Now</button>
            <button class="btn btn-primary" id="installApp" style="flex: 1;"><i class="fas fa-download"></i> Install App</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancelInstall').addEventListener('click', () => modal.remove());
    modal.querySelector('#installApp').addEventListener('click', () => {
      this.handleInstallClick();
      modal.remove();
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  
  // ============= REAL OAUTH IMPLEMENTATIONS =============

  loginWithGoogle: async function() {
    const cfg = window.WW_OAUTH || {};
    if (!cfg.GOOGLE_CLIENT_ID || cfg.GOOGLE_CLIENT_ID.indexOf('YOUR_') === 0) {
      showToast('Google login not configured. Set GOOGLE_CLIENT_ID in walls.js.', 'error');
      return;
    }
    try {
      await _wwLoadScript('https://accounts.google.com/gsi/client', 'gsi-client');
      const self = this;
      // Wait briefly for google global
      let tries = 0;
      while (!(window.google && google.accounts && google.accounts.id) && tries < 30) {
        await new Promise(r => setTimeout(r, 100)); tries++;
      }
      if (!window.google || !google.accounts || !google.accounts.id) {
        showToast('Google SDK failed to load.', 'error'); return;
      }
      google.accounts.id.initialize({
        client_id: cfg.GOOGLE_CLIENT_ID,
        callback: function(resp) {
          if (!resp || !resp.credential) {
            showToast('Google login cancelled.', 'error'); return;
          }
          // Decode JWT payload (id_token) for fallback profile
          let profile = {};
          try {
            const payload = JSON.parse(atob(resp.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            profile = { email: payload.email, name: payload.name, picture: payload.picture, sub: payload.sub };
          } catch (e) {}
          self._completeSocialLogin('google', resp.credential, profile);
        },
        auto_select: false,
        cancel_on_tap_outside: true
      });
      google.accounts.id.prompt(function(notification) {
        if (notification.isNotDisplayed && notification.isNotDisplayed()) {
          // Fallback: render a button-driven OAuth popup via OAuth2 token client
          try {
            const tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: cfg.GOOGLE_CLIENT_ID,
              scope: 'openid email profile',
              callback: async function(tokenResp) {
                if (!tokenResp || !tokenResp.access_token) { showToast('Google login cancelled.', 'error'); return; }
                try {
                  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: 'Bearer ' + tokenResp.access_token }
                  });
                  const profile = await r.json();
                  self._completeSocialLogin('google', tokenResp.access_token, profile);
                } catch (e) { showToast('Could not fetch Google profile.', 'error'); }
              }
            });
            tokenClient.requestAccessToken();
          } catch (e) { showToast('Google login unavailable.', 'error'); }
        }
      });
    } catch (e) {
      console.error(e);
      showToast('Could not load Google login.', 'error');
    }
  },

  // Facebook login removed — only Google + email are supported.


  loginWithEmail: function() {
    // "Continue with Email" — focus the existing email/password form
    const loginEmail = $id('loginEmail');
    const regEmail = $id('regEmail');
    if (loginEmail && document.getElementById('loginModal') && getComputedStyle(document.getElementById('loginModal')).display !== 'none') {
      loginEmail.focus();
      loginEmail.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (regEmail) {
      regEmail.focus();
      regEmail.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (loginEmail) {
      loginEmail.focus();
    }
    showToast('Enter your email and password to continue.', 'info');
  },

  _completeSocialLogin: async function(provider, token, profile) {
    profile = profile || {};
    const cfg = window.WW_OAUTH || {};
    const verifyUrl = provider === 'google' ? cfg.GOOGLE_VERIFY_URL : '';
    let serverUser = null;

    // Try backend verification first
    if (verifyUrl) {
      try {
        const r = await fetch(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token, profile: profile })
        });
        if (r.ok) {
          const data = await r.json();
          serverUser = data.user || data;
          if (data.token) localStorage.setItem('ww_token', data.token);
        }
      } catch (e) {
        console.warn('Social backend verify failed, falling back to local:', e);
      }
    }

    // Build/find local user record
    const email = (serverUser && serverUser.email) || profile.email || '';
    const name = (serverUser && serverUser.name) || profile.name || 'User';
    if (!email) { showToast('No email returned by ' + provider + '.', 'error'); return; }

    let user = this.allUsers.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
    if (!user) {
      user = {
        id: (serverUser && serverUser.id) || 'user_' + Date.now(),
        name: name,
        email: email,
        phone: (serverUser && serverUser.phone) || '',
        password: '',
        provider: provider,
        avatar: profile.picture && (profile.picture.data ? profile.picture.data.url : profile.picture) || '',
        isAdmin: !!(serverUser && serverUser.isAdmin),
        isBlocked: false,
        priority: 0,
        isLoggedIn: true,
        createdAt: new Date().toISOString()
      };
      this.allUsers.push(user);
    } else {
      user.provider = provider;
      if (!user.avatar && profile.picture) {
        user.avatar = profile.picture.data ? profile.picture.data.url : profile.picture;
      }
      if (serverUser && serverUser.isAdmin) user.isAdmin = true;
    }
    if (user.isBlocked) { showToast('Your account has been blocked. Contact support.', 'error'); return; }

    user.isLoggedIn = true;
    this.user = user;
    this.saveUsers();
    localStorage.setItem('ww_user', JSON.stringify(user));
    this.updateUserMenu();
    if (typeof closeLoginModal === 'function') closeLoginModal();
    if (typeof closeCreateAccountModal === 'function') closeCreateAccountModal();
    showToast('Signed in with ' + provider.charAt(0).toUpperCase() + provider.slice(1) + ', ' + (user.name || 'User') + '!', 'success');
    if (this.currentMode === 'sell') this.showSellerView();
  },

  _injectContinueWithEmailButton: function() {
    // No-op: the email login form lives directly inside the login/signup modals.
  },

  handleLoginSubmit: async function(e) {
    e.preventDefault();
    const rawEmail = ($id('loginEmail').value || '').trim();
    const password = ($id('loginPassword').value || '').trim();
    if (!rawEmail || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    const cfg = window.WW_OAUTH || {};
    const url = cfg.EMAIL_LOGIN_URL;
    const self = this;

    // 1) Try real backend if a URL is configured
    if (url && url.indexOf('YOUR_') !== 0) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: rawEmail, password: password })
        });
        if (resp.ok) {
          const data = await resp.json().catch(() => ({}));
          const serverUser = data.user || data;
          const user = {
            id: serverUser.id || ('user_' + Date.now()),
            name: serverUser.name || rawEmail.split('@')[0],
            email: serverUser.email || rawEmail,
            phone: serverUser.phone || '',
            isAdmin: !!serverUser.isAdmin,
            isBlocked: !!serverUser.isBlocked,
            priority: serverUser.priority || 0,
            isLoggedIn: true,
            authProvider: 'email',
            authToken: data.token || serverUser.token || '',
            createdAt: serverUser.createdAt || new Date().toISOString()
          };
          if (!self.allUsers.some(u => u.email === user.email)) {
            self.allUsers.push(user);
            self.saveUsers();
          }
          self.user = user;
          if (user.authToken) localStorage.setItem('ww_token', user.authToken);
          localStorage.setItem('ww_user', JSON.stringify(user));
          self.updateUserMenu();
          closeLoginModal();
          showToast(`Welcome back, ${user.name}!`, 'success');
          if (self.currentMode === 'sell') self.showSellerView();
          return;
        }
        if (resp.status === 401 || resp.status === 403) {
          showToast('Incorrect email or password', 'error');
          return;
        }
        // other errors -> fall through to local fallback
      } catch (err) {
        // network error -> fall through to local fallback
      }
    }

    // 2) Local fallback (demo / offline)
    const emailLc = rawEmail.toLowerCase();
    const phoneNorm = rawEmail.replace(/[\s\-()]/g, '');
    const user = this.allUsers.find(u => {
      const ue = (u.email || '').trim().toLowerCase();
      const up = (u.phone || '').replace(/[\s\-()]/g, '');
      return ue === emailLc || (up && up === phoneNorm);
    });
    if (!user) { showToast('User not found. Please create an account.', 'error'); return; }
    if ((user.password || '').trim() !== password) { showToast('Incorrect password', 'error'); return; }
    if (user.isBlocked) { showToast('Your account has been blocked. Contact support.', 'error'); return; }

    user.isLoggedIn = true;
    this.user = user;
    localStorage.setItem('ww_user', JSON.stringify(user));
    this.updateUserMenu();
    closeLoginModal();
    showToast(`Welcome back, ${user.name || 'User'}!`, 'success');
    if (this.currentMode === 'sell') this.showSellerView();
  },

  handleCreateAccountSubmit: async function(e) {
    e.preventDefault();
    const name = $id('regName').value.trim();
    const email = $id('regEmail').value.trim();
    const phone = $id('regPhone').value.trim();
    const password = $id('regPassword').value;

    if (!name || !email || !phone || !password) { showToast('Please fill in all fields', 'error'); return; }
    if (!this.isValidEmail(email)) { showToast('Please enter a valid email address', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (this.allUsers.some(u => u.email === email)) { showToast('An account with this email already exists', 'error'); return; }

    const cfg = window.WW_OAUTH || {};
    const url = cfg.EMAIL_REGISTER_URL;
    const self = this;
    let serverUser = null;
    let serverToken = '';

    if (url && url.indexOf('YOUR_') !== 0) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name, email: email, phone: phone, password: password })
        });
        if (resp.ok) {
          const data = await resp.json().catch(() => ({}));
          serverUser = data.user || data;
          serverToken = data.token || (serverUser && serverUser.token) || '';
        } else if (resp.status === 409) {
          showToast('An account with this email already exists', 'error'); return;
        }
        // other failures -> fall through to local fallback creation
      } catch (err) {
        // network error -> fall through to local fallback
      }
    }

    const newUser = {
      id: (serverUser && serverUser.id) || ('user_' + Date.now()),
      name: (serverUser && serverUser.name) || name,
      email: (serverUser && serverUser.email) || email,
      phone: (serverUser && serverUser.phone) || phone,
      password: password,
      isAdmin: !!(serverUser && serverUser.isAdmin),
      isBlocked: false,
      priority: 0,
      isLoggedIn: true,
      authProvider: 'email',
      authToken: serverToken,
      createdAt: new Date().toISOString()
    };

    this.allUsers.push(newUser);
    this.user = newUser;
    this.saveUsers();
    if (newUser.authToken) localStorage.setItem('ww_token', newUser.authToken);
    localStorage.setItem('ww_user', JSON.stringify(newUser));
    this.updateUserMenu();
    closeCreateAccountModal();
    showToast('Account created successfully!', 'success');
  },
  
  isValidEmail: function(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
  
  showProfile: function() {
    if (!this.user) {
      showToast('Please log in first', 'error');
      return;
    }
    const userDropdown = $id('userDropdown');
    if (userDropdown) userDropdown.style.display = 'none';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Your Profile</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <div style="text-align: center; margin-bottom: 24px;">
            <div id="profilePhotoPreview" style="width: 80px; height: 80px; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; overflow: hidden; font-size: 32px; color: #999;">
              ${this.user.profilePicture ? `<img src="${this.user.profilePicture}" style="width:100%;height:100%;object-fit:cover;">` : this.user.name ? this.user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <h4>${this.user.name || 'User'}</h4>
            <p style="color: #666;">${this.user.email}</p>
          </div>
          <div style="display: flex; gap: 12px;">
            <button class="btn btn-outline" id="editProfileBtn" style="flex: 1;">Edit Profile</button>
            <button class="btn btn-outline" id="changePasswordBtn" style="flex: 1;">Change Password</button>
          </div>
          <div style="margin-top: 16px;">
            <button class="btn btn-danger" id="deleteAccountBtn" style="width: 100%;">Delete Account</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#editProfileBtn').addEventListener('click', () => {
      modal.remove();
      this.showEditProfileForm();
    });
    modal.querySelector('#changePasswordBtn').addEventListener('click', () => {
      modal.remove();
      this.showChangePasswordForm();
    });
    modal.querySelector('#deleteAccountBtn').addEventListener('click', () => {
      modal.remove();
      this.deleteUserAccount();
    });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  
  showEditProfileForm: function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Edit Profile</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <form id="editProfileForm">
            <div class="form-group">
              <label>Name</label>
              <input type="text" id="editName" value="${this.user.name || ''}" required>
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="editEmail" value="${this.user.email || ''}" required>
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" id="editPhone" value="${this.user.phone || ''}">
            </div>
            <div class="form-group">
              <label>Profile Picture</label>
              <input type="file" id="profilePhotoInput" accept="image/*">
            </div>
            <button type="submit" class="btn btn-primary btn-block">Save Changes</button>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const photoInput = modal.querySelector('#profilePhotoInput');
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        this.user.profilePicture = ev.target.result;
        localStorage.setItem('ww_user', JSON.stringify(this.user));
        this.updateUserMenu();
      };
      reader.readAsDataURL(file);
    });
    
    modal.querySelector('#editProfileForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.user.name = modal.querySelector('#editName').value;
      this.user.email = modal.querySelector('#editEmail').value;
      this.user.phone = modal.querySelector('#editPhone').value;
      
      const idx = this.allUsers.findIndex(u => u.id === this.user.id);
      if (idx !== -1) {
        this.allUsers[idx] = this.user;
        this.saveUsers();
      }
      localStorage.setItem('ww_user', JSON.stringify(this.user));
      this.updateUserMenu();
      showToast('Profile updated', 'success');
      modal.remove();
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  
  showChangePasswordForm: function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px; width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">Change Password</h3>
          <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          <form id="changePasswordForm">
            <div class="form-group">
              <label>Current Password</label>
              <input type="password" id="currentPassword" required>
            </div>
            <div class="form-group">
              <label>New Password</label>
              <input type="password" id="newPassword" required minlength="6">
            </div>
            <div class="form-group">
              <label>Confirm New Password</label>
              <input type="password" id="confirmPassword" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Change Password</button>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#changePasswordForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const current = modal.querySelector('#currentPassword').value;
      const newPass = modal.querySelector('#newPassword').value;
      const confirm = modal.querySelector('#confirmPassword').value;
      
      if (this.user.password !== current) {
        showToast('Current password is incorrect', 'error');
        return;
      }
      if (newPass !== confirm) {
        showToast('New passwords do not match', 'error');
        return;
      }
      if (newPass.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
      }
      
      this.user.password = newPass;
      const idx = this.allUsers.findIndex(u => u.id === this.user.id);
      if (idx !== -1) {
        this.allUsers[idx].password = newPass;
        this.saveUsers();
      }
      localStorage.setItem('ww_user', JSON.stringify(this.user));
      showToast('Password changed successfully', 'success');
      modal.remove();
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  
  deleteUserAccount: function() {
    if (confirm('Are you sure you want to delete your account? This cannot be undone and all your listings will be removed.')) {
      this.listings = this.listings.filter(l => l.createdBy !== this.user.email);
      this.allUsers = this.allUsers.filter(u => u.id !== this.user.id);
      this.saveUsers();
      this.saveListingsToStorage();
      this.logout();
      showToast('Account deleted', 'info');
    }
  },
  
  showMyListings: function() {
    if (!this.user) {
      showToast('Please log in first', 'error');
      openLoginModal();
      return;
    }
    
    const userDropdown = $id('userDropdown');
    if (userDropdown) userDropdown.style.display = 'none';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px;';
    
    const userListings = this.listings.filter(l => l.createdBy === this.user.email);
    
    let listingsHTML = '';
    if (userListings.length === 0) {
      listingsHTML = '<p style="text-align:center; color:#666;">You have no listings yet.</p>';
    } else {
      listingsHTML = userListings.map(listing => {
        const isRental = this._getRentalCategories().includes(listing.category);
        const occupancyToggle = isRental ? `
          <button class="btn btn-outline" onclick="window.WW_APP.toggleOccupancy('${listing.id}')" style="padding:6px 12px; font-size:12px;">
            <i class="fas ${listing.occupancyStatus === 'occupied' ? 'fa-check-circle' : 'fa-bed'}"></i> ${listing.occupancyStatus === 'occupied' ? 'Mark Vacant' : 'Mark Occupied'}
          </button>` : '';
        return `
          <div style="background:white; border-radius:12px; padding:16px; margin-bottom:12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display:flex; gap:16px; align-items:center;">
            <div style="width:80px; height:80px; border-radius:8px; overflow:hidden; flex-shrink:0;">
              <img src="${listing.images && listing.images[0] ? listing.images[0] : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="100%" height="100%" fill="%23f5f5f5"/></svg>'}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div style="flex:1;">
              <h4 style="margin:0 0 4px 0;">${listing.title}</h4>
              <div style="font-size:14px; color:#666;">${this.formatPrice(listing)} · ${listing.location || ''}</div>
              ${listing.verificationStatus === 'pending' ? '<div style="color:#FF9800;font-size:12px;">Awaiting verification</div>' : ''}
              ${isRental ? `<div style="font-size:12px;margin-top:4px;"><span class="occ-badge ${listing.occupancyStatus === 'occupied' ? 'occ-occupied' : 'occ-vacant'}">${listing.occupancyStatus || 'vacant'}</span></div>` : ''}
              <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn btn-outline" onclick="window.WW_APP.editMyListing('${listing.id}')" style="padding:6px 12px; font-size:12px;"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger" onclick="window.WW_APP.deleteMyListing('${listing.id}')" style="padding:6px 12px; font-size:12px;"><i class="fas fa-trash"></i> Delete</button>
                ${occupancyToggle}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width:700px; width:100%; max-height:80vh; overflow-y:auto;">
        <div class="modal-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h3 style="margin:0;">My Listings</h3>
          <button class="modal-close" style="background:none; border:none; font-size:24px; cursor:pointer; color:#666;"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
          ${listingsHTML}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  
  toggleOccupancy: function(listingId) {
    const listing = this.listings.find(l => l.id === listingId && l.createdBy === this.user.email);
    if (!listing) {
      showToast('Listing not found or not yours', 'error');
      return;
    }
    listing.occupancyStatus = listing.occupancyStatus === 'occupied' ? 'vacant' : 'occupied';
    this.saveListingsToStorage();
    this.checkSavedSearchesForVacancies();
    showToast(`Listing marked as ${listing.occupancyStatus}`, 'success');
    const modal = document.querySelector('.modal');
    if (modal && modal.querySelector('.modal-body')) {
      this.showMyListings();
      modal.remove();
    }
  },
  
  editMyListing: function(listingId) {
    const listing = this.listings.find(l => l.id === listingId && l.createdBy === this.user.email);
    if (!listing) {
      showToast('Listing not found or not yours', 'error');
      return;
    }
    const isRental = this._getRentalCategories().includes(listing.category);
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    modal.innerHTML = `
      <div class="modal-content" style="max-width:600px; width:90%;">
        <div class="modal-header"><h3>Edit Listing</h3><button class="modal-close"><i class="fas fa-times"></i></button></div>
        <form id="editMyListingForm">
          <div class="form-group"><label>Title</label><input type="text" id="editTitle" value="${listing.title}" required></div>
          <div class="form-group"><label>Description</label><textarea id="editDescription" rows="3">${listing.description || ''}</textarea></div>
          <div class="form-row"><div class="form-group"><label>Price</label><input type="text" id="editPrice" value="${listing.price || ''}"></div><div class="form-group"><label>Location</label><input type="text" id="editLocation" value="${listing.location || ''}"></div></div>
          <div class="form-group"><label>Contact Phone</label><input type="tel" id="editPhone" value="${listing.contact?.phone || ''}"></div>
          <div class="form-group"><label>Contact Email</label><input type="email" id="editEmail" value="${listing.contact?.email || ''}"></div>
          ${isRental ? `
          <div class="form-group">
            <label>Occupancy Status</label>
            <select id="editOccupancy">
              <option value="vacant" ${listing.occupancyStatus === 'vacant' ? 'selected' : ''}>Vacant</option>
              <option value="occupied" ${listing.occupancyStatus === 'occupied' ? 'selected' : ''}>Occupied</option>
            </select>
          </div>` : ''}
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('#editMyListingForm').addEventListener('submit', (e) => {
      e.preventDefault();
      listing.title = modal.querySelector('#editTitle').value;
      listing.description = modal.querySelector('#editDescription').value;
      listing.price = modal.querySelector('#editPrice').value;
      listing.location = modal.querySelector('#editLocation').value;
      if (listing.contact) {
        listing.contact.phone = modal.querySelector('#editPhone').value;
        listing.contact.email = modal.querySelector('#editEmail').value;
      }
      if (isRental) {
        listing.occupancyStatus = modal.querySelector('#editOccupancy').value;
      }
      this.saveListingsToStorage();
      this.checkSavedSearchesForVacancies();
      showToast('Listing updated', 'success');
      modal.remove();
    });
    
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },
  
  deleteMyListing: function(listingId) {
    if (confirm('Delete this listing permanently?')) {
      this.listings = this.listings.filter(l => l.id !== listingId);
      this.saveListingsToStorage();
      showToast('Listing deleted', 'info');
      $$('.modal').forEach(m => m.remove());
    }
  },
  
  logout: function() {
    this.user = null;
    localStorage.removeItem('ww_user');
    this.updateUserMenu();
    showToast('Logged out successfully', 'info');
    this.switchToMode('buy');
  },
  
  requireLogin: function(action) {
    if (!this.user) {
      showToast(`Please log in to ${action}`, 'error');
      openLoginModal();
      return false;
    }
    return true;
  },
  
  updateUI: function() {
    this.updateNavHighlight();
    if (this.user) {
      this.updateUserMenu();
    }
  },
  
  // Bidding methods
  placeBid: function(listingId) {
    if (!this.user) {
      showToast('Please log in to place a bid', 'error');
      return;
    }
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) return;
    const now = Date.now();
    const endTime = listing.bidEndTime ? new Date(listing.bidEndTime).getTime() : now;
    if (endTime <= now) {
      showToast('Bidding has ended', 'error');
      return;
    }
    const amountEl = $id('bidAmount');
    const messageEl = $id('bidMessage');
    const amount = parseFloat(amountEl?.value);
    if (!amount || amount <= 0) {
      showToast('Please enter a valid bid amount', 'error');
      return;
    }
    const message = messageEl?.value || '';
    if (!listing.bids) listing.bids = [];
    listing.bids.push({
      id: 'bid_' + Date.now(),
      userId: this.user.id || this.user.email,
      userName: this.user.name || 'User',
      amount: amount,
      message: message,
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
    this.saveListingsToStorage();
    showToast('Bid placed successfully!', 'success');
    this.showListingDetails(listing);
  },
  
  acceptBid: function(listingId, bidId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing || !listing.bids) return;
    const bid = listing.bids.find(b => b.id === bidId);
    if (!bid) return;
    bid.status = 'accepted';
    listing.bids.forEach(b => { if (b.id !== bidId) b.status = 'rejected'; });
    this.saveListingsToStorage();
    showToast('Bid accepted!', 'success');
    this.showListingDetails(listing);
  },
  
  rejectBid: function(listingId, bidId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing || !listing.bids) return;
    const bid = listing.bids.find(b => b.id === bidId);
    if (!bid) return;
    bid.status = 'rejected';
    this.saveListingsToStorage();
    showToast('Bid rejected', 'info');
    this.showListingDetails(listing);
  },
  
  toggleBidListing: function(listingId) {
    const listing = this.listings.find(l => l.id === listingId);
    if (!listing) return;
    listing.bidEnabled = !listing.bidEnabled;
    if (listing.bidEnabled) {
      listing.bidEndTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      listing.bids = [];
    } else {
      listing.bidEndTime = null;
      listing.bids = [];
    }
    this.saveListingsToStorage();
    showToast(`Bidding ${listing.bidEnabled ? 'enabled' : 'disabled'} for this listing`, 'success');
    this.renderAdminListings($id('adminListingsSearch')?.value || '');
  }
};

// Initialize the app when DOM is ready
if (!window.WW_APP.initialized) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try { window.WW_APP.init(); } catch(e) { console.error('Failed to initialize app:', e); }
    });
  } else {
    try { window.WW_APP.init(); } catch(e) { console.error('Failed to initialize app:', e); }
  }
}

// Expose global functions
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openCreateAccountModal = openCreateAccountModal;
window.closeCreateAccountModal = closeCreateAccountModal;
window.showToast = showToast;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WW_APP: window.WW_APP, openLoginModal, closeLoginModal, openCreateAccountModal, closeCreateAccountModal, showToast };
}
