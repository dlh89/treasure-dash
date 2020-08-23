const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');

const rooms = [];

const PLAYERS_PER_GAME = 2;
const MAX_ROLL = 6;
const CLOSE_RANGE = 2;
const ROW_COUNT = 10;
const COL_COUNT = 10;
const SPECIAL_ITEMS = [
  {
    'type': 'extraTurn',
    'count': 3 
  },
  {
    'type': 'treasureRow',
    'count': 1 
  },
  {
    'type': 'treasureCol',
    'count': 1 
  }
];
const PLAYERNAME_MAX_LENGTH = 14;

const GAME_NS = io.of('/game');
const FIND_ROOM_NS = io.of('/find-room');

createRoom('Test'); // create a test room

// set the view engine to ejs
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
  const notice = req.query.notice;
  res.render(__dirname + '/views/find-room', {rooms: rooms, notice: notice});
});

app.get('/game/:room', function(req, res) {
  const room = getRoomByName(req.params.room);
  if (room && room.users.length < PLAYERS_PER_GAME) {
    res.render(__dirname + '/views/game', {room_name: req.params.room});
  } else {
    const notice = encodeURIComponent('Room either doesn\'t exist or is full.');
    res.redirect('/?notice=' + notice);
  }
});

app.get('/room-list', function(req, res) {
  res.send(rooms);
});

app.post('/create-room', function(req, res) {
  const newRoom = createRoom(req.body.roomName);
  var data = {
    status: 'success',
    errorMessage: ''
  };

  if (!newRoom) {
    data.status = 'error';
    data.errorMessage = 'A room with that name already exists. Please try again with another name.';
  }
  res.send(data);
});

app.use(express.static('static'));

FIND_ROOM_NS.on('connection', function(socket) {
  socket.emit('connection');
});

