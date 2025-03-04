class Tetris {
    constructor() {
        // Initialize IndexedDB
        this.initDB();
        
        // Show username modal if no username is set
        if (!localStorage.getItem('tetrisUsername')) {
            this.showUsernameModal();
        }
        
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.holdCanvas = document.getElementById('holdCanvas');
        this.holdCtx = this.holdCanvas.getContext('2d');
        this.nextCanvas = document.getElementById('nextCanvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        // Set canvas sizes
        this.canvas.width = 300;
        this.canvas.height = 600;
        this.holdCanvas.width = 100;
        this.holdCanvas.height = 100;
        this.nextCanvas.width = 100;
        this.nextCanvas.height = 200;
        
        // Game properties
        this.blockSize = 30;
        this.cols = 10;
        this.rows = 20;
        this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.paused = false;
        this.gameStartTime = Date.now();
        this.totalPauseTime = 0;
        this.lastPauseTime = 0;
        this.highScore = localStorage.getItem('tetrisHighScore') || 0;
        
        // Tetromino colors
        this.colors = {
            'I': '#4AAFDB', // Light blue
            'O': '#E8C547', // Muted yellow
            'T': '#9B5DE5', // Soft purple
            'S': '#45BF55', // Soft green
            'Z': '#F15B5B', // Soft red
            'J': '#4A69BD', // Navy blue
            'L': '#E67E22'  // Soft orange
        };
        
        // Define tetromino shapes
        this.shapes = {
            'I': [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
            'O': [[1,1], [1,1]],
            'T': [[0,1,0], [1,1,1], [0,0,0]],
            'S': [[0,1,1], [1,1,0], [0,0,0]],
            'Z': [[1,1,0], [0,1,1], [0,0,0]],
            'J': [[1,0,0], [1,1,1], [0,0,0]],
            'L': [[0,0,1], [1,1,1], [0,0,0]]
        };
        
        this.currentPiece = this.generatePiece();
        this.nextPiece = this.generatePiece();
        this.holdPiece = null;
        this.canHold = true;
        
        // Bind controls
        document.addEventListener('keydown', this.handleKeyPress.bind(this));
        document.getElementById('pauseButton').addEventListener('click', () => this.togglePause());
        
        // Start game loop
        this.lastTime = 0;
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.gameLoop();
    }
    
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('TetrisDB', 1);
            
            request.onerror = () => reject(request.error);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('scores')) {
                    const store = db.createObjectStore('scores', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('score', 'score');
                    store.createIndex('datetime', 'datetime');
                }
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                this.loadTopScores();
                resolve();
            };
        });
    }

    async saveScore() {
        const username = localStorage.getItem('tetrisUsername') || 'Player';
        const gameTime = Date.now() - this.gameStartTime - this.totalPauseTime;
        const score = {
            username,
            score: this.score,
            time: gameTime,
            datetime: new Date().toISOString(),
        };

        // Save to IndexedDB
        if (this.db) {
            const transaction = this.db.transaction(['scores'], 'readwrite');
            const store = transaction.objectStore('scores');
            await store.add(score);
        }

        // Save to MongoDB
        try {
            const response = await fetch('/api/scores', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(score)
            });
            
            if (response.ok) {
                const result = await response.json();
                this.updateScoreboardDisplay(result.topScores);
            } else {
                console.error('Failed to save score to server');
                this.loadTopScores(); // Fallback to loading scores
            }
        } catch (err) {
            console.error('Error saving score to server:', err);
            this.loadTopScores(); // Fallback to loading scores
        }
    }

    async loadTopScores() {
        let scores = [];
        
        // Try to load from MongoDB first
        try {
            const response = await fetch('/api/scores');
            if (response.ok) {
                scores = await response.json();
            } else {
                console.error('Failed to fetch scores from server');
            }
        } catch (err) {
            console.error('Error fetching scores from server:', err);
            
            // Fallback to IndexedDB if server is unavailable
            if (this.db) {
                const transaction = this.db.transaction(['scores'], 'readonly');
                const store = transaction.objectStore('scores');
                const scoreIndex = store.index('score');
                
                return new Promise((resolve) => {
                    const request = scoreIndex.openCursor(null, 'prev');
                    const localScores = [];
                    
                    request.onsuccess = (event) => {
                        const cursor = event.target.result;
                        if (cursor && localScores.length < 10) {
                            localScores.push(cursor.value);
                            cursor.continue();
                        } else {
                            this.updateScoreboardDisplay(localScores);
                            resolve();
                        }
                    };
                });
            }
        }
        
        this.updateScoreboardDisplay(scores);
    }

    updateScoreboardDisplay(scores) {
        const scoreboard = document.querySelector('.scoreboard');
        if (!scoreboard) return;
        
        scoreboard.innerHTML = '<h3>Top Scores</h3>';
        const table = document.createElement('table');
        table.innerHTML = `
            <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Score</th>
                <th>Time</th>
                <th>Datetime</th>
            </tr>
        `;
        
        scores.forEach((score, index) => {
            let timeStr = '--:--';
            if (score.time) {
                const minutes = Math.floor(score.time / 60000);
                const seconds = Math.floor((score.time % 60000) / 1000);
                timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            const datetime = new Date(score.datetime);
            const dateStr = datetime.toLocaleDateString();
            const timeOfDay = datetime.toLocaleTimeString();
            const datetimeStr = `${dateStr} ${timeOfDay}`;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${score.username}</td>
                <td>${score.score.toLocaleString()}</td>
                <td>${timeStr}</td>
                <td>${datetimeStr}</td>
            `;
            table.appendChild(row);
        });
        
        scoreboard.appendChild(table);
    }
    
    generatePiece() {
        const pieces = 'IOTSZJL';
        const type = pieces[Math.floor(Math.random() * pieces.length)];
        return {
            type: type,
            shape: this.shapes[type],
            color: this.colors[type],
            x: Math.floor(this.cols / 2) - Math.floor(this.shapes[type][0].length / 2),
            y: 0
        };
    }
    
    rotate(matrix) {
        const N = matrix.length;
        const rotated = matrix.map((row, i) =>
            matrix.map(col => col[N - i - 1])
        );
        return rotated;
    }
    
    isValidMove(piece, offsetX = 0, offsetY = 0, newShape = null) {
        const shape = newShape || piece.shape;
        return shape.every((row, dy) =>
            row.every((value, dx) => {
                let newX = piece.x + dx + offsetX;
                let newY = piece.y + dy + offsetY;
                return !value ||
                    (newX >= 0 && newX < this.cols &&
                     newY < this.rows &&
                     !(newY >= 0 && this.grid[newY][newX]));
            })
        );
    }
    
    merge() {
        this.currentPiece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const newY = this.currentPiece.y + y;
                    if (newY >= 0) {
                        this.grid[newY][this.currentPiece.x + x] = this.currentPiece.color;
                    }
                }
            });
        });
    }
    
    clearLines() {
        let linesCleared = 0;
        for (let y = this.rows - 1; y >= 0; y--) {
            if (this.grid[y].every(cell => cell !== 0)) {
                this.grid.splice(y, 1);
                this.grid.unshift(Array(this.cols).fill(0));
                linesCleared++;
                y++;
            }
        }
        if (linesCleared > 0) {
            // Standard Tetris scoring system
            const points = {
                1: 100,
                2: 300,
                3: 500,
                4: 800
            };
            this.lines += linesCleared;
            this.score += (points[linesCleared] || points[1]) * this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 50);
            this.updateScore();
        }
    }
    
    updateScore() {
        document.querySelector('.score').textContent = this.score.toLocaleString();
        document.querySelector('.lines').textContent = `Lines: ${this.lines}`;
        document.querySelector('.level').textContent = `Level: ${this.level}`;
        
        // Update time
        if (!this.gameOver && !this.paused) {
            const currentTime = Date.now();
            const gameTime = currentTime - this.gameStartTime - this.totalPauseTime;
            const seconds = Math.floor(gameTime / 1000) % 60;
            const minutes = Math.floor(gameTime / 60000);
            document.querySelector('.time').textContent = 
                `Time: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    draw() {
        // Clear canvases
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.holdCtx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
        this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        // Draw background grid
        for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
                // Draw alternating column backgrounds
                if (x % 2 === 1) {
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
                    this.ctx.fillRect(x * this.blockSize, y * this.blockSize, this.blockSize, this.blockSize);
                }
                // Draw grid borders
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.074)';
                this.ctx.strokeRect(x * this.blockSize, y * this.blockSize, this.blockSize, this.blockSize);
            }
        }
        
        // Draw grid
        this.grid.forEach((row, y) => {
            row.forEach((color, x) => {
                if (color) {
                    this.drawBlock(this.ctx, x, y, color);
                }
            });
        });
        
        if (!this.gameOver && !this.paused) {
            // Draw current piece
            this.currentPiece.shape.forEach((row, y) => {
                row.forEach((value, x) => {
                    if (value) {
                        this.drawBlock(
                            this.ctx,
                            this.currentPiece.x + x,
                            this.currentPiece.y + y,
                            this.currentPiece.color
                        );
                    }
                });
            });
        }
        
        // Draw hold piece
        if (this.holdPiece) {
            this.drawPieceInCanvas(this.holdCtx, this.holdPiece, this.holdCanvas);
        }
        
        // Draw next piece
        this.drawPieceInCanvas(this.nextCtx, this.nextPiece, this.nextCanvas);

        // Draw pause screen
        if (this.paused) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        }

        // Draw game over screen
        if (this.gameOver) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 30);
            
            this.ctx.font = '16px Arial';
            this.ctx.fillText('Press SPACE to restart', this.canvas.width / 2, this.canvas.height / 2 + 10);
            
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`Final Score: ${this.score.toLocaleString()}`, this.canvas.width / 2, this.canvas.height / 2 + 40);
        }
    }
    
    drawBlock(ctx, x, y, color) {
        const blockX = x * this.blockSize;
        const blockY = y * this.blockSize;
        const size = this.blockSize - 1;
        
        // Main block color
        ctx.fillStyle = color;
        ctx.fillRect(blockX, blockY, size, size);
        
        // Light effect (top and left edges)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(blockX, blockY + size);
        ctx.lineTo(blockX, blockY);
        ctx.lineTo(blockX + size, blockY);
        ctx.fill();
        
        // Shadow effect (bottom and right edges)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.moveTo(blockX + size, blockY);
        ctx.lineTo(blockX + size, blockY + size);
        ctx.lineTo(blockX, blockY + size);
        ctx.fill();
    }
    
    drawPieceInCanvas(ctx, piece, canvas) {
        const scale = canvas.width / (piece.shape.length * this.blockSize);
        const size = this.blockSize * scale;
        const offsetX = (canvas.width - piece.shape[0].length * size) / 2;
        const offsetY = (canvas.height - piece.shape.length * size) / 2;
        
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const blockX = offsetX + x * size;
                    const blockY = offsetY + y * size;
                    
                    // Main block color
                    ctx.fillStyle = piece.color;
                    ctx.fillRect(blockX, blockY, size - 1, size - 1);
                    
                    // Light effect
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.beginPath();
                    ctx.moveTo(blockX, blockY + size - 1);
                    ctx.lineTo(blockX, blockY);
                    ctx.lineTo(blockX + size - 1, blockY);
                    ctx.fill();
                    
                    // Shadow effect
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
                    ctx.beginPath();
                    ctx.moveTo(blockX + size - 1, blockY);
                    ctx.lineTo(blockX + size - 1, blockY + size - 1);
                    ctx.lineTo(blockX, blockY + size - 1);
                    ctx.fill();
                }
            });
        });
    }
    
    handleKeyPress(event) {
        if (this.gameOver) {
            if (event.key === ' ') {
                this.resetGame();
            }
            return;
        }
        if (this.paused) return;
        
        switch(event.key) {
            case 'ArrowLeft':
                if (this.isValidMove(this.currentPiece, -1)) {
                    this.currentPiece.x--;
                }
                break;
            case 'ArrowRight':
                if (this.isValidMove(this.currentPiece, 1)) {
                    this.currentPiece.x++;
                }
                break;
            case 'ArrowDown':
                if (this.isValidMove(this.currentPiece, 0, 1)) {
                    this.currentPiece.y++;
                }
                break;
            case 'ArrowUp':
                const rotated = this.rotate(this.currentPiece.shape);
                if (this.isValidMove(this.currentPiece, 0, 0, rotated)) {
                    this.currentPiece.shape = rotated;
                }
                break;
            case ' ':
                while (this.isValidMove(this.currentPiece, 0, 1)) {
                    this.currentPiece.y++;
                }
                this.updateScore();
                this.merge();
                this.clearLines();
                this.currentPiece = this.nextPiece;
                this.nextPiece = this.generatePiece();
                this.canHold = true;
                if (!this.isValidMove(this.currentPiece)) {
                    this.gameOver = true;
                }
                break;
            case 'c':
            case 'C':
                if (this.canHold) {
                    if (!this.holdPiece) {
                        this.holdPiece = {
                            type: this.currentPiece.type,
                            shape: this.shapes[this.currentPiece.type],
                            color: this.colors[this.currentPiece.type]
                        };
                        this.currentPiece = this.nextPiece;
                        this.nextPiece = this.generatePiece();
                    } else {
                        const temp = this.currentPiece;
                        this.currentPiece = {
                            type: this.holdPiece.type,
                            shape: this.holdPiece.shape,
                            color: this.holdPiece.color,
                            x: Math.floor(this.cols / 2) - Math.floor(this.holdPiece.shape[0].length / 2),
                            y: 0
                        };
                        this.holdPiece = {
                            type: temp.type,
                            shape: this.shapes[temp.type],
                            color: this.colors[temp.type]
                        };
                    }
                    this.canHold = false;
                }
                break;
        }
        this.draw();
    }
    
    togglePause() {
        this.paused = !this.paused;
        const pauseButton = document.getElementById('pauseButton');
        const pauseIcon = pauseButton.querySelector('.pause-icon');
        
        if (this.paused) {
            pauseIcon.textContent = '▶';
            this.lastPauseTime = Date.now();
        } else {
            pauseIcon.textContent = '⏸';
            this.totalPauseTime += Date.now() - this.lastPauseTime;
            this.lastTime = performance.now();
            this.gameLoop();
        }
        
        // Unfocus the button
        pauseButton.blur();
        
        this.draw();
    }
    
    resetGame() {
        this.grid = Array(this.rows).fill().map(() => Array(this.cols).fill(0));
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.gameOver = false;
        this.paused = false;
        this.dropInterval = 1000;
        this.currentPiece = this.generatePiece();
        this.nextPiece = this.generatePiece();
        this.holdPiece = null;
        this.canHold = true;
        this.gameStartTime = Date.now();
        this.totalPauseTime = 0;
        this.lastPauseTime = 0;
        this.updateScore();
        this.scoreSubmitted = false;
        this.gameLoop();
    }
    
    gameLoop(currentTime = 0) {
        if (this.paused || this.gameOver) {
            if (this.gameOver && !this.scoreSubmitted) {
                this.saveScore();
                this.scoreSubmitted = true;
            }
            return;
        }
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.dropCounter += deltaTime;
        if (this.dropCounter > this.dropInterval) {
            if (this.isValidMove(this.currentPiece, 0, 1)) {
                this.currentPiece.y++;
            } else {
                this.merge();
                this.clearLines();
                this.currentPiece = this.nextPiece;
                this.nextPiece = this.generatePiece();
                this.canHold = true;
                
                if (!this.isValidMove(this.currentPiece)) {
                    this.gameOver = true;
                    return;
                }
            }
            this.dropCounter = 0;
        }
        
        this.draw();
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    showUsernameModal() {
        const modal = document.getElementById('usernameModal');
        const input = document.getElementById('usernameInput');
        const saveButton = document.getElementById('saveUsername');
        
        modal.classList.add('show');
        input.focus();
        
        const saveUsername = () => {
            const username = input.value.trim() || 'Player';
            localStorage.setItem('tetrisUsername', username);
            modal.classList.remove('show');
            this.paused = false;
            this.gameLoop();
        };
        
        saveButton.onclick = saveUsername;
        input.onkeypress = (e) => {
            if (e.key === 'Enter') saveUsername();
        };
        
        // Pause game while entering username
        this.paused = true;
    }
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Tetris();
}); 