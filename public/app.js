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
  loadCards();
}

backBtn.addEventListener('click', () => {
  cardsPanel.classList.add('hidden');
  setsPanel.classList.remove('hidden');
  currentSetId = null;
  loadSets();
});

async function loadCards() {
  const res = await fetch(`/api/sets/${currentSetId}/cards`);
  const cards = await res.json();

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
    const VARIANT_ORDER = [
      'Normal', 'Holofoil', 'Reverse Holo',
      'Pokeball', 'Masterball',
      'Energy Holo', 'Ball Holo',
    ];
    const variantKeys = Object.keys(variants).sort((a, b) => {
      const ai = VARIANT_ORDER.indexOf(a);
      const bi = VARIANT_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    const variantControls = variantKeys.length > 0
      ? variantKeys.map(v => `
          <div class="variant-row">
            <span class="variant-label">${v}</span>
            <button class="btn btn-qty" onclick="updateVariant(${card.id}, '${v}', ${variants[v] - 1})" ${variants[v] <= 0 ? 'disabled' : ''}>-</button>
            <span class="quantity-badge ${variants[v] > 0 ? 'qty-owned' : ''}">${variants[v]}</span>
            <button class="btn btn-qty" onclick="updateVariant(${card.id}, '${v}', ${variants[v] + 1})">+</button>
          </div>
        `).join('')
      : `
          <div class="variant-row">
            <span class="variant-label">Normal</span>
            <button class="btn btn-qty" onclick="updateVariant(${card.id}, 'Normal', ${(card.quantity || 0) - 1})" ${card.quantity <= 0 ? 'disabled' : ''}>-</button>
            <span class="quantity-badge ${card.quantity > 0 ? 'qty-owned' : ''}">${card.quantity || 0}</span>
            <button class="btn btn-qty" onclick="updateVariant(${card.id}, 'Normal', ${(card.quantity || 0) + 1})">+</button>
          </div>
        `;

    return `
      <li class="${card.fully_collected ? 'card-owned' : card.quantity > 0 ? 'card-partial' : 'card-unowned'}">
        <div class="card-image">
          <img src="${card.image_small}" alt="${card.name}" loading="lazy" onerror="this.src='';this.alt='No image'">
        </div>
        <div class="card-info">
          <h3>${card.name}</h3>
          <div class="card-details">
            ${card.card_number ? `<span>#${card.card_number}</span>` : ''}
            ${card.rarity ? `<span>${card.rarity}</span>` : ''}
          </div>
        </div>
        <div class="card-variants">
          ${variantControls}
        </div>
      </li>
    `;
  }).join('');
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

// Initial load
loadSets();
