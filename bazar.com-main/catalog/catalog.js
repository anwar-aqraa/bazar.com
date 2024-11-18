const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('redis');
const app = express();
const PORT = 3001;

// Middleware to parse JSON requests
app.use(express.json());

// SQLite setup
const db = new sqlite3.Database('./catalog.db');

// Initialize the database
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, title TEXT, stock INTEGER, price INTEGER, topic TEXT)");
    db.run("INSERT OR IGNORE INTO books (id, title, stock, price, topic) VALUES (1, 'How to finish Project 3 on time', 7, 100, 'distributed systems')");
    db.run("INSERT OR IGNORE INTO books (id, title, stock, price, topic) VALUES (2, 'Why theory classes are so hard', 8, 65, 'theory')");
    db.run("INSERT OR IGNORE INTO books (id, title, stock, price, topic) VALUES (3, 'Spring in the Pioneer Valley', 5, 80, 'local history')");
});

// Redis setup
const client = createClient({ url: 'redis://redis:6379' });

// Error handling for Redis
client.on('error', (err) => console.error('Redis Client Error', err));

// Connect to Redis
(async () => {
    await client.connect();
})();

// Search books by topic
app.get('/search/:topic', (req, res) => {
    const { topic } = req.params;
    db.all("SELECT id, title FROM books WHERE topic = ?", [topic], (err, rows) => {
        if (err) {
            res.status(500).send('Error fetching books');
        } else {
            res.json(rows);
        }
    });
});

// Get book info by item number
app.get('/info/:item_number', async (req, res) => {
    const { item_number } = req.params;
    try {
        const cachedData = await client.get(item_number);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }
        db.get("SELECT title, stock, price, topic FROM books WHERE id = ?", [item_number], async (err, row) => {
            if (err) {
                return res.status(500).send('Error fetching book info');
            }
            if (row) {
                await client.set(item_number, JSON.stringify(row), 'EX', 300); // Cache for 5 minutes
                return res.json(row);
            } else {
                res.status(404).send('Book not found');
            }
        });
    } catch (error) {
        res.status(500).send('Error accessing cache');
    }
});

// Update book stock
app.post('/update/:item_number', (req, res) => {
    const { item_number } = req.params;
    const { stock } = req.body;
    db.run("UPDATE books SET stock = ? WHERE id = ?", [stock, item_number], function (err) {
        if (err) {
            res.status(500).send('Error updating book stock');
        } else {
            client.del(item_number); // Invalidate the cache
            res.send(`Stock updated successfully for book ${item_number}`);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Catalog service running on port ${PORT}`);
});
