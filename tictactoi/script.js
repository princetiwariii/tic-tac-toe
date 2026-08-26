/* ============================================================
   Tic Tac Toe — game engine
   ============================================================ */
(() => {
    "use strict";

    const WIN_LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
        [0, 4, 8], [2, 4, 6],            // diagonals
    ];

    /* ---------------- State ---------------- */
    const state = {
        screen: "menu",
        mode: "pvp",          // 'pvp' | 'ai'
        difficulty: "easy",   // 'easy' | 'medium' | 'hard'
        humanSymbol: "X",     // human's mark in ai mode
        aiSymbol: "O",
        board: Array(9).fill(null),
        current: "X",
        status: "playing",    // 'playing' | 'over'
        locked: false,        // input lock (AI turn / end animation)
        scores: { X: 0, O: 0, draw: 0 },
        muted: false,
    };

    /* ---------------- DOM ---------------- */
    const $ = (sel) => document.querySelector(sel);
    const el = {};
    let cellEls = [];
    let confettiRAF = null;

    /* ---------------- Difficulty copy ---------------- */
    const DIFF_HINT = {
        easy: "Easy — the computer plays random moves. Great for warming up.",
        medium: "Medium — the computer plays smart about half the time. A fair fight.",
        hard: "Hard — powered by minimax. It never loses; the best you can do is draw.",
    };

    /* ============================================================
       Init
       ============================================================ */
    function init() {
        cache();
        buildBoard();
        bindMenu();
        bindGame();
        loadPrefs();
    }

    function cache() {
        el.menu = $("#menu");
        el.game = $("#game");
        el.aiOptions = $("#aiOptions");
        el.diffHint = $("#diffHint");
        el.startBtn = $("#startBtn");
        el.board = $("#board");
        el.winLine = $("#winLine");
        el.boardWrap = $(".board-wrap");
        el.modePill = $("#modePill");
        el.turn = $("#turn");
        el.turnText = $("#turnText");
        el.turnDot = $("#turnDot");
        el.scoreX = $("#scoreX");
        el.scoreO = $("#scoreO");
        el.nameX = $("#nameX");
        el.nameO = $("#nameO");
        el.countX = $("#countX");
        el.countO = $("#countO");
        el.countDraw = $("#countDraw");
        el.backBtn = $("#backBtn");
        el.restartBtn = $("#restartBtn");
        el.soundBtn = $("#soundBtn");
        el.soundIcon = $("#soundIcon");
        el.result = $("#result");
        el.resultIcon = $("#resultIcon");
        el.resultTitle = $("#resultTitle");
        el.resultSub = $("#resultSub");
        el.playAgainBtn = $("#playAgainBtn");
        el.toMenuBtn = $("#toMenuBtn");
        el.confetti = $("#confetti");
    }

    /* ============================================================
       SVG marks
       ============================================================ */
    function markSVG(type, ghost) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 100 100");
        const make = (tag, attrs, cls) => {
            const node = document.createElementNS(ns, tag);
            for (const k in attrs) node.setAttribute(k, attrs[k]);
            node.setAttribute("class", cls);
            node.setAttribute("pathLength", "1");
            return node;
        };
        if (type === "X") {
            svg.appendChild(make("line", { x1: 20, y1: 20, x2: 80, y2: 80 }, "stroke s1"));
            svg.appendChild(make("line", { x1: 80, y1: 20, x2: 20, y2: 80 }, "stroke s2"));
        } else {
            svg.appendChild(make("circle", { cx: 50, cy: 50, r: 32 }, "stroke"));
        }
        const wrap = document.createElement("span");
        wrap.className = ghost
            ? `ghost ghost-${type.toLowerCase()}`
            : `mark mark-${type.toLowerCase()}`;
        wrap.appendChild(svg);
        return wrap;
    }

    /* ============================================================
       Board construction
       ============================================================ */
    function buildBoard() {
        el.board.innerHTML = "";
        cellEls = [];
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement("button");
            cell.className = "cell";
            cell.type = "button";
            cell.dataset.index = String(i);
            cell.setAttribute("role", "gridcell");
            cell.setAttribute("aria-label", `Cell ${i + 1}, empty`);
            cell.appendChild(markSVG("X", true));
            cell.appendChild(markSVG("O", true));
            cell.addEventListener("click", () => handleCellClick(i));
            el.board.appendChild(cell);
            cellEls.push(cell);
        }
    }

    /* ============================================================
       Menu
       ============================================================ */
    function bindMenu() {
        // Mode selection
        el.menu.querySelectorAll("[data-mode]").forEach((btn) => {
            btn.addEventListener("click", () => {
                uiClick();
                state.mode = btn.dataset.mode;
                el.menu.querySelectorAll("[data-mode]").forEach((b) => {
                    const on = b === btn;
                    b.classList.toggle("is-selected", on);
                    b.setAttribute("aria-selected", String(on));
                });
                el.aiOptions.hidden = state.mode !== "ai";
            });
        });

        // Difficulty
        el.menu.querySelectorAll("[data-diff]").forEach((btn) => {
            btn.addEventListener("click", () => {
                uiClick();
                state.difficulty = btn.dataset.diff;
                selectRadio(btn, "[data-diff]");
                el.diffHint.textContent = DIFF_HINT[state.difficulty];
            });
        });

        // Symbol choice
        el.menu.querySelectorAll("[data-symbol]").forEach((btn) => {
            btn.addEventListener("click", () => {
                uiClick();
                state.humanSymbol = btn.dataset.symbol;
                state.aiSymbol = state.humanSymbol === "X" ? "O" : "X";
                selectRadio(btn, "[data-symbol]");
            });
        });

        el.startBtn.addEventListener("click", () => { uiClick(); startGame(); });
    }

    function selectRadio(btn, selector) {
        el.menu.querySelectorAll(selector).forEach((b) => {
            const on = b === btn;
            b.classList.toggle("is-selected", on);
            b.setAttribute("aria-checked", String(on));
        });
    }

    /* ============================================================
       Game controls
       ============================================================ */
    function bindGame() {
        el.restartBtn.addEventListener("click", () => { uiClick(); resetRound(); });
        el.backBtn.addEventListener("click", () => { uiClick(); toMenu(); });
        el.playAgainBtn.addEventListener("click", () => { uiClick(); hideResult(); resetRound(); });
        el.toMenuBtn.addEventListener("click", () => { uiClick(); hideResult(); toMenu(); });
        el.soundBtn.addEventListener("click", toggleMute);
        window.addEventListener("resize", () => {
            if (state.status === "over") positionWinLine();
        });
    }

    /* ============================================================
       Screen transitions
       ============================================================ */
    function startGame() {
        state.screen = "game";
        state.scores = { X: 0, O: 0, draw: 0 };

        // Player names
        if (state.mode === "pvp") {
            el.nameX.textContent = "Player 1";
            el.nameO.textContent = "Player 2";
            el.modePill.textContent = "2 Players";
        } else {
            const diffLabel = state.difficulty[0].toUpperCase() + state.difficulty.slice(1);
            el.modePill.textContent = `vs Computer · ${diffLabel}`;
            el.nameX.textContent = state.humanSymbol === "X" ? "You" : "Computer";
            el.nameO.textContent = state.humanSymbol === "O" ? "You" : "Computer";
        }

        el.menu.hidden = true;
        el.game.hidden = false;
        el.game.classList.remove("is-active");
        void el.game.offsetWidth;           // restart entrance animation
        el.game.classList.add("is-active");

        renderScores();
        resetRound();
    }

    function toMenu() {
        cancelConfetti();
        state.screen = "menu";
        state.status = "playing";
        el.game.hidden = true;
        el.menu.hidden = false;
        el.menu.classList.remove("is-active");
        void el.menu.offsetWidth;
        el.menu.classList.add("is-active");
    }

    /* ============================================================
       Round lifecycle
       ============================================================ */
    function resetRound() {
        cancelConfetti();
        state.board = Array(9).fill(null);
        state.current = "X";              // X always moves first
        state.status = "playing";
        state.locked = false;

        // Clear cells
        cellEls.forEach((cell, i) => {
            cell.classList.remove("filled", "win", "win-x", "win-o");
            cell.setAttribute("aria-label", `Cell ${i + 1}, empty`);
            const mark = cell.querySelector(".mark");
            if (mark) mark.remove();
        });
        el.board.classList.remove("dim");

        // Clear win line
        el.winLine.className = "win-line";
        el.winLine.removeAttribute("style");

        updateTurnUI();

        // If AI moves first
        if (state.mode === "ai" && state.current === state.aiSymbol) {
            scheduleAI();
        }
    }

    /* ============================================================
       Playing a move
       ============================================================ */
    function handleCellClick(i) {
        if (state.status !== "playing" || state.locked) return;
        if (state.board[i] !== null) return;
        if (state.mode === "ai" && state.current !== state.humanSymbol) return;
        play(i);
    }

    function play(i) {
        const symbol = state.current;
        state.board[i] = symbol;

        // Render mark
        const cell = cellEls[i];
        cell.classList.add("filled");
        cell.setAttribute("aria-label", `Cell ${i + 1}, ${symbol}`);
        cell.appendChild(markSVG(symbol, false));
        placeSound(symbol);

        // Evaluate
        const result = checkWinner(state.board);
        if (result) {
            endGame(result.winner, result.line);
            return;
        }
        if (state.board.every((c) => c !== null)) {
            endGame(null, null);
            return;
        }

        // Next turn
        state.current = symbol === "X" ? "O" : "X";
        updateTurnUI();

        if (state.mode === "ai" && state.current === state.aiSymbol) {
            scheduleAI();
        }
    }

    /* ============================================================
       Turn UI
       ============================================================ */
    function updateTurnUI() {
        const cur = state.current;
        el.board.dataset.turn = cur;
        el.turnDot.classList.toggle("is-o", cur === "O");
        el.turn.classList.remove("thinking");

        el.scoreX.classList.toggle("is-turn", cur === "X");
        el.scoreO.classList.toggle("is-turn", cur === "O");

        if (state.mode === "ai") {
            if (cur === state.humanSymbol) {
                el.turnText.textContent = "Your turn";
            } else {
                el.turnText.textContent = "Computer is thinking";
                el.turn.classList.add("thinking");
            }
        } else {
            const name = cur === "X" ? el.nameX.textContent : el.nameO.textContent;
            el.turnText.textContent = `${name}'s turn`;
        }
    }

    /* ============================================================
       End of game
       ============================================================ */
    function endGame(winner, line) {
        state.status = "over";
        state.locked = true;
        el.scoreX.classList.remove("is-turn");
        el.scoreO.classList.remove("is-turn");

        if (winner) {
            state.scores[winner]++;
            // Highlight winning cells
            line.forEach((idx) => {
                cellEls[idx].classList.add("win", winner === "X" ? "win-x" : "win-o");
            });
            el.board.classList.add("dim");
            drawWinLine(winner, line);
            winSound();

            const celebrate = state.mode === "pvp" || winner === state.humanSymbol;
            if (celebrate) confetti(winner);

            bumpScore(winner);
            el.turnText.textContent = winLabelShort(winner);
            el.turn.classList.remove("thinking");
        } else {
            state.scores.draw++;
            bumpScore("draw");
            drawSound();
            el.turnText.textContent = "It's a draw";
            el.turn.classList.remove("thinking");
        }

        renderScores();
        window.setTimeout(() => showResult(winner), winner ? 900 : 550);
    }

    function winLabelShort(winner) {
        if (state.mode === "ai") return winner === state.humanSymbol ? "You win!" : "Computer wins";
        return `${winner === "X" ? el.nameX.textContent : el.nameO.textContent} wins!`;
    }

    /* ============================================================
       Winning line strike
       ============================================================ */
    let lastWin = null;
    function drawWinLine(winner, line) {
        lastWin = { winner, line };
        el.winLine.classList.add(winner === "X" ? "x" : "o");
        positionWinLine();
        requestAnimationFrame(() => requestAnimationFrame(() => {
            el.winLine.classList.add("show");
        }));
    }

    function positionWinLine() {
        if (!lastWin) return;
        const { line } = lastWin;
        const wrap = el.boardWrap.getBoundingClientRect();
        const ra = cellEls[line[0]].getBoundingClientRect();
        const rc = cellEls[line[2]].getBoundingClientRect();
        const ax = ra.left + ra.width / 2 - wrap.left;
        const ay = ra.top + ra.height / 2 - wrap.top;
        const cx = rc.left + rc.width / 2 - wrap.left;
        const cy = rc.top + rc.height / 2 - wrap.top;
        const dx = cx - ax, dy = cy - ay;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        const len = dist + ra.width * 0.55;
        el.winLine.style.left = ((ax + cx) / 2) + "px";
        el.winLine.style.top = ((ay + cy) / 2) + "px";
        el.winLine.style.width = len + "px";
        el.winLine.style.setProperty("--rot", `rotate(${angle}deg)`);
    }

    /* ============================================================
       Scores
       ============================================================ */
    function renderScores() {
        el.countX.textContent = state.scores.X;
        el.countO.textContent = state.scores.O;
        el.countDraw.textContent = state.scores.draw;
    }

    function bumpScore(which) {
        const node = which === "X" ? el.scoreX : which === "O" ? el.scoreO : $("#scoreDraw");
        node.classList.remove("bump");
        void node.offsetWidth;
        node.classList.add("bump");
    }

    /* ============================================================
       Result overlay
       ============================================================ */
    function showResult(winner) {
        state.locked = true;
        if (winner) {
            const isX = winner === "X";
            el.resultIcon.textContent = "🏆";
            el.resultTitle.textContent = winLabelShort(winner);
            el.resultTitle.className = "result-title " + (isX ? "win-x" : "win-o");
            el.resultSub.textContent =
                `Score  ${el.nameX.textContent} ${state.scores.X} — ${state.scores.O} ${el.nameO.textContent}`;
        } else {
            el.resultIcon.textContent = "🤝";
            el.resultTitle.textContent = "It's a draw";
            el.resultTitle.className = "result-title draw";
            el.resultSub.textContent = "A perfectly balanced game. Run it back?";
        }
        el.result.hidden = false;
        el.playAgainBtn.focus();
    }

    function hideResult() {
        el.result.hidden = true;
    }

    /* ============================================================
       AI
       ============================================================ */
    function scheduleAI() {
        state.locked = true;
        el.board.classList.add("locked");
        const delay = 380 + Math.random() * 320;
        window.setTimeout(() => {
            if (state.status !== "playing") return;
            const move = chooseAIMove();
            state.locked = false;
            el.board.classList.remove("locked");
            if (move != null) play(move);
        }, delay);
    }

    function chooseAIMove() {
        const avail = emptyIndices(state.board);
        if (avail.length === 0) return null;

        if (state.difficulty === "easy") {
            return randomOf(avail);
        }
        if (state.difficulty === "medium") {
            // Half the time play optimally, half the time play randomly.
            return Math.random() < 0.5 ? bestMove(state.board) : randomOf(avail);
        }
        return bestMove(state.board); // hard
    }

    function bestMove(board) {
        return minimax(board.slice(), state.aiSymbol, 0).index;
    }

    function minimax(board, player, depth) {
        const result = checkWinner(board);
        if (result) {
            return { score: result.winner === state.aiSymbol ? 10 - depth : depth - 10 };
        }
        const avail = emptyIndices(board);
        if (avail.length === 0) return { score: 0 };

        const isMax = player === state.aiSymbol;
        let best = { score: isMax ? -Infinity : Infinity, index: avail[0] };
        const next = player === "X" ? "O" : "X";

        for (const i of avail) {
            board[i] = player;
            const { score } = minimax(board, next, depth + 1);
            board[i] = null;
            if (isMax ? score > best.score : score < best.score) {
                best = { score, index: i };
            }
        }
        return best;
    }

    /* ---------------- helpers ---------------- */
    function checkWinner(board) {
        for (const line of WIN_LINES) {
            const [a, b, c] = line;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { winner: board[a], line };
            }
        }
        return null;
    }
    function emptyIndices(board) {
        const out = [];
        for (let i = 0; i < 9; i++) if (board[i] === null) out.push(i);
        return out;
    }
    function randomOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    /* ============================================================
       Sound (Web Audio, no assets)
       ============================================================ */
    let actx = null;
    function audioCtx() {
        if (!actx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) actx = new AC();
        }
        if (actx && actx.state === "suspended") actx.resume();
        return actx;
    }
    function tone(freq, dur, type, vol, when) {
        if (state.muted) return;
        const a = audioCtx();
        if (!a) return;
        const t = a.currentTime + (when || 0);
        const o = a.createOscillator();
        const g = a.createGain();
        o.type = type || "sine";
        o.frequency.setValueAtTime(freq, t);
        o.connect(g); g.connect(a.destination);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t);
        o.stop(t + dur + 0.03);
    }
    function placeSound(symbol) {
        const base = symbol === "X" ? 440 : 340;
        tone(base, 0.18, "triangle", 0.14, 0);
        tone(base * 2, 0.12, "sine", 0.05, 0.01);
    }
    function winSound() {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, "triangle", 0.12, i * 0.09));
    }
    function drawSound() {
        tone(196, 0.3, "sine", 0.12, 0);
        tone(174, 0.34, "sine", 0.1, 0.08);
    }
    function uiClick() {
        tone(620, 0.05, "square", 0.05, 0);
    }

    function toggleMute() {
        state.muted = !state.muted;
        el.soundIcon.textContent = state.muted ? "🔇" : "🔊";
        el.soundBtn.setAttribute("aria-pressed", String(!state.muted));
        try { localStorage.setItem("ttt-muted", state.muted ? "1" : "0"); } catch (e) { /* ignore */ }
        if (!state.muted) uiClick();
    }
    function loadPrefs() {
        try {
            state.muted = localStorage.getItem("ttt-muted") === "1";
        } catch (e) { /* ignore */ }
        el.soundIcon.textContent = state.muted ? "🔇" : "🔊";
        el.soundBtn.setAttribute("aria-pressed", String(!state.muted));
    }

    /* ============================================================
       Confetti
       ============================================================ */
    function confetti(winner) {
        cancelConfetti();
        const c = el.confetti;
        c.hidden = false;
        const ctx = c.getContext("2d");
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const W = window.innerWidth, H = window.innerHeight;
        c.width = W * dpr; c.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const palette = winner === "X"
            ? ["#35e0e8", "#7c8cff", "#ffffff", "#9ff7fb"]
            : ["#ff5ca8", "#7c8cff", "#ffffff", "#ffc2df"];

        const N = 160;
        const parts = [];
        for (let i = 0; i < N; i++) {
            const angle = (Math.PI * 2 * i) / N + Math.random();
            const speed = 6 + Math.random() * 9;
            parts.push({
                x: W / 2, y: H * 0.4,
                vx: Math.cos(angle) * speed * (0.5 + Math.random()),
                vy: Math.sin(angle) * speed - (4 + Math.random() * 4),
                size: 5 + Math.random() * 7,
                rot: Math.random() * Math.PI,
                vr: (Math.random() - 0.5) * 0.4,
                color: palette[i % palette.length],
                shape: Math.random() < 0.5 ? "rect" : "circle",
            });
        }

        const DURATION = 2600;
        let startTs = null;
        function frame(ts) {
            if (startTs === null) startTs = ts;
            const elapsed = ts - startTs;
            ctx.clearRect(0, 0, W, H);
            for (const p of parts) {
                p.vy += 0.28;          // gravity
                p.vx *= 0.99;
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vr;
                const alpha = Math.max(0, 1 - elapsed / DURATION);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                if (p.shape === "rect") {
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            }
            ctx.globalAlpha = 1;
            if (elapsed < DURATION) {
                confettiRAF = requestAnimationFrame(frame);
            } else {
                cancelConfetti();
            }
        }
        confettiRAF = requestAnimationFrame(frame);
    }

    function cancelConfetti() {
        if (confettiRAF) { cancelAnimationFrame(confettiRAF); confettiRAF = null; }
        const c = el.confetti;
        if (c) {
            const ctx = c.getContext("2d");
            if (ctx) ctx.clearRect(0, 0, c.width, c.height);
            c.hidden = true;
        }
    }

    /* ---------------- go ---------------- */
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
