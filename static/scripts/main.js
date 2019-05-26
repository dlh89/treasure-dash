$(document).ready(function() {
  var socket = io.connect('http://127.0.0.1:5000');

  socket.on('user_connected', function(request) {
    console.log(request);
  });

  socket.on('dig', function(digData) {
    msg = digData['result'];
    var infoText = jQuery('.info__text');
    var infoResult = '';
      var gridClass = 'grid__cell--dug';
      switch (msg) {
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
      var infoTextModifierClass = 'info__text info__text--' + msg;
      jQuery(infoText).text(infoResult)
                      .finish()
                      .removeClass()
                      .addClass(infoTextModifierClass)
                      .fadeIn(1000)
                      .delay(2000)
                      .fadeOut(1000);
      jQuery('[data-row=' + digData['row'] + '][data-col=' + digData['col'] + ']').addClass(gridClass);
  });

  var cells = $('.grid__cell');
  $(cells).on('click', cellClick);
  
  function cellClick(e) {
    var row = jQuery(e.target).data('row');
    var col = jQuery(e.target).data('col');
    
    socket.emit('dig', {row: row, col: col});
  }
})
