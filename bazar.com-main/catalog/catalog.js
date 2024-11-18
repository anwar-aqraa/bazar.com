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
    }); });


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

// Update book stock
app.post('/update/:item_number', (req, res) => {
    const { item_number } = req.params;
    const { stock } = req.body;
    
    
    db.run("UPDATE books SET stock = ? WHERE id = ?", [stock, item_number], function (err) {
        if (err) {
            console.error('Error updating book:', err);
            res.status(500).send('Error updating book');
        } else {
            
            fetch(`http://localhost:3003/invalidate?item_number=${item_number}`)
                .then(response => response.text())
                .then(data => {
                    res.send(`Book updated successfully. New stock is now ${stock}. Cache invalidated on replica: ${data}`);
                })
                .catch(error => {
                    console.error('Error invalidating cache on replica:', error);
                    res.status(500).send('Error invalidating cache on replica');
                });
        }
    });
});


// Send notification to replica to invalidate cache after update
app.post('/invalidate-cache/:item_number', (req, res) => {
    const { item_number } = req.params;
    // Send request to catalog-replica service to invalidate its cache

    fetch(`http://localhost:3003/invalidate?item_number=${item_number}`)
        .then(response => response.text())
        .then(data => res.send(`Cache invalidated on replica: ${data}`))
        .catch(error => {
            console.error('Error invalidating cache on replica:', error);
            res.status(500).send('Error invalidating cache on replica');
        });
});

app.listen(PORT, () => {
    console.log(`Catalog service running on port ${PORT}`);
});
