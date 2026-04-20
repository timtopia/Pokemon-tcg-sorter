const Database = require('better-sqlite3');
const db = new Database('pokemon-tcg.db');

const API_BASE = 'https://api.pokemontcg.io/v2';
const DELAY_MS = 500;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- RULES ---

// Sets from Neo Destiny and earlier: skip 1st edition variants
const EARLY_SETS = new Set([
  'base1','base2','basep','base3','base4','base5',
  'gym1','gym2',
  'neo1','neo2','neo3','neo4',
  'si1','bp',
]);

// Sets that get Pokeball + Masterball (within printedTotal, basic rarity)
const POKEBALL_SETS = new Set(['sv8pt5', 'zsv10pt5', 'rsv10pt5']);

// Ascended Heroes: Energy Holo + Ball Holo for Pokemon, Reverse Holo for Trainers
const ASCENDED_HEROES = 'me2pt5';

// Override sets: ignore API data entirely
const OVERRIDE_SETS = {
  'cel25': 'holofoil-only',     // Celebrations
  'cel25c': 'holofoil-only',    // Celebrations: Classic Collection
  'xy0': 'normal-only',         // Kalos Starter Set
};

// Specific card overrides: [setCode, cardNumber] -> variants
const CARD_OVERRIDES = {
  'sv7:16': { 'Normal': 0, 'Reverse Holo': 0 },  // Lokix in Stellar Crown
};

// Variant key mapping
const VARIANT_MAP = {
  'normal': 'Normal',
  'holofoil': 'Holofoil',
  'reverseHolofoil': 'Reverse Holo',
  'unlimitedHolofoil': 'Holofoil',
  'unlimited': 'Normal',
};

function shouldSkipKey(key, setCode) {
  const lower = key.toLowerCase();
  // Always skip 1st edition for early sets
  if (lower.includes('1stedition') && EARLY_SETS.has(setCode)) return true;
  // For all other sets, also skip 1st edition (user doesn't want them)
  if (lower.includes('1stedition')) return true;
  return false;
}

async function fetchAllCards(setId) {
  let page = 1, all = [];
  while (true) {
    const url = `${API_BASE}/cards?q=set.id:${setId}&pageSize=250&page=${page}&select=number,name,rarity,supertype,tcgplayer`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    all = all.concat(data.data);
    if (all.length >= data.totalCount || data.data.length < 250) break;
    page++;
    await sleep(DELAY_MS);
  }
  return all;
}

async function fetchPrintedTotal(setId) {
  const res = await fetch(`${API_BASE}/sets/${setId}?select=printedTotal`);
  const data = await res.json();
  return data.data.printedTotal;
}