GAME_NS.on('connection', function(socket) {
  socket.emit('connection');
  console.log('user connected:' + socket.id);

  socket.on('joinRoom', function(roomName, playerName) {
    if (!playerName || playerName.length > PLAYERNAME_MAX_LENGTH) {
      playerName = "Unnamed";
    }
    var room = getRoomByName(roomName);
    if (room && room.users.length < PLAYERS_PER_GAME) {
      joinRoom(socket, room, playerName);
    } else {
      // TODO display something in html if no room exists? 404?
    }
  });

  socket.on('startPos', function(coordinates) {
    const socketRoom = getSocketRoom(socket);
    const socketRoomUser = getSocketRoomUser(socketRoom, socket.id);

    if (!socketRoomUser.pos)
    {
      socketRoomUser.pos = coordinates;
      emitPositionUpdates(socketRoomUser, coordinates);
  
      const closeness = getCloseness(socketRoom, coordinates);
      socket.emit('closenessMsg', {'closeness': closeness});
    }

    const allUsersHaveSelectedStartPos = socketRoom.users.every((user) => {
      return user['pos'] != null;
    });

    if (socketRoom.users.length == PLAYERS_PER_GAME && allUsersHaveSelectedStartPos) {
      // randomly choose player to go first
      const randomIndex = generateRandomNumber(PLAYERS_PER_GAME);
      const playerTurn = socketRoom.users[randomIndex];
      socketRoom.playerTurn = playerTurn.id;

      GAME_NS.in(socketRoom.name).emit('gameStart', socketRoom.specialItemCells);
      GAME_NS.in(socketRoom.name).emit('logMsg', 'The game is now live!');
      
      const activePlayerSocket = getSocketFromID(socketRoom.playerTurn);    

      activePlayerSocket.emit('msg', 'You have been chosen to go first!');
      activePlayerSocket.to(socketRoom.name).emit('msg', 'Your opponent has been chosen to go first.');
      activePlayerSocket.emit('activePlayer');
      activePlayerSocket.to(socketRoom.name).emit('activeOpponent');
    } else if (socketRoom.users.length == PLAYERS_PER_GAME) {
      socket.emit('msg', 'Waiting for your opponent to pick a starting position.')
    }
  });

  socket.on('clientMove', function(coordinates) {
    const socketRoom = getSocketRoom(socket);

    // check if it's their turn
    if (isPlayersTurn(socketRoom, socket.id)) {
      const socketRoomUser = getSocketRoomUser(socketRoom, socket.id);

      if (socketRoomUser.roll)
      {
        // check move is in range
        const isValidMove = getIsValidMove(socketRoomUser.pos, coordinates, socketRoomUser.roll)
        if (!isValidMove) { 
          const msgText = `Invalid move! You only rolled a ${socketRoomUser.roll}.`;
          socket.emit('msg', msgText);
        } else {
          // update their position
          socketRoomUser.pos = coordinates;
      
          const closeness = getCloseness(socketRoom, coordinates); 
          emitPositionUpdates(socketRoomUser, coordinates);
          
          // only send closeness to the player
          socket.emit('closenessMsg', {'closeness': closeness});
    
          switchPlayerTurn(socketRoom);
          updateTurnText(socket, socketRoom);
        }
      }
    } else {
      socket.emit('msg', 'Wait for your turn!');
    }
  });

  socket.on('disconnect', function() {
    // remove player from room users
    const socketRoom = getSocketRoom(socket);

    if (socketRoom) {
      const socketRoomUser = getSocketRoomUser(socketRoom, socket.id);
      const socketIndex = socketRoom.users.indexOf(socketRoomUser);
      socketRoom.users.splice(socketIndex, 1);

      socket.to(socketRoom.name).emit('msg', `${socketRoomUser.name} has left the room.`);
      socket.to(socketRoom.name).emit('playerDisconnect', { name: socketRoomUser.name, id: socketRoomUser.id });

      resetGame(socketRoom);
    }
  });

  socket.on('chooseRoll', function() {
    const socketRoom = getSocketRoom(socket);
    if (isPlayersTurn(socketRoom, socket.id)) {
      rollDice(socketRoom, socket);
    }
  });

  socket.on('chooseDig', function() {
    const socketRoom = getSocketRoom(socket);
    if (isPlayersTurn(socketRoom, socket.id)) {
      const socketRoomUser = getSocketRoomUser(socketRoom, socket.id);
      const digPosition = {
        row: socketRoomUser.pos.row,
        col: socketRoomUser.pos.col
      };
      const isPositionAlreadyDug = socketRoom.dugCells.filter(
        dugCell => dugCell.row == socketRoomUser.pos.row && dugCell.col == socketRoomUser.pos.col
      ).length > 0;

      if (!isPositionAlreadyDug) {
        socketRoom.dugCells.push(digPosition);
        if (socketRoomUser.pos.row == socketRoom.treasureCoordinates.row &&
          socketRoomUser.pos.col == socketRoom.treasureCoordinates.col) {
            const winner = {
              'winnerName' : socketRoomUser.name,
              'winnerID': socketRoomUser.id,
              'coordinates' : socketRoomUser.pos
            }
            GAME_NS.in(socketRoom.name).emit('playerWin', winner);
            resetGame(socketRoom);
        } else {
          const specialItem = socketRoom.specialItemCells.find((specialItemCell) => {
            return specialItemCell.position.row == socketRoomUser.pos.row && specialItemCell.position.col == socketRoomUser.pos.col
          });

          socket.emit('serverDig', {
            'coordinates' : socketRoomUser.pos,
            'isOpponentDig': false,
            'isSpecialItem': specialItem
          });
          socket.to(socketRoom.name).emit('serverDig', {
            'coordinates' : socketRoomUser.pos,
            'isOpponentDig': true,
            'isSpecialItem': specialItem
          });
          if (specialItem) {
            // Remove the specialItem from the room
            const specialItemIndex = socketRoom.specialItemCells.indexOf(specialItem);
            socketRoom.specialItemCells.splice(specialItemIndex, 1);

            switch(specialItem.type) {
              case 'extraTurn':
                specialExtraTurn(socket);
                break;
              case 'treasureRow':
                specialTreasureRow(socket, socketRoom);
                break;
              case 'treasureCol':
                specialTreasureCol(socket, socketRoom);
                break;
            }
          } else {
            switchPlayerTurn(socketRoom);
            updateTurnText(socket, socketRoom);
          }
        }
      } else {
          socket.emit('msg', 'That position has already been dug up!');
      }
    }
  });

  socket.on('playAgain', function() {
    const socketRoom = getSocketRoom(socket);
    const socketRoomUser = getSocketRoomUser(socketRoom, socket.id);
    socketRoomUser.readyToPlayAgain = true;
    const allUsersReadyToPlayAgain = socketRoom.users.every((user) => {
      return user['readyToPlayAgain'] === true;
    });
    if (allUsersReadyToPlayAgain) {
      initGame(socket, socketRoom);
    }
  });
});

