import * as THREE from 'three';

/**
 * WireManager.js
 * Creates realistic 3D curved jumper wires with:
 * - Proper electronics color coding (Red VCC, Black GND, Blue Clock, Yellow/Purple signals)
 * - Tinned metal pin tips inserted into breadboard tie holes
 * - Dynamic animated signal flow pulses / particles running along the wires
 * - Real-time emission updates based on digital logic states.
 */

export class WireManager {
  constructor(breadboard) {
    this.bb = breadboard;
    this.group = new THREE.Group();
    this.group.name = 'JumperWires';

    this.wires = [];
    this.signalPulses = []; // Animated energy particles

    this.initMaterials();
  }

  initMaterials() {
    this.metalPinMat = new THREE.MeshStandardMaterial({
      color: 0xd0d0d0,
      metalness: 0.9,
      roughness: 0.2
    });

    // Wire insulation colors (matte flexible PVC)
    this.colorPalette = {
      vcc: 0xd32f2f,      // Red +5V
      gnd: 0x1a1a1a,      // Black Ground
      clk: 0x00b4d8,      // Bright Cyan Clock
      cascade1: 0xffb703, // Amber / Yellow Q0 -> FF1 CLK
      cascade2: 0xf77f00, // Bright Orange Q1 -> FF2 CLK
      signalQ2: 0x06d6a0, // Emerald Green Q2 -> LED
      jumper: 0xe0e1dd,   // Off-white / Gray
      tie: 0x4361ee       // Blue
    };

    // Shared pulse particle geometry & material
    this.pulseGeom = new THREE.SphereGeometry(0.12, 12, 12);
  }

  /**
   * Adds a realistic arched jumper wire between two breadboard holes
   */
  addWire(config) {
    const {
      name,
      fromRow,
      fromCol,
      toRow,
      toCol,
      type = 'jumper', // 'vcc', 'gnd', 'clk', 'cascade1', 'cascade2', 'signalQ2'
      archHeight = 1.2,
      isSignal = false,
      signalChannel = null // 'clk', 'q0', 'q1', 'q2'
    } = config;

    const pStart = this.bb.getHolePos(fromRow, fromCol);
    const pEnd = this.bb.getHolePos(toRow, toCol);

    const wireColor = this.colorPalette[type] || 0xffffff;

    // Build smooth 3D Catmull-Rom spline curve with realistic drape/arch
    const midPoint = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);
    const dist = pStart.distanceTo(pEnd);
    const effectiveArch = Math.max(0.6, archHeight * Math.min(1.8, dist / 4.0));
    midPoint.y = this.bb.ySurface + effectiveArch;

    // Subtle natural bend
    const lateralOffset = (Math.random() - 0.5) * 0.3;
    midPoint.z += lateralOffset;

    const curve = new THREE.CatmullRomCurve3([
      pStart.clone().setY(this.bb.ySurface - 0.1), // inside hole
      pStart.clone().setY(this.bb.ySurface + 0.3),  // leaving hole vertically
      midPoint,
      pEnd.clone().setY(this.bb.ySurface + 0.3),    // entering hole vertically
      pEnd.clone().setY(this.bb.ySurface - 0.1)    // inside hole
    ]);

    // Wire tube
    const tubeGeom = new THREE.TubeGeometry(curve, 32, 0.055, 8, false);
    const wireMat = new THREE.MeshStandardMaterial({
      color: wireColor,
      roughness: 0.55,
      metalness: 0.08
    });

    const wireMesh = new THREE.Mesh(tubeGeom, wireMat);
    wireMesh.castShadow = true;
    this.group.add(wireMesh);

    // Metal pin terminal ends
    [pStart, pEnd].forEach(p => {
      const pinGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
      const pinMesh = new THREE.Mesh(pinGeom, this.metalPinMat);
      pinMesh.position.set(p.x, this.bb.ySurface + 0.15, p.z);
      this.group.add(pinMesh);
    });

    // If it's a signal carrying wire, attach animated flow particles
    let pulseMesh = null;
    if (isSignal) {
      const pulseMat = new THREE.MeshBasicMaterial({
        color: wireColor,
        transparent: true,
        opacity: 0.95
      });
      pulseMesh = new THREE.Mesh(this.pulseGeom, pulseMat);
      pulseMesh.visible = false;
      this.group.add(pulseMesh);

      this.signalPulses.push({
        name,
        curve,
        mesh: pulseMesh,
        channel: signalChannel,
        progress: Math.random(), // staggered
        speed: 1.0,
        color: wireColor
      });
    }

