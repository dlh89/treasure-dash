var socket = io('/find-room');

socket.on('connection', function() {
    var playerName = localStorage.getItem('playerName');
    var nameForm = jQuery('.js-enter-name-form');
    var nameInput = jQuery('.js-name-input');
    nameInput.val(playerName);
    nameForm.on('submit', function (e) {
        e.preventDefault();
        playerName = nameInput.val();

        var roomListBlock = jQuery('.js-rooms-list-block');
        roomListBlock.removeClass('block--hidden');

        localStorage.setItem('playerName', playerName);
        socket.emit('saveName', playerName); 
    });

    var createRoomForm = jQuery('.js-create-room-form');
    createRoomForm.on('submit', function(e) {
        e.preventDefault();
        var roomName = jQuery('.js-room-name-input').val();
        var postData = {
            'roomName': roomName
        };  
        var errorNotice = jQuery('.js-error-notice');
    
        jQuery.post("/create-room", postData)
            .done(function(data) {
                if (data.status == 'success') {
                    errorNotice.empty();
                    errorNotice.hide();
                    refreshRoomsList();
                    closeModal('.js-create-room-modal');
                } else {
                    errorNotice.html(data.errorMessage);
                    errorNotice.show();
                }
            });

    });

    var refreshBtn = jQuery('.js-refresh-rooms-btn').on('click', refreshRoomsList);
});


/**
 * Make an AJAX request to get the current rooms
 * Update the contents of the rooms list table to display current rooms
 */
function refreshRoomsList() {
    jQuery.get("/room-list")
    .done(function(rooms) {
        var roomsListElem = jQuery('.js-rooms-list tbody');
        roomsListElem.empty();
        var rooms = rooms.sort((a, b) => a.name.localeCompare(b.name)); // sort alphabetically by name
        jQuery(rooms).each(function(index, room) {
            const encodedRoomLink = encodeURI(room.link);

            roomsListElem.append(`
                <tr>
                    <td><a href="${encodedRoomLink}"></a></td> 
                    <td>${room.playerCount}</td>
                </tr>
            `);

            // Add room name after so we can use jQuery's text method to escape html
            var appendedAnchor = jQuery(roomsListElem).find('td a').last();
            appendedAnchor.text(room.name);
        });
    })       
}

