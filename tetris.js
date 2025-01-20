class Tetris {
    constructor() {
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
        this.highScore = localStorage.getItem('tetrisHighScore') || 0;
        
        // Tetromino colors
        this.colors = {
            'I': '#00f0f0',
            'O': '#f0f000',
            'T': '#a000f0',
            'S': '#00f000',
            'Z': '#f00000',
            'J': '#0000f0',
            'L': '#f0a000'
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
    }
    
    draw() {
        // Clear canvases
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.holdCtx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
        this.nextCtx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        // Draw grid
        this.grid.forEach((row, y) => {
            row.forEach((color, x) => {
                if (color) {
                    this.drawBlock(this.ctx, x, y, color);
                }
            });
        });
        
        if (!this.gameOver) {
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
        ctx.fillStyle = color;
        ctx.fillRect(x * this.blockSize, y * this.blockSize, this.blockSize - 1, this.blockSize - 1);
        
        // Add shine effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x * this.blockSize, y * this.blockSize, this.blockSize - 1, this.blockSize / 2);
    }
    
    drawPieceInCanvas(ctx, piece, canvas) {
        const scale = canvas.width / (piece.shape.length * this.blockSize);
        const size = this.blockSize * scale;
        const offsetX = (canvas.width - piece.shape[0].length * size) / 2;
        const offsetY = (canvas.height - piece.shape.length * size) / 2;
        
        piece.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    ctx.fillStyle = piece.color;
                    ctx.fillRect(offsetX + x * size, offsetY + y * size, size - 1, size - 1);
                    
                    // Add shine effect
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fillRect(offsetX + x * size, offsetY + y * size, size - 1, size / 2);
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
        if (!this.paused) {
            this.lastTime = performance.now();
            this.gameLoop();
        }
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
        this.updateScore();
        this.gameLoop();
    }
    
    gameLoop(currentTime = 0) {
        if (this.paused || this.gameOver) return;
        
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
}

// Start the game when the page loads
window.addEventListener('load', () => {
    new Tetris();
}); 