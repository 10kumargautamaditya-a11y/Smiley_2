function minigameSketch(p) {
    let moles = [];
    let gridAmt = 6;
    let cellSize = 84;
    let timeConstrain = 10;
    let timeTotal = 100;
    let gameState = "start"; // "start", "playing", or "ended"
    let score = 0;
    let winScore = 15;
    let canvas;

    const closeButton = { x: 504 - 40, y: 10, w: 30, h: 30 };

    p.setup = function () {
        canvas = p.createCanvas(504, 504).parent("game-screen");
        canvas.style('position', 'absolute');
        canvas.style('top', '20px');
        canvas.style('left', '20px'); 
        canvas.style('z-index', '9000');
        canvas.style('border', '4px solid white');
    };

    p.draw = function () {
        p.background(0);

        if (gameState === "start") {
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(24);
            p.fill(0);
            p.text("Click to Start", p.width / 2, p.height / 2);
            drawCloseButton();
            return;
        }

        if (gameState === "ended") {
            p.textAlign(p.CENTER, p.CENTER);
            p.fill(0);
            p.textSize(28);
            p.text(score >= winScore ? "You Win!" : "Game Over", p.width / 2, p.height / 2 - 30);
            p.textSize(20);
            p.text("Final Score: " + score, p.width / 2, p.height / 2 + 10);
            p.textSize(18);
            p.text("Click to Play Again", p.width / 2, p.height / 2 + 50);
            drawCloseButton();
            return;
        }

        // --- gameState === "playing" ---
        p.fill(0);
        makeGrid(gridAmt, cellSize);

        timeConstrain -= 0.02;
        timeTotal -= 0.02;

        p.textAlign(p.LEFT, p.BASELINE);
        p.textSize(16);
        p.fill(255, 255, 255)
        p.text("Next Mole: " + p.round(timeConstrain), 0, 45);
        p.text("Score: " + score, 0, 20);
        p.text("Time Left: " + p.round(timeTotal), 0, 70);

        if (timeConstrain <= 0) {
            moles.push({
                x: p.floor(p.random(gridAmt)),
                y: p.floor(p.random(gridAmt)),
                isPressed: false
            });
            timeConstrain = 10;
        }

        for (let m of moles) {
            let pixelX = m.x * cellSize + cellSize / 2;
            let pixelY = m.y * cellSize + cellSize / 2;
            p.fill(139, 69, 19);
            p.circle(pixelX, pixelY, cellSize);
        }

        if (timeTotal <= 0) {
            gameState = "ended";
        }

        drawCloseButton(); // drawn LAST, always on top
    };

    function drawCloseButton() {
        p.fill(200, 50, 50);
        p.rect(closeButton.x, closeButton.y, closeButton.w, closeButton.h);
        p.fill(255);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(16);
        p.text("X", closeButton.x + closeButton.w / 2, closeButton.y + closeButton.h / 2);
    }

    function makeGrid(grid_amt, grid_size) {
        for (let i = 0; i < grid_amt; i++) {
            for (let j = 0; j < grid_amt; j++) {
                p.square(i * grid_size, j * grid_size, grid_size);
            }
        }
    }

    function resetGame() {
        moles = [];
        timeConstrain = 10;
        timeTotal = 100;
        score = 0;
        gameState = "playing";
    }

    p.mouseClicked = function () {
        console.log("click at", p.mouseX, p.mouseY, "button is at", closeButton);
        // close button takes priority over everything
        if (
            p.mouseX > closeButton.x && p.mouseX < closeButton.x + closeButton.w &&
            p.mouseY > closeButton.y && p.mouseY < closeButton.y + closeButton.h
        ) {
            endMinigame(p);
            return;
        }

        if (gameState === "start") {
            gameState = "playing";
            return;
        }
        if (gameState === "ended") {
            resetGame();
            return;
        }

        // gameState === "playing" — check mole hits
        for (let m of moles) {
            let pixelX = m.x * cellSize + cellSize / 2;
            let pixelY = m.y * cellSize + cellSize / 2;
            let d = p.dist(p.mouseX, p.mouseY, pixelX, pixelY);
            if (d < cellSize / 2) {
                m.x = p.floor(p.random(gridAmt));
                m.y = p.floor(p.random(gridAmt));
                score += 1;
            }
        }
    };

    function endMinigame(p) {
        p.remove();
        minigameInstance = null;
        //loop(); // resume the face sketch's animation
    }
}