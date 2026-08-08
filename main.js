// ============================================================
// CONFIG / CONSTANTS
 
//const { text } = require("express");
 
// ============================================================
const SCORE_THRESHOLD = 150;   // below this, face becomes sad
const SCORE_DECAY = 0.1;       // score lost per frame
const SCORE_BOOST = 10;        // score gained per click
const EYEBAG_REST_Y = 80;      // eye bag resting offset
const EYEBAG_RAISED_Y = 10;    // eye bag offset when "excited"
const EYEBAG_EASE = 0.3;       // lerp speed for eye bag animation
let CHEEK_SIZE_REST; // size of cheeks
let CHEEK_SIZE_PRESSED; // size of cheeks when pressed
const EXCITED_DURATION = 500; // ms the "isUp" state lasts after a click
 
let button;
let minigame_button;
let eyeLeft;
let eyeRight;

let minigameInstance = null;
 
let food = ['🥐', '🍕', '🌭', '🍗', '🍙', '🍤', '🍛', '🥟', '🌯', '🍩', '🍪', '🥞', '🧇', '🍚', '🍜', '🍥', '🍔', '🍣', '🍱', '🥨', '🍲', ];
let eyeType = ["normal", "cute", "square", "star", "triangle"]
let pointer = 0
 
 
let currentFood = null; // which emoji is currently "in" the mouth, or null
let r, g, b;
 
// ============================================================
// STATE
// ============================================================
let score = 100;
let scoreText;
let eyeBagYPos, targetEyeBagYPos;
let isUp = false;
let isOpen = false;
 
let leftCheekSize, targetLeftCheekSize, isLeftUp = false;
let rightCheekSize, targetRightCheekSize, isRightUp = false;
 
let cheekHitboxes = [];
let eyeHitboxes = [];
let scoreDisplay = [];
 
let isSadOverride = false;
 
// Random blinking — purely local, each person blinks on their own schedule.
let eyeOpenAmount = 1;   // 1 = fully open, 0 = fully closed
let eyeOpenTarget = 1;
const BLINK_EASE = 0.5;
 
 
// ============================================================
// P5 LIFECYCLE
// ============================================================
function setup() {
 
    pointer = constrain(pointer, 0, eyeType.length);
 
    angleMode(DEGREES);
    rectMode(CENTER);
    createCanvas(windowWidth, windowHeight).parent("game-screen");
    document.oncontextmenu = () => false;
 
    CHEEK_SIZE_REST = windowWidth / 5;
    CHEEK_SIZE_PRESSED = windowWidth / 3;
 
    eyeBagYPos = EYEBAG_REST_Y;
    targetEyeBagYPos = EYEBAG_RAISED_Y;
 
    leftCheekSize = CHEEK_SIZE_REST;
    targetLeftCheekSize = CHEEK_SIZE_REST;
    rightCheekSize = CHEEK_SIZE_REST;
    targetRightCheekSize = CHEEK_SIZE_REST;
 
    //feed button
    button = createButton('FEED', 'red');
    button.parent("game-screen");
    button.position(windowWidth / 2 - 128 - 10, 3 * windowHeight / 4)
    button.mousePressed(() => {
            // Route through applyAction/sendRoomAction (same pipeline as
            // clicks) so feeding is applied locally AND broadcast to
            // everyone else in the room, instead of only changing local state.
            const action = { type: "feed", food: random(food) };
            const delta = applyAction(action);
            showScorePopup(delta, mouseX, mouseY);
            window.sendRoomAction && window.sendRoomAction([action]);
    });
    button.addClass('feed-button');
 
    //button left
    eyeLeft = createButton('<');
    eyeLeft.parent("game-screen");
    eyeLeft.position(18 * windowWidth / 21, 100);
    eyeLeft.mousePressed(() => {
        pointer = constrain(pointer + 1, 0, eyeType.length - 1);
        broadcastEyeShapeChange();
    });
 
    //button left
    eyeRight = createButton('>');
    eyeRight.parent("game-screen");
    eyeRight.position(18 * windowWidth / 21 + 45, 100);
    eyeRight.mousePressed(() => {
        pointer = constrain(pointer - 1, 0, eyeType.length - 1);
        broadcastEyeShapeChange();
    });
 
    eyeRight.addClass("select-eyes");
    eyeLeft.addClass("select-eyes");
 
    //customisation
    r = createSlider(0, 255, 255, 1);
    g = createSlider(0, 255, 222, 1);
    b = createSlider(0, 255, 52, 1);
 
    r.position( 18 * windowWidth / 21, 20);
    g.position(18 * windowWidth / 21, 40);
    b.position( 18 * windowWidth / 21, 60);
 
    r.size(80);
    g.size(80);
    b.size(80);
 
    r.parent("game-screen");
    g.parent("game-screen");
    b.parent("game-screen");
 
    // Broadcast the color to everyone else in the room whenever a slider
    // moves. .input() fires continuously while dragging (not just on
    // release), so the color updates live for other people as you drag too.
    r.input(broadcastColorChange);
    g.input(broadcastColorChange);
    b.input(broadcastColorChange);
    

    //minigame
    minigame_button = createButton("minigame")
    minigame_button.position(20, 20);
    minigame_button.parent("game-screen")
    minigame_button.mousePressed(() => {
        launchMinigame();
    })
 
     // Don't animate/decay until a room connection is live.
    noLoop();
}
 
