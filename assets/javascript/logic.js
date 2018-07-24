// configeration files for my firebase database
var config = {
    apiKey: "AIzaSyBaVG_WIYrk2Hk0ifu1ot-ISmlHD1G0sDY",
    authDomain: "rps-multiplayer-4294a.firebaseapp.com",
    databaseURL: "https://rps-multiplayer-4294a.firebaseio.com",
    projectId: "rps-multiplayer-4294a",
    storageBucket: "rps-multiplayer-4294a.appspot.com",
    messagingSenderId: "618197940732"
};
const delay = 3500;

// create database references
firebase.initializeApp(config);
var database = firebase.database();
var connectionsRef = database.ref("/connections");
var connectedRef = database.ref(".info/connected");
//var gamesRef = database.ref("/games");
var player = {};
var opponent = {};
var game = "lobby";
var gamesRef = database.ref("/games");
var gameStarted = false;
var currentScore = 0;
var oppMove;

// on user's connection status change
connectedRef.on("value", function (snapshot) {
    if (snapshot.val()) {
        var con = connectionsRef.push(true);
        player.id = con.key;
        player.name = prompt("What is your name?");
        if (player.name === null || player.name === "") {
            var randomNames = ["Abagill", "Bobbert", "Charrie", "Dagmund", "Eggward", "Francille", "Gertle", "Haverstraw", "Irvind", "Jacqueler", "Khloe Kardashian", "Lemonjelo", "Mennis", "Nedelrad", "Ophelie", "Pert", "Quincely", "Rennifer", "Samanda", "Thimoty", "Usanna", "Vixtoria", "Wembly", "Xavidar", "Yanny", "Zelma"];
            player.name = randomNames[Math.floor(Math.random() * randomNames.length)];
        }
        player.move = "x";
        $('#player-1-name').text(player.name);
        con.onDisconnect().remove();
        var me = gamesRef.child(game).child(player.id);
        me.update({ name: player.name, waiting: false, newGame: "lobby" });
        me.onDisconnect().remove();
    }
}, function (errorObject) {
    console.log("An error occured on the connected reference: " + errorObject.code);
});

gamesRef.on("value", function (snapshot) {
    var players = snapshot.val()[game];

    // If the player is currently in the lobby, check to see if there is a game partner
    if (game === "lobby") {
        var me = players[player.id] || "";
        if (me === "") { return; }

        // Another player has created a game for you. Move from the lobby to that game channel
        if (me.newGame !== "lobby") {
            game = me.newGame;
            gamesRef.child("lobby").child(player.id).remove();
            var meInGame = gamesRef.child(game).child("players").child(player.id);
            meInGame.onDisconnect().remove();
            if (!gameStarted) {
                commenceGame();
            }
            return;
        }

        // Check to see if any other players are waiting
        playerIds = Object.keys(players);
        for (var i = 0; i < playerIds.length; i++) {
            if (playerIds[i] != player.id) {
                if (players[playerIds[i]].waiting === true) {
                    gamesRef.child("lobby").child(player.id).remove();
                    var newGamePlayers = {};
                    newGamePlayers[player.id] = { name: player.name, points: 0, move: "x", message: "" };
                    newGamePlayers[playerIds[i]] = { name: players[playerIds[i]].name, points: 0, move: "x", message: "" };
                    var newGame = gamesRef.push({ players: newGamePlayers });
                    game = newGame.key;
                    gamesRef.child("lobby").child(playerIds[i]).update({
                        waiting: false,
                        newGame: game
                    });
                    var meInGame = gamesRef.child(game).child("players").child(player.id);
                    meInGame.onDisconnect().remove();
                    return;
                }
            }
        }

        // If no one is waiting and you have not been called to another channel, now you are waiting
        gamesRef.child(game).child(player.id).update({ waiting: true });
        waitingForOpponent();
    }

    // If your game has already started but your game room only has one player, they must have disconnected. Return to the lobby.
    else if (Object.keys(players['players']).length === 1 && gameStarted) {
        // return to lobby
        gameStarted = false;
        gamesRef.child(game).remove();
        game = "lobby";
        var me = gamesRef.child(game).child(player.id);
        $('#player-2-name').text("Player 2");
        scoreReset();
        me.update({ name: player.name, waiting: false, newGame: "lobby" });
        me.onDisconnect().remove();
    }

    // If your game hasn't started yet and your game room has two players, it should begin.
    else if (Object.keys(players['players']).length === 2 && !gameStarted) {
        commenceGame();
    }

}, function (errorObject) {
    console.log("An error occured on the games reference: " + errorObject.code);
});

// on any connection status change
connectionsRef.on("value", function (snapshot) {
    $('#player-count').text(snapshot.numChildren());
}, function (errorObject) {
    console.log("An error occured on the connections reference: " + errorObject.code);
});

function commenceGame() {
    gameStarted = true;
    $('#chat-box').empty();
    var opponentId = "";
    gamesRef.once("value", function (snapshot) {
        var ids = Object.keys(snapshot.val()[game].players);
        if (ids[0] === player.id) {
            opponentId = ids[1];
        }
        else {
            opponentId = ids[0];
        }
        $('#player-2-name').text(snapshot.val()[game].players[opponentId].name);
    }, function (errorObject) {
        console.log("An error occured on the gamesRef reference: " + errorObject.code);
    }).then(function () {
        var pointsRef = database.ref("/games/" + game + "/players/" + opponentId + "/points");
        pointsRef.on("value", function (snapshot) {
            $('#player-2-score').text(snapshot.val());
        }, function (errorObject) {
            console.log("An error occured on the opponent's points reference: " + errorObject.code);
        });

        var moveRef = database.ref("/games/" + game + "/players/" + opponentId + "/move");
        moveRef.on("value", function (snapshot) {
            oppMove = snapshot.val();
            checkMoves();
        }, function (errorObject) {
            console.log("An error occured on the opponent's move reference: " + errorObject.code);
        });

        var messageRef = database.ref("/games/" + game + "/players/" + opponentId + "/message");
        messageRef.on("value", function (snapshot) {
            if (snapshot.val() === "" || snapshot.val() === null) { return; }
            $('#chat-box').prepend('<p class="chat-line"><b style="color: var(--player-2-color)">' + $('#player-2-name').text() + ':</b> ' + snapshot.val() + '</p>');
        }, function (errorObject) {
            console.log("An error occured on the opponent's message reference: " + errorObject.code);
        });
    });
}

