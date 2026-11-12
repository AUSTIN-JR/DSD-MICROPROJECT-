import * as THREE from 'three';

/**
 * BreadboardModel.js
 * Creates a high-fidelity 3D solderless breadboard with:
 * - Accurate 830-point layout (columns 1..63, rows A-E and F-J)
 * - Upper and lower power rails (+ / - with red and blue indicator lines)
 * - Center DIP ravine (0.3" pitch)
 * - Precise hole coordinate mapper for placing ICs, resistors, LEDs, and wires.
 */

export class BreadboardModel {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'Breadboard';

    // Layout configuration (in world units)
    this.totalCols = 45; // 45 active columns (generous lab workspace)
    this.pitch = 0.5; // distance between pin holes (standard 0.1" / 2.54mm scaled)
    this.boardWidth = this.totalCols * this.pitch + 4.0;
    this.boardDepth = 14.0;
    this.boardHeight = 1.0;

    // Coordinate positions
    this.ySurface = this.boardHeight / 2; // top face of breadboard

    // Row Z offsets relative to breadboard center
    this.rowZMap = {
      // Top power rails
      'top-vcc': -5.8,
      'top-gnd': -5.0,
      // Top component strip (A-E)
      'A': -3.6,
      'B': -3.0,
      'C': -2.4,
      'D': -1.8,
      'E': -1.2,
      // Center ravine is at Z = 0 (-0.6 to +0.6)
      // Bottom component strip (F-J)
      'F': 1.2,
      'G': 1.8,
      'H': 2.4,
      'I': 3.0,
      'J': 3.6,
      // Bottom power rails
      'bottom-vcc': 5.0,
      'bottom-gnd': 5.8
    };

