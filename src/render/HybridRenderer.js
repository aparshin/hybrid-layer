var TileRenderer = require('./TileRenderer.js'),
    proj4 = require('proj4'),
    Canvas = require('../../../node-canvas'),
    Q = require('q');

    
var WORLD_SIZE = proj4('EPSG:3857').forward([180, 0])[0]*2;

var renderRingToTile = function(ctx, tilePos, coords, isPoly) {
    var pixelSize = WORLD_SIZE / Math.pow(2, tilePos.z + 8);
        tileSize = pixelSize * 256,
        x0 = tilePos.x * tileSize,
        y0 = tilePos.y * tileSize;
        
    ctx.clearRect(0, 0, 256, 256);
    ctx.beginPath();
    for (var p = 0; p < coords.length; p++) {
        var x = (coords[p][0] - x0) / pixelSize,
            y = (coords[p][1] - y0) / pixelSize;
            
        ctx[p ? 'lineTo' : 'moveTo'](x, y);
    }
    
    isPoly ? ctx.fill() : ctx.stroke();
    return ctx;
}

var isInside = function(bounds, point) {
    return bounds.min[0] <= point[0] && bounds.min[1] <= point[1] && 
           bounds.max[0] >= point[0] && bounds.max[1] >= point[1];
}

var HybridRenderer = function(geoJSON) {
    var tmpCanvas = new Canvas(256, 256);
    this._drawContext = tmpCanvas.getContext('2d');

    this._geoms = [];
    this._mercProj = proj4('EPSG:3857');
    this._parseGeom(geoJSON);
}

HybridRenderer.prototype._parseGeom = function(geoJSON) {
    var mercProj = this._mercProj;
    if (geoJSON.type === 'FeatureCollection') {
        geoJSON.features.forEach(this._parseGeom.bind(this));
    } else if (geoJSON.type === 'Feature'){
        return this._parseGeom(geoJSON.geometry);
    } else if (geoJSON.type === 'GeometryCollection'){
        return geoJSON.geometries.forEach(this._parseGeom.bind(this));
    } else if (geoJSON.type === 'Polygon' || geoJSON.type === 'LineString'){
        var isPoly = geoJSON.type === 'Polygon',
            coords = isPoly ? geoJSON.coordinates[0] : geoJSON.coordinates;
        var gmerc = coords.map(function(p) {
            var pm = mercProj.forward(p);
            return [pm[0] + WORLD_SIZE/2, WORLD_SIZE/2 - pm[1]];
        });
        this._geoms.push({
            coords: gmerc, 
            isPoly: isPoly
        });
    }
}

HybridRenderer.prototype.renderTile = function(tilePos, options) {
    options = options || {};
    var indexShift = options.indexShift || 0;

    var tileRenderer = new TileRenderer();

    if (options.loadPrefix) {
        tileRenderer.loadFromFiles(options.loadPrefix);
    }

    var tileSize = WORLD_SIZE / Math.pow(2, tilePos.z);
    var bounds = {
        min: [tilePos.x * tileSize, tilePos.y * tileSize], 
        max: [(tilePos.x + 1) * tileSize, (tilePos.y + 1) * tileSize]
    };

    for (var g = 0; g < this._geoms.length; g++) {
        var coords = this._geoms[g].coords,
            isPoly = this._geoms[g].isPoly;
        for (var p = 0; p < coords.length; p++) {
            if (isInside(bounds, coords[p])) {
                var ctx = renderRingToTile(this._drawContext, tilePos, coords, isPoly);
                tileRenderer.addObject(ctx, g + indexShift);
                break;
            }
        }
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

    console.log(tilePos);

    var filePrefix = this._targetDir + tilePos.z + '_' + tilePos.x + '_' + tilePos.y;

    var renderOptions = {
        indexShift: options.indexShift
    }
    if (options.loadFromFiles) {
        renderOptions.loadPrefix = filePrefix;
    }

    var tileRenderer = this.renderTile(tilePos, renderOptions);
    console.log('Objects in tile: ', tileRenderer.objs.length);

    if (tileRenderer.objs.length) {
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

    this._processTile(tileOptions);

    return this._renderDefer.promise;
}

module.exports = HybridRenderer;
