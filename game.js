/* =========================================================================
     ENGINE  (framework-agnostic — no DOM code below this block boundary)
     =========================================================================
     Board geometry is abstracted so a HexBoard (or other tiling) could later
     implement the same interface: {inBounds, neighbor, getCell, setCell}.
     Rules that vary between game modes ("variants") are NOT hardcoded here —
     they're plugged in as hook objects. See VARIANT HOOKS below.
     ========================================================================= */

const POINTS_PER_SIDE = 2;
const TOTAL_POINTS = 8; // square board: 4 sides * 2 points/side
const HAND_SIZE = 3;

function oppositeSide(s) { return (s + 2) % 4; }

// Point layout within a unit cell, clockwise starting top-left.
// 0,1 = N (left,right) | 2,3 = E (top,bottom) | 4,5 = S (right,left) | 6,7 = W (bottom,top)
const POINT_COORD = [
    { x: 1/3, y: 0 }, { x: 2/3, y: 0 },   // 0,1  N
    { x: 1, y: 1/3 }, { x: 1, y: 2/3 },   // 2,3  E
    { x: 2/3, y: 1 }, { x: 1/3, y: 1 },   // 4,5  S
     {x: 0, y: 2/3 }, { x: 0, y: 1/3 },   // 6,7  W
];

function createBoard(width, height, wrap) {
    return {
        width, height, wrap,
        cells:  new Map(),
                key(x, y) { return x + ',' + y; },
                wrapCoord(x, y) {
                    if (!wrap) return { x, y };
                    return { x: ((x % width) + width) % width, y: ((y % height) + height) % height};
                },
                inBounds(x, y) {
                    if (wrap) return true;
                    return x >= 0 && x < width && y >= 0 && y < height;
                },
                neighbor(x, y, side) {
                    let dx = 0, dy = 0;
                    if (side === 0) dy = -1; else if (side === 1) dx = 1; else if (side === 2) dy = 1; else dx = -1;
                    let nx = x + dx, ny = y + dy;
                    if (!wrap && (nx < 0 || nx >= width || ny < 0 || ny >= height)) return null; // falls off the edge
                    const w = this.wrapCoord(nx,ny);
                    return { x: w.x, y :w.y, side: oppositeSide(side) };
                },
                getCell(x, y) { return this.cells.get(this.key(x, y)) || null; },
                setCell(x, y, data) { this.cells.set(this.key(x, y), data); },
};
}

// Canonical tile patterns: perfect matchings over points 0..7 (before rotation).
const TILE_DEFS = [
    { id: '0',  paths: [[0,1],[2,3],[4,5],[6,7]] },
    { id: '1',  paths: [[0,7],[1,2],[3,4],[5,6]] },
    { id: '2',  paths: [[0,1],[2,3],[4,6],[5,7]] },
    { id: '3',  paths: [[0,7],[1,2],[3,5],[4,6]] },
    { id: '4',  paths: [[0,6],[1,3],[2,4],[5,7]] },
    { id: '5',  paths: [[0,6],[1,7],[2,4],[3,5]] },
    { id: '6',  paths: [[0,1],[2,3],[4,7],[5,6]] },
    { id: '7',  paths: [[0,1],[2,7],[3,4],[5,6]] },
    { id: '8',  paths: [[0,1],[2,4],[3,6],[5,7]] },
    { id: '9',  paths: [[0,6],[1,2],[3,5],[4,7]] },
    { id: '10', paths: [[0,1],[2,7],[3,5],[4,6]] },
    { id: '11', paths: [[0,6],[1,7],[2,5],[3,4]] },
    { id: '12', paths: [[0,1],[2,7],[3,6],[4,5]] },
    { id: '13', paths: [[0,7],[1,6],[2,5],[3,4]] },
    { id: '14', paths: [[0,5],[1,7],[2,4],[3,6]] },
    { id: '15', paths: [[0,6],[1,3],[2,5],[4,7]] },
    { id: '16', paths: [[0,1],[2,5],[3,6],[4,7]] },
    { id: '17', paths: [[0,5],[1,2],[3,6],[4,7]] },
    { id: '18', paths: [[0,3],[1,6],[2,5],[4,7]] },
    { id: '19', paths: [[0,5],[1,4],[2,7],[3,6]] },
    { id: '20', paths: [[0,1],[2,4],[3,7],[5,6]] },
    { id: '21', paths: [[0,1],[2,6],[3,4],[5,7]] },
    { id: '22', paths: [[0,5],[1,7],[2,6],[3,4]] },
    { id: '23', paths: [[0,2],[1,4],[3,7],[5,6]] },
    { id: '24', paths: [[0,1],[2,5],[3,7],[4,6]] },
    { id: '25', paths: [[0,1],[2,6],[3,5],[4,7]] },
    { id: '26', paths: [[0,2],[1,5],[3,6],[4,7]] },
    { id: '27', paths: [[0,4],[1,7],[2,5],[3,6]] },
    { id: '28', paths: [[0,1],[2,6],[3,7],[4,5]] },
    { id: '29', paths: [[0,7],[1,5],[2,6],[3,4]] },
    { id: '30', paths: [[0,2],[1,5],[3,7],[4,6]] },
    { id: '31', paths: [[0,4],[1,7],[2,6],[3,5]] },
    { id: '32', paths: [[0,5],[1,4],[2,6],[3,7]] },
    { id: '33', paths: [[0,4],[1,6],[2,5],[3,7]] },
    { id: '34', paths: [[0,4],[1,5],[2,6],[3,7]] },
];

