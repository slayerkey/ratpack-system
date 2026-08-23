/* Deterministic browser fixture for Rat Art and XENEON QA captures. */
(function () {
    globalThis.uniqueId = "rat-art";
    globalThis.obsPort = "4455";
    globalThis.obsPassword = "";
    globalThis.textColor = "#F2F5F7";
    globalThis.accentColor = "#2BE86A";
    globalThis.backgroundColor = "#0B0E11";
    globalThis.tr = async function (value) { return value; };

    var originalWebSocket = globalThis.WebSocket;
    function FakeWebSocket(url) {
        this.url = url;
        this.readyState = 0;
        this.sent = [];
        var self = this;
        setTimeout(function () {
            self.readyState = 1;
            if (self.onopen) self.onopen({});
            if (self.onmessage) self.onmessage({ data: JSON.stringify({ op: 0, d: { obsStudioVersion: "32.0.0", obsWebSocketVersion: "5.7.4", rpcVersion: 1 } }) });
        }, 10);
    }
    FakeWebSocket.OPEN = 1;
    FakeWebSocket.prototype.send = function (raw) {
        var self = this;
        var msg = JSON.parse(raw);
        this.sent.push(msg);
        if (msg.op === 1) {
            setTimeout(function () {
                if (self.onmessage) self.onmessage({ data: JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }) });
            }, 5);
            return;
        }
        if (msg.op !== 6) return;
        var type = msg.d.requestType;
        var data = {};
        if (type === "GetStreamStatus") data = { outputActive: true, outputReconnecting: false, outputTimecode: "00:42:18", outputDuration: 2538000, outputBytes: 1512000000, outputSkippedFrames: 23, outputTotalFrames: 151860 };
        if (type === "GetRecordStatus") data = { outputActive: true, outputPaused: false, outputTimecode: "00:18:42", outputDuration: 1122000, outputBytes: 887000000 };
        if (type === "GetStats") data = { availableDiskSpace: 481920, outputSkippedFrames: 17, outputTotalFrames: 151854, renderSkippedFrames: 3, renderTotalFrames: 151900 };
        if (type === "GetSceneList") data = { currentProgramSceneName: "Gameplay", scenes: [
            { sceneName: "Gameplay", sceneIndex: 0 }, { sceneName: "Just Chatting", sceneIndex: 1 },
            { sceneName: "Starting Soon", sceneIndex: 2 }, { sceneName: "BRB", sceneIndex: 3 },
            { sceneName: "Ending", sceneIndex: 4 }
        ] };
        if (type === "GetCurrentProgramScene") data = { sceneName: "Gameplay", currentProgramSceneName: "Gameplay" };
        setTimeout(function () {
            if (self.onmessage) self.onmessage({ data: JSON.stringify({ op: 7, d: { requestType: type, requestId: msg.d.requestId, requestStatus: { result: true, code: 100 }, responseData: data } }) });
        }, 5);
    };
    FakeWebSocket.prototype.close = function () {
        this.readyState = 3;
        if (this.onclose) this.onclose({ code: 1000 });
    };
    globalThis.WebSocket = FakeWebSocket;
    globalThis.__ratArtRestoreWebSocket = function () { globalThis.WebSocket = originalWebSocket; };
}());
