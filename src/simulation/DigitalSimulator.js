/**
 * DigitalSimulator.js
 * Genuine Digital Logic Simulation for Frequency Divider Using T Flip-Flops.
 * 
 * Hardware Equivalent:
 * - Clock Source: NE555 Timer in Astable Multivibrator configuration.
 * - Stage 1 (FF0): 74LS73 Dual JK Flip-Flop #1 (Unit A) with J=1, K=1 (T Flip-Flop).
 * - Stage 2 (FF1): 74LS73 Dual JK Flip-Flop #1 (Unit B) with J=1, K=1 (T Flip-Flop).
 * - Stage 3 (FF2): 74LS73 Dual JK Flip-Flop #2 (Unit A) with J=1, K=1 (T Flip-Flop).
 * 
 * 74LS73 Behavior:
 * - Negative-edge triggered (falling edge: 1 -> 0).
 * - When J = 1, K = 1, on every falling clock edge, Q toggles (Q_next = NOT Q).
 * - Cascaded ripple divider:
 *     FF0.clk = CLK_in    => Q0 frequency = f_in / 2
 *     FF1.clk = Q0        => Q1 frequency = f_in / 4
 *     FF2.clk = Q1        => Q2 frequency = f_in / 8
 */

export class DigitalSimulator {
  constructor(options = {}) {
    // Clock parameters
    this.frequency = options.frequency || 2.0; // Default 2.0 Hz for clear visual tracking
    this.dutyCycle = 0.50; // 50% square wave
    this.isRunning = true;
    
    // Internal timing
    this.simTime = 0; // Simulated time in seconds
    this.lastRealTimestamp = null;
    this.clockPhase = 0; // 0 to 1 within current cycle

    // Raw logic states
    this.clk = 0;
    this.q0 = 0;
    this.q1 = 0;
    this.q2 = 0;

    // Previous states for edge detection
    this.lastClk = 0;
    this.lastQ0 = 0;
    this.lastQ1 = 0;
    this.lastQ2 = 0;

    // Edge event flags (active for 1 step for visual particle trigger)
    this.edgeEvents = {
      clkFalling: false,
      clkRising: false,
      q0Falling: false,
      q0Rising: false,
      q1Falling: false,
      q1Rising: false,
      q2Falling: false,
      q2Rising: false
    };

    // Measured frequency calculation
    this.cycleCount = 0;
    this.edgeTimes = {
      clk: [],
      q0: [],
      q1: [],
      q2: []
    };

    // Waveform history buffer for logic analyzer
    this.waveformBuffer = [];
    this.maxBufferLength = 2000;
    this.sampleInterval = 0.005; // 5ms per sample (200 Hz sampling)
    this.timeSinceLastSample = 0;

    // Record initial t=0 sample
    this.recordSample();

    // Event listeners
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    const state = this.getState();
    for (const cb of this.listeners) {
      cb(state);
    }
  }

  getState() {
    const periodIn = this.frequency > 0 ? (1 / this.frequency) : 0;
    const freqQ0 = this.frequency / 2;
    const freqQ1 = this.frequency / 4;
    const freqQ2 = this.frequency / 8;

    // 3-bit ripple counter binary value: [Q2, Q1, Q0]
    const decimalValue = (this.q2 << 2) | (this.q1 << 1) | this.q0;

    return {
      isRunning: this.isRunning,
      frequency: this.frequency,
      simTime: this.simTime,
      clk: this.clk,
      q0: this.q0,
      q1: this.q1,
      q2: this.q2,
      lastClk: this.lastClk,
      edgeEvents: { ...this.edgeEvents },
      stages: [
        {
          id: 'stage0',
          name: 'Input Clock (NE555)',
          pin: '555 Pin 3 (OUT)',
          state: this.clk,
          frequency: this.frequency,
          ratio: '1:1',
          divisor: 1,
          periodMs: periodIn * 1000,
          color: '#00f0ff' // Cyan
        },
        {
          id: 'stage1',
          name: 'Stage 1 (FF0 - 74LS73 #1A)',
          pin: 'IC1 Pin 12 (1Q)',
          state: this.q0,
          frequency: freqQ0,
          ratio: '2:1',
          divisor: 2,
          periodMs: periodIn * 2000,
          color: '#ffd600' // Yellow
        },
        {
          id: 'stage2',
          name: 'Stage 2 (FF1 - 74LS73 #1B)',
          pin: 'IC1 Pin 9 (2Q)',
          state: this.q1,
          frequency: freqQ1,
          ratio: '4:1',
          divisor: 4,
          periodMs: periodIn * 4000,
          color: '#ff9100' // Orange
        },
        {
          id: 'stage3',
          name: 'Stage 3 (FF2 - 74LS73 #2A)',
          pin: 'IC2 Pin 12 (1Q)',
          state: this.q2,
          frequency: freqQ2,
          ratio: '8:1',
          divisor: 8,
          periodMs: periodIn * 8000,
          color: '#00e676' // Emerald Green
        }
      ],
      counter: {
        binary: `${this.q2}${this.q1}${this.q0}`,
        decimal: decimalValue,
        max: 7
      }
    };
  }

  setFrequency(hz) {
    this.frequency = Math.max(0.1, Math.min(50.0, hz));
    this.notify();
  }

  start() {
    this.isRunning = true;
    this.notify();
  }

