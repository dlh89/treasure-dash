var socket = io();

var cells = $('.grid__cell');
$(cells).on('click', cellClick);

function cellClick(e) {
  var row = jQuery(e.target).data('row');
  var col = jQuery(e.target).data('col');

  socket.emit('clientDig', {'row': row, 'col': col});
}

socket.on('msg', function(msg) {
  console.log('msg: ', msg);
  var msgBoxText = jQuery('.msg-box__text');
  msgBoxText.text(msg);
});

socket.on('sidebarMsg', function(msg) {
  console.log('sidebarMsg: ', msg);
  var sidebarText = jQuery('.sidebar__text');
  var sidebarHistory = jQuery('.sidebar__text--history');
  sidebarHistory.prepend(sidebarText.text()); 
  sidebarText.html('<p>' + msg + '<p>'); 
});

socket.on('clearMsg', function(msg) {
  var msgBoxText = jQuery('.msg-box__text');
  msgBoxText.text('');
});

socket.on('serverDig', function(data) {
  var digCell = jQuery('[data-row=' + data.coordinates.row + '][data-col=' + data.coordinates.col + ']');

  var gridClass = 'grid__cell--dug';

  if (data.closeness === 'success') {
    gridClass = 'grid__cell--treasure';
  }

  digCell.addClass(gridClass);
});

socket.on('closenessMsg', function(data) {
  var infoText = jQuery('.info__text');
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

  var infoTextModifierClass = 'info__text info__text--' + data.closeness;
  jQuery(infoText).text(infoResult)
                  .finish()
                  .removeClass()
                  .addClass(infoTextModifierClass)
                  .fadeIn(1000)
                  .delay(2000)
                  .fadeOut(1000);

})