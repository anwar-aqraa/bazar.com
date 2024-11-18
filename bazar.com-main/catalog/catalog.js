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
    db.run("INSERT OR IGNORE INTO books (id, title, stock, price, topic) VALUES (5, 'How to finish Project 3 on time', 5, 120, 'time management')");
    db.run("INSERT OR IGNORE INTO books (id, title, stock, price, topic) VALUES (6, 'Why theory classes are so hard', 4, 90, 'education challenges')");
    db.run("INSERT OR IGNORE INTO books (id, title, stock, price, topic) VALUES (7, 'Spring in the Pioneer Valley', 6, 150, 'travel')");
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
            console.error('Database error:', err);
            res.status(500).send('Error fetching book info');
        } else {
            console.log('Database response for item:', row);
            res.json(row);
        }
    });
    
});


let cache = {};  // Reset the cache completely

// Invalidate cache and update stock in the database
app.post('/invalidate', (req, res) => {
    const { item_number } = req.body;

    if (!item_number) {
        return res.status(400).json({ error: 'item_number is required' });
    }

    // First, update stock in the database
    db.get("SELECT stock FROM books WHERE id = ?", [item_number], (err, row) => {
        if (err) {
            console.error('Error fetching book from database:', err);
            return res.status(500).send('Error updating stock');
        }

        if (row) {
            const updatedStock = row.stock - 1; // Decrease stock by 1

            // Update stock in the database
            db.run("UPDATE books SET stock = ? WHERE id = ?", [updatedStock, item_number], (updateErr) => {
                if (updateErr) {
                    console.error('Error updating stock:', updateErr);
                    return res.status(500).send('Error updating stock');
                }

                // Cache invalidation
                if (cache[`info-${item_number}`]) {
                    delete cache[`info-${item_number}`];  // Invalidate cache
                    console.log(`Cache invalidated for item ${item_number}`);
                } else {
                    console.log(`Cache item ${item_number} not found`);
                }

                res.send('Stock updated and cache invalidated');
            });
        } else {
            console.log(`Item ${item_number} not found in database`);
            res.status(404).send('Item not found');
        }
    });
});




app.listen(PORT, () => {
    console.log(`Catalog service (Primary) running on port ${PORT}`);
});
