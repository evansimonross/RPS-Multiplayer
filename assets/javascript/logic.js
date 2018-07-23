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
//var gamesRef = database.ref("/games");
var player = {};
var opponent = {};
var game = "lobby";
var gamesRef = database.ref("/games");
var gameStarted = false;

// on user's connection status change
connectedRef.on("value", function (snapshot) {
    if (snapshot.val()) {
        var con = connectionsRef.push(true);
        player.id = con.key;
        player.name = prompt("What is your name?");
        $('#player-1-name').text(player.name);
        con.onDisconnect().remove();
        var me = gamesRef.child(game).child(player.id);
        me.update({ name: player.name, waiting: false, newGame: "lobby"});
        me.onDisconnect().remove();
    }
});

gamesRef.on("value", function (snapshot) {
    var players = snapshot.val()[game];
    if (game === "lobby") {
        var me = players[player.id] || "";
        if(me === ""){ return; }
        if( me.newGame !== "lobby"){
            game = me.newGame;
            gamesRef.child("lobby").child(player.id).remove();
            var meInGame = gamesRef.child(game).child("players").child(player.id);
            meInGame.onDisconnect().remove();
            gameStarted = true;
            return;
        }
        playerIds = Object.keys(players);
        for (var i = 0; i < playerIds.length; i++) {
            if (playerIds[i] != player.id) {
                if(players[playerIds[i]].waiting===true){
                    gamesRef.child("lobby").child(player.id).remove();
                    var newGamePlayers = {};
                    newGamePlayers[player.id] = {name: player.name};
                    newGamePlayers[playerIds[i]] = {name: players[playerIds[i]].name};
                    var newGame = gamesRef.push({players: newGamePlayers});
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
        gamesRef.child(game).child(player.id).update({ waiting: true });
    }
    else if(Object.keys(players['players']).length===1 && gameStarted) {
        // return to lobby
        gameStarted = false;
        gamesRef.child(game).remove();
        game = "lobby";
        var me = gamesRef.child(game).child(player.id);
        me.update({ name: player.name, waiting: true, newGame: "lobby"});
        me.onDisconnect().remove();
    }
    else if(Object.keys(players['players']).length===2 && !gameStarted){
        gameStarted = true;
    }

});

// on any connection status change
connectionsRef.on("value", function (snapshot) {
    $('#player-count').text(snapshot.numChildren());
});