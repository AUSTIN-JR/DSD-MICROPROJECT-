/**
 * main.js
 * Entry point for DSD Microproject: Frequency Divider Using T Flip-Flops.
 */

import './style.css';
import { DigitalSimulator } from './simulation/DigitalSimulator.js';
import { BreadboardScene } from './components3d/BreadboardScene.js';
import { WaveformViewer } from './ui/WaveformViewer.js';
import { ControlsPanel } from './ui/ControlsPanel.js';

function startApp() {
  console.log('⚡ Initializing Digital Systems Lab: Frequency Divider Using T Flip-Flops...');

  try {
    // 1. Initialize genuine digital logic simulator
    const simulator = new DigitalSimulator({
      frequency: 2.0 // Initial 2.0 Hz default
    });
    window.__SIMULATOR__ = simulator;

    // 2. Initialize 3D electronics laboratory scene
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) {
      console.error('Fatal: #canvas-container element not found in DOM');
      return;
    }
    const scene = new BreadboardScene(canvasContainer, simulator);
    window.__SCENE__ = scene;

    // 3. Initialize real-time logic analyzer / oscilloscope canvas
    const oscCanvas = document.getElementById('oscilloscope-canvas');
    if (!oscCanvas) {
      console.error('Fatal: #oscilloscope-canvas element not found in DOM');
      return;
    }
    const waveformViewer = new WaveformViewer(oscCanvas, simulator);
    window.__WAVEFORM__ = waveformViewer;

    // 4. Initialize controls deck and bind UI
    const controlsPanel = new ControlsPanel(simulator, scene, waveformViewer);
    window.__CONTROLS__ = controlsPanel;

    // Initial UI sync
    controlsPanel.updateUI(simulator.getState());

    console.log('✅ Simulation and 3D Breadboard Lab successfully initialized.');
  } catch (err) {
    console.error('Fatal initialization error:', err);
  }
}

// Execute immediately if DOM is already ready, otherwise on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
