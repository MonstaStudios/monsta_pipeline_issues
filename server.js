const express = require('express');
const path = require('path');
const reportHandler = require('./api/report');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Mount the API handler — passes raw req/res so Busboy multipart parsing works as-is
app.post('/api/report', (req, res) => {
    reportHandler(req, res);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
