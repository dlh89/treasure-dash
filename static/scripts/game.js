global = {
  gameLive: false,
  preGame: false // the time when players pick starting positions
}

var socket = io('/game');

var cells = jQuery('.grid__cell');
jQuery(cells).on('click', cellClick);

function cellClick(e) {
  var row = jQuery(e.target).data('row');
  var col = jQuery(e.target).data('col');
  if (global.gameLive) {
    socket.emit('clientMove', {'row': row, 'col': col});
  } else if (global.preGame) {
    var gridHighlight = jQuery('.grid__highlight');
    gridHighlight.hide();
    socket.emit('startPos', {'row': row, 'col': col});
  }
}

var copyLinkBtn = jQuery('.js-copy-link-btn');
copyLinkBtn.on('click', copyLink);

function copyLink() {
  var roomLink = jQuery('.js-room-link');
  roomLink.attr('disabled', false); // temporarily enable the input so that we can select it
  roomLink.select();
  document.execCommand("copy");
  roomLink.attr('disabled', true);
  var copyNotice = jQuery('.js-copied-notice');
  copyNotice.text('Copied to clipboard!').fadeIn(1000)
    .delay(2000)
    .fadeOut(1000);
}

socket.on('connection', function() {
  var roomNameElem = jQuery('.js-room-name');
  var roomName = roomNameElem.attr('data-room-name');
  var playerName = localStorage.getItem('playerName');
  socket.emit('joinRoom', roomName, playerName);
});

socket.on('playerJoin', function(players) {
  var playerNameElem = jQuery('.js-player-name');
  playerNameElem.text(players.player.name);
  var scoreboardPlayerElem = jQuery(playerNameElem).parent('.scoreboard__player');
  scoreboardPlayerElem.attr('data-player-id', players.player.id);

  jQuery('.js-opponent-name').text(players.opponent.name);
  var scoreboardOpponentElem = jQuery('.js-opponent-name').parent('.scoreboard__player');
  scoreboardOpponentElem.attr('data-player-id', players.opponent.id);
});

socket.on('opponentJoin', function(player) {
  jQuery('.js-opponent-name').text(player.name);
  var scoreboardOpponentElem = jQuery('.js-opponent-name').parent('.scoreboard__player');
  scoreboardOpponentElem.attr('data-player-id', player.id);

  var splashText = player.name + ' has joined the game!';
  splashMsg('warm', splashText);
});

socket.on('preGame', function() {
  global.preGame = true;
  var gridHighlight = jQuery('.grid__highlight');
  gridHighlight.show();

  var roomLink = jQuery('.js-copy-link-block');
  roomLink.hide();
});

socket.on('gameStart', function(specialItemCells) {
  global.preGame = false; 
  global.gameLive = true;

  jQuery.each(specialItemCells, function(i, specialItemCell) {
    renderSpecialItemCell(specialItemCell.position)
  });
  
  initHandleTurnChoice();
});

socket.on('msg', function(msg) {
  msgBoxText(msg);
});

socket.on('logMsg', function(msg) {
  var sidebarText = jQuery('.sidebar__text');
  var sidebarHistory = jQuery('.sidebar__text--history');
  sidebarHistory.prepend(sidebarText.html()); 
  sidebarText.html('<p>' + msg + '<p>'); 
});

socket.on('clearMsg', function(msg) {
  var msgBoxText = jQuery('.js-msg-box-text');
  msgBoxText.text('');
});

socket.on('serverDig', function(data) {
  var isOpponentDig = data.isOpponentDig;  
  
  if (isOpponentDig) {
    var playerString = 'Your opponent';
  } else {
    var playerString = 'You';
    jQuery('.turn-choice').attr('disabled', true);
  }
  let splashText = '';
  let closeness = '';
  if (data.isSpecialItem) {
    splashText = playerString + ' dug and found a special item!';
    closeness = 'success';
  } else {
    splashText = playerString + ' dug but found nothing!';
    closeness = 'cold';
  }
  splashMsg(closeness, splashText);

  jQuery('.js-action-box-text').text(splashText);
  var dice = jQuery('.action-box__die');
  dice.remove();

  renderDig(data.coordinates.row, data.coordinates.col, false, data.isSpecialItem);
});

socket.on('closenessMsg', function(data) {
  var infoResult = '';

  switch (data.closeness) {
    case 'cold':
      infoResult = 'Ice cold.';
      break;
    case 'warm':
      infoResult = 'You\'re warm!';
      break;
  }

  splashMsg(data.closeness, infoResult);
});

socket.on('splashMsg',function(data) {
  splashMsg(data.closeness, data.msg) 
});

socket.on('updatePlayerPosition', function(data) {
  updatePlayerPosition(data.coordinates.row, data.coordinates.col, data.isOpponentMove);
});

