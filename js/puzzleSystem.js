import { audio } from './audio.js';

/* ==========================================================================
   DO OR DIE — Expanded Multi-Type Puzzle Engine Module
   Supports:
   1. Digital Terminal Keypads (4-digit ciphers)
   2. Plasma Reactor Harmonic Voltage Matrix (Engineering Power Grid)
   3. Toxic Gas Pressure Equalizer (Utility 203)
   4. Biohazard Antidote Chemical Spectrometer (Lab 202)
   5. Rotary Combination Narcotics Safe (Pharmacy Vault)
   ========================================================================== */

export class PuzzleSystem {
  constructor(onPuzzleSolved) {
    this.onPuzzleSolved = onPuzzleSolved;
    this.activePuzzle = null;
    this.currentCode = "";
    this.isOpen = false;
    this.activePuzzleType = null;

    // DOM Elements - Keypad
    this.modalEl = document.getElementById('keypad-puzzle-modal');
    this.displayEl = document.getElementById('keypad-display');
    this.statusEl = document.getElementById('keypad-status');
    this.closeBtn = document.getElementById('keypad-close-btn');
    this.keysGrid = document.getElementById('keypad-keys');

    // DOM Elements - Reactor
    this.reactorModal = document.getElementById('reactor-puzzle-modal');
    this.reactorOutputVal = document.getElementById('reactor-output-val');
    this.reactorStatusText = document.getElementById('reactor-status-text');
    this.reactorContainer = document.getElementById('reactor-coils-container');
    this.reactorResetBtn = document.getElementById('reactor-reset-btn');
    this.reactorEngageBtn = document.getElementById('reactor-engage-btn');
    this.reactorCloseBtn = document.getElementById('reactor-close-btn');

    // DOM Elements - Pressure
    this.pressureModal = document.getElementById('pressure-puzzle-modal');
    this.pressureVal = document.getElementById('pressure-current-val');
    this.pressureFill = document.getElementById('pressure-bar-fill');
    this.pressureResetBtn = document.getElementById('pressure-reset-btn');
    this.pressureFlushBtn = document.getElementById('pressure-flush-btn');
    this.pressureCloseBtn = document.getElementById('pressure-close-btn');

    // DOM Elements - Chemical
    this.chemicalModal = document.getElementById('chemical-puzzle-modal');
    this.chemicalRack = document.getElementById('reagents-selector-rack');
    this.chemicalClearBtn = document.getElementById('chemical-clear-btn');
    this.chemicalSynthesizeBtn = document.getElementById('chemical-synthesize-btn');
    this.chemicalCloseBtn = document.getElementById('chemical-close-btn');

    // DOM Elements - Safe
    this.safeModal = document.getElementById('safe-puzzle-modal');
    this.safeRotaryWheel = document.getElementById('safe-rotary-wheel');
    this.safeCurrentNotch = document.getElementById('safe-current-notch');
    this.safeTurnLeftBtn = document.getElementById('safe-turn-left');
    this.safeTurnRightBtn = document.getElementById('safe-turn-right');
    this.safeSetBtn = document.getElementById('safe-set-tumbler');
    this.safeResetBtn = document.getElementById('safe-reset-btn');
    this.safeCloseBtn = document.getElementById('safe-close-btn');
    this.safeTurnHint = document.getElementById('safe-turn-hint');

    // DOM Elements - Circuit Bypass (Floor 1 Blast Gate Matrix)
    this.circuitModal = document.getElementById('circuit-puzzle-modal');
    this.circuitStatusText = document.getElementById('circuit-status-text');
    this.circuitGateText = document.getElementById('circuit-gate-text');
    this.circuitResetBtn = document.getElementById('circuit-reset-btn');
    this.circuitCloseBtn = document.getElementById('circuit-close-btn');
    this.circuitWiresSvg = document.getElementById('circuit-wires-svg');

    this.selectedWireColor = null;
    this.connectedWires = { red: false, blue: false, yellow: false, green: false };

    this.initEventListeners();
  }