function draw() {
    drawBackground();
    drawFace();
    drawScore();
    updateScore();
    updateEyeBagAnimation();
    updateCheekSizes();
    updateBlink();
}
 
function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    eyeBagYPos = EYEBAG_REST_Y;
    leftCheekSize = CHEEK_SIZE_REST;
    rightCheekSize = CHEEK_SIZE_REST;
}
 
// ============================================================
// DRAWING
// ============================================================
function drawBackground() {
    noStroke();
    background(r.value(), g.value(), b.value());
}
 
function drawFace() {
    fill(0);
    eyes(windowWidth / 2, 100, windowWidth / 10, windowWidth / 4);
    mouth(windowWidth / 2, windowHeight / 2, windowWidth / 7, windowWidth / 15);
 
    fill(255, 170, 102);
    cheeks(windowWidth / 8, windowHeight / 2);
}
 
function cheeks(x, y) {
    fill(255, 170, 102);
    circle(x, y, leftCheekSize);
    circle(7 * x, y, rightCheekSize);
 
    const leftHalf = (leftCheekSize / 2) / Math.sqrt(2);
    const leftBox = leftCheekSize / Math.sqrt(2);
    const rightHalf = (rightCheekSize / 2) / Math.sqrt(2);
    const rightBox = rightCheekSize / Math.sqrt(2);
 
    cheekHitboxes = [
        { x: x - leftHalf, y: y - leftHalf, size: leftBox, side: "left" },
        { x: 7 * x - rightHalf, y: y - rightHalf, size: rightBox, side: "right" }
    ];
}
 
function drawScore() {
    fill(0);
    noStroke();
    text(Math.round(score), 20, 20);
 
    // Popups: show the real value that was stored (with a sign), float
    // upward, fade out, and get removed once they're spent/off-screen.
    textAlign(CENTER, CENTER);
    for (const s of scoreDisplay) {
        s.y -= 1.2;      // float upward
        s.age += 1;
 
        const alpha = map(s.age, 0, s.lifespan, 255, 0, true);
        const isPositive = s.value >= 0;
 
        noStroke();
        fill(isPositive ? [40, 200, 90, alpha] : [220, 60, 60, alpha]);
        textSize(48);
        for (const box of eyeHitboxes) {
            if (!(mouseX > box.x && mouseX < box.x + box.size && mouseY > box.y && mouseY < box.y + box.size)) {
                text("❤️", s.x, s.y);
            }
            else {
                text("💔", s.x, s.y)
            }
        }
 
    }
    textAlign(LEFT, BASELINE); // restore default for drawScore()'s own text() call above
 
    // Clean up expired popups so the array doesn't grow forever.
    scoreDisplay = scoreDisplay.filter((s) => s.age < s.lifespan);
}
 
