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
var player = {};

// on user's connection status change
connectedRef.on("value", function (snapshot) {
    if (snapshot.val()) {
        var con = connectionsRef.push(true);
        player.id = con.key;
        con.onDisconnect().remove();
    }
});

// on any connection status change
connectionsRef.on("value", function(snapshot) {
    $('#player-count').text(snapshot.numChildren());
});