function findRoom(socket, playerName) {
  let roomFound = false;
  // loop through the rooms looking for a slot
  for (let room of rooms) {
    if (room.users.length < 2) {
      joinRoom(socket, room, playerName);
      roomFound = true;
      break;
    }
  }

  if (!roomFound) {
    // create a new room
    const roomName = 'room' + (rooms.length + 1);
    createRoom(roomName);

    joinRoom(socket, rooms[rooms.length - 1], playerName);
  }
}

function createRoom(roomName) {
  const roomNameAlreadyExists = rooms.some(
    room => room.name.toLowerCase() == roomName.toLowerCase()
  );
  
  if (!roomNameAlreadyExists) {
    // room isn't actually created in socket io until a socket connects
    rooms.push({
      'name': roomName,
      'users': []
    });

    return true;
  }

  return false;
}

function joinRoom(socket, room, playerName) {
  const newUser = {
    id: socket.id,
    name: playerName,
    pos: null
  }
  room.users.push(newUser); // add user to that room
  socket.join(room.name);

  // send message to the client
  socket.emit('logMsg', `You have joined '${room.name}`);
  socket.emit('logMsg', `Your player name is ${playerName}`);

  // populate the player names
  const opponentName = getOpponentName(playerName, room);
  const opponent = getUserByName(opponentName, room);
  const opponentId = opponent ? opponent.id : null;
  const players = {
    player: {
      name: playerName,
      id: socket.id
    },
    opponent: {
      name: opponentName,
      id: opponentId
    }
  }
  socket.emit('playerJoin', players);

  socket.to(room.name).emit('opponentJoin', {name: playerName, id: socket.id});

  // send message to the room
  GAME_NS.in(room.name).emit('logMsg', `Player '${playerName}' has joined the room.`);

  initGame(socket, room);
}

function initGame(socket, room) {
  if (room.users.length === PLAYERS_PER_GAME) {
    room.users.forEach(user => {
      user.readyToPlayAgain = false;
    });
    room.dugCells = [];
    room.specialItemCells = [];

    SPECIAL_ITEMS.forEach((specialItem) => {
      for (var i = 0; i < specialItem.count; i++) {
        const specialItemPosition = getRandomCell(room.specialItemCells);
        const newSpecialItem = {
          'type': specialItem.type,
          'position': specialItemPosition
        };
        room.specialItemCells.push(newSpecialItem);
      }
    });

    console.log('room.specialItemCells: ', room.specialItemCells);

    setTreasureCoordinates(room);
    GAME_NS.in(room.name).emit('preGame')
    GAME_NS.in(room.name).emit('msg', 'Select a starting position.');
  } else {
    socket.emit('msg', 'Waiting for an opponent...');
  }
}

