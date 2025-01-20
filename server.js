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
    username: { type: String, required: true },
    score: { type: Number, required: true },
    time: { type: Number, required: true },
    datetime: { type: Date, default: Date.now }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
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
            .sort({ score: -1, datetime: -1 }) // Sort by score desc, then by date desc
            .limit(10)
            .exec();
        res.json(scores);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch scores' });
    }
});

// Get player's best score
app.get('/api/scores/:username/best', async (req, res) => {
    try {
        const score = await Score.findOne({ username: req.params.username })
            .sort({ score: -1 })
            .exec();
        res.json(score);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch best score' });
    }
});

// Save new score
app.post('/api/scores', async (req, res) => {
    try {
        const newScore = new Score({
            username: req.body.username,
            score: req.body.score,
            time: req.body.time,
            datetime: req.body.datetime || new Date()
        });
        
        await newScore.save();
        
        // Get updated top scores
        const topScores = await Score.find()
            .sort({ score: -1, datetime: -1 })
            .limit(10)
            .exec();
            
        res.status(201).json({
            savedScore: newScore,
            topScores: topScores
        });
    } catch (err) {
        console.error('Error saving score:', err);
        res.status(500).json({ error: 'Failed to save score' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); 