function eyes(x, y, size, gap) {
    const leftX = x - gap / 2;
    const rightX = x + gap / 2;
 
    fill(0);
    ellipse(leftX, y, size, size * eyeOpenAmount);
    ellipse(rightX, y, size, size * eyeOpenAmount);
 
    drawPupil(leftX, y, size);
    drawPupil(rightX, y, size);
 
    fill(r.value() * 0.95, g.value() * 0.95, b.value() * 0.95);
    arc(leftX, y + eyeBagYPos, size + 10, size + 10, 0, 180);
    arc(rightX, y + eyeBagYPos, size + 10, size + 10, 0, 180);
 
    eyeHitboxes = [
        { x: leftX - (size / 2) / Math.sqrt(2), y: y - (size / 2) / Math.sqrt(2), size: size / Math.sqrt(2), side: "left" },
        { x: rightX - (size / 2) / Math.sqrt(2), y: y - (size / 2) / Math.sqrt(2), size: size / Math.sqrt(2), side: "right" }
    ];
}
 
// Purely a local visual effect — each person's pupils follow their own
// cursor only. Nothing here needs to be sent over the network.
function drawPupil(eyeX, eyeY, eyeSize) {
    const pupilSize = eyeSize * 0.35;
    const maxOffset = eyeSize / 2 - pupilSize / 2 - 4;
 
    const angle = atan2(mouseY - eyeY, mouseX - eyeX);
    const dx = cos(angle) * maxOffset;
    const dy = sin(angle) * maxOffset;
 
    const pupilX = eyeX + dx;
    const pupilY = eyeY + dy;
 
    const pupil2X = eyeX - dx;
    const pupil2Y = eyeY - dy;
 
    fill(255);
    if (eyeType[pointer] == "normal") {
        ellipse(pupilX, pupilY, pupilSize, pupilSize * eyeOpenAmount);
    } else if (eyeType[pointer] == "cute") {
        //hard
        fill(255);
        ellipse(pupilX, pupilY, pupilSize, pupilSize * eyeOpenAmount);
        ellipse(pupil2X, pupil2Y, pupilSize, pupilSize * eyeOpenAmount);
    } else if (eyeType[pointer] == "square") {
        rect(pupilX, pupilY, pupilSize, pupilSize * eyeOpenAmount);
    } else if (eyeType[pointer] == "star") {
        star(pupilX, pupilY, pupilSize * eyeOpenAmount, (pupilSize - 50) * eyeOpenAmount, 4);
    } else if (eyeType[pointer] == "triangle") {
        triangle(pupilX - 30, pupilY + 30 * eyeOpenAmount,pupilX + 30, pupilY + 30 * eyeOpenAmount, pupilX, pupilY - 30 * eyeOpenAmount
);
    }
}
 
//credit: https://archive.p5js.org/examples/form-star.html
function star(x, y, radius1, radius2, npoints) {
  let angle = 360 / npoints;
  let halfAngle = angle / 2.0;
  beginShape();
  for (let a = 0; a < 360; a += angle) {
    let sx = x + cos(a) * radius2;
    let sy = y + sin(a) * radius2;
    vertex(sx, sy);
    sx = x + cos(a + halfAngle) * radius1;
    sy = y + sin(a + halfAngle) * radius1;
    vertex(sx, sy);
  }
  endShape(CLOSE);
}
 
 
function mouth(x, y, size, width) {
    const isHappy = !isSadOverride && score > SCORE_THRESHOLD;
    const outerStart = isHappy ? 0 : 180;
    const outerEnd = isHappy ? 180 : 0;
    const innerYOffset = isHappy ? -0.5 : 0.5;
 
    if (isOpen === false) {
    fill(0);
    arc(x, y, size, size, outerStart, outerEnd);
 
    fill(r.value(), g.value(), b.value());
    arc(x, y + innerYOffset, size - width, size - width, outerStart, outerEnd);
    } else if (isOpen === true){
        fill(0);
        circle(x, y, width * 2);
 
        if (currentFood) {
            // push()/pop() so textSize/textAlign here don't bleed into
            // drawScore()'s own text() calls later in the same frame.
            push();
            textAlign(CENTER, CENTER);
            textSize(width * 0.5);
            text(currentFood, x, y);
            pop();
        }
    }
}