function rotateTilePaths(paths, steps) {
    const shift = (2 * steps) % 8; // one 90 deg rotation = shift by 2 points
    return paths.map(([a, b]) => [(a + shift) % 8, (b + shift) % 8]);
}

function tileExit(paths, entryPoint) {
    for (const [a, b] of paths) {
        if (a === entryPoint) return b;
        if (b === entryPoint) return a;
    }
    throw new Error('point not on tile: ' + entryPoint);
}

// Movement resolution (stepping a token through however many already-placed
// tiles it chains into) lives further down as startResolution() /
// advanceResolution() — it needs to coordinate with per-turn state (whose
// move this is, whether a variant wants to pause after each tile), so it's
// grouped with the rest of the turn logic instead of kept as a pure
// geometry function here.

/* =========================================================================
     VARIANT HOOKS
     Each variant is a plain object implementing zero or more of:
         modifyBoardConfig(config)          - tweak {wrap} before board creation
         setup(state)                       - run once at game start (e.g. spawn NPCs)
         getNeighbor(board,x,y,side)        - override neighbor lookup
         canRotate(state, player)           - return false to forbid rotation
         onBeforePlaceTile(state,...)       - return false to veto a placement
         onTileCrossed(state, token, cell)  - fires only when a token is about to
                                                                                     leave `cell` for a NEXT cell that
                                                                                     already has a tile too (i.e. the
                                                                                     token is genuinely departing `cell`
                                                                                     for good this turn); set
                                                                                     state.pendingBonusAction to pause
                                                                                     the resolver until the UI resolves it
         onAfterResolve(state)              - run once, after everything for this
                                                                                     turn (all tokens, all crossings) is done
         onEliminate(state, token)          - react to an elimination
     This is the whole extension surface — new rule ideas plug in here without
     touching the resolver or placeTile.
     ========================================================================= */

const TorusWrapVariant = {
    name: 'torus-wrap',
    modifyBoardConfig(config) { config.wrap = true; }
};

const NpcWandererVariant = {
    name: 'npc-wanderer',
    setup(state) {
        // Drop one NPC token roughly in the middle of the perimeter list.
        const spot = state.perimeter[Math.floor(state.perimeter.length / 2)];
        state.npcs.push({
            id: 'npc-1', name: 'Wanderer', isNPC: true, alive: true, color: '#9aa4b6',
            x: spot.x, y: spot.y, point: spot.side * 2 + 1,
        });
    }
};

const RotateOnPassThroughVariant = {
    name: 'rotate-on-passthrough',
    onTileCrossed(state, token, cell) {
        if (token.id !== state.lastActingPlayerId) return; // only the human mover gets the choice
        const resolution = state.activeResolution;
        const cellKey = cell.x + ',' + cell.y;
        const crossedCells = resolution?.crossedCells.get(token.id);
        const start = resolution?.startAnchors.get(token.id);
        const isStartingCell = start && start.x === cell.x && start.y === cell.y;
        if (isStartingCell && !crossedCells.has(cellKey)) return;
        state.pendingBonusAction = { type: 'rotate-passthrough', cell };
    }
};

/* =========================================================================
     GAME STATE / TURN LOGIC
     ========================================================================= */

const PLAYER_COLORS = ['#ff6b6b','#5fd48a','#5fb4ff','#ffd166','#c792ea','#f78fb3','#4dd0e1','#e0a458'];

function buildPerimeter(width, height) {
    const perim = [];
    for (let x = 0; x < width; x++) perim.push({ x, y: 0, side: 0 });               // top,   facing N
    for (let y = 0; y < height; y++) perim.push({ x: width-1, y, side: 1 });        // right, facing E
    for (let x = width - 1; x >= 0; x--) perim.push({ x, y: height-1, side: 2 });   // bottom,facing S
    for (let y = height - 1; y >= 0; y--) perim.push({ x: 0, y, side: 3 });         // left,  facing W
    return perim;
}

