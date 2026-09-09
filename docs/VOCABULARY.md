# Vocabulary

`assets/vocabulary-en.json` contains exactly 1000 unique English word tokens and contractions in subtitle frequency order. This is a starting suggestion vocabulary, not a restriction on the user's text. Some subtitle language is colloquial, includes proper names, or is adult language; frequency is not a clinical communication priority score.

## Attribution and reuse

Source: [Hermit Dave, FrequencyWords English 2018](https://github.com/hermitdave/FrequencyWords/blob/master/content/2018/en/en_50k.txt), derived from OpenSubtitles2018. Retrieved September 9, 2026. The upstream [README](https://github.com/hermitdave/FrequencyWords#license) licenses **content under CC BY-SA 4.0** (the repository's MIT license applies to code).

The vocabulary data is distributed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/). Retain this attribution and license when sharing it; share adaptations of this data under that license. The license does not impose that license on the independently written application code.

Changes: discard tokens other than lowercase alphabetic words or apostrophe contractions, deduplicate, then select the first 1000 tokens while retaining their source order. Source occurrence counts are omitted. The original Google top-word list was not used because its stated reuse terms restrict commercial use.

## API

`new Vocabulary(bootstrap)` accepts the JSON object or a string array. `search(prefix, environment = 'global')` returns up to eight strings: matching personal entries in the active environment first, global personal entries next, bootstrap words last. Order inside each tier stays stable. Matching uses Unicode NFKC normalization and English lowercase; original personal text is preserved. Duplicates across tiers appear only once. Empty prefixes return no suggestions.

Only explicit `add(term, environment = 'global')` and `import(payload)` calls add approved personal terms. Search does not learn, save input, infer approvals, or contact a service. `remove(term, environment = 'global')` removes a personal term only; it cannot remove bootstrap entries. Personal terms accept arbitrary nonempty Unicode text, phrases, punctuation and whitespace without truncation. Environment names are case-sensitive.

`export()` returns a detached `{version: 1, personal: [{term, environment}]}` object. `import()` accepts that object or serialized JSON, validates all entries and replaces personal vocabulary atomically. Unknown versions and invalid entries throw without changing existing data. Import is itself an approval operation, so call it only for a user-selected personal-vocabulary import. Personal data is kept separate from bootstrap data. The host owns persistence and should render terms as text rather than HTML.