function launchMinigame() {
    if (minigameInstance !== null) return;
    //noLoop();
    minigameInstance = new p5(minigameSketch);
}
 
// ============================================================
// UPDATE / ANIMATION LOGIC
// ============================================================
function updateScore() {
    score -= SCORE_DECAY;
    score = constrain(score, 0, 999999999999999999);
}
 
function updateEyeBagAnimation() {
    targetEyeBagYPos = isUp ? EYEBAG_RAISED_Y : EYEBAG_REST_Y;
    eyeBagYPos = lerp(eyeBagYPos, targetEyeBagYPos, EYEBAG_EASE);
}
 
function updateBlink() {
    eyeOpenAmount = lerp(eyeOpenAmount, eyeOpenTarget, BLINK_EASE);
}
 
function updateCheekSizes() {
    targetLeftCheekSize = isLeftUp ? CHEEK_SIZE_PRESSED : CHEEK_SIZE_REST;
    leftCheekSize = lerp(leftCheekSize, targetLeftCheekSize, EYEBAG_EASE);
 
    targetRightCheekSize = isRightUp ? CHEEK_SIZE_PRESSED : CHEEK_SIZE_REST;
    rightCheekSize = lerp(rightCheekSize, targetRightCheekSize, EYEBAG_EASE);
}
 
// ============================================================
// COLOR SYNC (sliders are shared state, just like score)
// ============================================================
// Called whenever THIS person drags any of the r/g/b sliders. Broadcasts
// the new color to everyone else in the room so their sliders and
// rendering update to match.
function broadcastColorChange() {
    if (typeof window.sendColorChange === "function") {
        window.sendColorChange({ r: r.value(), g: g.value(), b: b.value() });
    }
}
 
// Called by lobby.js when a color change arrives from someone else in the
// room (or from the host's periodic sync). Moves this person's own
// sliders to match — draw() reads r.value()/g.value()/b.value() every
// frame, so the face updates automatically once the sliders are set.
function receiveColorChange(color) {
    if (!color) return;
    r.value(color.r);
    g.value(color.g);
    b.value(color.b);
}
 
// Returns the current color as a plain object, so lobby.js can include it
// in periodic syncs without needing to know about r/g/b directly.
function getCurrentColor() {
    return { r: r.value(), g: g.value(), b: b.value() };
}
 
// ============================================================
// EYE SHAPE SYNC (pointer/eyeType is shared state, same pattern as color)
// ============================================================
// Called whenever THIS person clicks the < or > eye-shape buttons.
// Broadcasts the new pointer index to everyone else in the room.
function broadcastEyeShapeChange() {
    if (typeof window.sendEyeShapeChange === "function") {
        window.sendEyeShapeChange(pointer);
    }
}
 
// Called by lobby.js when an eye-shape change arrives from someone else
// (or from the host's periodic sync). draw() reads the global `pointer`
// every frame via drawPupil(), so just updating it is enough to change
// the rendering for this person too.
function receiveEyeShapeChange(newPointer) {
    if (typeof newPointer !== "number") return;
    pointer = constrain(newPointer, 0, eyeType.length - 1);
}
 
// Returns the current eye-shape pointer, so lobby.js can include it in
// periodic syncs without needing to know about `pointer` directly.
function getCurrentEyeShape() {
    return pointer;
}
 
