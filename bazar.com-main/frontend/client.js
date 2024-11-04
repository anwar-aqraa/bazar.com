const express = require('express');
const axios = require('axios');
const redis = require('redis');
const util = require("util");
const app = express();
const PORT = 3000; // Frontend service port

// Redis setup
const client = redis.createClient({
    host: "redis",
    port: 6379,
    maxmemory: "100mb", // Cache size limit
    maxmemory_policy: "allkeys-lru" // Cache replacement policy
});

// Promisify Redis methods
client.get = util.promisify(client.get);
client.set = util.promisify(client.set);
client.del = util.promisify(client.del);

// Middleware to parse JSON requests
app.use(express.json());

let catalogIndex = 0;
const catalogServers = ["http://catalog-server:3001", "http://catalog-server-replica:3009"];

let orderIndex = 0;
const orderServers = ["http://order-server:3002", "http://order-server-replica:3008"];

// Error handling for Redis
client.on("error", (err) => {
    console.error("Redis error:", err);
});

// Log Redis connection status
client.on("connect", () => {
    console.log("Connected to Redis...");
});

// Search books by topic
app.get('/search/:topic', async (req, res) => {
    const { topic } = req.params;
    const start = Date.now();

    try {
        // Try to retrieve data from Redis cache
        const cachedData = await client.get(topic);
        if (cachedData) {
            console.log(`Retrieved from cache: ${topic}`);
            return res.json(JSON.parse(cachedData));
        }

        // Fetch data from catalog server
        const response = await axios.get(`${catalogServers[catalogIndex]}/search/${topic}`);
        catalogIndex = (catalogIndex + 1) % catalogServers.length;

        console.log(`Retrieved from database: ${topic}`);

        // Store data in Redis cache with expiration
        const result = await client.set(topic, JSON.stringify(response.data), 'EX', 300); // Expiration 5 mins

        if (result === 'OK') {
            console.log(`Data for topic ${topic} successfully stored in Redis`);
        } else {
            console.error(`Failed to store data for topic ${topic} in Redis`);
        }

        const duration = Date.now() - start;
        console.log(`Response time for /search/${topic}: ${duration}ms`);

        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching search results for topic "${topic}":`, error.message);
        res.status(500).send('Error fetching search results');
    }
});

// Fetch book info by item number
app.get('/info/:item_number', async (req, res) => {
    const { item_number } = req.params;
    const start = Date.now();
    
    try {
        const cachedData = await client.get(item_number);
        if (cachedData) {
            console.log(`Retrieved from cache: item ${item_number}`);
            return res.json(JSON.parse(cachedData));
        }

        const response = await axios.get(`${catalogServers[catalogIndex]}/info/${item_number}`);
        catalogIndex = (catalogIndex + 1) % catalogServers.length;

        console.log(`Retrieved from database: item ${item_number}`);

        const result = await client.set(item_number, JSON.stringify(response.data), 'EX', 300);
        if (result === 'OK') {
            console.log(`Data for item ${item_number} successfully stored in Redis`);
        } else {
            console.error(`Failed to store data for item ${item_number} in Redis`);
        }

        const duration = Date.now() - start;
        console.log(`Response time for /info/${item_number}: ${duration}ms`);

        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching info for item number "${item_number}":`, error.message);
        res.status(500).send('Error fetching item info');
    }
});

// Invalidate cache for item number
app.post('/invalidate-cache/:item_number', async (req, res) => {
    const { item_number } = req.params;
    try {
        await client.del(item_number);
        console.log(`Cache invalidated for item ${item_number}`);
        res.status(200).send(`Cache invalidated for item ${item_number}`);
    } catch (error) {
        console.error(`Error invalidating cache for item ${item_number}:`, error.message);
        res.status(500).send('Error invalidating cache');
    }
});

// Purchase a book and synchronize the cache
app.post('/purchase/:item_number', async (req, res) => {
    const { item_number } = req.params;
    try {
        const response = await axios.post(`${orderServers[orderIndex]}/purchase/${item_number}`);
        orderIndex = (orderIndex + 1) % orderServers.length;

        // Invalidate cache
        console.log(`Invalidating cache for item: ${item_number}`);
        await client.del(item_number);

        // Synchronize with all order server replicas
        console.log(`Sending synchronization requests for item: ${item_number}`);
        await Promise.all(orderServers.map(server => axios.post(`${server}/sync/${item_number}`)));

        res.json({ message: "Purchase completed", data: response.data });
    } catch (error) {
        console.error(`Error processing purchase for item number "${item_number}":`, error.message);
        res.status(500).send('Error processing purchase');
    }
});

app.listen(PORT, () => {
    console.log(`Frontend service running on port ${PORT}`);
});