var socket = io('/find-room');

socket.on('connection', function() {
    var playerName = localStorage.getItem('playerName');
    var nameForm = jQuery('.js-enter-name-form');
    var nameInput = jQuery('.js-name-input');
    if (playerName) {
        nameInput.val(playerName);
        disableNameForm();
    } else {
        nameInput.trigger('focus');
    }
    nameForm.on('submit', function (e) {
        e.preventDefault();
        var enterNameForm = jQuery('.js-enter-name-form');
        var enterNameInput = enterNameForm.find('input[type="text"]');
        if (enterNameInput.attr('disabled') === 'disabled') {
            enableNameForm();
        } else {
            disableNameForm();
            playerName = nameInput.val();
            localStorage.setItem('playerName', playerName);
            socket.emit('saveName', playerName); 
        }
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

    jQuery('.js-refresh-rooms-btn').on('click', refreshRoomsList);
});

function disableNameForm() {
    var enterNameForm = jQuery('.js-enter-name-form');
    var enterNameInput = enterNameForm.find('input[type="text"]');
    enterNameInput.attr('disabled', true);
    var enterNameFormBtn = jQuery('.js-enter-name-form-btn');
    enterNameFormBtn.val('Edit');
}

function enableNameForm() {
    var enterNameForm = jQuery('.js-enter-name-form');
    var enterNameInput = enterNameForm.find('input[type="text"]');
    enterNameInput.attr('disabled', false);
    enterNameInput.trigger('focus');
    var enterNameFormBtn = jQuery('.js-enter-name-form-btn');
    enterNameFormBtn.val('Save');
}

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

