const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3002;

// Middleware to parse JSON requests
app.use(express.json());

// SQLite setup
const db = new sqlite3.Database('./orders.db');

// Initialize the database
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, book_id INTEGER, status TEXT)");
});

// Purchase book
app.post('/purchase/:item_number', async (req, res) => {
    const { item_number } = req.params;
    try {
        const response = await axios.get(`http://catalog-server:3001/info/${item_number}`);
        const book = response.data;
        if (book && book.stock > 0) {
            const updatedStock = book.stock - 1;
            await axios.post(`http://catalog-server:3001/update/${item_number}`, { stock: updatedStock });
            db.run("INSERT INTO orders (book_id, status) VALUES (?, ?)", [item_number, 'completed'], function (err) {
                if (err) {
                    res.status(500).send('Error logging the order');
                } else {
                    res.send(`Book purchased successfully: ${book.title}`);
                }
            });
        } else {
            res.send(`Purchase failed: Book "${book.title}" is out of stock`);
        }
    } catch (error) {
        res.status(500).send('Error processing purchase');
    }
});

// Sync orders between replicas
app.post('/sync/:item_number', (req, res) => {
    // Logic to synchronize orders with replicas
    res.send(`Synchronized successfully for item ${req.params.item_number}`);
});

app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});
