// catalog/catalog.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3001;  // Catalog service port

// Middleware to parse JSON requests
app.use(express.json());

// SQLite setup
const db = new sqlite3.Database('./catalog.db');

// Initialize the database
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS books (id INTEGER PRIMARY KEY, title TEXT, stock INTEGER, price INTEGER, topic TEXT)");
    db.run("INSERT OR IGNORE INTO books (id, title, stock, price, topic) VALUES (1, 'How to get a good grade in DOS in 40 minutes a day', 7, 100, 'distributed systems')");
    db.run("INSERT OR IGNORE INTO books (id, title, stock, price, topic) VALUES (2, 'RPCs for Noobs', 8, 65, 'distributed systems')");
    db.run("INSERT OR IGNORE INTO books (id, title, stock, price, topic) VALUES (3, 'Xen and the Art of Surviving Undergraduate School', 9, 80, 'undergraduate school')");
    db.run("INSERT OR IGNORE INTO books (id, title, stock, price, topic) VALUES (4, 'Cooking for the Impatient Undergrad', 10, 35, 'undergraduate school')");
});

// Search books by topic
app.get('/search/:topic', (req, res) => {
    const { topic } = req.params;
    db.all("SELECT id, title FROM books WHERE topic = ?", [topic], (err, rows) => {
        if (err) {
            console.error('Error fetching books:', err);
            res.status(500).send('Error fetching books');
        } else {
            console.log('Books found:', rows);  // Log the results
            res.json(rows);
        }
    });
});

// Get book info by item number
app.get('/info/:item_number', (req, res) => {
    const { item_number } = req.params;
    db.get("SELECT title, stock, price,topic FROM books WHERE id = ?", [item_number], (err, row) => {
        if (err) {
            console.error('Error fetching book info:', err);
            res.status(500).send('Error fetching book info');
        } else {
            console.log('Book info:', row);  // Log the book info
            res.json(row);
        }
    });
});

// Update book stock
app.post('/update/:item_number', (req, res) => {
    const { item_number } = req.params;
    const { stock, price } = req.body;
    db.run("UPDATE books SET stock = ?, price = ? WHERE id = ?", [stock, price, item_number], function(err) {
        if (err) {
            console.error('Error updating book:', err);
            res.status(500).send('Error updating book');
        } else {
            console.log(`Book with ID ${item_number} updated. `);  // Log the update
            res.send('Book updated successfully');
        }
    });
});

app.listen(PORT, () => {
    console.log(`Catalog service running on port ${PORT}`);
});
