// Main Application Logic
const state = {
  currentPage: 'discover',
  user: {
    id: 'user_1',
    name: 'Mario Rossi',
    intent: 'relazione_stabile',
    isGold: false
  },
  mockProfiles: [
    {
      id: 'prof_1',
      name: 'Lucia',
      age: 58,
      city: 'Milano',
      distance: '15 km',
      affinityText: '90% Affinità',
      affinityEmoji: '✨',
      intent: 'Cerca convivenza',
      bio: 'Insegnante in pensione. Amo la musica classica, il giardinaggio e i cani. Cerco un compagno per viaggi culturali e serate tranquille.',
      tags: ['Musica Classica', 'Giardinaggio', 'Viaggi'],
      matchTags: ['Musica Classica', 'Viaggi'],
      image: 'file:///home/neffo/.gemini/antigravity/brain/e669e4a4-7212-4622-b394-82aefb32f26b/lucia_profile_1773830285516.png'
    },
    {
      id: 'prof_2',
      name: 'Anna',
      age: 62,
      city: 'Bergamo',
      distance: '28 km',
      affinityText: '75% Affinità',
      affinityEmoji: '👍',
      intent: 'Cerca relazione stabile',
      bio: 'Ex architetto, appassionata di pittura e musei. Pratico yoga e credo nel viver sano senza estremismi.',
      tags: ['Pittura', 'Yoga', 'Vino'],
      matchTags: ['Pittura'],
      image: 'https://images.unsplash.com/photo-1508214751196-bfd152914db9?w=500&h=700&fit=crop'
    }
  ],
  conversations: [
    {
      id: 'conv_1',
      partnerName: 'Paola',
      partnerImage: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=200&h=200&fit=crop',
      lastMessage: 'Hai mai visitato Firenze in questo periodo?',
      time: '10:42',
      unread: true
    }
  ]
};

// DOM Elements
const pages = {
  discover: () => renderDiscover(),
  messages: () => renderMessages(),
  profile: () => renderProfile(),
  help: () => renderHelp()
};

const mainContent = document.getElementById('main-content');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');

// Initialize App
function init() {
  feather.replace(); // Initialize icons
  
  // Set up navigation listeners
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      const tab = e.currentTarget.getAttribute('data-tab');
      navigateTo(tab);
    });
  });

  // Load initial page
  navigateTo('discover');
  
  // Initialize Socket.io (Mock connection per protocollo)
  // const socket = io('/chat', { auth: { token: 'mock_token' } });
  // socket.on('connect', () => console.log('WebSocket Connected'));
}

