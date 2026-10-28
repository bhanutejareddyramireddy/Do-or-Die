import * as THREE from 'three';
import { ControlsManager } from './controls.js?v=v7';
import { Player } from './player.js?v=v7';
import { InteractionSystem } from './interaction.js?v=v13_pickup_update';
import { InventorySystem } from './inventory.js?v=v7';
import { PuzzleSystem } from './puzzleSystem.js?v=v14_circuit_ui_overhaul';
import { HospitalFloor3 } from './levels/hospital.js?v=v7';
import { HospitalFloor2 } from './levels/hospitalFloor2.js?v=v7';
import { HospitalFloor1 } from './levels/hospitalFloor1.js?v=v13_pickup_update';
import { TimerSystem } from './timer.js?v=v12_timer_update';
import { audio } from './audio.js?v=v7';

/* ==========================================================================
   DO OR DIE — 3-Floor Hospital Survival Escape (Floors 3, 2, and 1)
   ========================================================================== */

class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.landingPage = document.getElementById('landing-page');
    this.pauseModal = document.getElementById('pause-modal');
    this.startBtn = document.getElementById('start-btn');
    this.clock = new THREE.Clock();

    // Multi-floor state tracking (Floors 3, 2, 1)
    this.currentFloorNumber = 3;
    this.currentFloor = null;
    this.floor3 = null;
    this.floor2 = null;
    this.floor1 = null;
    this.floor3Bonus = 0;
    this.floor2Bonus = 0;
    this.floor3TimeTaken = 0;
    this.floor2TimeTaken = 0;
    this.floor1TimeTaken = 0;

    // Flow state flags
    this.isGameStarted = false;
    this.isTransitioningFloor = false;

    this.initScene();
    this.initInventory();
    this.initPuzzleSystem();
    this.initTimer();
    this.initPlayerAndControls();
    this.initFloor();
    this.initInteraction();
    this.initModals();
    this.initEventListeners();
    this.animate();
  }

  /* --------------------------------------------------------------------------
     1. THREE.JS SCENE SETUP
     -------------------------------------------------------------------------- */
  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060911);
    this.scene.fog = new THREE.FogExp2(0x080d1a, 0.035);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.scene.add(this.camera);
    this.container.appendChild(this.renderer.domElement);
  }

  /* --------------------------------------------------------------------------
     2. INVENTORY SYSTEM
     -------------------------------------------------------------------------- */
  initInventory() {
    this.inventory = new InventorySystem((items) => {
      // Inventory change hook
    });
  }

  /* --------------------------------------------------------------------------
     3. PUZZLE SYSTEM
     -------------------------------------------------------------------------- */
  initPuzzleSystem() {
    this.puzzleSystem = new PuzzleSystem((solvedPuzzle) => {
      // Puzzle solved global hook
    });
    this.puzzleSystem.onClose = () => {
      if (this.isGameStarted && this.timer && !this.currentFloor?.floorCompleted) {
        this.timer.resume();
      }
    };
  }

  /* --------------------------------------------------------------------------
     4. LEVEL ARCHITECTURE (INITIAL FLOOR 3 SETUP)
     -------------------------------------------------------------------------- */
  initFloor() {
    this.floor3 = new HospitalFloor3(
      this.scene,
      this.inventory,
      this.puzzleSystem,
      (completedFloor) => this.handleFloorCompleted(completedFloor)
    );
    this.currentFloor = this.floor3;
    this.currentFloorNumber = 3;
    if (this.inventory) {
      this.inventory.setCurrentFloor(3);
    }
  }

  /* --------------------------------------------------------------------------
     5. PLAYER & CONTROLS INITIALIZATION
     -------------------------------------------------------------------------- */
  initPlayerAndControls() {
    this.controls = new ControlsManager(this.camera, document.body, (isLocked) => {
      if (isLocked) {
        if (this.pauseModal) this.pauseModal.classList.remove('active');
        if (this.landingPage) this.landingPage.classList.remove('active');
      } else {
        const isInteracting = this.interaction && this.interaction.isModalOpen;
        const isSolvingPuzzle = this.puzzleSystem && this.puzzleSystem.isOpen;
        const isInventory = this.inventory && this.inventory.isOpen;
        const isFloorCleared = document.getElementById('floor-clear-modal')?.classList.contains('active');
        const isVictory = document.getElementById('victory-modal')?.classList.contains('active');
        const isGameOver = document.getElementById('game-over-modal')?.classList.contains('active');
        const isLanding = this.landingPage && this.landingPage.classList.contains('active');

        // Show in-game pause menu only if player intentionally exited pointer lock during active gameplay
        if (this.isGameStarted && !this.isTransitioningFloor && !isInteracting && !isSolvingPuzzle && !isInventory && !isFloorCleared && !isVictory && !isGameOver && !isLanding) {
          this.openPauseMenu();
        }
      }
    });

    if (this.inventory) {
      this.inventory.setControls(this.controls);
    }

    this.controls.onInventoryToggle = () => {
      if (this.inventory) {
        this.inventory.toggle();
      }
    };

    this.player = new Player(this.camera, this.controls);
    this.player.setPosition(-6.5, 1.7, -7.0, -Math.PI / 2);

    // Flashlight toggle hook (Key F)
    this.controls.onFlashlightToggle = () => {
      if (this.player) {
        const active = this.player.toggleFlashlight();
        const kbdHint = document.getElementById('hud-flashlight-hint');
        if (kbdHint) {
          kbdHint.innerHTML = `<kbd>F</kbd> Light <span style="color: ${active ? '#38bdf8' : '#64748b'}; font-weight: 700;">[${active ? 'ON' : 'OFF'}]</span>`;
        }
      }
    };

    // Tactical Pause toggle hook (ESC / Key P)
    this.controls.onPauseToggle = () => {
      if (this.pauseModal && this.pauseModal.classList.contains('active')) {
        this.closePauseMenu();
      } else {
        this.openPauseMenu();
      }
    };
  }

  /* --------------------------------------------------------------------------
     6. COUNTDOWN TIMER SYSTEM
     -------------------------------------------------------------------------- */
  initTimer() {
    this.timer = new TimerSystem({
      baseSeconds: 140, // 140s (02:20) for Hospital Floor 3 (increased by 1 min)
      onUrgent: (isUrgent) => {},
      onTimeUp: () => {
        this.handleGameOver();
      }
    });
  }

  /* --------------------------------------------------------------------------
     7. INTERACTION SYSTEM
     -------------------------------------------------------------------------- */
  initInteraction() {
    this.interaction = new InteractionSystem(
      this.camera,
      this.floor3 ? this.floor3.interactiveObjects : [],
      (item) => {}
    );

    this.interaction.onModalClose = () => {
      if (this.isGameStarted && this.timer && !this.currentFloor?.floorCompleted) {
        this.timer.resume();
      }
    };

    window.gameInteractionModal = (title, content) => {
      if (this.timer) this.timer.pause();
      this.interaction.openModal(title, content);
    };

    // Resume timer when modal closes
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this.isGameStarted && this.timer && !this.currentFloor?.floorCompleted) {
          this.timer.resume();
        }
      });
    }

    const keypadCloseBtn = document.getElementById('keypad-close-btn');
    if (keypadCloseBtn) {
      keypadCloseBtn.addEventListener('click', () => {
        if (this.isGameStarted && this.timer && !this.currentFloor?.floorCompleted) {
          this.timer.resume();
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     8. MODALS & BUTTON LISTENERS
     -------------------------------------------------------------------------- */
  initModals() {
    // 1. Campaign Start Button
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => {
        this.loadFloor(3);
      });
    }

    // 2. Direct Floor Selector Buttons (Deploy Floor 3, 2, or Ground Floor)
    document.querySelectorAll('.floor-deploy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const floorTarget = parseInt(btn.getAttribute('data-floor'), 10) || 3;
        this.loadFloor(floorTarget);
      });
    });

    // Also allow clicking anywhere on the floor cards
    document.querySelectorAll('.floor-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        const floorTarget = parseInt(card.getAttribute('data-floor'), 10) || 3;
        this.loadFloor(floorTarget);
      });
    });

    // 3. In-Game Pause Menu Handlers
    const resumeBtn = document.getElementById('pause-resume-btn');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => this.closePauseMenu());
    }

    const pauseRestartBtn = document.getElementById('pause-restart-btn');
    if (pauseRestartBtn) {
      pauseRestartBtn.addEventListener('click', () => {
        this.closePauseMenu();
        this.restartFloor();
      });
    }

    const pauseAudioBtn = document.getElementById('pause-audio-btn');
    if (pauseAudioBtn) {
      pauseAudioBtn.addEventListener('click', () => {
        audio.enabled = !audio.enabled;
        pauseAudioBtn.textContent = audio.enabled ? "🔊 SOUND: ON" : "🔇 SOUND: MUTED";
      });
    }

    const pauseMenuBtn = document.getElementById('pause-menu-btn');
    if (pauseMenuBtn) {
      pauseMenuBtn.addEventListener('click', () => {
        if (this.pauseModal) this.pauseModal.classList.remove('active');
        if (this.landingPage) this.landingPage.classList.add('active');
        this.isGameStarted = false;
        if (this.timer) this.timer.stop();
        this.controls.isGameActive = false;
      });
    }

    // 4. Floor Complete "Descend to Next Floor" Button
    const nextBtn = document.getElementById('next-floor-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentFloorNumber === 3) {
          this.descendToFloor2(this.floor3Bonus);
        } else if (this.currentFloorNumber === 2) {
          this.descendToFloor1(this.floor2Bonus);
        }
      });
    }

    // 5. Victory Screen "Play Again" Button
    const victoryBtn = document.getElementById('victory-restart-btn');
    if (victoryBtn) {
      victoryBtn.addEventListener('click', () => {
        window.location.reload();
      });
    }

    // 6. Game Over "Restart Floor" Button
    const restartBtn = document.getElementById('restart-floor-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.restartFloor();
      });
    }
  }

  /* --------------------------------------------------------------------------
     PAUSE SYSTEM
     -------------------------------------------------------------------------- */
  openPauseMenu() {
    if (!this.isGameStarted || this.isTransitioningFloor) return;
    if (this.pauseModal) {
      this.pauseModal.classList.add('active');

      const descEl = document.getElementById('pause-floor-desc');
      const teleSector = document.getElementById('pause-tele-sector');
      const teleTime = document.getElementById('pause-tele-time');
      const teleThreat = document.getElementById('pause-tele-threat');
      const teleItems = document.getElementById('pause-tele-items');
      const directiveText = document.getElementById('pause-directive-text');
      const audioBtn = document.getElementById('pause-audio-btn');

      const names = {
        3: "FLOOR 3 (TRAUMA WARD)",
        2: "FLOOR 2 (ICU & BIO-LABS)",
        1: "GROUND FLOOR (TRIAGE LOBBY)"
      };

      const threats = {
        3: "POWER FAULT • BIO-LOCK",
        2: "TOXIC GAS CONTAMINATION",
        1: "PERIMETER LOCKDOWN"
      };

      if (teleSector) teleSector.textContent = names[this.currentFloorNumber] || 'HOSPITAL';
      if (teleTime) teleTime.textContent = this.timer ? this.timer.formattedTime : '00:00';
      if (teleThreat) teleThreat.textContent = threats[this.currentFloorNumber] || 'QUARANTINE';
      if (teleItems && this.inventory) teleItems.textContent = `${this.inventory.items.length} ITEMS`;
      if (audioBtn) audioBtn.textContent = audio.enabled ? "🔊 SOUND: ON" : "🔇 SOUND: MUTED";

      if (descEl) {
        descEl.textContent = `Mission paused on ${names[this.currentFloorNumber] || 'Hospital'}. All timers and hazards are frozen.`;
      }

      // Context-aware directive without giving away passcode answers
      if (directiveText) {
        if (this.currentFloorNumber === 3) {
          if (!this.floor3?.passAcquired) {
            directiveText.textContent = "Search Trauma Suite 301 for Tier-1 Security Pass credentials.";
          } else if (!this.floor3?.powerRestored) {
            directiveText.textContent = "Unlock Engineering Core 303 and calibrate the Reactor Power Grid.";
          } else if (!this.floor3?.mainframeUnlocked) {
            directiveText.textContent = "Access Nurse Command 3 Central Mainframe and decrypt the blast door cipher.";
          } else {
            directiveText.textContent = "Proceed to Emergency Stairwell B and descend to Floor 2.";
          }
        } else if (this.currentFloorNumber === 2) {
          if (!this.floor2?.keycardAcquired) {
            directiveText.textContent = "Search ICU 201 for Research Lab Keycard B.";
          } else if (!this.floor2?.valveTurned) {
            directiveText.textContent = "Access Utility Room 203 and equalize toxic gas pressure.";
          } else if (!this.floor2?.labConsoleSolved) {
            directiveText.textContent = "Access Bio-Lab 202 and sequence the antidote catalyst at the spectrometer.";
          } else {
            directiveText.textContent = "Descend Stairwell A to reach the Ground Floor.";
          }
        } else {
          if (!this.floor1?.safeUnlocked) {
            directiveText.textContent = "Check Triage dispatch memo and dial the 3-tumbler Pharmacy Vault combination.";
          } else if (!this.floor1?.relaysEngaged?.every(Boolean)) {
            directiveText.textContent = "Enter West Security Command, align all 3 Gate Relays, and pull Master Lever.";
          } else {
            directiveText.textContent = "Sprint through the courtyard blast gates to the Evacuation Ambulance!";
          }
        }
      }
    }

    if (this.timer) this.timer.pause();
    this.controls.isGameActive = false;
    this.controls.resetInputs();
  }

  closePauseMenu() {
    if (this.pauseModal) {
      this.pauseModal.classList.remove('active');
    }
    if (this.timer && this.currentFloor && !this.currentFloor.floorCompleted) {
      this.timer.resume();
    }
    this.controls.isGameActive = true;
    this.controls.resetInputs();
    this.controls.lock();
  }

  /* --------------------------------------------------------------------------
     UNIFIED MULTI-FLOOR LOADER (Floors 3, 2, and Ground Floor 1)
     -------------------------------------------------------------------------- */
  loadFloor(floorNumber, bonusSeconds = 0) {
    this.isTransitioningFloor = false;
    this.isGameStarted = true;

    // Cleanly close landing page and all overlays
    if (this.landingPage) {
      this.landingPage.classList.remove('active');
    }
    if (this.pauseModal) {
      this.pauseModal.classList.remove('active');
    }
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('active', 'open'));

    // Clean up current floor meshes and colliders from scene
    if (this.currentFloor && typeof this.currentFloor.cleanup === 'function') {
      this.currentFloor.cleanup();
    }

    this.currentFloorNumber = floorNumber;

    if (floorNumber === 3) {
      this.floor3 = new HospitalFloor3(
        this.scene,
        this.inventory,
        this.puzzleSystem,
        (completedFloor) => this.handleFloorCompleted(completedFloor)
      );
      this.currentFloor = this.floor3;
      if (this.player) {
        this.player.setPosition(-6.5, 1.7, -7.0, -Math.PI / 2);
      }
      this.timer.reset(140);
      this.updateHUDForFloor(3);
    } else if (floorNumber === 2) {
      this.floor2 = new HospitalFloor2(
        this.scene,
        this.inventory,
        this.puzzleSystem,
        (completedFloor) => this.handleFloorCompleted(completedFloor)
      );
      this.currentFloor = this.floor2;
      if (this.player) {
        this.player.setPosition(0, 1.7, 18.5, Math.PI);
      }
      this.timer.reset(85 + bonusSeconds);
      this.updateHUDForFloor(2);
    } else if (floorNumber === 1) {
      this.floor1 = new HospitalFloor1(
        this.scene,
        this.inventory,
        this.puzzleSystem,
        (completedFloor) => this.handleFloorCompleted(completedFloor),
        this.player
      );
      this.currentFloor = this.floor1;
      if (this.player) {
        this.player.setPosition(0, 1.7, 18.5, Math.PI);
      }
      this.timer.reset(80 + bonusSeconds);
      this.updateHUDForFloor(1);
    }

    if (this.inventory) {
      this.inventory.setCurrentFloor(floorNumber);
    }

    if (this.interaction && this.currentFloor) {
      this.interaction.setInteractiveObjects(this.currentFloor.interactiveObjects);
    }

    // Start timer, activate player controls and lock pointer
    this.timer.start();
    this.controls.isGameActive = true;
    this.controls.resetInputs();
    this.controls.lock();
  }

  updateHUDForFloor(floorNum) {
    const floorBadges = document.querySelectorAll('.hud-badge .badge-val');
    const statusText = document.getElementById('hud-phase-status');
    const objEl = document.getElementById('objective-text');

    if (floorNum === 3) {
      if (floorBadges.length >= 2) {
        floorBadges[0].textContent = '1 : HOSPITAL';
        floorBadges[1].textContent = '3 (TRAUMA)';
      }
      if (statusText) statusText.textContent = 'POWER OFFLINE • LOCKDOWN';
      if (objEl) objEl.innerHTML = `<span style="color: #38bdf8; font-weight: 700;">TRAUMA SUITE 301:</span> Search room for security pass &bull; Energize Engineering Vault 303`;
    } else if (floorNum === 2) {
      if (floorBadges.length >= 2) {
        floorBadges[0].textContent = '1 : HOSPITAL';
        floorBadges[1].textContent = '2 (ICU & LAB)';
      }
      if (statusText) statusText.textContent = 'DECONTAMINATION ACTIVE';
      if (objEl) objEl.innerHTML = `<span style="color: #06b6d4; font-weight: 700;">QUARANTINE ACTIVE:</span> Search ICU 201 for Keycard B &bull; Decontaminate Sector 2`;
    } else if (floorNum === 1) {
      if (floorBadges.length >= 2) {
        floorBadges[0].textContent = '1 : HOSPITAL';
        floorBadges[1].textContent = '1 (GROUND)';
      }
      if (statusText) statusText.textContent = 'PERIMETER LOCKDOWN';
      if (objEl) objEl.innerHTML = `<span style="color: #fbbf24; font-weight: 700;">GROUND FLOOR:</span> Pick Up Director Keycard in Pharmacy &bull; Link Security Circuits &bull; Evacuate via Courtyard Ambulance`;
    }
  }

  /* --------------------------------------------------------------------------
     9. FLOOR COMPLETION & PROGRESSION (DIRECT ADVANCEMENT WITHOUT RE-PROMPTING)
     -------------------------------------------------------------------------- */
  handleFloorCompleted(floorNum) {
    this.isTransitioningFloor = true;
    if (this.timer) this.timer.stop();

    if (floorNum === 3) {
      const remaining = this.timer.remainingSeconds;
      this.floor3Bonus = remaining;
      this.floor3TimeTaken = Math.max(1, 140 - remaining);

      const nextFloorBase = 85;
      const nextFloorTotal = nextFloorBase + this.floor3Bonus;

      const titleEl = document.getElementById('clear-title');
      const descEl = document.getElementById('clear-desc');
      if (titleEl) titleEl.textContent = "HOSPITAL FLOOR 3 CLEARED";
      if (descEl) descEl.textContent = "You successfully retrieved the Security Pass, stabilized the Plasma Reactor Matrix, decrypted the Nurse Command blast doors, and reached Emergency Stairwell B!";

      const remainingEl = document.getElementById('clear-time-remaining');
      if (remainingEl) remainingEl.textContent = this.timer.formattedTime;

      const bonusEl = document.getElementById('clear-bonus-awarded');
      if (bonusEl) bonusEl.textContent = `+${this.floor3Bonus} SEC`;

      const nextTimeEl = document.getElementById('clear-next-total-time');
      if (nextTimeEl) {
        const mins = Math.floor(nextFloorTotal / 60);
        const secs = nextFloorTotal % 60;
        nextTimeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }

      const nextBtnText = document.getElementById('next-floor-btn-text');
      if (nextBtnText) nextBtnText.textContent = "DESCEND TO FLOOR 2 (ICU & LABS) →";

      const modal = document.getElementById('floor-clear-modal');
      if (modal) {
        modal.classList.add('active');
      }

      // Unlock pointer after modal is safely active so menu never intercepts
      if (this.controls) this.controls.unlock();

      const objEl = document.getElementById('objective-text');
      if (objEl) {
        objEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">FLOOR 3 ESCAPED!</span> Time Bonus: +${this.floor3Bonus}s`;
      }
    } else if (floorNum === 2) {
      const remaining = this.timer.remainingSeconds;
      this.floor2Bonus = remaining;
      const baseFloor2 = 85 + this.floor3Bonus;
      this.floor2TimeTaken = Math.max(1, baseFloor2 - remaining);

      const nextFloorBase = 80;
      const nextFloorTotal = nextFloorBase + this.floor2Bonus;

      const titleEl = document.getElementById('clear-title');
      const descEl = document.getElementById('clear-desc');
      if (titleEl) titleEl.textContent = "HOSPITAL FLOOR 2 CLEARED";
      if (descEl) descEl.textContent = "You equalized the toxic decontamination line, synthesized the neurotoxin antidote, and breached the quarantine descent gate!";

      const remainingEl = document.getElementById('clear-time-remaining');
      if (remainingEl) remainingEl.textContent = this.timer.formattedTime;

      const bonusEl = document.getElementById('clear-bonus-awarded');
      if (bonusEl) bonusEl.textContent = `+${this.floor2Bonus} SEC`;

      const nextTimeEl = document.getElementById('clear-next-total-time');
      if (nextTimeEl) {
        const mins = Math.floor(nextFloorTotal / 60);
        const secs = nextFloorTotal % 60;
        nextTimeEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      }

      const nextBtnText = document.getElementById('next-floor-btn-text');
      if (nextBtnText) nextBtnText.textContent = "DESCEND TO GROUND FLOOR (FINAL EVACUATION) →";

      const modal = document.getElementById('floor-clear-modal');
      if (modal) {
        modal.classList.add('active');
      }

      if (this.controls) this.controls.unlock();

      const objEl = document.getElementById('objective-text');
      if (objEl) {
        objEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">FLOOR 2 ESCAPED!</span> Time Bonus: +${this.floor2Bonus}s`;
      }
    } else if (floorNum === 1) {
      this.handleVictory();
    }
  }

  descendToFloor2(bonusSeconds) {
    const modal = document.getElementById('floor-clear-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.loadFloor(2, bonusSeconds);
    if (this.inventory) {
      this.inventory.showToast("DESCENT COMPLETE: Entered Hospital Floor 2");
    }
  }

  descendToFloor1(bonusSeconds) {
    const modal = document.getElementById('floor-clear-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.loadFloor(1, bonusSeconds);
    if (this.inventory) {
      this.inventory.showToast("FINAL DESCENT: Entered Hospital Ground Floor");
    }
  }


  handleVictory() {
    if (this.controls) this.controls.unlock();
    if (this.timer) this.timer.stop();

    const remaining = this.timer.remainingSeconds;
    const baseFloor1 = 90 + this.floor2Bonus;
    this.floor1TimeTaken = Math.max(1, baseFloor1 - remaining);
    const totalSurvivalSeconds = this.floor3TimeTaken + this.floor2TimeTaken + this.floor1TimeTaken;

    const totalMins = Math.floor(totalSurvivalSeconds / 60);
    const totalSecs = totalSurvivalSeconds % 60;
    const formattedTotal = `${String(totalMins).padStart(2, '0')}:${String(totalSecs).padStart(2, '0')}`;

    // Rank evaluation
    let rank = "S-RANK (SURVIVOR ELITE)";
    let rankClass = "stat-val rank-s";
    if (remaining < 25) {
      rank = "B-RANK (SURVIVOR)";
      rankClass = "stat-val";
    } else if (remaining < 50) {
      rank = "A-RANK (EVACUATED)";
      rankClass = "stat-val highlight";
    }

    const timeEl = document.getElementById('victory-time-left');
    if (timeEl) timeEl.textContent = this.timer.formattedTime;

    const rankEl = document.getElementById('victory-rank');
    if (rankEl) {
      rankEl.textContent = rank;
      rankEl.className = rankClass;
    }

    const totalTimeEl = document.getElementById('victory-total-time');
    if (totalTimeEl) totalTimeEl.textContent = formattedTotal;

    const victoryModal = document.getElementById('victory-modal');
    if (victoryModal) {
      victoryModal.classList.add('active');
    }

    const objEl = document.getElementById('objective-text');
    if (objEl) {
      objEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">SURVIVAL CONFIRMED:</span> Hospital Cleared!`;
    }
  }

  /* --------------------------------------------------------------------------
     10. GAME OVER & CHECKPOINT RESTART
     -------------------------------------------------------------------------- */
  handleGameOver() {
    if (this.controls) this.controls.unlock();

    const descEl = document.getElementById('game-over-desc');
    const floorEl = document.getElementById('game-over-floor');
    const checkEl = document.getElementById('game-over-checkpoint');
    const btnTextEl = document.getElementById('restart-floor-btn-text');

    if (this.currentFloorNumber === 1) {
      if (descEl) descEl.textContent = "Ground Floor was overwhelmed by emergency lockdown before you reached the evacuation ambulance.";
      if (floorEl) floorEl.textContent = "HOSPITAL FLOOR 1 (TRIAGE LOBBY)";
      if (checkEl) checkEl.textContent = "STAIRWELL A LANDING";
      if (btnTextEl) btnTextEl.textContent = "RESTART FLOOR 1";
    } else if (this.currentFloorNumber === 2) {
      if (descEl) descEl.textContent = "Floor 2 was overwhelmed by bio-contaminant toxic gas before you reached Stairwell A.";
      if (floorEl) floorEl.textContent = "HOSPITAL FLOOR 2 (ICU & LAB)";
      if (checkEl) checkEl.textContent = "STAIRWELL B LANDING";
      if (btnTextEl) btnTextEl.textContent = "RESTART FLOOR 2";
    } else {
      if (descEl) descEl.textContent = "Trauma Ward power grid collapsed before you overrode the blast gate.";
      if (floorEl) floorEl.textContent = "HOSPITAL FLOOR 1 (TRAUMA WARD)";
      if (checkEl) checkEl.textContent = "TRAUMA SUITE 101";
      if (btnTextEl) btnTextEl.textContent = "RESTART FLOOR 1";
    }

    const gameOverModal = document.getElementById('game-over-modal');
    if (gameOverModal) {
      gameOverModal.classList.add('active');
    }

    const objEl = document.getElementById('objective-text');
    if (objEl) {
      objEl.innerHTML = `<span style="color: #ef4444; font-weight: 700;">MISSION FAILED:</span> Time Expired`;
    }
  }

  restartFloor() {
    const gameOverModal = document.getElementById('game-over-modal');
    if (gameOverModal) {
      gameOverModal.classList.remove('active');
    }

    if (this.pauseModal) {
      this.pauseModal.classList.remove('active');
    }

    // Reset red screen danger vignette
    const vig = document.getElementById('vignette-overlay');
    if (vig) {
      vig.classList.remove('active', 'pulse', 'urgent');
      vig.style.opacity = '0';
    }

    if (this.currentFloorNumber === 1) {
      // Restart Floor 1 Checkpoint
      if (this.inventory) {
        this.inventory.removeItem('card_director');
        this.inventory.removeItem('doc_evacuation_orders');
      }

      if (this.floor1) {
        this.floor1.resetFloor();
      }

      if (this.player) {
        this.player.setPosition(0, 1.7, 19.5, Math.PI);
      }

      if (this.timer) {
        this.timer.reset(80);
      }
    } else if (this.currentFloorNumber === 2) {
      // Restart Floor 2 Checkpoint
      if (this.inventory) {
        this.inventory.removeItem('lab_keycard');
      }

      if (this.floor2) {
        this.floor2.resetFloor();
      }

      if (this.player) {
        this.player.setPosition(0, 1.7, 19.5, Math.PI);
      }

      // Reset toxic indicators on Floor 2
      const toxHud = document.getElementById('hud-toxic-hazard');
      if (toxHud) toxHud.style.display = 'none';
      const toxFill = document.getElementById('toxic-fill');
      if (toxFill) toxFill.style.width = '0%';
      const toxVal = document.getElementById('toxic-level-text');
      if (toxVal) toxVal.textContent = '0%';
      const toxVig = document.getElementById('toxic-vignette');
      if (toxVig) toxVig.style.opacity = '0';

      // Reset to Floor 2 base time (85 seconds)
      if (this.timer) {
        this.timer.reset(85);
      }
    } else {
      // Restart Floor 3 Checkpoint
      if (this.inventory) {
        this.inventory.items = [];
        this.inventory.render();
      }

      if (this.floor3) {
        this.floor3.resetFloor();
      }

      if (this.player) {
        this.player.setPosition(-6.5, 1.7, -7.0, -Math.PI / 2);
      }

      if (this.timer) {
        this.timer.reset(140);
      }
    }

    // Re-synchronize interactive objects and reset HUD objective text
    if (this.currentFloor && this.interaction) {
      this.interaction.setInteractiveObjects(this.currentFloor.interactiveObjects);
    }
    this.updateHUDForFloor(this.currentFloorNumber);

    // Lock controls and start countdown
    this.controls.isGameActive = true;
    this.controls.resetInputs();
    this.controls.lock();
    this.timer.start();
  }

  /* --------------------------------------------------------------------------
     11. WINDOW RESIZE HANDLER
     -------------------------------------------------------------------------- */
  initEventListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /* --------------------------------------------------------------------------
     12. MAIN ANIMATION & GAME LOOP
     -------------------------------------------------------------------------- */
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    const isModalOpen = (this.interaction && this.interaction.isModalOpen) ||
                        (this.puzzleSystem && this.puzzleSystem.isOpen) ||
                        (this.inventory && this.inventory.isOpen) ||
                        (document.getElementById('floor-clear-modal')?.classList.contains('active')) ||
                        (document.getElementById('victory-modal')?.classList.contains('active')) ||
                        (document.getElementById('game-over-modal')?.classList.contains('active')) ||
                        (document.getElementById('pause-modal')?.classList.contains('active')) ||
                        (this.landingPage && this.landingPage.classList.contains('active'));

    // Update countdown timer only when game is actively running
    if (this.timer && this.isGameStarted && !isModalOpen && (this.controls.isLocked || this.controls.isGameActive)) {
      if (!this.timer.isRunning && this.timer.remainingSeconds > 0) {
        this.timer.resume();
      }
      this.timer.update(delta);
    }

    // Update active floor (Floor 3 or Floor 2)
    if (this.currentFloor && this.player) {
      this.currentFloor.update(elapsedTime, delta, this.player.camera.position);
    }

    if (this.interaction) {
      this.interaction.update();
    }

    if (this.controls) {
      this.controls.update(delta, isModalOpen);
    }

    if (this.player && this.currentFloor) {
      this.player.update(delta, this.currentFloor.colliders, isModalOpen);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
