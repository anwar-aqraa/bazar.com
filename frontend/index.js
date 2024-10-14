const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;  // Frontend port

// Search books by topic
app.get('/search/:topic', async (req, res) => {
    const { topic } = req.params;
    try {
        const response = await axios.get(`http://localhost:3001/search/${topic}`);  // Catalog service

        // Log the search results to the terminal
        console.log(`Search results for topic "${topic}":`, response.data);

        res.json(response.data);
    } catch (error) {
        // Log the error details to the terminal
        console.error(`Error fetching search results for topic "${topic}":`, error.message);
        res.status(500).send('Error fetching search results');
    }
});

// Get book info
app.get('/info/:item_number', async (req, res) => {
    const { item_number } = req.params;
    try {
        const response = await axios.get(`http://localhost:3001/info/${item_number}`);  // Catalog service

        // Log the book info to the terminal
        console.log(`Book info for item number "${item_number}":`, response.data);

        res.json(response.data);
    } catch (error) {
        // Log the error details to the terminal
        console.error(`Error fetching info for item number "${item_number}":`, error.message);
        res.status(500).send('Error fetching item info');
    }
});

// Purchase a book
app.post('/purchase/:item_number', async (req, res) => {
    const { item_number } = req.params;
    try {
        const response = await axios.post(`http://localhost:3002/purchase/${item_number}`);  // Order service

        // Log the purchase result to the terminal
        console.log(`Purchase result for item number "${item_number}":`, response.data);

        res.json(response.data);
    } catch (error) {
        // Log the error details to the terminal
        console.error(`Error processing purchase for item number "${item_number}":`, error.message);
        res.status(500).send('Error processing purchase');
    }
});

app.listen(PORT, () => {
    console.log(`Frontend service running on port ${PORT}`);
});
