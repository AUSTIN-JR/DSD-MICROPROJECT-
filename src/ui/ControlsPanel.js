/**
 * ControlsPanel.js
 * Bridges UI DOM elements with the DigitalSimulator and 3D Breadboard Scene.
 */

export class ControlsPanel {
  constructor(simulator, scene, waveformViewer) {
    this.sim = simulator;
    this.scene = scene;
    this.waveform = waveformViewer;

    this.cacheElements();
    this.bindEvents();
    this.subscribeSimulator();
  }

  cacheElements() {
    // Playback buttons
    this.btnStartStop = document.getElementById('btn-start-stop');
    this.btnPulse = document.getElementById('btn-pulse');
    this.btnReset = document.getElementById('btn-reset');
    this.statusBadge = document.getElementById('sim-status-badge');

    // Frequency controls
    this.freqSlider = document.getElementById('freq-slider');
    this.freqDisplay = document.getElementById('freq-display-value');
    this.presetButtons = document.querySelectorAll('.freq-preset-btn');

    // Stage readout elements
    this.stageCards = {
      stage0: {
        freq: document.getElementById('stage0-freq'),
        period: document.getElementById('stage0-period'),
        state: document.getElementById('stage0-state'),
        pill: document.getElementById('stage0-pill')
      },
      stage1: {
        freq: document.getElementById('stage1-freq'),
        period: document.getElementById('stage1-period'),
        state: document.getElementById('stage1-state'),
        pill: document.getElementById('stage1-pill')
      },
      stage2: {
        freq: document.getElementById('stage2-freq'),
        period: document.getElementById('stage2-period'),
        state: document.getElementById('stage2-state'),
        pill: document.getElementById('stage2-pill')
      },
      stage3: {
        freq: document.getElementById('stage3-freq'),
        period: document.getElementById('stage3-period'),
        state: document.getElementById('stage3-state'),
        pill: document.getElementById('stage3-pill')
      }
    };

    // Counter readouts
    this.counterBinary = document.getElementById('counter-binary');
    this.counterDecimal = document.getElementById('counter-decimal');

    // Camera preset buttons
    this.cameraButtons = document.querySelectorAll('.cam-btn');

    // Theory modal elements
    this.btnTheory = document.getElementById('btn-theory');
    this.modalTheory = document.getElementById('theory-modal');
    this.btnCloseTheory = document.getElementById('btn-close-theory');

    // Oscilloscope time scale buttons
    this.btnOscZoomIn = document.getElementById('btn-osc-zoomin');
    this.btnOscZoomOut = document.getElementById('btn-osc-zoomout');
    this.btnOscFreeze = document.getElementById('btn-osc-freeze');
  }

  bindEvents() {
    // Play / Pause toggle
    this.btnStartStop?.addEventListener('click', () => {
      this.sim.togglePlay();
    });

    // Single step pulse
    this.btnPulse?.addEventListener('click', () => {
      this.sim.singlePulse();
    });

    // Reset
    this.btnReset?.addEventListener('click', () => {
      this.sim.reset();
    });

    // Frequency Slider
    this.freqSlider?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.sim.setFrequency(val);
      if (this.freqDisplay) this.freqDisplay.textContent = `${val.toFixed(2)} Hz`;
    });

    // Frequency Presets
    this.presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const hz = parseFloat(btn.dataset.hz);
        this.sim.setFrequency(hz);
        if (this.freqSlider) this.freqSlider.value = hz;
        if (this.freqDisplay) this.freqDisplay.textContent = `${hz.toFixed(2)} Hz`;
      });
    });

    // Camera Presets
    this.cameraButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.cameraButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const preset = btn.dataset.preset;
        this.scene.setCameraPreset(preset);
      });
    });

    // Theory Modal
    this.btnTheory?.addEventListener('click', () => {
      this.modalTheory?.classList.remove('hidden');
    });

    this.btnCloseTheory?.addEventListener('click', () => {
      this.modalTheory?.classList.add('hidden');
    });

    this.modalTheory?.addEventListener('click', (e) => {
      if (e.target === this.modalTheory) {
        this.modalTheory.classList.add('hidden');
      }
    });

    // Oscilloscope controls
    this.btnOscZoomIn?.addEventListener('click', () => {
      this.waveform.setTimeWindow(this.waveform.timeWindow * 0.7);
    });

    this.btnOscZoomOut?.addEventListener('click', () => {
      this.waveform.setTimeWindow(this.waveform.timeWindow * 1.4);
    });

    this.btnOscFreeze?.addEventListener('click', () => {
      this.waveform.toggleFreeze();
      this.btnOscFreeze.classList.toggle('active', this.waveform.isFrozen);
      this.btnOscFreeze.textContent = this.waveform.isFrozen ? 'UNFREEZE' : 'FREEZE';
    });
  }

  subscribeSimulator() {
    this.sim.subscribe((state) => {
      this.updateUI(state);
    });
  }

  updateUI(state) {
    // 1. Play / Pause button status
    if (this.btnStartStop) {
      if (state.isRunning) {
        this.btnStartStop.innerHTML = `<span class="icon">⏸</span> STOP`;
        this.btnStartStop.classList.remove('btn-success');
        this.btnStartStop.classList.add('btn-warning');
        if (this.statusBadge) {
          this.statusBadge.textContent = 'RUNNING';
          this.statusBadge.className = 'status-badge running';
        }
      } else {
        this.btnStartStop.innerHTML = `<span class="icon">▶</span> START`;
        this.btnStartStop.classList.remove('btn-warning');
        this.btnStartStop.classList.add('btn-success');
        if (this.statusBadge) {
          this.statusBadge.textContent = 'PAUSED';
          this.statusBadge.className = 'status-badge paused';
        }
      }
    }

    // 2. Update 4 Frequency Stage Cards
    state.stages.forEach((stage, idx) => {
      const card = this.stageCards[`stage${idx}`];
      if (card) {
        if (card.freq) card.freq.textContent = `${stage.frequency.toFixed(2)} Hz`;
        if (card.period) card.period.textContent = `${stage.periodMs.toFixed(1)} ms`;
        if (card.state) {
          card.state.textContent = stage.state === 1 ? 'HIGH (1)' : 'LOW (0)';
          card.state.className = `logic-state-tag ${stage.state === 1 ? 'high' : 'low'}`;
        }
        if (card.pill) {
          card.pill.classList.toggle('active', stage.state === 1);
        }
      }
    });

    // 3. Update Ripple Counter values
    if (this.counterBinary) {
      this.counterBinary.innerHTML = `
        <span class="bit ${state.q2 ? 'bit-1' : 'bit-0'}">${state.q2}</span>
        <span class="bit ${state.q1 ? 'bit-1' : 'bit-0'}">${state.q1}</span>
        <span class="bit ${state.q0 ? 'bit-1' : 'bit-0'}">${state.q0}</span>
      `;
    }

    if (this.counterDecimal) {
      this.counterDecimal.textContent = state.counter.decimal;
    }
  }
}
