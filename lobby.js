// ============================================================
// ROOM / NETWORKING LOGIC
// ============================================================
// Strategy: the room "code" the user types becomes a PeerJS peer ID
// (prefixed so it doesn't collide with other apps using the same public
// broker). Whoever types the code first successfully claims that ID and
// becomes the HOST. Everyone else who types the same code fails to claim
// it (it's taken) and instead connects TO it as a CLIENT.
//
// The host relays every action to every client (star topology), so any
// number of people can share one room, not just two.
 
const ID_PREFIX = "smiley-room-v1-";
const SYNC_INTERVAL_MS = 3000;
 
window.roomConnected = false;
 
let peer = null;
let isHost = false;
let clientConnections = []; // host only: connections to every client
let hostConnection = null;  // client only: connection to the host
 
const lobbyScreen = document.getElementById("lobby-screen");
const gameScreen = document.getElementById("game-screen");
const codeInput = document.getElementById("room-code-input");
const enterBtn = document.getElementById("enter-room-btn");
const statusEl = document.getElementById("lobby-status");
const roomLabel = document.getElementById("room-label");
 
enterBtn.addEventListener("click", attemptEnterRoom);
codeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") attemptEnterRoom();
});
 
function sanitizeCode(raw) {
    return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}
 
function setStatus(msg) {
    statusEl.textContent = msg;
}
 
function attemptEnterRoom() {
    const code = sanitizeCode(codeInput.value);
    if (!code) {
        setStatus("Type a code first — any word or short phrase works.");
        return;
    }
    enterBtn.disabled = true;
    codeInput.disabled = true;
    setStatus("Connecting…");
 
    const peerId = ID_PREFIX + code;
 
    // First, try to claim the code ourselves (becoming the host).
    peer = new Peer(peerId);
 
    peer.on("open", () => {
        // Nobody else had this code yet — we're the host.
        isHost = true;
        setStatus("Room created. Waiting for others to join…");
        enterRoomUI(code);
 
        peer.on("connection", (conn) => {
            clientConnections.push(conn);
            conn.on("open", () => {
                setStatus(`${clientConnections.length} connected`);
                // Bring the new arrival up to date with the current score,
                // color, AND eye shape, so they don't start on defaults.
                conn.send({
                    kind: "sync",
                    score: getCurrentScore(),
                    color: getCurrentColorSafe(),
                    eyeShape: getCurrentEyeShapeSafe()
                });
            });
            conn.on("data", (msg) => handleIncomingFromClient(msg, conn));
            conn.on("close", () => {
                clientConnections = clientConnections.filter((c) => c !== conn);
                setStatus(`${clientConnections.length} connected`);
            });
        });
 
        // Periodically broadcast the authoritative score, color, AND eye
        // shape so everyone stays roughly in sync even without new
        // clicks/drags/shape-changes happening.
        setInterval(() => {
            broadcastToClients({
                kind: "sync",
                score: getCurrentScore(),
                color: getCurrentColorSafe(),
                eyeShape: getCurrentEyeShapeSafe()
            });
        }, SYNC_INTERVAL_MS);
    });
 
    peer.on("error", (err) => {
        if (err.type === "unavailable-id") {
            // Someone already hosts this room — join them as a client instead.
            joinAsClient(code);
        } else {
            setStatus("Connection error: " + err.type + ". Try a different code.");
            enterBtn.disabled = false;
            codeInput.disabled = false;
        }
    });
}
 
function joinAsClient(code) {
    const hostId = ID_PREFIX + code;
    peer = new Peer(); // random ID for ourselves
    peer.on("open", () => {
        hostConnection = peer.connect(hostId);
        hostConnection.on("open", () => {
            isHost = false;
            setStatus("Connected!");
            enterRoomUI(code);
        });
        hostConnection.on("data", (msg) => handleIncomingFromHost(msg));
        hostConnection.on("close", () => {
            setStatus("Host disconnected.");
            window.roomConnected = false;
        });
    });
    peer.on("error", (err) => {
        setStatus("Couldn't join that room (" + err.type + "). Try again.");
        enterBtn.disabled = false;
        codeInput.disabled = false;
    });
}
 
