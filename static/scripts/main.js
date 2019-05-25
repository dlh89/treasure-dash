$.ajax({
  url: "/result",
  context: document.body,
  success: function(){
    // $(this).addClass("done");
    console.log('success');
  }
});