const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3004; // Order service port

// Middleware to parse JSON requests
app.use(express.json());

// SQLite setup
const db = new sqlite3.Database('./orders.db');

// Initialize the database
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, book_id INTEGER, status TEXT)");
});

// Purchase endpoint
app.post('/purchase/:item_number', async (req, res) => {
    const { item_number } = req.params;

    try {
        // Check stock from catalog service
        const response = await axios.get(`http://catalog-server:3003/info/${item_number}`);
        const book = response.data;

        if (book.stock > 0) {
            db.run("INSERT INTO orders (book_id, status) VALUES (?, ?)", [item_number, 'purchased']);
            // Decrease stock in the catalog server (primary)
            await axios.post(`http://catalog-server:3003/update/${item_number}`, { stock: book.stock - 1 });
            res.send('Purchase successful');
        } else {
            res.status(400).send('Out of stock');
        }
    } catch (error) {
        console.error('Error processing purchase:', error);
        res.status(500).send('Error processing purchase');
    }
});

app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});
