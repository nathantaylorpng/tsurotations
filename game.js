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
const TILE_SIZE = 48; // px

/**
 * Returns the side index opposite the given side on a square board.
 *
 * @param {number} s - The side index to invert, in the range 0-3.
 * @returns {number} The opposing side index.
 */
function oppositeSide(s) { return (s + 2) % 4; }

// Point layout within a unit cell, clockwise starting top-left.
// 0,1 = N (left,right) | 2,3 = E (top,bottom) | 4,5 = S (right,left) | 6,7 = W (bottom,top)
const POINT_COORD = [
    { x: 1/3, y: 0 }, { x: 2/3, y: 0 },   // 0,1  N
    { x: 1, y: 1/3 }, { x: 1, y: 2/3 },   // 2,3  E
    { x: 2/3, y: 1 }, { x: 1/3, y: 1 },   // 4,5  S
     {x: 0, y: 2/3 }, { x: 0, y: 1/3 },   // 6,7  W
];

/**
 * Creates a board model that tracks cell contents, bounds, and wrapped neighbor lookup.
 *
 * @param {number} width - Number of columns in the board.
 * @param {number} height - Number of rows in the board.
 * @param {boolean} wrap - Whether edge positions should wrap to the opposite side.
 * @returns {{width:number, height:number, wrap:boolean, cells:Map, key:function, wrapCoord:function, inBounds:function, neighbor:function, getCell:function, setCell:function}} A board object with geometry helpers and cell storage.
 */
