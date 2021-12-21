const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const bodyParser = require('body-parser');
require('dotenv').config();

const rooms = [];

const PLAYERS_PER_GAME = 2;
const MAX_ROLL = 6;
const CLOSE_RANGE = 2;
const ROW_COUNT = 10;
const COL_COUNT = 10;
const SPECIAL_ITEMS = [
  {
    'type': 'extraTurn',
    'count': 2 
  },
  {
    'type': 'treasureRow',
    'count': 1 
  },
  {
    'type': 'treasureCol',
    'count': 1 
  },
  {
    'type': 'swapPosition',
    'count': 2
  },
  {
    'type': 'teleport',
    'count': 1
  },
];
const PLAYERNAME_MAX_LENGTH = 10;
const RESET_GAME_TIMEOUT_MS = 5000;

const GAME_NS = io.of('/game');
const FIND_ROOM_NS = io.of('/find-room');

createRoom('Test'); // create a test room

setInterval(function() {
  handleRoomUptime();
}, 1000 * 60); // call this every minute

// set the view engine to ejs
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
  siteUrl = getSiteUrl(req);
  const notice = req.query.notice;
  res.render(__dirname + '/views/index', {page_name: 'home'});
});

app.get('/about', function(req, res) {
  siteUrl = getSiteUrl(req);
  res.render(__dirname + '/views/about', {page_name: 'about'});
});

app.get('/play', function(req, res) {
  siteUrl = getSiteUrl(req);
  const notice = req.query.notice;
  res.render(__dirname + '/views/find-room', {page_name: 'play', rooms: rooms, notice: notice, siteUrl: siteUrl});
});

app.get('/game/:room', function(req, res) {
  siteUrl = getSiteUrl(req);
  var roomUrl = siteUrl + '/game/' + encodeURIComponent(req.params.room);
  var roomName = decodeURI(req.params.room);
  const room = getRoomByName(roomName);
  if (room && room.users.length < PLAYERS_PER_GAME) {
    res.render(__dirname + '/views/game', {page_name: 'game', room_name: roomName, room_url: roomUrl, siteUrl: siteUrl});
  } else {
    const notice = encodeURIComponent('not-found');
    res.redirect('/play/?notice=' + notice);
  }
});

