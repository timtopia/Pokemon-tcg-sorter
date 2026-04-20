let currentSetId = null;

// DOM elements
const setsPanel = document.getElementById('sets-panel');
const cardsPanel = document.getElementById('cards-panel');
const setsList = document.getElementById('sets-list');
const cardsList = document.getElementById('cards-list');
const cardsTitle = document.getElementById('cards-title');
const cardsProgress = document.getElementById('cards-progress');
const backBtn = document.getElementById('back-btn');

// Track which series groups are collapsed (persisted in localStorage)
const collapsedSeries = new Set(JSON.parse(localStorage.getItem('collapsedSeries') || '[]'));

// Card filter state
let cardFilter = 'all';
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    cardFilter = btn.dataset.filter;
    applyCardFilter();
  });
});

function applyCardFilter() {
  document.querySelectorAll('.card-tile').forEach(tile => {
    const isOwned = tile.classList.contains('card-owned') || tile.classList.contains('card-partial');
    if (cardFilter === 'all') {
      tile.style.display = '';
    } else if (cardFilter === 'collected') {
      tile.style.display = isOwned ? '' : 'none';
    } else {
      tile.style.display = isOwned ? 'none' : '';
    }
  });
}

function saveCollapsedState() {
  localStorage.setItem('collapsedSeries', JSON.stringify([...collapsedSeries]));
}

// Sets

async function loadSets() {
  const res = await fetch('/api/sets');
  const { grouped, seriesOrder } = await res.json();

  if (seriesOrder.length === 0) {
    setsList.innerHTML = '<div class="empty-state">No sets loaded. Run the seed script to populate data.</div>';
    return;
  }

  // Overall progress (exclude Play! Pokemon, McDonald's, Other)
  const EXCLUDED_SERIES = new Set(["Play! Pokemon Series", "McDonald's Series", "Other"]);
  let overallOwned = 0;
  let overallTotal = 0;
  for (const series of seriesOrder) {
    if (EXCLUDED_SERIES.has(series)) continue;
    const sets = grouped[series];
    overallOwned += sets.reduce((sum, s) => sum + s.owned_cards, 0);
    overallTotal += sets.reduce((sum, s) => sum + s.total_cards, 0);
  }
  const overallPct = overallTotal > 0 ? Math.round((overallOwned / overallTotal) * 100) : 0;
  document.getElementById('overall-progress').innerHTML = `
    <div class="overall-label">
      <span>Overall Collection</span>
      <span>${overallOwned.toLocaleString()} / ${overallTotal.toLocaleString()} (${overallPct}%)</span>
    </div>
    <div class="overall-bar-container">
      <div class="overall-bar" style="width: ${overallPct}%"></div>
    </div>
  `;

  setsList.innerHTML = seriesOrder.map(series => {
    const sets = grouped[series];
    const totalCards = sets.reduce((sum, s) => sum + s.total_cards, 0);
    const ownedCards = sets.reduce((sum, s) => sum + s.owned_cards, 0);
    const isCollapsed = collapsedSeries.has(series);

    const setItems = sets.map(set => {
      const pct = set.total_cards > 0 ? Math.round((set.owned_cards / set.total_cards) * 100) : 0;
      return `
        <li class="set-item" onclick="openSet(${set.id}, '${set.name.replace(/'/g, "\\'")}')">
          ${set.image_logo ? `<img class="set-logo" src="${set.image_logo}" alt="" onerror="this.style.display='none'">` : ''}
          ${set.image_symbol ? `<img class="set-symbol" src="${set.image_symbol}" alt="" onerror="this.style.display='none'">` : ''}
          <div class="set-info">
            <h3>${set.name}</h3>
            <span>${[set.code, set.release_date].filter(Boolean).join(' | ')}</span>
          </div>
          <div class="set-meta">
            <div class="progress-bar-container">
              <div class="progress-bar" style="width: ${pct}%"></div>
            </div>
            <span class="card-count">${set.owned_cards}/${set.total_cards}</span>
          </div>
        </li>
      `;
    }).join('');

    const seriesPct = totalCards > 0 ? Math.round((ownedCards / totalCards) * 100) : 0;

    return `
      <div class="series-group">
        <div class="series-header" onclick="toggleSeries('${series.replace(/'/g, "\\'")}')">
          <span class="series-chevron ${isCollapsed ? 'collapsed' : ''}">&rsaquo;</span>
          <h3 class="series-name">${series}</h3>
          <span class="series-meta">${sets.length} sets &middot; ${ownedCards}/${totalCards} cards (${seriesPct}%)</span>
        </div>
        <ul class="series-sets ${isCollapsed ? 'hidden' : ''}">
          ${setItems}
        </ul>
      </div>
    `;
  }).join('');
}

function toggleSeries(series) {
  if (collapsedSeries.has(series)) {
    collapsedSeries.delete(series);
  } else {
    collapsedSeries.add(series);
  }
  saveCollapsedState();
  loadSets();
}

// Cards

function openSet(id, name) {
  currentSetId = id;
  cardsTitle.textContent = name;
  setsPanel.classList.add('hidden');
  cardsPanel.classList.remove('hidden');
  // Reset filter to All
  cardFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-filter="all"]').classList.add('active');
  loadCards();
}

