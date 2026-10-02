/* Exhaustive proof that the AI is unbeatable.
 *
 * Plays EVERY possible human move sequence against the AI's deterministic replies and
 * asserts the human never wins. Run with:  node verify.js
 */
var game = require('./game.js');

var HUMAN = game.HUMAN;
var AI = game.AI;

function emptyCells(board) {
  var out = [];
  for (var i = 0; i < 9; i++) {
    if (board[i] === null) out.push(i);
  }
  return out;
}

/* Walks the whole tree of human strategies. `chooseAi(board)` supplies the AI's reply,
 * so the same walker can be pointed at the real AI or at a deliberately weak one, to
 * prove the walker actually detects human wins. */
function explore(board, chooseAi, stats) {
  var result = game.getWinner(board);
  if (result) {
    stats.games++;
    if (result.winner === HUMAN) stats.humanWins++;
    else stats.aiWins++;
    return;
  }

  var empties = emptyCells(board);
  if (empties.length === 0) {
    stats.games++;
    stats.draws++;
    return;
  }

  for (var k = 0; k < empties.length; k++) {
    var h = empties[k];
    board[h] = HUMAN;

    // If that human move neither ended the game nor filled the board, the AI replies.
    var aiMove = -1;
    if (!game.getWinner(board) && empties.length > 1) {
      aiMove = chooseAi(board);
      if (aiMove === -1) throw new Error('AI returned no move: ' + board.join(','));
      if (board[aiMove] !== null) throw new Error('AI chose occupied cell: ' + board.join(','));
      board[aiMove] = AI;
    }

    explore(board, chooseAi, stats);

    if (aiMove !== -1) board[aiMove] = null;
    board[h] = null;
  }
}

function newStats() {
  return { games: 0, humanWins: 0, aiWins: 0, draws: 0 };
}

function emptyBoard() {
  return [null, null, null, null, null, null, null, null, null];
}

/* ---------- 1. The real AI, against every human line ---------- */

var real = newStats();
console.log('Exploring every human line against the real AI...');
explore(emptyBoard(), game.bestMove, real);

console.log('  total games played     :', real.games);
console.log('  human wins (must be 0) :', real.humanWins);
console.log('  AI wins                :', real.aiWins);
console.log('  draws                  :', real.draws);

/* ---------- 2. Harness sanity: a weak AI MUST be beatable ---------- */

// Confirms the walker above can actually detect a human win rather than always
// reporting zero. This AI just grabs the first empty cell.
function firstEmpty(board) {
  var e = emptyCells(board);
  return e.length ? e[0] : -1;
}

var weak = newStats();
explore(emptyBoard(), firstEmpty, weak);
console.log('');
console.log('Sanity check - same walker against a weak AI:');
console.log('  human wins (must be > 0) :', weak.humanWins);
var sanityOk = weak.humanWins > 0;

/* ---------- 3. Opening-book spot checks ---------- */

/* NOTE on turn parity: X always opens, so after X moves the filled count is odd and it
 * is the AI's turn. Every board below therefore holds an ODD number of stones. */
var checks = [];

function check(name, board, test) {
  var got = game.bestMove(board);
  checks.push({ name: name, got: got, ok: test(got) });
}

// A naive "block the threat" AI plays a side and loses to the corners fork instead.
check('X takes a corner -> AI must take center',
  [HUMAN, null, null,
   null, null, null,
   null, null, null],
  function (m) { return m === 4; });

// X holds opposite corners 0 and 8, threatening a fork. Playing a CORNER here (2 or 6)
// loses to a fork at the other corner; the correct defense is an edge (1, 3, 5 or 7).
check('X holds opposite corners -> AI must play an edge, not a corner',
  [HUMAN, null, null,
   null, AI, null,
   null, null, HUMAN],
  function (m) { return m === 1 || m === 3 || m === 5 || m === 7; });

// O at 0,1; X at 3,5,8 (five stones, so it is the AI's turn). The AI must complete
// 0-1-2 and win now, rather than block X's fork threats at 4 and 2.
check('AI completes its own line when available',
  [AI, AI, null,
   HUMAN, null, HUMAN,
   null, null, HUMAN],
  function (m) { return m === 2; });

// X at 0,1 with O at 4 (three stones, so it is the AI's turn). The AI must block at 2.
check('AI blocks an immediate human threat',
  [HUMAN, HUMAN, null,
   null, AI, null,
   null, null, null],
  function (m) { return m === 2; });

console.log('');
console.log('Opening-book spot checks:');
var failed = 0;
checks.forEach(function (c) {
  if (!c.ok) failed++;
  console.log('  ' + (c.ok ? 'PASS' : 'FAIL') + '  ' + c.name + '  (chose ' + c.got + ')');
});

/* ---------- Verdict ---------- */

console.log('');
if (real.humanWins === 0 && failed === 0 && sanityOk) {
  console.log('RESULT: PASS');
  console.log('  - The walker is proven able to detect human wins (it beats the weak AI ' +
              weak.humanWins + ' times).');
  console.log('  - Against the real AI, the human wins 0 of ' + real.games + ' lines.');
  console.log('  - The AI is unbeatable.');
  process.exit(0);
} else {
  console.log('RESULT: FAIL');
  console.log('  human wins: ' + real.humanWins +
              ', failed checks: ' + failed +
              ', sanity ok: ' + sanityOk);
  process.exit(1);
}