const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 
    (process.env.NODE_ENV === 'production' 
        ? 'mongodb://mongodb:27017/tetris'
        : 'mongodb://localhost:27018/tetris');

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB at:', MONGODB_URI);
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Score Schema
const scoreSchema = new mongoose.Schema({
    username: String,
    score: Number,
    time: Number,
    datetime: { type: Date, default: Date.now }
});

const Score = mongoose.model('Score', scoreSchema);

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get top scores
app.get('/api/scores', async (req, res) => {
    try {
        const scores = await Score.find()
            .sort({ score: -1 })
            .limit(10)
            .exec();
        res.json(scores);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch scores' });
    }
});

// Save new score
app.post('/api/scores', async (req, res) => {
    try {
        const score = new Score(req.body);
        await score.save();
        res.status(201).json(score);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save score' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); 