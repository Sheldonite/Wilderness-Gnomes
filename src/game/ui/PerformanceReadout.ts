/** Development-only rendering readout, toggled with F9. */
export function installPerformanceReadout(): void {
  if (!import.meta.env.DEV) return;
  const readout = document.createElement('output');
  readout.id = 'performance-readout';
  readout.hidden = true;
  readout.style.cssText = 'position:fixed;bottom:42px;left:16px;z-index:100;color:white;background:#172b20;padding:8px;font:12px monospace;pointer-events:none';
  document.body.append(readout);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'F9') { event.preventDefault(); readout.hidden = !readout.hidden; }
  });
  let previous = performance.now();
  let samples: number[] = [];
  const tick = (now: number) => {
    samples.push(now - previous);
    previous = now;
    if (samples.length === 120) {
      const sorted = samples.slice().sort((a, b) => a - b);
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      readout.textContent = `${(1000 / mean).toFixed(1)} FPS · mean ${mean.toFixed(1)} ms · p95 ${sorted[114].toFixed(1)} ms${readout.dataset.enemies ? ` · ${readout.dataset.enemies} foes · ${readout.dataset.pickups} pickups` : ''}`;
      samples = [];
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
