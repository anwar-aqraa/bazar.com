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

        // Invalidate cache
        await axios.post(`http://catalog-server:3001/invalidate-cache/${item_number}`);
        console.log(`Cache invalidated for item ${item_number}`);

        // Update the stock in the catalog server
        await axios.post(`http://catalog-server:3001/update/${item_number}`, { stock: updatedStock });

        // Log the order in the database
        db.run("INSERT INTO orders (book_id, status) VALUES (?, ?)", [item_number, 'completed'], function (err) {
            if (err) {
                console.error('Error logging the order:', err.message);
                return res.status(500).send('Error logging the order');
            } else {
                console.log(`Order processed successfully for item ${item_number}. Stock updated to ${updatedStock}`);
                // Implicit synchronization
                axios.post(`http://order-server-replica:3008/sync/${item_number}`);
                console.log(`Implicit synchronization done for item ${item_number}`);
                res.send(`Book purchased successfully: ${book.title}`);
            }
        });
    } catch (error) {
        console.error('Error during purchase:', error.message);
        res.status(500).send('Error processing purchase');
    }
});

// Synchronization endpoint for replicas
// Synchronization endpoint for replicas
app.post('/sync/:item_number', (req, res) => {
    const { item_number } = req.params;

    // Implement any internal logic needed to sync replicas here
    console.log(`Synchronization request received for item: ${item_number}`);
    // Message for successful synchronization
    console.log(`Synchronized successfully for item ${item_number}`);
    res.send(`Synchronized successfully for item ${item_number}`);
});


// New purchase endpoint for order-replica
// New purchase endpoint for order-replica
app.post('/order-replica/purchase/:item_number', async (req, res) => {
    const { item_number } = req.params;

    try {
        // Invalidate cache for the item being purchased
        await axios.post(`http://catalog-server:3001/invalidate-cache/${item_number}`);
        console.log(`Cache invalidated for item ${item_number} on order-replica`);

        const response = await axios.get(`http://catalog-server:3001/info/${item_number}`);
        const book = response.data;

        if (!book || typeof book.stock === 'undefined' || book.stock <= 0) {
            return res.status(404).send('Book not available or out of stock');
        }

        const updatedStock = book.stock - 1;

        await axios.post(`http://catalog-server:3001/update/${item_number}`, { stock: updatedStock });

        db.run("INSERT INTO orders (book_id, status) VALUES (?, ?)", [item_number, 'completed'], function (err) {
            if (err) {
                console.error('Error logging the order:', err.message);
                return res.status(500).send('Error logging the order');
            } else {
                console.log(`Order processed successfully for item ${item_number} on order-replica. Stock updated to ${updatedStock}`);
                // Implicit synchronization
                axios.post(`http://catalog-server:3001/sync/${item_number}`);
                console.log(`Implicit synchronization done for item ${item_number} on replica`);
                res.send(`Book purchased successfully from replica: ${book.title}`);
            }
        });
    } catch (error) {
        console.error('Error during purchase on replica:', error.message);
        res.status(500).send('Error processing purchase on replica');
    }
});


app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});