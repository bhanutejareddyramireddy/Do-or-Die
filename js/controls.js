import * as THREE from 'three';

/* ==========================================================================
   DO OR DIE — Controls Module (Desktop Mouse Look + Keyboard Turn + Mobile)
   ========================================================================== */

export class ControlsManager {
  constructor(camera, domElement, onLockChange) {
    this.camera = camera;
    this.domElement = domElement || document.body;
    this.onLockChange = onLockChange;

    // Direct, authoritative camera angles (in radians)
    // Starting yaw: -Math.PI / 2 (facing +X down Room 301 into corridor)
    this.yaw = -Math.PI / 2;
    this.pitch = 0;

    // Locomotion input flags
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.isSprinting = false;

    // Keyboard camera turning flags (allows rotation on laptop trackpads while holding W / Shift)
    this.turnLeft = false;
    this.turnRight = false;
    this.turnSpeed = 2.6; // Radians per second

    // Pointer Lock & Active state
    this.isGameActive = false;
    this.isLocked = false;
    this.isMouseDown = false;
    this.lastMouseX = null;
    this.lastMouseY = null;

    // Mobile touch input (-1 to 1)
    this.joystickInput = new THREE.Vector2(0, 0);
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    // Joystick inversion preference (persisted)
    this.invertY = localStorage.getItem('dod_invert_joystick_y') === 'true';
    this.invertX = false;

    // Flashlight toggle hook
    this.onFlashlightToggle = null;
    this.isModalActive = false;
    this.applyRotation();

    this.initDesktopControls();
    this.initMobileControls();

    // Global hook to toggle inversion anytime
    window.toggleJoystickInvertY = () => {
      this.invertY = !this.invertY;
      localStorage.setItem('dod_invert_joystick_y', this.invertY);
      const btn = document.getElementById('invert-joy-btn');
      if (btn) btn.classList.toggle('active', this.invertY);
      return this.invertY;
    };
  }

  setRotation(yaw, pitch = 0) {
    this.yaw = yaw;
    this.pitch = pitch;
    this.applyRotation();
  }

  applyRotation() {
    // Pitch clamping: don't look past straight up (+83 deg) or straight down (-83 deg)
    const maxPitch = Math.PI / 2.15;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateMatrix();
    this.camera.updateMatrixWorld();
  }

  rotateCamera(deltaYaw, deltaPitch) {
    this.yaw -= deltaYaw;
    this.pitch -= deltaPitch;
    this.applyRotation();
  }

  resetInputs() {
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.turnLeft = false;
    this.turnRight = false;
    this.isSprinting = false;
    this.isMouseDown = false;
    this.lastMouseX = null;
    this.lastMouseY = null;
    this.joystickInput.set(0, 0);
    const knob = document.getElementById('joystick-knob');
    if (knob) knob.style.transform = 'translate(0px, 0px)';
  }

  /* --------------------------------------------------------------------------
     1. DESKTOP POINTER LOCK & MOUSE LOOK & KEYBOARD
     -------------------------------------------------------------------------- */
  initDesktopControls() {
    // Pointer lock state tracking
    document.addEventListener('pointerlockchange', () => {
      const locked = (document.pointerLockElement === document.body) ||
                     (document.pointerLockElement === this.domElement);
      this.isLocked = locked;
      this.lastMouseX = null;
      this.lastMouseY = null;
      if (this.onLockChange) this.onLockChange(locked);
    });

    document.addEventListener('pointerlockerror', (err) => {
      console.warn("Pointer lock request warning:", err);
    });

    // Mousedown on game world locks pointer or begins look
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.isMouseDown = true;

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      // Check if click was on modal, puzzle, or UI button
      const isUI = e.target.closest('#interaction-modal') ||
                   e.target.closest('#keypad-puzzle-modal') ||
                   e.target.closest('#reactor-puzzle-modal') ||
                   e.target.closest('#pressure-puzzle-modal') ||
                   e.target.closest('#chemical-puzzle-modal') ||
                   e.target.closest('#safe-puzzle-modal') ||
                   e.target.closest('#inventory-modal') ||
                   e.target.closest('#floor-clear-modal') ||
                   e.target.closest('#game-over-modal') ||
                   e.target.closest('#pause-modal') ||
                   e.target.closest('#landing-page') ||
                   e.target.closest('#blocker') ||
                   e.target.closest('#joystick-zone') ||
                   e.target.closest('#mobile-interact-btn') ||
                   e.target.tagName === 'BUTTON';

      if (!isUI && this.isGameActive && !this.isModalActive && !this.isLocked) {
        this.lock();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isMouseDown = false;
      this.lastMouseX = null;
      this.lastMouseY = null;
    });

    window.addEventListener('mouseleave', () => {
      this.lastMouseX = null;
      this.lastMouseY = null;
      this.isMouseDown = false;
    });

