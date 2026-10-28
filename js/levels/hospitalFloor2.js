import * as THREE from 'three';
import { audio } from '../audio.js';
import { Door } from '../doorSystem.js';

/* ==========================================================================
   DO OR DIE — Level 1: Hospital Floor 2 (ICU & Bio-Research Lab)
   ========================================================================== */

export class HospitalFloor2 {
  constructor(scene, inventory, puzzleSystem, onFloorCompleted) {
    this.scene = scene;
    this.inventory = inventory;
    this.puzzleSystem = puzzleSystem;
    this.onFloorCompleted = onFloorCompleted;

    this.colliders = [];          // Solid AABB bounding boxes
    this.animatedLights = [];     // Dynamic lights
    this.interactiveObjects = []; // Raycastable items
    this.doors = [];              // Interactive swinging doors
    this.levelObjects = [];       // Tracked for clean destruction

    this.keycardMesh = null;      // Collectible Lab Keycard B
    this.valveTurned = false;     // Gas valve state
    this.labConsoleSolved = false;// Lab terminal puzzle state
    this.stairwellUnlocked = false;// Exit staircase state
    this.floorCompleted = false;

    // Intercept scene.add to capture all objects for disposal
    const origSceneAdd = this.scene.add.bind(this.scene);
    this.scene.add = (...objs) => {
      this.levelObjects.push(...objs);
      return origSceneAdd(...objs);
    };

    this.createMaterials();
    this.buildArchitecture();
    this.buildArrivalLanding();   // Stairwell B from Floor 3
    this.buildDoors();            // Doors to ICU, Lab, Utility, Stairwell A
    this.buildICUWard();          // Room 201: Beds, monitors, Lab Keycard B
    this.buildGasUtilityAlcove();  // Room 203: Toxic steam & Pressure Valve
    this.buildBioResearchLab();   // Room 202: Lab benches, centrifuge, Terminal
    this.buildStairwellExit();    // Emergency Stairwell A (Escape to Ground)
    this.buildCorridorProps();    // Gurneys, debris, biohazard signs

    // Restore original scene.add
    this.scene.add = origSceneAdd;
  }

