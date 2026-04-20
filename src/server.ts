import express, { Request, Response } from 'express';
import path from 'path';
import db from './db';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Map every API set code to its TCG Collector series group
const CODE_TO_SERIES: Record<string, string> = {
  // Original Series (Base + Gym combined)
  base1: 'Original Series', base2: 'Original Series', base3: 'Original Series',
  base4: 'Original Series', base5: 'Original Series', basep: 'Original Series',
  gym1: 'Original Series', gym2: 'Original Series',

  // Neo Series
  neo1: 'Neo Series', neo2: 'Neo Series', neo3: 'Neo Series', neo4: 'Neo Series',

  // Legendary Collection Series
  base6: 'Legendary Collection Series',

  // e-Card Series
  ecard1: 'e-Card Series', ecard2: 'e-Card Series', ecard3: 'e-Card Series',

  // EX Series (includes Nintendo Promos)
  ex1: 'EX Series', ex2: 'EX Series', ex3: 'EX Series', ex4: 'EX Series',
  ex5: 'EX Series', ex6: 'EX Series', ex7: 'EX Series', ex8: 'EX Series',
  ex9: 'EX Series', ex10: 'EX Series', ex11: 'EX Series', ex12: 'EX Series',
  ex13: 'EX Series', ex14: 'EX Series', ex15: 'EX Series', ex16: 'EX Series',
  np: 'EX Series',

  // Diamond & Pearl Series
  dp1: 'Diamond & Pearl Series', dp2: 'Diamond & Pearl Series', dp3: 'Diamond & Pearl Series',
  dp4: 'Diamond & Pearl Series', dp5: 'Diamond & Pearl Series', dp6: 'Diamond & Pearl Series',
  dp7: 'Diamond & Pearl Series', dpp: 'Diamond & Pearl Series',

  // Platinum Series
  pl1: 'Platinum Series', pl2: 'Platinum Series', pl3: 'Platinum Series', pl4: 'Platinum Series',

  // HeartGold & SoulSilver Series
  hgss1: 'HeartGold & SoulSilver Series', hgss2: 'HeartGold & SoulSilver Series',
  hgss3: 'HeartGold & SoulSilver Series', hgss4: 'HeartGold & SoulSilver Series',
  hsp: 'HeartGold & SoulSilver Series',

  // Call of Legends Series
  col1: 'Call of Legends Series',

  // Black & White Series
  bw1: 'Black & White Series', bw2: 'Black & White Series', bw3: 'Black & White Series',
  bw4: 'Black & White Series', bw5: 'Black & White Series', bw6: 'Black & White Series',
  bw7: 'Black & White Series', bw8: 'Black & White Series', bw9: 'Black & White Series',
  bw10: 'Black & White Series', bw11: 'Black & White Series', bwp: 'Black & White Series',
  dv1: 'Black & White Series',

  // XY Series
  xy0: 'XY Series', xy1: 'XY Series', xy2: 'XY Series', xy3: 'XY Series',
  xy4: 'XY Series', xy5: 'XY Series', xy6: 'XY Series', xy7: 'XY Series',
  xy8: 'XY Series', xy9: 'XY Series', xy10: 'XY Series', xy11: 'XY Series',
  xy12: 'XY Series', xyp: 'XY Series', dc1: 'XY Series', g1: 'XY Series',

  // Sun & Moon Series
  sm1: 'Sun & Moon Series', sm2: 'Sun & Moon Series', sm3: 'Sun & Moon Series',
  sm35: 'Sun & Moon Series', sm4: 'Sun & Moon Series', sm5: 'Sun & Moon Series',
  sm6: 'Sun & Moon Series', sm7: 'Sun & Moon Series', sm75: 'Sun & Moon Series',
  sm8: 'Sun & Moon Series', sm9: 'Sun & Moon Series', sm10: 'Sun & Moon Series',
  sm11: 'Sun & Moon Series', sm115: 'Sun & Moon Series', sm12: 'Sun & Moon Series',
  smp: 'Sun & Moon Series', sma: 'Sun & Moon Series', det1: 'Sun & Moon Series',

  // Sword & Shield Series
  swsh1: 'Sword & Shield Series', swsh2: 'Sword & Shield Series', swsh3: 'Sword & Shield Series',
  swsh35: 'Sword & Shield Series', swsh4: 'Sword & Shield Series', swsh5: 'Sword & Shield Series',
  swsh6: 'Sword & Shield Series', swsh7: 'Sword & Shield Series', swsh8: 'Sword & Shield Series',
  swsh9: 'Sword & Shield Series', swsh9tg: 'Sword & Shield Series',
  swsh10: 'Sword & Shield Series', swsh10tg: 'Sword & Shield Series',
  swsh11: 'Sword & Shield Series', swsh11tg: 'Sword & Shield Series',
  swsh12: 'Sword & Shield Series', swsh12tg: 'Sword & Shield Series',
  swsh12pt5: 'Sword & Shield Series', swsh12pt5gg: 'Sword & Shield Series',
  swsh45: 'Sword & Shield Series', swsh45sv: 'Sword & Shield Series',
  swshp: 'Sword & Shield Series', cel25: 'Sword & Shield Series', cel25c: 'Sword & Shield Series',
  pgo: 'Sword & Shield Series',

  // Scarlet & Violet Series
  sv1: 'Scarlet & Violet Series', sv2: 'Scarlet & Violet Series', sv3: 'Scarlet & Violet Series',
  sv3pt5: 'Scarlet & Violet Series', sv4: 'Scarlet & Violet Series', sv4pt5: 'Scarlet & Violet Series',
  sv5: 'Scarlet & Violet Series', sv6: 'Scarlet & Violet Series', sv6pt5: 'Scarlet & Violet Series',
  sv7: 'Scarlet & Violet Series', sv8: 'Scarlet & Violet Series', sv8pt5: 'Scarlet & Violet Series',
  sv9: 'Scarlet & Violet Series', sv10: 'Scarlet & Violet Series',
  zsv10pt5: 'Scarlet & Violet Series', rsv10pt5: 'Scarlet & Violet Series',
  svp: 'Scarlet & Violet Series',

  // Mega Evolution Series
  me1: 'Mega Evolution Series', me2: 'Mega Evolution Series',
  me2pt5: 'Mega Evolution Series', me3: 'Mega Evolution Series',
  mep: 'Mega Evolution Series',

  // Play! Pokemon Series (POP Series)
  pop1: 'Play! Pokemon Series', pop2: 'Play! Pokemon Series', pop3: 'Play! Pokemon Series',
  pop4: 'Play! Pokemon Series', pop5: 'Play! Pokemon Series', pop6: 'Play! Pokemon Series',
  pop7: 'Play! Pokemon Series', pop8: 'Play! Pokemon Series', pop9: 'Play! Pokemon Series',

  // McDonald's Series
  mcd11: "McDonald's Series", mcd12: "McDonald's Series", mcd14: "McDonald's Series",
  mcd15: "McDonald's Series", mcd16: "McDonald's Series", mcd17: "McDonald's Series",
  mcd18: "McDonald's Series", mcd19: "McDonald's Series", mcd21: "McDonald's Series",
  mcd22: "McDonald's Series",

  // Other
  si1: 'Other', bp: 'Other', ru1: 'Other', fut20: 'Other',
};

