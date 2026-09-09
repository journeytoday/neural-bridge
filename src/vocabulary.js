const key = value => value.normalize('NFKC').toLocaleLowerCase('en');
function validTerm(term) {
  if (typeof term !== 'string' || !term.trim()) throw new TypeError('A nonempty personal term is required');
  return term;
}
function validEnvironment(environment) {
  if (typeof environment !== 'string' || !environment.trim()) throw new TypeError('An environment name is required');
  return environment;
}

/** Local prefix suggestions. No operation learns from typing or search history. */
export class Vocabulary {
  #bootstrap;
  #personal = [];
  constructor(bootstrap) {
    const words = Array.isArray(bootstrap) ? bootstrap : bootstrap?.words;
    if (!Array.isArray(words) || words.some(word => typeof word !== 'string' || !word.trim())) {
      throw new TypeError('Bootstrap must contain an array of words');
    }
    this.#bootstrap = [...new Map(words.map(word => [key(word), word])).values()];
  }

  search(prefix, environment = 'global') {
    if (typeof prefix !== 'string') throw new TypeError('Prefix must be text');
    validEnvironment(environment);
    const query = key(prefix);
    if (!query.trim()) return [];
    const local = this.#personal.filter(entry => entry.environment === environment);
    const global = environment === 'global' ? [] : this.#personal.filter(entry => entry.environment === 'global');
    const candidates = [...local.map(entry => entry.term), ...global.map(entry => entry.term), ...this.#bootstrap];
    const seen = new Set();
    return candidates.filter(term => {
      const normalized = key(term);
      if (!normalized.startsWith(query) || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }).slice(0, 8);
  }

  /** Calling add is explicit approval; arbitrary Unicode phrases are retained verbatim. */
  add(term, environment = 'global') {
    validTerm(term);
    validEnvironment(environment);
    if (this.#personal.some(entry => entry.environment === environment && key(entry.term) === key(term))) return false;
    this.#personal.push({ term, environment });
    return true;
  }

  remove(term, environment = 'global') {
    validTerm(term);
    validEnvironment(environment);
    const before = this.#personal.length;
    this.#personal = this.#personal.filter(entry => entry.environment !== environment || key(entry.term) !== key(term));
    return this.#personal.length !== before;
  }

  export() {
    return { version: 1, personal: this.#personal.map(entry => ({ ...entry })) };
  }

  /** Explicitly approves an imported personal vocabulary; replacement is atomic. */
  import(payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!data || data.version !== 1 || !Array.isArray(data.personal)) throw new TypeError('Unsupported personal vocabulary format');
    const next = new Vocabulary([]);
    for (const entry of data.personal) {
      if (!entry || typeof entry !== 'object') throw new TypeError('Invalid personal vocabulary entry');
      next.add(validTerm(entry.term), validEnvironment(entry.environment));
    }
    this.#personal = next.export().personal;
    return this.#personal.length;
  }
}