function newGame(opts) {
    const { size, numPlayers, variants } = opts;
    const boardConfig = { wrap: false };
    for (const v of variants) v.modifyBoardConfig?.(boardConfig);

    const board = createBoard(size, size, boardConfig.wrap);
    const perimeter = buildPerimeter(size, size);
    const step = Math.floor(perimeter.length / numPlayers);

    const players = [];
    for (let i = 0; i < numPlayers; i++) {
        const spot = perimeter[(i * step) % perimeter.length];
        players.push({
            id: 'p' + i, name: 'Player ' + (i + 1), color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            alive: true, x: spot.x, y: spot.y, point: spot.side * 2,
        });
    }

    const state = {
        tileDrawPile: TILE_DEFS,
        board,
        perimeter,
        players,
        npcs: [],
        variants,
        currentPlayerIndex: 0,
        gameOver: false,
        log: [],
        hands: {}, // playerId -> [tileDef,...]
        handSize: HAND_SIZE,
        pendingBonusAction: null, // set by a variant to pause the resolver for a follow-up choice
        lastActingPlayerId: null,
        activeResolution: null,   // in-progress step-by-step movement (see startResolution)
    };
    
    shuffleArray(state.tileDrawPile);
    for (const v of variants) v.setup?.(state);
    for (const p of players) drawHand(state, p.id);

    return state;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}


function drawHand(state, playerId) {
    if (!state.hands.hasOwnProperty(playerId)) state.hands[playerId] = [];
    const numToDraw = state.handSize - state.hands[playerId].length;
    for (let i = 0; i < numToDraw && state.tileDrawPile.length > 0; i++) {
        state.hands[playerId].push(state.tileDrawPile.pop());
    }
}

function log(state, msg) { state.log.push(msg); }

function applyResult(state, token, result) {
    if (result.status === 'waiting') {
        token.x = result.x; token.y = result.y; token.point = result.point;
    } else if (result.status === 'eliminated') {
        token.x = result.x; token.y = result.y; token.point = result.point;
        token.deathPosition = { x: result.x, y: result.y, point: result.point };
        token.alive = false;
        log(state, `${token.name} fell off the edge and is eliminated.`);
        for (const v of state.variants) v.onEliminate?.(state, token);
    } else if (result.status === 'looped') {
        token.alive = false;
        log(state, `${token.name} got trapped in a closed loop and is eliminated.`);
        for (const v of state.variants) v.onEliminate?.(state, token);
    }
}

function advanceTurn(state) {
    const aliveCount = state.players.filter(p => p.alive).length;
    if (aliveCount <= 1) {
        state.gameOver = true;
        const winner = state.players.find(p => p.alive);
        log(state, winner ? `${winner.name} wins!` : 'Everyone was eliminated — no winner.');
        return;
    }
    do {
        state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    } while (!state.players[state.currentPlayerIndex].alive);
}

// Given a token's current anchor (the tile it's standing on, and the point
// it entered that tile at), works out which cell needs the next tile.
// Recomputed live every time it's needed — if the anchor tile gets rotated
// (by anyone, at any point), the frontier this token is heading toward can
// shift right along with it. For a token that hasn't entered any tile yet
// (fresh spawn), the "frontier" is just its own spawn cell.
function frontierOf(state, token) {
    const cell = state.board.getCell(token.x, token.y);
    if (!cell) return { x: token.x, y: token.y };
    const exitPoint = tileExit(cell.paths, token.point);
    const side = Math.floor(exitPoint / 2);
    let nb = state.board.neighbor(token.x, token.y, side);
    for (const v of state.variants) if (v.getNeighbor) {
        const override = v.getNeighbor(state.board, token.x, token.y, side);
        if (override !== undefined) nb = override;
    }
    return nb; // null only if this token should already have fallen off — shouldn't happen for a token that's alive and waiting
}

function placeTile(state, tileDef, rotation, playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (state.gameOver || !player.alive) return { error: 'not playable'};
    if (state.activeResolution) return { error: 'movement already in progress'};

    const target = frontierOf(state, player);
    if (!target || state.board.getCell(target.x, target.y)) return { error: 'cell already has a tile' };

    for (const v of state.variants) {
        if (v.onBeforePlaceTile && v.onBeforePlaceTile(state, player, tileDef, target.x, target.y, rotation) === false) {
            return {error: 'blocked by variant'};
        }
    }

    const paths = rotateTilePaths(tileDef.paths, rotation);
    state.board.setCell(target.x, target.y, { paths, rotation, tileId: tileDef.id });
    log(state, `${player.name} placed tile ${tileDef.id} at (${target.x},${target.y}).`);

    state.lastActingPlayerId = playerId;
    const tokensHere = [...state.players, ...state.npcs].filter(t => {
        if (!t.alive) return false;
        const f = frontierOf(state, t);
        return f && f.x === target.x && f.y === target.y;
    });

    startResolution(state, tokensHere); // may finish the turn outright, or pause on a variant's pendingBonusAction
    return { ok: true };
}

