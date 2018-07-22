// configeration files for my firebase database
var config = {
    apiKey: "AIzaSyBaVG_WIYrk2Hk0ifu1ot-ISmlHD1G0sDY",
    authDomain: "rps-multiplayer-4294a.firebaseapp.com",
    databaseURL: "https://rps-multiplayer-4294a.firebaseio.com",
    projectId: "rps-multiplayer-4294a",
    storageBucket: "rps-multiplayer-4294a.appspot.com",
    messagingSenderId: "618197940732"
};

// create database references
firebase.initializeApp(config);
var database = firebase.database();
var connectionsRef = database.ref("/connections");
var connectedRef = database.ref(".info/connected");
var gamesRef = database.ref("/games");
var gameRef;
var player = {};
var game = "";

// on user's connection status change
connectedRef.on("value", function (snapshot) {
    if (snapshot.val()) {
        var con = connectionsRef.push(true);
        player.id = con.key;
        player.name = prompt("What is your name?");
        $('#player-1-name').text(player.name);
        con.onDisconnect().remove();

        gamesRef.once("value").then(function (snapshot) {
            var joinedGame = false;
            var games = snapshot.val() || {};
            var gameKeyValues = Object.entries(games);
            for (var i = 0; i < gameKeyValues.length; i++) {
                if (gameKeyValues[i][1].length === 1) {
                    // join existing game
                    gameKeyValues[i][1].push(player);
                    gamesRef.set(games);
                    game = gameKeyValues[i][0];
                    gameRef = database.ref("/games/" + game);
                    joinedGame = true;
                    break;
                }
            }
            if (!joinedGame) {
                // create a new game
                var newGame = [];
                newGame.push(player);
                myGame = gamesRef.push(newGame);
                game = myGame.key;
                gameRef = database.ref("/games/" + game);
            }
        });
    }
});

// on any connection status change
connectionsRef.on("value", function (snapshot) {
    $('#player-count').text(snapshot.numChildren());
});