  initEventListeners() {
    // 1. Keypad Modal
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
    if (this.keysGrid) {
      this.keysGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.keypad-btn');
        if (!btn) return;
        const val = btn.dataset.val;
        if (val === 'clear') this.clear();
        else if (val === 'enter') this.submit();
        else if (val !== undefined) this.pressKey(val);
      });
    }

    // 2. Reactor Modal
    if (this.reactorCloseBtn) this.reactorCloseBtn.addEventListener('click', () => this.close());
    if (this.reactorResetBtn) this.reactorResetBtn.addEventListener('click', () => this.resetReactor());
    if (this.reactorEngageBtn) this.reactorEngageBtn.addEventListener('click', () => this.submitReactor());

    // 3. Pressure Modal
    if (this.pressureCloseBtn) this.pressureCloseBtn.addEventListener('click', () => this.close());
    if (this.pressureResetBtn) this.pressureResetBtn.addEventListener('click', () => this.resetPressure());
    if (this.pressureFlushBtn) this.pressureFlushBtn.addEventListener('click', () => this.submitPressure());

    document.querySelectorAll('.valve-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const valveId = parseInt(btn.dataset.valve, 10);
        const dir = parseInt(btn.dataset.dir, 10);
        this.adjustValve(valveId, dir);
      });
    });

    // 4. Chemical Modal
    if (this.chemicalCloseBtn) this.chemicalCloseBtn.addEventListener('click', () => this.close());
    if (this.chemicalClearBtn) this.chemicalClearBtn.addEventListener('click', () => this.clearChemical());
    if (this.chemicalSynthesizeBtn) this.chemicalSynthesizeBtn.addEventListener('click', () => this.submitChemical());

    if (this.chemicalRack) {
      this.chemicalRack.addEventListener('click', (e) => {
        const pill = e.target.closest('.reagent-pill-btn');
        if (!pill) return;
        this.addReagent(pill.dataset.reagent);
      });
    }

    // 5. Safe Modal
    if (this.safeCloseBtn) this.safeCloseBtn.addEventListener('click', () => this.close());
    if (this.safeTurnLeftBtn) this.safeTurnLeftBtn.addEventListener('click', () => this.turnSafeDial(-3));
    if (this.safeTurnRightBtn) this.safeTurnRightBtn.addEventListener('click', () => this.turnSafeDial(3));
    if (this.safeSetBtn) this.safeSetBtn.addEventListener('click', () => this.setSafeTumbler());
    if (this.safeResetBtn) this.safeResetBtn.addEventListener('click', () => this.resetSafe());

    // 6. Hydraulic Circuit Bypass Modal
    if (this.circuitCloseBtn) this.circuitCloseBtn.addEventListener('click', () => this.close());
    if (this.circuitResetBtn) this.circuitResetBtn.addEventListener('click', () => this.resetWires());

    document.querySelectorAll('.wire-src').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectWireSource(btn.dataset.color);
      });
    });

    document.querySelectorAll('.wire-dst').forEach(btn => {
      btn.addEventListener('click', () => {
        this.connectWireTarget(btn.dataset.color);
      });
    });

    // Window resize redraw for SVG wires
    window.addEventListener('resize', () => {
      if (this.isOpen && this.activePuzzleType === 'circuit') {
        this.drawWires();
      }
    });

    // Universal ESC Key Close
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      if (e.key === 'Escape') {
        this.close();
        return;
      }

      if (this.activePuzzleType === 'keypad') {
        if (e.key >= '0' && e.key <= '9') this.pressKey(e.key);
        else if (e.key === 'Backspace') this.clear();
        else if (e.key === 'Enter') this.submit();
      } else if (this.activePuzzleType === 'safe') {
        if (e.key === 'ArrowLeft') this.turnSafeDial(-2);
        else if (e.key === 'ArrowRight') this.turnSafeDial(2);
        else if (e.key === 'Enter' || e.key === ' ') this.setSafeTumbler();
      }
    });
  }

  /* ==========================================================================
     1. DIGITAL KEYPAD / CIPHER PUZZLE
     ========================================================================== */
  openCodePuzzle(config) {
    this.activePuzzle = config;
    this.activePuzzleType = 'keypad';
    this.currentCode = "";
    this.isOpen = true;

    if (this.statusEl) {
      const len = config.codeLength || 4;
      this.statusEl.textContent = config.statusText || `ENTER ${len}-DIGIT OVERRIDE CODE`;
      this.statusEl.className = "keypad-status normal";
    }

    this.updateDisplay();

    if (this.modalEl) {
      this.modalEl.classList.add('open', 'active');
    }
  }

  pressKey(digit) {
    const maxLen = this.activePuzzle ? (this.activePuzzle.codeLength || 4) : 4;
    if (this.currentCode.length >= maxLen) return;

    this.currentCode += digit;
    audio.playKeypadBeep(600 + this.currentCode.length * 80);
    this.updateDisplay();

    if (this.currentCode.length === maxLen) {
      setTimeout(() => this.submit(), 150);
    }
  }

  clear() {
    this.currentCode = "";
    audio.playKeypadBeep(400);
    this.updateDisplay();
    if (this.statusEl) {
      const len = this.activePuzzle ? (this.activePuzzle.codeLength || 4) : 4;
      this.statusEl.textContent = `ENTER ${len}-DIGIT OVERRIDE CODE`;
      this.statusEl.className = "keypad-status normal";
    }
  }

  updateDisplay() {
    if (!this.displayEl) return;
    const maxLen = this.activePuzzle ? (this.activePuzzle.codeLength || 4) : 4;
    let text = "";
    for (let i = 0; i < maxLen; i++) {
      if (i < this.currentCode.length) {
        text += `${this.currentCode[i]} `;
      } else {
        text += "_ ";
      }
    }
    this.displayEl.textContent = text.trim();
  }

  submit() {
    if (!this.activePuzzle) return;

    if (this.currentCode === this.activePuzzle.correctCode) {
      audio.playPuzzleSolved();
      if (this.statusEl) {
        this.statusEl.textContent = "✓ ACCESS GRANTED — OVERRIDE CONFIRMED";
        this.statusEl.className = "keypad-status success";
      }
      if (this.displayEl) {
        this.displayEl.classList.add('success-flash');
      }

      setTimeout(() => {
        if (this.activePuzzle.onSolved) {
          this.activePuzzle.onSolved();
        }
        if (this.onPuzzleSolved) {
          this.onPuzzleSolved(this.activePuzzle);
        }
        this.close();
      }, 1400);

    } else {
      audio.playWrongCode();
      if (this.statusEl) {
        this.statusEl.textContent = "✕ ACCESS DENIED — INVALID CIPHER";
        this.statusEl.className = "keypad-status error shake";
      }
      setTimeout(() => {
        this.clear();
      }, 850);
    }
  }

  /* ==========================================================================
     2. REACTOR FREQUENCY & VOLTAGE MATRIX PUZZLE (Floor 3)
     ========================================================================== */
  openReactorPuzzle(config) {
    this.activePuzzle = config;
    this.activePuzzleType = 'reactor';
    this.isOpen = true;

    // 4 Magnetic Coils: Alpha, Beta, Gamma, Delta (Target: total 100%)
    this.reactorCoils = [
      { name: "ALPHA (PRIMARY)", val: 15, base: 15 },
      { name: "BETA (HARMONIC)", val: 35, base: 35 },
      { name: "GAMMA (PLASMA)", val: 10, base: 10 },
      { name: "DELTA (RELAY)", val: 20, base: 20 }
    ];

    this.renderReactorCoils();
    this.updateReactorOutput();

    if (this.reactorModal) {
      this.reactorModal.classList.add('open', 'active');
    }
  }

  renderReactorCoils() {
    if (!this.reactorContainer) return;
    this.reactorContainer.innerHTML = '';

    this.reactorCoils.forEach((coil, idx) => {
      const unit = document.createElement('div');
      unit.className = 'coil-unit';
      unit.innerHTML = `
        <div class="coil-name">${coil.name}</div>
        <div class="coil-bar-track">
          <div class="coil-bar-fill" id="coil-fill-${idx}" style="height: ${coil.val * 2}%;"></div>
        </div>
        <div class="coil-val-text" id="coil-val-${idx}">${coil.val} kV</div>
        <div class="coil-btn-group">
          <button class="coil-ctrl-btn" data-coil="${idx}" data-delta="-5">-5</button>
          <button class="coil-ctrl-btn" data-coil="${idx}" data-delta="5">+5</button>
        </div>
      `;
      this.reactorContainer.appendChild(unit);
    });

    this.reactorContainer.querySelectorAll('.coil-ctrl-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cIdx = parseInt(btn.dataset.coil, 10);
        const delta = parseInt(btn.dataset.delta, 10);
        this.adjustReactorCoil(cIdx, delta);
      });
    });
  }

  adjustReactorCoil(index, delta) {
    audio.playKeypadBeep(500 + index * 100);
    const coil = this.reactorCoils[index];
    coil.val = Math.max(5, Math.min(50, coil.val + delta));

    // Matrix resonance: Adjusting Alpha slightly tugs on Beta, Gamma tugs Delta
    if (index === 0 && delta > 0 && Math.random() > 0.6) {
      this.reactorCoils[1].val = Math.max(5, Math.min(50, this.reactorCoils[1].val + 5));
    }

    const fill = document.getElementById(`coil-fill-${index}`);
    const text = document.getElementById(`coil-val-${index}`);
    if (fill) fill.style.height = `${coil.val * 2}%`;
    if (text) text.textContent = `${coil.val} kV`;

    this.updateReactorOutput();
  }

  updateReactorOutput() {
    const total = this.reactorCoils.reduce((sum, c) => sum + c.val, 0);
    const percentage = Math.round((total / 100) * 100);

    if (this.reactorOutputVal) {
      this.reactorOutputVal.textContent = `${percentage}% (${total} kV)`;
    }

    if (this.reactorStatusText) {
      if (total === 100) {
        this.reactorStatusText.textContent = "SYNCHRONIZED";
        this.reactorStatusText.className = "gauge-value target";
      } else if (total > 100) {
        this.reactorStatusText.textContent = "OVERLOAD RISK";
        this.reactorStatusText.className = "gauge-value alert";
      } else {
        this.reactorStatusText.textContent = "UNDERPOWERED";
        this.reactorStatusText.className = "gauge-value alert";
      }
    }
  }

  resetReactor() {
    audio.playKeypadBeep(350);
    this.reactorCoils.forEach(c => c.val = c.base);
    this.renderReactorCoils();
    this.updateReactorOutput();
  }

  submitReactor() {
    const total = this.reactorCoils.reduce((sum, c) => sum + c.val, 0);
    if (total === 100) {
      audio.playPuzzleSolved();
      if (this.reactorStatusText) {
        this.reactorStatusText.textContent = "✓ GRID STABILIZED 100%";
      }
      setTimeout(() => {
        if (this.activePuzzle && this.activePuzzle.onSolved) {
          this.activePuzzle.onSolved();
        }
        this.close();
      }, 1200);
    } else {
      audio.playWrongCode();
      if (this.reactorStatusText) {
        this.reactorStatusText.textContent = total > 100 ? "✕ CORE OVERLOAD TRIP" : "✕ INSUFFICIENT CHARGE";
      }
    }
  }

  /* ==========================================================================
     3. GAS PRESSURE EQUALIZER PUZZLE (Floor 2 Utility 203)
     ========================================================================== */
  openPressurePuzzle(config) {
    this.activePuzzle = config;
    this.activePuzzleType = 'pressure';
    this.isOpen = true;
    this.currentPressure = 78; // Initial high toxic pressure
    this.targetMin = 42;
    this.targetMax = 48;

    this.updatePressureDisplay();

    if (this.pressureModal) {
      this.pressureModal.classList.add('open', 'active');
    }
  }

  adjustValve(valveId, dir) {
    audio.playKeypadBeep(450 + valveId * 80);
    const wheel = document.getElementById(`valve-wheel-${valveId}`);
    if (wheel) {
      const currentRot = parseFloat(wheel.dataset.rot || 0) + (dir * 90);
      wheel.dataset.rot = currentRot;
      wheel.style.transform = `rotate(${currentRot}deg)`;
    }

    if (valveId === 1) {
      this.currentPressure += dir === -1 ? -12 : 6;
    } else if (valveId === 2) {
      this.currentPressure += dir === -1 ? -8 : 10;
    } else if (valveId === 3) {
      this.currentPressure += dir === -1 ? -5 : 7;
    }

    this.currentPressure = Math.max(20, Math.min(100, this.currentPressure));
    this.updatePressureDisplay();
  }

  updatePressureDisplay() {
    if (this.pressureVal) {
      this.pressureVal.textContent = `${this.currentPressure} PSI`;
      if (this.currentPressure >= this.targetMin && this.currentPressure <= this.targetMax) {
        this.pressureVal.className = "gauge-value target";
      } else {
        this.pressureVal.className = "gauge-value alert";
      }
    }

    if (this.pressureFill) {
      this.pressureFill.style.width = `${this.currentPressure}%`;
    }
  }

  resetPressure() {
    audio.playKeypadBeep(350);
    this.currentPressure = 78;
    this.updatePressureDisplay();
  }

  submitPressure() {
    if (this.currentPressure >= this.targetMin && this.currentPressure <= this.targetMax) {
      audio.playPuzzleSolved();
      if (this.pressureVal) {
        this.pressureVal.textContent = "✓ PRESSURE NORMALIZED";
      }
      setTimeout(() => {
        if (this.activePuzzle && this.activePuzzle.onSolved) {
          this.activePuzzle.onSolved();
        }
        this.close();
      }, 1200);
    } else {
      audio.playWrongCode();
      if (this.pressureVal) {
        this.pressureVal.textContent = "✕ CRITICAL MISALIGNMENT";
      }
    }
  }

  /* ==========================================================================
     4. BIO-HAZARD REAGENT SPECTROMETER PUZZLE (Floor 2 Bio-Lab 202)
     ========================================================================== */
  openChemicalPuzzle(config) {
    this.activePuzzle = config;
    this.activePuzzleType = 'chemical';
    this.isOpen = true;
    this.reagentSlots = [];
    this.correctReagentSequence = ['G', 'A', 'C', 'T']; // Guanine -> Adenine -> Cytosine -> Thymine

    this.renderChemicalSlots();

    if (this.chemicalModal) {
      this.chemicalModal.classList.add('open', 'active');
    }
  }

  addReagent(reagentCode) {
    if (this.reagentSlots.length >= 4) return;
    audio.playKeypadBeep(700 + this.reagentSlots.length * 100);
    this.reagentSlots.push(reagentCode);
    this.renderChemicalSlots();
  }

  clearChemical() {
    audio.playKeypadBeep(400);
    this.reagentSlots = [];
    this.renderChemicalSlots();
  }

  renderChemicalSlots() {
    const names = { G: 'GUANINE', A: 'ADENINE', C: 'CYTOSINE', T: 'THYMINE' };
    for (let i = 0; i < 4; i++) {
      const vial = document.getElementById(`vial-slot-${i}`);
      if (vial) {
        if (i < this.reagentSlots.length) {
          const r = this.reagentSlots[i];
          vial.className = `slot-vial ${r}`;
          vial.textContent = names[r] || r;
        } else {
          vial.className = 'slot-vial empty';
          vial.textContent = 'EMPTY';
        }
      }
    }
  }

  submitChemical() {
    if (this.reagentSlots.length < 4) {
      audio.playWrongCode();
      return;
    }

    const isMatch = this.reagentSlots.every((r, idx) => r === this.correctReagentSequence[idx]);
    if (isMatch) {
      audio.playPuzzleSolved();
      setTimeout(() => {
        if (this.activePuzzle && this.activePuzzle.onSolved) {
          this.activePuzzle.onSolved();
        }
        this.close();
      }, 1200);
    } else {
      audio.playWrongCode();
      this.clearChemical();
    }
  }

  /* ==========================================================================
     5. ROTARY COMBINATION SAFE PUZZLE (Floor 1 Pharmacy)
     ========================================================================== */
  openSafePuzzle(config) {
    this.activePuzzle = config;
    this.activePuzzleType = 'safe';
    this.isOpen = true;
    this.safeCurrentVal = 0;
    this.safeTumblersSolved = 0;
    this.safeCombination = config.combination || [74, 12, 38];

    this.updateSafeDisplay();
    this.updateTumblerDots();

    if (this.safeModal) {
      this.safeModal.classList.add('open', 'active');
    }
  }

  turnSafeDial(delta) {
    audio.playKeypadBeep(300 + Math.abs(delta) * 20);
    this.safeCurrentVal = (this.safeCurrentVal + delta + 100) % 100;
    this.updateSafeDisplay();
  }

  updateSafeDisplay() {
    if (this.safeCurrentNotch) {
      this.safeCurrentNotch.textContent = String(this.safeCurrentVal).padStart(2, '0');
    }
    if (this.safeRotaryWheel) {
      const angle = (this.safeCurrentVal / 100) * 360;
      this.safeRotaryWheel.style.transform = `rotate(${angle}deg)`;
    }
  }

  updateTumblerDots() {
    for (let i = 1; i <= 3; i++) {
      const dot = document.getElementById(`tumbler-${i}`);
      if (dot) {
        if (i <= this.safeTumblersSolved) {
          dot.className = "tumbler-dot solved";
          dot.textContent = `✓ TUMBLER ${i}`;
        } else {
          dot.className = "tumbler-dot";
          dot.textContent = `TUMBLER ${i}`;
        }
      }
    }

    if (this.safeTurnHint) {
      const hints = [
        "Turn to 1st Combination Notch",
        "Turn to 2nd Combination Notch",
        "Turn to 3rd Combination Notch",
        "VAULT READY TO OPEN"
      ];
      this.safeTurnHint.textContent = hints[this.safeTumblersSolved] || "UNLOCKED";
    }
  }

  setSafeTumbler() {
    const target = this.safeCombination[this.safeTumblersSolved];
    const diff = Math.abs(this.safeCurrentVal - target);

    // Exact match or within 1 notch tolerance
    if (diff === 0 || diff === 1 || diff === 99) {
      audio.playDoorUnlock();
      this.safeTumblersSolved++;
      this.updateTumblerDots();

      if (this.safeTumblersSolved >= 3) {
        audio.playPuzzleSolved();
        if (this.safeTurnHint) {
          this.safeTurnHint.textContent = "✓ COMBINATION ACCEPTED — VAULT OPEN";
        }
        setTimeout(() => {
          if (this.activePuzzle && this.activePuzzle.onSolved) {
            this.activePuzzle.onSolved();
          }
          this.close();
        }, 1200);
      }
    } else {
      audio.playWrongCode();
      this.resetSafe();
    }
  }

  resetSafe() {
    audio.playWrongCode();
    this.safeTumblersSolved = 0;
    this.safeCurrentVal = 0;
    this.updateSafeDisplay();
    this.updateTumblerDots();
  }

  /* ==========================================================================
     6. HYDRAULIC GATE COLOR-CIRCUIT BYPASS (GROUND FLOOR)
     100% Intuitive, Visual, Color-Coded Hydraulic Conduit Linking
     ========================================================================== */
  openCircuitPuzzle(config = {}) {
    this.activePuzzle = config;
    this.activePuzzleType = 'circuit';
    this.isOpen = true;

    this.resetWires(false);

    if (this.circuitModal) {
      this.circuitModal.classList.add('open', 'active');
    }
  }

  // Backward compatibility alias for any existing caller
  openPowerGridPuzzle(config = {}) {
    this.openCircuitPuzzle(config);
  }

  selectWireSource(color) {
    if (this.connectedWires[color]) return; // already connected

    this.selectedWireColor = color;
    audio.playKeypadBeep(580);

    // Update active highlight and indicator text
    document.querySelectorAll('.wire-src').forEach(btn => {
      const ind = btn.querySelector('.wire-conn-indicator');
      const isConnected = this.connectedWires[btn.dataset.color];
      if (btn.dataset.color === color) {
        btn.classList.add('selected');
        if (ind && !isConnected) ind.textContent = 'CONNECTING...';
      } else {
        btn.classList.remove('selected');
        if (ind && !isConnected) ind.textContent = 'DISCONNECTED';
      }
    });
  }

  connectWireTarget(targetColor) {
    if (!this.selectedWireColor) return;
    if (this.connectedWires[targetColor]) return; // already connected

    if (targetColor === this.selectedWireColor) {
      // SUCCESSFUL COLOR MATCH!
      const color = targetColor;
      this.connectedWires[color] = true;
      audio.playDoorUnlock();
      audio.playKeypadBeep(880);

      const srcBtn = document.getElementById(`wire-src-${color}`);
      const dstBtn = document.getElementById(`wire-dst-${color}`);
      const srcConn = document.getElementById(`conn-src-${color}`);
      const dstConn = document.getElementById(`conn-dst-${color}`);

      if (srcBtn) {
        srcBtn.classList.remove('selected');
        srcBtn.classList.add('connected');
      }
      if (dstBtn) dstBtn.classList.add('connected');
      if (srcConn) srcConn.textContent = 'LINKED ✓';
      if (dstConn) dstConn.textContent = 'LINKED ✓';

      // Light up corresponding LED pip in status banner
      const pip = document.getElementById(`pip-${color}`);
      if (pip) pip.classList.add('active');

      this.selectedWireColor = null;
      document.querySelectorAll('.wire-src').forEach(b => {
        b.classList.remove('selected');
        const ind = b.querySelector('.wire-conn-indicator');
        if (ind && !this.connectedWires[b.dataset.color]) {
          ind.textContent = 'DISCONNECTED';
        }
      });

      this.drawWires();
      this.checkCircuitVictory();
    } else {
      // COLOR MISMATCH
      audio.playWrongCode();
      const dstBtn = document.getElementById(`wire-dst-${targetColor}`);
      if (dstBtn) {
        dstBtn.classList.add('error-flash');
        setTimeout(() => dstBtn.classList.remove('error-flash'), 400);
      }
    }
  }

  drawWires() {
    if (!this.circuitWiresSvg || !this.circuitModal) return;
    const board = this.circuitWiresSvg.closest('.circuit-board');
    if (!board) return;
    const boardRect = board.getBoundingClientRect();

    const colors = {
      red: '#ef4444',
      blue: '#38bdf8',
      yellow: '#f59e0b',
      green: '#10b981'
    };

    let svgHtml = '';
    ['red', 'blue', 'yellow', 'green'].forEach(c => {
      if (this.connectedWires[c]) {
        const srcNode = document.querySelector(`#wire-src-${c} .wire-plug-node`);
        const dstNode = document.querySelector(`#wire-dst-${c} .wire-plug-node`);

        if (srcNode && dstNode) {
          const sRect = srcNode.getBoundingClientRect();
          const dRect = dstNode.getBoundingClientRect();

          const x1 = sRect.left + sRect.width / 2 - boardRect.left;
          const y1 = sRect.top + sRect.height / 2 - boardRect.top;
          const x2 = dRect.left + dRect.width / 2 - boardRect.left;
          const y2 = dRect.top + dRect.height / 2 - boardRect.top;

          const strokeColor = colors[c] || '#38bdf8';
          const midX = (x1 + x2) / 2;

          // Multi-layer glowing hydraulic conduit with animated fluid pulse
          svgHtml += `
            <g class="circuit-wire-group" data-color="${c}">
              <!-- Layer 1: Ambient Neon Glow & Outer Tube -->
              <path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" 
                    stroke="${strokeColor}" 
                    stroke-width="10" 
                    stroke-opacity="0.32" 
                    stroke-linecap="round" 
                    fill="none" 
                    filter="drop-shadow(0 0 10px ${strokeColor})" />
              <!-- Layer 2: Core Hydraulic Line -->
              <path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" 
                    stroke="${strokeColor}" 
                    stroke-width="4.5" 
                    stroke-linecap="round" 
                    fill="none" 
                    filter="drop-shadow(0 0 4px #ffffff)" />
              <!-- Layer 3: Flowing High-Energy Electric Particles -->
              <path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" 
                    stroke="#ffffff" 
                    stroke-width="2" 
                    stroke-linecap="round" 
                    stroke-dasharray="6 14" 
                    class="wire-pulse-flow" 
                    fill="none" />
            </g>
          `;
        }
      }
    });

    this.circuitWiresSvg.innerHTML = svgHtml;
  }

  resetWires(playBuzz = true) {
    if (playBuzz) audio.playWrongCode();

    this.selectedWireColor = null;
    this.connectedWires = { red: false, blue: false, yellow: false, green: false };

    document.querySelectorAll('.wire-socket-btn').forEach(b => {
      b.classList.remove('selected', 'connected', 'error-flash');
    });

    document.querySelectorAll('.wire-src .wire-conn-indicator').forEach(ind => {
      ind.textContent = 'DISCONNECTED';
    });

    document.querySelectorAll('.wire-dst .wire-conn-indicator').forEach(ind => {
      ind.textContent = 'OPEN PORT';
    });

    document.querySelectorAll('.circuit-pip').forEach(p => {
      p.classList.remove('active');
    });

    if (this.circuitWiresSvg) {
      this.circuitWiresSvg.innerHTML = '';
    }

    if (this.circuitStatusText) {
      this.circuitStatusText.textContent = 'DISCONNECTED (0/4)';
      this.circuitStatusText.className = 'gauge-value alert';
    }

    if (this.circuitGateText) {
      this.circuitGateText.textContent = 'LOCKED [FAILSAFE]';
      this.circuitGateText.className = 'gauge-value alert';
    }
  }

  checkCircuitVictory() {
    const count = Object.values(this.connectedWires).filter(Boolean).length;

    if (this.circuitStatusText) {
      this.circuitStatusText.textContent = `ONLINE (${count}/4)`;
      if (count === 4) {
        this.circuitStatusText.textContent = 'ALL CIRCUITS ACTIVE (4/4)';
        this.circuitStatusText.className = 'gauge-value success';
      }
    }

    if (count === 4) {
      audio.playPuzzleSolved();

      if (this.circuitGateText) {
        this.circuitGateText.textContent = '✓ BLAST GATES OPENING...';
        this.circuitGateText.className = 'gauge-value success';
      }

      setTimeout(() => {
        if (this.activePuzzle && this.activePuzzle.onSolved) {
          this.activePuzzle.onSolved();
        }
        this.close();
      }, 1200);
    }
  }

  /* ==========================================================================
     CLOSE ANY OPEN PUZZLE
     ========================================================================== */
  close() {
    this.isOpen = false;
    this.activePuzzleType = null;

    [this.modalEl, this.reactorModal, this.pressureModal, this.chemicalModal, this.safeModal, this.circuitModal].forEach(m => {
      if (m) m.classList.remove('open', 'active');
    });

    if (this.displayEl) this.displayEl.classList.remove('success-flash');

    if (typeof this.onClose === 'function') {
      this.onClose();
    }
  }
}
