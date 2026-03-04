const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const reportHandler = require('./api/report');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Coolify's reverse proxy for correct IP detection (rate limiting)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "www.google.com", "www.gstatic.com"],
            frameSrc: ["www.google.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
        }
    }
}));

// Rate limit: 5 form submissions per IP per 10 minutes
const submitLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'Too many submissions. Please wait a few minutes and try again.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Serve the form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Mount the API handler with rate limiting
app.post('/api/report', submitLimiter, (req, res) => {
    reportHandler(req, res);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