  stop() {
    this.isRunning = false;
    this.notify();
  }

  togglePlay() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  reset() {
    this.clk = 0;
    this.q0 = 0;
    this.q1 = 0;
    this.q2 = 0;
    this.lastClk = 0;
    this.lastQ0 = 0;
    this.lastQ1 = 0;
    this.lastQ2 = 0;
    this.clockPhase = 0;
    this.simTime = 0;
    this.waveformBuffer = [];
    this.clearEdgeEvents();
    this.notify();
  }

  clearEdgeEvents() {
    this.edgeEvents.clkFalling = false;
    this.edgeEvents.clkRising = false;
    this.edgeEvents.q0Falling = false;
    this.edgeEvents.q0Rising = false;
    this.edgeEvents.q1Falling = false;
    this.edgeEvents.q1Rising = false;
    this.edgeEvents.q2Falling = false;
    this.edgeEvents.q2Rising = false;
  }

  /**
   * Manual single-clock step / pulse (toggles clock HIGH then LOW to trigger flip-flop cascade)
   */
  singlePulse() {
    // Generate full pulse cycle: 0 -> 1 (rising), then 1 -> 0 (falling edge triggering FF cascade)
    this.clearEdgeEvents();

    // 1. Clock rising edge
    this.lastClk = 0;
    this.clk = 1;
    this.edgeEvents.clkRising = true;
    this.recordSample();

    // 2. Clock falling edge (the trigger for 74LS73)
    setTimeout(() => {
      this.clearEdgeEvents();
      this.lastClk = 1;
      this.clk = 0;
      this.edgeEvents.clkFalling = true;
      this.evaluateCascadedFlipFlops();
      this.recordSample();
      this.notify();
    }, 150);

    this.notify();
  }

  /**
   * Evaluates the cascaded T flip-flops on clock transitions.
   * In 74LS73:
   * J=1, K=1, Active-low Clear=1.
   * Triggering: Negative-edge triggered (falling edge).
   */
  evaluateCascadedFlipFlops() {
    // Check Clock falling edge: 1 -> 0
    if (this.lastClk === 1 && this.clk === 0) {
      this.edgeEvents.clkFalling = true;
      
      // FF0 toggles on CLK falling edge
      this.lastQ0 = this.q0;
      this.q0 = this.q0 === 1 ? 0 : 1;
      
      if (this.lastQ0 === 0 && this.q0 === 1) {
        this.edgeEvents.q0Rising = true;
      } else if (this.lastQ0 === 1 && this.q0 === 0) {
        this.edgeEvents.q0Falling = true;
        
        // FF1 clock input is Q0. Since FF1 is negative-edge triggered,
        // it toggles when Q0 falls (1 -> 0)!
        this.lastQ1 = this.q1;
        this.q1 = this.q1 === 1 ? 0 : 1;

        if (this.lastQ1 === 0 && this.q1 === 1) {
          this.edgeEvents.q1Rising = true;
        } else if (this.lastQ1 === 1 && this.q1 === 0) {
          this.edgeEvents.q1Falling = true;

          // FF2 clock input is Q1. Toggles when Q1 falls (1 -> 0)!
          this.lastQ2 = this.q2;
          this.q2 = this.q2 === 1 ? 0 : 1;

          if (this.lastQ2 === 0 && this.q2 === 1) {
            this.edgeEvents.q2Rising = true;
          } else if (this.lastQ2 === 1 && this.q2 === 0) {
            this.edgeEvents.q2Falling = true;
          }
        }
      }
    } else if (this.lastClk === 0 && this.clk === 1) {
      this.edgeEvents.clkRising = true;
    }
  }

  /**
   * Advances simulation by dt seconds.
   * Uses micro-stepping if dt is large to guarantee no missed clock edges!
   */
  update(dt) {
    if (!this.isRunning || dt <= 0) return;

    // Clear edge events at start of frame
    this.clearEdgeEvents();

    const period = 1.0 / this.frequency;
    // Micro-step size so that each half-cycle has at least 8 micro-steps
    const maxSubStep = Math.min(0.002, period / 16);
    let remainingTime = dt;

    while (remainingTime > 0) {
      const step = Math.min(remainingTime, maxSubStep);
      this.simTime += step;
      this.timeSinceLastSample += step;

      // Update clock phase
      const prevPhase = this.clockPhase;
      this.clockPhase = (this.clockPhase + (step / period)) % 1.0;

      // Check if clock state changed
      const prevClk = this.clk;
      const nextClk = this.clockPhase < this.dutyCycle ? 1 : 0;

      if (nextClk !== prevClk) {
        this.lastClk = prevClk;
        this.clk = nextClk;
        this.evaluateCascadedFlipFlops();
      }

      // Record waveform sample at regular intervals
      if (this.timeSinceLastSample >= this.sampleInterval) {
        this.recordSample();
        this.timeSinceLastSample = 0;
      }

      remainingTime -= step;
    }

    this.notify();
  }

  recordSample() {
    this.waveformBuffer.push({
      t: this.simTime,
      clk: this.clk,
      q0: this.q0,
      q1: this.q1,
      q2: this.q2,
      edgeEvents: { ...this.edgeEvents }
    });

    if (this.waveformBuffer.length > this.maxBufferLength) {
      this.waveformBuffer.shift();
    }
  }

  getWaveformData() {
    return this.waveformBuffer;
  }
}