    // Single Authoritative Mouse Look Handler (Using mousemove only to avoid double-processing jitter)
    const handleMouseMove = (e) => {
      if (!this.isGameActive || this.isModalActive) return;

      let movementX = 0;
      let movementY = 0;

      if (this.isLocked) {
        movementX = e.movementX !== undefined ? e.movementX : 0;
        movementY = e.movementY !== undefined ? e.movementY : 0;
      } else {
        // Fallback for trackpads/browsers before pointer lock
        if (this.lastMouseX !== null && this.lastMouseY !== null) {
          movementX = e.clientX - this.lastMouseX;
          movementY = e.clientY - this.lastMouseY;
        }
      }

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      if (movementX !== 0 || movementY !== 0) {
        // Clamp single-frame spikes (avoids erratic cursor-wrap flips)
        const clampedX = Math.max(-80, Math.min(80, movementX));
        const clampedY = Math.max(-80, Math.min(80, movementY));
        const sens = 0.0022;
        this.rotateCamera(clampedX * sens, clampedY * sens);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Keyboard handlers
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Clear sticky keys when window loses focus
    window.addEventListener('blur', () => this.resetInputs());
    window.addEventListener('focus', () => this.resetInputs());
  }

  lock() {
    this.isGameActive = true;
    try {
      if (document.body.requestPointerLock) {
        const p = document.body.requestPointerLock();
        if (p && typeof p.catch === 'function') {
          p.catch((err) => {
            // Benign rejection when called without trusted gesture or tab inactive
          });
        }
      }
    } catch (e) {
      // Ignored
    }
  }

  unlock() {
    this.resetInputs();
    try {
      if (document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch (e) {
      console.warn("Pointer unlock warning:", e);
    }
  }


  onKeyDown(e) {
    // Prevent browser scrolling or tabbing away during gameplay
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code) || e.key === 'Tab') {
      e.preventDefault();
    }

    // Toggle Inventory with Tab or I
    if (e.code === 'Tab' || e.code === 'KeyI' || e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      e.stopPropagation();
      if (this.onInventoryToggle) {
        this.onInventoryToggle();
      }
      return;
    }

    // Toggle / Resume Pause with P or ESC
    if (e.code === 'KeyP' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (this.onPauseToggle) {
        this.onPauseToggle();
      }
      return;
    }

    if (e.code === 'Escape' || e.key === 'Escape') {
      const pauseModal = document.getElementById('pause-modal');
      if (pauseModal && pauseModal.classList.contains('active')) {
        e.preventDefault();
        e.stopPropagation();
        if (this.onPauseToggle) {
          this.onPauseToggle();
        }
        return;
      }
    }

    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = true;
        break;
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'KeyD':
        this.moveRight = true;
        break;
      case 'ArrowLeft':
      case 'KeyQ':
        this.turnLeft = true;
        break;
      case 'ArrowRight':
        this.turnRight = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = true;
        break;
      case 'KeyF':
        if (this.onFlashlightToggle) this.onFlashlightToggle();
        break;
      default:
        if ((e.key === 'f' || e.key === 'F') && this.onFlashlightToggle) {
          this.onFlashlightToggle();
        }
        break;
    }
  }

