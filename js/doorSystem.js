import * as THREE from 'three';
import { audio } from './audio.js';

/* ==========================================================================
   DO OR DIE — Door System & Interactive Doors
   ========================================================================== */

export class Door {
  constructor(config) {
    /*
      config = {
        scene,
        x, y, z,
        rotationY,
        openAngle,
        width: 1.4,
        height: 2.3,
        doorTex,
        state: 'OPEN' | 'LOCKED' | 'REQUIRES_KEY' | 'UNLOCKED',
        keyId: 'key_storage',
        lockMessage: 'Requires Storage Master Key',
        name: 'Door',
        collidersList: []
      }
    */
    this.scene = config.scene;
    this.x = config.x;
    this.y = config.y;
    this.z = config.z;
    this.initialRotY = config.rotationY || 0;
    this.openAngle = config.openAngle !== undefined ? config.openAngle : -Math.PI / 2;
    this.width = config.width || 1.4;
    this.height = config.height || 2.3;
    this.state = config.state || 'LOCKED';
    this.keyId = config.keyId || null;
    this.lockMessage = config.lockMessage || 'Door is locked.';
    this.name = config.name || 'Door';
    this.collidersList = config.collidersList;

    this.isOpen = false;
    this.isAnimating = false;
    this.targetAngle = 0;
    this.currentAngle = 0;

    this.buildDoor(config.doorTex);
    this.setupCollider();
  }

