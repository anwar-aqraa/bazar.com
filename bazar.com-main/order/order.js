// Order Server - order.js

const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3002; // منفذ خدمة الطلب

// Middleware to parse JSON requests
app.use(express.json());

// SQLite setup
const db = new sqlite3.Database('./orders.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the orders database.');
    }
});

// Purchase endpoint
app.post('/purchase/:item_number', async (req, res) => {
    const { item_number } = req.params;

    try {
        const response = await axios.get(`http://catalog-server:3001/info/${item_number}`);
        const book = response.data;

        if (!book || typeof book.stock === 'undefined' || book.stock <= 0) {
            return res.status(404).send('Book not available or out of stock');
        }

        const updatedStock = book.stock - 1;

        // إبطال التخزين المؤقت
        await axios.post(`http://catalog-server:3001/invalidate-cache/${item_number}`);
        await axios.post(`http://catalog-server:3001/update/${item_number}`, { stock: updatedStock });

        db.run("INSERT INTO orders (book_id, status) VALUES (?, ?)", [item_number, 'completed'], function (err) {
            if (err) {
                console.error('Error logging the order:', err.message);
                return res.status(500).send('Error logging the order');
            } else {
                console.log(`Order processed successfully for item ${item_number}. Stock updated to ${updatedStock}`);
                res.send(`Book purchased successfully: ${book.title}`);
            }
        });
    } catch (error) {
        console.error('Error during purchase:', error.message);
        res.status(500).send('Error processing purchase');
    }
});

// Synchronization endpoint for replicas
app.post('/sync/:item_number', (req, res) => {
    const { item_number } = req.params;

    // Implement any internal logic needed to sync replicas here
    console.log(`Synchronization request received for item: ${item_number}`);
    res.send(`Synchronized successfully for item ${item_number}`);
});

app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});
