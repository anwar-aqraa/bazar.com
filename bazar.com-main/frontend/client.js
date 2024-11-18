const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000; // Frontend port

// Middleware to parse JSON requests
app.use(express.json());

// In-memory cache
const cache = {};

// Server URLs
const catalogServers = [
    'http://catalog-server:3001',
    'http://catalog-replica:3003',
];

const orderServers = [
    'http://order-server:3002',
    'http://order-replica:3004',
];

// Load balancing (round-robin algorithm for catalog and order servers)
let catalogIndex = 0;
let orderIndex = 0;

const chooseServer = (servers, isOrder = false) => {
    const index = isOrder ? orderIndex++ : catalogIndex++;
    if (isOrder) orderIndex = orderIndex % orderServers.length;
    else catalogIndex = catalogIndex % catalogServers.length;
    return servers[index % servers.length];
};

// LRU Cache with size limit
const MAX_CACHE_SIZE = 50;
const lruCache = new Map();

const updateCache = (key, value) => {
    if (lruCache.has(key)) {
        lruCache.delete(key); // Remove the item to re-insert it (marks it as recently used)
    }
    lruCache.set(key, value);

    // If cache exceeds the max size, delete the least recently used (oldest) item
    if (lruCache.size > MAX_CACHE_SIZE) {
        const firstKey = lruCache.keys().next().value;
        lruCache.delete(firstKey);
    }
};

const getCache = (key) => {
    if (lruCache.has(key)) {
        const value = lruCache.get(key);
        lruCache.delete(key); // Move the item to the end to mark it as recently used
        lruCache.set(key, value);
        return value;
    }
    return null;
};

// Search books by topic
app.get('/search/:topic', async (req, res) => {
    const { topic } = req.params;

    // Check cache
    const cachedData = getCache(`search-${topic}`);
    if (cachedData) {
        console.log(`Cache hit for search topic "${topic}"`);
        return res.json({ data: cachedData, server: 'cache' });
    }

    const server = chooseServer(catalogServers);

    try {
        const response = await axios.get(`${server}/search/${topic}`);
        updateCache(`search-${topic}`, response.data); // Cache the response
        console.log(`Cache updated for search topic "${topic}"`);
        res.json({ data: response.data, server: server.includes('replica') ? 'replica' : 'primary' });
    } catch (error) {
        console.error(`Error fetching search results for topic "${topic}":`, error.message);
        res.status(500).send('Error fetching search results');
    }
});

// Get book info
app.get('/info/:item_number', async (req, res) => {
    const { item_number } = req.params;

    // Check if the data is in the cache
    let cachedData = getCache(`info-${item_number}`);
    if (cachedData) {
        console.log(`Cache hit for book info "${item_number}"`);
        return res.json({ data: cachedData, server: 'cache' });
    }

    // Cache miss: fetch data from the catalog server
    const server = chooseServer(catalogServers);

    try {
        const response = await axios.get(`${server}/info/${item_number}`);
        // Once the data is fetched, cache it for future use
        updateCache(`info-${item_number}`, response.data);
        console.log(`Cache updated for book info "${item_number}"`);
        res.json({ data: response.data, server: server.includes('replica') ? 'replica' : 'primary' });
    } catch (error) {
        console.error(`Error fetching book info for item number "${item_number}":`, error.message);
        res.status(500).send('Error fetching book info');
    }
});



// Purchase a book
app.post('/purchase/:item_number', async (req, res) => {
    const { item_number } = req.params;

    const server = chooseServer(orderServers, true); // Always send purchase to order service

    try {
        const response = await axios.post(`${server}/purchase/${item_number}`);

        // Update stock in the cache and invalidate
        if (cache[`info-${item_number}`]) {
            cache[`info-${item_number}`].stock -= 1;
            console.log(`Cache updated for book "${item_number}", new stock: ${cache[`info-${item_number}`].stock}`);
        }

        // Send invalidate request to all catalog servers
        axios.post('http://catalog-server:3001/invalidate', { item_number });
        axios.post('http://catalog-replica:3003/invalidate', { item_number });

        res.json({ data: response.data, server: server.includes('replica') ? 'replica' : 'primary' });
    } catch (error) {
        console.error(`Error processing purchase for item number "${item_number}":`, error.message);
        res.status(500).send('Error processing purchase');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Frontend service running on port ${PORT}`);
});
