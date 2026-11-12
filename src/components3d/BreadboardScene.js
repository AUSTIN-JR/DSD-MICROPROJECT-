import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BreadboardModel } from './BreadboardModel.js';
import { ElectronicsFactory } from './ElectronicsComponents.js';
import { WireManager } from './WireManager.js';

/**
 * BreadboardScene.js
 * Manages Three.js 3D viewport, electronics laboratory environment,
 * OrbitControls, lighting, camera presets, and rendering loop.
 */

export class BreadboardScene {
  constructor(canvasContainer, simulator) {
    this.container = canvasContainer;
    this.simulator = simulator;

    // Core Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    // 3D Submodules
    this.breadboard = null;
    this.electronics = null;
    this.wireManager = null;

    // Animation / timing
    this.lastTime = performance.now();
    this.animationFrameId = null;

    // Camera animation tween state
    this.isCameraTransitioning = false;
    this.camTargetPos = new THREE.Vector3();
    this.camTargetLookAt = new THREE.Vector3();

    // Raycasting for interactive hover inspection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);
    this.hoverCallback = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0d14); // Deep lab dark background
    this.scene.fog = new THREE.FogExp2(0x0a0d14, 0.015);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 200);
    // Default initial isometric perspective
    this.camera.position.set(0, 18, 22);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent camera dipping below table
    this.controls.minDistance = 6.0;
    this.controls.maxDistance = 50.0;
    this.controls.target.set(0, 0, 0);

    // 5. Environment & Lighting
    this.setupLaboratoryLighting();
    this.setupWorkbench();

    // 6. Build Breadboard and Circuit
    this.buildLaboratorySetup();

    // 7. Event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.container.addEventListener('mousemove', this.onMouseMove.bind(this));

    // 8. Start Render Loop
    this.animate();
  }

  setupLaboratoryLighting() {
    // Ambient soft fill light
    const ambientLight = new THREE.AmbientLight(0xdde5ed, 0.85);
    this.scene.add(ambientLight);

    // Overhead bench fluorescent / LED panel light
    const overheadLight = new THREE.DirectionalLight(0xffffff, 2.2);
    overheadLight.position.set(5, 25, 12);
    overheadLight.castShadow = true;
    overheadLight.shadow.mapSize.width = 2048;
    overheadLight.shadow.mapSize.height = 2048;
    overheadLight.shadow.camera.near = 5;
    overheadLight.shadow.camera.far = 45;
    overheadLight.shadow.camera.left = -16;
    overheadLight.shadow.camera.right = 16;
    overheadLight.shadow.camera.top = 16;
    overheadLight.shadow.camera.bottom = -16;
    overheadLight.shadow.bias = -0.0005;
    this.scene.add(overheadLight);

    // Subtle side fill light (cool cyan)
    const fillLight = new THREE.DirectionalLight(0x4cc9f0, 0.4);
    fillLight.position.set(-18, 12, -10);
    this.scene.add(fillLight);

    // Warm rim accent light
    const rimLight = new THREE.DirectionalLight(0xffb703, 0.35);
    rimLight.position.set(15, 8, -15);
    this.scene.add(rimLight);
  }

  setupWorkbench() {
    // Laboratory Antistatic Mat table surface
    const tableGeom = new THREE.PlaneGeometry(120, 80);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x11151e, // Dark navy slate lab mat
      roughness: 0.85,
      metalness: 0.15
    });

    const tableMesh = new THREE.Mesh(tableGeom, tableMat);
    tableMesh.rotation.x = -Math.PI / 2;
    tableMesh.position.y = -0.58;
    tableMesh.receiveShadow = true;
    this.scene.add(tableMesh);

    // Subtle Grid Helper on workbench surface
    const grid = new THREE.GridHelper(80, 80, 0x1e2638, 0x141a27);
    grid.position.y = -0.56;
    this.scene.add(grid);
  }

  buildLaboratorySetup() {
    // 1. Breadboard
    this.breadboard = new BreadboardModel();
    this.scene.add(this.breadboard.group);

    // 2. Electronics Factory
    this.electronics = new ElectronicsFactory(this.breadboard);
    this.scene.add(this.electronics.group);

    // Add Power Module on the left
    this.electronics.createPowerModule(1);

    // Add NE555 Timer IC (DIP-8) at cols 6..9
    this.electronics.createDIPIC({
      name: 'ic-ne555',
      partNumber: 'NE555P',
      subtext: 'CLK GEN',
      pinCount: 8,
      startCol: 6
    });

    // Add 74LS73 #1 (DIP-14) at cols 16..22
    // Houses FF0 (Stage 1, div 2) and FF1 (Stage 2, div 4)
    this.electronics.createDIPIC({
      name: 'ic-74ls73-1',
      partNumber: 'SN74LS73AN',
      subtext: 'DUAL JK FF #1',
      pinCount: 14,
      startCol: 16
    });

    // Add 74LS73 #2 (DIP-14) at cols 26..32
    // Houses FF2 (Stage 3, div 8)
    this.electronics.createDIPIC({
      name: 'ic-74ls73-2',
      partNumber: 'SN74LS73AN',
      subtext: 'DUAL JK FF #2',
      pinCount: 14,
      startCol: 26
    });

    // Add LEDs
    // LED CLK: Blue, placed at col 11 (anode at row G, cathode at row I)
    this.electronics.createLED({
      name: 'led-clk',
      label: 'CLK IN',
      colorHex: 0x00f0ff,
      anodeRow: 'G',
      anodeCol: 11,
      cathodeRow: 'I',
      cathodeCol: 11
    });

    // LED 0: Red, Stage 1 (f/2) at col 35
    this.electronics.createLED({
      name: 'led-q0',
      label: 'Q0 (f/2)',
      colorHex: 0xff1744,
      anodeRow: 'G',
      anodeCol: 35,
      cathodeRow: 'I',
      cathodeCol: 35
    });

    // LED 1: Amber/Yellow, Stage 2 (f/4) at col 38
    this.electronics.createLED({
      name: 'led-q1',
      label: 'Q1 (f/4)',
      colorHex: 0xffd600,
      anodeRow: 'G',
      anodeCol: 38,
      cathodeRow: 'I',
      cathodeCol: 38
    });

    // LED 2: Emerald Green, Stage 3 (f/8) at col 41
    this.electronics.createLED({
      name: 'led-q2',
      label: 'Q2 (f/8)',
      colorHex: 0x00e676,
      anodeRow: 'G',
      anodeCol: 41,
      cathodeRow: 'I',
      cathodeCol: 41
    });

    // Add Resistors
    // 330 ohm current-limiting resistors for LEDs:
    this.electronics.createResistor({ name: 'r-led-clk', fromRow: 'H', fromCol: 11, toRow: 'I', toCol: 11, bands: ['orange', 'orange', 'brown', 'gold'] });
    this.electronics.createResistor({ name: 'r-led-q0', fromRow: 'H', fromCol: 35, toRow: 'I', toCol: 35, bands: ['orange', 'orange', 'brown', 'gold'] });
    this.electronics.createResistor({ name: 'r-led-q1', fromRow: 'H', fromCol: 38, toRow: 'I', toCol: 38, bands: ['orange', 'orange', 'brown', 'gold'] });
    this.electronics.createResistor({ name: 'r-led-q2', fromRow: 'H', fromCol: 41, toRow: 'I', toCol: 41, bands: ['orange', 'orange', 'brown', 'gold'] });

    // NE555 Timing Resistors: R1 (10k, Brown-Black-Orange-Gold) and R2 (47k, Yellow-Violet-Orange-Gold)
    this.electronics.createResistor({ name: 'r1-555', fromRow: 'B', fromCol: 6, toRow: 'B', toCol: 7, bands: ['brown', 'black', 'orange', 'gold'] });
    this.electronics.createResistor({ name: 'r2-555', fromRow: 'C', fromCol: 7, toRow: 'C', toCol: 8, bands: ['yellow', 'violet', 'orange', 'gold'] });

    // NE555 Capacitors:
    // C1: 10µF Electrolytic timing capacitor (Pin 2 / 6 to GND)
    this.electronics.createCapacitor({ name: 'c1-555', type: 'electrolytic', posRow: 'I', posCol: 7, negRow: 'bottom-gnd', negCol: 7 });
    // C2: 0.01µF Ceramic bypass capacitor on pin 5 to GND
    this.electronics.createCapacitor({ name: 'c2-555', type: 'ceramic', posRow: 'A', posCol: 9, negRow: 'top-gnd', negCol: 9 });

    // 3. Jumper Wire Manager
    this.wireManager = new WireManager(this.breadboard);
    this.wireManager.buildCircuitWiring();
    this.scene.add(this.wireManager.group);
  }

  setCameraPreset(preset) {
    this.isCameraTransitioning = true;
    switch (preset) {
      case 'ISOMETRIC':
        this.camTargetPos.set(0, 18, 22);
        this.camTargetLookAt.set(0, 0, 0);
        break;
      case 'TOP_DOWN':
        this.camTargetPos.set(0, 26, 0.01); // looking straight down
        this.camTargetLookAt.set(0, 0, 0);
        break;
      case 'ZOOM_555':
        this.camTargetPos.set(-7, 9, 9);
        this.camTargetLookAt.set(-7, 0, 0);
        break;
      case 'ZOOM_FLIPFLOPS':
        this.camTargetPos.set(2, 10, 10);
        this.camTargetLookAt.set(2, 0, 0);
        break;
      case 'ZOOM_LEDS':
        this.camTargetPos.set(9, 8, 8);
        this.camTargetLookAt.set(9, 0, 0);
        break;
      default:
        this.camTargetPos.set(0, 18, 22);
        this.camTargetLookAt.set(0, 0, 0);
    }
  }

  onMouseMove(e) {
    const rect = this.container.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  onWindowResize() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // 1. Advance digital simulation
    this.simulator.update(dt);
    const simState = this.simulator.getState();

    // 2. Update 3D LEDs
    this.electronics.update(simState);

    // 3. Update animated signal flow pulses along wires
    this.wireManager.update(dt, simState);

    // 4. Smooth camera lerping if transition requested
    if (this.isCameraTransitioning) {
      this.camera.position.lerp(this.camTargetPos, 0.08);
      this.controls.target.lerp(this.camTargetLookAt, 0.08);
      if (this.camera.position.distanceTo(this.camTargetPos) < 0.1) {
        this.isCameraTransitioning = false;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.dispose();
  }
}
