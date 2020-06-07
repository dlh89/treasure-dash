'use strict';

var socket = io('/find-room');

socket.on('connection', function (rooms) {
    console.log('connect');
    jQuery(rooms).each(function (i, room) {
        console.log('room.name: ', room.name);
    });

    var nameForm = jQuery('.js-enter-name-form');
    nameForm.on('submit', function (e) {
        e.preventDefault();
        var nameInput = jQuery('.js-name-input');
        playerName = nameInput.val();

        var roomListBlock = jQuery('.js-rooms-list-block');
        roomListBlock.removeClass('block--hidden');

        socket.emit('saveName', playerName);
    });
});