// --- Step-by-step movement resolver -----------------------------------
// A token's tracked position (cur.x, cur.y, cur.point) is always a tile it
// is genuinely standing on. Each iteration looks ahead one tile: if the
// next cell already has a tile too, the token truly leaves the current one
// behind (this is the only moment onTileCrossed fires — a variant can
// pause here). If the next cell is still empty, the token simply stays
// anchored right where it already is; nothing "moves into the void."
function startResolution(state, tokens) {
    state.activeResolution = {
        remaining: tokens.slice(), current: null,
        startAnchors: new Map(tokens.map(token => [token.id, { x: token.x, y: token.y }])),
        crossedCells: new Map(tokens.map(token => [token.id, new Set()])),
    };
    advanceResolution(state);
}

function advanceResolution(state) {
    const res = state.activeResolution;
    while (true) {
        if (!res.current) {
            if (res.remaining.length === 0) {
                state.activeResolution = null;
                for (const v of state.variants) v.onAfterResolve?.(state);
                if (state.pendingBonusAction) return; // a variant paused things even at the very end
                completeTurn(state);
                return;
            }
            const token = res.remaining.shift();
            res.current = { token, x:token.x, y:token.y, point:token.point, visited:new Set() };
        }

        const cur = res.current;
        const cell = state.board.getCell(cur.x, cur.y); // always real, except a token that has never entered a tile

        if (!cell) {
            applyResult(state, cur.token, { status: 'waiting', x: cur.x, y: cur.y, point: cur.point });
            res.current = null;
            continue;
        }

        const vkey = cur.x + ',' + cur.y + ',' + cur.point;
        if (cur.visited.has(vkey)) {
            applyResult(state, cur.token, { status: 'looped' });
            res.current = null;
            continue;
        }
        cur.visited.add(vkey);

        const exitPoint = tileExit(cell.paths, cur.point);
        const side = Math.floor(exitPoint / 2);
        const p = exitPoint % 2;
        let nb = state.board.neighbor(cur.x, cur.y, side);
        for (const v of state.variants) if (v.getNeighbor) {
            const override = v.getNeighbor(state.board, cur.x, cur.y, side);
            if (override !== undefined) nb = override;
        }

        if (!nb) {
            applyResult(state, cur.token, {
                status: 'eliminated', x: cur.x, y: cur.y, point: exitPoint,
            });
            res.current = null;
            continue;
        }

        const nextCell = state.board.getCell(nb.x, nb.y);
        if (!nextCell) {
            // Nowhere to go yet — stay anchored right here, still on this tile.
            applyResult(state, cur.token, { status: 'waiting', x: cur.x, y: cur.y, point: cur.point });
            res.current = null;
            continue;
        }

        // The next cell already has a tile, so the token is genuinely about to
        // leave `cur` behind for good this turn — the one moment it's safe to
        // offer rotating `cur`, since nothing is anchored there anymore once
        // this fires.
        const leftCell = { x: cur.x, y: cur.y };
        cur.x = nb.x; cur.y = nb.y;
        cur.point = nb.side * 2 + (1 - p);

        for (const v of state.variants) v.onTileCrossed?.(state, cur.token, leftCell);
        res.crossedCells.get(cur.token.id).add(leftCell.x + ',' + leftCell.y);
        if (state.pendingBonusAction) return; // pause — UI shows the bonus panel, resumes us later
    }
}

function completeTurn(state) {
    const playerId = state.lastActingPlayerId;
    drawHand(state, playerId);
    state.pendingBonusAction = null;
    advanceTurn(state);
}

// Called by the UI once the player has chosen (or skipped) their bonus rotation.
function resolveBonusRotate(state, x, y, rotationSteps) {
    if (rotationSteps) {
        rotateCell(state, x, y, rotationSteps);
        const player = state.players.find(p => p.id === state.lastActingPlayerId);
        log(state, `${player.name} rotated the tile at (${x},${y}).`);
    }
    state.pendingBonusAction = null;
    advanceResolution(state); // resume exactly where the chain left off
}

