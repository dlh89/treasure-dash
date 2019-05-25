var cells = $('.grid__cell');
$(cells).on('click', cellClick);

function cellClick(e) {
  var row = jQuery(e.target).data('row');
  var col = jQuery(e.target).data('col');
  var infoText = jQuery('.info__text');
  
  $.ajax({
    method: "POST",
    url: "/result",
    data: { row: row, col: col }
  })
  .done(function( msg ) {
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
    jQuery(e.target).addClass(gridClass);
  });
}
