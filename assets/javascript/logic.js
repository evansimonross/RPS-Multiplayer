// configeration files for my firebase database
var config = {
    apiKey: "AIzaSyBaVG_WIYrk2Hk0ifu1ot-ISmlHD1G0sDY",
    authDomain: "rps-multiplayer-4294a.firebaseapp.com",
    databaseURL: "https://rps-multiplayer-4294a.firebaseio.com",
    projectId: "rps-multiplayer-4294a",
    storageBucket: "rps-multiplayer-4294a.appspot.com",
    messagingSenderId: "618197940732"
};
const delay = 3000;

// create database references
firebase.initializeApp(config);
var database = firebase.database();
var connectionsRef = database.ref("/connections");
var opponentRefs = [];
var player = {};
var opponent = {};
var game = "lobby";
var gamesRef = database.ref("/games");
var gameStarted = false;
var aiGame = false;
var aiMode = "random";
var aiScore = 0;
var playerMoveList = [];
var currentScore = 0;
var oppMove;
var mute = false;

$(function () {

    // Display the user name modal on page load and focus input so user can begin typing name immediately.
    $('#nameModal').modal('show');
    $('#nameModal').on('shown.bs.modal', function (e) {
        $('#user-name').trigger('focus');
    });

    // No submit button, but "enter" will trigger submit function. Prevent page loading and hide the modal.
    $('form').submit(function (e) {
        e.preventDefault();
        $('#nameModal').modal('hide');
    });

    // Save the username inputted when the modal is hidden, regardless of whether the "save" button was clicked, the "x" button, or the user clicked off screen.
    $('#nameModal').on('hide.bs.modal', function () {
        player.name = $('#user-name').val().trim();

        // on user's connection status change
        var connectedRef = database.ref(".info/connected");
        connectedRef.on("value", function (snapshot) {
            if (snapshot.val()) {
                var con = connectionsRef.push(true);
                player.id = con.key;
                if (player.name === null || player.name === "") {
                    var randomNames = ["Abagall", "Bobbert", "Charnie", "Dagmund", "Eggward", "Francille", "Gertle", "Haverstraw", "Irvind", "Jacqueles", "Kimber", "Lemmant", "Mennis", "Nodell", "Ophelie", "Pert", "Quincely", "Rennifer", "Samanda", "Thumbly", "Usanna", "Vixoria", "Wembly", "Xavidar", "Yanny", "Zelma"];
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
    })
})

gamesRef.on("value", function (snapshot) {
    try {
        var players = snapshot.val()[game];
    }
    catch (err) {
        return;
    }

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
            var audio = document.getElementById('audio');
            play("dooropen.wav");
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
        aiGame = true;
        scoreReset();
        showMoves();
    }

    // If your game has already started but your game room only has one player, they must have disconnected. Return to the lobby.
    else if (Object.keys(players['players']).length === 1 && gameStarted) {
        // stop listening for updates to opponent
        opponentRefs.forEach(function (ref) {
            ref.off();
        });

        // return to lobby
        gameStarted = false;
        var oldGame = game;
        game = "lobby";
        var me = gamesRef.child(game).child(player.id);
        gamesRef.child(oldGame).remove();
        $('#player-2-name').text("Computer");
        scoreReset();
        var audio = document.getElementById('audio');
        play("doorslam.wav");
        me.update({ name: player.name, waiting: false, newGame: "lobby" });
        me.onDisconnect().remove();
        aiGame = true;
        scoreReset();
        showMoves();
    }

    // If your game hasn't started yet and your game room has two players, it should begin.
    else if (Object.keys(players['players']).length === 2 && !gameStarted) {
        var audio = document.getElementById('audio');
        play("dooropen.wav");
        aiGame = false;
        scoreReset();
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

// Begin a new match with a human player
function commenceGame() {

    // If this method is attempted to run when a game is already in progress or when playing with an AI it stops executing
    if (gameStarted || aiGame) { return; }

    // The game has started!
    gameStarted = true;
    $('#chat-box').empty();
    var opponentId = "";

    // Check for which game room in the database the player is in
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

        // Listen for changes in the opponent's score and update on screen if it changes
        var pointsRef = database.ref("/games/" + game + "/players/" + opponentId + "/points");
        pointsRef.on("value", function (snapshot) {
            $('#player-2-score').text(snapshot.val());
        }, function (errorObject) {
            console.log("An error occured on the opponent's points reference: " + errorObject.code);
        });
        opponentRefs.push(pointsRef);

        // Listen for changes in opponent's move and execute functions accordingly.
        var moveRef = database.ref("/games/" + game + "/players/" + opponentId + "/move");
        moveRef.on("value", function (snapshot) {
            oppMove = snapshot.val();
            checkMoves();
        }, function (errorObject) {
            console.log("An error occured on the opponent's move reference: " + errorObject.code);
        });
        opponentRefs.push(moveRef);

        // Listen for changes in opponent's chat message and display it in the chat box & play the AIM message received sound
        var messageRef = database.ref("/games/" + game + "/players/" + opponentId + "/message");
        messageRef.on("value", function (snapshot) {
            if (snapshot.val() === "" || snapshot.val() === null) { return; }
            $('#chat-box').prepend('<p class="chat-line"><b style="color: var(--player-2-color)">' + $('#player-2-name').text() + ':</b> ' + snapshot.val() + '</p>');
            var audio = document.getElementById('audio');
            play("imrcv.wav");
        }, function (errorObject) {
            console.log("An error occured on the opponent's message reference: " + errorObject.code);
        });
        opponentRefs.push(messageRef);
    });
}

// Start a new round 
function nextGame() {

    // Reset the colors in the title (they change when players choose moves)
    $('.title').css('color', 'black');

    // Clear the win/lose/draw message
    $('#message').animate({
        "opacity": '0',
        top: '0%'
    }, function () {
        $('#message').css({
            top: "50%",
            color: "#fff",
            "border-color": "#fff",
        });
    });

    // Only update the database if the player is playing against a human opponent
    if (!aiGame) {
        var me = gamesRef.child(game).child("players").child(player.id);
        me.update({ move: "x" });
    }

    // Show the waiting for opponent screen
    else {
        waitingForOpponent();
    }

    // Set the player's move to nothing and display the option buttons
    player.move = "x";
    showMoves();
}

// Check the moves of both the player and opponent
function checkMoves() {

    // Both players have not chosen yet: display the buttons and show that the opponent is not ready
    if (player.move === "x" && oppMove === "x") {
        // Prompt player for RPS. 
        showMoves();
        // Show opponent as not ready.
        showOpponentDown();
    }

    // The player has not chosen but the opponent has: display the buttons and show that the opponent is ready
    else if (player.move === "x") {
        // Prompt player for RPS
        showMoves();
        // Show opponent as ready.
        showOpponentUp();
    }

    // The player has chosen but the opponent hasn't : display the player's choice and show that the opponent is not ready
    else if (oppMove === "x") {
        // Show opponent as not ready
        showOpponentDown();
    }

    // Both players have chosen: check who is the winner and call functions for the result
    else {

        // This allows a new round to be started next
        gameStarted = false;

        // Display the opponent's choice
        showOpponentMove(oppMove);

        // Check if the player has won, lost, or tied
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

// Behavior when the player has won
function win() {

    // If this is called when a game is already in progress, ignore it
    if (gameStarted) { return; }

    // If this is a game against the AI, "gameStarted" should never be true
    if (aiGame) {
        gameStarted = false;
    }

    // If this is a game against a human, a new game will start soon so "gameStarted" should be true.
    // This also prevents the method from being repeatedly called... This was a problem in early development due to the "scoreUp" method updating the database and repeatedly triggering a database reference listener
    else {
        gameStarted = true;
    }

    // Raise the player's score and send it to the database
    scoreUp();

    // Display the win message
    $('#message').text("YOU WIN");
    $('#message').css({
        "background-color": "var(--player-1-color)",
        display: "block"
    });
    $('#message').animate({
        "opacity": '1.0',
        top: '25%'
    });

    // Wait and then start another round
    setTimeout(nextGame, delay);
}

function lose() {

    // If this is called when a game is already in progress, ignore it
    if (gameStarted) { return; }

    // If this is a game against the AI, "gameStarted" should never be true
    // If the AI has won, its score should be increased and displayed.
    if (aiGame) {
        gameStarted = false;
        aiScore++;
        $('#player-2-score').text(aiScore);
    }

    // If this is a game against a human, a new game will start soon so "gameStarted" should be true.
    else {
        gameStarted = true;
    }

    // Display the loss message
    $('#message').text("YOU LOSE");
    $('#message').css({
        "background-color": "var(--player-2-color)",
        display: "block"
    });
    $('#message').animate({
        "opacity": '1.0',
        top: '25%'
    });

    // Wait and then start another round
    setTimeout(nextGame, delay);
}

function draw() {

    // If this is called when a game is already in progress, ignore it
    if (gameStarted) { return; }

    // If this is a game against the AI, "gameStarted" should never be true
    if (aiGame) {
        gameStarted = false;
    }

    // If this is a game against a human, a new game will start soon so "gameStarted" should be true.
    else {
        gameStarted = true;
    }

    // Display the draw message
    $('#message').text("YOU TIED");
    $('#message').css({
        "background-color": "#ddd",
        color: "#000",
        "border-color": "#000",
        display: "block"
    });
    $('#message').animate({
        "opacity": '1.0',
        top: '25%'
    });

    // Wait and then start another round
    setTimeout(nextGame, delay);
}

// Raise the player's score, display it and update it to the database if the game is against a human opponent.
function scoreUp() {
    var me = gamesRef.child(game).child("players").child(player.id);
    currentScore++;
    $('#player-1-score').text(currentScore);
    if (aiGame) { return; }
    me.update({ points: currentScore });
}

// Reset the player and AI scores and AI mode (called when a new match is created to prevent bleedover from previous matches)
function scoreReset() {
    currentScore = 0;
    $('#player-1-score').text(currentScore);
    aiScore = 0;
    $('#player-1-score').text(aiScore);
    aiMode = "random";
}

// Display the options for the player to choose from (rock, paper and scissors)
function showMoves() {
    $('#player-moves').empty();
    $('#player-moves').append('<button class="btn btn-lg btn-primary move" onclick="makeMove(\'rock\')">Rock <i class="fas fa-hand-rock"></i></button>');
    $('#player-moves').append('<button class="btn btn-lg btn-primary move" onclick="makeMove(\'paper\')">Paper <i class="fas fa-hand-paper"></i></button>');
    $('#player-moves').append('<button class="btn btn-lg btn-primary move" onclick="makeMove(\'scissors\')">Scissors <i class="fas fa-hand-scissors"></i></button>');
}

// Show that there is no human opponent, but that a computer opponent is available
function waitingForOpponent() {
    $('#opponent-moves').empty();
    $('#opponent-moves').append('<h1><i id="opponent-move" class="far fa-clock"></i></h1>')
    $('#opponent-moves').append('<p>Waiting for an opponent. Feel free to play with the computer while you wait.</p>');
}

// Show that a human opponent has not chosen a response yet
function showOpponentDown() {
    $('#opponent-moves').empty();
    $('#opponent-moves').append('<h1><i id="opponent-move" class="fas fa-thumbs-down"></i></h1>')
    $('#opponent-moves').append('<p>Your opponent has not chosen.</p>');
}

// Show that a human opponent has chosen a response and is waiting on you
function showOpponentUp() {
    $('#opponent-moves').empty();
    $('#opponent-moves').append('<h1><i id="opponent-move" class="fas fa-thumbs-up"></i></h1>')
    $('#opponent-moves').append('<p>Your opponent has already chosen.</p>');
}

// Show what move the opponent has made and change the color of the title bar's move to match
function showOpponentMove(move) {
    $('#opponent-moves').empty();
    $('#opponent-moves').append('<h1><i id="opponent-move" class="fas fa-hand-' + move + '"></i></h1>')
    $('#opponent-moves').append('<p>Your opponent has chosen ' + move + '.</p>');
    $('#' + move + '-title').css('color', 'var(--player-2-color)');
}

// Choose a move
function makeMove(move) {

    // Change the color of the title bar's move to match
    $('#' + move + '-title').css('color', 'var(--player-1-color)');
    var resultDelay = 50;
    player.move = move;

    // Behavior against an AI
    if (aiGame) {

        // The options the computer can choose from
        moveOptions = ["rock", "paper", "scissors"];

        // A truly random opponent chooses randomly from among the three options.
        // This is the default behavior of the AI
        if (aiMode === "random") {
            oppMove = moveOptions[Math.floor(Math.random() * 3)];
        }

        // A "dumb" learning algorithm, which bases its next move selection on what the player has chosen so far
        // The computer choses a move that will beat the player's most common choice until now (excluding the current choice)
        else if (aiMode === "learn") {
            var playersMoves = [0, 0, 0];
            for (var i = 0; i < playerMoveList.length; i++) {
                if (playerMoveList[i] === "scissors") {
                    playersMoves[0] = playersMoves[0] + 1;
                }
                else if (playerMoveList[i] === "rock") {
                    playersMoves[1] = playersMoves[1] + 1;
                }
                else if (playerMoveList[i] === "paper") {
                    playersMoves[2] = playersMoves[2] + 1;
                }
            }
            if (playersMoves[0] === playersMoves[1]) {
                if (playersMoves[2] > playersMoves[0]) {
                    moveOptions.splice(0, 2);
                }
                else if (playersMoves[2] < playersMoves[0]) {
                    moveOptions.splice(2, 1);
                }
            }
            else if (playersMoves[0] > playersMoves[1]) {
                if (playersMoves[2] > playersMoves[0]) {
                    moveOptions.splice(0, 2);
                }
                else if (playersMoves[2] === playersMoves[0]) {
                    moveOptions.splice(1, 1);
                }
                else {
                    moveOptions.splice(1, 2);
                }
            }
            else {
                if (playersMoves[2] > playersMoves[1]) {
                    moveOptions.splice(0, 2);
                }
                else if (playersMoves[2] === playersMoves[1]) {
                    moveOptions.splice(0, 1);
                }
                else {
                    moveOptions.splice(2, 1);
                    moveOptions.splice(0, 1);
                }
            }

            // The computer chooses randomly from among the remaining options. 
            oppMove = moveOptions[Math.floor(Math.random() * moveOptions.length)];
            console.log(playersMoves);

            // The computer keeps track of the player's current move
            playerMoveList.push(move);
        }
        else {

            // If the computer is in "cheat" mode it will automatically win every time.
            // If the computer is in "let" mode it will automatically let the player win every time.
            if (move === "rock") {
                if (aiMode === "cheat") { oppMove = "paper"; }
                else if (aiMode === "let") { oppMove = "scissors"; }
            }
            else if (move === "paper") {
                if (aiMode === "cheat") { oppMove = "scissors"; }
                else if (aiMode === "let") { oppMove = "rock"; }
            }
            else if (move === "scissors") {
                if (aiMode === "cheat") { oppMove = "rock"; }
                else if (aiMode === "let") { oppMove = "paper"; }
            }
        }

        // Give a delay when playing against the computer so the result doesn't show up right away.
        resultDelay = 750;
    }
    else {

        // Update the database with the player's move if playing against a human opponent
        var me = gamesRef.child(game).child("players").child(player.id);
        me.update({ move: move });
    }

    // Display the move in the player's box
    $('#player-moves').empty();
    $('#player-moves').append('<h1><i id="my-move" class="fas fa-hand-' + move + ' fa-flip-horizontal"></i></h1>')
    $('#player-moves').append('<p>You have chosen ' + move + '.</p>');

    // Check moves after a delay for win/loss/draw
    setTimeout(checkMoves, resultDelay);
}

// Play audio
function play(audioSource) {
    if (mute) { return; }
    var audio = document.getElementById('audio');
    audio.src = "assets/sounds/" + audioSource;
    audio.play();
}

// Chat functionality when the player clicks "Send"
$('#chat-button').on('click', function (event) {

    // Do not refresh the page when the submit button is clicked
    event.preventDefault();

    // Gather and then clear the text in the input field, and stop executing if it is empty.
    var message = $('#chat-text').val();
    $('#chat-text').val("");
    if (message === "") { return; }

    // Display the message with the player's name in blue, a la AIM messenger, and play the classic IM sent sound
    $('#chat-box').prepend('<p class="chat-line"><b style="color: var(--player-1-color)">' + player.name + ':</b> ' + message + '</p>');
    var me = gamesRef.child(game).child("players").child(player.id);
    play("imsend.wav");

    // Chatting to the computer
    if (aiGame) {

        // Delay the response (mostly for the audio effect)
        setTimeout(function () {

            // Default message
            var aiMessage = "I am not a chat bot.";

            // If the message contains the word "cheat", change the AI to cheat mode
            if (message.toLowerCase().indexOf("cheat") >= 0) {
                aiMode = "cheat";
                aiMessage = "Prepare to lose.";
            }

            // If the message contains the word "let", change the AI to let mode
            else if (message.toLowerCase().indexOf("let") >= 0) {
                aiMode = "let";
                aiMessage = "I'll go easy on ya.";
            }

            // If the message contains the word "random", change the AI to random mode
            else if (message.toLowerCase().indexOf("random") >= 0) {
                aiMode = "random";
                aiMessage = "I'll play randomly";
            }

            // If the message contains the word "learn", change the AI to learn mode
            else if (message.toLowerCase().indexOf("learn") >= 0) {
                aiMode = "learn";
                playerMoveList = [];
                aiMessage = "I'll try my very best!";
            }

            // Display the message from the AI and play the IM message received sound
            $('#chat-box').prepend('<p class="chat-line"><b style="color: var(--player-2-color)">Computer: </b>' + aiMessage + '</p>');
            play("imrcv.wav");
        }, 2000);
    }

    // Chatting to a player: update the database with the message
    else {
        me.update({ message: message });
    }
});