function rotateCell(state, x, y, rotationSteps) {
    const cell = state.board.getCell(x, y);
    const steps = ((rotationSteps % 4) + 4) % 4;
    if (!cell || steps === 0) return;

    cell.paths = rotateTilePaths(cell.paths, steps);
    cell.rotation = (cell.rotation + steps) % 4;
    const shift = (2 * steps) % TOTAL_POINTS;
    for (const token of [...state.players, ...state.npcs]) {
        if (token.alive && token.x === x && token.y === y) {
            token.point = (token.point + shift) % TOTAL_POINTS;
        }
    }

    const current = state.activeResolution?.current;
    if (current && current.x === x && current.y === y) {
        current.point = (current.point + shift) % TOTAL_POINTS;
    }
}

function skipBonus(state) {
    state.pendingBonusAction = null;
    advanceResolution(state);
}

function canRotate(state, player) {
    for (const v of state.variants) if (v.canRotate && v.canRotate(state, player) === false) return false;
    return true;
}

/* =========================================================================
     UI  (everything below reads/writes the state object above via plain
     function calls — swap this for React/canvas/etc. later without touching
     the engine)
     ========================================================================= */

let state = null;
let selectedTileIndex = null;
let selectedRotation = 0;
let bonusRotationSteps = 0;
let peer = null;
let hostConnection = null;
let clientConnections = [];
let isHost = false;
let localPlayerId = 'p0';
let snapshotVersion = 0;

const svg = document.getElementById('board');
const CELL = 64;
const BOARD_FRAME = 24;
const DEAD_TOKEN_OFFSET = 8;

function getVariantsFromUI() {
    const variants = [];
    if (document.getElementById('vWrap').checked) variants.push(TorusWrapVariant);
    if (document.getElementById('vRotatePass').checked) variants.push(RotateOnPassThroughVariant);
    return variants;
}

