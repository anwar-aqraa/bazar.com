const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3003;  // Replica catalog service port

// Middleware to parse JSON requests
app.use(express.json());

// SQLite setup
const db = new sqlite3.Database('./catalog.db');

// Initialize the database
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, title TEXT, stock INTEGER, price INTEGER, topic TEXT)");
});

// Search books by topic
app.get('/search/:topic', (req, res) => {
    const { topic } = req.params;
    db.all("SELECT id, title FROM books WHERE topic = ?", [topic], (err, rows) => {
        if (err) {
            console.error('Error fetching books:', err);
            res.status(500).send('Error fetching books');
        } else {
            res.json(rows);
        }
    });
});

// Get book info by item number
app.get('/info/:item_number', (req, res) => {
    const { item_number } = req.params;
    db.get("SELECT title, stock, price, topic FROM books WHERE id = ?", [item_number], (err, row) => {
        if (err) {
            console.error('Error fetching book info:', err);
            res.status(500).send('Error fetching book info');
        } else {
            res.json(row);
        }
    });
});

// Cache invalidation (called by the main catalog service)
app.post('/invalidate', (req, res) => {
    const { item_number } = req.query;

    if (!item_number) {
        return res.status(400).json({ error: 'item_number is required' });
    }

    // Invalidate cache
    delete cache[`info-${item_number}`];
    console.log(`Cache invalidated for item ${item_number}`);

    res.send('Cache invalidated on replica');
});

app.listen(PORT, () => {
    console.log(`Catalog replica service running on port ${PORT}`);
});