function nextGame() {
    $('.title').css('color', 'black');
    var me = gamesRef.child(game).child("players").child(player.id);
    me.update({ move: "x" });
    player.move = "x";
    showMoves();
}

function checkMoves() {
    if (player.move === "x" && oppMove === "x") {
        // Prompt player for RPS. 
        showMoves();
        // Show opponent as not ready.
        showOpponentDown();
    }
    else if (player.move === "x") {
        // Prompt player for RPS
        showMoves();
        // Show opponent as ready.
        showOpponentUp();
    }
    else if (oppMove === "x") {
        // Show opponent as not ready
        showOpponentDown();
    }
    else {
        // Check who is the winner
        gameStarted = false;
        showOpponentMove(oppMove);
        if (player.move === "rock") {
            if (oppMove === "rock") {
                draw();
            }
            else if (oppMove === "paper") {
                lose();
            }
            else if (oppMove === "scissors") {
                win();
            }
            else {
            }
        }
        else if (player.move === "paper") {
            if (oppMove === "rock") {
                win();
            }
            else if (oppMove === "paper") {
                draw();
            }
            else if (oppMove === "scissors") {
                lose();
            }
            else {
            }
        }
        else if (player.move === "scissors") {
            if (oppMove === "rock") {
                lose();
            }
            else if (oppMove === "paper") {
                win();
            }
            else if (oppMove === "scissors") {
                draw();
            }
            else {
            }
        }
        else {
        }
    }
}

function win() {
    if (gameStarted) { return; }
    gameStarted = true;
    scoreUp();
    console.log("win");
    setTimeout(nextGame, delay);
}

function lose() {
    if (gameStarted) { return; }
    gameStarted = true;
    console.log("lose");
    setTimeout(nextGame, delay);
}

function draw() {
    if (gameStarted) { return; }
    gameStarted = true;
    console.log("draw");
    setTimeout(nextGame, delay);
}

function scoreUp() {
    var me = gamesRef.child(game).child("players").child(player.id);
    currentScore++;
    $('#player-1-score').text(currentScore);
    me.update({ points: currentScore });
}

function scoreReset() {
    currentScore = 0;
    $('#player-1-score').text(currentScore);
}

function showMoves() {
    $('#player-moves').empty();
    $('#player-moves').append('<button class="btn btn-lg btn-primary move" onclick="makeMove(\'rock\')">Rock <i class="fas fa-hand-rock"></i></button>');
    $('#player-moves').append('<button class="btn btn-lg btn-primary move" onclick="makeMove(\'paper\')">Paper <i class="fas fa-hand-paper"></i></button>');
    $('#player-moves').append('<button class="btn btn-lg btn-primary move" onclick="makeMove(\'scissors\')">Scissors <i class="fas fa-hand-scissors"></i></button>');
}

function waitingForOpponent() {
    $('#opponent-moves').empty();
    $('#opponent-moves').append('<h1><i id="opponent-move" class="far fa-clock"></i></h1>')
    $('#opponent-moves').append('<p>Waiting for an opponent.</p>');
}

function showOpponentDown() {
    $('#opponent-moves').empty();
    $('#opponent-moves').append('<h1><i id="opponent-move" class="fas fa-thumbs-down"></i></h1>')
    $('#opponent-moves').append('<p>Your opponent has not chosen.</p>');
}

function showOpponentUp() {
    $('#opponent-moves').empty();
    $('#opponent-moves').append('<h1><i id="opponent-move" class="fas fa-thumbs-up"></i></h1>')
    $('#opponent-moves').append('<p>Your opponent has already chosen.</p>');
}

function showOpponentMove(move) {
    $('#opponent-moves').empty();
    $('#opponent-moves').append('<h1><i id="opponent-move" class="fas fa-hand-' + move + '"></i></h1>')
    $('#opponent-moves').append('<p>Your opponent has chosen ' + move + '.</p>');
    $('#' + move + '-title').css('color', 'var(--player-2-color)');
}

function makeMove(move) {
    $('#' + move + '-title').css('color', 'var(--player-1-color)');
    player.move = move;
    var me = gamesRef.child(game).child("players").child(player.id);
    me.update({ move: move });
    $('#player-moves').empty();
    $('#player-moves').append('<h1><i id="my-move" class="fas fa-hand-' + move + ' fa-flip-horizontal"></i></h1>')
    $('#player-moves').append('<p>You have chosen ' + move + '.</p>');
    checkMoves();
}

$('#chat-button').on('click', function (event) {
    event.preventDefault();
    var message = $('#chat-text').val();
    $('#chat-text').val("");
    if (message === "") { return; }
    $('#chat-box').prepend('<p class="chat-line"><b style="color: var(--player-1-color)">' + player.name + ':</b> ' + message + '</p>');
    var me = gamesRef.child(game).child("players").child(player.id);
    me.update({ message: message });
});