function goBack() {
  cardsPanel.classList.add('hidden');
  setsPanel.classList.remove('hidden');
  currentSetId = null;
  window.scrollTo(0, 0);
  loadSets();
}

backBtn.addEventListener('click', goBack);
document.getElementById('back-btn-float').addEventListener('click', goBack);

async function loadCards() {
  const res = await fetch(`/api/sets/${currentSetId}/cards`);
  const cards = await res.json();
  currentCards = cards;

  // Count total variant slots and owned variants
  let total = 0;
  let owned = 0;
  for (const card of cards) {
    const variants = JSON.parse(card.variants || '{}');
    const values = Object.values(variants);
    total += values.length;
    owned += values.filter(v => v > 0).length;
  }
  const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
  cardsProgress.textContent = `${owned}/${total} collected (${pct}%)`;

  if (cards.length === 0) {
    cardsList.innerHTML = '<li class="empty-state">No cards in this set.</li>';
    return;
  }

  cardsList.innerHTML = cards.map(card => {
    const variants = JSON.parse(card.variants || '{}');
    const totalQty = Object.values(variants).reduce((s, v) => s + v, 0);
    const statusClass = card.fully_collected ? 'card-owned' : totalQty > 0 ? 'card-partial' : 'card-unowned';

    const overlay = [
      card.card_number ? `#${card.card_number}` : '',
      card.rarity || '',
    ].filter(Boolean).join(' · ');

    return `
      <div class="card-tile ${statusClass}" data-card-id="${card.id}">
        <div class="card-img-wrap">
          <img src="${card.image_small}" alt="${card.name}" loading="lazy" onerror="this.src='';this.alt='No image'">
          <div class="card-overlay">${overlay}</div>
        </div>
        <div class="card-controls">
          <button class="btn btn-qty" onclick="handleMinus(event, ${card.id})" ${totalQty <= 0 ? 'disabled' : ''}>-</button>
          <span class="card-total-qty ${card.fully_collected ? 'qty-complete' : totalQty > 0 ? 'qty-partial' : ''}">${totalQty}</span>
          <button class="btn btn-qty" onclick="handlePlus(event, ${card.id})">+</button>
        </div>
      </div>
    `;
  }).join('');
  applyCardFilter();
}

async function updateVariant(cardId, variant, newQty) {
  if (newQty < 0) return;
  await fetch(`/api/cards/${cardId}/variant`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ variant, quantity: newQty }),
  });
  loadCards();
}

// Cached card data for popup lookups
let currentCards = [];

function getCardData(cardId) {
  return currentCards.find(c => c.id === cardId);
}

function handlePlus(event, cardId) {
  event.stopPropagation();
  const btn = event.target.closest('.btn-qty');
  const card = getCardData(cardId);
  if (!card) return;
  const variants = JSON.parse(card.variants || '{}');
  const keys = Object.keys(variants);

  if (keys.length === 1) {
    updateVariant(cardId, keys[0], variants[keys[0]] + 1);
  } else {
    showVariantPopup(btn, cardId, 'add');
  }
}

function handleMinus(event, cardId) {
  event.stopPropagation();
  const btn = event.target.closest('.btn-qty');
  const card = getCardData(cardId);
  if (!card) return;
  const variants = JSON.parse(card.variants || '{}');
  const owned = Object.entries(variants).filter(([, v]) => v > 0);

  if (owned.length === 0) return;
  if (owned.length === 1) {
    updateVariant(cardId, owned[0][0], owned[0][1] - 1);
  } else {
    showVariantPopup(btn, cardId, 'remove');
  }
}

function showVariantPopup(anchor, cardId, mode) {
  closeVariantPopup();
  const card = getCardData(cardId);
  if (!card) return;
  const variants = JSON.parse(card.variants || '{}');

  const VARIANT_ORDER = ['Normal','Holofoil','Reverse Holo','Pokeball','Masterball','Energy Holo','Ball Holo'];
  const keys = Object.keys(variants).sort((a, b) => {
    const ai = VARIANT_ORDER.indexOf(a);
    const bi = VARIANT_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const filtered = mode === 'remove' ? keys.filter(k => variants[k] > 0) : keys;

  const popup = document.createElement('div');
  popup.className = 'variant-popup';
  popup.onclick = (e) => e.stopPropagation();
  popup.innerHTML = filtered.map(v => `
    <button class="variant-option" onclick="selectVariant(${cardId}, '${v}', '${mode}')">
      ${v} <span class="variant-qty">(${variants[v]})</span>
    </button>
  `).join('');

  // Position popup using fixed positioning relative to the button
  const rect = anchor.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.left = rect.left + 'px';
  popup.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
  popup.style.transform = 'none';
  document.body.appendChild(popup);

  // Close on outside click (next tick so this click doesn't close it)
  setTimeout(() => {
    document.addEventListener('click', closeVariantPopup, { once: true });
  }, 10);
}

function closeVariantPopup() {
  document.querySelectorAll('.variant-popup').forEach(p => p.remove());
}

function selectVariant(cardId, variant, mode) {
  closeVariantPopup();
  const card = getCardData(cardId);
  if (!card) return;
  const variants = JSON.parse(card.variants || '{}');
  const newQty = mode === 'add' ? (variants[variant] || 0) + 1 : (variants[variant] || 0) - 1;
  updateVariant(cardId, variant, Math.max(0, newQty));
}

// Initial load
loadSets();
