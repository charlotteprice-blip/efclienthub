import { applyAccent, loadClientTypes, stageCopy } from './client-types.js';
import { mountMarks } from './mark.js';
import { STAGE_LABELS, journeySteps, notice, status, stepTracker } from './ui.js';


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

// Colours are read from the generated tokens, so this page cannot drift.
const css = getComputedStyle(document.documentElement);
const token = (name) => css.getPropertyValue(name).trim();
const swatches = [
  ['Sky, ground', token('--ef-sky')],
  ['Slate, ink', token('--ef-slate')],
  ['Navy, primary button', token('--ef-navy')],
  ['Warm white, panel', token('--ef-warm-white')],
  ['Success, done', token('--app-success')],
  ['Info, in progress', token('--app-info')],
  ['Warning, needs attention', token('--app-warning')],
  ['Error', token('--app-error')],
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
    text.append(strong, `${hex} · ${ratio(hex, token('--ef-sky')).toFixed(2)}:1`);
    li.append(chip, text);
    list.append(li);
  }
}

const config = await loadClientTypes();
renderSwatches(
  Object.entries(config.types)
    .filter(([, t]) => t.accent.toUpperCase() !== token('--ef-slate').toUpperCase())
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

// Status, notices, tasks and the step tracker are drawn by the same helpers
// the live app uses.
document.getElementById('sg-status').innerHTML = [status('done', 'Done'), status('progress', 'In progress'), status('attention', 'Needs attention'), status('todo', 'Not started')].join(' ');
document.getElementById('sg-notices').innerHTML = [
  notice('info', '<p>Your results will appear here after Sarah has gone through them with you.</p>', { word: 'Not shared yet' }),
  notice('success', '<p>Next session saved.</p>'),
  notice('warning', '<p>1 answer flagged in a questionnaire.</p>', { word: 'Answers to follow up' }),
  notice('error', '<p>That code has expired. Ask Sarah for a new one.</p>'),
].join('');
const stages = Object.keys(STAGE_LABELS);
document.getElementById('sg-tracker').innerHTML = stepTracker(journeySteps(stages, 2, { assessment: '2 of 4' }), { label: 'Step 3 of 7: Questionnaires' });
document.getElementById('sg-tracker-dots').innerHTML = stepTracker(journeySteps(stages, 4), { label: 'Step 5 of 7: Feedback', dots: true });
document.getElementById('sg-tasks').innerHTML = [
  ['Questionnaire one', status('done', 'Done')],
  ['Questionnaire two', status('progress', 'In progress')],
  ['Questionnaire three', status('todo', 'Not started')],
].map(([name, pill]) => `<li class="task"><span>${name}</span>${pill}<span></span></li>`).join('');

mountMarks();
document.getElementById('replay').addEventListener('click', () => {
  const loader = document.getElementById('loader');
  const old = loader.querySelector('svg');
  const fresh = document.createElement('span');
  fresh.dataset.mark = 'draw';
  fresh.dataset.label = 'Executive Frame';
  old.replaceWith(fresh);
  mountMarks(loader);
});