function enterRoomUI(code) {
    roomLabel.textContent = code;
    lobbyScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    window.roomConnected = true;
    if (typeof startSharedFace === "function") startSharedFace();
}
 
// ------------------------------------------------------------
// Message handling
// ------------------------------------------------------------
function handleIncomingFromClient(msg, fromConn) {
    if (msg.kind === "actions") {
        applyIncomingActions(msg.actions);
        // Relay to every other client so everyone stays in sync.
        for (const conn of clientConnections) {
            if (conn !== fromConn) conn.send(msg);
        }
    } else if (msg.kind === "color") {
        if (typeof receiveColorChange === "function") receiveColorChange(msg.color);
        // Relay to every other client so everyone's slider/face matches.
        for (const conn of clientConnections) {
            if (conn !== fromConn) conn.send(msg);
        }
    } else if (msg.kind === "eyeShape") {
        if (typeof receiveEyeShapeChange === "function") receiveEyeShapeChange(msg.pointer);
        // Relay to every other client so everyone's eye shape matches.
        for (const conn of clientConnections) {
            if (conn !== fromConn) conn.send(msg);
        }
    }
}
 
function handleIncomingFromHost(msg) {
    if (msg.kind === "actions") {
        applyIncomingActions(msg.actions);
    } else if (msg.kind === "color") {
        if (typeof receiveColorChange === "function") receiveColorChange(msg.color);
    } else if (msg.kind === "eyeShape") {
        if (typeof receiveEyeShapeChange === "function") receiveEyeShapeChange(msg.pointer);
    } else if (msg.kind === "sync") {
        if (typeof receiveScoreSync === "function") receiveScoreSync(msg.score);
        if (msg.color && typeof receiveColorChange === "function") receiveColorChange(msg.color);
        if (typeof msg.eyeShape === "number" && typeof receiveEyeShapeChange === "function") {
            receiveEyeShapeChange(msg.eyeShape);
        }
    }
}
 
function applyIncomingActions(actions) {
    if (typeof applyAction !== "function") return;
    let totalDelta = 0;
    for (const action of actions) totalDelta += applyAction(action);
 
    // Someone else in the room clicked — show it here too. We don't know
    // their cursor position, so pop it up near the score counter instead.
    if (typeof showScorePopup === "function" && typeof width !== "undefined") {
        showScorePopup(totalDelta, width / 2, 60);
    }
}
 
function broadcastToClients(msg) {
    for (const conn of clientConnections) conn.send(msg);
}
 
function getCurrentScore() {
    return typeof score !== "undefined" ? score : 100;
}
 
// Safe wrapper in case getCurrentColor() (defined in main.js) isn't ready
// yet for some reason — avoids crashing the sync interval.
function getCurrentColorSafe() {
    return typeof getCurrentColor === "function" ? getCurrentColor() : null;
}
 
// Safe wrapper in case getCurrentEyeShape() (defined in main.js) isn't
// ready yet for some reason — avoids crashing the sync interval.
function getCurrentEyeShapeSafe() {
    return typeof getCurrentEyeShape === "function" ? getCurrentEyeShape() : 0;
}
 
// Called by main.js whenever a local click happens.
window.sendRoomAction = function (actions) {
    const msg = { kind: "actions", actions };
    if (isHost) {
        broadcastToClients(msg);
    } else if (hostConnection) {
        hostConnection.send(msg);
    }
};
 
// Called by main.js whenever the local player drags an r/g/b slider.
window.sendColorChange = function (color) {
    const msg = { kind: "color", color };
    if (isHost) {
        broadcastToClients(msg);
    } else if (hostConnection) {
        hostConnection.send(msg);
    }
};
 
// Called by main.js whenever the local player clicks the < or > eye-shape buttons.
window.sendEyeShapeChange = function (pointer) {
    const msg = { kind: "eyeShape", pointer };
    if (isHost) {
        broadcastToClients(msg);
    } else if (hostConnection) {
        hostConnection.send(msg);
    }
};