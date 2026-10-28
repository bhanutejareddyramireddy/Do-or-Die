import * as THREE from 'three';
import { audio } from '../audio.js';
import { Door } from '../doorSystem.js';

/* ==========================================================================
   DO OR DIE — Level 1: Hospital Ground Floor (Grand Triage & Evacuation Bay)
   Physical 3D Pickable Items, Perfect Door Alignments, & Intuitive Circuit Puzzle
   ========================================================================== */

export class HospitalFloor1 {
  constructor(scene, inventory, puzzleSystem, onFloorCompleted, player = null) {
    this.scene = scene;
    this.inventory = inventory;
    this.puzzleSystem = puzzleSystem;
    this.onFloorCompleted = onFloorCompleted;
    this.player = player;

    this.colliders = [];          // Solid AABB bounding boxes
    this.animatedLights = [];     // Dynamic lights
    this.interactiveObjects = []; // Raycastable items
    this.doors = [];              // Interactive swinging doors
    this.levelObjects = [];       // Tracked for clean destruction
    this.serverLeds = [];

    // Ground Floor State
    this.directorCardAcquired = false;   // Physical 3D Keycard
    this.circuitBypassSolved = false;    // Security Command Wire Bypass
    this.blastGateOpen = false;          // Courtyard Blast Gates state
    this.floorCompleted = false;

    // Pickable 3D Item Meshes
    this.keycardGroup = null;
    this.adrenalineGroup = null;

    // Outdoor rain & thunderstorm FX
    this.rainParticles = null;
    this.lightningTimer = 0;
    this.lightningLight = null;
    this.ambulanceSirenLight1 = null;
    this.ambulanceSirenLight2 = null;

    // Intercept scene.add to capture all objects for disposal
    const origSceneAdd = this.scene.add.bind(this.scene);
    this.scene.add = (...objs) => {
      this.levelObjects.push(...objs);
      return origSceneAdd(...objs);
    };

    this.createMaterials();
    this.buildArrivalCorridor();       // From Stairwell A (Z = 20 to 5)
    this.buildGrandLobby();            // Central Triage & Reception (Z = 5 to -16, X = -10 to 10)
    this.buildSecurityCommand();       // West Wing: CCTV Video Wall & Master Grid Console (X = -10 to -20)
    this.buildPharmacy();              // East Wing: Pickable Keycard & Medicine Dispensary (X = 10 to 20)
    this.buildCourtyardAndAmbulance(); // North Wing: Rainy Outdoor Evacuation Bay (Z = -16 to -38)
    this.buildLobbyProps();            // Gurneys, seating lounge, directory plaques

    // Restore original scene.add
    this.scene.add = origSceneAdd;
  }

  setPlayer(player) {
    this.player = player;
  }

