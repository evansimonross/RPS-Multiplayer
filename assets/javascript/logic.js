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
var player = {};
var game = "";
var gameRef;

// on user's connection status change
connectedRef.on("value", function (snapshot) {
    if (snapshot.val()) {
        var con = connectionsRef.push(true);
        player.id = con.key;
        player.name = prompt("What is your name?");
        $('#player-1-name').text(player.name);
        con.onDisconnect().remove();

        gamesRef.once("value").then(function (snapshot) {
            var games = snapshot.val() || {};
            var gameKeyValues = Object.entries(games);
            for (var i = 0; i < gameKeyValues.length; i++) {
                if (gameKeyValues[i][1].players.length === 1) {
                    // join existing game
                    gameKeyValues[i][1].players.push(player);
                    gamesRef.set(games);
                    $('#player-2-name').text(gameKeyValues[i][1].players[0].name);
                    game = gameKeyValues[i][0];
                    gamesRef.onDisconnect().set(snapshot.val());
                    return;
                }
            }
            // create a new game
            var newGame = [];
            newGame.push(player);
            myGame = gamesRef.push({ players: newGame });
            game = myGame.key;
            // delete games[game];
            gamesRef.onDisconnect().set(games);
        });
    }
});

// on any connection status change
connectionsRef.on("value", function (snapshot) {
    $('#player-count').text(snapshot.numChildren());
});

// Check if other player has disconnected or joined
gamesRef.on("value", function (snapshot) {
    console.log("GAMES HAVE UPDATED")
    if(game==="") { return; }
    var games = snapshot.val();
    var thisGame = snapshot.val()[game] || undefined;
    if (thisGame === undefined) { return; }
    console.log(thisGame);
    if (thisGame.players.length === 1) {
        // Other player has disconnected! 
        $('#player-2-name').text("Player 2");
        delete games[game];
        gamesRef.onDisconnect().set(games);
    }
    else if (thisGame.players.length === 2) {
        // Other player has joined.
        if(thisGame.players[0].id===player.id){
            $('#player-2-name').text(thisGame.players[1].name);
            games[game].players = ([thisGame.players[1]]);
            gamesRef.onDisconnect().set(games);
        }
        else{
            $('#player-2-name').text(thisGame.players[0].name);
            games[game].players = ([thisGame.players[0]]);
            gamesRef.onDisconnect().set(games);
        }
    }
});