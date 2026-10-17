// Loads config/client-types.json and applies a client type to the page:
// the accent colour and the journey copy. Type names are never written to
// the page for clients.

let cache = null;

export async function loadClientTypes() {
  if (!cache) {
    const res = await fetch('/config/client-types.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Could not load client type settings.');
    cache = await res.json();
  }
  return cache;
}

export function applyAccent(config, type) {
  const accent = config.types?.[type]?.accent;
  const root = document.documentElement;
  if (accent) {
    root.style.setProperty('--accent', accent);
  } else {
    root.style.removeProperty('--accent');
  }
}

// Copy for a stage: the type's wording where it has one, otherwise the
// default wording, merged field by field.
export function stageCopy(config, type, stage) {
  const base = config.defaultCopy?.[stage] ?? {};
  const override = config.types?.[type]?.copy?.[stage] ?? {};
  return { ...base, ...override };
}

export function stageIndex(config, stage) {
  return config.stages.indexOf(stage);
}
