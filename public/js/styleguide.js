import { applyAccent, loadClientTypes, stageCopy } from './client-types.js';
import { mountMarks } from './mark.js';

const SKY = '#CFDAE8';

function luminance(hex) {
  const n = hex.replace('#', '');
  return [0, 2, 4]
    .map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const swatches = [
  ['Sky, ground', '#CFDAE8'],
  ['Slate, ink', '#3E5680'],
  ['Navy, call to action', '#2E4062'],
  ['Warm white, panel', '#F5F3EE'],
  ['Error', '#8A3F34'],
  ['Done', '#2F5D3A'],
  ['In progress', '#2E4062'],
  ['Needs attention', '#6E4A10'],
];

function renderSwatches(extra) {
  const list = document.getElementById('swatches');
  list.replaceChildren();
  for (const [name, hex] of [...swatches, ...extra]) {
    const li = document.createElement('li');
    li.className = 'swatch';
    const chip = document.createElement('div');
    chip.className = 'swatch-chip';
    chip.style.background = hex;
    const text = document.createElement('div');
    text.className = 'swatch-text';
    const strong = document.createElement('strong');
    strong.textContent = name;
    text.append(strong, `${hex} · ${ratio(hex, SKY).toFixed(2)}:1`);
    li.append(chip, text);
    list.append(li);
  }
}

const config = await loadClientTypes();
renderSwatches(
  Object.entries(config.types)
    .filter(([, t]) => t.accent !== '#3E5680')
    .map(([name, t]) => [`Accent ${name}${t.accentPlaceholder ? ' (placeholder)' : ''}`, t.accent]),
);

for (const button of document.querySelectorAll('[data-type]')) {
  button.addEventListener('click', () => {
    const type = button.dataset.type;
    applyAccent(config, type);
    const copy = stageCopy(config, type, 'assessment');
    document.getElementById('stage-title').textContent = copy.title;
    document.getElementById('stage-body').textContent = copy.body;
  });
}

const weight = document.getElementById('toggle-weight');
weight.addEventListener('click', () => {
  const light = document.documentElement.dataset.weight === 'light';
  if (light) delete document.documentElement.dataset.weight;
  else document.documentElement.dataset.weight = 'light';
  weight.setAttribute('aria-pressed', String(!light));
  weight.textContent = light ? 'Show body at weight 300' : 'Show body at weight 400';
});

document.getElementById('progress-fill').style.width = `${(4 / 12) * 100}%`;

mountMarks();
document.getElementById('replay').addEventListener('click', () => {
  const loader = document.getElementById('loader');
  const old = loader.querySelector('svg');
  const fresh = document.createElement('span');
  fresh.dataset.mark = 'draw';
  fresh.dataset.size = 'large';
  fresh.dataset.label = 'Executive Frame';
  old.replaceWith(fresh);
  mountMarks(loader);
});
