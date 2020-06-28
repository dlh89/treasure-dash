var socket = io('/find-room');

socket.on('connection', function(rooms, playerName) {
    var nameForm = jQuery('.js-enter-name-form');
    var nameInput = jQuery('.js-name-input');
    nameInput.val(playerName);
    nameForm.on('submit', function (e) {
        e.preventDefault();
        playerName = nameInput.val();

        var roomListBlock = jQuery('.js-rooms-list-block');
        roomListBlock.removeClass('block--hidden');

        socket.emit('saveName', playerName); 
    });

    var createRoomForm = jQuery('.js-create-room-form');
    createRoomForm.on('submit', function(e) {
        console.log('submit');
        e.preventDefault();
        var roomName = jQuery('.js-room-name-input').val();
        var postData = {
            'roomName': roomName
        };  
        var errorNotice = jQuery('.js-error-notice');
    
        jQuery.post("/create-room", postData)
            .done(function(data) {
                if (data.status == 'success') {
                    errorNotice.html('');
                    errorNotice.hide();
                } else {
                    errorNotice.html(data.errorMessage);
                    errorNotice.show();
                }
            });

    });
});