  /* --------------------------------------------------------------------------
     1. PROCEDURAL TEXTURES & MATERIALS
     -------------------------------------------------------------------------- */
  createMaterials() {
    // 1. Polished Lobby Obsidian Granite Checker Floor
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fCtx = floorCanvas.getContext('2d');
    fCtx.fillStyle = '#080c14';
    fCtx.fillRect(0, 0, 512, 512);

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if ((r + c) % 2 === 0) {
          fCtx.fillStyle = '#141d2e';
          fCtx.fillRect(c * 128, r * 128, 128, 128);
        }
      }
    }
    fCtx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    fCtx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) {
      fCtx.beginPath(); fCtx.moveTo(0, i); fCtx.lineTo(512, i); fCtx.stroke();
      fCtx.beginPath(); fCtx.moveTo(i, 0); fCtx.lineTo(i, 512); fCtx.stroke();
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(4, 5);

    this.graniteFloorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.22,
      metalness: 0.35
    });

    // 2. Wet Courtyard Asphalt
    const aspCanvas = document.createElement('canvas');
    aspCanvas.width = 256;
    aspCanvas.height = 256;
    const aCtx = aspCanvas.getContext('2d');
    aCtx.fillStyle = '#070a10';
    aCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2400; i++) {
      aCtx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.45)';
      aCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    const aspTex = new THREE.CanvasTexture(aspCanvas);
    aspTex.wrapS = THREE.RepeatWrapping;
    aspTex.wrapT = THREE.RepeatWrapping;
    aspTex.repeat.set(6, 6);
    this.asphaltMat = new THREE.MeshStandardMaterial({
      map: aspTex,
      roughness: 0.18,
      metalness: 0.45
    });

    // 3. Hospital Wall & Architectural Materials
    this.wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
    this.wallTrimMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 });
    this.ceilMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95 });
    this.metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.25 });
    this.darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.35 });
    this.chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.12 });

    // Emissive Conduit Light Materials
    this.amberGlowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 1.2 });
    this.greenGlowMat = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x10b981, emissiveIntensity: 1.3 });
    this.redGlowMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.3 });
    this.cyanGlowMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, emissive: 0x06b6d4, emissiveIntensity: 1.4 });
    this.glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4, roughness: 0.08 });

    // 4. Heavy Reinforced Door Texture
    const dCanvas = document.createElement('canvas');
    dCanvas.width = 256;
    dCanvas.height = 512;
    const dCtx = dCanvas.getContext('2d');
    dCtx.fillStyle = '#0f172a';
    dCtx.fillRect(0, 0, 256, 512);
    dCtx.strokeStyle = '#38bdf8';
    dCtx.lineWidth = 6;
    dCtx.strokeRect(16, 16, 224, 480);
    dCtx.fillStyle = '#f59e0b';
    for (let x = 20; x < 236; x += 32) {
      dCtx.fillRect(x, 240, 16, 32);
    }
    this.doorTex = new THREE.CanvasTexture(dCanvas);
  }

  addObstacle(mesh, width, depth, x = null, z = null) {
    if (x !== null && z !== null) {
      mesh.position.set(x, mesh.position.y, z);
    }
    this.scene.add(mesh);
    const px = mesh.position.x;
    const pz = mesh.position.z;
    this.colliders.push({
      minX: px - width / 2,
      maxX: px + width / 2,
      minZ: pz - depth / 2,
      maxZ: pz + depth / 2
    });
  }

  addWall(x, z, width, depth, height = 4.0) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, this.wallMat);
    mesh.position.set(x, height / 2, z);
    this.addObstacle(mesh, width, depth);
    return mesh;
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

  registerInteractive(mesh, config) {
    mesh.userData.isInteractive = true;
    mesh.userData.interaction = config;
    const item = {
      mesh: mesh,
      id: config.id || null,
      name: config.name || "Object",
      prompt: config.prompt || "Press E to interact",
      description: config.description || null,
      onInteract: config.onInteract || null
    };
    this.interactiveObjects.push(item);
    return item;
  }

  removeInteractive(mesh) {
    const idx = this.interactiveObjects.findIndex(item => (item.mesh === mesh || item === mesh));
    if (idx !== -1) {
      this.interactiveObjects.splice(idx, 1);
    }
  }

  /* --------------------------------------------------------------------------
     2. ARRIVAL CORRIDOR (FROM STAIRWELL A: Z = 20 to 5)
     -------------------------------------------------------------------------- */
  buildArrivalCorridor() {
    // Floor
    const flGeo = new THREE.PlaneGeometry(4.4, 15.0);
    const floor = new THREE.Mesh(flGeo, this.graniteFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 12.5);
    this.scene.add(floor);

    // Ceiling
    const cGeo = new THREE.PlaneGeometry(4.4, 15.0);
    const ceil = new THREE.Mesh(cGeo, this.ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 4.0, 12.5);
    this.scene.add(ceil);

    // South wall behind arrival point (Z = 20)
    this.addWall(0, 20.2, 4.8, 0.4);

    // West Corridor Wall
    this.addWall(-2.4, 12.5, 0.4, 15.0);

    // East Corridor Wall
    this.addWall(2.4, 12.5, 0.4, 15.0);

    // Overhead Emergency Red Strobe Beacon
    const beacon = new THREE.PointLight(0xef4444, 2.4, 14, 1.8);
    beacon.position.set(0, 3.6, 14.0);
    this.scene.add(beacon);
    this.animatedLights.push({ light: beacon, baseIntensity: 2.4, type: 'pulse' });

    // Directional Corridor Plaque
    this.addPlaqueSign(0, 3.2, 19.5, "GROUND FLOOR • EMERGENCY TRIAGE & BAY ↓", 0);
  }

  /* --------------------------------------------------------------------------
     3. GRAND TRIAGE & ADMISSIONS LOBBY (Z = 5 to -16, X = -10 to 10)
     -------------------------------------------------------------------------- */
  buildGrandLobby() {
    // Grand Lobby Floor (20m x 21m)
    const flGeo = new THREE.PlaneGeometry(20.0, 21.0);
    const floor = new THREE.Mesh(flGeo, this.graniteFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -5.5);
    this.scene.add(floor);

    // Grand Lobby 4.4m High Ceiling with Skylight
    const cGeo = new THREE.PlaneGeometry(20.0, 21.0);
    const ceil = new THREE.Mesh(cGeo, this.ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, 4.4, -5.5);
    this.scene.add(ceil);

    // Central Glass Skylight
    const skyGeo = new THREE.PlaneGeometry(8.0, 8.0);
    const skylight = new THREE.Mesh(skyGeo, this.glassMat);
    skylight.rotation.x = Math.PI / 2;
    skylight.position.set(0, 4.41, -5.5);
    this.scene.add(skylight);

    // Skylight Lightning Flash Source
    this.lightningLight = new THREE.DirectionalLight(0xa5f3fc, 0.25);
    this.lightningLight.position.set(2, 22, -5);
    this.scene.add(this.lightningLight);

    // South lobby boundary walls (connecting from corridor)
    this.addWall(-6.2, 5.0, 8.0, 0.4);
    this.addWall(6.2, 5.0, 8.0, 0.4);

    // West lobby boundary walls with seamless 1.4m doorway opening (Z = -10.3 to -11.7) for Security Command
    this.addWall(-10.0, 0.0, 0.4, 10.0);   // South section (Z = -5.0 to +5.0)
    this.addWall(-10.0, -7.65, 0.4, 5.3); // Mid section (Z = -5.0 to -10.3)
    this.addWallHeader(-10.0, -11.0, 0.4, 1.4, 3.3, 1.4); // Doorway lintel header
    this.addWall(-10.0, -14.35, 0.4, 5.3);// North section (Z = -11.7 to -17.0)

    // East lobby boundary walls with seamless 1.4m doorway opening (Z = -10.3 to -11.7) for Pharmacy
    this.addWall(10.0, 0.0, 0.4, 10.0);    // South section (Z = -5.0 to +5.0)
    this.addWall(10.0, -7.65, 0.4, 5.3);  // Mid section (Z = -5.0 to -10.3)
    this.addWallHeader(10.0, -11.0, 0.4, 1.4, 3.3, 1.4); // Doorway lintel header
    this.addWall(10.0, -14.35, 0.4, 5.3); // North section (Z = -11.7 to -17.0)

    // North blast wall (separates Lobby from Courtyard)
    this.addWall(-6.5, -16.0, 7.0, 0.6);
    this.addWall(6.5, -16.0, 7.0, 0.6);
    this.addWallHeader(0, -16.0, 4.0, 0.6, 3.8, 0.8); // Lintel above blast gates

    // Glowing Recessed Floor Navigation Conduits
    this.buildFloorConduits();

    // Central Circular Triage Island Desk
    this.buildTriageDesk(0, -5.5);

    // Ambient Lobby Lights
    const lobLight1 = new THREE.PointLight(0x38bdf8, 1.8, 18, 1.6);
    lobLight1.position.set(-4.0, 3.8, -2.0);
    this.scene.add(lobLight1);

    const lobLight2 = new THREE.PointLight(0xf59e0b, 1.6, 18, 1.6);
    lobLight2.position.set(4.0, 3.8, -9.0);
    this.scene.add(lobLight2);

    this.animatedLights.push({ light: lobLight1, baseIntensity: 1.8, type: 'flicker' });
  }

  buildFloorConduits() {
    // 1. Emerald Green Line: From Corridor (Z = 5) North through Lobby to Courtyard Gate (Z = -16)
    const northLineGeo = new THREE.PlaneGeometry(0.12, 21.0);
    const northLine = new THREE.Mesh(northLineGeo, this.greenGlowMat);
    northLine.rotation.x = -Math.PI / 2;
    northLine.position.set(0, 0.02, -5.5);
    this.scene.add(northLine);

    // 2. Cyan Line: Branches West at Z = -11.0 to West Security Command (X = 0 to -10)
    const westLineGeo = new THREE.PlaneGeometry(10.0, 0.12);
    const westLine = new THREE.Mesh(westLineGeo, this.cyanGlowMat);
    westLine.rotation.x = -Math.PI / 2;
    westLine.position.set(-5.0, 0.025, -11.0);
    this.scene.add(westLine);

    // 3. Radiant Amber Line: Branches East at Z = -11.0 to East Clinical Pharmacy (X = 0 to 10)
    const eastLineGeo = new THREE.PlaneGeometry(10.0, 0.12);
    const eastLine = new THREE.Mesh(eastLineGeo, this.amberGlowMat);
    eastLine.rotation.x = -Math.PI / 2;
    eastLine.position.set(5.0, 0.025, -11.0);
    this.scene.add(eastLine);

    // Wayfinding Overhead Signs
    this.addPlaqueSign(-5.0, 3.6, -11.0, "← WEST SECURITY COMMAND", 0);
    this.addPlaqueSign(5.0, 3.6, -11.0, "EAST CLINICAL PHARMACY →", 0);
  }

  buildTriageDesk(x, z) {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(x, 0, z);

    // Curved front reception counter
    const counter = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.5, 1.15, 28, 1, false, 0, Math.PI),
      this.darkMetalMat
    );
    counter.position.y = 0.575;
    deskGroup.add(counter);

    // Top brushed metal cap
    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(2.55, 2.55, 0.06, 28, 1, false, 0, Math.PI),
      this.metalMat
    );
    topCap.position.y = 1.18;
    deskGroup.add(topCap);

    // Inner desk shelf
    const innerShelf = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.1, 2.0), this.metalMat);
    innerShelf.position.set(0, 0.88, 0.2);
    deskGroup.add(innerShelf);

    // Multi-Display Terminal Rack
    for (let i = -1; i <= 1; i++) {
      const screenBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.08), this.darkMetalMat);
      screenBase.position.set(i * 0.9, 1.25, 0.2);
      deskGroup.add(screenBase);

      const screenFace = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.44), i === 0 ? this.redGlowMat : this.cyanGlowMat);
      screenFace.position.set(i * 0.9, 1.25, 0.25);
      deskGroup.add(screenFace);
    }

    this.addObstacle(deskGroup, 5.2, 3.4, x, z);

    // Interactive Triage Dispatch Terminal
    const centralScreen = deskGroup.children[4];
    this.registerInteractive(centralScreen, {
      name: "Triage Dispatch Terminal",
      prompt: "Press E to read Emergency Evacuation Orders",
      onInteract: () => {
        audio.playDocumentOpen();
        window.gameInteractionModal(
          "COUNTY EMERGENCY HEALTH ADVISORY",
          `
            <div class="doc-view">
              <div class="doc-header">
                <span class="doc-tag" style="background: rgba(239, 68, 68, 0.2); border-color: #ef4444; color: #ef4444;">⚠ BIO-HAZARD LOCKDOWN</span>
                <span class="doc-date">DIRECTOR DR. VANCE</span>
              </div>
              <h3>EMERGENCY PERIMETER LOCKDOWN INITIATED</h3>
              <p>All hospital ground level blast gates have sealed under Quarantine Protocol Omega-7.</p>
              <div class="clue-box" style="border-left-color: #38bdf8; background: rgba(56, 189, 248, 0.1); color: #bae6fd;">
                <strong>EXTRACTION DIRECTIVE:</strong>
                <p>1. <strong>East Clinical Pharmacy:</strong> Pick up the glowing <strong>Director RFID Keycard</strong> from the dispensary desk.<br>
                2. <strong>West Security Command:</strong> Unlock the security bunker using the Director Keycard.<br>
                3. Access the <strong>Hydraulic Circuit Bypass</strong> console in Security Command to link the 4 colored conduits and unlock the Courtyard Blast Gates!<br>
                4. <strong>Courtyard:</strong> Sprint to the county evacuation ambulance!</p>
              </div>
            </div>
          `
        );
      }
    });

    // Interactive Pickable Evacuation Orders on Desk
    const clipGeo = new THREE.BoxGeometry(0.5, 0.04, 0.6);
    const clipMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.35,
      metalness: 0.15,
      emissive: 0xd97706,
      emissiveIntensity: 0.35
    });
    const clipMesh = new THREE.Mesh(clipGeo, clipMat);
    clipMesh.position.set(0, 0.92, 0.4);
    deskGroup.add(clipMesh);
    this.clipboardMesh = clipMesh;

    // Generous pickup hitbox for effortless targeting from across the counter
    const hitBoxGeo = new THREE.BoxGeometry(1.4, 0.8, 1.4);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false, wireframe: false });
    const clipHitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    clipHitBox.position.set(0, 0.95, 0.4);
    deskGroup.add(clipHitBox);
    this.clipboardHitBox = clipHitBox;

    const onPickupClipboard = () => {
      audio.playItemPickup();
      audio.playDocumentOpen();

      this.inventory.addItem({
        id: 'doc_evacuation_orders',
        name: 'Evacuation Orders',
        icon: '📋',
        description: 'Facility Emergency Directive: The Director RFID Keycard is waiting in the East Pharmacy. Circuit Bypass is in West Security Command.'
      });

      this.inventory.showToast("+ ACQUIRED: Evacuation Orders (Check East Pharmacy)");

      // Remove from world & raycasting
      clipMesh.visible = false;
      this.removeInteractive(clipMesh);
      this.removeInteractive(clipHitBox);

      // Open document modal to show the evacuation directive clue immediately
      window.gameInteractionModal(
        "EVACUATION DIRECTIVE LOG",
        `
          <div class="doc-view">
            <div class="doc-header">
              <span class="doc-tag" style="background: rgba(245, 158, 11, 0.2); border-color: #f59e0b; color: #f59e0b;">📋 EVACUATION ORDERS ACQUIRED</span>
              <span class="doc-date">CODE BLACK DIRECTIVE</span>
            </div>
            <h3>GROUND LEVEL PROTOCOL COLLECTED</h3>
            <div class="clue-box" style="border-left-color: #fbbf24; background: rgba(251, 191, 36, 0.1); color: #fef08a;">
              <strong>NEXT DIRECTIVE — DIRECTOR RFID KEYCARD:</strong>
              <p>&bull; The <strong>Director RFID Keycard</strong> is waiting on the dispensary counter inside the <strong>EAST CLINICAL PHARMACY</strong>.</p>
              <p>&bull; Follow the <strong>Glowing Amber Floor Line</strong> branching East (to your right) to enter the Pharmacy and pick up the Director Keycard!</p>
              <p>&bull; Afterwards, head to <strong>West Security Command</strong> to link the circuits and unlock the Courtyard Blast Gates.</p>
            </div>
          </div>
        `
      );
    };

    this.onPickupClipboard = onPickupClipboard;
    this.clipConfig = {
      id: "doc_evacuation_orders",
      name: "Evacuation Orders",
      prompt: "Press E or Click to Pick Up Evacuation Orders",
      onInteract: onPickupClipboard
    };

    this.registerInteractive(clipMesh, this.clipConfig);
    this.registerInteractive(clipHitBox, this.clipConfig);
  }

  /* --------------------------------------------------------------------------
     4. SECURITY COMMAND (WEST WING: X = -10 to -20, Z = -5 to -17)
     -------------------------------------------------------------------------- */
  buildSecurityCommand() {
    // Floor
    const flGeo = new THREE.PlaneGeometry(10.0, 12.0);
    const floor = new THREE.Mesh(flGeo, this.graniteFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(-15.0, 0, -11.0);
    this.scene.add(floor);

    // Ceiling
    const cGeo = new THREE.PlaneGeometry(10.0, 12.0);
    const ceil = new THREE.Mesh(cGeo, this.ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(-15.0, 4.0, -11.0);
    this.scene.add(ceil);

    // Boundary walls
    this.addWall(-15.0, -5.0, 10.0, 0.4);  // South
    this.addWall(-15.0, -17.0, 10.0, 0.4); // North
    this.addWall(-20.0, -11.0, 0.4, 12.0); // West

    // Doorway into Security (Hinge at Z = -11.7, spans to -10.3)
    this.securityDoor = new Door({
      scene: this.scene,
      x: -10.0, y: 0, z: -11.7,
      rotationY: -Math.PI / 2,
      openAngle: -Math.PI / 2,
      width: 1.4, height: 2.6,
      doorTex: this.doorTex,
      state: 'REQUIRES_KEY',
      keyId: 'card_director',
      lockMessage: 'SECURITY COMMAND LOCKED: Requires "Director RFID Keycard" from East Pharmacy.',
      name: 'Security Command Bunker Door',
      collidersList: this.colliders
    });
    this.doors.push(this.securityDoor);

    this.registerInteractive(this.securityDoor.mesh, {
      name: "Security Command Bunker Door",
      prompt: "Press E to swipe Director Keycard",
      onInteract: () => this.securityDoor.interact(this.inventory)
    });

    this.addPlaqueSign(-9.7, 2.7, -11.0, "WEST SECURITY COMMAND", -Math.PI / 2);

    // 8-Monitor CCTV Surveillance Video Wall on West Wall
    this.buildCCTVVideoWall(-19.6, -11.0);

    // Server Cluster Towers
    this.buildServerTower(-19.2, -7.0);
    this.buildServerTower(-19.2, -15.0);

    // Master Blast Gate Hydraulic Bypass Console (Center of Room)
    this.buildMasterGridConsole(-15.0, -11.0);

    // Security Command Cyan Lighting
    const secLight = new THREE.PointLight(0x06b6d4, 1.8, 14, 1.6);
    secLight.position.set(-15.0, 3.4, -11.0);
    this.scene.add(secLight);
  }

  buildCCTVVideoWall(x, z) {
    const cctvGroup = new THREE.Group();
    cctvGroup.position.set(x, 2.0, z);

    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 4; c++) {
        const mon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 1.2), this.darkMetalMat);
        mon.position.set(0, (r - 0.5) * 0.95, (c - 1.5) * 1.35);
        cctvGroup.add(mon);

        // Glowing camera monitor screen
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.7), (r + c) % 2 === 0 ? this.cyanGlowMat : this.greenGlowMat);
        scr.rotation.y = Math.PI / 2;
        scr.position.set(0.06, (r - 0.5) * 0.95, (c - 1.5) * 1.35);
        cctvGroup.add(scr);
      }
    }
    this.scene.add(cctvGroup);
  }

  buildServerTower(x, z) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 1.2), this.darkMetalMat);
    rack.position.set(x, 1.3, z);
    this.addObstacle(rack, 0.8, 1.2);

    for (let i = 0; i < 6; i++) {
      const led = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), this.greenGlowMat);
      led.position.set(x + 0.41, 1.9 - i * 0.2, z - 0.3 + (i % 3) * 0.3);
      led.rotation.y = Math.PI / 2;
      this.scene.add(led);
      this.serverLeds.push(led);
    }
  }

  buildMasterGridConsole(x, z) {
    const consoleGroup = new THREE.Group();
    consoleGroup.position.set(x, 0, z);

    // Angled Industrial Console Desk
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 1.2), this.darkMetalMat);
    base.position.y = 0.55;
    consoleGroup.add(base);

    // Glowing Power Grid Touchscreen Matrix
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.8), this.cyanGlowMat);
    screen.position.set(0, 1.15, 0);
    screen.rotation.x = 0.25;
    consoleGroup.add(screen);

    // Overhead Status Beacon (Red until solved, green after)
    this.gridBeacon = new THREE.PointLight(0xef4444, 2.2, 8, 2);
    this.gridBeacon.position.set(0, 2.2, 0);
    consoleGroup.add(this.gridBeacon);
    this.animatedLights.push({ light: this.gridBeacon, baseIntensity: 2.2, type: 'pulse' });

    this.addObstacle(consoleGroup, 2.6, 1.4, x, z);

    // Interactive Master Console
    this.registerInteractive(screen, {
      name: "Hydraulic Gate Bypass Console",
      prompt: "Press E to open Hydraulic Circuit Bypass",
      onInteract: () => {
        if (this.circuitBypassSolved) {
          window.gameInteractionModal(
            "GATE CIRCUIT OPTIMAL",
            `
              <div class="doc-view">
                <h3 style="color: #10b981;">✓ HYDRAULIC BLAST GATES ONLINE</h3>
                <p>All 4 circuits synchronized. Courtyard blast gates are open! Proceed to the ambulance!</p>
              </div>
            `
          );
          return;
        }

        // Open Intuitive Color Circuit Wire Bypass Puzzle!
        if (this.puzzleSystem) {
          this.puzzleSystem.openCircuitPuzzle({
            onSolved: () => {
              this.handleCircuitSolved();
            }
          });
        }
      }
    });
  }

  handleCircuitSolved() {
    this.circuitBypassSolved = true;
    audio.playEmergencyAlarm();
    audio.playDoorUnlock();

    if (this.gridBeacon) {
      this.gridBeacon.color.setHex(0x10b981);
    }

    this.inventory.showToast("⚡ ALL 4 CIRCUITS LINKED — BLAST GATES OPENING!");

    const objEl = document.getElementById('objective-text');
    if (objEl) {
      objEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">GATES RELEASED:</span> Evacuate through Courtyard via Ambulance!`;
    }

    // Open Courtyard Blast Gates
    this.openCourtyardBlastGate();
  }

  /* --------------------------------------------------------------------------
     5. PHARMACY & DISPENSARY (EAST WING: X = 10 to 20, Z = -5 to -17)
     -------------------------------------------------------------------------- */
  buildPharmacy() {
    // Floor
    const flGeo = new THREE.PlaneGeometry(10.0, 12.0);
    const floor = new THREE.Mesh(flGeo, this.graniteFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(15.0, 0, -11.0);
    this.scene.add(floor);

    // Ceiling
    const cGeo = new THREE.PlaneGeometry(10.0, 12.0);
    const ceil = new THREE.Mesh(cGeo, this.ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(15.0, 4.0, -11.0);
    this.scene.add(ceil);

    // Boundary walls
    this.addWall(15.0, -5.0, 10.0, 0.4);  // South
    this.addWall(15.0, -17.0, 10.0, 0.4); // North
    this.addWall(20.0, -11.0, 0.4, 12.0); // East

    // Doorway into Pharmacy (Hinge at Z = -11.7, spans to -10.3)
    this.pharmacyDoor = new Door({
      scene: this.scene,
      x: 10.0, y: 0, z: -11.7,
      rotationY: -Math.PI / 2,
      openAngle: Math.PI / 2,
      width: 1.4, height: 2.6,
      doorTex: this.doorTex,
      state: 'OPEN',
      name: 'Pharmacy Dispensary Door',
      collidersList: this.colliders
    });
    this.doors.push(this.pharmacyDoor);

    this.registerInteractive(this.pharmacyDoor.mesh, {
      name: "Pharmacy Dispensary Door",
      prompt: "Press E to open/close Door",
      onInteract: () => this.pharmacyDoor.interact(this.inventory)
    });

    this.addPlaqueSign(9.7, 2.7, -11.0, "EAST CLINICAL PHARMACY", Math.PI / 2);

    // Medicine Shelving Cabinets
    this.buildPharmacyShelves(18.8, -8.0);
    this.buildPharmacyShelves(18.8, -14.0);

    // Cryo Containment Cylinders
    this.buildCryoCylinder(14.0, -7.0);

    // Center Dispensing Table
    const centerTable = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.4), this.darkMetalMat);
    centerTable.position.set(15.0, 0.45, -12.0);
    this.addObstacle(centerTable, 2.4, 1.4);

    // PHYSICAL 3D PICKABLE ITEMS:
    // 1. Director's Gold RFID Keycard (floating and rotating with golden aura)
    this.buildPickableKeycard(14.6, 1.05, -12.0);

    // 2. Adrenaline Syringe (on medical tray with emerald aura)
    this.buildPickableAdrenaline(15.5, 1.0, -12.0);

    // Pharmacy Ambient Green Light
    const pharmLight = new THREE.PointLight(0x10b981, 1.8, 14, 1.6);
    pharmLight.position.set(15.0, 3.4, -11.0);
    this.scene.add(pharmLight);
  }

  buildPickableKeycard(x, y, z) {
    const cardGroup = new THREE.Group();
    cardGroup.position.set(x, y, z);
    this.keycardBaseY = y;

    // Golden metallic card body
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0xd97706,
      emissiveIntensity: 0.4
    });
    const cardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.35), goldMat);
    cardGroup.add(cardMesh);

    // Chip inlay
    const chipMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.9 })
    );
    chipMesh.rotation.x = -Math.PI / 2;
    chipMesh.position.set(-0.14, 0.022, 0);
    cardGroup.add(chipMesh);

    // Invisible generous pickup hit box (1.2m x 0.8m x 1.2m)
    const hitBoxGeo = new THREE.BoxGeometry(1.2, 0.8, 1.2);
    const hitBoxMat = new THREE.MeshBasicMaterial({ visible: false, wireframe: false });
    const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
    hitBox.position.set(0, 0.15, 0);
    cardGroup.add(hitBox);

    // Radiant Golden Light
    const cardLight = new THREE.PointLight(0xfbbf24, 2.2, 4.5, 1.6);
    cardLight.position.set(0, 0.3, 0);
    cardGroup.add(cardLight);

    this.scene.add(cardGroup);
    this.keycardGroup = cardGroup;

    const onPickupCard = () => {
      if (this.directorCardAcquired) return;
      this.directorCardAcquired = true;
      audio.playItemPickup();

      this.inventory.addItem({
        id: 'card_director',
        name: 'Director RFID Keycard',
        icon: '💳',
        description: 'Executive Gold Access Card authorizing entry to West Security Command.'
      });

      this.inventory.showToast("+ ACQUIRED: Director Master Keycard");

      // Remove from world and interactive list
      this.removeInteractive(cardMesh);
      this.removeInteractive(hitBox);
      if (this.keycardGroup) {
        this.keycardGroup.visible = false;
      }

      const objEl = document.getElementById('objective-text');
      if (objEl) {
        objEl.innerHTML = `<span style="color: #38bdf8; font-weight: 700;">DIRECTOR KEYCARD ACQUIRED:</span> Unlock West Security Command & Bypass Gate Circuits!`;
      }
    };

    const cardConfig = {
      id: "card_director",
      name: "Director's Gold RFID Keycard",
      prompt: "Press E or Click to Pick Up Director Keycard",
      onInteract: onPickupCard
    };

    this.cardMesh = cardMesh;
    this.cardHitBox = hitBox;
    this.cardConfig = cardConfig;

    this.registerInteractive(cardMesh, cardConfig);
    this.registerInteractive(hitBox, cardConfig);
  }

  buildPickableAdrenaline(x, y, z) {
    const medGroup = new THREE.Group();
    medGroup.position.set(x, y, z);
    this.adrenalineBaseY = y;

    // Stainless steel medical tray
    const tray = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.45), this.chromeMat);
    medGroup.add(tray);

    // Glowing green syringe barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 12), this.greenGlowMat);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0, 0.06, 0);
    medGroup.add(barrel);

    // Invisible generous pickup hit box (1.2m x 0.8m x 1.2m)
    const medHitGeo = new THREE.BoxGeometry(1.2, 0.8, 1.2);
    const medHitMat = new THREE.MeshBasicMaterial({ visible: false, wireframe: false });
    const medHitBox = new THREE.Mesh(medHitGeo, medHitMat);
    medHitBox.position.set(0, 0.15, 0);
    medGroup.add(medHitBox);

    // Radiant Green Aura Light
    const medLight = new THREE.PointLight(0x10b981, 1.6, 3.5, 1.6);
    medLight.position.set(0, 0.25, 0);
    medGroup.add(medLight);

    this.scene.add(medGroup);
    this.adrenalineGroup = medGroup;

    const onPickupAdrenaline = () => {
      audio.playHealSound();
      if (this.player && this.player.boostAdrenaline) {
        this.player.boostAdrenaline(30);
      }
      this.inventory.showToast("⚡ ADRENALINE INJECTED: +30s Infinite Sprint!");

      this.removeInteractive(barrel);
      this.removeInteractive(tray);
      this.removeInteractive(medHitBox);
      if (this.adrenalineGroup) {
        this.scene.remove(this.adrenalineGroup);
        this.adrenalineGroup = null;
      }
    };

    const medConfig = {
      id: "medkit_adrenaline",
      name: "Adrenaline Syringe",
      prompt: "Press E to Pick Up Adrenaline Boost",
      onInteract: onPickupAdrenaline
    };

    this.registerInteractive(barrel, medConfig);
    this.registerInteractive(tray, medConfig);
    this.registerInteractive(medHitBox, medConfig);
  }

  buildPharmacyShelves(x, z) {
    const rack = new THREE.Group();
    rack.position.set(x, 0, z);

    for (let i = 0; i < 4; i++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.6), this.metalMat);
      shelf.position.y = 0.4 + i * 0.55;
      rack.add(shelf);

      // Medical serum vials
      for (let j = 0; j < 5; j++) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), this.cyanGlowMat);
        bottle.position.set((j - 2) * 0.25, shelf.position.y + 0.09, (Math.random() - 0.5) * 0.2);
        rack.add(bottle);
      }
    }
    this.addObstacle(rack, 1.8, 0.8, x, z);
  }

  buildCryoCylinder(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.3, 24), this.darkMetalMat);
    base.position.y = 0.15;
    group.add(base);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.3, 24), this.darkMetalMat);
    cap.position.y = 2.45;
    group.add(cap);

    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.0, 24), this.glassMat);
    tube.position.y = 1.3;
    group.add(tube);

    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 16), this.cyanGlowMat);
    core.position.y = 1.3;
    group.add(core);

    this.addObstacle(group, 1.1, 1.1, x, z);
  }

  /* --------------------------------------------------------------------------
     6. COURTYARD & EVACUATION AMBULANCE BAY (Z = -16 to -38)
     -------------------------------------------------------------------------- */
  buildCourtyardAndAmbulance() {
    // Massive Reinforced Blast Gates at Z = -16.0 (Width = 4.0m)
    this.blastGateDoor = new Door({
      scene: this.scene,
      x: -2.0, y: 0, z: -16.0,
      rotationY: 0,
      openAngle: -Math.PI / 2,
      width: 4.0, height: 3.6,
      doorTex: this.doorTex,
      state: 'LOCKED',
      lockMessage: 'BLAST GATES LOCKED: Link circuits at Security Command!',
      name: 'Courtyard Emergency Blast Gate',
      collidersList: this.colliders
    });
    this.doors.push(this.blastGateDoor);

    this.addPlaqueSign(0, 3.8, -15.6, "EMERGENCY EVACUATION BAY ↑", 0);

    // Outdoor Courtyard Asphalt Floor (30m x 24m)
    const courtGeo = new THREE.PlaneGeometry(30.0, 24.0);
    const asphalt = new THREE.Mesh(courtGeo, this.asphaltMat);
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(0, -0.05, -28.0);
    this.scene.add(asphalt);

    // Perimeter Concrete Blast Walls
    this.addWall(-15.0, -28.0, 0.6, 24.0, 5.0); // West
    this.addWall(15.0, -28.0, 0.6, 24.0, 5.0);  // East
    this.addWall(0, -40.0, 30.0, 0.6, 5.0);     // North

    // Rainy Night Sky Dome
    const skyMat = new THREE.MeshBasicMaterial({ color: 0x020408, side: THREE.BackSide });
    const skyDome = new THREE.Mesh(new THREE.BoxGeometry(42, 28, 42), skyMat);
    skyDome.position.set(0, 12, -28);
    this.scene.add(skyDome);

    // Outdoor Rain Particle System
    this.buildRainParticles();

    // 3D Emergency Evacuation Ambulance parked at X = 0, Z = -30.0
    this.buildAmbulance(0, -30.0);
  }

  buildRainParticles() {
    const rainCount = 500;
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);

    for (let i = 0; i < rainCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 28;     // X
      positions[i * 3 + 1] = Math.random() * 16;          // Y
      positions[i * 3 + 2] = -16 - Math.random() * 23;   // Z
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.14,
      transparent: true,
      opacity: 0.7
    });

    this.rainParticles = new THREE.Points(rainGeo, rainMat);
    this.scene.add(this.rainParticles);
  }

  buildAmbulance(x, z) {
    const ambGroup = new THREE.Group();
    ambGroup.position.set(x, 0, z);

    // White Main Vehicle Chassis Body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.3, 5.8), bodyMat);
    body.position.y = 1.45;
    ambGroup.add(body);

    // Red Emergency Side Decal Stripes
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });
    const leftStripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 5.6), stripeMat);
    leftStripe.position.set(-1.32, 1.4, 0);
    ambGroup.add(leftStripe);

    const rightStripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 5.6), stripeMat);
    rightStripe.position.set(1.32, 1.4, 0);
    ambGroup.add(rightStripe);

    // Red Cross Emblem
    const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.25), stripeMat);
    cross1.position.set(-1.33, 1.8, 0);
    ambGroup.add(cross1);
    const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.7), stripeMat);
    cross2.position.set(-1.33, 1.8, 0);
    ambGroup.add(cross2);

    // Front Cab Hood
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.8), bodyMat);
    cab.position.set(0, 0.9, -3.4);
    ambGroup.add(cab);

    // Front Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.1), this.glassMat);
    windshield.position.set(0, 1.7, -2.8);
    ambGroup.add(windshield);

    // Headlights Beam
    const headlightR = new THREE.SpotLight(0xffedd5, 3.0, 20, Math.PI / 6, 0.3);
    headlightR.position.set(0.8, 0.8, -3.8);
    headlightR.target.position.set(0.8, 0.2, -15.0);
    ambGroup.add(headlightR);
    ambGroup.add(headlightR.target);

    const headlightL = new THREE.SpotLight(0xffedd5, 3.0, 20, Math.PI / 6, 0.3);
    headlightL.position.set(-0.8, 0.8, -3.8);
    headlightL.target.position.set(-0.8, 0.2, -15.0);
    ambGroup.add(headlightL);
    ambGroup.add(headlightL.target);

    // 4 Heavy Tires
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.9 });
    [[-1.3, -1.8], [1.3, -1.8], [-1.3, 1.8], [1.3, 1.8]].forEach(([tx, tz]) => {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 16), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(tx, 0.42, tz);
      ambGroup.add(tire);
    });

    // Flashing Emergency Lightbar on Roof
    this.ambulanceSirenLight1 = new THREE.PointLight(0xef4444, 4.0, 16, 1.4);
    this.ambulanceSirenLight1.position.set(-0.6, 2.8, -1.8);
    ambGroup.add(this.ambulanceSirenLight1);

    this.ambulanceSirenLight2 = new THREE.PointLight(0x06b6d4, 4.0, 16, 1.4);
    this.ambulanceSirenLight2.position.set(0.6, 2.8, -1.8);
    ambGroup.add(this.ambulanceSirenLight2);

    // Open Rear Doors with Green Evacuation Interior Light
    const ambInteriorLight = new THREE.PointLight(0x34d399, 2.5, 9, 1.5);
    ambInteriorLight.position.set(0, 1.4, 2.6);
    ambGroup.add(ambInteriorLight);

    // Solid collision for vehicle
    this.addObstacle(ambGroup, 3.2, 7.2, x, z);

    // Rear Escape Trigger Zone (Step inside open back doors at Z = -26.5 to -28.0)
    this.ambulanceTriggerZone = { minX: x - 1.4, maxX: x + 1.4, minZ: z + 2.4, maxZ: z + 4.8 };
  }

  openCourtyardBlastGate() {
    this.blastGateOpen = true;
    this.blastGateDoor.unlock();
    this.blastGateDoor.interact(this.inventory);

    const objEl = document.getElementById('objective-text');
    if (objEl) {
      objEl.innerHTML = `<span style="color: #22c55e; font-weight: 700;">FINAL ESCAPE OPEN:</span> Sprint to the Evacuation Ambulance in the Courtyard!`;
    }
  }

  checkAmbulanceTrigger(playerPos) {
    if (this.floorCompleted || !this.blastGateOpen) return;

    const t = this.ambulanceTriggerZone;
    if (t && playerPos.x >= t.minX && playerPos.x <= t.maxX && playerPos.z >= t.minZ && playerPos.z <= t.maxZ) {
      this.floorCompleted = true;
      audio.playVictoryFanfare();

      if (this.onFloorCompleted) {
        this.onFloorCompleted(1);
      }
    }
  }

  /* --------------------------------------------------------------------------
     7. LOBBY PROPS & DETAILS
     -------------------------------------------------------------------------- */
  buildLobbyProps() {
    this.buildChairRow(-5.0, 3.5);
    this.buildChairRow(5.0, 3.5);
    this.buildGurney(-4.0, -10.0);
  }

  buildChairRow(x, z) {
    const row = new THREE.Group();
    row.position.set(x, 0, z);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.1), this.metalMat);
    bar.position.y = 0.4;
    row.add(bar);

    for (let i = 0; i < 3; i++) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.55), this.wallTrimMat);
      seat.position.set((i - 1) * 0.75, 0.45, 0);
      row.add(seat);
    }
    this.addObstacle(row, 2.6, 0.8, x, z);
  }

  buildGurney(x, z) {
    const gurney = new THREE.Group();
    gurney.position.set(x, 0, z);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 2.2), this.metalMat);
    frame.position.y = 0.5;
    gurney.add(frame);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.15, 2.1), new THREE.MeshStandardMaterial({ color: 0x0284c7 }));
    pad.position.y = 0.62;
    gurney.add(pad);

    this.addObstacle(gurney, 1.2, 2.4, x, z);
  }

  addPlaqueSign(x, y, z, text, rotY = 0) {
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 440;
    signCanvas.height = 96;
    const sCtx = signCanvas.getContext('2d');
    sCtx.fillStyle = '#090d16';
    sCtx.fillRect(0, 0, 440, 96);
    sCtx.strokeStyle = '#38bdf8';
    sCtx.lineWidth = 4;
    sCtx.strokeRect(2, 2, 436, 92);
    sCtx.fillStyle = '#bae6fd';
    sCtx.font = 'bold 20px "JetBrains Mono", monospace';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillText(text, 220, 48);

    const sTex = new THREE.CanvasTexture(signCanvas);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.32), new THREE.MeshBasicMaterial({ map: sTex }));
    sign.position.set(x, y, z);
    sign.rotation.y = rotY;
    this.scene.add(sign);
  }

  /* --------------------------------------------------------------------------
     8. RESET & DISPOSAL
     -------------------------------------------------------------------------- */
  resetFloor() {
    this.directorCardAcquired = false;
    this.circuitBypassSolved = false;
    this.blastGateOpen = false;
    this.floorCompleted = false;

    // Restore clipboard if collected
    if (this.clipboardMesh) {
      this.clipboardMesh.visible = true;
      if (this.clipConfig) {
        this.registerInteractive(this.clipboardMesh, this.clipConfig);
        if (this.clipboardHitBox) {
          this.registerInteractive(this.clipboardHitBox, this.clipConfig);
        }
      }
    }

    // Restore keycard if collected
    if (this.keycardGroup) {
      this.keycardGroup.visible = true;
      if (this.cardMesh && this.cardConfig) {
        this.registerInteractive(this.cardMesh, this.cardConfig);
        if (this.cardHitBox) {
          this.registerInteractive(this.cardHitBox, this.cardConfig);
        }
      }
    }

    if (this.gridBeacon) {
      this.gridBeacon.color.setHex(0xef4444);
    }

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

    if (this.blastGateDoor) this.blastGateDoor.state = 'LOCKED';

    const objEl = document.getElementById('objective-text');
    if (objEl) {
      objEl.innerHTML = `<span style="color: #fbbf24; font-weight: 700;">GROUND FLOOR:</span> Pick Up Director Keycard in Pharmacy &bull; Link Security Circuits &bull; Evacuate via Ambulance`;
    }
  }

  cleanup() {
    this.doors.forEach(door => {
      if (door.dispose) door.dispose();
      else if (door.mesh) this.scene.remove(door.mesh);
    });
    this.levelObjects.forEach(obj => {
      this.scene.remove(obj);
      if (obj.geometry && obj.geometry.dispose) {
        try { obj.geometry.dispose(); } catch (e) {}
      }
      if (obj.material) {
        try {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose && m.dispose());
          } else if (obj.material.dispose) {
            obj.material.dispose();
          }
        } catch (e) {}
      }
    });
    this.levelObjects = [];
    this.colliders = [];
    this.interactiveObjects = [];
    this.doors = [];
    this.animatedLights = [];
    this.serverLeds = [];
  }

  /* --------------------------------------------------------------------------
     9. TICK UPDATE (Rain, Sirens, Lightning, Doors, Floating Keycard)
     -------------------------------------------------------------------------- */
  update(time, delta, playerPos) {
    // Rotating & Floating Keycard Animation
    if (this.keycardGroup) {
      this.keycardGroup.rotation.y += delta * 1.5;
      this.keycardGroup.position.y = this.keycardBaseY + Math.sin(time * 3.0) * 0.04;
    }

    // Floating Adrenaline Tray Animation
    if (this.adrenalineGroup) {
      this.adrenalineGroup.position.y = this.adrenalineBaseY + Math.sin(time * 2.5) * 0.02;
    }

    // Rain Animation
    if (this.rainParticles) {
      const positions = this.rainParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length / 3; i++) {
        positions[i * 3 + 1] -= delta * 24;
        if (positions[i * 3 + 1] < -0.2) {
          positions[i * 3 + 1] = 16;
        }
      }
      this.rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Ambulance Siren Lights Alternating (Red & Blue)
    if (this.ambulanceSirenLight1 && this.ambulanceSirenLight2) {
      const phase = Math.sin(time * 8.0);
      this.ambulanceSirenLight1.intensity = phase > 0 ? 4.5 : 0.2;
      this.ambulanceSirenLight2.intensity = phase <= 0 ? 4.5 : 0.2;
    }

    // Thunderstorm Lightning Flash
    this.lightningTimer += delta;
    if (this.lightningTimer > 6.0 && Math.random() > 0.93) {
      this.lightningTimer = 0;
      if (this.lightningLight) {
        this.lightningLight.intensity = 3.8;
        setTimeout(() => { if (this.lightningLight) this.lightningLight.intensity = 0.25; }, 120);
        setTimeout(() => { if (this.lightningLight) this.lightningLight.intensity = 2.4; }, 240);
        setTimeout(() => { if (this.lightningLight) this.lightningLight.intensity = 0.25; }, 320);
      }
    }

    // Dynamic light pulsing
    this.animatedLights.forEach(item => {
      if (item.type === 'flicker') {
        const noise = Math.random() > 0.85 ? 0.3 : (0.85 + Math.random() * 0.3);
        item.light.intensity = item.baseIntensity * noise;
      } else if (item.type === 'pulse') {
        const pulse = 0.65 + 0.35 * Math.sin(time * 4.0);
        item.light.intensity = item.baseIntensity * pulse;
      }
    });

    // Update swinging doors
    this.doors.forEach(door => door.update(delta));

    // Check ambulance escape trigger
    if (playerPos) {
      this.checkAmbulanceTrigger(playerPos);
    }
  }
}