function createBoard(width, height, wrap) {
    return {
        width, height, wrap,
        cells:  new Map(),
        
                /**
                 * Builds a board-local key for a cell coordinate.
                 *
                 * @param {number} x - Cell column.
                 * @param {number} y - Cell row.
                 * @returns {string} A serialized coordinate string.
                 */
                key(x, y) { return x + ',' + y; },

                /**
                 * Wraps an out-of-range coordinate back into the board if wrapping is enabled.
                 *
                 * @param {number} x - X coordinate to normalize.
                 * @param {number} y - Y coordinate to normalize.
                 * @returns {{x:number, y:number}} The wrapped coordinate.
                 */
                wrapCoord(x, y) {
                    if (!wrap) return { x, y };
                    return { x: ((x % width) + width) % width, y: ((y % height) + height) % height};
                },

                /**
                 * Reports whether a coordinate is inside the board bounds.
                 *
                 * @param {number} x - X coordinate to check.
                 * @param {number} y - Y coordinate to check.
                 * @returns {boolean} True when the position is on the board.
                 */
                inBounds(x, y) {
                    if (wrap) return true;
                    return x >= 0 && x < width && y >= 0 && y < height;
                },

                /**
                 * Finds the adjacent cell across the given side, including wrapped edges.
                 *
                 * @param {number} x - Current cell column.
                 * @param {number} y - Current cell row.
                 * @param {number} side - Side index to step through.
                 * @returns {{x:number, y:number, side:number}|null} Neighbor info or null when the move leaves the board.
                 */
                neighbor(x, y, side) {
                    let dx = 0, dy = 0;
                    if (side === 0) dy = -1; else if (side === 1) dx = 1; else if (side === 2) dy = 1; else dx = -1;
                    let neighborX = x + dx, neighborY = y + dy;
                    if (!wrap && (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height)) return null; // falls off the edge
                    const w = this.wrapCoord(neighborX, neighborY);
                    return { x: w.x, y :w.y, side: oppositeSide(side) };
                },

                /**
                 * Fetches the tile data stored at a coordinate, if any.
                 *
                 * @param {number} x - Cell column.
                 * @param {number} y - Cell row.
                 * @returns {object|null} The cell payload or null when empty.
                 */
                getCell(x, y) { return this.cells.get(this.key(x, y)) || null; },

                /**
                 * Saves tile data for a coordinate.
                 *
                 * @param {number} x - Cell column.
                 * @param {number} y - Cell row.
                 * @param {object} data - Tile data to store in the cell.
                 */
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

/**
 * Rotates a tile's path pairs by a quarter-turn count.
 *
 * @param {number[][]} paths - Tile path pairs expressed as point indices.
 * @param {number} steps - Number of 90-degree rotations to apply.
 * @returns {number[][]} The rotated path pairs.
 */
function rotateTilePaths(paths, steps) {
    const shift = (2 * steps) % 8; // one 90 deg rotation = shift by 2 points
    return paths.map(([a, b]) => [(a + shift) % 8, (b + shift) % 8]);
}

/**
 * Finds the opposite point on a tile when a token enters at the supplied point.
 *
 * @param {number[][]} paths - Tile path pairs.
 * @param {number} entryPoint - The point index used to enter the tile.
 * @returns {number} The point index the path exits through.
 * @throws {Error} Throws when the entry point is not part of the tile.
 */
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
         onTileCrossed(state, token, cell)  - fires only when a token is about to leave `cell` for a NEXT cell that
                                              already has a tile (i.e. the token is genuinely departing `cell` for
                                              good this turn); set state.pendingBonusAction to pause the resolver
                                              until the UI resolves it
         onAfterResolve(state)              - run once, after everything for this turn (all tokens, all crossings) is done
         onEliminate(state, token)          - react to an elimination
     ========================================================================= */

const TorusWrapVariant = {
    name: 'torus-wrap',
    /**
     * Enables wrapped board edges for this variant.
     *
     * @param {{wrap:boolean}} config - Mutable board configuration object.
     */
    modifyBoardConfig(config) { config.wrap = true; }
};

const NpcWandererVariant = {
    name: 'npc-wanderer',
    /**
     * Spawns a single NPC token near the midpoint of the perimeter.
     *
     * @param {object} state - Active game state.
     */
    setup(state) {
        // Drop one NPC token roughly in the middle of the perimeter list.
        const spot = state.perimeter[Math.floor(state.perimeter.length / 2)];
        state.npcs.push({
            id: 'npc-1', name: 'Wanderer', isNPC: true, alive: true, color: '#9aa4b6',
            x: spot.outsideX, y: spot.outsideY, point: spot.point ?? (spot.side * 2 + 1),
            entryX: spot.x, entryY: spot.y, startIndex: Math.floor(state.perimeter.length / 2),
        });
    }
};

const RotateOnPassThroughVariant = {
    name: 'rotate-on-passthrough',
    /**
     * Pauses resolution when the acting token crosses a tile and offers a bonus rotation choice.
     *
     * @param {object} state - Active game state.
     * @param {object} token - Token that crossed the cell boundary.
     * @param {{x:number, y:number}} cell - Cell that the token is leaving.
     */
    onTileCrossed(state, token, cell) {
        if (token.id !== state.lastActingPlayerId) return; // only the human mover gets the choice
        const resolution = state.activeResolution;
        const cellKey = cell.x + ',' + cell.y;
        const crossedCells = resolution?.crossedCells.get(token.id);
        const start = resolution?.startAnchors.get(token.id);
        const isStartingCell = start && start.x === cell.x && start.y === cell.y;
        // Leaving the cell the token started this resolution on normally
        // doesn't count as an "enter and exit" — they were already
        // standing there from a previous turn, they didn't just arrive.
        // Exception: if this cell is the one that got placed by this very
        // turn's move, the token entered it for the first time ever just
        // now (e.g. stepping onto the board off the perimeter), so leaving
        // it immediately is a genuine enter-then-exit.
        const newlyPlaced = resolution?.newlyPlacedCell;
        const isFreshlyEntered = newlyPlaced && newlyPlaced.x === cell.x && newlyPlaced.y === cell.y;
        if (isStartingCell && !isFreshlyEntered && !crossedCells.has(cellKey)) return;
        state.pendingBonusAction = { type: 'rotate-passthrough', cell, playerId: state.lastActingPlayerId };
    }
};

/* =========================================================================
     GAME STATE / TURN LOGIC
     ========================================================================= */

const PLAYER_COLORS = ['#ff6b6b','#5fd48a','#5fb4ff','#ffd166','#c792ea','#f78fb3','#4dd0e1','#e0a458'];

/**
 * Builds the ordered list of perimeter slots around the board.
 *
 * Each exterior cell contributes the two possible entry points along that side,
 * matching the two positions on each tile edge.
 *
 * @param {number} width - Board width.
 * @param {number} height - Board height.
 * @returns {{x:number, y:number, side:number, point:number}[]} Perimeter starting spots.
 */
function buildPerimeter(width, height) {
    const perim = [];
    for (let x = 0; x < width; x++) {
        perim.push({ x, y: 0, outsideX: x, outsideY: -1, side: 0, point: 0 });
        perim.push({ x, y: 0, outsideX: x, outsideY: -1, side: 0, point: 1 });
    }
    for (let y = 0; y < height; y++) {
        perim.push({ x: width - 1, y, outsideX: width, outsideY: y, side: 1, point: 2 });
        perim.push({ x: width - 1, y, outsideX: width, outsideY: y, side: 1, point: 3 });
    }
    for (let x = width - 1; x >= 0; x--) {
        perim.push({ x, y: height - 1, outsideX: x, outsideY: height, side: 2, point: 4 });
        perim.push({ x, y: height - 1, outsideX: x, outsideY: height, side: 2, point: 5 });
    }
    for (let y = height - 1; y >= 0; y--) {
        perim.push({ x: 0, y, outsideX: -1, outsideY: y, side: 3, point: 6 });
        perim.push({ x: 0, y, outsideX: -1, outsideY: y, side: 3, point: 7 });
    }
    return perim;
}

/**
 * Initializes a fresh game state with a chosen board mode and player set.
 *
 * @param {{size:number, numPlayers:number, variants:object[]}} opts - Configuration for the game.
 * @returns {object} The newly created state object.
 */
function newGame(opts) {
    const { size, numPlayers, variants } = opts;
    const boardConfig = { wrap: false };
    for (const v of variants) v.modifyBoardConfig?.(boardConfig);

    const board = createBoard(size, size, boardConfig.wrap);
    const perimeter = buildPerimeter(size, size);
    //const step = Math.floor(perimeter.length / numPlayers);

    const players = [];
    for (let i = 0; i < numPlayers; i++) {
        // Starting positions are chosen by players during setup; initially unset.
        players.push({
            id: 'p' + i, name: 'Player ' + (i + 1), color: PLAYER_COLORS[i % PLAYER_COLORS.length],
            alive: true, x: null, y: null, point: null, entryX: null, entryY: null, startIndex: null,
        });
    }

    const state = {
        tileDrawPile: [...TILE_DEFS],
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
        activeResolution: null, // in-progress step-by-step movement (see startResolution)
        selectingStartingPositions: true, // start of game, let players pick starting positions
        setupPickIndex: 0,
    };
    
    shuffleArray(state.tileDrawPile);
    for (const v of variants) v.setup?.(state);
    for (const p of players) drawHand(state, p.id);

    return state;
}

/**
 * Randomizes an array in place using Fisher-Yates.
 *
 * @param {any[]} array - Array to shuffle.
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Draws tiles into the specified player's hand until the hand is full or the pile is empty.
 *
 * @param {object} state - Current game state.
 * @param {string} playerId - Player identifier to receive tiles.
 */
function drawHand(state, playerId) {
    if (!state.hands.hasOwnProperty(playerId)) state.hands[playerId] = [];
    const numToDraw = state.handSize - state.hands[playerId].length;
    for (let i = 0; i < numToDraw && state.tileDrawPile.length > 0; i++) {
        state.hands[playerId].push(state.tileDrawPile.pop());
    }
}

/**
 * Appends a message to the state log.
 *
 * @param {object} state - Current game state.
 * @param {string} msg - Message to log.
 */
function log(state, msg) { state.log.push(msg); }

/**
 * Applies a movement outcome to a token and triggers relevant elimination hooks.
 *
 * @param {object} state - Current game state.
 * @param {object} token - Token whose result is being applied.
 * @param {{status:string, x?:number, y?:number, point?:number}} result - Movement result metadata.
 */
function applyResult(state, token, result) {
    if (result.status === 'waiting') { // || result.status === 'looped') {
        token.x = result.x; token.y = result.y; token.point = result.point;
        //if (result.status === 'looped') log(state, `${token.name} looped back on itself and holds position.`);
    } else if (result.status === 'eliminated') {
        token.x = result.x; token.y = result.y; token.point = result.point;
        token.deathPosition = { x: result.x, y: result.y, point: result.point };
        token.alive = false;
        log(state, `${token.name} fell off the edge and is eliminated.`);
        for (const v of state.variants) v.onEliminate?.(state, token);
    }
}

/**
 * Advances the turn to the next living player after a fully resolved action.
 *
 * @param {object} state - Current game state.
 */
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

/**
 * Determines the next frontier cell for a token based on the tile it is anchored on.
 *
 * @param {object} state - Current game state.
 * @param {object} token - Token whose frontier is being computed.
 * @returns {{x:number, y:number, side:number}|null} Coordinates for the next destination or null if the token has not yet started.
 */
// Given a token's current anchor (the tile it's standing on, and the point
// it entered that tile at), works out which cell needs the next tile.
// Recomputed live every time it's needed — if the anchor tile gets rotated
// (by anyone, at any point), the frontier this token is heading toward can
// shift right along with it. For a token that hasn't entered any tile yet
// (fresh spawn), the "frontier" is just its own spawn cell.
function frontierOf(state, token) {
    // If a player hasn't picked a starting position yet, there's no frontier.
    if (token.x === null || token.x === undefined) return null;
    const cell = state.board.getCell(token.x, token.y);
    if (!cell) {
        if (token.entryX === null || token.entryX === undefined) return null;
        return { x: token.entryX, y: token.entryY };
    }
    const exitPoint = tileExit(cell.paths, token.point);
    const side = Math.floor(exitPoint / 2);
    let nb = getNeighboringCell(state, token, cell);
    return nb; // null only if this token should already have fallen off — shouldn't happen for a token that's alive and waiting
}

/**
 * Places a chosen tile for the given player and begins resolution for any affected tokens.
 *
 * @param {object} state - Current game state.
 * @param {object} tileDef - Tile definition to place.
 * @param {number} rotation - Rotation steps to apply to the tile before placement.
 * @param {string} playerId - Player placing the tile.
 * @param {function} [onStep] - Optional callback fired after every incremental
 *   change during resolution (each tile crossing, each token settling), so a
 *   caller can broadcast/re-render as the chain unfolds instead of only once
 *   at the very end.
 * @returns {{ok?:boolean, error?:string}} Result of placement attempt.
 */
function placeTile(state, tileDef, rotation, playerId, onStep) {
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

    // Snapshot which tokens are actually converging on `target` BEFORE the
    // tile goes down. frontierOf() re-derives a token's frontier from the
    // tile it's currently anchored on, so placing the new tile at `target`
    // doesn't change any anchor tile — EXCEPT for a token with no tile
    // under it yet (fresh off the perimeter), where `target` IS its own
    // (x,y). Computing this after setCell would recompute that token's
    // frontier through the tile we just placed, skipping right past
    // `target` and never matching it, so resolution silently never starts
    // for a player's very first placement. Must run before setCell.
    const tokensHere = [...state.players, ...state.npcs].filter(t => {
        if (!t.alive) return false;
        const f = frontierOf(state, t);
        return f && f.x === target.x && f.y === target.y;
    });

    // The active mover's own token always resolves first, and to completion
    // (advanceResolution already walks a single token through its entire
    // chained path — across as many already-placed tiles as it crosses —
    // before popping the next token off the queue). Everyone else just
    // follows in whatever order they were collected in.
    tokensHere.sort((a, b) => (a.id === playerId ? -1 : 0) - (b.id === playerId ? -1 : 0));

    const paths = rotateTilePaths(tileDef.paths, rotation);
    state.board.setCell(target.x, target.y, { paths, rotation, tileId: tileDef.id });
    log(state, `${player.name} placed tile ${tileDef.id} at (${target.x},${target.y}).`);

    state.lastActingPlayerId = playerId;

    startResolution(state, tokensHere, onStep, { x: target.x, y: target.y }); // may finish the turn outright, or pause on a variant's pendingBonusAction
    return { ok: true };
}

function getNeighboringCell(state, position, cell) {
    const exitPoint = tileExit(cell.paths, position.point);
    const side = Math.floor(exitPoint / 2);
    let nb = state.board.neighbor(position.x, position.y, side);
    for (const v of state.variants) if (v.getNeighbor) {
        const override = v.getNeighbor(state.board, position.x, position.y, side);
        if (override !== undefined) nb = override;
    }
    return nb;
}

// --- Step-by-step movement resolver -----------------------------------
// A token's tracked position (cur.x, cur.y, cur.point) is always a tile it
// is genuinely standing on. Each iteration looks ahead one tile: if the
// next cell already has a tile too, the token truly leaves the current one
// behind (this is the only moment onTileCrossed fires — a variant can
// pause here). If the next cell is still empty, the token simply stays
// anchored right where it already is; nothing "moves into the void."
/**
 * Starts the movement resolver for a list of tokens that were newly affected by a tile placement.
 *
 * @param {object} state - Current game state.
 * @param {object[]} tokens - Tokens to resolve in order.
 * @param {function} [onStep] - Optional per-step callback, kept alive on the
 *   resolution object itself so it still fires after a bonus-action pause
 *   resumes resolution from a later, separate call.
 * @param {{x:number, y:number}} [newlyPlacedCell] - The single cell that was
 *   actually placed by this turn's placeTile call (as opposed to every other
 *   cell in a token's chain, which necessarily already existed). Lets a
 *   variant tell "token is leaving the tile it just now entered" apart from
 *   "token is leaving a tile it had already been sitting on since a
 *   previous turn."
 */
function startResolution(state, tokens, onStep, newlyPlacedCell) {
    state.activeResolution = {
        remaining: tokens.slice(), current: null,
        startAnchors: new Map(tokens.map(token => [token.id, { x: token.x, y: token.y }])),
        crossedCells: new Map(tokens.map(token => [token.id, new Set()])),
        newlyPlacedCell,
        onStep,
    };
    advanceResolution(state);
}

/**
 * Advances the current step-by-step movement resolution until the next item or turn boundary.
 *
 * @param {object} state - Current game state.
 */
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
            const entryCell = !state.board.inBounds(cur.x, cur.y)
                && cur.token.entryX !== null && cur.token.entryX !== undefined
                ? { x: cur.token.entryX, y: cur.token.entryY }
                : null;
            if (entryCell && state.board.getCell(entryCell.x, entryCell.y)) {
                cur.x = entryCell.x;
                cur.y = entryCell.y;
                res.onStep?.();
                continue;
            }
            applyResult(state, cur.token, { status: 'waiting', x: cur.x, y: cur.y, point: cur.point });
            res.current = null;
            res.onStep?.();
            continue;
        }

        const vkey = cur.x + ',' + cur.y + ',' + cur.point;
        // if (cur.visited.has(vkey)) {
        //     applyResult(state, cur.token, { status: 'looped', x: cur.x, y: cur.y, point: cur.point });
        //     res.current = null;
        //     res.onStep?.();
        //     continue;
        // }
        cur.visited.add(vkey);

        const exitPoint = tileExit(cell.paths, cur.point);
        const p = exitPoint % 2;
        let nb = getNeighboringCell(state, cur, cell);

        // No neighboring tile means the token is dead
        if (!nb) {
            applyResult(state, cur.token, {
                status: 'eliminated', x: cur.x, y: cur.y, point: exitPoint,
            });
            res.current = null;
            res.onStep?.();
            continue;
        }

        const nextCell = state.board.getCell(nb.x, nb.y);
        if (!nextCell) {
            // Nowhere to go yet — stay anchored right here, still on this tile.
            applyResult(state, cur.token, { status: 'waiting', x: cur.x, y: cur.y, point: cur.point });
            res.current = null;
            res.onStep?.();
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
        if (state.pendingBonusAction) {
            cur.token.x = cur.x;
            cur.token.y = cur.y;
            cur.token.point = cur.point;
            res.onStep?.();
            return; // pause — UI shows the bonus panel, resumes us later
        }
        res.onStep?.(); // token has genuinely moved to a new tile — broadcast this step before looking ahead further
    }
}

