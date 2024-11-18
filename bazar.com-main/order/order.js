const express = require('express');
const app = express();
const PORT = 3002; // Order service primary port

// Middleware to parse JSON requests
app.use(express.json());

// Simulate order processing
app.post('/purchase/:item_number', (req, res) => {
    const { item_number } = req.params;
    console.log(`Purchase request received for item ${item_number}`);
    res.json({ status: 'success', item_number });
});

app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});
