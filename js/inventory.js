import { audio } from './audio.js';

/* ==========================================================================
   DO OR DIE — Inventory System Module (Survival Satchel & Architectural Map)
   ========================================================================== */

export class InventorySystem {
  constructor(onInventoryChange) {
    this.items = [];
    this.onInventoryChange = onInventoryChange;
    this.isOpen = false;
    this.controls = null;
    this.activeTab = 'items'; // 'items' or 'map'
    this.currentFloorNumber = 3;

    // DOM Elements
    this.modalEl = document.getElementById('inventory-modal');
    this.slotsContainer = document.getElementById('inventory-modal-slots');
    this.mapContainer = document.getElementById('inventory-map-view');
    this.closeBtn = document.getElementById('inventory-close-btn');
    this.tabSubtitle = document.getElementById('inv-tab-subtitle');
    this.tabBtnItems = document.getElementById('tab-btn-items');
    this.tabBtnMap = document.getElementById('tab-btn-map');
    this.toastContainer = document.getElementById('pickup-toast');
    this.toastText = document.getElementById('toast-text');

    this.initEventListeners();
    this.render();
  }

  setControls(controls) {
    this.controls = controls;
  }

  setCurrentFloor(floorNum) {
    this.currentFloorNumber = floorNum;
    if (this.isOpen && this.activeTab === 'map') {
      this.renderMap();
    }
  }