/**
 * Completes the current turn by refilling the acting player's hand and advancing play.
 *
 * @param {object} state - Current game state.
 */
function completeTurn(state) {
    const playerId = state.lastActingPlayerId;
    drawHand(state, playerId);
    state.pendingBonusAction = null;
    advanceTurn(state);
}

/**
 * Resolves a bonus rotation that a rule variant requested after a token crossed a tile.
 *
 * @param {object} state - Current game state.
 * @param {number} x - X coordinate of the tile to rotate.
 * @param {number} y - Y coordinate of the tile to rotate.
 * @param {number} rotationSteps - Number of quarter-turns to apply.
 */
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

/**
 * Rotates a placed board cell and repositions any tokens anchored on it.
 *
 * @param {object} state - Current game state.
 * @param {number} x - X coordinate of the tile.
 * @param {number} y - Y coordinate of the tile.
 * @param {number} rotationSteps - Number of quarter-turns to apply.
 */
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
            let nb = getNeighboringCell(state, token, cell);
            const exitPoint = tileExit(cell.paths, token.point);
            if (!nb) applyResult(state, token, { status: 'eliminated', x: token.x, y: token.y, point: exitPoint });
        }
    }

    const current = state.activeResolution?.current;
    if (current && current.x === x && current.y === y) {
        current.point = (current.point + shift) % TOTAL_POINTS;
    }
}

