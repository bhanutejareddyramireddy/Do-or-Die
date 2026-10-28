import * as THREE from 'three';

/* ==========================================================================
   DO OR DIE — Interaction System Module
   ========================================================================== */

export class InteractionSystem {
  constructor(camera, interactiveObjects, onInteract) {
    this.camera = camera;
    this.interactiveObjects = interactiveObjects || [];
    this.onInteract = onInteract;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 3.8; // Maximum interaction reach distance (meters)
    this.center = new THREE.Vector2(0, 0); // Center of screen for crosshair raycast

    this.currentObject = null;
    this.isModalOpen = false;

    // DOM Elements
    this.promptEl = document.getElementById('interaction-prompt');
    this.promptText = document.getElementById('prompt-text');
    this.promptKey = document.getElementById('prompt-key');
    this.modalEl = document.getElementById('interaction-modal');
    this.modalTitle = document.getElementById('modal-title');
    this.modalBody = document.getElementById('modal-body');
    this.modalCloseBtn = document.getElementById('modal-close-btn');
    this.mobileInteractBtn = document.getElementById('mobile-interact-btn');

    this.initEventListeners();
  }

  setInteractiveObjects(objects) {
    this.interactiveObjects = objects;
  }

  initEventListeners() {
    // Desktop E key
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E') {
        if (this.isModalOpen) {
          this.closeModal();
        } else if (this.currentObject) {
          this.triggerInteraction(this.currentObject);
        }
      } else if (e.code === 'Escape' && this.isModalOpen) {
        this.closeModal();
      }
    });

    // Left Mouse Click interaction when aiming at an interactive object
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0 && !this.isModalOpen && this.currentObject) {
        const isUI = e.target.closest('#interaction-modal') ||
                     e.target.closest('#keypad-puzzle-modal') ||
                     e.target.closest('#reactor-puzzle-modal') ||
                     e.target.closest('#pressure-puzzle-modal') ||
                     e.target.closest('#chemical-puzzle-modal') ||
                     e.target.closest('#circuit-puzzle-modal') ||
                     e.target.closest('#inventory-modal') ||
                     e.target.closest('#pause-modal') ||
                     e.target.closest('#landing-page') ||
                     e.target.closest('#floor-clear-modal') ||
                     e.target.closest('#game-over-modal') ||
                     e.target.closest('#mobile-controls') ||
                     e.target.tagName === 'BUTTON';
        if (!isUI) {
          this.triggerInteraction(this.currentObject);
        }
      }
    });

    // Modal Close Button
    if (this.modalCloseBtn) {
      this.modalCloseBtn.addEventListener('click', () => this.closeModal());
    }

    // Mobile Interact Button
    if (this.mobileInteractBtn) {
      this.mobileInteractBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentObject) {
          this.triggerInteraction(this.currentObject);
        }
      });
    }
  }

  update() {
    if (this.isModalOpen) {
      this.hidePrompt();
      return;
    }

    // Cast ray from camera center
    this.raycaster.setFromCamera(this.center, this.camera);
    
    // Filter out interactive meshes
    const meshes = this.interactiveObjects.map(obj => obj.mesh || obj).filter(Boolean);
    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object;
      // Find matching interactive data (traverse parents if hit child mesh or handle)
      const found = this.interactiveObjects.find(item => {
        const targetMesh = item.mesh || item;
        if (!targetMesh) return false;
        if (targetMesh === hitMesh) return true;
        let curr = hitMesh;
        while (curr) {
          if (curr === targetMesh) return true;
          curr = curr.parent;
        }
        return false;
      });

      if (found) {
        this.currentObject = found;
        const promptText = found.prompt || (found.userData?.interaction?.prompt) || `Press E to interact with ${found.name || 'Object'}`;
        this.showPrompt(promptText);
        return;
      }
    }

    // No target in view
    this.currentObject = null;
    this.hidePrompt();
  }


  showPrompt(actionText) {
    if (!this.promptEl) return;
    this.promptText.textContent = actionText;
    this.promptEl.classList.add('visible');

    const crosshair = document.getElementById('crosshair');
    if (crosshair) crosshair.classList.add('interactive');

    if (this.mobileInteractBtn) {
      this.mobileInteractBtn.classList.add('active');
    }
  }

  hidePrompt() {
    if (!this.promptEl) return;
    this.promptEl.classList.remove('visible');

    const crosshair = document.getElementById('crosshair');
    if (crosshair) crosshair.classList.remove('interactive');

    if (this.mobileInteractBtn) {
      this.mobileInteractBtn.classList.remove('active');
    }
  }

  triggerInteraction(item) {
    if (item.onInteract) {
      item.onInteract(item);
    } else {
      this.openModal(item.name, item.description || item.content);
    }

    if (this.onInteract) {
      this.onInteract(item);
    }
  }

  openModal(title, content) {
    if (!this.modalEl) return;
    this.isModalOpen = true;
    this.modalTitle.textContent = title;
    this.modalBody.innerHTML = content;
    this.modalEl.classList.add('open');
    this.hidePrompt();
  }

  closeModal() {
    if (!this.modalEl) return;
    this.isModalOpen = false;
    this.modalEl.classList.remove('open');
    if (typeof this.onModalClose === 'function') {
      this.onModalClose();
    }
  }
}