    const wireObj = {
      name,
      mesh: wireMesh,
      material: wireMat,
      baseColor: wireColor,
      curve,
      isSignal,
      signalChannel
    };

    this.wires.push(wireObj);
    return wireObj;
  }

  /**
   * Constructs the complete authentic lab wiring for 555 Astable + Two 74LS73 ICs
   */
  buildCircuitWiring() {
    // -------------------------------------------------------------
    // 1. POWER DISTRIBUTION BUS JUMPERS
    // Connect left power rails to right power rails (bridging center)
    // -------------------------------------------------------------
    this.addWire({ name: 'top-vcc-bridge', fromRow: 'top-vcc', fromCol: 14, toRow: 'top-vcc', toCol: 16, type: 'vcc', archHeight: 0.5 });
    this.addWire({ name: 'top-gnd-bridge', fromRow: 'top-gnd', fromCol: 14, toRow: 'top-gnd', toCol: 16, type: 'gnd', archHeight: 0.5 });
    this.addWire({ name: 'bot-vcc-bridge', fromRow: 'bottom-vcc', fromCol: 14, toRow: 'bottom-vcc', toCol: 16, type: 'vcc', archHeight: 0.5 });
    this.addWire({ name: 'bot-gnd-bridge', fromRow: 'bottom-gnd', fromCol: 14, toRow: 'bottom-gnd', toCol: 16, type: 'gnd', archHeight: 0.5 });

    // Cross-rail bridge: top GND to bottom GND
    this.addWire({ name: 'gnd-cross-bridge', fromRow: 'top-gnd', fromCol: 4, toRow: 'bottom-gnd', toCol: 4, type: 'gnd', archHeight: 1.8 });
    // Cross-rail bridge: top VCC to bottom VCC
    this.addWire({ name: 'vcc-cross-bridge', fromRow: 'top-vcc', fromCol: 5, toRow: 'bottom-vcc', toCol: 5, type: 'vcc', archHeight: 2.0 });

    // -------------------------------------------------------------
    // 2. NE555 ASTABLE MULTIVIBRATOR WIRING (Cols 6..9)
    // Pin 1 (col 6, Row F) -> GND
    // Pin 8 (col 6, Row E) -> VCC
    // Pin 4 (col 9, Row F) -> VCC (Reset tied high)
    // Pin 2 (col 7, Row F) -> Pin 6 (col 8, Row E) (Trig connected to Thresh)
    // -------------------------------------------------------------
    this.addWire({ name: '555-pin1-gnd', fromRow: 'F', fromCol: 6, toRow: 'bottom-gnd', toCol: 6, type: 'gnd', archHeight: 0.7 });
    this.addWire({ name: '555-pin8-vcc', fromRow: 'E', fromCol: 6, toRow: 'top-vcc', toCol: 6, type: 'vcc', archHeight: 0.7 });
    this.addWire({ name: '555-pin4-reset', fromRow: 'F', fromCol: 9, toRow: 'bottom-vcc', toCol: 9, type: 'vcc', archHeight: 0.7 });
    // Jumper between Pin 2 (TRIG, col 7) and Pin 6 (THRES, col 8)
    this.addWire({ name: '555-trig-thresh', fromRow: 'G', fromCol: 7, toRow: 'D', toCol: 8, type: 'tie', archHeight: 1.1 });

    // -------------------------------------------------------------
    // 3. CLOCK SIGNAL FROM 555 OUT (Pin 3, col 8, Row F)
    // - Connects to Clock Indicator LED at col 11
    // - Connects to 74LS73 #1 Pin 1 (1CLK, col 16, Row F)
    // -------------------------------------------------------------
    this.addWire({
      name: 'clk-to-led',
      fromRow: 'G',
      fromCol: 8,
      toRow: 'G',
      toCol: 11,
      type: 'clk',
      archHeight: 0.8,
      isSignal: true,
      signalChannel: 'clk'
    });

    this.addWire({
      name: 'clk-555-to-ic1',
      fromRow: 'H',
      fromCol: 8,
      toRow: 'H',
      toCol: 16, // IC1 Pin 1 (1CLK)
      type: 'clk',
      archHeight: 1.4,
      isSignal: true,
      signalChannel: 'clk'
    });

    // -------------------------------------------------------------
    // 4. 74LS73 DUAL JK FLIP-FLOP #1 (Cols 16..22)
    // Configured as two T Flip-Flops (FF0 & FF1) with J=1, K=1, CLR#=1
    // 
    // Power:
    // Pin 4 (col 19, Row F) -> VCC (+5V)
    // Pin 11 (col 19, Row E) -> GND
    //
    // Flip-Flop 0 (Unit A):
    // Pin 1 (col 16, Row F) = 1CLK (Clock in from 555)
    // Pin 2 (col 17, Row F) = 1CLR# -> VCC
    // Pin 3 (col 18, Row F) = 1K -> VCC
    // Pin 14 (col 16, Row E) = 1J -> VCC
    // Pin 12 (col 18, Row E) = 1Q (Q0 output, f/2)
    // 
    // Flip-Flop 1 (Unit B):
    // Pin 5 (col 20, Row F) = 2CLK (Connected to Q0)
    // Pin 6 (col 21, Row F) = 2CLR# -> VCC
    // Pin 7 (col 22, Row F) = 2J -> VCC
    // Pin 10 (col 20, Row E) = 2K -> VCC
    // Pin 9 (col 21, Row E) = 2Q (Q1 output, f/4)
    // -------------------------------------------------------------
    // IC1 Power & GND
    this.addWire({ name: 'ic1-vcc', fromRow: 'G', fromCol: 19, toRow: 'bottom-vcc', toCol: 19, type: 'vcc', archHeight: 0.6 });
    this.addWire({ name: 'ic1-gnd', fromRow: 'D', fromCol: 19, toRow: 'top-gnd', toCol: 19, type: 'gnd', archHeight: 0.6 });

    // FF0 J=1, K=1, CLR#=1 ties to VCC
    this.addWire({ name: 'ic1-1clr-vcc', fromRow: 'G', fromCol: 17, toRow: 'bottom-vcc', toCol: 17, type: 'vcc', archHeight: 0.6 });
    this.addWire({ name: 'ic1-1k-vcc', fromRow: 'G', fromCol: 18, toRow: 'bottom-vcc', toCol: 18, type: 'vcc', archHeight: 0.6 });
    this.addWire({ name: 'ic1-1j-vcc', fromRow: 'D', fromCol: 16, toRow: 'top-vcc', toCol: 16, type: 'vcc', archHeight: 0.6 });

    // FF1 J=1, K=1, CLR#=1 ties to VCC
    this.addWire({ name: 'ic1-2clr-vcc', fromRow: 'G', fromCol: 21, toRow: 'bottom-vcc', toCol: 21, type: 'vcc', archHeight: 0.6 });
    this.addWire({ name: 'ic1-2j-vcc', fromRow: 'G', fromCol: 22, toRow: 'bottom-vcc', toCol: 22, type: 'vcc', archHeight: 0.6 });
    this.addWire({ name: 'ic1-2k-vcc', fromRow: 'D', fromCol: 20, toRow: 'top-vcc', toCol: 20, type: 'vcc', archHeight: 0.6 });

    // CASCADE 1: IC1 Pin 12 (1Q: col 18, Row D) -> IC1 Pin 5 (2CLK: col 20, Row G)
    // Divides frequency by 2 (Stage 1 to Stage 2)
    this.addWire({
      name: 'cascade-q0-to-ff1clk',
      fromRow: 'D',
      fromCol: 18,
      toRow: 'G',
      toCol: 20,
      type: 'cascade1',
      archHeight: 1.3,
      isSignal: true,
      signalChannel: 'q0'
    });

    // Wire from Q0 (col 18, Row C) to Stage 1 LED Resistor (at col 35)
    this.addWire({
      name: 'q0-to-led0',
      fromRow: 'C',
      fromCol: 18,
      toRow: 'C',
      toCol: 35,
      type: 'cascade1',
      archHeight: 1.5,
      isSignal: true,
      signalChannel: 'q0'
    });

    // -------------------------------------------------------------
    // 5. CASCADE 2: IC1 Pin 9 (2Q: col 21, Row D) -> IC2 Pin 1 (1CLK: col 26, Row H)
    // Divides frequency by 4 (Stage 2 to Stage 3)
    // -------------------------------------------------------------
    this.addWire({
      name: 'cascade-q1-to-ic2clk',
      fromRow: 'D',
      fromCol: 21,
      toRow: 'H',
      toCol: 26,
      type: 'cascade2',
      archHeight: 1.4,
      isSignal: true,
      signalChannel: 'q1'
    });

    // Wire from Q1 (col 21, Row C) to Stage 2 LED Resistor (at col 38)
    this.addWire({
      name: 'q1-to-led1',
      fromRow: 'C',
      fromCol: 21,
      toRow: 'C',
      toCol: 38,
      type: 'cascade2',
      archHeight: 1.5,
      isSignal: true,
      signalChannel: 'q1'
    });

    // -------------------------------------------------------------
    // 6. 74LS73 DUAL JK FLIP-FLOP #2 (Cols 26..32)
    // Flip-Flop 2 (Unit A) configured as T Flip-Flop:
    // Pin 1 (col 26, Row F) = 1CLK (Clock in from Q1)
    // Pin 2 (col 27, Row F) = 1CLR# -> VCC
    // Pin 3 (col 28, Row F) = 1K -> VCC
    // Pin 4 (col 29, Row F) = VCC (+5V)
    // Pin 14 (col 26, Row E) = 1J -> VCC
    // Pin 11 (col 29, Row E) = GND
    // Pin 12 (col 28, Row E) = 1Q (Q2 output, f/8)
    // -------------------------------------------------------------
    this.addWire({ name: 'ic2-vcc', fromRow: 'G', fromCol: 29, toRow: 'bottom-vcc', toCol: 29, type: 'vcc', archHeight: 0.6 });
    this.addWire({ name: 'ic2-gnd', fromRow: 'D', fromCol: 29, toRow: 'top-gnd', toCol: 29, type: 'gnd', archHeight: 0.6 });

    this.addWire({ name: 'ic2-1clr-vcc', fromRow: 'G', fromCol: 27, toRow: 'bottom-vcc', toCol: 27, type: 'vcc', archHeight: 0.6 });
    this.addWire({ name: 'ic2-1k-vcc', fromRow: 'G', fromCol: 28, toRow: 'bottom-vcc', toCol: 28, type: 'vcc', archHeight: 0.6 });
    this.addWire({ name: 'ic2-1j-vcc', fromRow: 'D', fromCol: 26, toRow: 'top-vcc', toCol: 26, type: 'vcc', archHeight: 0.6 });

    // Wire from Q2 (col 28, Row C) to Stage 3 LED Resistor (at col 41)
    // Divides frequency by 8
    this.addWire({
      name: 'q2-to-led2',
      fromRow: 'C',
      fromCol: 28,
      toRow: 'C',
      toCol: 41,
      type: 'signalQ2',
      archHeight: 1.3,
      isSignal: true,
      signalChannel: 'q2'
    });

    // -------------------------------------------------------------
    // 7. LED CATHODE GROUND RETURN JUMPERS
    // All LED cathodes go through current limiting resistors to GND
    // -------------------------------------------------------------
    this.addWire({ name: 'led-clk-gnd', fromRow: 'I', fromCol: 11, toRow: 'bottom-gnd', toCol: 11, type: 'gnd', archHeight: 0.5 });
    this.addWire({ name: 'led-q0-gnd', fromRow: 'I', fromCol: 35, toRow: 'bottom-gnd', toCol: 35, type: 'gnd', archHeight: 0.5 });
    this.addWire({ name: 'led-q1-gnd', fromRow: 'I', fromCol: 38, toRow: 'bottom-gnd', toCol: 38, type: 'gnd', archHeight: 0.5 });
    this.addWire({ name: 'led-q2-gnd', fromRow: 'I', fromCol: 41, toRow: 'bottom-gnd', toCol: 41, type: 'gnd', archHeight: 0.5 });
  }

  /**
   * Updates animated signal flow along wires and dynamic glowing emission
   */
  update(dt, simState) {
    // 1. Move signal pulses along active wires
    const baseSpeed = Math.max(0.5, simState.frequency * 0.8);

    for (const pulse of this.signalPulses) {
      // Determine if signal is currently HIGH on this channel
      const isHigh = pulse.channel ? (simState[pulse.channel] === 1) : simState.isRunning;

      if (simState.isRunning) {
        pulse.progress = (pulse.progress + dt * baseSpeed) % 1.0;
        const pt = pulse.curve.getPointAt(pulse.progress);
        pulse.mesh.position.copy(pt);
        pulse.mesh.visible = true;

        // Scale pulse size & brightness when active
        const pulseScale = isHigh ? 1.4 : 0.8;
        pulse.mesh.scale.setScalar(pulseScale);
        pulse.mesh.material.opacity = isHigh ? 1.0 : 0.35;
      } else {
        pulse.mesh.visible = false;
      }
    }

    // 2. Adjust wire glow intensity based on digital state
    for (const wire of this.wires) {
      if (wire.isSignal && wire.signalChannel) {
        const isHigh = simState[wire.signalChannel] === 1;
        if (isHigh) {
          wire.material.emissive = new THREE.Color(wire.baseColor);
          wire.material.emissiveIntensity = 0.45;
        } else {
          wire.material.emissive = new THREE.Color(0x000000);
          wire.material.emissiveIntensity = 0.0;
        }
      }
    }
  }
}