socket.on('activePlayer', function() {
  clearActionBox();
  removeActiveClasses();
  var currentCell = jQuery('.grid__cell--current');
  currentCell.addClass('grid__cell--active');
  jQuery('.turn-choice').attr('disabled', false);

  var scoreboard = jQuery('.scoreboard');
  scoreboard.removeClass('scoreboard--active-opponent');
  scoreboard.addClass('scoreboard--active-player');
  maybeDisableDigBtn();
});

socket.on('activeOpponent', function() {
  clearActionBox();
  removeActiveClasses();
  var currentCell = jQuery('.grid__cell--opponent-current');
  currentCell.addClass('grid__cell--opponent-active');

  var scoreboard = jQuery('.scoreboard');
  scoreboard.removeClass('scoreboard--active-player');
  scoreboard.addClass('scoreboard--active-opponent');
});

socket.on('roll', function(data) {
  var roll = data.roll;
  var isOpponentRoll = data.isOpponentRoll;
  
  var actionBox = jQuery('.js-action-box-text');
  
  if (isOpponentRoll) {
    actionBox.text(`Your opponent rolled a ${roll}`);
  } else {
    actionBox.text(`You rolled a ${roll}`);
    addReachableClasses(roll);
  }

  var dice = jQuery('.action-box__die');
  dice.remove();

  actionBox.parent().append(`<img src="/images/dice/die_${roll}.svg" alt="Die showing a ${roll}" class="action-box__die">`);
});

socket.on('specialExtraTurn', function(msg) {
  splashMsg('success', msg);
  msgBoxText(msg);
  jQuery('.turn-choice').attr('disabled', false);
  maybeDisableDigBtn();
});

socket.on('specialTreasureRow', function(data) {
  splashMsg('success', data.playerMsg);
  msgBoxText(data.playerMsg);
  var treasureRowCells = jQuery("[data-row='" + data.row + "']");
  treasureRowCells.addClass('grid__treasure-dimension');
});

socket.on('specialTreasureCol', function(data) {
  splashMsg('success', data.playerMsg);
  msgBoxText(data.playerMsg);
  var treasureRowCells = jQuery("[data-col='" + data.col + "']");
  treasureRowCells.addClass('grid__treasure-dimension');
});

socket.on('playerWin', function(data) {
  var successMsg = data.winnerName + ' has won the game!';
  splashMsg('success', successMsg);

  renderDig(data.coordinates.row, data.coordinates.col, true);
  removeActiveClasses();
  jQuery('.grid__cell--reachable').removeClass('grid__cell--reachable');

  var winnerScoreboard = jQuery('[data-player-id="' + data.winnerID + '"]')
  incrementPlayerScore(winnerScoreboard);

  jQuery('.turn-choice').attr('disabled', true);
});

socket.on('playerDisconnect', function(disconnectedUser) {
  var disconnectedUserScoreboardElem = jQuery('[data-player-id="' + disconnectedUser.id + '"]');
  disconnectedUserScoreboardElem.attr('data-player-id', '');
  disconnectedUserScoreboardElem.find('.scoreboard__name').text('');

  // reset all scores to 0
  var playerScoreboardElems = jQuery('.scoreboard__player');
  playerScoreboardElems.each(function(i, elem) {
    var scoreElem = jQuery(elem).find('.scoreboard__score');
    scoreElem.text('0');
    scoreElem.attr('data-player-score', 0);
  });

  splashMsg('success', disconnectedUser.name + ' left the room!');
});

socket.on('resetGame', resetGame);

function initHandleTurnChoice() {
  jQuery('.js-choose-roll').on('click', function() {
    jQuery('.turn-choice').attr('disabled', true);
    socket.emit('chooseRoll');
  });
  jQuery('.js-choose-dig').on('click', function() {
    socket.emit('chooseDig');
  });
}

function removeHandleTurnChoice() {
  jQuery('.js-choose-roll').unbind('click');
  jQuery('.js-choose-dig').unbind('click');
}

/**
 * add reachable class to tiles within roll
 * @param {*} roll 
 */
function addReachableClasses(roll) {
  jQuery('.grid').addClass('turn-active');
  var currentCell = jQuery('.grid__cell--current');
  var currentRow = currentCell.data('row');
  var currentCol = currentCell.data('col');

  for (var i = 0; i < roll; i++) {
    var cells = [];
    cells.push(jQuery('[data-row=' + currentRow + '][data-col=' + (currentCol + (i + 1)) + ']'));
    cells.push(jQuery('[data-row=' + currentRow + '][data-col=' + (currentCol + (i + 1) * -1) + ']'));
    cells.push(jQuery('[data-col=' + currentCol + '][data-row=' + (currentRow + (i + 1)) + ']'));
    cells.push(jQuery('[data-col=' + currentCol + '][data-row=' + (currentRow + (i + 1) * -1) + ']'));

    jQuery(cells).each(function(i, cell) {
      cell.addClass('grid__cell--reachable');
    });
  }
}