/**
 * Skips a pending bonus rotation and continues movement resolution.
 *
 * @param {object} state - Current game state.
 */
function skipBonus(state) {
    state.pendingBonusAction = null;
    advanceResolution(state);
}

/**
 * Evaluates whether the given player is allowed to rotate a tile under current variant rules.
 *
 * @param {object} state - Current game state.
 * @param {object} player - Player to check.
 * @returns {boolean} True when rotation is allowed.
 */
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

/**
 * Collects the active variant set from the HTML configuration checkboxes.
 *
 * @returns {object[]} Variant hook objects enabled in the UI.
 */
function getVariantsFromUI() {
    const variants = [];
    if (document.getElementById('vWrap').checked) variants.push(TorusWrapVariant);
    if (document.getElementById('vRotatePass').checked) variants.push(RotateOnPassThroughVariant);
    return variants;
}

/**
 * Starts a new local game from the current UI settings.
 */
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

/**
 * Constrains a number to a minimum and maximum range.
 *
 * @param {number} v - Number to clamp.
 * @param {number} lo - Lower bound.
 * @param {number} hi - Upper bound.
 * @returns {number} Value within the requested range.
 */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Returns the token representing the active turn owner.
 *
 * @returns {object} Current player.
 */
function currentPlayer() { return state.players[state.currentPlayerIndex]; }