  onKeyUp(e) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = false;
        break;
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'KeyD':
        this.moveRight = false;
        break;
      case 'ArrowLeft':
      case 'KeyQ':
        this.turnLeft = false;
        break;
      case 'ArrowRight':
        this.turnRight = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.isSprinting = false;
        break;
    }
  }

  update(delta, isModalOpen = false) {
    this.isModalActive = isModalOpen;
    if (isModalOpen || !this.isGameActive) return;

    // Keyboard camera turning (Arrow Left/Right or Q) - guarantees rotation on laptops with trackpad palm rejection!
    const turnRate = this.isSprinting ? 3.0 : this.turnSpeed;
    if (this.turnLeft) {
      this.rotateCamera(-turnRate * delta, 0);
    }
    if (this.turnRight) {
      this.rotateCamera(turnRate * delta, 0);
    }
  }

  /* --------------------------------------------------------------------------
     2. MOBILE TOUCH CONTROLS (Simultaneous Walk + Look Multi-Touch)
     -------------------------------------------------------------------------- */
  initMobileControls() {
    const mobileUI = document.getElementById('mobile-controls');
    const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const isMobileWidth = window.innerWidth <= 1024;
    if (mobileUI) {
      if (isCoarsePointer && isMobileWidth) {
        mobileUI.style.display = 'block';
      } else {
        mobileUI.style.display = 'none';
      }
    }


    const joystickBase = document.getElementById('joystick-base');
    const joystickKnob = document.getElementById('joystick-knob');

    // Invert button toggle
    const invertBtn = document.getElementById('invert-joy-btn');
    if (invertBtn) {
      if (this.invertY) invertBtn.classList.add('active');
      invertBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.toggleJoystickInvertY();
      });
    }

    // Dedicated Touch IDs for Simultaneous Dual-Stick / Multi-Touch
    let joyTouchId = null;
    let lookTouchId = null;
    let baseRect = null;
    const maxRadius = 45;
    let lastTouchX = 0;
    let lastTouchY = 0;

    // Mouse drag on joystick (for testing joystick on desktop)
    let isMouseOnJoystick = false;
    if (joystickBase && joystickKnob) {
      joystickBase.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
          isMouseOnJoystick = true;
          baseRect = joystickBase.getBoundingClientRect();
          this.updateJoystick(e.clientX, e.clientY, baseRect, joystickKnob, maxRadius);
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (isMouseOnJoystick) {
          if (!baseRect) baseRect = joystickBase.getBoundingClientRect();
          this.updateJoystick(e.clientX, e.clientY, baseRect, joystickKnob, maxRadius);
        }
      });

      window.addEventListener('mouseup', () => {
        if (isMouseOnJoystick) {
          isMouseOnJoystick = false;
          this.joystickInput.set(0, 0);
          joystickKnob.style.transform = 'translate(0px, 0px)';
        }
      });
    }

    // Unified Multi-Touch Handler
    window.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const target = touch.target;

        // Skip interactive buttons / modal dialogs
        const isUI = target.closest('#mobile-interact-btn') ||
                     target.closest('#invert-joy-btn') ||
                     target.closest('.modal-card') ||
                     target.closest('.inventory-card') ||
                     target.closest('.keypad-card') ||
                     target.closest('#floor-clear-modal') ||
                     target.closest('#game-over-modal') ||
                     target.closest('#blocker') ||
                     target.tagName === 'BUTTON';

        if (isUI) continue;

        // Joystick touch: ONLY if explicitly touching #joystick-zone or within the joystick base bounds!
        const isJoyTarget = target.closest('#joystick-zone') || target.closest('#joystick-base');
        const inJoyBounds = touch.clientX < 170 && touch.clientY > (window.innerHeight - 200);

        if ((isJoyTarget || inJoyBounds) && joyTouchId === null) {
          joyTouchId = touch.identifier;
          if (joystickBase) baseRect = joystickBase.getBoundingClientRect();
          if (joystickKnob) {
            this.updateJoystick(touch.clientX, touch.clientY, baseRect, joystickKnob, maxRadius);
          }
        } else if (!isJoyTarget && !inJoyBounds && lookTouchId === null) {
          // Camera Look Touch
          lookTouchId = touch.identifier;
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;
        }
      }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      let handled = false;

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === joyTouchId) {
          if (!baseRect && joystickBase) baseRect = joystickBase.getBoundingClientRect();
          if (joystickKnob) {
            this.updateJoystick(touch.clientX, touch.clientY, baseRect, joystickKnob, maxRadius);
          }
          handled = true;
        } else if (touch.identifier === lookTouchId) {
          const deltaX = touch.clientX - lastTouchX;
          const deltaY = touch.clientY - lastTouchY;
          lastTouchX = touch.clientX;
          lastTouchY = touch.clientY;

          const touchSens = 0.0035;
          this.rotateCamera(deltaX * touchSens, deltaY * touchSens);
          handled = true;
        }
      }

      if (handled && e.cancelable) {
        e.preventDefault();
      }
    }, { passive: false });

    const endTouch = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === joyTouchId) {
          joyTouchId = null;
          this.joystickInput.set(0, 0);
          if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
        }
        if (touch.identifier === lookTouchId) {
          lookTouchId = null;
        }
      }

      if (e.touches && e.touches.length === 0) {
        joyTouchId = null;
        lookTouchId = null;
        this.joystickInput.set(0, 0);
        if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
      }
    };

    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);
  }

  updateJoystick(clientX, clientY, baseRect, knob, maxRadius) {
    if (!baseRect) return;
    const centerX = baseRect.left + baseRect.width / 2;
    const centerY = baseRect.top + baseRect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Deadzone (within 6px is neutral)
    if (distance < 6) {
      if (knob) knob.style.transform = 'translate(0px, 0px)';
      this.joystickInput.set(0, 0);
      return;
    }

    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }

    if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;

    const normX = dx / maxRadius;
    const normY = -dy / maxRadius;

    this.joystickInput.x = this.invertX ? -normX : normX;
    this.joystickInput.y = this.invertY ? -normY : normY;
  }

  /* --------------------------------------------------------------------------
     3. MOVEMENT DIRECTION QUERY
     -------------------------------------------------------------------------- */
  getInputDirection() {
    const dir = new THREE.Vector3();

    // If joystick is actively deflected beyond deadzone, use joystick input
    const joyLen = this.joystickInput.length();
    if (joyLen > 0.08) {
      dir.x = this.joystickInput.x;
      dir.z = this.joystickInput.y;
    } else {
      // Otherwise use keyboard WASD
      dir.z = Number(this.moveForward) - Number(this.moveBackward);
      dir.x = Number(this.moveRight) - Number(this.moveLeft);
      if (dir.lengthSq() > 0) {
        dir.normalize();
      }
    }

    return dir;
  }
}
