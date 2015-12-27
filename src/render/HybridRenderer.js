var TileRenderer = require('./TileRenderer.js'),
    Canvas = require('canvas'),
    Q = require('q'),
    Bounds = require('./Bounds.js'),
    geojsonvt = require('geojson-vt'),
    fs = require('fs'),
    _ = require('underscore');
    
var MIN_POINTS_IN_TILE = 5000;

var HybridRenderer = function(geoJSON, options) {

    var tmpCanvas = new Canvas(256, 256);
    this._drawContext = tmpCanvas.getContext('2d');

    options = options || {};

    var drawOptions = options.drawOptions || {};
    for (var o in options) {
        this._drawContext[o] = drawOptions[o];
    }
    
    this.features = [];
    this._filters = options.filters || [];

    this._geoJSON = geoJSON;
}

HybridRenderer.renderRingToTile = function(ctx, coords, isPoly) {
    ctx.clearRect(0, 0, 256, 256);
    for (var c = 0; c < coords.length; c++) {
        ctx.beginPath();
        for (var p = 0; p < coords[c].length; p++) {
            ctx[p ? 'lineTo' : 'moveTo'](coords[c][p][0], coords[c][p][1]);
        }
        ctx.rect(coords[c][0][0], coords[c][0][1], 1, 1);
        isPoly ? ctx.fill() : ctx.stroke();
    }

    return ctx;
}

// predicate receives array of coordinates in Mercator projection
// and should return boolean (false - filter out)
HybridRenderer.prototype.addRingFilter = function(predicate) {
    this._filters.push(predicate);
}

HybridRenderer.prototype._getTilePrefix = function(tilePos) {
    return this._targetDir + tilePos.z + '_' + tilePos.x + '_' + tilePos.y;

}

HybridRenderer.prototype.renderTile = function(tilePos, options) {
    options = options || {};
    var indexShift = options.indexShift || 0;

    var tile = this._tileIndex.getTile(tilePos.z, tilePos.x, tilePos.y);

    var tileRenderer = new TileRenderer();

    if (!tile) {
        return tileRenderer;
    }

    var infoFileName = this._getTilePrefix(tilePos) + '_info.txt',
        geomFileName = this._getTilePrefix(tilePos) + '_geom.txt',
        alreadyRendered = true,
        alreadySavedGeom = true;
        
    try {
        fs.statSync(infoFileName);
    } catch (err) {
        alreadyRendered = false;
    }

    try {
        fs.statSync(geomFileName);
    } catch (err) {
        alreadySavedGeom = false;
    }

    if (!alreadyRendered && alreadySavedGeom) {
        var prevTile = JSON.parse(fs.readFileSync(geomFileName)); 

        //merge tiles
        tile.features = tile.features.concat(prevTile.features);
        tile.numPoints += prevTile.numPoints;
        tile.numSimplified += prevTile.numSimplified;
        tile.numFeatures += prevTile.numFeatures;
        
        tile.source = tile.source.concat(prevTile.source);
        tile.min = [Math.min(tile.min[0], prevTile.min[0]), Math.min(tile.min[1], prevTile.min[1])];
        tile.max = [Math.max(tile.max[0], prevTile.max[0]), Math.max(tile.max[1], prevTile.max[1])];
    }

    if (!alreadyRendered && tile.numPoints < MIN_POINTS_IN_TILE) {
        fs.writeFileSync(geomFileName, JSON.stringify(tile));
        return;
    }

    alreadySavedGeom && fs.unlinkSync(geomFileName);

    var features = tile.features;

    for (var f = 0; f < features.length; f++) {
        var feature = features[f],
            isPoly = feature.type === 3;

        var ctx = HybridRenderer.renderRingToTile(this._drawContext, feature.geometry, isPoly);
        tileRenderer.addObject(ctx, feature.tags._hybridIndex);
    }
    return tileRenderer;
}

HybridRenderer.prototype._processTile = function(options) {
    if (!this._renderQueue.length) {
        this._renderDefer.resolve();
        return;
    }

    var tilePos = this._renderQueue.shift(),
        _this = this;

    var renderOptions = {
        indexShift: options.indexShift
    }

    var tileRenderer = this.renderTile(tilePos, renderOptions);

    if (tileRenderer) {
        console.log(tilePos, tileRenderer.objs.length, tileRenderer.indexes.length);
    } else {
        console.log(tilePos, 'Save geometry to file');
    }

    if (tileRenderer && tileRenderer.objs.length && tileRenderer.indexes.length > 1) {

        if (options.loadFromFiles) {
            var filePrefix = this._getTilePrefix(tilePos);
            tileRenderer.loadFromFiles(filePrefix);
        }

        tileRenderer.saveToFiles(filePrefix).then(function() {
            if (tilePos.z < _this._maxZoom) {
                _this._renderQueue.push({x: 2*tilePos.x,   y: 2*tilePos.y,   z: tilePos.z+1});
                _this._renderQueue.push({x: 2*tilePos.x+1, y: 2*tilePos.y,   z: tilePos.z+1});
                _this._renderQueue.push({x: 2*tilePos.x,   y: 2*tilePos.y+1, z: tilePos.z+1});
                _this._renderQueue.push({x: 2*tilePos.x+1, y: 2*tilePos.y+1, z: tilePos.z+1});
            }
            setTimeout(_this._processTile.bind(_this, options), 0);
        });
    } else {
        setTimeout(this._processTile.bind(this, options), 0);
    }
}

HybridRenderer.prototype.render = function(options) {
    //TODO: just pass options, don't use class attributes?
    this._maxZoom = options.maxZoom || 7;
    this._targetDir = options.targetDir || './result/';
    this._renderQueue = [{z: 0, x: 0, y: 0}];
    this._renderDefer = new Q.defer();

    var tileOptions = {
        indexShift: options.indexShift,
        loadFromFiles: options.loadFromFiles
    }
    
    this._tileIndex = geojsonvt(this._geoJSON, {
        maxZoom: this._maxZoom,
        extent: 256,
        buffer: 16,
        indexMaxZoom: 0, //geojson-vt removes source geometry during index creation
        filters: this._filters
    });

    this.features = this._tileIndex.getTile(0, 0, 0).source;

    for (var f = 0; f < this.features.length; f++) {
        this.features[f].tags._hybridIndex = options.indexShift + f;
    }

    this._processTile(tileOptions);

    return this._renderDefer.promise;
}

module.exports = HybridRenderer;
