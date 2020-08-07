var socket = io('ws://localhost:3000/find-room', {transports: ['websocket']});

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
            roomsListElem.append(`
                <tr>
                    <td><a href="/game/${room.name.toLowerCase()}">${room.name}</a></td>
                    <td>${room.users.length}</td>
                </tr>
            `);
        });
    })       
}

