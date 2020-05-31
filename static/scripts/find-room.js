var socket = io('/find-room');

socket.on('connection', function(rooms) {
    console.log('connect');
    console.log('rooms:');
    console.log(rooms);
});