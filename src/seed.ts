import db from './db';

const API_BASE = 'https://api.pokemontcg.io/v2';
const PAGE_SIZE = 250;
const DELAY_MS = 500; // delay between requests to avoid rate limits

interface ApiCard {
  name: string;
  number: string;
  rarity?: string;
  images?: {
    small?: string;
    large?: string;
  };
}

interface ApiSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  images?: {
    symbol?: string;
    logo?: string;
  };
}

interface ApiCardsResponse {
  data: ApiCard[];
  totalCount: number;
}

interface ApiSetsResponse {
  data: ApiSet[];
}

interface DbSetRow {
  id: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error ${res.status} for ${url}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAllCards(setId: string): Promise<ApiCard[]> {
  let page = 1;
  let allCards: ApiCard[] = [];

  while (true) {
    const url = `${API_BASE}/cards?q=set.id:${setId}&pageSize=${PAGE_SIZE}&page=${page}&select=name,number,rarity,images`;
    const data = await fetchJSON<ApiCardsResponse>(url);
    allCards = allCards.concat(data.data);

    if (allCards.length >= data.totalCount || data.data.length < PAGE_SIZE) {
      break;
    }
    page++;
    await sleep(DELAY_MS);
  }

  return allCards;
}

async function main(): Promise<void> {
  console.log('Fetching sets from Pokemon TCG API...');
  const setsData = await fetchJSON<ApiSetsResponse>(`${API_BASE}/sets?orderBy=releaseDate&pageSize=250`);
  const sets = setsData.data;
  console.log(`Found ${sets.length} sets.\n`);

  // Prepare insert statements
  const insertSet = db.prepare(
    'INSERT OR IGNORE INTO sets (name, code, series, release_date, image_symbol, image_logo) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertCard = db.prepare(
    'INSERT INTO cards (set_id, name, card_number, rarity, quantity, image_small) VALUES (?, ?, ?, ?, 0, ?)'
  );
  const findSet = db.prepare('SELECT id FROM sets WHERE code = ?');

  // Clear existing data
  console.log('Clearing existing data...');
  db.exec('DELETE FROM cards');
  db.exec('DELETE FROM sets');

  // Insert all sets first
  const insertAllSets = db.transaction((sets: ApiSet[]) => {
    for (const set of sets) {
      insertSet.run(set.name, set.id, set.series, set.releaseDate.replace(/\//g, '-'), set.images?.symbol || null, set.images?.logo || null);
    }
  });
  insertAllSets(sets);
  console.log(`Inserted ${sets.length} sets into database.\n`);

  // Fetch and insert cards for each set
  let totalCards = 0;
  for (let i = 0; i < sets.length; i++) {
    const set = sets[i];
    const progress = `[${i + 1}/${sets.length}]`;

    try {
      const cards = await fetchAllCards(set.id);
      const dbSet = findSet.get(set.id) as DbSetRow | undefined;

      if (dbSet) {
        const insertBatch = db.transaction((cards: ApiCard[]) => {
          for (const card of cards) {
            const imageUrl = card.images?.small || `https://images.pokemontcg.io/${set.id}/${card.number}.png`;
            insertCard.run(dbSet.id, card.name, card.number, card.rarity || null, imageUrl);
          }
        });
        insertBatch(cards);
        totalCards += cards.length;
        console.log(`${progress} ${set.name} (${set.id}): ${cards.length} cards`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`${progress} ERROR on ${set.name}: ${message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone! Inserted ${totalCards} total cards across ${sets.length} sets.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