function getRandomCell(excludeLocations = false) {
  var randomCell = {
    row: generateRandomNumber(ROW_COUNT) + 1,
    col: generateRandomNumber(COL_COUNT) + 1
  };

  var isExcludedLocation = excludeLocations.find((excludeLocation) => {
    return excludeLocation.position.row == randomCell.row &&
    excludeLocation.position.col == randomCell.col
  });

  while (isExcludedLocation) {
    randomCell = {
      row: generateRandomNumber(ROW_COUNT) + 1,
      col: generateRandomNumber(COL_COUNT) + 1
    };

    isExcludedLocation = excludeLocations.find((excludeLocation) => {
      return excludeLocation.position.row == randomCell.row &&
      excludeLocation.position.col == randomCell.col
    });
  }

  return randomCell;
};

function getSocketRoom(socket) {
  let socketRoom;
  rooms.forEach(room => {
    const user = room.users.filter(function(user){ 
      return user.id === socket.id;
    });

    if (user.length) {
      socketRoom = room;
    }
  });

  return socketRoom;
}

function setTreasureCoordinates(room) {
  let treasureRow = generateRandomNumber(ROW_COUNT);
  treasureRow++;
  let treasureCol = generateRandomNumber(COL_COUNT);
  treasureCol++;

  room.treasureCoordinates = {'row': treasureRow, 'col': treasureCol};
  console.log('treasureCoordinates: ', room.treasureCoordinates);
}

function getCloseness(room, coordinates) {
  const treasureRow = room.treasureCoordinates.row;
  const treasureCol = room.treasureCoordinates.col;

  const rowDistance = getDistance(treasureRow, coordinates.row);
  const colDistance = getDistance(treasureCol, coordinates.col);

  const totalDistance = rowDistance + colDistance;

  if (totalDistance <= CLOSE_RANGE) {
    return 'warm';
  } else {
    return 'cold';
  }
}

/**
 * Always return positive number
 * @param {*} cellA 
 * @param {*} cellB 
 */
function getDistance(cellA, cellB) {
  let distance;
  if (cellA > cellB) {
    distance = cellA - cellB;
  } else {
    distance = cellB - cellA;
  }

  return distance;
}

function inRange(value, min, max) {
  if (value >= min && value <= max) {
    return true;
  }

  return false;
}

function switchPlayerTurn(socketRoom) {
  const playerTurn = getInactivePlayer(socketRoom);
  socketRoom.playerTurn = playerTurn.id;

  const activePlayerSocket = getSocketFromID(playerTurn.id);
  activePlayerSocket.emit('activePlayer');
  activePlayerSocket.to(socketRoom.name).emit('activeOpponent');
}

/**
 * Get the player who's turn it isn't
 * @param {*} socketRoom 
 */
function getInactivePlayer(socketRoom) {
  const currentPlayerIndex = socketRoom.users.findIndex(function(user) {
    return user.id === socketRoom.playerTurn
  })
  const otherPlayer = socketRoom.users[(currentPlayerIndex + 1) % socketRoom.users.length];

  return otherPlayer;
}

/**
 * Get the name of the other player in the room
 * @param {String} playerName The name of this player
 * @param {object} socketRoom
 */
function getOpponentName(playerName, socketRoom) {
  let otherPlayerName = null;

  if (socketRoom.users.length === 2) {
    const currentPlayerIndex = socketRoom.users.findIndex(function(user) {
      return user.name === playerName
    });
    otherPlayerName = socketRoom.users[(currentPlayerIndex + 1) % socketRoom.users.length].name;
  }

  return otherPlayerName;
}

function getUserByName(playerName, socketRoom) {
  const userIndex = socketRoom.users.findIndex(function(user) {
    return user.name === playerName
  });

  let user = null;
  if (userIndex !== -1) {
    user = socketRoom.users[userIndex];
  }

  return user;
}

function updateTurnText(socket, socketRoom) {
  if (socketRoom.playerTurn === socket.id) {
    socket.emit('msg', 'It\'s your turn!');    
    socket.to(socketRoom.name).emit('msg', 'It\'s your opponent\'s turn.');    
  } else {
    socket.emit('msg', 'It\'s your opponent\'s turn.');
    socket.to(socketRoom.name).emit('msg', 'It\'s your turn!');    
  }
}