// Display order matching TCG Collector (newest first)
const SERIES_ORDER: string[] = [
  'Mega Evolution Series',
  'Scarlet & Violet Series',
  'Sword & Shield Series',
  'Sun & Moon Series',
  'XY Series',
  'Black & White Series',
  'Call of Legends Series',
  'HeartGold & SoulSilver Series',
  'Platinum Series',
  'Diamond & Pearl Series',
  'EX Series',
  'e-Card Series',
  'Legendary Collection Series',
  'Neo Series',
  'Original Series',
  'Play! Pokemon Series',
  "McDonald's Series",
  'Other',
];

interface SetRow {
  id: number;
  name: string;
  code: string;
  series: string;
  release_date: string;
  created_at: string;
  total_cards: number;
  owned_cards: number;
}

interface SetRowFull extends SetRow {
  image_symbol: string | null;
  image_logo: string | null;
}

interface CardRow {
  id: number;
  set_id: number;
  name: string;
  card_number: string;
  rarity: string | null;
  quantity: number;
  created_at: string;
  image_small: string | null;
  variants: string; // JSON string of variant quantities
}

// Get all sets (with collection progress), grouped by series
app.get('/api/sets', (_req: Request, res: Response) => {
  const sets = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM cards c, json_each(c.variants) WHERE c.set_id = s.id) as total_cards,
      (SELECT COUNT(*) FROM cards c, json_each(c.variants) WHERE c.set_id = s.id AND json_each.value > 0) as owned_cards
    FROM sets s
    ORDER BY s.release_date DESC
  `).all() as SetRow[];

  const grouped: Record<string, SetRow[]> = {};
  for (const set of sets) {
    const series = CODE_TO_SERIES[set.code] || 'Other';
    if (!grouped[series]) grouped[series] = [];
    grouped[series].push(set);
  }

  const seriesOrder = SERIES_ORDER.filter(s => grouped[s]);
  // Append any unmapped series
  for (const s of Object.keys(grouped)) {
    if (!seriesOrder.includes(s)) seriesOrder.push(s);
  }

  res.json({ grouped, seriesOrder });
});

// Get cards for a set
app.get('/api/sets/:setId/cards', (req: Request, res: Response) => {
  const cards = db.prepare(
    'SELECT * FROM cards WHERE set_id = ? ORDER BY CAST(card_number AS INTEGER) ASC, card_number ASC'
  ).all(req.params.setId) as CardRow[];
  res.json(cards);
});

// Update a specific variant quantity for a card
app.patch('/api/cards/:id/variant', (req: Request, res: Response) => {
  const { variant, quantity } = req.body as { variant: string; quantity: number };
  if (!variant || quantity == null || quantity < 0) {
    res.status(400).json({ error: 'variant and quantity (>= 0) required' });
    return;
  }

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as CardRow | undefined;
  if (!card) { res.status(404).json({ error: 'Card not found' }); return; }

  const variants: Record<string, number> = JSON.parse(card.variants || '{}');
  variants[variant] = quantity;

  // Total quantity is sum of all variants
  const total = Object.values(variants).reduce((a, b) => a + b, 0);

  // Card is fully collected only when ALL variants have qty > 0
  const variantValues = Object.values(variants);
  const fullyCollected = variantValues.length > 0 && variantValues.every(v => v > 0) ? 1 : 0;

  db.prepare('UPDATE cards SET variants = ?, quantity = ?, fully_collected = ? WHERE id = ?')
    .run(JSON.stringify(variants), total, fullyCollected, req.params.id);

  const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id) as CardRow;
  res.json(updated);
});

app.listen(PORT, () => {
  console.log(`Pokemon TCG Sorter running at http://localhost:${PORT}`);
});