// ============================================================
// SHARED ACTION HANDLING (local clicks + remote clicks both flow through here)
// ============================================================
// action is a plain object like { type: "general" } | { type: "cheek", side: "left" } | { type: "eye" } | { type: "feed", food: "🍕" }
// Returns the score delta this action caused, so callers (like the popup
// text) can display the real amount instead of assuming it's always +10.
function applyAction(action) {
    if (action.type === "general") {
        score += SCORE_BOOST;
        isUp = true;
        setTimeout(() => { isUp = false; }, EXCITED_DURATION);
        return SCORE_BOOST;
    } else if (action.type === "cheek") {
        score += SCORE_BOOST;
        if (action.side === "left") {
            isLeftUp = true;
            setTimeout(() => { isLeftUp = false; }, EXCITED_DURATION);
        } else if (action.side === "right") {
            isRightUp = true;
            setTimeout(() => { isRightUp = false; }, EXCITED_DURATION);
        }
        return SCORE_BOOST;
    } else if (action.type === "eye") {
        isSadOverride = true;
        score -= 2 * SCORE_BOOST;
        setTimeout(() => { isSadOverride = false; }, 1000);
        return -2 * SCORE_BOOST;
    } else if (action.type === "feed") {
        score += 50;
        isOpen = true;
        currentFood = action.food;
        setTimeout(() => {
            isOpen = false;
            currentFood = null;
        }, 500);
        return 50;
    }
    return 0;
}
 
//feeding button
 
// Creates a floating +N/-N popup at a given position. Used for the local
// player's own clicks (real cursor position) and for actions that arrive
// from other people in the room (no cursor position available, so callers
// pass a sensible default like the score counter's location).
function showScorePopup(value, x, y) {
    scoreDisplay.push({ value, x, y, age: 0, lifespan: 60 });
}
 
// Called by lobby.js once a peer connection is live.
function startSharedFace() {
    loop();
    scheduleNextBlink();
}
 
// Purely a local visual effect — schedules the next random blink for this
// person only. Not synchronized with anyone else in the room.
function scheduleNextBlink() {
    const delay = random(2000, 6000); // wait 2-6s before the next blink
    setTimeout(() => {
        eyeOpenTarget = 0; // start closing
        setTimeout(() => {
            eyeOpenTarget = 1; // open back up
            scheduleNextBlink();
        }, 110); // how long the eyes stay shut
    }, delay);
}
 
// Called by lobby.js when the host sends a periodic authoritative score sync.
function receiveScoreSync(hostScore) {
    score = hostScore;
}
 
// ============================================================
// EVENT HANDLERS
// ============================================================
function mousePressed(event) {
    if (mouseButton !== LEFT) return;
    // Ignore clicks while still in the lobby (canvas is hidden but p5 keeps listening).
    if (typeof window.roomConnected === "undefined" || !window.roomConnected) return;
 
    // p5 fires this global mousePressed() for ANY mousedown on the page,
    // including clicks on any of the buttons (their listeners are
    // attached at the document level, not scoped to the canvas). So
    // pressing a button also reaches this function — check the actual DOM
    // click target and bail out before any scoring happens if it landed
    // on a UI element rather than the face/canvas itself.
    const uiElements = [button, eyeLeft, eyeRight].filter(Boolean);
    if (event && uiElements.some((el) => event.target === el.elt)) return;
 
    // Matches the original logic exactly: every click always gives the
    // general "excited" bounce, PLUS extra effects if it also lands on a
    // cheek or eye hitbox. We collect all triggered actions so they can be
    // applied locally and broadcast to everyone else in the room in one go.
    const actions = [{ type: "general" }];
 
    for (const box of cheekHitboxes) {
        if (mouseX > box.x && mouseX < box.x + box.size && mouseY > box.y && mouseY < box.y + box.size) {
            actions.push({ type: "cheek", side: box.side });
        }
    }
 
    for (const box of eyeHitboxes) {
        if (mouseX > box.x && mouseX < box.x + box.size && mouseY > box.y && mouseY < box.y + box.size) {
            actions.push({ type: "eye" });
        }
    }
 
    // Apply every triggered action and add up the real total delta so the
    // popup shows what actually happened (e.g. +20 for a cheek hit, -10 net
    // for hitting an eye), not just a hardcoded +10.
    let totalDelta = 0;
    for (const action of actions) totalDelta += applyAction(action);
 
    showScorePopup(totalDelta, mouseX, mouseY);
 
    window.sendRoomAction && window.sendRoomAction(actions);
}