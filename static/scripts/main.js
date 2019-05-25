$.ajax({
  method: "POST",
  url: "/result",
  data: { row: 2, col: 3 }
})
.done(function( msg ) {
  alert( "Data Saved: " + msg );
});