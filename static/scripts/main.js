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
    switch (msg) {
      case 'success':
        infoResult = 'Congratulations!';
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
    jQuery(infoText).text(infoResult);
    var infoTextModifierClass = 'info__text info__text--' + msg;
    jQuery(infoText).removeClass();
    jQuery(infoText).addClass(infoTextModifierClass);
  });
}
