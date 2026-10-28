import * as THREE from 'three';
import { audio } from './audio.js';

/* ==========================================================================
   DO OR DIE — Player Entity & First-Person Locomotion
   ========================================================================== */

export class Player {
  constructor(camera, controlsManager) {
    this.camera = camera;
    this.controls = controlsManager;

    // Movement speeds
    this.walkSpeed = 5.2;
    this.sprintSpeed = 8.5;
    this.currentSpeed = this.walkSpeed;

    // Physics & Movement Vectors
    this.velocity = new THREE.Vector3();
    this.radius = 0.38; // Player collision cylinder radius
    this.height = 1.7;  // Eye height
    this.isFrozen = false; // Frozen when inspecting clues/modals

    // Dynamic Head Bobbing
    this.bobTimer = 0;
    this.bobAmount = 0.04;
    this.bobFrequency = 10;
    this.isMoving = false;

    // Camera-Mounted Tactical Flashlight
    this.flashlightActive = true;
    this.flashlight = new THREE.SpotLight(0xfff5ea, 9.0, 35, Math.PI / 5.2, 0.35, 1.0);
    this.flashlight.position.set(0.15, -0.12, 0.05);
    this.flashlight.castShadow = false; // Prevents self-shadow clipping against near walls

    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, 0, -10);
    this.camera.add(this.flashlightTarget);
    this.flashlight.target = this.flashlightTarget;
    this.camera.add(this.flashlight);

    // Forward ambient illumination cone
    this.fillLight = new THREE.PointLight(0xffedd5, 1.8, 8, 1.2);
    this.fillLight.position.set(0, 0, 0.1);
    this.camera.add(this.fillLight);

    // Stamina System
    this.maxStamina = 100;
    this.stamina = 100;
    this.isExhausted = false;
    this.regenDelay = 0; // Cooldown delay before stamina starts regenerating after sprinting
    this.adrenalineTimer = 0; // Infinite sprint boost from Pharmacy Medkit / Adrenaline
    this.breathTimer = 0;