function generateRandomNumber(range) {
  const random = Math.floor(Math.random() * Math.floor(range));
  return random;
}

function getSocketRoomUser(socketRoom, socketID) {
  const socketRoomUser = socketRoom.users.filter(function(user) {
    return user.id === socketID;
  });

  return socketRoomUser[0];
}

function rollDice(socketRoom, socket) {
  const activePlayerID = socketRoom.playerTurn;
  const roll = generateRandomNumber(MAX_ROLL);
  const socketRoomUser = getSocketRoomUser(socketRoom, activePlayerID)
  socketRoomUser.roll = roll + 1;

  activePlayerSocket = getSocketFromID(activePlayerID);
  activePlayerSocket.emit('logMsg', `You rolled a ${socketRoomUser.roll}`);
  activePlayerSocket.to(socketRoom.name).emit('logMsg', `Your opponent rolled a ${socketRoomUser.roll}`)
  activePlayerSocket.emit('roll', {roll: socketRoomUser.roll, isOpponentRoll: false});
  activePlayerSocket.to(socketRoom.name).emit('roll', {roll: socketRoomUser.roll, isOpponentRoll: true});
}

function getSocketFromID(socketID)
{
  const socket = GAME_NS.sockets[socketID];
  return socket;
}

function getIsValidMove(currentPos, newPos, roll) {
  if (newPos.col === currentPos.col) {
    if (newPos.row <= (currentPos.row + roll) 
    && newPos.row >= (currentPos.row - roll)) {
      return true;
    }
  }

  if (newPos.row === currentPos.row) {
    if (newPos.col <= (currentPos.col + roll)
    && newPos.col >= (currentPos.col - roll)) {
      return true;
    }
  }

  return false;
}

function emitPositionUpdates(socketRoomUser, coordinates) {
  const activeSocket = getSocketFromID(socketRoomUser.id);
  const socketRoom = getSocketRoom(socketRoomUser);
  activeSocket.emit('updatePlayerPosition', {'coordinates' : coordinates, 'isOpponentMove': false});
  activeSocket.to(socketRoom.name).emit('updatePlayerPosition', {'coordinates' : coordinates, 'isOpponentMove': true});
}

function isPlayersTurn(socketRoom, playerId) {
  return socketRoom.playerTurn === playerId;
}

function getRoomByName(roomName) {
  room = rooms.filter(
    room => room.name.toLowerCase() === roomName.toLowerCase()
  );

  return room[0];
}

function specialExtraTurn(socket) {
  // TODO allow serverDig msg to be displayed before these
  const playerMsg = 'You got an extra turn!';
  socket.emit('specialExtraTurn', playerMsg);
  const socketRoom = getSocketRoom(socket);
  const opponentMsg = 'Your opponent got an extra turn!';
  socket.to(socketRoom.name).emit('splashMsg', {closeness: 'success', msg: opponentMsg});
  socket.to(socketRoom.name).emit('msg', opponentMsg);
}

function specialTreasureRow(socket, socketRoom) {
  const playerMsg = 'You found out which row the treasure is in!';
  socket.emit('specialTreasureRow', {playerMsg: playerMsg, row: socketRoom.treasureCoordinates.row});
  switchPlayerTurn(socketRoom);
  updateTurnText(socket, socketRoom);
}

function specialTreasureCol(socket, socketRoom) {
  const playerMsg = 'You found out which column the treasure is in!';
  socket.emit('specialTreasureCol', {playerMsg: playerMsg, col: socketRoom.treasureCoordinates.col});
  switchPlayerTurn(socketRoom);
  updateTurnText(socket, socketRoom);
}

function resetGame(socketRoom) {
  socketRoom.treasureCoordinates = null;
  socketRoom.playerTurn = null;
  socketRoom.users.forEach(socketRoomUser => {
    socketRoomUser.pos = null;
    socketRoomUser.roll = null;
  });
  GAME_NS.in(socketRoom.name).emit('resetGame');
}

http.listen(3000, function() {
  console.log('listening on *:3000');
});