app.get('/room-list', function(req, res) {
  siteUrl = getSiteUrl(req);
  const roomListRooms = [];
  rooms.forEach(function(room) {
    const roomDetails = {
      'name': room.name,
      'link': siteUrl + '/game/' + room.name.toLowerCase(),
      'playerCount': room.users.length
    };
  
    roomListRooms.push(roomDetails);
  });

  res.send(roomListRooms);
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
      GAME_NS.in(socketRoom.name).emit('logMsg', `${socketRoomUser.name} has been chosen to go first`);
    } else if (socketRoom.users.length == PLAYERS_PER_GAME) {
      socket.emit('msg', 'Waiting for your opponent to pick a starting position.')
    }
  });

  socket.on('clientMove', function(coordinates, isTeleport = false) {
    const socketRoom = getSocketRoom(socket);
    const socketRoomUser = getSocketRoomUser(socketRoom, socket.id);

    // check if it's their turn
    if (isPlayersTurn(socketRoom, socket.id) && (socketRoomUser.roll || isTeleport)) {
      let isValidMove = false;
      // check move is in range
      if (isTeleport) {
        socketRoomUser.specialItems.teleport--;
        isValidMove = true;
      } else {
        isValidMove = getIsValidMove(socketRoomUser.pos, coordinates, socketRoomUser.roll)
      }
      if (!isValidMove) { 
        const msgText = `Invalid move! You only rolled a ${socketRoomUser.roll}.`;
        socket.emit('msg', msgText);
        return;
      }

      // update their position
      socketRoomUser.pos = coordinates;
        
      const closeness = getCloseness(socketRoom, coordinates);
      socketRoomUser.roll = null;
      emitPositionUpdates(socketRoomUser, coordinates);
      
      // only send closeness to the player
      socket.emit('closenessMsg', {'closeness': closeness});

      if (isTeleport) {
        socket.broadcast.emit('splashMsg', {closeness: 'cold', msg: `${socketRoomUser.name} teleported to a new position!`});
      }

      switchPlayerTurn(socketRoom);
      updateTurnText(socket, socketRoom);
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
      GAME_NS.in(socketRoom.name).emit('logMsg', `${socketRoomUser.name} left the room`);

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
            GAME_NS.in(socketRoom.name).emit('logMsg', `${winner.winnerName} found the treasure!`);
            GAME_NS.in(socketRoom.name).emit('logMsg', '------------------------');
            setTimeout(() => {
              resetGame(socketRoom);
            }, RESET_GAME_TIMEOUT_MS);
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
            GAME_NS.in(socketRoom.name).emit('logMsg', `${socketRoomUser.name} found a special item!`);

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
              case 'swapPosition':
                specialSwapPosition(socket, socketRoom);
                break;
              case 'teleport':
                specialTeleport(socket, socketRoom);
                break;
            }
          } else {
            GAME_NS.in(socketRoom.name).emit('logMsg', `${socketRoomUser.name} dug but found nothing!`);
            switchPlayerTurn(socketRoom);
            updateTurnText(socket, socketRoom);
          }
        }
      } else {
          socket.emit('msg', 'That position has already been dug up!');
      }
    }
  });

  socket.on('choosePositionSwap', function() {
    const socketRoom = getSocketRoom(socket);
    const socketRoomUser = getSocketRoomUser(socketRoom, socket.id);

    if (socketRoomUser.specialItems.swapPosition) {
      socketRoomUser.specialItems.swapPosition--;
      const opponentSocketRoomUser = getInactivePlayer(socketRoom);
      const playerCurrentPos = socketRoomUser.pos;
      emitPositionUpdates(opponentSocketRoomUser, playerCurrentPos);
      emitPositionUpdates(socketRoomUser, opponentSocketRoomUser.pos);
      socketRoomUser.pos = opponentSocketRoomUser.pos;
      opponentSocketRoomUser.pos = playerCurrentPos;

      socket.broadcast.emit('splashMsg', {closeness: 'cold', msg: `${socketRoomUser.name} used a special item to switch position with you!`});
      socket.emit('splashMsg', {closeness: 'success', msg: `You switched positions with ${opponentSocketRoomUser.name}!`});
      switchPlayerTurn(socketRoom);
      updateTurnText(socket, socketRoomUser);
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

  socket.on('sendChat', function(message) {
    const socketRoom = getSocketRoom(socket);
    const socketRoomUser = getSocketRoomUser(socketRoom, socket.id);
    const messageData = {
      'from': socketRoomUser.name,
      'message': message
    }
    
    GAME_NS.in(socketRoom.name).emit('receiveChat', messageData);
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
    pos: null,
    specialItems: {
      swapPosition: 0,
    }
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

function switchPlayerTurn(socketRoom) {
  const playerTurn = getInactivePlayer(socketRoom);
  socketRoom.playerTurn = playerTurn.id;

  const activePlayerSocket = getSocketFromID(playerTurn.id);
  activePlayerSocket.emit('activePlayer');
  activePlayerSocket.to(socketRoom.name).emit('activeOpponent');
}

/**
 * Get the player whose turn it isn't
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
    socket.broadcast.emit('msg', 'It\'s your opponent\'s turn.');    
  } else {
    socket.broadcast.emit('msg', 'It\'s your turn!');  
    socket.emit('msg', 'It\'s your opponent\'s turn.');
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
  GAME_NS.in(socketRoom.name).emit('logMsg', `${socketRoomUser.name} rolled a ${socketRoomUser.roll}`);
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

function specialSwapPosition(socket, socketRoom) {
  socketRoomUser = getSocketRoomUser(socketRoom, socket.id);
  socketRoomUser.specialItems.swapPosition++;
  const playerMsg = 'You got a position swap! You can use it when it\'s your turn';
  socket.emit('specialSwapPosition', {playerMsg: playerMsg});
  switchPlayerTurn(socketRoom);
  updateTurnText(socket, socketRoom);
}

function specialTeleport(socket, socketRoom) {
  socketRoomUser = getSocketRoomUser(socketRoom, socket.id);
  socketRoomUser.specialItems.swapPosition++;
  const playerMsg = 'You got a teleport! You can use it when it\'s your turn';
  socket.emit('specialTeleport', {playerMsg: playerMsg});
  switchPlayerTurn(socketRoom);
  updateTurnText(socket, socketRoom);
}

function resetGame(socketRoom) {
  socketRoom.treasureCoordinates = null;
  socketRoom.playerTurn = null;
  socketRoom.users.forEach(socketRoomUser => {
    socketRoomUser.pos = null;
    socketRoomUser.roll = null;
    socketRoomUser.specialItems = {
      swapPosition: 0,
    };
  });
  GAME_NS.in(socketRoom.name).emit('resetGame');
}

/**
 * Handle room uptime
 * This function is called every 60 seconds
 * Increment the empty minutes count for every consecutive minute a room doesn't have users in
 * After 60 minutes with no users, delete the room
 */
function handleRoomUptime() {
  rooms.some(function(room) {
    if (room.name === 'Test') {
      // the test room should always be up
      return;
    }

    if (room.users.length === 0) {
      // check if it had users last time this was called
      if (!room.hasOwnProperty('emptyMinutes') || room.emptyMinutes === 0) {
        room.emptyMinutes = 1;
      } else if (room.emptyMinutes >= 60) {
        // remove the room
        var roomIndex = rooms.indexOf(room);
        rooms.splice(roomIndex, 1);
      } else {
        room.emptyMinutes += 1;
      }
    } else {
      // reset the empty minutes as there are players in the room
      room.emptyMinutes = 0;
    }
  });
}

function getSiteUrl(req) {
  var protocol = process.env.PROTOCOL ? process.env.PROTOCOL : req.protocol;
  var host = process.env.SITE_HOST ? process.env.SITE_HOST : req.get('host');
  const siteUrl = protocol + '://' + host;

  return siteUrl;
}

http.listen(3000, function() {
  console.log('listening on *:3000');
});