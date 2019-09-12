global = {
  gameLive: false
}

var socket = io();

var cells = $('.grid__cell');
$(cells).on('click', cellClick);

function cellClick(e) {
  var row = jQuery(e.target).data('row');
  var col = jQuery(e.target).data('col');
  if (global.gameLive === true) {
    socket.emit('clientDig', {'row': row, 'col': col});
  } else {
    socket.emit('startPos', {'row': row, 'col': col});
  }
}

socket.on('gameStart', function() {
  global.gameLive = true;
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
  renderDig(data.coordinates.row, data.coordinates.col);
});

socket.on('playerWin', function(data) {
  var successMsg = 'Player ' + data.winner + ' has won the game!';
  splashMsg('success', successMsg);

  renderDig(data.coordinates.row, data.coordinates.col, true);
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
});

socket.on('activeOpponent', function() {
  removeActiveClasses();
  var currentCell = jQuery('.grid__cell--opponent-current');
  currentCell.addClass('grid__cell--opponent-active');
});

socket.on('roll', function(data) {
  var roll = data.roll;
  var isOpponentRoll = data.isOpponentRoll;
  
  var diceBox = jQuery('.js-dice-box-text')
  
  if (isOpponentRoll) {
    diceBox.text(`Your opponent rolled a ${roll}`);

    // remove any reachable classes
    var reachableCells = jQuery('.grid-cell--reachable');
    reachableCells.removeClass('grid-cell--reachable');
  } else {
    diceBox.text(`You rolled a ${roll}`);
    addReachableClasses(roll);
  }
});

/**
 * add reachable class to tiles within roll
 * @param {*} roll 
 */
function addReachableClasses(roll) {
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
  var infoText = jQuery('.info__text');
  var infoTextModifierClass = 'info__text info__text--' + closeness;
  jQuery(infoText).text(msg)
                  .finish()
                  .removeClass()
                  .addClass(infoTextModifierClass)
                  .fadeIn(1000)
                  .delay(2000)
                  .fadeOut(1000);
}

function renderDig(row, col, success = false) {
  var digCell = jQuery('[data-row=' + row + '][data-col=' + col + ']');

  var gridClass = 'grid__cell--dug';

  if (success)
  {
    gridClass = 'grid__cell--treasure';
  }

  digCell.addClass(gridClass);
}

function updatePlayerPosition(row, col, isOpponentMove = false) {
  var gridClass = 'grid__cell--current';
  if (isOpponentMove) {
    var gridClass = 'grid__cell--opponent-current';
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
}