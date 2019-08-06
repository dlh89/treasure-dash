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
  var msgBoxText = jQuery('.msg-box__text');
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
  var msgBoxText = jQuery('.msg-box__text');
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
    case 'success':
      infoResult = 'Congratulations!';
      gridClass = 'grid__cell--treasure';
      break;
    case 'cold':
      infoResult = 'Ice cold.';
      break;
    case 'warm':
      infoResult = 'Getting warm.';
      break;
    case 'hot':
      infoResult = 'Red hot!';
      break;
  }

  splashMsg(data.closeness, infoResult);
});

socket.on('updatePlayerPosition', function(data) {
  updatePlayerPosition(data.coordinates.row, data.coordinates.col);
});

socket.on('updateOpponentPosition', function(data) {
  updateOpponentPosition(data.coordinates.row, data.coordinates.col);
});

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

function updatePlayerPosition(row, col) {
  debugger;
  var currentCell = jQuery('[data-row=' + row + '][data-col=' + col + ']');
  var gridClass = 'grid__cell--current';
  currentCell.addClass(gridClass);
}

function updateOpponentPosition(row, col) {
  var currentCell = jQuery('[data-row=' + row + '][data-col=' + col + ']');
  var gridClass = 'grid__cell--opponent-current';
  currentCell.addClass(gridClass);
}