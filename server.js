const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get all sets (with card counts)
app.get('/api/sets', (req, res) => {
  const sets = db.prepare(`
    SELECT s.*, COUNT(c.id) as card_count
    FROM sets s
    LEFT JOIN cards c ON c.set_id = s.id
    GROUP BY s.id
    ORDER BY s.release_date DESC
  `).all();
  res.json(sets);
});

// Create a new set
app.post('/api/sets', (req, res) => {
  const { name, code, release_date } = req.body;
  if (!name) return res.status(400).json({ error: 'Set name is required' });

  const result = db.prepare(
    'INSERT INTO sets (name, code, release_date) VALUES (?, ?, ?)'
  ).run(name, code || null, release_date || null);

  const set = db.prepare('SELECT * FROM sets WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(set);
});

// Delete a set
app.delete('/api/sets/:id', (req, res) => {
  db.prepare('DELETE FROM cards WHERE set_id = ?').run(req.params.id);
  db.prepare('DELETE FROM sets WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// Get cards for a set
app.get('/api/sets/:setId/cards', (req, res) => {
  const cards = db.prepare(
    'SELECT * FROM cards WHERE set_id = ? ORDER BY card_number ASC'
  ).all(req.params.setId);
  res.json(cards);
});

// Add a card to a set
app.post('/api/sets/:setId/cards', (req, res) => {
  const { name, card_number, rarity, quantity } = req.body;
  if (!name) return res.status(400).json({ error: 'Card name is required' });

  const result = db.prepare(
    'INSERT INTO cards (set_id, name, card_number, rarity, quantity) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.setId, name, card_number || null, rarity || null, quantity || 1);

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(card);
});

// Update a card
app.put('/api/cards/:id', (req, res) => {
  const { name, card_number, rarity, quantity } = req.body;
  db.prepare(
    'UPDATE cards SET name = ?, card_number = ?, rarity = ?, quantity = ? WHERE id = ?'
  ).run(name, card_number || null, rarity || null, quantity || 1, req.params.id);

  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(req.params.id);
  res.json(card);
});

// Delete a card
app.delete('/api/cards/:id', (req, res) => {
  db.prepare('DELETE FROM cards WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Pokemon TCG Sorter running at http://localhost:${PORT}`);
});
