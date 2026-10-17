// Behaviour for the static layout previews in /preview. These pages hold
// sample content only and are removed before launch.

import { applyAccent, loadClientTypes } from './client-types.js';
import { createJourneyRing } from './journey-ring.js';

const config = await loadClientTypes();
const viewer = document.querySelector('.viewer');

if (viewer?.dataset.previewType) applyAccent(config, viewer.dataset.previewType);

for (const holder of document.querySelectorAll('[data-ring]')) {
  holder.replaceWith(
    createJourneyRing({
      stageIndex: Number(holder.dataset.stage),
      stageCount: Number(holder.dataset.stages),
      label: holder.dataset.label,
    }),
  );
}

for (const dot of document.querySelectorAll('.type-dot')) {
  const accent = config.types?.[dot.dataset.type]?.accent;
  if (accent) {
    dot.style.background = accent;
  } else {
    dot.style.border = '1.5px solid currentColor';
  }
}

for (const bar of document.querySelectorAll('[data-progress]')) {
  bar.style.width = `${(Number(bar.dataset.progress) / Number(bar.dataset.total)) * 100}%`;
}

// Keyboard answering on the questionnaire screen: number keys choose.
const form = document.getElementById('item-form');
if (form) {
  const radios = [...form.querySelectorAll('input[type="radio"]')];
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input[type="text"], textarea')) return;
    const n = Number(event.key);
    if (n >= 1 && n <= radios.length) {
      radios[n - 1].checked = true;
      radios[n - 1].focus();
    }
  });
  form.addEventListener('submit', (event) => event.preventDefault());
}
