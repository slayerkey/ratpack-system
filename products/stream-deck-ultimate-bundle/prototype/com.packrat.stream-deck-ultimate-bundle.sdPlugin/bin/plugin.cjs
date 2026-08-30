"use strict";
// Node 20 in Stream Deck does not provide a reliable browser-style global WebSocket.
// Supply the proven ws implementation, then load the existing runtime.
global.WebSocket = require("ws");
require("./plugin.js");
