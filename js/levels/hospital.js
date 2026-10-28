import * as THREE from 'three';
import { audio } from '../audio.js';
import { Door } from '../doorSystem.js';

/* ==========================================================================
   DO OR DIE — Level 1: Hospital Floor 1 (Advanced Trauma & Containment Ward)
   Redesigned: High-tech aesthetic, atmospheric lighting & multi-part puzzle
   ========================================================================== */

export class HospitalFloor3 {
  constructor(scene, inventory, puzzleSystem, onFloorCompleted) {
    this.scene = scene;
    this.inventory = inventory;
    this.puzzleSystem = puzzleSystem;
    this.onFloorCompleted = onFloorCompleted;

    this.colliders = [];          // Solid AABB bounding boxes
    this.animatedLights = [];     // Dynamic lights & emergency beacons
    this.interactiveObjects = []; // Raycastable items
    this.doors = [];              // Interactive swinging doors
    this.levelObjects = [];       // Tracked for clean disposal

    // Puzzle State
    this.passAcquired = false;        // Tier-1 Security Pass
    this.powerRestored = false;       // Auxiliary Grid Reactor state
    this.mainframeUnlocked = false;   // Central Terminal override state
    this.floorCompleted = false;

    // Dynamic prop animations
    this.serverLeds = [];
    this.strobeBeacon = null;
    this.reactorCoils = [];
    this.ecgOffset = 0;

    // Capture all scene objects for clean transition disposal
    const origSceneAdd = this.scene.add.bind(this.scene);
    this.scene.add = (...objs) => {
      this.levelObjects.push(...objs);
      return origSceneAdd(...objs);
    };

    this.createMaterials();
    this.buildArchitecture();
    this.buildDoors();
    this.buildRoom101();          // Trauma Suite 101 (Start Room)
    this.buildRoom102();          // Cryo Diagnostics 102 (Cipher Part 2)
    this.buildRoom103();          // Engineering Power Core 103 (Reactor Lever)
    this.buildNurseCommand();     // Central Nurse Command & Mainframe (Code 5289)
    this.buildCorridorProps();    // Signage, Troffers, Defibrillators
    this.buildNorthHazard();      // North Containment Fire Barrier
    this.buildStaircaseExit();    // South Exit Blast Door to Floor 2

    this.scene.add = origSceneAdd;
  }

