// order/order.js

const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3002;  // Order service port

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
        const response = await axios.get(`http://catalog-server:3001/info/${item_number}`);
        const book = response.data;

        // Debugging: Log the book details received from the catalog
        console.log('Book details:', book);

        // If the book doesn't exist or has no stock info
        if (!book || !book.stock) {
            return res.status(404).send('Book not found'); // Handle book not found case
        }

        // If the book is in stock
        if (book.stock > 0) {
            // Update stock in the catalog
            const updatedStock = book.stock - 1;
            const updateResponse = await axios.post(`http://catalog-server:3001/update/${item_number}`, { stock: updatedStock, price: book.price });

            // Debugging: Log the response from the catalog update
            console.log('Catalog update response:', updateResponse.data);

            // Log the order in the database
            db.run("INSERT INTO orders (book_id, status) VALUES (?, ?)", [item_number, 'completed'], function(err) {
                if (err) {
                    console.error('Error logging the order:', err.message); // Log the error message
                    return res.status(500).send('Error logging the order');
                } else {
                    return res.send(`Book purchased: ${book.title}`);
                }
            });
        } else {
            // If the book is out of stock
            return res.status(400).send('Book out of stock');
        }
    } catch (error) {
        // Log detailed error information
        console.error('Error during purchase:', error.message);
        console.error('Error details:', error.response ? error.response.data : 'No response from catalog service');
        return res.status(500).send('Error processing purchase');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});