  initEventListeners() {
    // Close button
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Backdrop click closes inventory
    if (this.modalEl) {
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) {
          this.close();
        }
      });
    }

    // Tab buttons
    if (this.tabBtnItems) {
      this.tabBtnItems.addEventListener('click', () => this.switchTab('items'));
    }
    if (this.tabBtnMap) {
      this.tabBtnMap.addEventListener('click', () => this.switchTab('map'));
    }

    // Escape key closes inventory if currently open
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  switchTab(tab) {
    this.activeTab = tab;
    audio.playKeypadBeep(520);

    if (this.tabBtnItems) {
      this.tabBtnItems.classList.toggle('active', tab === 'items');
    }
    if (this.tabBtnMap) {
      this.tabBtnMap.classList.toggle('active', tab === 'map');
    }

    if (tab === 'items') {
      if (this.slotsContainer) this.slotsContainer.style.display = 'flex';
      if (this.mapContainer) this.mapContainer.style.display = 'none';
      if (this.tabSubtitle) {
        this.tabSubtitle.innerHTML = `Collected keys, keycards &amp; survival equipment &bull; Press <kbd>TAB</kbd> or <kbd>I</kbd> to close`;
      }
      this.render();
    } else {
      if (this.slotsContainer) this.slotsContainer.style.display = 'none';
      if (this.mapContainer) this.mapContainer.style.display = 'flex';
      if (this.tabSubtitle) {
        this.tabSubtitle.innerHTML = `Hospital Architectural Blueprint &bull; Active Floor Schematic &bull; Press <kbd>TAB</kbd> or <kbd>I</kbd> to close`;
      }
      this.renderMap();
    }
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    audio.playItemPickup(); // Audio click feedback

    if (this.modalEl) {
      this.modalEl.classList.add('open');
      this.modalEl.classList.add('active');
    }

    if (this.activeTab === 'items') {
      this.render();
    } else {
      this.renderMap();
    }
  }

  close() {
    this.isOpen = false;
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
      this.modalEl.classList.remove('active');
    }
  }

  addItem(item) {
    if (this.hasItem(item.id)) return false;

    this.items.push({
      id: item.id,
      name: item.name,
      icon: item.icon || '🔑',
      description: item.description || ''
    });

    this.showToast(`+ ACQUIRED: ${item.name} (Press TAB to inspect)`);
    this.render();

    if (this.onInventoryChange) {
      this.onInventoryChange(this.items);
    }
    return true;
  }

  removeItem(itemId) {
    const idx = this.items.findIndex(it => it.id === itemId);
    if (idx !== -1) {
      const removed = this.items.splice(idx, 1)[0];
      this.render();
      if (this.onInventoryChange) {
        this.onInventoryChange(this.items);
      }
      return removed;
    }
    return null;
  }

  hasItem(itemId) {
    return this.items.some(it => it.id === itemId);
  }

  getItem(itemId) {
    return this.items.find(it => it.id === itemId);
  }

  showToast(text) {
    if (!this.toastContainer || !this.toastText) return;
    this.toastText.textContent = text;
    this.toastContainer.classList.add('show');

    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toastContainer.classList.remove('show');
    }, 3200);
  }

  render() {
    if (!this.slotsContainer) return;
    this.slotsContainer.innerHTML = '';

    if (this.items.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'inv-empty-state';
      emptyState.innerHTML = `
        <span class="inv-empty-icon">🎒</span>
        <h3>SATCHEL IS EMPTY</h3>
        <p>Search hospital rooms, bedside lockers, and medical carts for keys and equipment.</p>
      `;
      this.slotsContainer.appendChild(emptyState);
      return;
    }

    this.items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'inv-card-item';
      card.innerHTML = `
        <div class="inv-card-badge">${item.icon}</div>
        <div class="inv-card-info">
          <div class="inv-card-name">${item.name}</div>
          <div class="inv-card-desc">${item.description}</div>
        </div>
        <div class="inv-card-status">READY</div>
      `;
      this.slotsContainer.appendChild(card);
    });
  }

  renderMap() {
    if (!this.mapContainer) return;

    let svgContent = '';
    const floor = this.currentFloorNumber;

    if (floor === 3) {
      // Floor 1 (Trauma Ward) Blueprint: Room 101, Diagnostics 102, Engineering 103, Nurse Command, Blast Gate
      svgContent = `
        <svg viewBox="0 0 600 320" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(56, 189, 248, 0.08)" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="#050811"/>
          <rect width="100%" height="100%" fill="url(#grid)"/>

          <!-- Header Title -->
          <text x="30" y="32" fill="#38bdf8" font-family="JetBrains Mono" font-size="14" font-weight="bold" letter-spacing="2">HOSPITAL LEVEL 1 — TRAUMA &amp; POWER MATRIX</text>
          <text x="30" y="50" fill="#64748b" font-family="JetBrains Mono" font-size="10">LEVEL SCHEMATIC &bull; SECURE EMERGENCY PROTOCOL</text>

          <!-- Central Corridor -->
          <rect x="250" y="65" width="100" height="205" fill="rgba(15, 23, 42, 0.9)" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="300" y="165" fill="#64748b" font-family="JetBrains Mono" font-size="11" text-anchor="middle">CORRIDOR</text>

          <!-- North Fire Barrier -->
          <rect x="250" y="65" width="100" height="15" fill="rgba(239, 68, 68, 0.3)" stroke="#ef4444" stroke-width="1.5"/>
          <text x="300" y="76" fill="#fca5a5" font-family="JetBrains Mono" font-size="8" font-weight="bold" text-anchor="middle">FIRE HAZARD</text>

          <!-- Room 101: Trauma Suite (Start Room - West North) -->
          <rect x="60" y="65" width="190" height="95" fill="rgba(30, 41, 59, 0.7)" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="155" y="105" fill="#f8fafc" font-family="JetBrains Mono" font-size="12" font-weight="bold" text-anchor="middle">TRAUMA SUITE 101</text>
          <text x="155" y="122" fill="#38bdf8" font-family="JetBrains Mono" font-size="9" text-anchor="middle">★ TIER-1 PASS &bull; CLUE (52--)</text>

          <!-- Nurse Command & Mainframe (West South) -->
          <rect x="60" y="170" width="190" height="100" fill="rgba(14, 165, 233, 0.12)" stroke="#0ea5e9" stroke-width="1.5"/>
          <text x="155" y="215" fill="#e0f2fe" font-family="JetBrains Mono" font-size="12" font-weight="bold" text-anchor="middle">NURSE COMMAND</text>
          <text x="155" y="232" fill="#38bdf8" font-family="JetBrains Mono" font-size="9" text-anchor="middle">★ BLAST OVERRIDE TERMINAL</text>

          <!-- Room 102: Diagnostics Lab (East North) -->
          <rect x="350" y="65" width="190" height="95" fill="rgba(16, 185, 129, 0.12)" stroke="#10b981" stroke-width="1.5"/>
          <text x="445" y="105" fill="#a7f3d0" font-family="JetBrains Mono" font-size="12" font-weight="bold" text-anchor="middle">DIAGNOSTICS 102</text>
          <text x="445" y="122" fill="#34d399" font-family="JetBrains Mono" font-size="9" text-anchor="middle">★ TERMINAL CIPHER (--89)</text>

          <!-- Room 103: Engineering Vault (East South) -->
          <rect x="350" y="170" width="190" height="100" fill="rgba(245, 158, 11, 0.12)" stroke="#f59e0b" stroke-width="1.5"/>
          <text x="445" y="215" fill="#fde68a" font-family="JetBrains Mono" font-size="12" font-weight="bold" text-anchor="middle">ENGINEERING 103</text>
          <text x="445" y="232" fill="#f59e0b" font-family="JetBrains Mono" font-size="9" text-anchor="middle">⚡ AUXILIARY POWER REACTOR</text>

          <!-- South Blast Gate & Stairs to Floor 2 -->
          <rect x="250" y="270" width="100" height="40" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="2"/>
          <text x="300" y="295" fill="#34d399" font-family="JetBrains Mono" font-size="10" font-weight="bold" text-anchor="middle">BLAST GATES &amp; STAIRS &darr;</text>

          <!-- Doorways -->
          <line x1="250" y1="105" x2="250" y2="125" stroke="#10b981" stroke-width="4"/> <!-- R101 Door (Open) -->
          <line x1="350" y1="105" x2="350" y2="125" stroke="#10b981" stroke-width="4"/> <!-- R102 Door (Open) -->
          <line x1="350" y1="210" x2="350" y2="230" stroke="#f59e0b" stroke-width="4"/> <!-- R103 Door (Tier-1 Lock) -->
          <line x1="250" y1="205" x2="250" y2="235" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4,4"/> <!-- Nurse Counter -->
          <line x1="265" y1="270" x2="335" y2="270" stroke="#ef4444" stroke-width="4"/> <!-- Exit Blast Gate -->

          <!-- Player Location Marker (Inside Room 101) -->
          <circle cx="155" cy="112" r="7" fill="#38bdf8">
            <animate attributeName="r" values="6;10;6" dur="1.8s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          <circle cx="155" cy="112" r="4" fill="#ffffff"/>
        </svg>
      `;
    } else if (floor === 2) {
      // Floor 2 Blueprint: ICU 201, Utility 203, Bio-Lab 202, Stairwell A
      svgContent = `
        <svg viewBox="0 0 600 320" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid2" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(6, 182, 212, 0.08)" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="#050811"/>
          <rect width="100%" height="100%" fill="url(#grid2)"/>

          <text x="30" y="32" fill="#06b6d4" font-family="JetBrains Mono" font-size="14" font-weight="bold" letter-spacing="2">HOSPITAL FLOOR 2 — ICU &amp; BIO-RESEARCH LAB</text>
          <text x="30" y="50" fill="#64748b" font-family="JetBrains Mono" font-size="10">LEVEL SCHEMATIC &bull; BIO-HAZARD PURGE LEVEL</text>

          <!-- Corridor -->
          <rect x="250" y="70" width="100" height="200" fill="rgba(15, 23, 42, 0.9)" stroke="#06b6d4" stroke-width="1.5"/>
          <text x="300" y="175" fill="#64748b" font-family="JetBrains Mono" font-size="11" text-anchor="middle">CORRIDOR</text>

          <!-- ICU 201 (West North) -->
          <rect x="80" y="70" width="170" height="95" fill="rgba(6, 182, 212, 0.12)" stroke="#06b6d4" stroke-width="1.5"/>
          <text x="165" y="115" fill="#67e8f9" font-family="JetBrains Mono" font-size="12" font-weight="bold" text-anchor="middle">ICU 201</text>
          <text x="165" y="132" fill="#06b6d4" font-family="JetBrains Mono" font-size="9" text-anchor="middle">★ LAB KEYCARD B</text>

          <!-- Utility 203 (West South - Toxic Gas) -->
          <rect x="80" y="175" width="170" height="95" fill="rgba(239, 68, 68, 0.12)" stroke="#ef4444" stroke-width="1.5"/>
          <text x="165" y="220" fill="#fca5a5" font-family="JetBrains Mono" font-size="12" font-weight="bold" text-anchor="middle">UTILITY 203</text>
          <text x="165" y="237" fill="#ef4444" font-family="JetBrains Mono" font-size="9" text-anchor="middle">★ PRESSURE RELIEF VALVE</text>

          <!-- Research Lab 202 (East) -->
          <rect x="350" y="70" width="170" height="150" fill="rgba(16, 185, 129, 0.12)" stroke="#10b981" stroke-width="1.5"/>
          <text x="435" y="140" fill="#6ee7b7" font-family="JetBrains Mono" font-size="12" font-weight="bold" text-anchor="middle">LAB 202</text>
          <text x="435" y="157" fill="#10b981" font-family="JetBrains Mono" font-size="9" text-anchor="middle">★ MAINFRAME CONSOLE (8426)</text>

          <!-- Stairwell A Exit North (leads down to Ground Floor 1) -->
          <rect x="250" y="270" width="100" height="40" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="2"/>
          <text x="300" y="295" fill="#34d399" font-family="JetBrains Mono" font-size="10" font-weight="bold" text-anchor="middle">STAIRWELL A &darr;</text>

          <!-- Player Location Marker -->
          <circle cx="300" cy="90" r="7" fill="#06b6d4">
            <animate attributeName="r" values="6;10;6" dur="1.8s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          <circle cx="300" cy="90" r="4" fill="#ffffff"/>
        </svg>
      `;
    } else {
      // Floor 1 Blueprint: Triage Lobby, Security Command, Pharmacy Dispensary, Courtyard Exit
      svgContent = `
        <svg viewBox="0 0 600 320" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid1" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(245, 158, 11, 0.08)" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="#050811"/>
          <rect width="100%" height="100%" fill="url(#grid1)"/>

          <text x="30" y="32" fill="#fbbf24" font-family="JetBrains Mono" font-size="14" font-weight="bold" letter-spacing="2">HOSPITAL FLOOR 1 — GRAND LOBBY &amp; EVACUATION BAY</text>
          <text x="30" y="50" fill="#64748b" font-family="JetBrains Mono" font-size="10">GROUND LEVEL &bull; EMERGENCY EVACUATION PERIMETER</text>

          <!-- Triage Grand Lobby -->
          <rect x="200" y="70" width="200" height="140" fill="rgba(15, 23, 42, 0.9)" stroke="#fbbf24" stroke-width="1.5"/>
          <circle cx="300" cy="140" r="32" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" stroke-width="1.2"/>
          <text x="300" y="144" fill="#fde68a" font-family="JetBrains Mono" font-size="9" font-weight="bold" text-anchor="middle">TRIAGE DISPATCH</text>

          <!-- Security Command (West Wing) -->
          <rect x="50" y="70" width="150" height="110" fill="rgba(56, 189, 248, 0.12)" stroke="#38bdf8" stroke-width="1.5"/>
          <text x="125" y="120" fill="#7dd3fc" font-family="JetBrains Mono" font-size="12" font-weight="bold" text-anchor="middle">SECURITY</text>
          <text x="125" y="137" fill="#38bdf8" font-family="JetBrains Mono" font-size="9" text-anchor="middle">⚡ 3-PHASE RELAYS</text>

          <!-- Pharmacy & Dispensary (East Wing) -->
          <rect x="400" y="70" width="150" height="110" fill="rgba(16, 185, 129, 0.12)" stroke="#10b981" stroke-width="1.5"/>
          <text x="475" y="120" fill="#6ee7b7" font-family="JetBrains Mono" font-size="12" font-weight="bold" text-anchor="middle">PHARMACY</text>
          <text x="475" y="137" fill="#10b981" font-family="JetBrains Mono" font-size="9" text-anchor="middle">★ SAFE (7412) &bull; KEYCARD</text>

          <!-- Courtyard Ambulance Evacuation Bay (North) -->
          <rect x="180" y="220" width="240" height="85" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" stroke-width="2"/>
          <text x="300" y="255" fill="#34d399" font-family="JetBrains Mono" font-size="13" font-weight="bold" text-anchor="middle">COURTYARD AMBULANCE BAY</text>
          <text x="300" y="275" fill="#ffffff" font-family="JetBrains Mono" font-size="10" text-anchor="middle">🚑 FINAL EVACUATION ESCAPE</text>

          <!-- Player Location Marker -->
          <circle cx="300" cy="95" r="7" fill="#fbbf24">
            <animate attributeName="r" values="6;10;6" dur="1.8s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="1;0.4;1" dur="1.8s" repeatCount="indefinite"/>
          </circle>
          <circle cx="300" cy="95" r="4" fill="#ffffff"/>
        </svg>
      `;
    }

    this.mapContainer.innerHTML = `
      <div class="map-svg-wrap">
        ${svgContent}
      </div>
      <div class="map-legend">
        <div class="legend-item"><span class="legend-dot player"></span> Current Location</div>
        <div class="legend-item"><span class="legend-dot obj"></span> Key Objective</div>
        <div class="legend-item"><span class="legend-dot locked"></span> Locked Door / Keypad</div>
        <div class="legend-item"><span class="legend-dot open"></span> Unlocked Passage</div>
      </div>
    `;
  }
}
