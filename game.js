/* Unbeatable Tic-Tac-Toe - AI and UI.
 *
 * The AI (O) runs a full minimax search over the game tree. Tic-tac-toe has only
 * 5,478 reachable positions, so the whole tree is solved once on load and cached;
 * every move after that is a table lookup.
 *
 * Loaded as a classic script (not an ES module) so index.html works from file://
 * without a web server.
 */
(function () {
  'use strict';

  var HUMAN = 'X';
  var AI = 'O';

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  /* ---------- Board helpers ---------- */

  // Returns { winner, line } or null. The line is handed to the UI so the winning
  // three cells can be highlighted from the same source of truth as the AI's logic.
  function getWinner(board) {
    for (var i = 0; i < LINES.length; i++) {
      var line = LINES[i];
      var a = board[line[0]];
      if (a && a === board[line[1]] && a === board[line[2]]) {
        return { winner: a, line: line.slice() };
      }
    }
    return null;
  }

  function isFull(board) {
    for (var i = 0; i < 9; i++) {
      if (board[i] === null) return false;
    }
    return true;
  }

  function countFilled(board) {
    var n = 0;
    for (var i = 0; i < 9; i++) {
      if (board[i] !== null) n++;
    }
    return n;
  }

  function keyOf(board) {
    var s = '';
    for (var i = 0; i < 9; i++) s += board[i] === null ? '-' : board[i];
    return s;
  }

  /* ---------- Minimax ---------- */

  /* Scores are absolute functions of the board, not of search depth:
   *
   *     AI wins    ->  10 - filled   (fewer moves used = better, so it finishes you off)
   *     human wins ->  filled - 10   (unreachable against correct play; kept for safety)
   *     draw       ->   0
   *
   * Because the score depends only on the position, the table can be memoized on the
   * board alone. Since X always opens, whose turn it is follows from the parity of the
   * filled-cell count, so no turn argument is needed either.
   */
  var memo = new Map();

  function solve(board) {
    var key = keyOf(board);
    var cached = memo.get(key);
    if (cached !== undefined) return cached;

    var result = getWinner(board);
    var filled = countFilled(board);
    var score;

    if (result) {
      score = result.winner === AI ? 10 - filled : filled - 10;
    } else if (filled === 9) {
      score = 0;
    } else if (filled % 2 === 1) {
      // Odd count means the AI made the last move, so it is the AI's turn: maximize.
      var bestMax = -Infinity;
      for (var i = 0; i < 9; i++) {
        if (board[i] !== null) continue;
        board[i] = AI;
        var sMax = solve(board);
        board[i] = null;
        if (sMax > bestMax) bestMax = sMax;
      }
      score = bestMax;
    } else {
      var bestMin = Infinity;
      for (var j = 0; j < 9; j++) {
        if (board[j] !== null) continue;
        board[j] = HUMAN;
        var sMin = solve(board);
        board[j] = null;
        if (sMin < bestMin) bestMin = sMin;
      }
      score = bestMin;
    }

    memo.set(key, score);
    return score;
  }

  // The one entry point the UI needs. Returns a cell index 0-8, or -1 if there is no
  // move for the AI to make.
  function bestMove(board) {
    if (getWinner(board) || isFull(board)) return -1;
    if (countFilled(board) % 2 !== 1) return -1; // not the AI's turn

    var bestScore = -Infinity;
    var move = -1;
    for (var i = 0; i < 9; i++) {
      if (board[i] !== null) continue;
      board[i] = AI;
      var score = solve(board);
      board[i] = null;
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
    return move;
  }

  // Solve from the empty board once. This visits every descendant, so the whole
  // reachable tree is cached before the first click lands.
  solve([null, null, null, null, null, null, null, null, null]);

  /* ---------- UI ---------- */

  function initUI() {
    var AI_DELAY_MS = 300; // a beat so the AI's reply is visible rather than instant

    var cells = Array.prototype.slice.call(document.querySelectorAll('.cell'));
    var boardEl = document.getElementById('board');
    var statusEl = document.getElementById('status');
    var newGameBtn = document.getElementById('new-game');
    var resetScoresBtn = document.getElementById('reset-scores');
    var scoreEls = {
      wins: document.getElementById('score-wins'),
      draws: document.getElementById('score-draws'),
      losses: document.getElementById('score-losses')
    };

    var state = {
      board: [null, null, null, null, null, null, null, null, null],
      over: false,
      winner: null,        // 'X' | 'O' | 'draw' | null
      winningLine: null,
      thinking: false,     // true while the AI's reply is pending
      scores: { wins: 0, draws: 0, losses: 0 }
    };

    function render() {
      for (var i = 0; i < 9; i++) {
        renderCell(cells[i], state.board[i], i);
      }
      scoreEls.wins.textContent = state.scores.wins;
      scoreEls.draws.textContent = state.scores.draws;
      scoreEls.losses.textContent = state.scores.losses;
      renderStatus();
    }

    function renderCell(el, mark, index) {
      var desired = mark || '';
      if (el.dataset.mark !== desired) {
        el.dataset.mark = desired;
        el.textContent = desired;
        if (desired) {
          el.classList.remove('pop');
          void el.offsetWidth; // force reflow so the animation restarts
          el.classList.add('pop');
        }
      }

      var isWinning = !!state.winningLine && state.winningLine.indexOf(index) !== -1;
      el.classList.toggle('win', isWinning);

      // Locked once the game ends, or while the AI is mid-reply. The .thinking class
      // keeps the AI's own cell readable rather than greyed out.
      el.disabled = state.over || state.thinking || el.dataset.mark !== '';
      el.classList.toggle('thinking', (state.over || state.thinking) && el.dataset.mark === '');
    }

    function renderStatus() {
      var text;
      var tone = '';
      if (state.winner === HUMAN) {
        text = 'You win - this should be impossible. Please report it.';
        tone = 'win';
      } else if (state.winner === AI) {
        text = 'AI wins.';
        tone = 'lose';
      } else if (state.winner === 'draw') {
        text = 'Draw - the best a human can get against perfect play.';
        tone = 'draw';
      } else if (state.thinking) {
        text = 'AI is thinking...';
      } else {
        text = 'Your move - you play X.';
      }
      statusEl.textContent = text;
      statusEl.dataset.tone = tone;
    }

    // Returns true when the position is terminal, and records the result.
    function settleIfOver() {
      var result = getWinner(state.board);
      if (result) {
        state.over = true;
        state.winner = result.winner;
        state.winningLine = result.line;
        if (result.winner === HUMAN) state.scores.wins++;
        else state.scores.losses++;
        return true;
      }
      if (isFull(state.board)) {
        state.over = true;
        state.winner = 'draw';
        state.scores.draws++;
        boardEl.classList.add('draw');
        return true;
      }
      return false;
    }

    function aiTurn() {
      var move = bestMove(state.board);
      if (move !== -1) state.board[move] = AI;
      state.thinking = false;
      settleIfOver();
      render();
    }

    function onCellClick(index) {
      if (state.over || state.thinking || state.board[index] !== null) return;

      state.board[index] = HUMAN;
      if (settleIfOver()) {
        render();
        return;
      }

      state.thinking = true;
      render();
      setTimeout(aiTurn, AI_DELAY_MS);
    }

    function newGame() {
      state.board = [null, null, null, null, null, null, null, null, null];
      state.over = false;
      state.winner = null;
      state.winningLine = null;
      state.thinking = false;
      boardEl.classList.remove('draw');
      for (var i = 0; i < 9; i++) cells[i].classList.remove('pop', 'win');
      render();
    }

    cells.forEach(function (el, i) {
      el.addEventListener('click', function () { onCellClick(i); });
    });
    newGameBtn.addEventListener('click', newGame);
    resetScoresBtn.addEventListener('click', function () {
      state.scores = { wins: 0, draws: 0, losses: 0 };
      render();
    });

    render();
  }

  if (typeof document !== 'undefined') initUI();

  // Lets verify.js assert the AI's behaviour in Node without a second copy of the logic.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { bestMove: bestMove, getWinner: getWinner, LINES: LINES, HUMAN: HUMAN, AI: AI };
  }
})();