    // Procedural Footstep Audio Tracking
    this.stepTimer = 0;
  }

  toggleFlashlight() {
    this.flashlightActive = !this.flashlightActive;
    this.flashlight.visible = this.flashlightActive;
    this.fillLight.visible = this.flashlightActive;
    audio.playFlashlightClick();
    return this.flashlightActive;
  }

  setPosition(x, y, z, rotY = null) {
    this.camera.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.isMoving = false;
    if (rotY !== null && this.controls) {
      this.controls.setRotation(rotY, 0);
    } else if (rotY !== null) {
      this.camera.rotation.set(0, rotY, 0, 'YXZ');
    }
  }

  /* --------------------------------------------------------------------------
     COLLISION CHECK (Multi-point Circle vs Axis-Aligned Bounding Box)
     -------------------------------------------------------------------------- */
  collidesWith(x, z, colliders) {
    const r = this.radius;
    // Test center and 4 perimeter points for robust corner collision
    const testPoints = [
      [x, z],
      [x + r * 0.9, z],
      [x - r * 0.9, z],
      [x, z + r * 0.9],
      [x, z - r * 0.9]
    ];

    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      for (let p = 0; p < testPoints.length; p++) {
        const px = testPoints[p][0];
        const pz = testPoints[p][1];
        if (px >= c.minX && px <= c.maxX && pz >= c.minZ && pz <= c.maxZ) {
          return true;
        }
      }
    }
    return false;
  }

  /* --------------------------------------------------------------------------
     UPDATE LOCOMOTION
     -------------------------------------------------------------------------- */
  update(delta, colliders, isModalOpen = false) {
    if ((!this.controls.isLocked && !this.controls.isGameActive) || isModalOpen) {
      // Rapid deceleration when frozen or paused
      this.velocity.x -= this.velocity.x * 15.0 * delta;
      this.velocity.z -= this.velocity.z * 15.0 * delta;
      return;
    }

    // Adrenaline countdown
    if (this.adrenalineTimer > 0) {
      this.adrenalineTimer -= delta;
      if (this.adrenalineTimer < 0) this.adrenalineTimer = 0;
    }

    // Input direction
    const inputDir = this.controls.getInputDirection();
    this.isMoving = inputDir.lengthSq() > 0.001;

    // Determine sprinting eligibility with stamina
    const wantsToSprint = this.controls.isSprinting && this.isMoving;
    let isActuallySprinting = false;

    if (wantsToSprint && !this.isExhausted) {
      isActuallySprinting = true;
      this.regenDelay = 2.5; // 2.5s cooldown delay before stamina can begin recovering
      if (this.adrenalineTimer <= 0) {
        this.stamina = Math.max(0, this.stamina - 16 * delta);
        if (this.stamina <= 0) {
          this.isExhausted = true;
          this.regenDelay = 4.0; // 4.0s heavy penalty when pushed to 0% exhaustion
          audio.playHeavyBreathing();
        }
      }
    } else {
      // If player is holding the sprint key, prevent stamina from recovering
      if (this.controls.isSprinting) {
        this.regenDelay = Math.max(this.regenDelay, 2.0);
      }

      // Cooldown buffer before stamina starts recovering
      if (this.regenDelay > 0) {
        this.regenDelay -= delta;
      } else {
        // Ultra-slow, realistic survival stamina recovery:
        // Standing idle: 3.5% per sec (~28s to full from 0%)
        // Walking: 1.5% per sec (~66s to full from 0%)
        const recoverRate = this.isMoving ? 1.5 : 3.5;
        this.stamina = Math.min(this.maxStamina, this.stamina + recoverRate * delta);
        if (this.isExhausted && this.stamina >= 50) {
          this.isExhausted = false;
        }
      }
    }

    // Heavy breathing sound when exhausted or low stamina
    if (this.stamina < 20 || this.isExhausted) {
      this.breathTimer += delta;
      if (this.breathTimer >= 2.2) {
        this.breathTimer = 0;
        audio.playHeavyBreathing();
      }
    } else {
      this.breathTimer = 0;
    }

    // Update Stamina UI in HUD
    this.updateStaminaUI();

    // Determine target speed (walking vs sprinting)
    const targetSpeed = isActuallySprinting ? this.sprintSpeed : this.walkSpeed;
    this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, delta * 10);

    // Friction & Damping
    this.velocity.x -= this.velocity.x * 10.0 * delta;
    this.velocity.z -= this.velocity.z * 10.0 * delta;

    if (this.isMoving) {
      this.velocity.z -= inputDir.z * this.currentSpeed * 8.0 * delta;
      this.velocity.x -= inputDir.x * this.currentSpeed * 8.0 * delta;
    } else {
      if (Math.abs(this.velocity.x) < 0.02) this.velocity.x = 0;
      if (Math.abs(this.velocity.z) < 0.02) this.velocity.z = 0;
    }

    // Calculate facing vectors in horizontal (XZ) plane from camera yaw
    const yaw = this.controls.yaw;
    const sinY = Math.sin(yaw);
    const cosY = Math.cos(yaw);

    // Forward is (-sinY, -cosY), Right is (cosY, -sinY)
    const forwardX = -sinY;
    const forwardZ = -cosY;
    const rightX = cosY;
    const rightZ = -sinY;

    // Displacements relative to camera facing orientation
    const forwardDisp = -this.velocity.z * delta;
    const rightDisp = -this.velocity.x * delta;

    const deltaX = forwardX * forwardDisp + rightX * rightDisp;
    const deltaZ = forwardZ * forwardDisp + rightZ * rightDisp;

    // Current player position
    const oldX = this.camera.position.x;
    const oldZ = this.camera.position.z;

    // Strafe/X-axis movement with wall sliding
    this.camera.position.x += deltaX;
    if (this.collidesWith(this.camera.position.x, oldZ, colliders)) {
      this.camera.position.x = oldX; // Slide along collision wall
    }

    // Forward/Z-axis movement with wall sliding
    const currentX = this.camera.position.x;
    this.camera.position.z += deltaZ;
    if (this.collidesWith(currentX, this.camera.position.z, colliders)) {
      this.camera.position.z = oldZ; // Slide along collision wall
    }

    // Dynamic Head Bobbing & Procedural Footsteps
    if (this.isMoving) {
      const speedFactor = isActuallySprinting ? 1.4 : 1.0;
      this.bobTimer += delta * this.bobFrequency * speedFactor;
      const bobOffset = Math.sin(this.bobTimer) * (this.bobAmount * (isActuallySprinting ? 1.3 : 1.0));
      this.camera.position.y = this.height + bobOffset;

      const stepInterval = isActuallySprinting ? 0.32 : 0.52;
      this.stepTimer += delta;
      if (this.stepTimer >= stepInterval) {
        this.stepTimer = 0;
        audio.playFootstep(isActuallySprinting);
      }
    } else {
      this.stepTimer = 0.25;
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, this.height, delta * 8);
    }
  }

  updateStaminaUI() {
    const fillEl = document.getElementById('stamina-bar-fill');
    const valEl = document.getElementById('stamina-val');
    const cardEl = document.getElementById('stamina-container');
    if (!fillEl) return;

    const pct = Math.round((this.stamina / this.maxStamina) * 100);
    fillEl.style.width = `${pct}%`;
    if (valEl) {
      valEl.textContent = this.adrenalineTimer > 0 ? 'ADRENALINE BOOST' : `${pct}%`;
    }

    if (this.adrenalineTimer > 0) {
      fillEl.className = 'stamina-fill boosted';
    } else if (this.isExhausted || pct < 20) {
      fillEl.className = 'stamina-fill exhausted';
    } else if (pct < 50) {
      fillEl.className = 'stamina-fill warning';
    } else {
      fillEl.className = 'stamina-fill normal';
    }

    if (cardEl) {
      cardEl.classList.toggle('exhausted', this.isExhausted);
      cardEl.classList.toggle('boosted', this.adrenalineTimer > 0);
    }
  }

  boostAdrenaline(seconds = 20) {
    this.adrenalineTimer = seconds;
    this.stamina = this.maxStamina;
    this.isExhausted = false;
    audio.playHealSound();
    this.updateStaminaUI();
  }
}