  /* --------------------------------------------------------------------------
     1. PROCEDURAL HIGH-END MATERIALS & TEXTURES
     -------------------------------------------------------------------------- */
  createMaterials() {
    // 1. Polished Hospital Porcelain Tile (Glossy Specular Terrazzo)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fCtx = floorCanvas.getContext('2d');
    fCtx.fillStyle = '#0f172a';
    fCtx.fillRect(0, 0, 512, 512);

    // Subtle marble speckling
    for (let i = 0; i < 2000; i++) {
      fCtx.fillStyle = Math.random() > 0.5 ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.06)';
      fCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Beveled tile seams with subtle specular glow
    fCtx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    fCtx.lineWidth = 3;
    const tSize = 128;
    for (let x = 0; x <= 512; x += tSize) {
      fCtx.beginPath(); fCtx.moveTo(x, 0); fCtx.lineTo(x, 512); fCtx.stroke();
    }
    for (let y = 0; y <= 512; y += tSize) {
      fCtx.beginPath(); fCtx.moveTo(0, y); fCtx.lineTo(512, y); fCtx.stroke();
    }

    this.floorTex = new THREE.CanvasTexture(floorCanvas);
    this.floorTex.wrapS = THREE.RepeatWrapping;
    this.floorTex.wrapT = THREE.RepeatWrapping;
    this.floorTex.repeat.set(6, 11);

    // 2. Central Corridor Runner with Glowing Cyan Neon Borders
    const corrCanvas = document.createElement('canvas');
    corrCanvas.width = 256;
    corrCanvas.height = 256;
    const crCtx = corrCanvas.getContext('2d');
    crCtx.fillStyle = '#050914';
    crCtx.fillRect(0, 0, 256, 256);
    // Neon edge lighting
    crCtx.fillStyle = '#0284c7';
    crCtx.fillRect(0, 0, 16, 256);
    crCtx.fillRect(240, 0, 16, 256);
    crCtx.fillStyle = '#38bdf8';
    crCtx.fillRect(4, 0, 8, 256);
    crCtx.fillRect(244, 0, 8, 256);
    // Dynamic directional chevrons
    crCtx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    for (let y = 30; y < 256; y += 64) {
      crCtx.beginPath();
      crCtx.moveTo(100, y); crCtx.lineTo(128, y + 24); crCtx.lineTo(156, y);
      crCtx.lineTo(148, y); crCtx.lineTo(128, y + 16); crCtx.lineTo(108, y);
      crCtx.fill();
    }

    this.corrTex = new THREE.CanvasTexture(corrCanvas);
    this.corrTex.wrapS = THREE.RepeatWrapping;
    this.corrTex.wrapT = THREE.RepeatWrapping;
    this.corrTex.repeat.set(1, 11);

    // 3. Modern Medical Architectural Wall Paneling
    const wallCanvas = document.createElement('canvas');
    wallCanvas.width = 512;
    wallCanvas.height = 512;
    const wCtx = wallCanvas.getContext('2d');
    // Crisp medical antimicrobial composite wall (top 68%)
    wCtx.fillStyle = '#cbd5e1';
    wCtx.fillRect(0, 0, 512, 340);
    // Subtle panel gradient
    const grad = wCtx.createLinearGradient(0, 0, 0, 340);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
    grad.addColorStop(1, 'rgba(148, 163, 184, 0.2)');
    wCtx.fillStyle = grad;
    wCtx.fillRect(0, 0, 512, 340);

    // Dark alloy protective crash rail (middle 8%)
    wCtx.fillStyle = '#1e293b';
    wCtx.fillRect(0, 340, 512, 32);
    // Glowing cyan laser groove
    wCtx.fillStyle = '#00f0ff';
    wCtx.fillRect(0, 334, 512, 6);
    wCtx.fillStyle = '#38bdf8';
    wCtx.fillRect(0, 332, 512, 2);

    // Heavy graphite kickplate (bottom 24%)
    wCtx.fillStyle = '#0f172a';
    wCtx.fillRect(0, 372, 512, 140);

    // Vertical architectural panel seams
    wCtx.strokeStyle = 'rgba(100, 116, 139, 0.6)';
    wCtx.lineWidth = 3;
    wCtx.beginPath(); wCtx.moveTo(256, 0); wCtx.lineTo(256, 340); wCtx.stroke();
    wCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    wCtx.lineWidth = 1;
    wCtx.beginPath(); wCtx.moveTo(258, 0); wCtx.lineTo(258, 340); wCtx.stroke();

    this.wallTex = new THREE.CanvasTexture(wallCanvas);
    this.wallTex.wrapS = THREE.RepeatWrapping;
    this.wallTex.wrapT = THREE.RepeatWrapping;

    // 4. Recessed Acoustic Grid Ceiling
    const ceilCanvas = document.createElement('canvas');
    ceilCanvas.width = 256;
    ceilCanvas.height = 256;
    const cCtx = ceilCanvas.getContext('2d');
    cCtx.fillStyle = '#0f172a';
    cCtx.fillRect(0, 0, 256, 256);
    cCtx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    cCtx.lineWidth = 3;
    cCtx.strokeRect(4, 4, 248, 248);
    this.ceilTex = new THREE.CanvasTexture(ceilCanvas);
    this.ceilTex.wrapS = THREE.RepeatWrapping;
    this.ceilTex.wrapT = THREE.RepeatWrapping;
    this.ceilTex.repeat.set(8, 14);

    // 5. Door Panel Texture (Heavy Alloy Electronic Door)
    const doorCanvas = document.createElement('canvas');
    doorCanvas.width = 256;
    doorCanvas.height = 512;
    const dCtx = doorCanvas.getContext('2d');
    dCtx.fillStyle = '#1e293b';
    dCtx.fillRect(0, 0, 256, 512);
    dCtx.strokeStyle = '#0284c7';
    dCtx.lineWidth = 6;
    dCtx.strokeRect(12, 12, 232, 488);
    // Glass viewing pane
    dCtx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    dCtx.fillRect(40, 48, 176, 130);
    dCtx.strokeStyle = '#38bdf8';
    dCtx.lineWidth = 3;
    dCtx.strokeRect(40, 48, 176, 130);
    // Lower protective kickplate
    dCtx.fillStyle = '#334155';
    dCtx.fillRect(20, 380, 216, 90);
    this.doorTex = new THREE.CanvasTexture(doorCanvas);

    // 6. Dynamic Animated ECG Heartbeat Monitor Canvas
    this.ecgCanvas = document.createElement('canvas');
    this.ecgCanvas.width = 256;
    this.ecgCanvas.height = 128;
    this.ecgCtx = this.ecgCanvas.getContext('2d');
    this.ecgTex = new THREE.CanvasTexture(this.ecgCanvas);

    // Material Instances
    this.floorMat = new THREE.MeshStandardMaterial({
      map: this.floorTex,
      roughness: 0.18,
      metalness: 0.25
    });

    this.corrFloorMat = new THREE.MeshStandardMaterial({
      map: this.corrTex,
      roughness: 0.15,
      metalness: 0.35
    });

    this.wallMat = new THREE.MeshStandardMaterial({
      map: this.wallTex,
      roughness: 0.6,
      metalness: 0.1
    });

    this.ceilMat = new THREE.MeshStandardMaterial({
      map: this.ceilTex,
      roughness: 0.85
    });

    this.chromeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.15
    });

    this.darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.35
    });

    this.cyanGlowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.2
    });

    this.emeraldGlowMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 1.3
    });

    this.amberGlowMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.2
    });

    this.redGlowMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 1.2
    });

    this.glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      roughness: 0.08,
      metalness: 0.1
    });

    this.ecgScreenMat = new THREE.MeshBasicMaterial({
      map: this.ecgTex
    });
  }

  /* --------------------------------------------------------------------------
     2. ARCHITECTURAL HELPERS & COLLIDERS
     -------------------------------------------------------------------------- */
  addWall(x, z, width, length, height = 3.6) {
    const geo = new THREE.BoxGeometry(width, height, length);
    const majorDim = Math.max(width, length);
    const repeatCount = Math.max(1, Math.round(majorDim / 2.5));

    // Per-wall crisp UV texture tiling
    const wallTex = this.wallTex.clone();
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    wallTex.repeat.set(repeatCount, 1);
    wallTex.needsUpdate = true;

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.35,
      metalness: 0.2
    });

    const wall = new THREE.Mesh(geo, wallMat);
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

  addWallHeader(x, z, width, length, y, height) {
    const geo = new THREE.BoxGeometry(width, height, length);
    const mesh = new THREE.Mesh(geo, this.wallMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
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
      name: data.name || "Interactive Unit",
      prompt: data.prompt || "Press E to interact",
      description: data.description || null,
      onInteract: data.onInteract || null
    };
    this.interactiveObjects.push(item);
    return item;
  }

  /* --------------------------------------------------------------------------
     3. ARCHITECTURAL LAYOUT & LIGHTING
     -------------------------------------------------------------------------- */
  buildArchitecture() {
    const H = 3.6;

    // 1. Central Corridor Floor (5m wide x 42m long, terminates flush at Z = 20.0 blast door)
    const corrFloor = new THREE.Mesh(new THREE.PlaneGeometry(5, 42), this.corrFloorMat);
    corrFloor.rotation.x = -Math.PI / 2;
    corrFloor.position.set(0, 0, -1.0);
    corrFloor.receiveShadow = true;
    this.scene.add(corrFloor);

    // 2. West Wing Floor (Room 101 & Nurse Command)
    const westFloor = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 44), this.floorMat);
    westFloor.rotation.x = -Math.PI / 2;
    westFloor.position.set(-6.75, 0, 0);
    westFloor.receiveShadow = true;
    this.scene.add(westFloor);

    // 3. East Wing Floor (Room 102 & Engineering 103)
    const eastFloor = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 44), this.floorMat);
    eastFloor.rotation.x = -Math.PI / 2;
    eastFloor.position.set(6.75, 0, 0);
    eastFloor.receiveShadow = true;
    this.scene.add(eastFloor);

    // 4. Overhead Drop-Ceiling
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(22, 44), this.ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, H, 0);
    this.scene.add(ceil);

    // 5. Exterior Outer Perimeter Walls
    this.addWall(-11.0, 0, 0.4, 44, H); // West outer boundary
    this.addWall(11.0, 0, 0.4, 44, H);  // East outer boundary
    this.addWall(0, -22.0, 22.4, 0.4, H); // North outer wall
    
    // South outer walls flush with corridor at Z = 20.0
    this.addWall(-6.75, 20.0, 8.5, 0.4, H); // West segment (X: -11 to -2.5)
    this.addWall(6.75, 20.0, 8.5, 0.4, H);  // East segment (X: 2.5 to 11)

    // 6. Corridor Division Walls & Doorway Openings (Seamless Doorway Alignments)
    // West Corridor Wall (X = -2.5): Room 101 Doorway at Z = -7.7 to -6.3, Nurse Station Opening at Z = 6.0 to 10.0
    this.addWall(-2.5, -14.85, 0.3, 14.3, H); // North wall to Room 101 (Z = -22.0 to -7.7)
    this.addWallHeader(-2.5, -7.0, 0.3, 1.4, 2.95, 1.3); // Doorway lintel header above Room 101
    this.addWall(-2.5, -0.15, 0.3, 12.3, H);  // Wall between Room 101 and Nurse Station (Z = -6.3 to 6.0)
    this.addWallHeader(-2.5, 8.0, 0.3, 4.0, 3.1, 1.0);   // Arch header above Nurse Station counter
    this.addWall(-2.5, 15.0, 0.3, 10.0, H);   // Wall south of Nurse Station to Z = 20.0

    // 6b. Nurse Command Gateway Entrance (Open 4.0m Walkthrough Breezeway from Z = 6.0 to 10.0)
    // Architectural Portal Trim Pillars at North and South edges of opening
    const portalTrimMat = this.darkMetalMat;
    const jambNorth = new THREE.Mesh(new THREE.BoxGeometry(0.36, H, 0.12), portalTrimMat);
    jambNorth.position.set(-2.5, H / 2, 6.0);
    this.scene.add(jambNorth);

    const jambSouth = new THREE.Mesh(new THREE.BoxGeometry(0.36, H, 0.12), portalTrimMat);
    jambSouth.position.set(-2.5, H / 2, 10.0);
    this.scene.add(jambSouth);

    // Glowing Cyan Portal Waypoint Floor Strips leading from corridor into Nurse Command
    const guideStripGeo = new THREE.PlaneGeometry(4.0, 0.12);
    const guideStrip = new THREE.Mesh(guideStripGeo, this.cyanGlowMat);
    guideStrip.rotation.x = -Math.PI / 2;
    guideStrip.position.set(-4.5, 0.02, 8.0);
    this.scene.add(guideStrip);

    // Architectural Overhead Gateway Signboard
    const nwCanvas = document.createElement('canvas');
    nwCanvas.width = 512;
    nwCanvas.height = 96;
    const nwCtx = nwCanvas.getContext('2d');
    nwCtx.fillStyle = '#0f172a';
    nwCtx.fillRect(0, 0, 512, 96);
    nwCtx.strokeStyle = '#0284c7';
    nwCtx.lineWidth = 4;
    nwCtx.strokeRect(4, 4, 504, 88);
    nwCtx.fillStyle = '#38bdf8';
    nwCtx.font = 'bold 28px sans-serif';
    nwCtx.textAlign = 'center';
    nwCtx.textBaseline = 'middle';
    nwCtx.fillText('◄ NURSE COMMAND 3 • MAIN CONTROL ►', 256, 48);
    const nwTex = new THREE.CanvasTexture(nwCanvas);

    const gatewaySign = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.45, 3.2),
      new THREE.MeshStandardMaterial({ map: nwTex })
    );
    gatewaySign.position.set(-2.34, 2.8, 8.0);
    this.scene.add(gatewaySign);

    // Portal Downlight Troffer (Illuminating the entrance walkway)
    this.addCeilingTroffer(-2.5, H - 0.05, 8.0, 0x38bdf8, 1.4);

    // East Corridor Wall (X = 2.5): Room 102 Doorway at Z = -7.7 to -6.3, Room 103 Doorway at Z = 8.3 to 9.7
    this.addWall(2.5, -14.85, 0.3, 14.3, H); // North wall to Room 102 (Z = -22.0 to -7.7)
    this.addWallHeader(2.5, -7.0, 0.3, 1.4, 2.95, 1.3); // Doorway lintel header above Room 102
    this.addWall(2.5, 1.0, 0.3, 14.6, H);    // Wall between Room 102 and Room 103 (Z = -6.3 to 8.3)
    this.addWallHeader(2.5, 9.0, 0.3, 1.4, 2.95, 1.3);  // Doorway lintel header above Room 103
    this.addWall(2.5, 14.85, 0.3, 10.3, H);  // Wall south of Room 103 to Z = 20.0 (Z = 9.7 to 20.0)

    // Room Partition Walls
    this.addWall(-6.75, 0, 8.5, 0.3, H); // Partition: Room 101 / Nurse Command
    this.addWall(6.75, 0, 8.5, 0.3, H);  // Partition: Room 102 / Engineering 103

    // 7. Ambient & Ceiling Illumination
    const amb = new THREE.AmbientLight(0x1e293b, 1.35);
    this.scene.add(amb);

    // Floor and Ceiling LED Neon Accent Strips along Corridor
    const ledMat = this.cyanGlowMat;
    const floorStripWest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 44), ledMat);
    floorStripWest.position.set(-2.45, 0.02, 0);
    this.scene.add(floorStripWest);

    const floorStripEast = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 44), ledMat);
    floorStripEast.position.set(2.45, 0.02, 0);
    this.scene.add(floorStripEast);

    const ceilStripWest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 44), ledMat);
    ceilStripWest.position.set(-2.45, H - 0.02, 0);
    this.scene.add(ceilStripWest);

    const ceilStripEast = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 44), ledMat);
    ceilStripEast.position.set(2.45, H - 0.02, 0);
    this.scene.add(ceilStripEast);

    // Recessed Clean Troffers down Corridor
    [-16, -10, -4, 2, 8, 14, 18].forEach(z => {
      this.addCeilingTroffer(0, H - 0.05, z, 0xf0f9ff, 1.4);
    });

    // Emergency Strobe Beacon at South Corridor
    const beacon = new THREE.PointLight(0xef4444, 2.0, 14, 1.8);
    beacon.position.set(0, H - 0.3, 16);
    this.scene.add(beacon);
    this.strobeBeacon = beacon;
    this.animatedLights.push({ light: beacon, baseIntensity: 2.0, type: 'pulse' });
  }

  addCeilingTroffer(x, y, z, colorHex, intensity) {
    const fixtureGeo = new THREE.BoxGeometry(1.6, 0.08, 0.6);
    const fixtureMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixture.position.set(x, y, z);
    this.scene.add(fixture);

    const light = new THREE.PointLight(colorHex, intensity, 9, 1.4);
    light.position.set(x, y - 0.2, z);
    this.scene.add(light);
  }

  /* --------------------------------------------------------------------------
     4. INTERACTIVE DOORS
     -------------------------------------------------------------------------- */
  buildDoors() {
    // Room 101 Door (Trauma Suite Entrance - Unlocked)
    const door101 = new Door({
      scene: this.scene,
      x: -2.5, y: 0, z: -7.7,
      rotationY: -Math.PI / 2,
      openAngle: -Math.PI / 2,
      width: 1.4,
      height: 2.3,
      doorTex: this.doorTex,
      state: 'UNLOCKED',
      name: 'Trauma 101 Door',
      collidersList: this.colliders
    });
    this.doors.push(door101);
    this.registerInteractive(door101.mesh, {
      name: "Trauma 101 Door",
      prompt: "Press E to open/close Door",
      onInteract: () => door101.interact(this.inventory)
    });

    // Room 102 Door (Cryo Diagnostics - Unlocked)
    const door102 = new Door({
      scene: this.scene,
      x: 2.5, y: 0, z: -7.7,
      rotationY: -Math.PI / 2,
      openAngle: Math.PI / 2,
      width: 1.4,
      height: 2.3,
      doorTex: this.doorTex,
      state: 'UNLOCKED',
      name: 'Diagnostics 102 Door',
      collidersList: this.colliders
    });
    this.doors.push(door102);
    this.registerInteractive(door102.mesh, {
      name: "Diagnostics 102 Door",
      prompt: "Press E to open/close Door",
      onInteract: () => door102.interact(this.inventory)
    });

    // Room 103 Door (Engineering Power Matrix - REQUIRES TIER-1 PASS)
    this.engDoor = new Door({
      scene: this.scene,
      x: 2.5, y: 0, z: 8.3,
      rotationY: -Math.PI / 2,
      openAngle: Math.PI / 2,
      width: 1.4,
      height: 2.3,
      doorTex: this.doorTex,
      state: 'REQUIRES_KEY',
      keyId: 'pass_tier1',
      lockMessage: 'Engineering Core sealed. Requires "Tier-1 Medical Security Pass" from Trauma Suite 101.',
      name: 'Engineering 103 Door',
      collidersList: this.colliders
    });
    this.doors.push(this.engDoor);
    this.registerInteractive(this.engDoor.mesh, {
      name: "Engineering 103 Vault Door",
      prompt: "Press E to scan Pass and unlock Door",
      onInteract: () => this.engDoor.interact(this.inventory)
    });
  }

  /* --------------------------------------------------------------------------
     5. ROOM 101: ADVANCED TRAUMA SUITE (START ROOM)
     -------------------------------------------------------------------------- */
  buildRoom101() {
    const light = new THREE.PointLight(0x38bdf8, 1.4, 11, 1.3);
    light.position.set(-6.5, 3.2, -7.0);
    this.scene.add(light);

    // High-Tech Cryo Stasis Pods
    this.buildTraumaPod(-8.5, 0, -10.5);
    this.buildTraumaPod(-8.5, 0, -3.5);

    // Primary Life-Support Console (Dispenses Security Pass)
    const consoleGeo = new THREE.BoxGeometry(0.8, 1.1, 0.6);
    const consoleMesh = new THREE.Mesh(consoleGeo, this.darkMetalMat);
    consoleMesh.position.set(-4.5, 0.55, -11.0);
    this.addObstacle(consoleMesh, 0.8, 0.6);

    // Glowing Screen on Console
    const scrGeo = new THREE.PlaneGeometry(0.5, 0.35);
    const scrMesh = new THREE.Mesh(scrGeo, this.cyanGlowMat);
    scrMesh.position.set(-4.5, 0.9, -10.68);
    this.scene.add(scrMesh);

    this.registerInteractive(consoleMesh, {
      name: "Life-Support Console",
      prompt: "Press E to inspect Trauma Console",
      onInteract: () => {
        if (!this.passAcquired) {
          this.passAcquired = true;
          this.inventory.addItem({
            id: 'pass_tier1',
            name: 'Tier-1 Security Pass',
            icon: '💳',
            description: 'Authorizes access to Engineering Power Vault 303.'
          });
          audio.playItemPickup();

          const objEl = document.getElementById('objective-text');
          if (objEl) {
            objEl.innerHTML = `<span style="color: #38bdf8; font-weight: 700;">PASS ACQUIRED:</span> Unlock Engineering Core 303 &bull; Calibrate Reactor Power`;
          }

          window.gameInteractionModal(
            "TRAUMA SUITE 301 — RECOVERY LOG",
            `
              <div class="doc-view">
                <div class="doc-header">
                  <span class="doc-tag" style="background: rgba(14, 165, 233, 0.2); border-color: #38bdf8; color: #38bdf8;">✓ SECURITY PASS ACQUIRED</span>
                  <span class="doc-date">DIAGNOSTIC STATUS: BIO-LOCK</span>
                </div>
                <h3>[ FACILITY LOCKDOWN DETECTED ]</h3>
                <p>You extract the <strong>Tier-1 Medical Security Pass</strong> from the terminal slot!</p>
                <div class="clue-box" style="border-left-color: #38bdf8; color: #bae6fd; background: rgba(56, 189, 248, 0.1);">
                  <strong>FACILITY RECOVERY PROCEDURE:</strong>
                  <p>1. Use Tier-1 Pass to enter <strong>Engineering Vault 303</strong> and restore Auxiliary Power.<br>
                  2. Investigate ward diagnostics to decrypt the Central Command blast gate cipher.</p>
                </div>
              </div>
            `
          );
        } else {
          window.gameInteractionModal(
            "LIFE-SUPPORT CONSOLE",
            `
              <div class="doc-view">
                <p>Status: Tier-1 Security Pass already collected. Proceed to Engineering 303 across the corridor!</p>
              </div>
            `
          );
        }
      }
    });

    // Illuminated X-Ray Lightbox (Cipher Clue: First half is 52)
    const lightbox = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.08), this.cyanGlowMat);
    lightbox.position.set(-10.75, 2.0, -7.0);
    lightbox.rotation.y = Math.PI / 2;
    this.scene.add(lightbox);

    this.registerInteractive(lightbox, {
      name: "Illuminated Trauma Lightbox",
      prompt: "Press E to read Lightbox Cipher Clue",
      description: `
        <div class="doc-view">
          <div class="doc-header">
            <span class="doc-tag">TELEMETRY CIPHER [1 OF 2]</span>
            <span class="doc-date">TRAUMA UNIT 301</span>
          </div>
          <h3>SECURITY OVERRIDE CIPHER [PREFIX]</h3>
          <p>A diagnostic monitor telemetry chart is clipped to the lightbox:</p>
          <div class="clue-box" style="border-left-color: #38bdf8; color: #38bdf8; background: rgba(14, 165, 233, 0.15);">
            <h2 style="margin: 0; font-family: monospace; letter-spacing: 0.2em;">"OVERRIDE CIPHER: 5 2 _ _"</h2>
            <p>Diagnostic Reference: Patient #301 intracranial baseline stabilized at 52 kPa.</p>
          </div>
        </div>
      `
    });

    this.addRoomSign(-2.34, 2.4, -6.5, 'TRAUMA 301', Math.PI / 2);

    // 3D Trauma Surgical Bed with Articulated Quad-Lamp
    this.buildHospitalBed(-8.0, -7.0);
  }

  buildHospitalBed(x, z) {
    const bedGroup = new THREE.Group();
    bedGroup.position.set(x, 0, z);

    // Chrome tubular undercarriage
    const baseMat = this.chromeMat;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 2.4), baseMat);
    frame.position.y = 0.5;
    bedGroup.add(frame);

    // 4 Caster Wheels
    [[-0.5, -1.0], [0.5, -1.0], [-0.5, 1.0], [0.5, 1.0]].forEach(([cx, cz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45), baseMat);
      leg.position.set(cx, 0.25, cz);
      bedGroup.add(leg);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04), this.darkMetalMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(cx, 0.06, cz);
      bedGroup.add(wheel);
    });

    // Clean White Upholstered Mattress
    const mattressMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 2.3), mattressMat);
    mattress.position.y = 0.67;
    bedGroup.add(mattress);

    // Raised Headrest / Pillow
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }));
    pillow.position.set(0, 0.82, -0.8);
    bedGroup.add(pillow);

    // Stainless Steel Side Guard Rails
    [-0.58, 0.58].forEach(rx => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 1.4), baseMat);
      rail.position.set(rx, 0.88, 0);
      bedGroup.add(rail);
    });

    // IV Drip Stand beside Bed
    const ivStand = new THREE.Group();
    ivStand.position.set(0.8, 0, -0.6);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2), baseMat);
    pole.position.y = 1.1;
    ivStand.add(pole);
    // Translucent Saline Infusion Bag
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55, roughness: 0.1 });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.08), bagMat);
    bag.position.set(0, 1.95, 0);
    ivStand.add(bag);
    bedGroup.add(ivStand);

    // Overhead Articulating Surgical Quad-Lamp
    const lampGroup = new THREE.Group();
    lampGroup.position.set(0, 3.4, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8), baseMat);
    arm.position.y = -0.4;
    lampGroup.add(arm);

    const headMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.2 });
    const lampHead = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16), headMat);
    lampHead.position.y = -0.85;
    lampGroup.add(lampHead);

    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    lens.rotation.x = Math.PI / 2;
    lens.position.y = -0.91;
    lampGroup.add(lens);

    const surgLight = new THREE.SpotLight(0xffffff, 3.5, 8, Math.PI / 6, 0.3, 1.2);
    surgLight.position.set(0, -0.9, 0);
    surgLight.target.position.set(0, -3.0, 0);
    lampGroup.add(surgLight);
    lampGroup.add(surgLight.target);
    bedGroup.add(lampGroup);

    this.addObstacle(bedGroup, 1.5, 2.6, x, z);
  }

  /* --------------------------------------------------------------------------
     6. ROOM 102: CRYO DIAGNOSTICS & RESEARCH (CIPHER PART 2)
     -------------------------------------------------------------------------- */
  buildRoom102() {
    const light = new THREE.PointLight(0x06b6d4, 1.3, 11, 1.2);
    light.position.set(6.5, 3.2, -7.0);
    this.scene.add(light);

    // Cryo Containment Cylinders
    this.buildCryoCylinder(9.5, 0, -11.0);
    this.buildCryoCylinder(9.5, 0, -4.0);

    // Diagnostics Centrifuge Desk
    const deskGeo = new THREE.BoxGeometry(2.4, 0.9, 0.8);
    const desk = new THREE.Mesh(deskGeo, this.darkMetalMat);
    desk.position.set(6.5, 0.45, -11.0);
    this.addObstacle(desk, 2.4, 0.8);

    // Diagnostic Terminal on Desk (Cipher Clue: Last half is 89)
    const diagTerm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.3), this.chromeMat);
    diagTerm.position.set(6.5, 1.1, -11.0);
    this.scene.add(diagTerm);

    this.registerInteractive(diagTerm, {
      name: "Diagnostics Mainframe Terminal",
      prompt: "Press E to inspect Diagnostics Terminal",
      description: `
        <div class="doc-view">
          <div class="doc-header">
            <span class="doc-tag" style="background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #34d399;">TELEMETRY CIPHER [2 OF 2]</span>
            <span class="doc-date">DIAGNOSTICS LAB 302</span>
          </div>
          <h3>SECURITY OVERRIDE CIPHER [SUFFIX]</h3>
          <p>Terminal displays the secondary emergency authorization sequence:</p>
          <div class="clue-box" style="border-left-color: #10b981; color: #a7f3d0; background: rgba(16, 185, 129, 0.15);">
            <h2 style="margin: 0; font-family: monospace; letter-spacing: 0.2em;">"OVERRIDE CIPHER: _ _ 8 9"</h2>
            <p>Spectrometer Analysis: Cryo Coolant Isotope marker 89.<br>
            Combine with Trauma Ward telemetry prefix to authorize the Central Mainframe blast door release.</p>
          </div>
        </div>
      `
    });

    this.addRoomSign(2.34, 2.4, -6.5, 'DIAGNOSTICS 302', -Math.PI / 2);
  }

  /* --------------------------------------------------------------------------
     7. ROOM 103: ENGINEERING POWER CORE & AUXILIARY REACTOR
     -------------------------------------------------------------------------- */
  buildRoom103() {
    this.engLight = new THREE.PointLight(0xef4444, 1.2, 12, 1.4); // Red until power restored
    this.engLight.position.set(6.5, 3.2, 9.0);
    this.scene.add(this.engLight);

    // Massive High-Voltage Transformer
    const coreGroup = new THREE.Group();
    coreGroup.position.set(9.5, 0, 9.0);

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.6, 2.2), this.darkMetalMat);
    body.position.y = 1.3;
    coreGroup.add(body);

    // 3 Plasma Reactor Coils (Alpha, Beta, Gamma)
    [-0.6, 0, 0.6].forEach((offsetZ, idx) => {
      const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.6, 16), this.redGlowMat);
      coil.position.set(-0.75, 1.3, offsetZ);
      coreGroup.add(coil);
      this.reactorCoils.push(coil);
    });

    this.addObstacle(coreGroup, 1.8, 2.4, 9.5, 9.0);

    // Primary High-Voltage Knife Switch / Relay Panel
    const switchPanel = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.8), this.chromeMat);
    switchPanel.position.set(4.5, 1.6, 13.0);
    this.scene.add(switchPanel);

    this.registerInteractive(switchPanel, {
      name: "Plasma Reactor Control Matrix",
      prompt: "Press E to calibrate & engage Auxiliary Power",
      onInteract: () => {
        if (!this.powerRestored) {
          if (this.puzzleSystem) {
            this.puzzleSystem.openReactorPuzzle({
              title: "PLASMA REACTOR HARMONIC MATRIX",
              onSolved: () => {
                this.powerRestored = true;
                audio.playDoorUnlock();

                // Transform reactor coils & lights to vibrant green & cyan!
                this.reactorCoils.forEach(coil => coil.material = this.emeraldGlowMat);
                this.engLight.color.setHex(0x10b981);
                this.engLight.intensity = 2.0;

                if (this.strobeBeacon) {
                  this.strobeBeacon.color.setHex(0x0ea5e9);
                }

                const objEl = document.getElementById('objective-text');
                if (objEl) {
                  objEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">POWER ONLINE:</span> Decrypt security protocols at Nurse Command Mainframe!`;
                }

                this.inventory.showToast("⚡ AUXILIARY POWER ONLINE: Central Mainframe Energized!");
              }
            });
          }
        } else {
          window.gameInteractionModal(
            "REACTOR STATUS",
            `
              <div class="doc-view">
                <h3 style="color: #10b981;">AUXILIARY CORE: 100% OPERATIONAL</h3>
                <p>Grid power is synchronized. Proceed to Nurse Command across the corridor to authorize blast door evacuation!</p>
              </div>
            `
          );
        }
      }
    });

    this.addRoomSign(2.34, 2.4, 7.5, 'ENGINEERING 303', -Math.PI / 2);
  }

  /* --------------------------------------------------------------------------
     8. CENTRAL NURSE COMMAND & MAINFRAME TERMINAL (CODE 5289)
     -------------------------------------------------------------------------- */
  buildNurseCommand() {
    const light = new THREE.PointLight(0x38bdf8, 1.5, 12, 1.2);
    light.position.set(-6.5, 3.2, 9.0);
    this.scene.add(light);

    // Curved High-Tech Reception Island Desk
    const deskGroup = new THREE.Group();
    deskGroup.position.set(-6.5, 0, 8.5);

    const deskCounter = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1.05, 32, 1, false, 0, Math.PI), this.darkMetalMat);
    deskCounter.position.y = 0.525;
    deskGroup.add(deskCounter);

    const glassTop = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.05, 32, 1, false, 0, Math.PI), this.glassMat);
    glassTop.position.y = 1.075;
    deskGroup.add(glassTop);

    this.addObstacle(deskGroup, 5.0, 2.6, -6.5, 8.5);

    // Central Security Mainframe Terminal
    const termGeo = new THREE.BoxGeometry(0.8, 0.6, 0.2);
    const termMesh = new THREE.Mesh(termGeo, this.chromeMat);
    termMesh.position.set(-6.5, 1.35, 7.5);
    this.scene.add(termMesh);

    // Interactive Screen on Mainframe
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.45), this.cyanGlowMat);
    scr.position.set(-6.5, 1.35, 7.39);
    scr.rotation.y = Math.PI;
    this.scene.add(scr);

    // Invisible generous hit volume for Mainframe Terminal (1.2m x 1.0m x 0.8m)
    const termHitGeo = new THREE.BoxGeometry(1.2, 1.0, 0.8);
    const termHitMat = new THREE.MeshBasicMaterial({ visible: false });
    const termHitBox = new THREE.Mesh(termHitGeo, termHitMat);
    termHitBox.position.set(-6.5, 1.35, 7.5);
    this.scene.add(termHitBox);

    const mainframeConfig = {
      name: "Central Security Mainframe",
      prompt: "Press E to access Mainframe Keypad",
      onInteract: () => {
        if (!this.powerRestored) {
          audio.playWrongCode();
          window.gameInteractionModal(
            "TERMINAL ERROR — POWER OFFLINE",
            `
              <div class="doc-view">
                <p style="color: #ef4444; font-weight: bold;">[ CRITICAL: AUXILIARY POWER OFFLINE ]</p>
                <p>Central Mainframe cannot disengage the Exit Blast Door without reactor power.</p>
                <div class="clue-box" style="border-left-color: #ef4444; color: #fca5a5; background: rgba(239, 68, 68, 0.1);">
                  <strong>REQUIRED ACTION:</strong>
                  <p>1. Find Tier-1 Security Pass in Trauma 301.<br>
                  2. Enter Engineering Vault 303 and calibrate the Reactor Power Grid.</p>
                </div>
              </div>
            `
          );
        } else if (this.mainframeUnlocked) {
          window.gameInteractionModal(
            "SECURITY OVERRIDE CONFIRMED",
            `
              <div class="doc-view">
                <h3 style="color: #10b981;">✓ BLAST DOOR LOCKDOWN DISENGAGED</h3>
                <p>Emergency Stairwell Blast Door is open at the south corridor. Proceed through the stairs to descend into Floor 2!</p>
              </div>
            `
          );
        } else {
          // Open 4-digit code puzzle (5289)
          if (this.puzzleSystem) {
            this.puzzleSystem.openCodePuzzle({
              title: "CENTRAL COMMAND BLAST OVERRIDE",
              correctCode: "5289",
              codeLength: 4,
              statusText: "ENTER 4-DIGIT FACILITY OVERRIDE",
              onSolved: () => {
                this.unlockExitBlastGate();
              }
            });
          }
        }
      }
    };

    this.registerInteractive(termMesh, mainframeConfig);
    this.registerInteractive(scr, mainframeConfig);
    this.registerInteractive(termHitBox, mainframeConfig);

    // Server Towers with Blinking Activity LEDs
    this.buildServerRack(-9.8, 0, 5.0);
    this.buildServerRack(-9.8, 0, 7.5);
    this.buildServerRack(-9.8, 0, 10.0);

    this.addRoomSign(-2.34, 2.4, 5.5, 'NURSE COMMAND 3', Math.PI / 2);
  }

  /* --------------------------------------------------------------------------
     9. 3D PROPS & HOSPITAL DETAILS
     -------------------------------------------------------------------------- */
  buildTraumaPod(x, y, z) {
    const pod = new THREE.Group();
    pod.position.set(x, y, z);

    // Metallic Base Frame
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 1.2), this.darkMetalMat);
    base.position.y = 0.25;
    pod.add(base);

    // Glowing Under-Chassis Strip
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.1), this.cyanGlowMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.y = 0.02;
    pod.add(glow);

    // Stasis Mattress Cushion
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.2, 1.1), new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }));
    cushion.position.y = 0.58;
    pod.add(cushion);

    // Articulated Monitor Arm & ECG Screen
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2), this.chromeMat);
    arm.position.set(-0.9, 1.1, 0.55);
    pod.add(arm);

    const screenBox = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.05), this.chromeMat);
    screenBox.position.set(-0.9, 1.7, 0.55);
    pod.add(screenBox);

    const ecgFace = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.24), this.ecgScreenMat);
    ecgFace.position.set(-0.9, 1.7, 0.52);
    pod.add(ecgFace);

    this.addObstacle(pod, 2.4, 1.2, x, z);
  }

  buildCryoCylinder(x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.3, 24), this.darkMetalMat);
    base.position.y = 0.15;
    group.add(base);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.3, 24), this.darkMetalMat);
    cap.position.y = 2.45;
    group.add(cap);

    // Transparent Glass Cylinder Tube
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.0, 24), this.glassMat);
    tube.position.y = 1.3;
    group.add(tube);

    // Glowing Inner Fluid Core
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 16), this.cyanGlowMat);
    core.position.y = 1.3;
    group.add(core);

    this.addObstacle(group, 1.1, 1.1, x, z);
  }

  buildServerRack(x, y, z) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.4, 1.0), this.darkMetalMat);
    rack.position.set(x, 1.2, z);
    this.addObstacle(rack, 0.8, 1.0);

    // LED Blinking Matrix
    for (let i = 0; i < 4; i++) {
      const led = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), this.emeraldGlowMat);
      led.position.set(x + 0.41, 1.8 - i * 0.2, z - 0.2 + (i % 2) * 0.4);
      led.rotation.y = Math.PI / 2;
      this.scene.add(led);
      this.serverLeds.push(led);
    }
  }

  buildCorridorProps() {
    // Wall Defibrillator Unit at Corridor Z = 4.0
    const defib = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.45), this.redGlowMat);
    defib.position.set(-2.38, 1.6, 4.0);
    this.scene.add(defib);

    this.registerInteractive(defib, {
      name: "Emergency Defibrillator",
      prompt: "Press E to inspect Defibrillator",
      description: `
        <div class="doc-view">
          <h3>AUTOMATED EXTERNAL DEFIBRILLATOR</h3>
          <p>Charge Level: 100%. Pad impedance verified. Ready for emergency cardiac resuscitation.</p>
        </div>
      `
    });

    // Overhead Directional Signage (Z = 2.0)
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 96;
    const sCtx = signCanvas.getContext('2d');
    sCtx.fillStyle = '#0f172a';
    sCtx.fillRect(0, 0, 512, 96);
    sCtx.strokeStyle = '#38bdf8';
    sCtx.lineWidth = 4;
    sCtx.strokeRect(4, 4, 504, 88);
    sCtx.fillStyle = '#38bdf8';
    sCtx.font = 'bold 26px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillText('← TRAUMA 101 | NURSE & POWER MATRIX →', 256, 48);

    const signTex = new THREE.CanvasTexture(signCanvas);
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.2 });
    const overheadSign = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.5, 0.08), signMat);
    overheadSign.position.set(0, 3.1, 2.0);
    this.scene.add(overheadSign);
  }

  addRoomSign(x, y, z, text, rotY) {
    const sCanvas = document.createElement('canvas');
    sCanvas.width = 256;
    sCanvas.height = 80;
    const ctx = sCanvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 80);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 40);

    const tex = new THREE.CanvasTexture(sCanvas);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.28, 0.04), new THREE.MeshStandardMaterial({ map: tex }));
    sign.position.set(x, y, z);
    sign.rotation.y = rotY;
    this.scene.add(sign);
  }

  /* --------------------------------------------------------------------------
     10. NORTH CONTAINMENT FIRE BARRIER
     -------------------------------------------------------------------------- */
  buildNorthHazard() {
    const hazardGroup = new THREE.Group();
    hazardGroup.position.set(0, 0, -21.0);

    const gateMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.8, roughness: 0.3 });
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.4, 0.4), gateMat);
    barrier.position.y = 1.7;
    hazardGroup.add(barrier);

    const warningStripe = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 0.42), this.amberGlowMat);
    warningStripe.position.y = 1.6;
    hazardGroup.add(warningStripe);

    this.scene.add(hazardGroup);
    this.colliders.push({ minX: -2.5, maxX: 2.5, minZ: -22.0, maxZ: -20.5 });
  }

  /* --------------------------------------------------------------------------
     11. EXIT BLAST DOOR & 3D DESCENT STAIRWELL (Airtight Seamless Enclosure)
     -------------------------------------------------------------------------- */
  /* --------------------------------------------------------------------------
     11. EXIT BLAST DOOR & 3D DESCENT STAIRWELL (Airtight Seamless Enclosure)
     -------------------------------------------------------------------------- */
  buildStaircaseExit() {
    const archMat = this.darkMetalMat;

    // 1. Full-Width Archway Bulkheads at Z = 20.0 (Spans X: -2.8 to -1.1 and X: 1.1 to 2.8)
    const archLeft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.6, 0.6), archMat);
    archLeft.position.set(-1.85, 1.8, 20.0);
    this.scene.add(archLeft);
    this.colliders.push({ minX: -2.8, maxX: -1.05, minZ: 19.4, maxZ: 20.6 });

    const archRight = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.6, 0.6), archMat);
    archRight.position.set(1.85, 1.8, 20.0);
    this.scene.add(archRight);
    this.colliders.push({ minX: 1.05, maxX: 2.8, minZ: 19.4, maxZ: 20.6 });

    // Archway Overhead Lintel
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.8, 0.6), archMat);
    archTop.position.set(0, 3.2, 20.0);
    this.scene.add(archTop);

    // 2. Left and Right Sliding Heavy Blast Gate Panels
    this.blastGateLeft = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 0.2), this.chromeMat);
    this.blastGateLeft.position.set(-0.55, 1.4, 20.0);
    this.scene.add(this.blastGateLeft);

    this.blastGateRight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 0.2), this.chromeMat);
    this.blastGateRight.position.set(0.55, 1.4, 20.0);
    this.scene.add(this.blastGateRight);

    // 3. Illuminated Status Bar above Door (Red until unlocked)
    this.exitStatusBar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 0.08), this.redGlowMat);
    this.exitStatusBar.position.set(0, 2.75, 19.68);
    this.scene.add(this.exitStatusBar);

    // 4. Luminous Evacuation Signboard above Blast Door
    const eCanvas = document.createElement('canvas');
    eCanvas.width = 512;
    eCanvas.height = 128;
    const eCtx = eCanvas.getContext('2d');
    eCtx.fillStyle = '#0f172a';
    eCtx.fillRect(0, 0, 512, 128);
    eCtx.strokeStyle = '#10b981';
    eCtx.lineWidth = 6;
    eCtx.strokeRect(6, 6, 500, 116);
    eCtx.fillStyle = '#34d399';
    eCtx.font = 'bold 32px sans-serif';
    eCtx.textAlign = 'center';
    eCtx.textBaseline = 'middle';
    eCtx.fillText('EMERGENCY STAIRWELL B', 256, 42);
    eCtx.font = 'bold 24px sans-serif';
    eCtx.fillText('↓ DESCENT TO FLOOR 2 (ICU & LABS) ↓', 256, 88);

    const eTex = new THREE.CanvasTexture(eCanvas);
    const exitSign = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.55, 0.06), new THREE.MeshStandardMaterial({ map: eTex }));
    exitSign.position.set(0, 3.25, 19.68);
    this.scene.add(exitSign);

    // Blast Door Solid Center Collider (Overlap prevents any corner clipping)
    this.exitDoorCollider = { minX: -1.2, maxX: 1.2, minZ: 19.2, maxZ: 20.8 };
    this.colliders.push(this.exitDoorCollider);

    // 5. Airtight 3D Stairwell Chamber Walls (Directly flush with archway inner faces X = ±1.1)
    // West Stairwell Massive Solid Wall (X: -1.1 to -2.7, Z: 20.0 to 28.0)
    const westStairWall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.0, 8.0), archMat);
    westStairWall.position.set(-1.9, 1.8, 24.0);
    this.scene.add(westStairWall);
    this.colliders.push({ minX: -2.8, maxX: -1.05, minZ: 20.0, maxZ: 28.0 });

    // East Stairwell Massive Solid Wall (X: 1.1 to 2.7, Z: 20.0 to 28.0)
    const eastStairWall = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.0, 8.0), archMat);
    eastStairWall.position.set(1.9, 1.8, 24.0);
    this.scene.add(eastStairWall);
    this.colliders.push({ minX: 1.05, maxX: 2.8, minZ: 20.0, maxZ: 28.0 });

    // South Back Wall Terminating Stairwell at Z = 28.0 (Spans full X: -2.8 to 2.8)
    const southStairWall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 4.0, 0.8), archMat);
    southStairWall.position.set(0, 1.8, 28.0);
    this.scene.add(southStairWall);
    this.colliders.push({ minX: -2.8, maxX: 2.8, minZ: 27.6, maxZ: 28.5 });

    // Continuous Under-Stair Solid Floor Ramp (Zero void, completely solid base)
    const underSlab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 8.0), this.darkMetalMat);
    underSlab.position.set(0, -1.6, 24.0);
    underSlab.rotation.x = Math.atan2(-2.6, 6.0);
    this.scene.add(underSlab);

    // Overhead Drop Ceiling over Stairwell
    const stairCeil = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 8.0), this.ceilMat);
    stairCeil.rotation.x = Math.PI / 2;
    stairCeil.position.set(0, 3.6, 24.0);
    this.scene.add(stairCeil);

    // 6. Deep 3D Downward Steps (Flush against walls, X = -1.1 to +1.1)
    const stepCount = 10;
    const stepDepth = 0.58;
    const stepHeight = 0.26;
    for (let i = 0; i < stepCount; i++) {
      const stepY = -0.13 - i * stepHeight;
      const stepZ = 20.4 + i * stepDepth;

      const step = new THREE.Mesh(new THREE.BoxGeometry(2.15, stepHeight, stepDepth), this.darkMetalMat);
      step.position.set(0, stepY, stepZ);
      step.receiveShadow = true;
      this.scene.add(step);

      // Glowing emerald nosing tread along step edge
      const edge = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.02, 0.05), this.emeraldGlowMat);
      edge.position.set(0, stepY + stepHeight / 2 + 0.01, stepZ - stepDepth / 2 + 0.025);
      this.scene.add(edge);
    }

    // Handrails along Stairwell Descent
    [-1.0, 1.0].forEach(rx => {
      const railMat = this.chromeMat;
      const railGeo = new THREE.BoxGeometry(0.06, 0.06, 6.2);
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(rx, 0.4, 23.5);
      rail.rotation.x = Math.atan2(-2.6, 6.0);
      this.scene.add(rail);

      for (let pz = 21.0; pz <= 26.0; pz += 1.6) {
        const postH = 0.85;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, postH), railMat);
        const t = (pz - 20.6) / (10 * 0.58);
        const postY = -t * 2.6 + postH / 2;
        post.position.set(rx, postY, pz);
        this.scene.add(post);
      }
    });

    // 7. Emerald Emergency Exit Lights Illuminating Descent
    const stairLight1 = new THREE.PointLight(0x10b981, 2.2, 12, 1.2);
    stairLight1.position.set(0, 2.4, 22.0);
    this.scene.add(stairLight1);

    const stairLight2 = new THREE.PointLight(0x10b981, 1.8, 10, 1.2);
    stairLight2.position.set(0, 1.0, 25.5);
    this.scene.add(stairLight2);
  }

  unlockExitBlastGate() {
    this.mainframeUnlocked = true;
    audio.playPuzzleSolved();

    // Visual transformation: Emerald Green
    if (this.exitStatusBar) {
      this.exitStatusBar.material = this.emeraldGlowMat;
    }

    // Slide blast door panels wide open!
    if (this.blastGateLeft) this.blastGateLeft.position.x = -1.8;
    if (this.blastGateRight) this.blastGateRight.position.x = 1.8;

    // Remove center door collider so player can step through
    const idx = this.colliders.indexOf(this.exitDoorCollider);
    if (idx !== -1) {
      this.colliders.splice(idx, 1);
    }

    const objEl = document.getElementById('objective-text');
    if (objEl) {
      objEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">EVACUATION ROUTE OPEN:</span> Descend South Stairwell into Floor 2!`;
    }

    if (this.inventory) {
      this.inventory.showToast("🔓 STAIRWELL B BLAST GATE OPEN — EVACUATE SOUTH!");
    }
  }

  checkStaircaseTrigger(playerPos) {
    if (this.floorCompleted) return;

    // Immediate trigger upon stepping past blast gate threshold when unlocked
    if (this.mainframeUnlocked && playerPos.z >= 20.3) {
      this.floorCompleted = true;
      audio.playPuzzleSolved();

      if (this.onFloorCompleted) {
        this.onFloorCompleted(3);
      }
    }
  }

  /* --------------------------------------------------------------------------
     12. TICK UPDATE & ANIMATIONS
     -------------------------------------------------------------------------- */
  update(time, delta, playerPos) {
    // 1. Animated ECG Heartbeat Monitor Screen (30 FPS Canvas Refresh)
    this.ecgOffset += delta * 80;
    if (this.ecgOffset > 256) this.ecgOffset = 0;
    this.ecgTimer = (this.ecgTimer || 0) + delta;
    if (this.ecgTimer >= 0.033) {
      this.ecgTimer = 0;
      this.drawECG();
    }

    // 2. Rotating Emergency Strobe Light
    if (this.strobeBeacon) {
      this.strobeBeacon.position.x = Math.sin(time * 3.0) * 1.5;
    }

    // 3. Flashing Server Activity LEDs
    this.serverLeds.forEach((led, idx) => {
      const active = Math.sin(time * 8.0 + idx * 1.5) > 0.1;
      led.visible = active;
    });

    // 4. Update swinging doors
    this.doors.forEach(door => door.update(delta));

    // 5. Check exit staircase descent trigger
    if (playerPos) {
      this.checkStaircaseTrigger(playerPos);
    }
  }

  drawECG() {
    const ctx = this.ecgCtx;
    if (!ctx) return;

    ctx.fillStyle = 'rgba(2, 6, 23, 0.2)';
    ctx.fillRect(0, 0, 256, 128);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 64);

    const ox = this.ecgOffset;
    for (let x = 0; x < 256; x += 4) {
      const phase = (x + ox) % 120;
      let y = 64;
      if (phase > 40 && phase < 48) y = 45;
      else if (phase >= 48 && phase < 56) y = 15;
      else if (phase >= 56 && phase < 64) y = 90;
      else if (phase >= 64 && phase < 72) y = 64;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('VITALS: 78 BPM', 10, 20);

    if (this.ecgTex) {
      this.ecgTex.needsUpdate = true;
    }
  }

  resetFloor() {
    this.passAcquired = false;
    this.powerRestored = false;
    this.mainframeUnlocked = false;
    this.floorCompleted = false;

    if (this.blastGateLeft) this.blastGateLeft.position.x = -0.65;
    if (this.blastGateRight) this.blastGateRight.position.x = 0.65;
    if (this.exitStatusBar) this.exitStatusBar.material = this.redGlowMat;

    if (!this.colliders.includes(this.exitDoorCollider)) {
      this.colliders.push(this.exitDoorCollider);
    }

    this.reactorCoils.forEach(coil => coil.material = this.redGlowMat);
    if (this.engLight) this.engLight.color.setHex(0xef4444);
    if (this.strobeBeacon) this.strobeBeacon.color.setHex(0xef4444);
  }

  /* --------------------------------------------------------------------------
     13. CLEANUP METHOD
     -------------------------------------------------------------------------- */
  cleanup() {
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
    this.serverLeds = [];
    this.reactorCoils = [];
  }
}
