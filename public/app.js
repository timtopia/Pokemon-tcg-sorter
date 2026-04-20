let currentSetId = null;

// DOM elements
const setsPanel = document.getElementById('sets-panel');
const cardsPanel = document.getElementById('cards-panel');
const setsList = document.getElementById('sets-list');
const cardsList = document.getElementById('cards-list');
const cardsTitle = document.getElementById('cards-title');

const addSetBtn = document.getElementById('add-set-btn');
const addSetForm = document.getElementById('add-set-form');
const cancelSetBtn = document.getElementById('cancel-set');

const addCardBtn = document.getElementById('add-card-btn');
const addCardForm = document.getElementById('add-card-form');
const cancelCardBtn = document.getElementById('cancel-card');
const backBtn = document.getElementById('back-btn');

// Sets

async function loadSets() {
  const res = await fetch('/api/sets');
  const sets = await res.json();

  if (sets.length === 0) {
    setsList.innerHTML = '<li class="empty-state">No sets yet. Add one to get started!</li>';
    return;
  }

  setsList.innerHTML = sets.map(set => `
    <li class="set-item" onclick="openSet(${set.id}, '${set.name.replace(/'/g, "\\'")}')">
      <div class="set-info">
        <h3>${set.name}</h3>
        <span>${[set.code, set.release_date].filter(Boolean).join(' | ')}</span>
      </div>
      <div class="set-meta">
        <span class="card-count">${set.card_count} cards</span>
        <button class="btn btn-danger" onclick="deleteSet(event, ${set.id})" title="Delete set">&times;</button>
      </div>
    </li>
  `).join('');
}

addSetBtn.addEventListener('click', () => addSetForm.classList.toggle('hidden'));
cancelSetBtn.addEventListener('click', () => addSetForm.classList.add('hidden'));

addSetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await fetch('/api/sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: document.getElementById('set-name').value,
      code: document.getElementById('set-code').value,
      release_date: document.getElementById('set-date').value,
    }),
  });
  addSetForm.reset();
  addSetForm.classList.add('hidden');
  loadSets();
});

async function deleteSet(e, id) {
  e.stopPropagation();
  if (!confirm('Delete this set and all its cards?')) return;
  await fetch(`/api/sets/${id}`, { method: 'DELETE' });
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

  if (cards.length === 0) {
    cardsList.innerHTML = '<li class="empty-state">No cards in this set yet. Add some!</li>';
    return;
  }

  cardsList.innerHTML = cards.map(card => `
    <li>
      <div class="card-info">
        <h3>${card.name}</h3>
        <div class="card-details">
          ${card.card_number ? `<span>#${card.card_number}</span>` : ''}
          ${card.rarity ? `<span>${card.rarity}</span>` : ''}
        </div>
      </div>
      <div class="card-actions">
        <span class="quantity-badge">x${card.quantity}</span>
        <button class="btn btn-danger" onclick="deleteCard(${card.id})" title="Delete card">&times;</button>
      </div>
    </li>
  `).join('');
}

addCardBtn.addEventListener('click', () => addCardForm.classList.toggle('hidden'));
cancelCardBtn.addEventListener('click', () => addCardForm.classList.add('hidden'));

addCardForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await fetch(`/api/sets/${currentSetId}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: document.getElementById('card-name').value,
      card_number: document.getElementById('card-number').value,
      rarity: document.getElementById('card-rarity').value,
      quantity: parseInt(document.getElementById('card-quantity').value) || 1,
    }),
  });
  addCardForm.reset();
  document.getElementById('card-quantity').value = '1';
  addCardForm.classList.add('hidden');
  loadCards();
});

async function deleteCard(id) {
  if (!confirm('Delete this card?')) return;
  await fetch(`/api/cards/${id}`, { method: 'DELETE' });
  loadCards();
}

// Initial load
loadSets();