// Navigation Logic
function navigateTo(pageId) {
  state.currentPage = pageId;
  
  // Update Nav
  navItems.forEach(item => {
    if (item.getAttribute('data-tab') === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update Title & Render
  switch(pageId) {
    case 'discover': pageTitle.innerText = "Scopri"; break;
    case 'messages': pageTitle.innerText = "Messaggi"; break;
    case 'profile': pageTitle.innerText = "Il Mio Profilo"; break;
    case 'help': pageTitle.innerText = "Sicurezza"; break;
  }

  mainContent.innerHTML = '';
  const pageContent = pages[pageId]();
  if (pageContent) {
    mainContent.appendChild(pageContent);
    feather.replace(); // Re-render icons dynamically
  }
}

/* =========================================
   PAGES RENDERERS
   ========================================= */

// Discover Page (Swiping)
function renderDiscover() {
  const container = document.createElement('div');
  
  if (state.mockProfiles.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-feather="search"></i>
        <h2>Nessun Profilo Trovato</h2>
        <p class="mt-4">Hai esplorato tutti i profili nella tua zona. Riprova più tardi.</p>
        <button class="btn btn-secondary mt-4" style="width: auto" onclick="window.location.reload()">Aggiorna</button>
      </div>
    `;
    return container;
  }

  const profile = state.mockProfiles[0];

  const html = `
    <div class="card profile-card" id="current-profile">
      <div class="profile-image-container">
        <img src="${profile.image}" class="profile-image" alt="Foto di ${profile.name}">
        <div class="affinity-badge">
          ${profile.affinityEmoji} ${profile.affinityText}
        </div>
        
        <div class="profile-header-overlay">
          <h2 class="profile-name">${profile.name}, ${profile.age}</h2>
          <div class="profile-meta-overlay">
            <i data-feather="map-pin"></i> ${profile.city} (${profile.distance})
          </div>
        </div>
      </div>
      
      <div class="profile-info">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px">
          <i data-feather="target" style="color:var(--primary-color)"></i> 
          <strong style="color:var(--text-main); font-size:19px">${profile.intent}</strong>
        </div>
        
        <p class="profile-description">${profile.bio}</p>
        
        <div class="tag-container">
          ${profile.tags.map(tag => {
            const isMatch = profile.matchTags.includes(tag);
            return `<span class="tag ${isMatch ? 'match' : ''}">${isMatch ? '⭐ ' : ''}${tag}</span>`;
          }).join('')}
        </div>
      </div>
      
      <!-- Big Buttons Area -->
      <div class="action-buttons">
        <button class="btn-action btn-pass" onclick="handleSwipe('pass')" aria-label="Passa oltre (No)" title="Passa Oltre">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="m12 13-1-1 2-2-3-3 2-2"/></svg>
        </button>
        <button class="btn-action btn-undo" onclick="handleSwipe('undo')" aria-label="Annulla ultimo swipe" title="Annulla (Undo)">
          <i data-feather="rotate-ccw"></i>
        </button>
        <button class="btn-action btn-yes" onclick="handleSwipe('yes')" aria-label="Sì, mi piace" title="Sì">
          <i data-feather="heart"></i>
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;
  return container;
}

// Swipe Handler (Global scope for inline onclick, typically avoid in React but fine for Vanilla prototype)
window.handleSwipe = (action) => {
  if (action === 'undo') {
    alert("Funzione 'Annulla Errore' attivata. Hai ripristinato l'ultimo profilo.");
    return;
  }

  // Remove top profile
  state.mockProfiles.shift();
  
  if (action === 'yes') {
    // Show match mockup optionally
    console.log("Swipe YES registered per backend API /matching/swipe");
    if (state.mockProfiles.length === 0) {
      alert("It's a Match! (Simulato)");
    }
  }

  // Re-render
  navigateTo('discover');
};

// Messages Page
function renderMessages() {
  const container = document.createElement('div');
  
  if (state.conversations.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-feather="message-square"></i>
        <h2>Nessun Messaggio</h2>
        <p class="mt-4">Fai "Sì" sui profili per creare dei Match e iniziare a chattare.</p>
      </div>
    `;
    return container;
  }

  const list = state.conversations.map(conv => `
    <div class="chat-list-item" onclick="openChat('${conv.id}')">
      <img src="${conv.partnerImage}" class="chat-avatar" alt="${conv.partnerName}">
      <div class="chat-info">
        <div class="chat-name">${conv.partnerName}</div>
        <div class="chat-preview" style="${conv.unread ? 'font-weight:700; color:var(--text-main);' : ''}">${conv.lastMessage}</div>
      </div>
      <div class="chat-time">${conv.time}</div>
    </div>
  `).join('');

  container.innerHTML = `<div class="card" style="padding:0; overflow:hidden;">${list}</div>`;
  return container;
}

window.openChat = (convId) => {
  alert("Apertura chat. In questa schermata si abiliterà il 'Safe-Call' e verranno mostrati gli 'Icebreakers'.");
};

// Profile Page
function renderProfile() {
  const container = document.createElement('div');
  
  container.innerHTML = `
    <div class="card text-center">
      <div class="profile-image-container" style="width:120px; height:120px; border-radius:50%; margin:0 auto 16px; overflow:hidden; border: 4px solid var(--border-color)">
        <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop" style="width:100%; height:100%; object-fit:cover;" alt="Il tuo profilo">
      </div>
      <h2>${state.user.name} <i data-feather="check-circle" style="color:var(--primary-color)" title="Profilo Verificato"></i></h2>
      <p style="color:var(--text-muted); font-size:16px;">Abbonamento: <strong style="color:var(--nav-inactive)">Free</strong></p>
      <button class="btn btn-secondary mt-4" style="color:var(--accent-color); border-color:var(--accent-color)"><i data-feather="star"></i> Passa a Gold</button>
    </div>

    <div class="card">
      <h3 class="mb-6">Le mie Preferenze</h3>
      <div class="form-group">
        <label class="form-label">Cosa cerchi? (Intenzionalità)</label>
        <select class="form-control">
          <option value="convivenza">Convivenza</option>
          <option value="relazione_stabile" selected>Relazione Stabile</option>
          <option value="amicizia">Amicizia</option>
          <option value="vediamo">Vediamo come va</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Biografia</label>
        <textarea class="form-control" rows="4">Sono un uomo sportivo...</textarea>
      </div>
      <button class="btn btn-primary">Salva Modifiche</button>
    </div>
  `;
  return container;
}

// Help & Security Page
function renderHelp() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="card" style="background-color: #E3F2FD; border-color: #BBDEFB;">
      <h3 style="color: #1565C0; display:flex; align-items:center; gap:8px;" class="mb-4">
        <i data-feather="shield"></i> Sicurezza Prima di Tutto
      </h3>
      <p style="font-size: 16px; color: #1565C0;">Second Bloom protegge i tuoi dati e ti permette di conoscere persone autentiche, verificate dal nostro sistema biometrico.</p>
    </div>

    <div class="card">
      <h3 class="mb-4">Pulsante Famiglia</h3>
      <p class="mb-4" style="color: var(--text-muted);">Invia i dettagli del tuo Match a un contatto di fiducia prima del tuo appuntamento.</p>
      <button class="btn btn-secondary"><i data-feather="share-2"></i> Configura Contatto</button>
    </div>

    <div class="card">
      <h3 class="mb-4">Assistente Onboarding</h3>
      <p class="mb-4" style="color: var(--text-muted);">Hai dubbi su come caricare le foto o compilare il profilo?</p>
      <button class="btn btn-secondary"><i data-feather="video"></i> Guarda Video Guida</button>
    </div>
  `;
  return container;
}

// Boot
window.addEventListener('DOMContentLoaded', init);
