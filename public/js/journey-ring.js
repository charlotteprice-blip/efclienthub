// Journey ring: the mark's incomplete circle used as the journey indicator.
// The accent stroke fills the ring in proportion to the current stage.

import { RING, TRIANGLE } from './mark.js';

const NS = 'http://www.w3.org/2000/svg';

export function createJourneyRing({ stageIndex, stageCount, label }) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'journey-ring');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);

  const track = document.createElementNS(NS, 'path');
  track.setAttribute('d', RING);
  track.setAttribute('class', 'ring-track');
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke-width', '4');
  track.setAttribute('stroke-linecap', 'round');

  const fill = document.createElementNS(NS, 'path');
  fill.setAttribute('d', RING);
  fill.setAttribute('class', 'ring-fill');
  fill.setAttribute('fill', 'none');
  fill.setAttribute('stroke-width', '4');
  fill.setAttribute('stroke-linecap', 'round');
  fill.setAttribute('pathLength', '100');
  fill.style.strokeDashoffset = '100';

  const triangle = document.createElementNS(NS, 'path');
  triangle.setAttribute('d', TRIANGLE);
  triangle.setAttribute('class', 'ring-triangle');

  svg.append(track, fill, triangle);

  // Fill to the middle of the current stage so stage 1 already shows
  // progress and the final stage reads as nearly complete.
  const fraction = Math.min(1, Math.max(0, (stageIndex + 0.5) / stageCount));
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      fill.style.strokeDashoffset = String(100 - fraction * 100);
    });
  });
  return svg;
}