function startNewGame() {
    const size = clamp(parseInt(document.getElementById('boardSize').value) || 6, 4, 12);
    const numPlayers = clamp(parseInt(document.getElementById('numPlayers').value) || 2, 2, 8);
    state = newGame({ size, numPlayers, variants:getVariantsFromUI() });
    localPlayerId = 'p0';
    selectedTileIndex = null;
    selectedRotation = 0;
    bonusRotationSteps = 0;
    render();
    broadcastState();
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function currentPlayer() { return state.players[state.currentPlayerIndex]; }

function setNetworkStatus(message) {
    document.getElementById('networkStatus').textContent = message;
}

function tileDefinition(id) {
    return TILE_DEFS.find(tile => tile.id === id) || null;
}

function variantIds() {
    return state.variants.map(variant => variant.name);
}

function variantsFromIds(ids) {
    const available = {
        'torus-wrap': TorusWrapVariant,
        'rotate-on-passthrough': RotateOnPassThroughVariant,
    };
    return ids.map(id => available[id]).filter(Boolean);
}

function serializeState() {
    const cells = [];
    for (const [key, cell] of state.board.cells) {
        const [x, y] = key.split(',').map(Number);
        cells.push({ x, y, paths: cell.paths, rotation: cell.rotation, tileId: cell.tileId });
    }
    return {
        version: snapshotVersion,
        board: { width: state.board.width, height: state.board.height, wrap: state.board.wrap, cells },
        players: state.players,
        npcs: state.npcs,
        hands: Object.fromEntries(Object.entries(state.hands).map(([id, hand]) => [id, hand.map(tile => tile.id)])),
        tileDrawPile: state.tileDrawPile.map(tile => tile.id),
        perimeter: state.perimeter,
        currentPlayerIndex: state.currentPlayerIndex,
        gameOver: state.gameOver,
        log: state.log,
        handSize: state.handSize,
        pendingBonusAction: state.pendingBonusAction,
        lastActingPlayerId: state.lastActingPlayerId,
        variants: variantIds(),
    };
}

function deserializeState(snapshot) {
    const board = createBoard(snapshot.board.width, snapshot.board.height, snapshot.board.wrap);
    for (const cell of snapshot.board.cells) board.setCell(cell.x, cell.y, {
        paths: cell.paths,
        rotation: cell.rotation,
        tileId: cell.tileId,
    });
    return {
        board,
        players: snapshot.players,
        npcs: snapshot.npcs,
        hands: Object.fromEntries(Object.entries(snapshot.hands).map(([id, hand]) => [id, hand.map(tileDefinition).filter(Boolean)])),
        tileDrawPile: snapshot.tileDrawPile.map(tileDefinition).filter(Boolean),
        perimeter: snapshot.perimeter,
        currentPlayerIndex: snapshot.currentPlayerIndex,
        gameOver: snapshot.gameOver,
        log: snapshot.log,
        handSize: snapshot.handSize,
        pendingBonusAction: snapshot.pendingBonusAction,
        lastActingPlayerId: snapshot.lastActingPlayerId,
        variants: variantsFromIds(snapshot.variants),
        activeResolution: null,
    };
}

function sendSnapshot(connection) {
    if (connection.open) connection.send({ type: 'state', state: serializeState() });
}

function broadcastState() {
    if (!isHost) return;
    snapshotVersion++;
    for (const entry of clientConnections) sendSnapshot(entry.connection);
    render();
}

function closePeer() {
    if (peer) peer.destroy();
    peer = null;
    hostConnection = null;
    clientConnections = [];
}

function startHosting() {
    if (typeof Peer === 'undefined') {
        setNetworkStatus('PeerJS could not load. Check your internet connection.');
        return;
    }
    closePeer();
    isHost = true;
    startNewGame();
    peer = new Peer();
    setNetworkStatus('Creating host code...');
    peer.on('open', id => {
        document.getElementById('hostCode').textContent = `Share this host code: ${id}`;
        setNetworkStatus('Hosting. Waiting for players.');
    });
    peer.on('connection', connection => {
        connection.on('data', message => handleHostMessage(connection, message));
        connection.on('close', () => {
            clientConnections = clientConnections.filter(entry => entry.connection !== connection);
            setNetworkStatus('Hosting. A player disconnected.');
        });
        connection.on('error', () => setNetworkStatus('A player connection failed.'));
    });
    peer.on('error', error => setNetworkStatus(`Network error: ${error.type || 'connection failed'}`));
}

function handleHostMessage(connection, message) {
    if (message.type === 'join') {
        if (clientConnections.some(entry => entry.connection === connection)) return;
        const taken = new Set(['p0', ...clientConnections.map(entry => entry.playerId)]);
        const player = state.players.find(candidate => !taken.has(candidate.id));
        if (!player) {
            connection.send({ type: 'error', message: 'This game is full.' });
            connection.close();
            return;
        }
        clientConnections.push({ connection, playerId: player.id });
        connection.playerId = player.id;
        connection.send({ type: 'assigned', playerId: player.id });
        sendSnapshot(connection);
        setNetworkStatus(`${clientConnections.length} friend${clientConnections.length === 1 ? '' : 's'} connected.`);
        return;
    }

    if (connection.playerId !== message.playerId) return;
    if (message.type === 'place') {
        const player = state.players.find(candidate => candidate.id === message.playerId);
        if (!player || currentPlayer().id !== player.id || !Number.isInteger(message.rotation) || message.rotation < 0 || message.rotation > 3) return;
        const hand = state.hands[player.id] || [];
        const handIndex = hand.findIndex(tile => tile.id === message.tileId);
        if (handIndex < 0) return;
        const tileDef = hand.splice(handIndex, 1)[0];
        const result = placeTile(state, tileDef, message.rotation, player.id);
        if (result.error) hand.splice(handIndex, 0, tileDef);
        else broadcastState();
        return;
    }

    if (message.type === 'bonus' && state.pendingBonusAction && currentPlayer().id === message.playerId) {
        const { x, y } = state.pendingBonusAction.cell;
        if (message.action === 'rotate' && Number.isInteger(message.steps) && message.steps >= 0 && message.steps <= 3) {
            resolveBonusRotate(state, x, y, message.steps);
        } else if (message.action === 'skip') {
            skipBonus(state);
        } else return;
        broadcastState();
    }
}

function joinGame() {
    const hostId = document.getElementById('joinId').value.trim();
    if (!hostId || typeof Peer === 'undefined') {
        setNetworkStatus(!hostId ? 'Enter a host code first.' : 'PeerJS could not load.');
        return;
    }
    closePeer();
    isHost = false;
    peer = new Peer();
    setNetworkStatus('Connecting to host...');
    peer.on('open', () => {
        hostConnection = peer.connect(hostId);
        hostConnection.on('open', () => {
            hostConnection.send({ type: 'join' });
            setNetworkStatus('Connected. Waiting for the host state.');
        });
        hostConnection.on('data', message => {
            if (message.type === 'assigned') {
                localPlayerId = message.playerId;
            } else if (message.type === 'state' && message.state.version >= snapshotVersion) {
                snapshotVersion = message.state.version;
                state = deserializeState(message.state);
                selectedTileIndex = null;
                selectedRotation = 0;
                bonusRotationSteps = 0;
                setNetworkStatus('Connected to host.');
                render();
            } else if (message.type === 'error') {
                setNetworkStatus(message.message);
            }
        });
        hostConnection.on('close', () => setNetworkStatus('Host disconnected.'));
        hostConnection.on('error', () => setNetworkStatus('Could not connect to host.'));
    });
    peer.on('error', error => setNetworkStatus(`Network error: ${error.type || 'connection failed'}`));
}

function sendAction(message) {
    if (hostConnection?.open) hostConnection.send(message);
}

function render() {
    renderBoard();
    renderHand();
    renderBonus();
    renderPlayers();
    renderLog();
    renderTurnBanner();
}

function renderTurnBanner() {
    const el = document.getElementById('turnBanner');
    if (state.gameOver) { el.textContent = state.log[state.log.length-1] || 'Game over'; return; }
    const p = currentPlayer();
    const suffix = state.pendingBonusAction ? ' — choose a tile to rotate' : '';
    el.innerHTML = `<span style="color:${p.color}">●</span> ${p.name}'s turn${suffix}`;
}

function renderPlayers() {
    const el = document.getElementById('players');
    el.innerHTML = '';
    for (const p of state.players) {
        const row = document.createElement('div');
        const isActive = p.id === currentPlayer()?.id && !state.gameOver;
        const isYou = p.id === localPlayerId;
        row.className = 'playerRow' + (p.alive ? '' : ' dead') + (isActive ? ' active' : '') + (isYou ? ' you' : '');
        row.innerHTML = `<span class="swatch" style="background:${p.color}"></span><span class="playerName">${p.name}</span>${isYou ? '<span class="playerBadge">you</span>' : ''}`;
        el.appendChild(row);
    }
    for (const n of state.npcs) {
        const row = document.createElement('div');
        row.className = 'playerRow' + (n.alive? '' : ' dead');
        row.innerHTML = `<span class="swatch" style="background:${n.color}"></span>${n.name} (NPC)`;
        el.appendChild(row);
    }
}

function renderLog() {
    const el = document.getElementById('log');
    el.innerHTML = '';
    for (const line of state.log.slice(-30)) {
        const d = document.createElement('div');
        d.textContent = line;
        el.appendChild(d);
    }
}

function tileSvgMarkup(paths, size) {
    const pts = POINT_COORD.map(c => ({ x: c.x * size, y: c.y * size }));
    let s = `<rect x="0" y="0" width="${size}" height="${size}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
    for (const [a, b] of paths) {
        const pa = pts[a], pb = pts[b];
        const cx = size/2, cy = size/2;
        s += `<path d="M ${pa.x} ${pa.y} Q ${cx} ${cy} ${pb.x} ${pb.y}" stroke="#7fb8ff" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    return s;
}

function renderHand() {
    const handEl = document.getElementById('hand');
    handEl.innerHTML = '';
    const p = state.players.find(player => player.id === localPlayerId) || currentPlayer();
    const hand = state.hands[p.id] || [];
    hand.forEach((tileDef, i) => {
        const rotation = (i === selectedTileIndex) ? selectedRotation : 0;
        const paths = rotateTilePaths(tileDef.paths, rotation);
        const btn = document.createElement('div');
        btn.className = 'tileBtn' + (i === selectedTileIndex ? ' selected' : '');
        btn.innerHTML = `<svg width="48" height="48" viewBox="0 0 48 48">${tileSvgMarkup(paths, 48)}</svg>`;
        btn.onclick = () => { selectedTileIndex = i; selectedRotation = 0; render(); };
        handEl.appendChild(btn);
    });
    const pending = !!state.pendingBonusAction;
    const busy = pending || !!state.activeResolution;
    const myTurn = isHost || p.id === localPlayerId ? currentPlayer().id === localPlayerId : false;
    document.getElementById('rotateBtn').disabled = busy || !myTurn || selectedTileIndex === null || !canRotate(state, p);
    document.getElementById('placeBtn').disabled = busy || !myTurn || selectedTileIndex === null || state.gameOver;
}

function renderBonus() {
    const card = document.getElementById('bonusCard');
    const pending = state.pendingBonusAction;
    card.style.display = pending ? 'block' : 'none';
    if (!pending) return;

    const { x, y } = pending.cell;
    const cell = state.board.getCell(x, y);
    const paths = rotateTilePaths(cell.paths, bonusRotationSteps);
    const el = document.getElementById('bonusTiles');
    el.innerHTML = `<div class="tileBtn selected">
            <svg width="48" height="48" viewBox="0 0 48 48">${tileSvgMarkup(paths, 48)}</svg>
            <div style="font-size:10px;color:var(--muted);text-align:center;">(${x},${y})</div>
        </div>`;
}

function renderBoard() {
    const w = state.board.width, h = state.board.height;
    const boardWidth = w * CELL;
    const boardHeight = h * CELL;
    const svgWidth = boardWidth + BOARD_FRAME * 2;
    const svgHeight = boardHeight + BOARD_FRAME * 2;
    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    let s = '';

    const target = state.gameOver ? null : frontierOf(state, currentPlayer());

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const cell = state.board.getCell(x, y);
            const isCurrentTarget = target && x === target.x && y === target.y && !cell;
            s += `<g transform="translate(${BOARD_FRAME + x * CELL},${BOARD_FRAME + y * CELL})">`;
            s += `<rect width="${CELL}" height="${CELL}" fill="${isCurrentTarget ? '#22314a' : '#1a1e26'}" stroke="var(--line)" stroke-width="1"/>`;
            if (cell) s += tileSvgMarkup(cell.paths, CELL);
            s += `</g>`;
        }
    }

    s += `<path d="M 0 0 H ${svgWidth} V ${svgHeight} H 0 Z M ${BOARD_FRAME} ${BOARD_FRAME} H ${BOARD_FRAME + boardWidth} V ${BOARD_FRAME + boardHeight} H ${BOARD_FRAME} Z" fill="#3a4150" fill-rule="evenodd"/>`;

    // A token's stored (x,y,point) is always the tile it's anchored to and
    // the point it entered that tile at — so its drawn position is always
    // that tile's LIVE exit point for that entry, recomputed from the tile's
    // current (possibly since-rotated) paths. Rotate the tile it's standing
    // on, and the token visibly rides along with it.
    const inProgress = state.activeResolution?.current;
    const allTokens = [...state.players, ...state.npcs];
    for (const t of allTokens) {
        const live = t.alive
            ? ((inProgress && inProgress.token === t) ? inProgress : t)
            : t.deathPosition;
        if (!live) continue;
        const cell = state.board.getCell(live.x, live.y);
        const point = !t.alive || !cell ? live.point : tileExit(cell.paths, live.point);
        const coord = POINT_COORD[point];
        const side = Math.floor(point / 2);
        const outwardX = side === 1 ? DEAD_TOKEN_OFFSET : side === 3 ? -DEAD_TOKEN_OFFSET : 0;
        const outwardY = side === 2 ? DEAD_TOKEN_OFFSET : side === 0 ? -DEAD_TOKEN_OFFSET : 0;
        const px = BOARD_FRAME + live.x * CELL + coord.x * CELL + (!t.alive ? outwardX : 0);
        const py = BOARD_FRAME + live.y * CELL + coord.y * CELL + (!t.alive ? outwardY : 0);
        s += `<circle cx="${px}" cy="${py}" r="7" fill="${t.color}" stroke="#0a0d12" stroke-width="1.5"/>`;
    }

    svg.innerHTML = s;
}