/**
 * Updates the network status element in the UI.
 *
 * @param {string} message - Message to display.
 */
function setNetworkStatus(message) {
    document.getElementById('networkStatus').textContent = message;
}

/**
 * Looks up a tile definition from its canonical ID.
 *
 * @param {string} id - Tile identifier.
 * @returns {object|null} Matching tile definition or null if unknown.
 */
function tileDefinition(id) {
    return TILE_DEFS.find(tile => tile.id === id) || null;
}

/**
 * Serializes the active variant list to their names.
 *
 * @returns {string[]} Variant names in use.
 */
function variantIds() {
    return state.variants.map(variant => variant.name);
}

/**
 * Rehydrates the enabled variant hook objects from their saved IDs.
 *
 * @param {string[]} ids - Variant IDs from a snapshot.
 * @returns {object[]} Reconstructed variant objects.
 */
function variantsFromIds(ids) {
    const available = {
        'torus-wrap': TorusWrapVariant,
        'rotate-on-passthrough': RotateOnPassThroughVariant,
    };
    return ids.map(id => available[id]).filter(Boolean);
}

/**
 * Converts the current state into a serializable snapshot for networking.
 *
 * @returns {object} Serialized state payload.
 */
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
        selectingStartingPositions: state.selectingStartingPositions,
        setupPickIndex: state.setupPickIndex,
    };
}

/**
 * Restores a previously serialized game state.
 *
 * @param {object} snapshot - Serialized snapshot to load.
 * @returns {object} New state object created from the snapshot.
 */
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
        pendingBonusAction: snapshot.pendingBonusAction ? {
            ...snapshot.pendingBonusAction,
            playerId: snapshot.pendingBonusAction.playerId ?? snapshot.lastActingPlayerId ?? null,
        } : null,
        lastActingPlayerId: snapshot.lastActingPlayerId,
        variants: variantsFromIds(snapshot.variants),
        selectingStartingPositions: snapshot.selectingStartingPositions || false,
        setupPickIndex: snapshot.setupPickIndex || 0,
        activeResolution: null,
    };
}

/**
 * Sends the current game snapshot to a peer connection.
 *
 * @param {object} connection - Active peer connection.
 */
function sendSnapshot(connection) {
    if (connection.open) connection.send({ type: 'state', state: serializeState() });
}

/**
 * Broadcasts the serialized state to all connected clients.
 */
function broadcastState() {
    if (!isHost) return;
    snapshotVersion++;
    for (const entry of clientConnections) sendSnapshot(entry.connection);
    render();
}

/**
 * Tears down the current peer network session.
 */
function closePeer() {
    if (peer) peer.destroy();
    peer = null;
    hostConnection = null;
    clientConnections = [];
}

/**
 * Creates a host peer and sets up the initial game state for multiplayer.
 */
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

/**
 * Handles an incoming network message from a connected peer.
 *
 * @param {object} connection - Source peer connection.
 * @param {object} message - Incoming message payload.
 */
function handleHostMessage(connection, message) {

    // Handle a new player joining the game
    if (message.type === 'join') {

        // If the player has already joined, do nothing
        if (clientConnections.some(entry => entry.connection === connection)) return;

        // Find first player that is not already connected
        const taken = new Set(['p0', ...clientConnections.map(entry => entry.playerId)]);
        const player = state.players.find(candidate => !taken.has(candidate.id));
        if (!player) {
            connection.send({ type: 'error', message: 'This game is full.' });
            connection.close();
            return;
        }

        // Add new player to the client connections
        clientConnections.push({ connection, playerId: player.id });
        connection.playerId = player.id;
        connection.send({ type: 'assigned', playerId: player.id });
        sendSnapshot(connection);
        setNetworkStatus(`${clientConnections.length} friend${clientConnections.length === 1 ? '' : 's'} connected.`);
        return;
    }

    // Disregard message if player IDs don't match
    if (connection.playerId !== message.playerId) return;

    // Place a tile in front of the current player
    if (message.type === 'place') {

        // Get the player who sent the message
        const player = state.players.find(candidate => candidate.id === message.playerId);

        // Verify that the player trying to place a tile is the current player
        // and that the given rotation is valid (0-3)
        if (!player || currentPlayer().id !== player.id || !Number.isInteger(message.rotation) || message.rotation < 0 || message.rotation > 3) return;

        // Get the chosen tile from the player's hand
        const hand = state.hands[player.id] || [];
        const handIndex = hand.findIndex(tile => tile.id === message.tileId);
        if (handIndex < 0) return;
        const tileDef = hand.splice(handIndex, 1)[0];

        // Attempt to place the tile — stream every incremental resolution step to clients
        // as it happens, rather than only broadcasting once resolution fully settles.
        const result = placeTile(state, tileDef, message.rotation, player.id, broadcastState);

        // If an error occured, return the tile to the player's hand
        if (result.error) hand.splice(handIndex, 0, tileDef);
        else broadcastState();
    }

    // A client requests to pick a perimeter starting position during setup.
    else if (message.type === 'chooseStart') {

        // Abort if the game is not selecting starting positions
        if (!state || !state.selectingStartingPositions) return;

        // Get the perimeter index that was selected
        const perimIndex = message.perimIndex;
        if (!Number.isInteger(perimIndex) || perimIndex < 0 || perimIndex >= state.perimeter.length) return;

        // Get the current player
        const currentPick = state.setupPickIndex;
        if (currentPick >= state.players.length) return;
        const player = state.players[currentPick];

        // Verify that the current player is the one who picked this position
        if (!player || player.id !== message.playerId) return;

        // Get the chosen position
        const spot = state.perimeter[perimIndex];

        // Verify there isn't a player at that position already
        if (state.players.find(p => p.startIndex === perimIndex)) return;

        // Set the player's position
        player.x = spot.outsideX; player.y = spot.outsideY; player.point = spot.point;
        player.entryX = spot.x; player.entryY = spot.y; player.startIndex = perimIndex;

        // Increment the pick index to the next player
        state.setupPickIndex++;

        // If all players have chosen, setup for the normal game
        if (state.setupPickIndex >= state.players.length) {
            state.selectingStartingPositions = false;
            state.currentPlayerIndex = 0;
        }

        broadcastState();
    }

    else if (message.type === 'bonus') {
        const pendingPlayerId = state.pendingBonusAction?.playerId ?? state.lastActingPlayerId;
        if (!state.pendingBonusAction || pendingPlayerId !== message.playerId) return;
        const { x, y } = state.pendingBonusAction.cell;
        if (message.action === 'rotate' && Number.isInteger(message.steps) && message.steps >= 0 && message.steps <= 3) {
            resolveBonusRotate(state, x, y, message.steps);
        } else if (message.action === 'skip') {
            skipBonus(state);
        } else return;
        broadcastState();
    }
}

