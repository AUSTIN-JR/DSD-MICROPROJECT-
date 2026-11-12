import * as THREE from 'three';

/**
 * ElectronicsComponents.js
 * Generates realistic 3D electronic components:
 * - DIP-8 NE555 Timer IC
 * - Two DIP-14 74LS73 Dual JK Flip-Flop ICs
 * - Output LEDs (Blue for CLK, Red for Q0, Yellow for Q1, Green for Q2) with dynamic PointLights
 * - Resistors with EIA color code bands
 * - Timing Capacitors (Electrolytic & Ceramic)
 * - 5V Breadboard Power Supply Module
 */

export class ElectronicsFactory {
  constructor(breadboard) {
    this.bb = breadboard;
    this.group = new THREE.Group();
    this.group.name = 'ElectronicsComponents';

    // Store references to controllable elements
    this.leds = {};
    this.ics = {};
    this.passiveComponents = [];

    this.initMaterials();
  }

  initMaterials() {
    // Metal pins material
    this.metalMat = new THREE.MeshStandardMaterial({
      color: 0xd8d8d8,
      metalness: 0.95,
      roughness: 0.2
    });

    // Dark molded epoxy IC package
    this.icBodyMat = new THREE.MeshStandardMaterial({
      color: 0x18181c, // Dark matte plastic
      roughness: 0.7,
      metalness: 0.1
    });

    // Resistor ceramic body
    this.resistorMat = new THREE.MeshStandardMaterial({
      color: 0xd4c2a5, // Tan ceramic
      roughness: 0.6,
      metalness: 0.05
    });

    // Electrolytic capacitor body
    this.capElectrolyticMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f, // Dark blue metallic sleeve
      metalness: 0.4,
      roughness: 0.4
    });

    this.capTopMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.8,
      roughness: 0.3
    });

    // Ceramic disc capacitor
    this.capCeramicMat = new THREE.MeshStandardMaterial({
      color: 0xd97724, // Ochre / terracotta orange
      roughness: 0.8,
      metalness: 0.0
    });
  }

  /**
   * Builds DIP IC package with orientation notch, pin 1 dot, silver pins, and laser silkscreen
   */
  createDIPIC(config) {
    const {
      name,
      partNumber,
      pinCount, // 8 or 14
      startCol,
      subtext = ''
    } = config;

    const icGroup = new THREE.Group();
    icGroup.name = name;

    const pinsPerSide = pinCount / 2;
    const length = (pinsPerSide - 1) * this.bb.pitch + 0.5;
    const width = 1.6; // ~0.3" pitch spacing across ravine
    const height = 0.65;

    // Center position over the DIP ravine (rows E and F)
    const midCol = startCol + (pinsPerSide - 1) / 2;
    const x0 = -((this.bb.totalCols - 1) * this.bb.pitch) / 2;
    const centerX = x0 + (midCol - 1) * this.bb.pitch;
    const centerY = this.bb.ySurface + height / 2 + 0.2; // elevated above board
    const centerZ = 0; // centered right over the ravine

    icGroup.position.set(centerX, centerY, centerZ);

    // 1. Molded Plastic IC Body
    const bodyGeom = new THREE.BoxGeometry(length, height, width);
    const bodyMesh = new THREE.Mesh(bodyGeom, this.icBodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    icGroup.add(bodyMesh);

    // 2. Pin 1 Orientation Notch (semi-cylindrical cutout at left end)
    const notchGeom = new THREE.CylinderGeometry(0.18, 0.18, height + 0.01, 16, 1, false, 0, Math.PI);
    const notchMat = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.9 });
    const notchMesh = new THREE.Mesh(notchGeom, notchMat);
    notchMesh.rotation.y = Math.PI / 2;
    notchMesh.position.set(-length / 2, 0, 0);
    icGroup.add(notchMesh);

    // 3. Pin 1 Indentation Dot
    const dotGeom = new THREE.SphereGeometry(0.08, 12, 12);
    const dotMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
    const dotMesh = new THREE.Mesh(dotGeom, dotMat);
    dotMesh.position.set(-length / 2 + 0.25, height / 2 + 0.01, 0.45);
    dotMesh.scale.set(1, 0.2, 1);
    icGroup.add(dotMesh);

    // 4. Laser Silkscreen Marking on Top Surface
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 512;
    textCanvas.height = 256;
    const ctx = textCanvas.getContext('2d');
    ctx.fillStyle = '#18181c';
    ctx.fillRect(0, 0, textCanvas.width, textCanvas.height);

    ctx.fillStyle = '#d0d0d8'; // Laser etched off-white
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 52px monospace';
    ctx.fillText(partNumber, textCanvas.width / 2, textCanvas.height / 2 - 20);

    ctx.font = '32px monospace';
    ctx.fillStyle = '#8f909e';
    ctx.fillText(subtext || 'DSD LAB', textCanvas.width / 2, textCanvas.height / 2 + 40);

    const textTexture = new THREE.CanvasTexture(textCanvas);
    const textMat = new THREE.MeshStandardMaterial({
      map: textTexture,
      roughness: 0.6,
      polygonOffset: true,
      polygonOffsetFactor: -1
    });
    const textPlaneGeom = new THREE.PlaneGeometry(length * 0.9, width * 0.85);
    const textPlane = new THREE.Mesh(textPlaneGeom, textMat);
    textPlane.rotation.x = -Math.PI / 2;
    textPlane.position.y = height / 2 + 0.005;
    icGroup.add(textPlane);

    // 5. DIP Lead Pins (entering rows E and F)
    const pinWidth = 0.08;
    const pinThick = 0.04;
    const pinDrop = 0.85;

    for (let i = 0; i < pinsPerSide; i++) {
      const pinCol = startCol + i;
      const xPin = (i - (pinsPerSide - 1) / 2) * this.bb.pitch;

      // Top side pin (plugs into Row E: z = -1.2)
      // Bottom side pin (plugs into Row F: z = 1.2)
      [-1, 1].forEach(side => {
        const pinGeom = new THREE.Group();

        // Horizontal pin shoulder sticking out of body
        const horizGeom = new THREE.BoxGeometry(pinWidth, pinThick, 0.4);
        const horiz = new THREE.Mesh(horizGeom, this.metalMat);
        horiz.position.set(0, -0.1, side * (width / 2 + 0.15));
        pinGeom.add(horiz);

        // Vertical pin leg dropping down into breadboard hole
        const vertGeom = new THREE.BoxGeometry(pinWidth, pinDrop, pinThick);
        const vert = new THREE.Mesh(vertGeom, this.metalMat);
        vert.position.set(0, -pinDrop / 2 - 0.1, side * (width / 2 + 0.35));
        pinGeom.add(vert);

        pinGeom.position.x = xPin;
        icGroup.add(pinGeom);
      });
    }

    this.group.add(icGroup);
    this.ics[name] = icGroup;
    return icGroup;
  }

  /**
   * Builds realistic 5mm LED with metallic collar, translucent epoxy dome, and PointLight
   */
  createLED(config) {
    const {
      name,
      label,
      colorHex, // e.g. 0x00f0ff (cyan), 0xff1744 (red), etc.
      anodeRow,
      anodeCol,
      cathodeRow,
      cathodeCol
    } = config;

    const ledGroup = new THREE.Group();
    ledGroup.name = name;

    const anodePos = this.bb.getHolePos(anodeRow, anodeCol);
    const cathodePos = this.bb.getHolePos(cathodeRow, cathodeCol);

    // Center position for the LED dome (between anode and cathode, elevated)
    const centerPos = new THREE.Vector3().addVectors(anodePos, cathodePos).multiplyScalar(0.5);
    const domeHeight = 2.2;
    centerPos.y += domeHeight;

    ledGroup.position.copy(centerPos);

    // 1. Metal Leads (bent wires plugging into breadboard holes)
    const createLead = (fromPos, offsetZ) => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(fromPos.x - centerPos.x, -domeHeight, fromPos.z - centerPos.z),
        new THREE.Vector3(fromPos.x - centerPos.x, -domeHeight * 0.4, fromPos.z - centerPos.z),
        new THREE.Vector3(0, -0.4, offsetZ)
      ]);
      const tubeGeom = new THREE.TubeGeometry(curve, 12, 0.04, 8, false);
      const leadMesh = new THREE.Mesh(tubeGeom, this.metalMat);
      ledGroup.add(leadMesh);
    };

    createLead(anodePos, 0.15);
    createLead(cathodePos, -0.15);

    // 2. LED Rim Collar (base ring)
    const collarGeom = new THREE.CylinderGeometry(0.38, 0.38, 0.15, 24);
    const collarMesh = new THREE.Mesh(collarGeom, this.metalMat);
    collarMesh.position.y = 0.075;
    ledGroup.add(collarMesh);

    // 3. LED Translucent Epoxy Dome Lens
    // Cylinder body
    const bodyCylGeom = new THREE.CylinderGeometry(0.34, 0.34, 0.6, 24);
    // Hemispherical dome top
    const domeGeom = new THREE.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);

    // LED Material: Starts unlit, changes emissive intensity dynamically
    const ledMaterial = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.75, // Glass/plastic translucency
      thickness: 0.5,
      transparent: true,
      opacity: 0.92
    });

    const bodyCyl = new THREE.Mesh(bodyCylGeom, ledMaterial);
    bodyCyl.position.y = 0.45;
    const dome = new THREE.Mesh(domeGeom, ledMaterial);
    dome.position.y = 0.75;
    ledGroup.add(bodyCyl, dome);

    // 4. Inner Reflective Cup & LED Die
    const cupGeom = new THREE.ConeGeometry(0.12, 0.15, 12);
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1 });
    const cupMesh = new THREE.Mesh(cupGeom, cupMat);
    cupMesh.position.y = 0.4;
    ledGroup.add(cupMesh);

    // 5. Dynamic Three.js PointLight
    const pointLight = new THREE.PointLight(colorHex, 0, 8.0, 1.8);
    pointLight.position.set(0, 0.8, 0);
    ledGroup.add(pointLight);

    // 6. Halo Glow Sprite
    const haloTexture = this.generateHaloTexture(colorHex);
    const haloMat = new THREE.SpriteMaterial({
      map: haloTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0
    });
    const haloSprite = new THREE.Sprite(haloMat);
    haloSprite.scale.set(2.0, 2.0, 1.0);
    haloSprite.position.set(0, 0.8, 0);
    ledGroup.add(haloSprite);

    this.group.add(ledGroup);

    // State controller for this LED
    const ledController = {
      name,
      label,
      colorHex,
      group: ledGroup,
      material: ledMaterial,
      light: pointLight,
      halo: haloSprite,
      isLit: false,
      setLit: (lit) => {
        ledController.isLit = lit;
        if (lit) {
          ledMaterial.emissive.setHex(colorHex);
          ledMaterial.emissiveIntensity = 2.4;
          pointLight.intensity = 2.8;
          haloSprite.material.opacity = 0.85;
        } else {
          ledMaterial.emissive.setHex(0x000000);
          ledMaterial.emissiveIntensity = 0.05;
          pointLight.intensity = 0.0;
          haloSprite.material.opacity = 0.0;
        }
      }
    };

    this.leds[name] = ledController;
    return ledController;
  }

  generateHaloTexture(colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    const c = new THREE.Color(colorHex);
    grad.addColorStop(0, `rgba(${c.r * 255}, ${c.g * 255}, ${c.b * 255}, 1)`);
    grad.addColorStop(0.3, `rgba(${c.r * 255}, ${c.g * 255}, ${c.b * 255}, 0.5)`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Builds realistic axial lead resistor with EIA color code bands
   */
  createResistor(config) {
    const {
      name,
      fromRow,
      fromCol,
      toRow,
      toCol,
      bands = ['orange', 'orange', 'brown', 'gold'] // e.g. 330 ohm
    } = config;

    const resGroup = new THREE.Group();
    resGroup.name = name;

    const p1 = this.bb.getHolePos(fromRow, fromCol);
    const p2 = this.bb.getHolePos(toRow, toCol);

    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const archY = this.bb.ySurface + 0.8;
    mid.y = archY;

    // 1. Resistor Body Cylinder
    const length = 0.9;
    const radius = 0.22;
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();

    const bodyGeom = new THREE.CylinderGeometry(radius, radius, length, 16);
    const bodyMesh = new THREE.Mesh(bodyGeom, this.resistorMat);
    bodyMesh.castShadow = true;

    // Orient cylinder along wire direction
    bodyMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    bodyMesh.position.copy(mid);
    resGroup.add(bodyMesh);

    // 2. Color code bands
    const colorMap = {
      black: 0x111111,
      brown: 0x6d4c41,
      red: 0xd32f2f,
      orange: 0xf57c00,
      yellow: 0xfbc02d,
      green: 0x388e3c,
      blue: 0x1976d2,
      violet: 0x7b1fa2,
      grey: 0x757575,
      white: 0xeeeeee,
      gold: 0xd4af37,
      silver: 0xcccccc
    };

    const bandSpacing = 0.16;
    bands.forEach((colorName, idx) => {
      const bandMat = new THREE.MeshBasicMaterial({ color: colorMap[colorName] || 0x000000 });
      const bandGeom = new THREE.CylinderGeometry(radius + 0.008, radius + 0.008, 0.07, 16);
      const bandMesh = new THREE.Mesh(bandGeom, bandMat);

      const offsetAlongDir = dir.clone().multiplyScalar((idx - 1.5) * bandSpacing);
      bandMesh.quaternion.copy(bodyMesh.quaternion);
      bandMesh.position.copy(mid).add(offsetAlongDir);
      resGroup.add(bandMesh);
    });

    // 3. Wire Leads bent into breadboard holes
    const leadCurve1 = new THREE.CatmullRomCurve3([
      p1,
      new THREE.Vector3(p1.x, archY * 0.9, p1.z),
      mid.clone().sub(dir.clone().multiplyScalar(length / 2))
    ]);
    const leadGeom1 = new THREE.TubeGeometry(leadCurve1, 10, 0.035, 8, false);
    const leadMesh1 = new THREE.Mesh(leadGeom1, this.metalMat);

    const leadCurve2 = new THREE.CatmullRomCurve3([
      mid.clone().add(dir.clone().multiplyScalar(length / 2)),
      new THREE.Vector3(p2.x, archY * 0.9, p2.z),
      p2
    ]);
    const leadGeom2 = new THREE.TubeGeometry(leadCurve2, 10, 0.035, 8, false);
    const leadMesh2 = new THREE.Mesh(leadGeom2, this.metalMat);

    resGroup.add(leadMesh1, leadMesh2);
    this.group.add(resGroup);
    this.passiveComponents.push(resGroup);
    return resGroup;
  }

  /**
   * Builds timing capacitor (Electrolytic can or ceramic disc)
   */
  createCapacitor(config) {
    const {
      name,
      type = 'electrolytic', // or 'ceramic'
      posRow,
      posCol,
      negRow,
      negCol
    } = config;

    const capGroup = new THREE.Group();
    capGroup.name = name;

    const pPos = this.bb.getHolePos(posRow, posCol);
    const pNeg = this.bb.getHolePos(negRow, negCol);
    const mid = new THREE.Vector3().addVectors(pPos, pNeg).multiplyScalar(0.5);

    if (type === 'electrolytic') {
      const radius = 0.45;
      const height = 1.3;
      const capCenterY = this.bb.ySurface + height / 2 + 0.3;

      // Aluminum can cylinder body
      const canGeom = new THREE.CylinderGeometry(radius, radius, height, 20);
      const canMesh = new THREE.Mesh(canGeom, this.capElectrolyticMat);
      canMesh.position.set(mid.x, capCenterY, mid.z);
      canMesh.castShadow = true;

      // Metallic top cap
      const topGeom = new THREE.CylinderGeometry(radius * 0.95, radius * 0.95, 0.05, 20);
      const topMesh = new THREE.Mesh(topGeom, this.capTopMat);
      topMesh.position.set(mid.x, capCenterY + height / 2 + 0.02, mid.z);

      // Negative polarity white stripe on side
      const stripeGeom = new THREE.CylinderGeometry(radius + 0.005, radius + 0.005, height * 0.9, 16, 1, false, 0, Math.PI / 3);
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.6 });
      const stripeMesh = new THREE.Mesh(stripeGeom, stripeMat);
      stripeMesh.position.set(mid.x, capCenterY, mid.z);
      stripeMesh.rotation.y = Math.PI / 4;

      capGroup.add(canMesh, topMesh, stripeMesh);

      // Leads
      [pPos, pNeg].forEach(p => {
        const leadCurve = new THREE.CatmullRomCurve3([
          p,
          new THREE.Vector3(p.x, capCenterY - height / 2, p.z)
        ]);
        const leadGeom = new THREE.TubeGeometry(leadCurve, 6, 0.035, 6, false);
        capGroup.add(new THREE.Mesh(leadGeom, this.metalMat));
      });
    } else {
      // Ceramic disc capacitor
      const radius = 0.35;
      const discGeom = new THREE.CylinderGeometry(radius, radius, 0.12, 16);
      const discMesh = new THREE.Mesh(discGeom, this.capCeramicMat);
      discMesh.rotation.x = Math.PI / 2;
      discMesh.position.set(mid.x, this.bb.ySurface + 0.8, mid.z);
      discMesh.castShadow = true;
      capGroup.add(discMesh);

      [pPos, pNeg].forEach(p => {
        const leadCurve = new THREE.CatmullRomCurve3([
          p,
          new THREE.Vector3(mid.x, this.bb.ySurface + 0.6, mid.z)
        ]);
        const leadGeom = new THREE.TubeGeometry(leadCurve, 6, 0.03, 6, false);
        capGroup.add(new THREE.Mesh(leadGeom, this.metalMat));
      });
    }

    this.group.add(capGroup);
    this.passiveComponents.push(capGroup);
    return capGroup;
  }

  /**
   * Breadboard 5V DC Power Supply Module on Left Rails
   */
  createPowerModule(startCol = 1) {
    const pwrGroup = new THREE.Group();
    pwrGroup.name = 'BreadboardPowerModule';

    const pVccTop = this.bb.getHolePos('top-vcc', startCol);
    const pGndBot = this.bb.getHolePos('bottom-gnd', startCol);
    const midX = pVccTop.x - 1.2;
    const midZ = 0;
    const midY = this.bb.ySurface + 0.5;

    // PCB board
    const pcbGeom = new THREE.BoxGeometry(2.2, 0.2, 12.0);
    const pcbMat = new THREE.MeshStandardMaterial({
      color: 0x1b4332, // Deep solder mask green
      roughness: 0.5,
      metalness: 0.2
    });
    const pcbMesh = new THREE.Mesh(pcbGeom, pcbMat);
    pcbMesh.position.set(midX, midY, midZ);
    pcbMesh.castShadow = true;
    pwrGroup.add(pcbMesh);

    // DC Barrel Jack
    const jackGeom = new THREE.BoxGeometry(1.2, 0.9, 1.4);
    const jackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
    const jackMesh = new THREE.Mesh(jackGeom, jackMat);
    jackMesh.position.set(midX - 0.3, midY + 0.5, -2.5);
    pwrGroup.add(jackMesh);

    // Power Toggle Switch (Push Button / Rocker)
    const switchBaseGeom = new THREE.BoxGeometry(0.8, 0.4, 0.8);
    const switchBase = new THREE.Mesh(switchBaseGeom, jackMat);
    switchBase.position.set(midX, midY + 0.3, 2.0);

    const switchBtnGeom = new THREE.BoxGeometry(0.5, 0.3, 0.5);
    const switchBtnMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.3 }); // Red button
    const switchBtn = new THREE.Mesh(switchBtnGeom, switchBtnMat);
    switchBtn.position.set(midX, midY + 0.55, 2.0);
    pwrGroup.add(switchBase, switchBtn);

    // Power Pilot LED (Green)
    const pwrLedGeom = new THREE.SphereGeometry(0.18, 16, 16);
    const pwrLedMat = new THREE.MeshStandardMaterial({
      color: 0x00e676,
      emissive: 0x00e676,
      emissiveIntensity: 1.8,
      roughness: 0.2
    });
    const pwrLed = new THREE.Mesh(pwrLedGeom, pwrLedMat);
    pwrLed.position.set(midX, midY + 0.25, 0.5);
    pwrGroup.add(pwrLed);

    const pwrLight = new THREE.PointLight(0x00e676, 1.0, 4.0);
    pwrLight.position.set(midX, midY + 0.4, 0.5);
    pwrGroup.add(pwrLight);

    this.group.add(pwrGroup);
  }

  update(state) {
    // Sync 3D LEDs with simulated states
    if (this.leds['led-clk']) {
      this.leds['led-clk'].setLit(state.clk === 1);
    }
    if (this.leds['led-q0']) {
      this.leds['led-q0'].setLit(state.q0 === 1);
    }
    if (this.leds['led-q1']) {
      this.leds['led-q1'].setLit(state.q1 === 1);
    }
    if (this.leds['led-q2']) {
      this.leds['led-q2'].setLit(state.q2 === 1);
    }
  }
}