  buildDoor(doorTex) {
    // 1. Pivot Group placed at hinge edge
    this.pivot = new THREE.Group();
    this.pivot.position.set(this.x, this.y, this.z);
    this.pivot.rotation.y = this.initialRotY;

    // Door Slab
    const doorMat = new THREE.MeshStandardMaterial({
      map: doorTex,
      roughness: 0.5,
      metalness: 0.2
    });
    const doorGeo = new THREE.BoxGeometry(this.width, this.height, 0.08);
    // Offset slab geometry so pivot is at hinge edge
    doorGeo.translate(this.width / 2, this.height / 2, 0);

    this.mesh = new THREE.Mesh(doorGeo, doorMat);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.pivot.add(this.mesh);

    // Metal Handle
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
    const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16), handleMat);
    handleBar.rotation.z = Math.PI / 2;
    handleBar.position.set(this.width - 0.15, 1.05, 0.06);
    this.pivot.add(handleBar);

    this.scene.add(this.pivot);

    // 2. Architectural Door Frame (static in wall opening to seal seams)
    this.buildFrame();
  }

  buildFrame() {
    this.frameGroup = new THREE.Group();
    this.frameGroup.position.set(this.x, this.y, this.z);
    this.frameGroup.rotation.y = this.initialRotY;

    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.5,
      roughness: 0.3
    });

    const frameDepth = 0.34; // slightly thicker than 0.3m wall to frame cleanly
    const jambWidth = 0.06;
    const lintelHeight = 0.06;

    // Hinge-side Jamb
    const leftJambGeo = new THREE.BoxGeometry(jambWidth, this.height, frameDepth);
    const leftJamb = new THREE.Mesh(leftJambGeo, frameMat);
    leftJamb.position.set(-jambWidth / 2, this.height / 2, 0);
    leftJamb.castShadow = true;
    leftJamb.receiveShadow = true;
    this.frameGroup.add(leftJamb);

    // Strike-side Jamb
    const rightJambGeo = new THREE.BoxGeometry(jambWidth, this.height, frameDepth);
    const rightJamb = new THREE.Mesh(rightJambGeo, frameMat);
    rightJamb.position.set(this.width + jambWidth / 2, this.height / 2, 0);
    rightJamb.castShadow = true;
    rightJamb.receiveShadow = true;
    this.frameGroup.add(rightJamb);

    // Top Lintel Header
    const lintelGeo = new THREE.BoxGeometry(this.width + jambWidth * 2, lintelHeight, frameDepth);
    const lintel = new THREE.Mesh(lintelGeo, frameMat);
    lintel.position.set(this.width / 2, this.height + lintelHeight / 2, 0);
    lintel.castShadow = true;
    lintel.receiveShadow = true;
    this.frameGroup.add(lintel);

    this.scene.add(this.frameGroup);
  }

  setupCollider() {
    // Determine whether door lies along X or Z axis
    const isAlongZ = Math.abs(Math.cos(this.initialRotY)) < 0.1;

    if (isAlongZ) {
      // If initialRotY = -PI/2, door extends along +Z: from this.z to this.z + width
      // If initialRotY = +PI/2, door extends along -Z: from this.z to this.z - width
      const endZ = this.initialRotY > 0 ? (this.z - this.width) : (this.z + this.width);
      const minZ = Math.min(this.z, endZ);
      const maxZ = Math.max(this.z, endZ);
      this.originalCollider = {
        minX: this.x - 0.25,
        maxX: this.x + 0.25,
        minZ: minZ,
        maxZ: maxZ,
        active: true
      };
    } else {
      // Door runs along X axis (e.g. initialRotY = 0 or PI)
      const endX = Math.abs(this.initialRotY - Math.PI) < 0.1 ? (this.x - this.width) : (this.x + this.width);
      const minX = Math.min(this.x, endX);
      const maxX = Math.max(this.x, endX);
      this.originalCollider = {
        minX: minX,
        maxX: maxX,
        minZ: this.z - 0.25,
        maxZ: this.z + 0.25,
        active: true
      };
    }

    this.collider = { ...this.originalCollider };
    if (this.collidersList) {
      this.collidersList.push(this.collider);
    }
  }

  interact(inventory) {
    if (this.isAnimating) return;

    if (this.state === 'LOCKED') {
      audio.playWrongCode();
      window.gameInteractionModal(
        `${this.name} — LOCKED`,
        `
          <div class="doc-view">
            <h3 style="color: #ef4444;">[ ${this.name.toUpperCase()} IS LOCKED ]</h3>
            <div class="clue-box">
              <p>${this.lockMessage}</p>
            </div>
          </div>
        `
      );
      return;
    }

    if (this.state === 'REQUIRES_KEY') {
      const hasKey = inventory && inventory.hasItem(this.keyId);
      if (!hasKey) {
        audio.playWrongCode();
        window.gameInteractionModal(
          `${this.name} — KEY REQUIRED`,
          `
            <div class="doc-view">
              <h3 style="color: #ef4444;">[ KEY REQUIRED ]</h3>
              <div class="clue-box">
                <p>${this.lockMessage}</p>
              </div>
            </div>
          `
        );
        return;
      } else {
        // Unlock with key
        this.state = 'UNLOCKED';
        audio.playDoorUnlock();
      }
    }

    // Toggle Open / Closed
    this.isOpen = !this.isOpen;
    this.targetAngle = this.isOpen ? this.openAngle : 0;
    this.isAnimating = true;
    audio.playDoorUnlock();

    // Disable collider when open so player can smoothly walk through
    if (this.collider) {
      if (this.isOpen) {
        this.collider.minX = -9999;
        this.collider.maxX = -9999;
        this.collider.minZ = -9999;
        this.collider.maxZ = -9999;
      } else {
        Object.assign(this.collider, this.originalCollider);
      }
    }
  }

  unlock() {
    this.state = 'UNLOCKED';
  }

  update(delta) {
    if (this.isAnimating && delta > 0) {
      this.currentAngle = THREE.MathUtils.lerp(this.currentAngle, this.targetAngle, delta * 8);
      this.pivot.rotation.y = this.initialRotY + this.currentAngle;

      if (Math.abs(this.currentAngle - this.targetAngle) < 0.015) {
        this.currentAngle = this.targetAngle;
        this.pivot.rotation.y = this.initialRotY + this.targetAngle;
        this.isAnimating = false;
      }
    }
  }

  dispose() {
    if (this.pivot) {
      this.scene.remove(this.pivot);
    }
    if (this.frameGroup) {
      this.scene.remove(this.frameGroup);
    }
  }
}