/**
 * Connects the client to a host with a provided room code.
 */
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

/**
 * Sends a network action to the host connection when available.
 *
 * @param {object} message - Action payload to dispatch.
 */
function sendAction(message) {
    if (hostConnection?.open) hostConnection.send(message);
}

/**
 * Re-renders the full game UI from the current state.
 */
function render() {
    renderBoard();
    renderHand();
    renderBonus();
    renderPlayers();
    renderLog();
    renderTurnBanner();
}

/**
 * Updates the visible turn banner to show whose turn it is.
 */
function renderTurnBanner() {
    const el = document.getElementById('turnBanner');
    if (state.gameOver) { el.textContent = state.log[state.log.length-1] || 'Game over'; return; }
    const p = currentPlayer();
    const suffix = state.pendingBonusAction && localPlayerCanSeeBonus() ? ' — choose a tile to rotate' : '';
    el.innerHTML = `<span style="color:${p.color}">●</span> ${p.name}'s turn${suffix}`;
}

/**
 * Renders the player list with current turn and local-player highlighting.
 */
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

/**
 * Displays the most recent game log messages.
 */
function renderLog() {
    const el = document.getElementById('log');
    el.innerHTML = '';
    for (const line of state.log.slice(-30)) {
        const d = document.createElement('div');
        d.textContent = line;
        el.appendChild(d);
    }
}

/**
 * Determines which type of curve a given path is
 * 
 * @param {number} a 
 * @param {number} b 
 * @returns {string} 'semicircle', 'flexible', 'quarter', 'straight', 'straightOffset'
 */
function classifyPair(a, b) {
  const side = i => Math.floor(i / 2);   // which edge (0-3)
  const pos  = i => i % 2;               // 1st or 2nd point on that edge
  const sa = side(a), sb = side(b);

  if (sa === sb) return 'semicircle';        // same edge

  const diff = Math.min(Math.abs(sa - sb), 4 - Math.abs(sa - sb));
  const samePos = pos(a) === pos(b);

  if (diff === 1) return samePos ? 'flexible' : 'quarter'; // adjacent edges
  return samePos ? 'straight' : 'straightOffset';           // opposite edges
}

/**
 * Serializes a tile's path lines into SVG markup.
 *
 * @param {number[][]} paths - Tile path pairs.
 * @param {number} size - Output size for the SVG.
 * @returns {string} SVG markup for the tile.
 */
function tileSvgMarkup(paths, size) {
  const pts = POINT_COORD.map(c => ({ x: c.x * size, y: c.y * size }));
  const cx = size / 2, cy = size / 2;
  let s = `<rect x="0" y="0" width="${size}" height="${size}" fill="#0c0c0c" stroke="var(--line)" stroke-width="1"/>`;

  for (const [a, b] of paths) {
    const pa = pts[a], pb = pts[b];
    const kind = classifyPair(a, b);
    let d;

    if (kind === 'straight' || kind === 'straightOffset') {
      d = `M ${pa.x} ${pa.y} L ${pb.x} ${pb.y}`;
    } else {
      const angleDeg = kind === 'semicircle' ? 180
                      : kind === 'quarter'    ? 80
                      : 100; // 'flexible' — tune this one to taste
      const theta = angleDeg * Math.PI / 180;

      const midX = (pa.x + pb.x) / 2, midY = (pa.y + pb.y) / 2;
      let dirX = cx - midX, dirY = cy - midY;
      const len = Math.hypot(dirX, dirY) || 1;
      dirX /= len; dirY /= len;

      const chordLen = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      const offset = chordLen * Math.tan(theta / 4);

      const ctrlX = midX + dirX * offset;
      const ctrlY = midY + dirY * offset;

      d = `M ${pa.x} ${pa.y} Q ${ctrlX} ${ctrlY} ${pb.x} ${pb.y}`;
    }

    s += `<path d="${d}" stroke="#7fb8ff" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
  return s;
}

/**
 * Draws the current player's hand and enables or disables placement controls.
 */
function localPlayerCanSeeBonus() {
    const pending = state.pendingBonusAction;
    if (!pending) return false;
    const networked = !!(isHost || hostConnection);
    if (!networked) return true;
    return pending.playerId === localPlayerId;
}

function renderHand() {
    const handEl = document.getElementById('hand');
    handEl.innerHTML = '';
    const networked = !!(isHost || hostConnection);
    const p = networked ? state.players.find(player => player.id === localPlayerId) : currentPlayer();
    const hand = state.hands[p.id] || [];
    hand.forEach((tileDef, i) => {
        const rotation = (i === selectedTileIndex) ? selectedRotation : 0;
        const paths = rotateTilePaths(tileDef.paths, rotation);
        const btn = document.createElement('div');
        btn.className = 'tileBtn' + (i === selectedTileIndex ? ' selected' : '');
        btn.innerHTML = `<svg width="${TILE_SIZE}" height="${TILE_SIZE}" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}">${tileSvgMarkup(paths, TILE_SIZE)}</svg>`;
        btn.onclick = () => { selectedTileIndex = i; selectedRotation = 0; render(); };
        handEl.appendChild(btn);
    });
    const pending = !!state.pendingBonusAction && localPlayerCanSeeBonus();
    const busy = pending || !!state.activeResolution;
    const selecting = !!state.selectingStartingPositions;
    let myTurn = true;
    if (networked) myTurn = currentPlayer().id === localPlayerId;
    
    // Disable tile actions while players are selecting starting positions
    document.getElementById('rotateBtnLeft').disabled = selecting || busy || !myTurn || selectedTileIndex === null || !canRotate(state, p);
    document.getElementById('rotateBtnRight').disabled = selecting || busy || !myTurn || selectedTileIndex === null || !canRotate(state, p);
    document.getElementById('placeBtn').disabled = selecting || busy || !myTurn || selectedTileIndex === null || state.gameOver;
}