    this.createBoard();
  }

  /**
   * Helper to get exact 3D world position of any breadboard tie-point hole.
   * @param {string} row - 'A'..'J' or 'top-vcc', 'top-gnd', 'bottom-vcc', 'bottom-gnd'
   * @param {number} col - 1 to 45
   * @returns {THREE.Vector3}
   */
  getHolePos(row, col) {
    const x0 = -((this.totalCols - 1) * this.pitch) / 2;
    const x = x0 + (col - 1) * this.pitch;
    const z = this.rowZMap[row] !== undefined ? this.rowZMap[row] : 0;
    const y = this.ySurface + 0.02; // slightly above surface for lead insertion
    return new THREE.Vector3(x, y, z);
  }

  createBoard() {
    // 1. Breadboard Main Plastic Body
    const bodyGeometry = new THREE.BoxGeometry(this.boardWidth, this.boardHeight, this.boardDepth);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xefede8, // Realistic off-white / light cream ABS plastic
      roughness: 0.35,
      metalness: 0.05
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    this.group.add(bodyMesh);

    // 2. Base Plate / Double-Sided Foam Tape layer underneath
    const baseGeom = new THREE.BoxGeometry(this.boardWidth + 0.3, 0.15, this.boardDepth + 0.3);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x2b2b2b,
      roughness: 0.9,
      metalness: 0.1
    });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.y = -this.boardHeight / 2 - 0.075;
    this.group.add(baseMesh);

    // 3. Center DIP Ravine (trench where ICs straddle rows E and F)
    const trenchGeom = new THREE.BoxGeometry(this.totalCols * this.pitch + 1.5, 0.25, 0.8);
    const trenchMat = new THREE.MeshStandardMaterial({
      color: 0xdedbd2,
      roughness: 0.6
    });
    const trenchMesh = new THREE.Mesh(trenchGeom, trenchMat);
    trenchMesh.position.set(0, this.ySurface - 0.1, 0);
    this.group.add(trenchMesh);

    // 4. Power Rail Separator Grooves
    const grooveGeom = new THREE.BoxGeometry(this.totalCols * this.pitch + 1.5, 0.08, 0.2);
    const grooveTop = new THREE.Mesh(grooveGeom, trenchMat);
    grooveTop.position.set(0, this.ySurface - 0.02, -4.3);
    const grooveBottom = new THREE.Mesh(grooveGeom, trenchMat);
    grooveBottom.position.set(0, this.ySurface - 0.02, 4.3);
    this.group.add(grooveTop, grooveBottom);

    // 5. Procedural Texture Canvas for Silkscreen & Pinholes
    this.createSilkscreenAndHoles();
  }

  createSilkscreenAndHoles() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Background plastic
    ctx.fillStyle = '#efede8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Helper conversion from World (X, Z) to Canvas (u, v)
    const worldToCanvas = (x, z) => {
      const u = ((x / this.boardWidth) + 0.5) * canvas.width;
      const v = ((z / this.boardDepth) + 0.5) * canvas.height;
      return { u, v };
    };

    // Draw Power Rail Colored Strip Lines
    const drawPowerLine = (z, color, text) => {
      const p1 = worldToCanvas(-this.boardWidth * 0.46, z);
      const p2 = worldToCanvas(this.boardWidth * 0.46, z);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p1.u, p1.v);
      ctx.lineTo(p2.u, p2.v);
      ctx.stroke();

      // Silkscreen '+' or '-' symbols
      ctx.fillStyle = color;
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, p1.u - 24, p1.v);
      ctx.fillText(text, p2.u + 24, p2.v);
    };

    // Top rails
    drawPowerLine(this.rowZMap['top-vcc'], '#d32f2f', '+'); // Red VCC
    drawPowerLine(this.rowZMap['top-gnd'], '#1976d2', '-'); // Blue GND
    // Bottom rails
    drawPowerLine(this.rowZMap['bottom-vcc'], '#d32f2f', '+');
    drawPowerLine(this.rowZMap['bottom-gnd'], '#1976d2', '-');

    // Column numbers (1, 5, 10, 15, 20, 25, 30...)
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 15px monospace';
    ctx.textAlign = 'center';

    for (let col = 1; col <= this.totalCols; col++) {
      const x0 = -((this.totalCols - 1) * this.pitch) / 2;
      const x = x0 + (col - 1) * this.pitch;

      if (col % 5 === 0 || col === 1) {
        const pNumTop = worldToCanvas(x, -4.3);
        ctx.fillText(col.toString(), pNumTop.u, pNumTop.v);

        const pNumBottom = worldToCanvas(x, 4.3);
        ctx.fillText(col.toString(), pNumBottom.u, pNumBottom.v);
      }
    }

    // Row letters (A..E and F..J)
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
    ctx.font = 'bold 14px monospace';
    rows.forEach(r => {
      const z = this.rowZMap[r];
      const pLeft = worldToCanvas(-this.boardWidth * 0.45, z);
      const pRight = worldToCanvas(this.boardWidth * 0.45, z);
      ctx.fillStyle = '#6b7280';
      ctx.fillText(r, pLeft.u, pLeft.v);
      ctx.fillText(r, pRight.u, pRight.v);
    });

    // Draw Holes (recessed contact sockets)
    const drawHole = (x, z) => {
      const p = worldToCanvas(x, z);
      const holeSize = 11;
      
      // Socket outer bezel
      ctx.fillStyle = '#cfccc3';
      ctx.fillRect(p.u - holeSize / 2, p.v - holeSize / 2, holeSize, holeSize);

      // Socket deep interior
      ctx.fillStyle = '#1c1c1f';
      ctx.fillRect(p.u - (holeSize - 4) / 2, p.v - (holeSize - 4) / 2, holeSize - 4, holeSize - 4);

      // Subtle metallic phosphor bronze contact highlight
      ctx.fillStyle = '#595543';
      ctx.fillRect(p.u - 1, p.v - 1, 2, 2);
    };

    // Draw all holes for power rails and terminal strips
    const allRows = ['top-vcc', 'top-gnd', ...rows, 'bottom-vcc', 'bottom-gnd'];
    for (let col = 1; col <= this.totalCols; col++) {
      const x0 = -((this.totalCols - 1) * this.pitch) / 2;
      const x = x0 + (col - 1) * this.pitch;
      allRows.forEach(r => {
        drawHole(x, this.rowZMap[r]);
      });
    }

    // Create canvas texture
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 16;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    // Apply texture as top decal plane slightly above the body
    const decalGeom = new THREE.PlaneGeometry(this.boardWidth, this.boardDepth);
    const decalMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.4,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    const decalMesh = new THREE.Mesh(decalGeom, decalMat);
    decalMesh.rotation.x = -Math.PI / 2;
    decalMesh.position.y = this.ySurface + 0.005;
    decalMesh.receiveShadow = true;
    this.group.add(decalMesh);
  }
}