function msgBoxText(msg) {
  var msgBoxText = jQuery('.js-msg-box-text');
  msgBoxText.text(msg);
}

function splashMsg(closeness, msg) {
  var splashText = jQuery('.splash-msg__text');
  var splashTextModifierClass = 'splash-msg__text splash-msg__text--' + closeness;
  jQuery(splashText).text(msg)
                  .finish()
                  .removeClass()
                  .addClass(splashTextModifierClass)
                  .fadeIn(1000)
                  .delay(2000)
                  .fadeOut(1000);
}

function renderDig(row, col, success = false, specialItem = false) {
  var digCell = jQuery('[data-row=' + row + '][data-col=' + col + ']');
  if (success) {
    var gridClass = 'grid__cell--treasure';
  } else {
    var gridClass = 'grid__cell--dug';
    if (specialItem) {
      jQuery(digCell).find('.grid__special-item').fadeIn(1000)
                  .delay(2000)
                  .fadeOut(1000);
    }
  }

  digCell.addClass(gridClass);
}

function updatePlayerPosition(row, col, isOpponentMove = false) {
  
  var gridClass = 'grid__cell--current';
  if (isOpponentMove) {
    var gridClass = 'grid__cell--opponent-current';
  } else {
    jQuery('.grid').removeClass('turn-active');
  }
  var currentCell = jQuery('.' + gridClass);
  if (currentCell.length) {
    currentCell.removeClass(gridClass);
  }
  var currentCell = jQuery('[data-row=' + row + '][data-col=' + col + ']');
  currentCell.addClass(gridClass);
}

function removeActiveClasses() {
  var previouslyActivePlayer = jQuery('.grid__cell--active');
  var previouslyActiveOpponent = jQuery('.grid__cell--opponent-active');
  previouslyActivePlayer.removeClass('grid__cell--active');
  previouslyActiveOpponent.removeClass('grid__cell--opponent-active');

  // remove any reachable classes
  var reachableCells = jQuery('.grid__cell--reachable');
  reachableCells.removeClass('grid__cell--reachable');
}

function incrementPlayerScore(playerScoreboard) {
  var score = playerScoreboard.find('.scoreboard__score');
  var currentScore = parseInt(score.attr('data-player-score'));
  score.attr('data-player-score', currentScore + 1);
  score.text(currentScore + 1);
}

/**
 * Emit event to reset the game on the server
 * Reset the screen to how it looks before a game starts
 * Set the global game settings to preGame
 */
function resetGame() {
  global.preGame = false;
  var gridHighlight = jQuery('.grid__highlight');
  gridHighlight.hide();

  global.gameLive = false;
  var gridCells = jQuery('.grid__cell');
  var gridClasses = [
    'grid__cell--active', 
    'grid__cell--current',
    'grid__cell--opponent-active',
    'grid__cell--opponent-current',
    'grid__cell--dug',
    'grid__cell--treasure',
    'grid__cell--reachable'
  ];
  gridCells.removeClass(gridClasses);

  jQuery('.turn-choice').attr('disabled', true);

  jQuery('.grid__treasure-dimension').removeClass('grid__treasure-dimension');

  jQuery('.grid__special-item').remove();

  jQuery('.js-msg-box-text').text('');
  removeHandleTurnChoice();
  clearActionBox();

  var scoreboard = jQuery('.scoreboard');
  scoreboard.removeClass('scoreboard--active-opponent');
  scoreboard.removeClass('scoreboard--active-player');

  socket.emit('playAgain');
}

function renderSpecialItemCell(specialItemCell) {
  var cell = jQuery('[data-row=' + specialItemCell.row + '][data-col=' + specialItemCell.col + ']');
  cell.append('<span class="grid__special-item">?</span>');
  cell.find('.grid__special-item').fadeIn(1000);
}

function maybeDisableDigBtn() {
  // disable dig button if current cell is already dug up
  var currentCell = jQuery('.grid__cell--current');
  var isCellDug = currentCell.hasClass('grid__cell--dug');
  var digBtn = jQuery('.js-choose-dig');
  if (isCellDug) {
    digBtn.attr('disabled', true);
  } else {
    digBtn.attr('disabled', false);
  }
}

function clearActionBox()
{
  var actionBox = jQuery('.js-action-box-text');
  actionBox.text('');
  var dice = jQuery('.action-box__die');
  dice.remove();
}