/**
 * Renders the pending bonus-rotation choice card when a variant pauses resolution.
 */
function renderBonus() {
    const card = document.getElementById('bonusCard');
    const pending = state.pendingBonusAction;
    const visible = pending && localPlayerCanSeeBonus();
    card.style.display = visible ? 'block' : 'none';
    if (!visible) return;

    const { x, y } = pending.cell;
    const cell = state.board.getCell(x, y);
    const paths = rotateTilePaths(cell.paths, bonusRotationSteps);
    const el = document.getElementById('bonusTiles');
    el.innerHTML = `<div class="tileBtn selected">
            <svg width="${TILE_SIZE}" height="${TILE_SIZE}" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}">${tileSvgMarkup(paths, TILE_SIZE)}</svg>
            <div style="font-size:10px;color:var(--muted);text-align:center;">(${x},${y})</div>
        </div>`;
}

/**
 * Rebuilds the board SVG with tiles, targets, and tokens in their current positions.
 */
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

    // Render perimeter selection markers (outside the board) when selecting starting positions.
    if (state.selectingStartingPositions) {
        for (let i = 0; i < state.perimeter.length; i++) {
            const spot = state.perimeter[i]; // position on the perimeter
            const side = spot.side; // side of the cell (0, 1, 2, 3)
            const cx = BOARD_FRAME + spot.x * CELL + CELL / 2;
            const cy = BOARD_FRAME + spot.y * CELL + CELL / 2;
            let px = cx, py = cy;
            const gap = 12;
            const offset = 10;
            if (side === 0) {
                px = cx + (spot.point === 0 ? -offset : offset);
                py = BOARD_FRAME + spot.y * CELL - gap;
            } else if (side === 1) {
                px = BOARD_FRAME + spot.x * CELL + CELL + gap;
                py = cy + (spot.point === 2 ? -offset : offset);
            } else if (side === 2) {
                px = cx + (spot.point === 4 ? offset : -offset);
                py = BOARD_FRAME + spot.y * CELL + CELL + gap;
            } else if (side === 3) {
                px = BOARD_FRAME + spot.x * CELL - gap;
                py = cy + (spot.point === 6 ? offset : -offset);
            }

            const pickerId = state.players[state.setupPickIndex]?.id;
            const networked = !!(isHost || hostConnection);
            const canPick = !networked || pickerId === localPlayerId; // in local-only games, allow any local click; in networked games, only the assigned client may pick
            const occupant = state.players.find(p => p.startIndex === i);
            if (canPick && !occupant) {
                s += '<g class="perim"' + ' onclick="chooseStartingPosition(' + i + ')"' + '>';
                s += `<circle cx="${px}" cy="${py}" r="14" fill="transparent" pointer-events="all"/>`;
                s += `<circle cx="${px}" cy="${py}" r="8" fill="none" stroke="#9aa4b6" stroke-width="2"/>`;
                s += `</g>`;
            }
        }
    }

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
        if (live.x === null || live.x === undefined) continue; // not yet placed on the perimeter
        const cell = state.board.getCell(live.x, live.y);
        const point = !t.alive || !cell ? live.point : tileExit(cell.paths, live.point);
        const coord = POINT_COORD[point];
        const side = Math.floor(point / 2);
        if (t.alive && !cell && t.entryX !== null && t.entryX !== undefined) {
            const px = BOARD_FRAME + t.entryX * CELL + coord.x * CELL
                + (side === 1 ? DEAD_TOKEN_OFFSET : side === 3 ? -DEAD_TOKEN_OFFSET : 0);
            const py = BOARD_FRAME + t.entryY * CELL + coord.y * CELL
                + (side === 2 ? DEAD_TOKEN_OFFSET : side === 0 ? -DEAD_TOKEN_OFFSET : 0);
            s += `<circle cx="${px}" cy="${py}" r="7" fill="${t.color}" stroke="#0a0d12" stroke-width="1.5"/>`;
            continue;
        }
        const outwardX = side === 1 ? DEAD_TOKEN_OFFSET : side === 3 ? -DEAD_TOKEN_OFFSET : 0;
        const outwardY = side === 2 ? DEAD_TOKEN_OFFSET : side === 0 ? -DEAD_TOKEN_OFFSET : 0;
        // Keep living tokens just inside the cell rather than centered on its edge.
        const edgeInset = 4;
        const inwardX = side === 1 ? -edgeInset : side === 3 ? edgeInset : 0;
        const inwardY = side === 2 ? -edgeInset : side === 0 ? edgeInset : 0;
        const px = BOARD_FRAME + live.x * CELL + coord.x * CELL
            + (t.alive ? inwardX : outwardX);
        const py = BOARD_FRAME + live.y * CELL + coord.y * CELL
            + (t.alive ? inwardY : outwardY);
        s += `<circle cx="${px}" cy="${py}" r="7" fill="${t.color}" stroke="#0a0d12" stroke-width="1.5"/>`;
    }

    svg.innerHTML = s;
}