  /* --------------------------------------------------------------------------
     1. TEXTURES & PROCEDURAL MATERIALS
     -------------------------------------------------------------------------- */
  createMaterials() {
    // 1. Dark Teal Hospital Corridor Floor with Hazard Strips
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fCtx = floorCanvas.getContext('2d');
    fCtx.fillStyle = '#0f172a';
    fCtx.fillRect(0, 0, 512, 512);
    // Grid tiles
    fCtx.strokeStyle = '#1e293b';
    fCtx.lineWidth = 3;
    const tSize = 64;
    for (let x = 0; x <= 512; x += tSize) {
      fCtx.beginPath(); fCtx.moveTo(x, 0); fCtx.lineTo(x, 512); fCtx.stroke();
    }
    for (let y = 0; y <= 512; y += tSize) {
      fCtx.beginPath(); fCtx.moveTo(0, y); fCtx.lineTo(512, y); fCtx.stroke();
    }
    // Subtle cyan edge guide line
    fCtx.fillStyle = '#0284c7';
    fCtx.fillRect(16, 0, 8, 512);
    fCtx.fillRect(488, 0, 8, 512);
    this.floorTex = new THREE.CanvasTexture(floorCanvas);
    this.floorTex.wrapS = THREE.RepeatWrapping;
    this.floorTex.wrapT = THREE.RepeatWrapping;
    this.floorTex.repeat.set(1, 10);

    // 2. Room Floor (Sterile white/cyan checker)
    const roomCanvas = document.createElement('canvas');
    roomCanvas.width = 256;
    roomCanvas.height = 256;
    const rCtx = roomCanvas.getContext('2d');
    rCtx.fillStyle = '#1e293b';
    rCtx.fillRect(0, 0, 256, 256);
    rCtx.fillStyle = '#334155';
    rCtx.fillRect(0, 0, 128, 128);
    rCtx.fillRect(128, 128, 128, 128);
    this.roomFloorTex = new THREE.CanvasTexture(roomCanvas);
    this.roomFloorTex.wrapS = THREE.RepeatWrapping;
    this.roomFloorTex.wrapT = THREE.RepeatWrapping;
    this.roomFloorTex.repeat.set(8, 8);

    // 3. Bio-Research Wall Texture (Slate Grey with Cyan Safety Trim)
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 512;
    wallCanvas.height = 512;
    const wCtx = wallCanvas.getContext('2d');
    wCtx.fillStyle = '#1e293b';
    wCtx.fillRect(0, 0, 512, 360);
    wCtx.fillStyle = '#0f172a';
    wCtx.fillRect(0, 360, 512, 152); // Baseboard
    wCtx.fillStyle = '#06b6d4';      // Cyan neon stripe
    wCtx.fillRect(0, 350, 512, 10);
    this.wallTex = new THREE.CanvasTexture(wallCanvas);
    this.wallTex.wrapS = THREE.RepeatWrapping;
    this.wallTex.wrapT = THREE.RepeatWrapping;

    // 4. Ceiling Texture with Recessed Air Grids
    const ceilCanvas = document.createElement('canvas');
    ceilCanvas.width = 256;
    ceilCanvas.height = 256;
    const cCtx = ceilCanvas.getContext('2d');
    cCtx.fillStyle = '#090d16';
    cCtx.fillRect(0, 0, 256, 256);
    cCtx.strokeStyle = '#1e293b';
    cCtx.lineWidth = 4;
    cCtx.strokeRect(0, 0, 256, 256);
    this.ceilTex = new THREE.CanvasTexture(ceilCanvas);
    this.ceilTex.wrapS = THREE.RepeatWrapping;
    this.ceilTex.wrapT = THREE.RepeatWrapping;
    this.ceilTex.repeat.set(8, 14);

    // 5. Biohazard Stripe
    const bioCanvas = document.createElement('canvas');
    bioCanvas.width = 256;
    bioCanvas.height = 256;
    const bCtx = bioCanvas.getContext('2d');
    bCtx.fillStyle = '#06b6d4';
    bCtx.fillRect(0, 0, 256, 256);
    bCtx.fillStyle = '#0f172a';
    for (let i = -256; i < 512; i += 40) {
      bCtx.beginPath();
      bCtx.moveTo(i, 0);
      bCtx.lineTo(i + 20, 0);
      bCtx.lineTo(i + 20 + 256, 256);
      bCtx.lineTo(i + 256, 256);
      bCtx.closePath();
      bCtx.fill();
    }
    this.biohazardTex = new THREE.CanvasTexture(bioCanvas);
    this.biohazardTex.wrapS = THREE.RepeatWrapping;
    this.biohazardTex.wrapT = THREE.RepeatWrapping;

    // 6. Door Panel Texture
    const doorCanvas = document.createElement('canvas');
    doorCanvas.width = 256;
    doorCanvas.height = 512;
    const dCtx = doorCanvas.getContext('2d');
    dCtx.fillStyle = '#334155';
    dCtx.fillRect(0, 0, 256, 512);
    dCtx.strokeStyle = '#0f172a';
    dCtx.lineWidth = 6;
    dCtx.strokeRect(16, 16, 224, 480);
    dCtx.fillStyle = '#0ea5e9';
    dCtx.fillRect(48, 48, 160, 120); // Inspection window
    dCtx.fillStyle = '#475569';
    dCtx.fillRect(24, 380, 208, 100);
    this.doorTex = new THREE.CanvasTexture(doorCanvas);

    // Materials
    this.floorMat = new THREE.MeshStandardMaterial({ map: this.floorTex, roughness: 0.35, metalness: 0.2 });
    this.roomFloorMat = new THREE.MeshStandardMaterial({ map: this.roomFloorTex, roughness: 0.5, metalness: 0.1 });
    this.wallMat = new THREE.MeshStandardMaterial({ map: this.wallTex, roughness: 0.6, metalness: 0.1 });
    this.ceilMat = new THREE.MeshStandardMaterial({ map: this.ceilTex, roughness: 0.9 });
    this.metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
    this.darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.3 });
    this.cyanGlowMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x0891b2, emissiveIntensity: 0.8 });
    this.toxicGreenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x16a34a, emissiveIntensity: 0.9, transparent: true, opacity: 0.85 });
    this.amberGlowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.8 });
    this.redGlowMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.9 });
    this.valveMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.4 });
    this.biohazardMat = new THREE.MeshStandardMaterial({ map: this.biohazardTex, roughness: 0.5 });
  }

  /* --------------------------------------------------------------------------
     2. HELPER TO CREATE WALLS & COLLIDERS
     -------------------------------------------------------------------------- */
  addWall(x, z, width, length, height = 3.4) {
    const wallGeo = new THREE.BoxGeometry(width, height, length);
    const wall = new THREE.Mesh(wallGeo, this.wallMat);
    wall.position.set(x, height / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);

    this.colliders.push({
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - length / 2,
      maxZ: z + length / 2
    });
    return wall;
  }

  addObstacle(mesh, width, length, customX = null, customZ = null) {
    this.scene.add(mesh);
    const x = customX !== null ? customX : mesh.position.x;
    const z = customZ !== null ? customZ : mesh.position.z;
    this.colliders.push({
      minX: x - width / 2,
      maxX: x + width / 2,
      minZ: z - length / 2,
      maxZ: z + length / 2
    });
  }

  registerInteractive(mesh, data) {
    const item = {
      mesh: mesh,
      id: data.id || null,
      name: data.name,
      prompt: data.prompt,
      description: data.description,
      onInteract: data.onInteract
    };
    this.interactiveObjects.push(item);
    return item;
  }

  removeInteractive(mesh) {
    const idx = this.interactiveObjects.findIndex(it => it.mesh === mesh);
    if (idx !== -1) {
      this.interactiveObjects.splice(idx, 1);
    }
  }

  addHeader(x, z, width, length, headerHeight = 1.0) {
    const H = 3.4;
    const hMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, headerHeight, length),
      this.wallMat
    );
    hMesh.position.set(x, H - headerHeight / 2, z);
    hMesh.castShadow = true;
    hMesh.receiveShadow = true;
    this.scene.add(hMesh);
    return hMesh;
  }

  /* --------------------------------------------------------------------------
     3. ARCHITECTURAL LAYOUT OF FLOOR 2
     -------------------------------------------------------------------------- */
  buildArchitecture() {
    const H = 3.4;

    // Main Central Corridor Floor (Z from -20 to +22, width 5)
    const corrFloor = new THREE.Mesh(new THREE.PlaneGeometry(5, 42), this.floorMat);
    corrFloor.rotation.x = -Math.PI / 2;
    corrFloor.position.set(0, 0, 1);
    corrFloor.receiveShadow = true;
    this.scene.add(corrFloor);

    // Ceiling
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(5, 42), this.ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, H, 1);
    this.scene.add(ceil);

    // West Wing Floor (ICU 201 & Utility 203: X = -2.5 to -11.5, Z = -18 to +6)
    const westFloor = new THREE.Mesh(new THREE.PlaneGeometry(9, 26), this.roomFloorMat);
    westFloor.rotation.x = -Math.PI / 2;
    westFloor.position.set(-7, 0, -6);
    westFloor.receiveShadow = true;
    this.scene.add(westFloor);

    const westCeil = new THREE.Mesh(new THREE.PlaneGeometry(9, 26), this.ceilMat);
    westCeil.rotation.x = Math.PI / 2;
    westCeil.position.set(-7, H, -6);
    this.scene.add(westCeil);

    // East Wing Floor (Bio-Research Lab 202: X = 2.5 to 11.5, Z = -16 to +6)
    const eastFloor = new THREE.Mesh(new THREE.PlaneGeometry(9, 24), this.roomFloorMat);
    eastFloor.rotation.x = -Math.PI / 2;
    eastFloor.position.set(7, 0, -5);
    eastFloor.receiveShadow = true;
    this.scene.add(eastFloor);

    const eastCeil = new THREE.Mesh(new THREE.PlaneGeometry(9, 24), this.ceilMat);
    eastCeil.rotation.x = Math.PI / 2;
    eastCeil.position.set(7, H, -5);
    this.scene.add(eastCeil);

    // Outer Boundary Walls
    // South Wall (Behind Arrival Landing)
    this.addWall(0, 22, 5, 0.4);
    // East Corridor Wall segments
    this.addWall(2.5, 14, 0.4, 16);     // Z: 6 to 22
    this.addWall(2.5, -17.5, 0.4, 5);   // Z: -15 to -20
    // West Corridor Wall segments
    this.addWall(-2.5, 14, 0.4, 16);    // Z: 6 to 22
    this.addWall(-2.5, -19.5, 0.4, 3);  // Z: -18 to -21

    // Exterior Room Boundary Walls
    // West Wing Outer Walls
    this.addWall(-11.5, -6, 0.4, 26);   // Far West Wall
    this.addWall(-7, 7, 9, 0.4);        // North Wall of ICU 201
    this.addWall(-7, -19, 9, 0.4);      // South Wall of Utility 203
    this.addWall(-7, -6, 9, 0.4);       // Partition Wall between ICU 201 and Utility 203

    // East Wing Outer Walls (Lab 202)
    this.addWall(11.5, -5, 0.4, 24);    // Far East Wall
    this.addWall(7, 7, 9, 0.4);         // North Wall of Lab 202
    this.addWall(7, -17, 9, 0.4);       // South Wall of Lab 202

    // Atmosphere Lighting (Dark ambient with cyan/amber accents)
    const hemiLight = new THREE.HemisphereLight(0x0c1b33, 0x040812, 0.7);
    this.scene.add(hemiLight);

    // Emergency lights along corridor
    this.createEmergencyBeacon(0, 3.1, 16, 0xf59e0b, 'pulse', 1.2);
    this.createEmergencyBeacon(0, 3.1, 5, 0x06b6d4, 'flicker', 1.5);
    this.createEmergencyBeacon(0, 3.1, -6, 0x06b6d4, 'pulse', 1.4);
    this.createEmergencyBeacon(0, 3.1, -17, 0xef4444, 'pulse', 1.6);
  }

  createEmergencyBeacon(x, y, z, colorHex, animType = 'pulse', intensity = 1.2) {
    const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.12, 8), this.darkMetalMat);
    fixture.position.set(x, y, z);
    this.scene.add(fixture);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 1.0
    }));
    bulb.position.set(x, y - 0.08, z);
    this.scene.add(bulb);

    const light = new THREE.PointLight(colorHex, intensity, 12, 1.8);
    light.position.set(x, y - 0.15, z);
    this.scene.add(light);

    this.animatedLights.push({
      light,
      bulb,
      baseIntensity: intensity,
      type: animType
    });
  }

  /* --------------------------------------------------------------------------
     4. ARRIVAL LANDING (STAIRWELL B FROM FLOOR 3)
     -------------------------------------------------------------------------- */
  buildArrivalLanding() {
    // Arrival staircase rising behind the player
    const stairMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
    for (let i = 0; i < 6; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.35, 0.4), stairMat);
      step.position.set(0, 0.18 + i * 0.35, 20.2 + i * 0.35);
      this.scene.add(step);
    }

    // Heavy Fire Gate behind spawn (Locked behind player)
    const gateGeo = new THREE.BoxGeometry(4.2, 3.0, 0.1);
    const gate = new THREE.Mesh(gateGeo, this.darkMetalMat);
    gate.position.set(0, 1.5, 21.8);
    this.addObstacle(gate, 4.2, 0.4);

    // Floor 2 Welcome & Directory Board
    const dirCanvas = document.createElement('canvas');
    dirCanvas.width = 512;
    dirCanvas.height = 320;
    const dCtx = dirCanvas.getContext('2d');
    dCtx.fillStyle = '#090d16';
    dCtx.fillRect(0, 0, 512, 320);
    dCtx.strokeStyle = '#06b6d4';
    dCtx.lineWidth = 6;
    dCtx.strokeRect(8, 8, 496, 304);

    dCtx.fillStyle = '#06b6d4';
    dCtx.font = 'bold 32px "JetBrains Mono", monospace';
    dCtx.fillText('HOSPITAL FLOOR 2 — EVACUATION', 30, 48);

    dCtx.fillStyle = '#f8fafc';
    dCtx.font = 'bold 22px "JetBrains Mono", monospace';
    dCtx.fillText('← ROOM 201 : INTENSIVE CARE (ICU)', 30, 110);
    dCtx.fillText('→ ROOM 202 : BIO-RESEARCH LAB [BIO-3]', 30, 160);
    dCtx.fillText('← ROOM 203 : GAS PRESSURE UTILITY', 30, 210);
    dCtx.fillStyle = '#22c55e';
    dCtx.fillText('↑ NORTH : STAIRWELL A (GROUND EXIT)', 30, 260);

    const dirTex = new THREE.CanvasTexture(dirCanvas);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.5), new THREE.MeshBasicMaterial({ map: dirTex }));
    board.position.set(2.28, 1.7, 18.0);
    board.rotation.y = -Math.PI / 2;
    this.scene.add(board);
  }

  /* --------------------------------------------------------------------------
     5. INTERACTIVE DOORS
     -------------------------------------------------------------------------- */
  buildDoors() {
    // 1. Room 201 (ICU) Door: West wall at Z: [0.5, 2.1]
    this.addWall(-2.5, -2.7, 0.4, 6.4); // North wall: Z [-5.9, 0.5]
    this.addWall(-2.5, 4.05, 0.4, 3.9); // South wall: Z [2.1, 6.0]
    this.addHeader(-2.5, 1.3, 0.4, 1.6, 1.0); // Header over ICU Door: Z [0.5, 2.1]

    this.icuDoor = new Door({
      scene: this.scene,
      x: -2.5, y: 0, z: 0.5,
      rotationY: -Math.PI / 2,
      openAngle: -Math.PI / 2,
      width: 1.6, height: 2.4,
      doorTex: this.doorTex,
      state: 'UNLOCKED',
      name: 'Room 201 ICU Door',
      collidersList: this.colliders
    });
    this.doors.push(this.icuDoor);
    this.addRoomSign(-2.28, 2.5, 0.1, '201 : ICU', Math.PI / 2);

    this.registerInteractive(this.icuDoor.mesh, {
      name: 'Room 201 ICU Door',
      prompt: 'Press E to Open / Close Door',
      onInteract: () => this.icuDoor.interact(this.inventory)
    });

    // 2. Room 203 (Utility) Door: West wall at Z: [-11.6, -10.0]
    this.addWall(-2.5, -7.95, 0.4, 4.1); // North wall: Z [-5.9, -10.0]
    this.addWall(-2.5, -14.8, 0.4, 6.4); // South wall: Z [-11.6, -18.0]
    this.addHeader(-2.5, -10.8, 0.4, 1.6, 1.0); // Header over Utility Door: Z [-11.6, -10.0]

    this.utilDoor = new Door({
      scene: this.scene,
      x: -2.5, y: 0, z: -11.6,
      rotationY: -Math.PI / 2,
      openAngle: -Math.PI / 2,
      width: 1.6, height: 2.4,
      doorTex: this.doorTex,
      state: 'UNLOCKED',
      name: 'Room 203 Utility Door',
      collidersList: this.colliders
    });
    this.doors.push(this.utilDoor);
    this.addRoomSign(-2.28, 2.5, -9.6, '203 : GAS UTILITY', Math.PI / 2);

    this.registerInteractive(this.utilDoor.mesh, {
      name: 'Room 203 Gas Utility Door',
      prompt: 'Press E to Open / Close Door',
      onInteract: () => this.utilDoor.interact(this.inventory)
    });

    // 3. Room 202 (Bio-Research Lab) Door: East wall at Z: [-4.0, -2.4]
    // Requires Lab Keycard B
    this.addWall(2.5, 1.8, 0.4, 8.4);   // North wall: Z [6.0, -2.4]
    this.addWall(2.5, -9.5, 0.4, 11.0); // South wall: Z [-4.0, -15.0]
    this.addHeader(2.5, -3.2, 0.4, 1.6, 1.0); // Header over Lab Door: Z [-4.0, -2.4]

    this.labDoor = new Door({
      scene: this.scene,
      x: 2.5, y: 0, z: -4.0,
      rotationY: -Math.PI / 2,
      openAngle: Math.PI / 2,
      width: 1.6, height: 2.4,
      doorTex: this.doorTex,
      state: 'REQUIRES_KEY',
      keyId: 'lab_keycard',
      lockMessage: 'Access Restricted. Swipe Research Lab Keycard B from ICU to disengage biohazard seal.',
      name: 'Bio-Research Lab 202 Door',
      collidersList: this.colliders
    });
    this.doors.push(this.labDoor);
    this.addRoomSign(2.28, 2.5, -2.0, '202 : BIO-LAB [KEYCARD]', -Math.PI / 2);

    this.registerInteractive(this.labDoor.mesh, {
      name: 'Bio-Research Lab 202 Door',
      prompt: 'Press E to Open Lab Door (Requires Keycard B)',
      onInteract: () => {
        const hasKey = this.inventory && this.inventory.hasItem('lab_keycard');
        if (hasKey && this.labDoor.state === 'REQUIRES_KEY') {
          audio.playKeycardBeep();
        }
        this.labDoor.interact(this.inventory);
      }
    });
  }

  /* --------------------------------------------------------------------------
     6. ROOM 201: INTENSIVE CARE UNIT (ICU)
     -------------------------------------------------------------------------- */
  buildICUWard() {
    // 1. Hospital Beds with Heart Monitors
    this.buildICUBed(-5.5, 3.5, 0);
    this.buildICUBed(-9.0, 3.5, 0);
    this.buildICUBed(-9.0, -2.5, 0);

    // 2. Nurse Workstation Desk (Contains Keycard & Clue)
    const deskGroup = new THREE.Group();
    deskGroup.position.set(-6.0, 0, -2.0);

    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.2), this.darkMetalMat);
    deskTop.position.set(0, 0.85, 0);
    deskGroup.add(deskTop);

    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.1), this.metalMat);
    leg1.position.set(-1.1, 0.4, 0);
    deskGroup.add(leg1);
    const leg2 = leg1.clone();
    leg2.position.set(1.1, 0.4, 0);
    deskGroup.add(leg2);

    // Computer Monitor on Desk
    const monMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, emissive: 0x0284c7, emissiveIntensity: 0.6 });
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.08), monMat);
    monitor.position.set(0, 1.15, 0.2);
    deskGroup.add(monitor);

    this.addObstacle(deskGroup, 2.6, 1.4, -6.0, -2.0);

    // 3. Collectible: Research Lab Keycard B
    this.buildLabKeycard(-6.5, 0.95, -2.0);

    // 4. Interactive Medical Incident Log Clipboard on Desk
    const clipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    clipMesh.position.set(-5.5, 0.92, -2.1);
    this.scene.add(clipMesh);

    this.registerInteractive(clipMesh, {
      name: "Emergency Incident Log #409",
      prompt: "Press E to Read Incident Log",
      description: "ICU Medical Log & Quarantine Procedure",
      onInteract: () => {
        window.gameInteractionModal(
          "ICU INCIDENT REPORT #409",
          `
            <div class="doc-view">
              <h3 style="color: #06b6d4;">[ QUARANTINE OVERRIDE DIRECTIVE ]</h3>
              <p><strong>LOG DATE:</strong> 02:44 AM — BIOHAZARD PROTOCOL ACTIVE</p>
              <div class="clue-box">
                <p>A catastrophic toxic pressure spike ruptured line B in the south utility sector. Ground Stairwell A has automatically locked down.</p>
                <p><strong>CRITICAL EVACUATION PROTOCOL:</strong></p>
                <ol style="margin-left: 1.2rem; line-height: 1.8;">
                  <li><strong>Utility Room 203:</strong> Access the <strong>Pressure Equalizer Console</strong> to bleed and balance toxic line pressure into the safe relief envelope (42-48 PSI).</li>
                  <li><strong>Research Lab 202:</strong> Swipe Keycard B and sequence the Antidote Catalyst at the Spectrometer using the nucleic acid directive:
                    <br><strong style="font-size: 1.05rem; color: #38bdf8; display:block; margin: 0.5rem 0;">"Guanine (Gold) initiates &bull; Adenine (Green) precedes Cytosine (Blue) &bull; Thymine (Red) concludes"</strong>
                  </li>
                  <li>Both locks will disengage, opening <strong>Emergency Stairwell A</strong> to the Ground Floor!</li>
                </ol>
              </div>
              <p style="color: #f59e0b; margin-top: 1rem;"><em>NOTE: Lab Keycard B is stationed on the ICU nurse desk.</em></p>
            </div>
          `
        );
      }
    });

    // Room Light
    const icuLight = new THREE.PointLight(0x38bdf8, 1.2, 10, 2);
    icuLight.position.set(-7.5, 2.9, 0);
    this.scene.add(icuLight);
  }

  buildICUBed(x, z, rotY = 0) {
    const bedGroup = new THREE.Group();
    bedGroup.position.set(x, 0, z);
    bedGroup.rotation.y = rotY;

    // Mattress & Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.2), this.darkMetalMat);
    frame.position.y = 0.25;
    bedGroup.add(frame);

    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 2.1), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.8 }));
    mattress.position.y = 0.6;
    bedGroup.add(mattress);

    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.15, 0.4), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 }));
    pillow.position.set(0, 0.78, -0.8);
    bedGroup.add(pillow);

    // IV Stand
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.0), this.metalMat);
    pole.position.set(0.8, 1.0, -0.8);
    bedGroup.add(pole);

    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.1), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.8 }));
    bag.position.set(0.8, 1.85, -0.8);
    bedGroup.add(bag);

    // ECG Monitor
    const ecg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.15), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x15803d, emissiveIntensity: 0.7 }));
    ecg.position.set(0.8, 1.3, -0.4);
    bedGroup.add(ecg);

    this.addObstacle(bedGroup, 1.8, 2.4, x, z);
  }

  buildLabKeycard(x, y, z) {
    const cardGroup = new THREE.Group();
    cardGroup.position.set(x, y, z);

    // 3D Magnetic Keycard Model
    const cardMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      metalness: 0.6,
      roughness: 0.2,
      emissive: 0x0891b2,
      emissiveIntensity: 0.7
    });
    const cardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.55), cardMat);
    cardGroup.add(cardMesh);

    // Magnetic Strip
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.55), this.darkMetalMat);
    strip.position.set(-0.1, 0.005, 0);
    cardGroup.add(strip);

    // Glowing halo point light
    const glowLight = new THREE.PointLight(0x06b6d4, 1.0, 3, 2);
    glowLight.position.set(0, 0.2, 0);
    cardGroup.add(glowLight);

    this.scene.add(cardGroup);
    this.keycardMesh = cardGroup;

    this.registerInteractive(cardMesh, {
      id: "lab_keycard",
      name: "Research Lab Keycard B",
      prompt: "Press E to Pick Up Lab Keycard B",
      onInteract: () => {
        audio.playItemPickup();
        this.inventory.addItem({
          id: 'lab_keycard',
          name: 'Lab Keycard B',
          icon: '💳',
          description: 'High-security magnetic passcard granting access to Bio-Research Lab 202.'
        });

        this.removeInteractive(cardMesh);
        this.scene.remove(this.keycardMesh);
        this.keycardMesh = null;

        // Update objective
        const objEl = document.getElementById('objective-text');
        if (objEl) {
          objEl.innerHTML = `<span style="color: #06b6d4; font-weight: 700;">KEYCARD ACQUIRED:</span> Access Lab 202 & Vent Utility 203`;
        }
      }
    });
  }

  /* --------------------------------------------------------------------------
     7. ROOM 203: GAS UTILITY & PRESSURE RELEASE VALVE
     -------------------------------------------------------------------------- */
  buildGasUtilityAlcove() {
    // Industrial Utility Pipes along the back wall
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    const manifold = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.0), pipeMat);
    manifold.rotation.x = Math.PI / 2;
    manifold.position.set(-11.0, 1.5, -13.0);
    this.scene.add(manifold);

    // Pressure Gauge Dial
    const gaugeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
    const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), gaugeMat);
    gauge.rotation.z = Math.PI / 2;
    gauge.position.set(-10.8, 1.5, -13.0);
    this.scene.add(gauge);

    // 3D Red Valve Wheel
    this.valveWheelGroup = new THREE.Group();
    this.valveWheelGroup.position.set(-10.6, 1.5, -13.0);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 8, 24), this.valveMat);
    rim.rotation.y = Math.PI / 2;
    this.valveWheelGroup.add(rim);

    // Spokes
    const sp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7), this.valveMat);
    sp1.rotation.x = Math.PI / 2;
    this.valveWheelGroup.add(sp1);
    const sp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7), this.valveMat);
    this.valveWheelGroup.add(sp2);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.15), this.darkMetalMat);
    hub.rotation.z = Math.PI / 2;
    this.valveWheelGroup.add(hub);

    this.scene.add(this.valveWheelGroup);

    // Hazard Status Light in Utility Alcove (Starts Red, turns Green on valve turn)
    this.valveBeacon = new THREE.PointLight(0xef4444, 1.8, 8, 2);
    this.valveBeacon.position.set(-8.5, 2.8, -13.0);
    this.scene.add(this.valveBeacon);

    this.animatedLights.push({
      light: this.valveBeacon,
      baseIntensity: 1.8,
      type: 'pulse'
    });

    // Toxic Gas Fog Puff Geometry (disappears when valve turned)
    this.gasHazeGroup = new THREE.Group();
    this.gasHazeGroup.position.set(-10.4, 0.8, -13.0);
    for (let i = 0; i < 6; i++) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.3), this.toxicGreenMat);
      puff.position.set((Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 1.4);
      this.gasHazeGroup.add(puff);
    }
    this.scene.add(this.gasHazeGroup);

    // Register Valve Interaction
    this.registerInteractive(rim, {
      name: "Pressure Relief Valve",
      prompt: "Press E to Turn Pressure Valve",
      description: "Emergency high-pressure gas purge valve",
      onInteract: () => {
        if (this.valveTurned) {
          window.gameInteractionModal(
            "PRESSURE REGULATION STATUS",
            `
              <div class="doc-view">
                <h3 style="color: #22c55e;">[ PRESSURE NORMALIZED ]</h3>
                <div class="clue-box">
                  <p>Valve locked in SECURE position. Toxic gas lines successfully vented to outside filtration!</p>
                </div>
              </div>
            `
          );
          return;
        }

        if (!this.valveTurned) {
          if (this.puzzleSystem) {
            this.puzzleSystem.openPressurePuzzle({
              title: "TOXIC PRESSURE EQUALIZER CONSOLE",
              onSolved: () => {
                this.valveTurned = true;
                audio.playGasVent();

                // Animate valve turn
                this.isValveTurning = true;

                // Turn beacon green
                this.valveBeacon.color.setHex(0x22c55e);

                // Remove gas haze
                if (this.gasHazeGroup) {
                  this.scene.remove(this.gasHazeGroup);
                  this.gasHazeGroup = null;
                }

                const toxHud = document.getElementById('hud-toxic-hazard');
                if (toxHud) toxHud.style.display = 'none';
                const toxVig = document.getElementById('toxic-vignette');
                if (toxVig) toxVig.style.opacity = '0';

                this.inventory.showToast("💨 TOXIC LINES VENTED: Gas pressure neutralized!");
                this.checkEscapeConditions();
              }
            });
          }
        }
      }
    });

    // Utility warning sign
    const signMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 1.2), signMat);
    sign.position.set(-2.55, 2.2, -12.0);
    this.scene.add(sign);
  }

  /* --------------------------------------------------------------------------
     8. ROOM 202: BIO-RESEARCH LABORATORY
     -------------------------------------------------------------------------- */
  buildBioResearchLab() {
    // 1. Central Lab Workbenches
    this.buildLabWorkbench(6.5, -2.0);
    this.buildLabWorkbench(6.5, -8.0);

    // 2. Fume Hood & Chemical Reagent Shelf
    const shelfGroup = new THREE.Group();
    shelfGroup.position.set(11.0, 0, -5.0);

    const shelfFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.8, 3.5), this.darkMetalMat);
    shelfFrame.position.set(0, 1.4, 0);
    shelfGroup.add(shelfFrame);

    // Glowing Specimen Beakers
    for (let z = -1.2; z <= 1.2; z += 0.6) {
      const beaker = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 12), this.cyanGlowMat);
      beaker.position.set(-0.25, 1.6, z);
      shelfGroup.add(beaker);
    }
    this.addObstacle(shelfGroup, 1.0, 3.8, 11.0, -5.0);

    // 3. Mainframe Security Terminal Desk
    const termDesk = new THREE.Group();
    termDesk.position.set(6.5, 0, -14.5);

    const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.2), this.darkMetalMat);
    table.position.set(0, 0.85, 0);
    termDesk.add(table);

    const leg = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.1), this.metalMat);
    leg.position.set(0, 0.4, 0);
    termDesk.add(leg);

    // Terminal Monitor
    this.termScreenMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.9
    });
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.08), this.termScreenMat);
    screen.position.set(0, 1.25, -0.2);
    termDesk.add(screen);

    // Terminal Light
    const termLight = new THREE.PointLight(0x06b6d4, 1.2, 5, 2);
    termLight.position.set(0, 1.5, 0.2);
    termDesk.add(termLight);

    this.addObstacle(termDesk, 2.8, 1.4, 6.5, -14.5);

    // Register Terminal Puzzle
    this.registerInteractive(screen, {
      name: "Bio-Safety Mainframe Console",
      prompt: "Press E to Access Safety Mainframe",
      description: "Central lockdown release terminal (Requires 4-digit code)",
      onInteract: () => {
        if (this.labConsoleSolved) {
          window.gameInteractionModal(
            "MAINFRAME STATUS — AUTHORIZED",
            `
              <div class="doc-view">
                <h3 style="color: #22c55e;">[ OVERRIDE ACCEPTED ]</h3>
                <div class="clue-box">
                  <p>Security lock sequence disengaged. Stairwell A emergency doors have been signaled!</p>
                </div>
              </div>
            `
          );
          return;
        }

        // Open Antidote Reagent Spectrometer Puzzle
        if (this.puzzleSystem) {
          this.puzzleSystem.openChemicalPuzzle({
            title: "ANTIDOTE REAGENT SPECTROMETER",
            onSolved: () => {
              this.labConsoleSolved = true;
              this.termScreenMat.color.setHex(0x22c55e);
              this.termScreenMat.emissive.setHex(0x16a34a);
              termLight.color.setHex(0x22c55e);

              this.inventory.showToast("✓ LAB OVERRIDE AUTHORIZED: Antidote Synthesized!");
              this.checkEscapeConditions();
            }
          });
        }
      }
    });

    // Lab Ceiling Ambient Point Light
    const labLight = new THREE.PointLight(0x06b6d4, 1.4, 12, 1.8);
    labLight.position.set(7.0, 2.9, -5.0);
    this.scene.add(labLight);
  }

  buildLabWorkbench(x, z) {
    const benchGroup = new THREE.Group();
    benchGroup.position.set(x, 0, z);

    const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.2), this.metalMat);
    top.position.y = 0.9;
    benchGroup.add(top);

    const base = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.85, 1.0), this.darkMetalMat);
    base.position.y = 0.42;
    benchGroup.add(base);

    // Centrifuge Cylinder
    const centrifuge = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.35, 16), this.cyanGlowMat);
    centrifuge.position.set(-0.8, 1.1, 0);
    benchGroup.add(centrifuge);

    // Microscope Body
    const scope = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.45, 0.35), this.darkMetalMat);
    scope.position.set(0.6, 1.15, 0);
    benchGroup.add(scope);

    this.addObstacle(benchGroup, 3.2, 1.4, x, z);
  }

  /* --------------------------------------------------------------------------
     9. EMERGENCY STAIRWELL A (ESCAPE TO GROUND FLOOR)
     -------------------------------------------------------------------------- */
  buildStairwellExit() {
    // North Exit at Z = -20.0
    // Exit Arch Frame
    const archMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
    const archLeft = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.4, 0.5), archMat);
    archLeft.position.set(-1.8, 1.7, -20.0);
    this.addObstacle(archLeft, 1.4, 0.5);

    const archRight = new THREE.Mesh(new THREE.BoxGeometry(1.4, 3.4, 0.5), archMat);
    archRight.position.set(1.8, 1.7, -20.0);
    this.addObstacle(archRight, 1.4, 0.5);

    const archTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.5), archMat);
    archTop.position.set(0, 2.9, -20.0);
    this.scene.add(archTop);

    // Magnetic Blast Door (Locked initially)
    this.stairDoor = new Door({
      scene: this.scene,
      x: -1.1, y: 0, z: -20.0,
      rotationY: 0,
      openAngle: -Math.PI / 2,
      width: 2.2, height: 2.4,
      doorTex: this.doorTex,
      state: 'LOCKED',
      lockMessage: 'LOCKDOWN ENGAGED: Vent toxic gas (Room 203) and authorize Lab Override (Room 202) to unlock Stairwell A!',
      name: 'Stairwell A Blast Door',
      collidersList: this.colliders
    });
    this.doors.push(this.stairDoor);

    // Exit Sign above door
    const exitCanvas = document.createElement('canvas');
    exitCanvas.width = 256;
    exitCanvas.height = 96;
    const eCtx = exitCanvas.getContext('2d');
    eCtx.fillStyle = '#15803d';
    eCtx.fillRect(0, 0, 256, 96);
    eCtx.fillStyle = '#ffffff';
    eCtx.font = 'bold 32px "JetBrains Mono", monospace';
    eCtx.textAlign = 'center';
    eCtx.fillText('EMERGENCY EXIT', 128, 42);
    eCtx.font = 'bold 22px "JetBrains Mono", monospace';
    eCtx.fillText('↓ TO GROUND FLOOR ↓', 128, 76);
    const exitTex = new THREE.CanvasTexture(exitCanvas);

    const exitSign = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.1), new THREE.MeshBasicMaterial({ map: exitTex }));
    exitSign.position.set(0, 2.85, -19.7);
    this.scene.add(exitSign);

    // Downward Steps to Ground Floor (beyond Z = -20)
    const stairMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    for (let i = 0; i < 8; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.35, 0.5), stairMat);
      step.position.set(0, -0.18 - i * 0.35, -20.5 - i * 0.5);
      this.scene.add(step);
    }

    // Walls along staircase descent
    this.addWall(-1.8, -22.5, 0.4, 5.0);
    this.addWall(1.8, -22.5, 0.4, 5.0);
    this.addWall(0, -25.0, 4.0, 0.4);

    this.registerInteractive(this.stairDoor.mesh, {
      name: "Stairwell A Blast Door",
      prompt: "Press E to Interact with Blast Door",
      onInteract: () => {
        if (!this.stairwellUnlocked) {
          audio.playWrongCode();
          window.gameInteractionModal(
            "STAIRWELL A — LOCKDOWN ENGAGED",
            `
              <div class="doc-view">
                <h3 style="color: #ef4444;">[ EMERGENCY LOCKDOWN ACTIVE ]</h3>
                <div class="clue-box">
                  <p>Stairwell A leads directly down to the Ground Floor and Hospital Escape!</p>
                  <p><strong>REMAINING PREREQUISITES:</strong></p>
                  <ul style="margin-left: 1.2rem; line-height: 1.8;">
                    <li style="color: ${this.valveTurned ? '#22c55e' : '#ef4444'};">
                      ${this.valveTurned ? '✓' : '✗'} Utility Room 203: Pressure Relief Valve Venting
                    </li>
                    <li style="color: ${this.labConsoleSolved ? '#22c55e' : '#ef4444'};">
                      ${this.labConsoleSolved ? '✓' : '✗'} Lab 202: Antidote Spectrometer Authorization
                    </li>
                  </ul>
                </div>
              </div>
            `
          );
        } else {
          this.stairDoor.interact(this.inventory);
        }
      }
    });
  }

  checkEscapeConditions() {
    if (this.valveTurned && this.labConsoleSolved && !this.stairwellUnlocked) {
      this.unlockStairwell();
    } else {
      // Update HUD Objective with remaining directive (No code numbers!)
      const objEl = document.getElementById('objective-text');
      if (objEl) {
        if (!this.valveTurned) {
          objEl.innerHTML = `<span style="color: #f59e0b; font-weight: 700;">LOCKDOWN PARTIAL:</span> Equalize toxic gas pressure in Utility 203`;
        } else if (!this.labConsoleSolved) {
          objEl.innerHTML = `<span style="color: #06b6d4; font-weight: 700;">LOCKDOWN PARTIAL:</span> Authorize Antidote Spectrometer at Lab 202`;
        }
      }
    }
  }

  unlockStairwell() {
    this.stairwellUnlocked = true;
    audio.playDoorUnlock();
    this.stairDoor.unlock();
    this.stairDoor.interact(this.inventory); // Slides / swings open automatically!

    const objEl = document.getElementById('objective-text');
    if (objEl) {
      objEl.innerHTML = `<span style="color: #22c55e; font-weight: 700;">STAIRWELL A UNLOCKED:</span> Descend Stairwell A to Ground Floor!`;
    }
  }

  checkStaircaseTrigger(playerPos) {
    if (this.floorCompleted) return;

    // Trigger zone is past Z = -21.0 in the downward staircase
    if (this.stairwellUnlocked && playerPos.z < -21.0 && Math.abs(playerPos.x) < 2.0) {
      this.floorCompleted = true;
      audio.playVictoryFanfare();

      if (this.onFloorCompleted) {
        this.onFloorCompleted(2);
      }
    }
  }

  /* --------------------------------------------------------------------------
     10. CORRIDOR PROPS & SIGNS
     -------------------------------------------------------------------------- */
  buildCorridorProps() {
    // Overturned Medical Gurney in corridor
    this.buildGurney(0.8, 10.0, 0.3);
    this.buildGurney(-0.6, -1.0, -0.2);

    // Hazard Debris / fallen ceiling panels
    const panelGeo = new THREE.BoxGeometry(0.8, 0.05, 1.2);
    const p1 = new THREE.Mesh(panelGeo, this.ceilMat);
    p1.position.set(-0.8, 0.02, 7.5);
    p1.rotation.y = 0.4;
    this.scene.add(p1);

    const p2 = new THREE.Mesh(panelGeo, this.ceilMat);
    p2.position.set(0.6, 0.02, -12.0);
    p2.rotation.y = -0.6;
    this.scene.add(p2);
  }

  buildGurney(x, z, rotY = 0) {
    const gurney = new THREE.Group();
    gurney.position.set(x, 0, z);
    gurney.rotation.y = rotY;

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.7), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
    top.position.y = 0.85;
    gurney.add(top);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 0.65), this.metalMat);
    frame.position.y = 0.4;
    gurney.add(frame);

    this.addObstacle(gurney, 1.9, 0.8, x, z);
  }

  addRoomSign(x, y, z, text, rotY = 0) {
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 96;
    const sCtx = signCanvas.getContext('2d');
    sCtx.fillStyle = '#090d16';
    sCtx.fillRect(0, 0, 256, 96);
    sCtx.strokeStyle = '#06b6d4';
    sCtx.lineWidth = 4;
    sCtx.strokeRect(2, 2, 252, 92);
    sCtx.fillStyle = '#f8fafc';
    sCtx.font = 'bold 22px "JetBrains Mono", monospace';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillText(text, 128, 48);
    const sTex = new THREE.CanvasTexture(signCanvas);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.26), new THREE.MeshBasicMaterial({ map: sTex }));
    sign.position.set(x, y, z);
    sign.rotation.y = rotY;
    this.scene.add(sign);
  }

  /* --------------------------------------------------------------------------
     11. CLEANUP & RESET
     -------------------------------------------------------------------------- */
  cleanup() {
    this.doors.forEach(door => {
      if (door.dispose) door.dispose();
    });
    this.levelObjects.forEach(obj => {
      this.scene.remove(obj);
      if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose && m.dispose());
        } else if (obj.material.dispose) {
          obj.material.dispose();
        }
      }
    });
    this.levelObjects = [];
    this.colliders = [];
    this.interactiveObjects = [];
    this.doors = [];
    this.animatedLights = [];
  }

  resetFloor() {
    this.floorCompleted = false;
    this.valveTurned = false;
    this.labConsoleSolved = false;
    this.stairwellUnlocked = false;

    // Reset doors
    this.doors.forEach(door => {
      door.isOpen = false;
      door.isAnimating = false;
      door.targetAngle = 0;
      door.currentAngle = 0;
      door.pivot.rotation.y = door.initialRotY;
      if (door.collider) {
        Object.assign(door.collider, door.originalCollider);
      }
    });

    if (this.labDoor) this.labDoor.state = 'REQUIRES_KEY';
    if (this.stairDoor) this.stairDoor.state = 'LOCKED';

    // Respawn keycard if taken
    if (!this.keycardMesh) {
      this.buildLabKeycard(-6.5, 0.95, -2.0);
    }

    // Reset valve light to red
    if (this.valveBeacon) {
      this.valveBeacon.color.setHex(0xef4444);
    }

    // Reset objective
    const objEl = document.getElementById('objective-text');
    if (objEl) {
      objEl.innerHTML = `Quarantine Active &bull; Search ICU 201 & Vent Toxic Line 203`;
    }
  }

  /* --------------------------------------------------------------------------
     12. TICK UPDATE
     -------------------------------------------------------------------------- */
  update(time, delta, playerPos) {
    // Dynamic light pulsing and flickering
    this.animatedLights.forEach(item => {
      if (item.type === 'flicker') {
        const noise = Math.random() > 0.85 ? 0.2 : (0.85 + Math.random() * 0.3);
        item.light.intensity = item.baseIntensity * noise;
      } else if (item.type === 'pulse') {
        const pulse = 0.65 + 0.35 * Math.sin(time * 3.5);
        item.light.intensity = item.baseIntensity * pulse;
      }
    });

    // Update swinging doors
    this.doors.forEach(door => door.update(delta));

    // Floating keycard animation
    if (this.keycardMesh) {
      this.keycardMesh.rotation.y = time * 2.0;
      this.keycardMesh.position.y = 0.95 + Math.sin(time * 3.0) * 0.03;
    }

    // Valve wheel turning animation on interact
    if (this.isValveTurning && this.valveWheelGroup) {
      this.valveWheelGroup.rotation.x += delta * 6.0;
      if (this.valveWheelGroup.rotation.x >= Math.PI * 4) {
        this.isValveTurning = false;
      }
    }

    // Toxic smoke puff motion & hazard tracking
    if (this.gasHazeGroup) {
      this.gasHazeGroup.rotation.y = time * 0.5;
    }

    // Dynamic Toxic Gas Contamination Hazard
    if (!this.valveTurned) {
      this.toxicExposure = Math.min(100, (this.toxicExposure || 0) + delta * 2.5);
      const toxHud = document.getElementById('hud-toxic-hazard');
      const toxFill = document.getElementById('toxic-fill');
      const toxText = document.getElementById('toxic-level-text');
      const toxVig = document.getElementById('toxic-vignette');
      if (toxHud) toxHud.style.display = 'block';
      if (toxFill) toxFill.style.width = `${Math.round(this.toxicExposure)}%`;
      if (toxText) toxText.textContent = `${Math.round(this.toxicExposure)}%`;
      if (toxVig) toxVig.style.opacity = `${(this.toxicExposure / 100) * 0.7}`;
    } else {
      if (this.toxicExposure > 0) {
        this.toxicExposure = Math.max(0, this.toxicExposure - delta * 25);
        const toxHud = document.getElementById('hud-toxic-hazard');
        const toxVig = document.getElementById('toxic-vignette');
        if (toxVig) toxVig.style.opacity = `${(this.toxicExposure / 100) * 0.7}`;
        if (this.toxicExposure <= 0 && toxHud) {
          toxHud.style.display = 'none';
        }
      }
    }

    // Check staircase exit trigger
    if (playerPos) {
      this.checkStaircaseTrigger(playerPos);
    }
  }

  /* --------------------------------------------------------------------------
     14. CLEANUP METHOD
     -------------------------------------------------------------------------- */
  cleanup() {
    const toxHud = document.getElementById('hud-toxic-hazard');
    if (toxHud) toxHud.style.display = 'none';
    const toxVig = document.getElementById('toxic-vignette');
    if (toxVig) toxVig.style.opacity = '0';
    this.toxicExposure = 0;

    this.doors.forEach(door => {
      if (door.mesh) this.scene.remove(door.mesh);
    });
    this.levelObjects.forEach(obj => {
      this.scene.remove(obj);
      if (obj.geometry) {
        try { obj.geometry.dispose(); } catch (e) {}
      }
      if (obj.material) {
        try {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        } catch (e) {}
      }
    });
    this.levelObjects = [];
    this.colliders = [];
    this.animatedLights = [];
    this.interactiveObjects = [];
    this.doors = [];
  }
}

