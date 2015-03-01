var TileRenderer = require('./TileRenderer.js');

var HybridRenderer = function() {
}

HybridRenderer.prototype._processTile = function(tilePos) {
    var tileRender = this._tileRender;
    console.log(tilePos);
    var count = tileRender.renderTile(tilePos);
    console.log('Objects in tile: ', count);

    if (count) {
        var filePrefix = this._targetDir + tilePos.z + '_' + tilePos.x + '_' + tilePos.y;
        tileRender.removeNotUsed();
        tileRender.saveToFiles(filePrefix);
        if (tilePos.z < this._maxZoom) {
            this._processTile({x: 2*tilePos.x,   y: 2*tilePos.y,   z: tilePos.z+1});
            this._processTile({x: 2*tilePos.x+1, y: 2*tilePos.y,   z: tilePos.z+1});
            this._processTile({x: 2*tilePos.x,   y: 2*tilePos.y+1, z: tilePos.z+1});
            this._processTile({x: 2*tilePos.x+1, y: 2*tilePos.y+1, z: tilePos.z+1});
        }
    };
}

HybridRenderer.prototype.render = function(geoJSON, options) {
    this._maxZoom = options.maxZoom || 7;
    this._targetDir = options.targetDir || './result/';
    this._tileRender = new TileRenderer(geoJSON);
    this._processTile({z: 0, x: 0, y: 0});
}

module.exports = HybridRenderer;