/**
 * Chooses a perimeter position for the active player during setup.
 *
 * @param {number} perimIndex - Index into the board perimeter list.
 */
// Called by clicking a perimeter marker during setup to choose a starting spot.
function chooseStartingPosition(perimIndex) {
    if (!state || !state.selectingStartingPositions) return;
    if (perimIndex < 0 || perimIndex >= state.perimeter.length) return;
    const currentPick = state.setupPickIndex;
    if (currentPick >= state.players.length) return;
    const player = state.players[currentPick];

    // Only allow the current picker to choose (enforces order)
    // If connected to a host, clients must send the action to the host rather than applying locally.
    if (hostConnection && !isHost) {
        // Only the player whose id matches the current picker may attempt to choose.
        if (localPlayerId !== player.id) return;
        sendAction({ type: 'chooseStart', playerId: localPlayerId, perimIndex });
        return;
    }

    // In networked games (host or connected clients), only the assigned client may apply the pick locally.
    const networked = !!(isHost || hostConnection);
    if (networked && localPlayerId !== player.id) return; // in local-only games, allow the UI to pick for any player

    const spot = state.perimeter[perimIndex];

    // Ensure spot isn't already taken
    if (state.players.find(p => p.startIndex === perimIndex)) return;

    // Assign chosen coordinates and the matching entry point for the chosen perimeter slot.
    player.x = spot.outsideX; player.y = spot.outsideY; player.point = spot.point;
    player.entryX = spot.x; player.entryY = spot.y; player.startIndex = perimIndex;

    // Advance to the next player
    state.setupPickIndex++;

    // If all players have chosen, finish setup and set turn to starting player
    if (state.setupPickIndex >= state.players.length) {
        state.selectingStartingPositions = false;
        state.currentPlayerIndex = 0;
    }
    render();
    broadcastState();
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
document.getElementById('rotateBtnLeft').onclick = () => {
    if (selectedTileIndex === null) return;
    selectedRotation = (selectedRotation + 3) % 4;
    render();
};
document.getElementById('rotateBtnRight').onclick = () => {
    if (selectedTileIndex === null) return;
    selectedRotation = (selectedRotation + 1) % 4;
    render();
};
document.getElementById('placeBtn').onclick = () => {

    // Verify tile exists and game is not over
    if (selectedTileIndex === null || state.gameOver) return;

    // Get the selected tile from the current player's hand
    const networked = !!(isHost || hostConnection);
    const p = networked ? state.players.find(player => player.id === localPlayerId) : currentPlayer();
    const hand = state.hands[p.id];
    const tileDef = hand[selectedTileIndex];
    if (!tileDef || (networked && p.id !== localPlayerId)) return;

    // If this instance is connected to a hosted game, send the place action to the host
    if (hostConnection && !isHost) {
        sendAction({ type: 'place', playerId: localPlayerId, tileId: tileDef.id, rotation: selectedRotation });
        return;
    }

    // Attempt to place the tile
    hand.splice(selectedTileIndex, 1);
    // broadcastState is a no-op when we're not hosting, so it's always safe to pass here —
    // when hosting, this streams every incremental resolution step to connected clients.
    const result = placeTile(state, tileDef, selectedRotation, p.id, broadcastState);

    // If an error occurs, return the tile to the player's hand
    if (result.error) {
        hand.splice(selectedTileIndex, 0, tileDef);
        alert(result.error);
        return;
    }

    // Reset selected tile variables
    selectedTileIndex = null; selectedRotation = 0;

    render();
    broadcastState();
};
window.addEventListener('keydown', (e) => {
    if (e.key === 'l' || e.key === 'L') document.getElementById('rotateBtnLeft').click();
    else if (e.key === 'r' || e.key === 'R') document.getElementById('rotateBtnRight').click();
});

document.getElementById('bonusRotateBtnLeft').onclick = () => {
    bonusRotationSteps = (bonusRotationSteps + 3) % 4;
    render();
};
document.getElementById('bonusRotateBtnRight').onclick = () => {
    bonusRotationSteps = (bonusRotationSteps + 1) % 4;
    render();
};
document.getElementById('bonusConfirmBtn').onclick = () => {
    if (!state.pendingBonusAction || !localPlayerCanSeeBonus()) return;
    if (hostConnection && !isHost) {
        sendAction({ type: 'bonus', playerId: localPlayerId, action: 'rotate', steps: bonusRotationSteps });
        return;
    }
    const { x, y } = state.pendingBonusAction.cell;
    resolveBonusRotate(state, x, y, bonusRotationSteps);
    bonusRotationSteps = 0;
    render();
    broadcastState(); // was previously missing here — clients never learned the host's own bonus choice
};
document.getElementById('bonusSkipBtn').onclick = () => {
    if (!state.pendingBonusAction || !localPlayerCanSeeBonus()) return;
    if (hostConnection && !isHost) {
        sendAction({ type: 'bonus', playerId: localPlayerId, action: 'skip' });
        return;
    }
    skipBonus(state);
    bonusRotationSteps = 0;
    render();
    broadcastState(); // was previously missing here — clients never learned the host's own bonus choice
};

startNewGame();