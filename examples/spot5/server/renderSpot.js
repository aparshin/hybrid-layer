var spot5 = require('./data/Operative_SPOT5_MS.js'),
    HybridRenderer = require('../../src/render/HybridRenderer.js');

var hybridRenderer = new HybridRenderer(spot5);

hybridRenderer.render({
    maxZoom: 3,
    targetDir: './result/'
})
