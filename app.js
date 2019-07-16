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
  console.log('user connected:' + socket.id);
  findRoom(socket);

  socket.on('startPos', function(coordinates) {
    const socketRoom = getSocketRoom(socket);

    const socketRoomUser = socketRoom.users.filter(function(user) {
      return user.id === socket.id;
    });

    socketRoomUser[0].pos = coordinates;

    const allUsersHaveSelectedStartPos = socketRoom.users.every((user) => {
      return user['pos'] != null;
    });

    if (allUsersHaveSelectedStartPos) {
      // randomly choose player to go first
      const randomIndex = generateRandomNumber(playersPerGame);
      const playerTurn = socketRoom.users[randomIndex];
      socketRoom.playerTurn = playerTurn.id;
      
      io.in(socketRoom.name).emit('gameStart');
      io.in(socketRoom.name).emit('logMsg', 'The game is now live!');

      io.to(socketRoom.playerTurn).emit('msg', 'You have been chosen to go first!');
      socket.broadcast.emit('msg', 'Your opponent has been chosen to go first.');
    } else {
      socket.emit('msg', 'Waiting for your opponent to pick a starting position.')
    }
  });

  socket.on('clientDig', function(coordinates) {
    const socketRoom = getSocketRoom(socket);

    // check if it's their turn
    if (socketRoom.playerTurn === socket.id) {

      const closeness = getCloseness(socketRoom, coordinates); 

      if (closeness === 'success') {
        io.to(socketRoom.name).emit('playerWin', {'winner' : socket.id, 'coordinates' : coordinates, 'closeness': closeness});
      } else {
        io.to(socketRoom.name).emit('serverDig', {'coordinates' : coordinates, 'closeness': closeness});
      }
      
      // only send closeness to the player
      socket.emit('closenessMsg', {'closeness': closeness});

      switchPlayerTurn(socketRoom);
      updateTurnText(socket, socketRoom);
    } else {
      if (socketRoom.users.length == playersPerGame) {
        socket.emit('msg', 'Wait for your turn!');
      }
    }
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
  const newUser = {
    id: socket.id,
    pos: null
  }
  room.users.push(newUser); // add user to that room
  socket.join(room.name);

  // send message to the client
  socket.emit('logMsg', 'You have joined '  + room.name);
  socket.emit('logMsg', 'Your ID is '  + socket.id);

  // send message to the room
  io.in(room.name).emit('logMsg', 'Player ' + socket.id + ' has joined the room.');

  if (room.users.length === playersPerGame) {
    setTreasureCoordinates(room);

    io.in(room.name).emit('msg', 'Select a starting position.');
  } else {
    socket.emit('msg', 'Waiting for an opponent...');
  }
}

function getSocketRoom(socket) {
  let socketRoom;
  rooms.forEach(room => {
    const user = room.users.filter(function(user){ 
      return user.id === socket.id;
    });

    if (user) {
      socketRoom = room;
    }
  });

  return socketRoom;
}

function setTreasureCoordinates(room) {
  const rowCount = 10;
  const colCount = 10;

  const treasureRow = generateRandomNumber(rowCount + 1);
  const treasureCol = generateRandomNumber(colCount + 1);

  room.treasureCoordinates = {'row': treasureRow, 'col': treasureCol};
  console.log('treasureCoordinates: ', room.treasureCoordinates);
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

function switchPlayerTurn(socketRoom) {
  const currentPlayerIndex = socketRoom.users.findIndex(function(user) {
    return user.id === socketRoom.playerTurn
  })
  const playerTurn = socketRoom.users[(currentPlayerIndex + 1) % socketRoom.users.length];
  socketRoom.playerTurn = playerTurn.id;
}

function updateTurnText(socket, socketRoom) {
  if (socketRoom.playerTurn === socket.id) {
    socket.emit('msg', 'It\'s your turn!');    
    socket.broadcast.emit('msg', 'It\'s your opponent\'s turn.');    
  } else {
    socket.emit('msg', 'It\'s your opponent\'s turn.');
    socket.broadcast.emit('msg', 'It\'s your turn!');    
  }
}

function generateRandomNumber(range) {
  const random = Math.floor(Math.random() * Math.floor(range));
  return random;
}

http.listen(3000, function() {
  console.log('listening on *:3000');
});