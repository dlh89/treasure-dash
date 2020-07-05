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
    socket.emit('startPos', {'row': row, 'col': col});
  }
}

socket.on('connection', function() {
  var roomNameElem = jQuery('.js-room-name');
  var roomName = roomNameElem.attr('data-room-name');
  console.log('roomName: ', roomName);
  socket.emit('joinRoom', roomName);
});

socket.on('preGame', function() {
  global.preGame = true;
  jQuery('.grid').addClass('turn-active');
});

socket.on('gameStart', function() {
  global.preGame = false; 
  global.gameLive = true;
  
  initHandleTurnChoice();
});

socket.on('msg', function(msg) {
  console.log('msg: ', msg);
  var msgBoxText = jQuery('.js-msg-box-text');
  msgBoxText.text(msg);
});

socket.on('logMsg', function(msg) {
  console.log('logMsg: ', msg);
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
    splashMsg('cold', 'Your opponent dug but found nothing!');
  } else {
    splashMsg('cold', 'You dug but found nothing!');
  }
  renderDig(data.coordinates.row, data.coordinates.col);
});

socket.on('closenessMsg', function(data) {
  var infoResult = '';

  switch (data.closeness) {
    case 'cold':
      infoResult = 'Ice cold.';
      break;
    case 'warm':
      infoResult = 'Getting warm.';
      break;
  }

  splashMsg(data.closeness, infoResult);
});

socket.on('updatePlayerPosition', function(data) {
  updatePlayerPosition(data.coordinates.row, data.coordinates.col, data.isOpponentMove);
});

socket.on('activePlayer', function() {
  removeActiveClasses();
  var currentCell = jQuery('.grid__cell--current');
  currentCell.addClass('grid__cell--active');
  jQuery('.turn-choice').attr('disabled', false);
});

socket.on('activeOpponent', function() {
  removeActiveClasses();
  var currentCell = jQuery('.grid__cell--opponent-current');
  currentCell.addClass('grid__cell--opponent-active');
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
});

socket.on('playerWin', function(data) {
  var successMsg = data.winner + ' has won the game!';
  splashMsg('success', successMsg);

  renderDig(data.coordinates.row, data.coordinates.col, true);
  removeActiveClasses();
  jQuery('.grid-cell--reachable').removeClass('grid-cell--reachable')
});

socket.on('resetGame', resetGame);

function initHandleTurnChoice() {
  jQuery('.js-choose-roll').on('click', function() {
    jQuery('.turn-choice').attr('disabled', true);
    socket.emit('chooseRoll');
  });
  jQuery('.js-choose-dig').on('click', function() {
    jQuery('.turn-choice').attr('disabled', true);
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
      cell.addClass('grid-cell--reachable');
    });
  }
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

function renderDig(row, col, success = false) {
  var digCell = jQuery('[data-row=' + row + '][data-col=' + col + ']');
  if (success) {
    var gridClass = 'grid__cell--treasure';
  } else {
    var gridClass = 'grid__cell--dug';
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
  var reachableCells = jQuery('.grid-cell--reachable');
  reachableCells.removeClass('grid-cell--reachable');
}

/**
 * Emit event to reset the game on the server
 * Reset the screen to how it looks before a game starts
 * Set the global game settings to preGame
 */
function resetGame() {
  global.gameLive = false;
  var gridCells = jQuery('.grid__cell');
  var gridClasses = [
    'grid__cell--active', 
    'grid__cell--current',
    'grid__cell--opponent-active',
    'grid__cell--opponent-current',
    'grid__cell--dug',
    'grid__cell--treasure'
  ];
  gridCells.removeClass(gridClasses);

  jQuery('.turn-choice').attr('disabled', true);

  jQuery('.js-msg-box-text').text('');
  jQuery('.js-action-box-text').text('');
  removeHandleTurnChoice();

  socket.emit('playAgain');
}