async function main() {
  const sets = db.prepare('SELECT id, code, name FROM sets ORDER BY release_date ASC').all();
  console.log(`Processing ${sets.length} sets...\n`);

  const updateVariants = db.prepare('UPDATE cards SET variants = ? WHERE set_id = ? AND card_number = ? AND name = ?');

  // Prefetch printedTotal for special sets
  const printedTotals = {};
  for (const code of [...POKEBALL_SETS, ASCENDED_HEROES]) {
    printedTotals[code] = await fetchPrintedTotal(code);
    console.log(`printedTotal for ${code}: ${printedTotals[code]}`);
    await sleep(300);
  }
  console.log('');

  let totalUpdated = 0;

  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    const progress = `[${i + 1}/${sets.length}]`;

    // --- Handle override sets ---
    if (OVERRIDE_SETS[set.code]) {
      const mode = OVERRIDE_SETS[set.code];
      const cards = db.prepare('SELECT id FROM cards WHERE set_id = ?').all(set.id);
      const variantObj = mode === 'holofoil-only' ? { 'Holofoil': 0 } : { 'Normal': 0 };
      const update = db.prepare('UPDATE cards SET variants = ? WHERE id = ?');
      db.transaction(() => { for (const c of cards) update.run(JSON.stringify(variantObj), c.id); })();
      console.log(`${progress} ${set.name}: ${cards.length} cards (${mode})`);
      totalUpdated += cards.length;
      continue;
    }

    // --- Handle MEP (not in API) ---
    if (set.code === 'mep') {
      const cards = db.prepare('SELECT id FROM cards WHERE set_id = ?').all(set.id);
      const update = db.prepare('UPDATE cards SET variants = ? WHERE id = ?');
      db.transaction(() => { for (const c of cards) update.run(JSON.stringify({ 'Normal': 0 }), c.id); })();
      console.log(`${progress} ${set.name}: ${cards.length} cards (promos, Normal only)`);
      totalUpdated += cards.length;
      continue;
    }

    // --- Fetch from API ---
    try {
      const apiCards = await fetchAllCards(set.code);
      const printedTotal = printedTotals[set.code] || null;

      const batch = db.transaction(() => {
        let updated = 0;

        for (const apiCard of apiCards) {
          // Check for card-level overrides
          const overrideKey = `${set.code}:${apiCard.number}`;
          if (CARD_OVERRIDES[overrideKey]) {
            updateVariants.run(JSON.stringify(CARD_OVERRIDES[overrideKey]), set.id, apiCard.number, apiCard.name);
            updated++;
            continue;
          }

          const priceKeys = Object.keys(apiCard.tcgplayer?.prices || {});
          const variants = {};

          if (priceKeys.length === 0) {
            // No API price data — assign based on rarity
            const rarity = (apiCard.rarity || '').toLowerCase();
            const isBasicRarity = ['common', 'uncommon', 'rare'].some(r => rarity === r);
            if (rarity.includes('holo') && !isBasicRarity) {
              variants['Holofoil'] = 0;
            } else if (isBasicRarity && !EARLY_SETS.has(set.code)) {
              variants['Normal'] = 0;
              variants['Reverse Holo'] = 0;
            } else if (rarity.includes('double') || rarity.includes('ultra') || rarity.includes('illustration') ||
                       rarity.includes('hyper') || rarity.includes('special') || rarity.includes('mega') ||
                       rarity.includes('ace') || rarity.includes('black white')) {
              variants['Holofoil'] = 0;
            } else {
              variants['Normal'] = 0;
            }
          } else {
            // Use API price keys
            for (const key of priceKeys) {
              if (shouldSkipKey(key, set.code)) continue;
              const name = VARIANT_MAP[key] || key;
              if (!(name in variants)) variants[name] = 0;
            }
            if (Object.keys(variants).length === 0) variants['Normal'] = 0;
          }

          // For LC onward (not early sets): ensure normal/holofoil + reverse pattern
          // The API data should already reflect this, so we trust it

          // --- Special set rules ---
          const rarity = (apiCard.rarity || '').toLowerCase();
          const isBasicRarity = ['common', 'uncommon', 'rare'].some(r => rarity === r);
          const isPokemon = (apiCard.supertype || '').toLowerCase().includes('pok');
          const cardNum = parseInt(apiCard.number, 10);
          const isMainSet = printedTotal ? (!isNaN(cardNum) && cardNum <= printedTotal) : true;

          // Pokeball/Masterball sets
          if (POKEBALL_SETS.has(set.code) && isBasicRarity && isMainSet) {
            variants['Pokeball'] = 0;
            if (isPokemon) variants['Masterball'] = 0;
          }

          // Ascended Heroes
          if (set.code === ASCENDED_HEROES && isBasicRarity && isMainSet) {
            if (isPokemon) {
              variants['Energy Holo'] = 0;
              variants['Ball Holo'] = 0;
            } else {
              // Trainers get standard Reverse Holo (if not already present)
              if (!variants['Reverse Holo']) variants['Reverse Holo'] = 0;
            }
          }

          updateVariants.run(JSON.stringify(variants), set.id, apiCard.number, apiCard.name);
          updated++;
        }

        return updated;
      });

      const updated = batch();
      totalUpdated += updated;
      console.log(`${progress} ${set.name} (${set.code}): ${updated} cards`);
    } catch (err) {
      console.error(`${progress} ERROR on ${set.name}: ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone! Updated ${totalUpdated} cards.`);

  // Final summary
  const allKeys = {};
  db.prepare("SELECT variants FROM cards WHERE variants != '{}'").all().forEach(c => {
    for (const k of Object.keys(JSON.parse(c.variants))) allKeys[k] = (allKeys[k] || 0) + 1;
  });
  console.log('\nVariant summary:');
  Object.entries(allKeys).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v} cards`));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
