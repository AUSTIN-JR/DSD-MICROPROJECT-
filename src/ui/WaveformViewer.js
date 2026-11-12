/**
 * WaveformViewer.js
 * High-performance 4-channel Digital Logic Analyzer / Oscilloscope Canvas.
 * 
 * Displays in real-time:
 * CH1: CLK (Input Frequency)
 * CH2: Q0 (Input / 2)
 * CH3: Q1 (Input / 4)
 * CH4: Q2 (Input / 8)
 */

export class WaveformViewer {
  constructor(canvasElement, simulator) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.simulator = simulator;

    // View options
    this.timeWindow = 4.0; // Show last 4 seconds on screen
    this.isFrozen = false;

    // Channels configuration
    this.channels = [
      { key: 'clk', name: 'CH1: CLK (IN)', sub: '555 Pin 3', color: '#00f0ff', ratio: '1:1', div: 1 },
      { key: 'q0',  name: 'CH2: Q0 (f/2)', sub: 'IC1 1Q (Pin 12)', color: '#ffd600', ratio: '2:1', div: 2 },
      { key: 'q1',  name: 'CH3: Q1 (f/4)', sub: 'IC1 2Q (Pin 9)',  color: '#ff9100', ratio: '4:1', div: 4 },
      { key: 'q2',  name: 'CH4: Q2 (f/8)', sub: 'IC2 1Q (Pin 12)', color: '#00e676', ratio: '8:1', div: 8 }
    ];

    this.init();
  }

  init() {
    this.handleResize();
    window.addEventListener('resize', this.handleResize.bind(this));
    this.render();
  }

  handleResize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width || 500;
    this.height = rect.height || 220;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.resetTransform?.();
    this.ctx.scale(dpr, dpr);
  }

  setTimeWindow(sec) {
    this.timeWindow = Math.max(1.0, Math.min(10.0, sec));
  }

  toggleFreeze() {
    this.isFrozen = !this.isFrozen;
  }

  render() {
    requestAnimationFrame(this.render.bind(this));

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    if (!w || !h) return;

    // 1. Dark phosphor CRT oscilloscope background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    // 2. Grid lines
    this.drawGrid(w, h);

    // 3. Channel wave tracks
    const trackPadding = 8;
    const availableHeight = h - trackPadding * 2;
    const channelHeight = availableHeight / this.channels.length;

    const waveformData = this.simulator.getWaveformData();
    const simState = this.simulator.getState();
    const currentTime = simState.simTime;
    const startTime = currentTime - this.timeWindow;

    // Draw each channel
    this.channels.forEach((ch, idx) => {
      const topY = trackPadding + idx * channelHeight;
      const bottomY = topY + channelHeight;
      const highY = topY + channelHeight * 0.22;
      const lowY = bottomY - channelHeight * 0.22;
      const trackMidY = (topY + bottomY) / 2;

      // Channel boundary separator line
      ctx.strokeStyle = '#151d2d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, bottomY);
      ctx.lineTo(w, bottomY);
      ctx.stroke();

      // Zero-level subtle baseline dotted line
      ctx.strokeStyle = '#1b2438';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(110, lowY);
      ctx.lineTo(w, lowY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw digital square wave from waveform buffer
      this.drawDigitalTrace(ch.key, ch.color, highY, lowY, startTime, currentTime, w, waveformData);

      // Channel Info Header / Sidebar overlay
      this.drawChannelHeader(ch, idx, topY, channelHeight, simState);
    });

    // 4. Time scale markers at bottom
    this.drawTimeScale(w, h, startTime, currentTime);

    // 5. Sweep Cursor at rightmost edge
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w - 2, 0);
    ctx.lineTo(w - 2, h);
    ctx.stroke();
  }

  drawGrid(w, h) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#0f1624';
    ctx.lineWidth = 1;

    // Vertical time division lines
    const divisions = 10;
    const dx = (w - 110) / divisions;
    for (let i = 0; i <= divisions; i++) {
      const x = 110 + i * dx;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  drawDigitalTrace(key, color, highY, lowY, startTime, currentTime, width, buffer) {
    const ctx = this.ctx;
    const plotLeft = 120;
    const plotWidth = width - plotLeft - 4;

    if (buffer.length < 2) return;

    // Helper: convert time to X coordinate
    const timeToX = (t) => {
      const normalized = (t - startTime) / this.timeWindow;
      return plotLeft + normalized * plotWidth;
    };

    // Filter points in view window
    const visiblePoints = [];
    for (let i = 0; i < buffer.length; i++) {
      const pt = buffer[i];
      if (pt.t >= startTime - 0.2 && pt.t <= currentTime + 0.1) {
        visiblePoints.push(pt);
      }
    }

    if (visiblePoints.length < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';

    ctx.beginPath();

    let started = false;
    let prevVal = visiblePoints[0][key];
    let prevX = timeToX(visiblePoints[0].t);
    let prevY = prevVal === 1 ? highY : lowY;

    for (let i = 0; i < visiblePoints.length; i++) {
      const pt = visiblePoints[i];
      const x = Math.max(plotLeft, Math.min(width, timeToX(pt.t)));
      const val = pt[key];
      const y = val === 1 ? highY : lowY;

      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        // Horizontal run at previous logic level
        ctx.lineTo(x, prevY);
        // If state changed, sharp vertical transition
        if (y !== prevY) {
          ctx.lineTo(x, y);
        }
      }

      prevVal = val;
      prevX = x;
      prevY = y;
    }

    // Extend trace to current time edge
    ctx.lineTo(width - 4, prevY);
    ctx.stroke();
    ctx.restore();
  }

  drawChannelHeader(ch, idx, topY, height, simState) {
    const ctx = this.ctx;
    const currentState = simState[ch.key];
    const currentFreq = simState.frequency / ch.div;

    // Header container background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(4, topY + 4, 110, height - 8);

    // Color accent strip on left
    ctx.fillStyle = ch.color;
    ctx.fillRect(4, topY + 4, 3, height - 8);

    // Channel Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(ch.name, 12, topY + 18);

    // Frequency readout
    ctx.fillStyle = ch.color;
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`${currentFreq.toFixed(2)} Hz`, 12, topY + 34);

    // Ratio and state pill
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`DIV /${ch.div}`, 12, topY + 48);

    // Live State Badge (HIGH / LOW)
    const badgeX = 72;
    const badgeY = topY + 18;
    ctx.fillStyle = currentState === 1 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.15)';
    ctx.strokeStyle = currentState === 1 ? '#22c55e' : '#64748b';
    ctx.lineWidth = 1;
    ctx.fillRect(badgeX, badgeY - 10, 36, 15);
    ctx.strokeRect(badgeX, badgeY - 10, 36, 15);

    ctx.fillStyle = currentState === 1 ? '#4ade80' : '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(currentState === 1 ? 'HIGH' : 'LOW', badgeX + 18, badgeY + 1);
    ctx.textAlign = 'left';
  }

  drawTimeScale(w, h, startTime, currentTime) {
    const ctx = this.ctx;
    ctx.fillStyle = '#64748b';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`Window: ${this.timeWindow.toFixed(1)}s`, w - 10, h - 4);

    ctx.textAlign = 'left';
    ctx.fillText(`T = ${currentTime.toFixed(2)}s`, 120, h - 4);
  }
}
