const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const rooms = [];
const playersPerGame = 2;

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/views/index.html');
});

app.use(express.static('static'));

io.on('connection', function(socket) {
  console.log('a user connected');
  findRoom(socket);

  socket.on('clientDig', function(coordinates) {
    const socketRoom = getSocketRoom(socket);

    const closeness = getCloseness(socketRoom, coordinates);
    io.to(socketRoom.name).emit('serverDig', {'coordinates' : coordinates, 'closeness': closeness});
  });

  socket.on('disconnect', function() {
    // remove player from room users
    const socketRoom = getSocketRoom(socket);
    const socketIndex = socketRoom.users.indexOf(socketRoom);
  
    socketRoom.users.splice(socketIndex, 1);
  
    // emit msg to that room to notify other player
    socket.broadcast.to(socketRoom.name).emit('msg', 'Player ' + socket.id + ' has left the room.');
  });
});

function findRoom(socket) {
  let roomFound = false;
  // loop through the rooms looking for a slot
  rooms.forEach(room => {
    if (room.users.length < 2) {
      joinRoom(socket, room);
      roomFound = true;
    }
  });

  if (!roomFound) {
    // create a new room
    const roomName = 'room' + (rooms.length + 1);
    rooms.push({
      'name': roomName,
      'users': []
    });

    joinRoom(socket, rooms[rooms.length - 1]);
  }
}

function joinRoom(socket, room) {
  room.users.push(socket.id); // add user to that room
  socket.join(room.name);

  // send message to the client
  socket.emit('msg', 'You have joined '  + room.name);
  socket.emit('msg', 'Your ID is '  + socket.id);

  // send message to the room
  socket.broadcast.to(room.name).emit('msg', 'Player ' + socket.id + ' has joined the room.');

  if (room.users.length === playersPerGame) {
    setTreasureCoordinates(room);
  }
}

function getSocketRoom(socket) {
  let socketRoom;
  rooms.forEach(room => {
    if (room.users.indexOf(socket.id) > -1) {
      socketRoom = room;
    };
  });

  return socketRoom;
}

function setTreasureCoordinates(room) {
  const rowCount = 10;
  const colCount =  10;

  const treasureRow = Math.floor(Math.random() * Math.floor(rowCount + 1));
  const treasureCol = Math.floor(Math.random() * Math.floor(colCount + 1));

  room.treasureCoordinates = {'row': treasureRow, 'col': treasureCol};
}

function getCloseness(room, coordinates) {
  const treasureRow = room.treasureCoordinates.row;
  const treasureCol = room.treasureCoordinates.col;

  const rowClose = inRange(coordinates.row, treasureRow - 1, treasureRow + 1);
  const colClose = inRange(coordinates.col, treasureCol - 1, treasureCol + 1);

  if (coordinates.row == treasureRow && coordinates.col == treasureCol) {
    return 'success';
  } else if (rowClose && colClose) {
    return 'warm';
  } else {
    return 'cold';
  }
}

function inRange(value, min, max) {
  if (value >= min && value <= max) {
    return true;
  }

  return false;
}

http.listen(3000, function() {
  console.log('listening on *:3000');
});