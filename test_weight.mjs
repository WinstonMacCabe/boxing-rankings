import { parseWikitextInfobox, extractInfobox } from './lib/wikipedia.ts';

const wikitext = `{{Infobox boxer
| name = Test
| weight = {{plainlist|
*[[Super featherweight]]
*[[Lightweight]]
}}
| total = 50
| wins = 50
}}`;

console.log('Extracted:', extractInfobox(wikitext));
const r = parseWikitextInfobox(wikitext);
console.log('WeightClass:', JSON.stringify(r.weightClass));