document.getElementById('newGameBtn').onclick = () => {
    if (hostConnection && !isHost) {
        setNetworkStatus('Only the host can start a new game.');
        return;
    }
    startNewGame();
};
document.getElementById('hostBtn').onclick = startHosting;
document.getElementById('joinBtn').onclick = joinGame;
document.getElementById('rotateBtn').onclick = () => {
    if (selectedTileIndex === null) return;
    selectedRotation = (selectedRotation + 1) % 4;
    render();
};
document.getElementById('placeBtn').onclick = () => {
    if (selectedTileIndex === null || state.gameOver) return;
    const p = state.players.find(player => player.id === localPlayerId) || currentPlayer();
    const hand = state.hands[p.id];
    const tileDef = hand[selectedTileIndex];
    if (!tileDef || currentPlayer().id !== localPlayerId) return;
    if (hostConnection && !isHost) {
        sendAction({ type: 'place', playerId: localPlayerId, tileId: tileDef.id, rotation: selectedRotation });
        return;
    }
    hand.splice(selectedTileIndex, 1);
    const result = placeTile(state, tileDef, selectedRotation, p.id);
    if (result.error) {
        hand.splice(selectedTileIndex, 0, tileDef);
        alert(result.error);
        return;
    }
    selectedTileIndex = null; selectedRotation = 0;
    render();
    broadcastState();
};
window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') document.getElementById('rotateBtn').click();
});

document.getElementById('bonusRotateBtn').onclick = () => {
    bonusRotationSteps = (bonusRotationSteps + 1) % 4;
    render();
};
document.getElementById('bonusConfirmBtn').onclick = () => {
    if (hostConnection && !isHost) {
        sendAction({ type: 'bonus', playerId: localPlayerId, action: 'rotate', steps: bonusRotationSteps });
        return;
    }
    const { x, y } = state.pendingBonusAction.cell;
    resolveBonusRotate(state, x, y, bonusRotationSteps);
    bonusRotationSteps = 0;
    render();
};
document.getElementById('bonusSkipBtn').onclick = () => {
    if (hostConnection && !isHost) {
        sendAction({ type: 'bonus', playerId: localPlayerId, action: 'skip' });
        return;
    }
    skipBonus(state);
    bonusRotationSteps = 0;
    render();
};

startNewGame();