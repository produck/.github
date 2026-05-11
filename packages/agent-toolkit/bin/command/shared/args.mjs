export function parseCommonArgs(argv) {
  const positional = [];
  const options = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        if (!options[token]) {
          options[token] = [];
        }
        options[token].push(true);
      } else {
        if (!options[token]) {
          options[token] = [];
        }
        options[token].push(next);
        i += 1;
      }
      continue;
    }
    positional.push(token);
  }

  return { positional, options };
}

export function getSingle(options, key, fallback = '') {
  if (!options[key] || options[key].length === 0) {
    return fallback;
  }
  return String(options[key][options[key].length - 1]);
}

export function getMulti(options, key) {
  if (!options[key]) {
    return [];
  }
  return options[key].map((v) => String(v));
}

export function hasFlag(options, key) {
  return Boolean(options[key]);
}
