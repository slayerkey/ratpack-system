/* Deterministic browser fixture for Rat Art and XENEON QA captures. */
(function () {
    globalThis.uniqueId = "rat-art";
    globalThis.obsPort = "4455";
    globalThis.obsPassword = "";
    globalThis.textColor = "#F2F5F7";
    globalThis.accentColor = "#2BE86A";
    globalThis.backgroundColor = "#0B0E11";
    globalThis.tr = async function (value) { return value; };
    globalThis.__PACKRAT_OBS_FIXTURE__ = {
        bitrate: 6128,
        bitrateHistory: [
            5980, 6012, 6070, 6048, 6095, 6130, 6088, 6112, 6160, 6128,
            6184, 6146, 6202, 6176, 6104, 6068, 6120, 6156, 6198, 6168,
            6142, 6118, 6086, 6138, 6172, 6206, 6188, 6162, 6126, 6094,
            6110, 6152, 6190, 6218, 6174, 6136, 6108, 6148, 6182, 6160,
            6122, 6098, 6134, 6178, 6200, 6184, 6154, 6116, 6082, 6124,
            6166, 6194, 6170, 6140, 6106, 6132, 6168, 6204, 6176, 6128
        ],
        stream: {
            outputActive: true,
            outputReconnecting: false,
            outputTimecode: "00:42:18",
            outputDuration: 2538000,
            outputBytes: 1512000000,
            outputSkippedFrames: 23,
            outputTotalFrames: 151860,
            outputCongestion: 0.02
        },
        record: {
            outputActive: true,
            outputPaused: false,
            outputTimecode: "00:18:42",
            outputDuration: 1122000,
            outputBytes: 887000000
        },
        stats: {
            availableDiskSpace: 481920,
            outputSkippedFrames: 17,
            outputTotalFrames: 151854,
            renderSkippedFrames: 3,
            renderTotalFrames: 151900
        },
        currentScene: "Gameplay",
        scenes: [
            { sceneName: "Gameplay", sceneIndex: 0 },
            { sceneName: "Just Chatting", sceneIndex: 1 },
            { sceneName: "Starting Soon", sceneIndex: 2 },
            { sceneName: "BRB", sceneIndex: 3 },
            { sceneName: "Ending", sceneIndex: 4 }
        ]
    };
}());
