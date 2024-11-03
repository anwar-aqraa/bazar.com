// Frontend Server - client.js

const express = require('express');
const axios = require('axios');
const redis = require('redis');
const util = require("util");
const app = express();
const PORT = 3000; // منفذ واجهة المستخدم


const client = redis.createClient({
    host: "redis",
    port: 6379,
    maxmemory: "100mb", // حدد حجم الذاكرة القصوى للتخزين المؤقت
    maxmemory_policy: "allkeys-lru" // تطبيق سياسة LRU لاستبدال البيانات
});
client.get = util.promisify(client.get);
client.set = util.promisify(client.set);
client.del = util.promisify(client.del);

// Middleware to parse JSON requests
app.use(express.json());


let catalogIndex = 0;
let orderIndex = 0;
const catalogServers = ["http://catalog-server1:3001", "http://catalog-server2:3001"];
const orderServers = ["http://order-server1:3002", "http://order-server2:3002"];

// Search books by topic
app.get('/search/:topic', async (req, res) => {
    const { topic } = req.params;
    
    try {
      
        const cachedData = await client.get(topic);
        if (cachedData) {
            console.log('Retrieved from cache');
            return res.json(JSON.parse(cachedData));
        }

    
        const response = await axios.get(`${catalogServers[catalogIndex]}/search/${topic}`);
        catalogIndex = (catalogIndex + 1) % catalogServers.length;

        
        console.log('Retrieved from database');
        
        // تخزين البيانات في الذاكرة المؤقتة
        await client.set(topic, JSON.stringify(response.data), 'EX', 300); // Expiration 5 minutes
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching search results for topic "${topic}":`, error.message);
        res.status(500).send('Error fetching search results');
    }
});

app.get('/info/:item_number', async (req, res) => {
    const { item_number } = req.params;
    
    try {
       
        const cachedData = await client.get(item_number);
        if (cachedData) {
            console.log('Retrieved from cache');
            return res.json(JSON.parse(cachedData));
        }

        // طلب البيانات من خدمة الكتالوج
        const response = await axios.get(`${catalogServers[catalogIndex]}/info/${item_number}`);
        catalogIndex = (catalogIndex + 1) % catalogServers.length;

        // طباعة أن البيانات جاءت من قاعدة البيانات
        console.log('Retrieved from database');
        
        await client.set(item_number, JSON.stringify(response.data), 'EX', 300);
        res.json(response.data);
    } catch (error) {
        console.error(`Error fetching info for item number "${item_number}":`, error.message);
        res.status(500).send('Error fetching item info');
    }
});


// Purchase a book with synchronization
app.post('/purchase/:item_number', async (req, res) => {
    const { item_number } = req.params;
    try {
        // اختيار خادم الطلبات بناءً على Round-Robin
        const response = await axios.post(`${orderServers[orderIndex]}/purchase/${item_number}`);
        orderIndex = (orderIndex + 1) % orderServers.length;

        // إبطال البيانات من الذاكرة المؤقتة للتأكد من التناسق
        await client.del(item_number);

        // إرسال التحديثات لجميع النسخ المكررة
        await Promise.all(orderServers.map(server => axios.post(`${server}/sync/${item_number}`)));

        console.log(`Purchase processed and synchronized for item: ${item_number}`);
        res.json(response.data);
    } catch (error) {
        console.error(`Error processing purchase for item number "${item_number}":`, error.message);
        res.status(500).send('Error processing purchase');
    }
});

app.listen(PORT, () => {
    console.log(`Frontend service running on port ${PORT}`);
});
