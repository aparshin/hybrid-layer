var TileRenderer = require('./TileRenderer.js'),
    proj4 = require('proj4'),
    Canvas = require('../../../node-canvas'),
    Q = require('q'),
    Bounds = require('./Bounds.js'),
    _ = require('underscore');

    
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

var HybridRenderer = function(geoJSON, options) {
    var tmpCanvas = new Canvas(256, 256);
    this._drawContext = tmpCanvas.getContext('2d');

    options = options || {};

    var drawOptions = options.drawOptions || {};
    for (var o in options) {
        this._drawContext[o] = drawOptions[o];
    }
    
    this.features = [];
    this._mercProj = proj4('EPSG:3857');
    this._filters = options.filters || [];
    this._parseGeom(geoJSON);
}
// predicate receives array of coordinates in Mercator projection
// and should return boolean (false - filter out)
HybridRenderer.prototype.addRingFilter = function(predicate) {
    this._filters.push(predicate);
}

HybridRenderer.prototype._parseGeometryCollection = function(geomObjects, properties) {
    var mercProj = this._mercProj,
        geoms = [],
        commonBounds = new Bounds();

    for (var i = 0; i < geomObjects.length; i++) {
        var type = geomObjects[i].type;

        if (type.indexOf('Polygon') === -1 && type.indexOf('LineString') === -1) {
            continue;
        }

        var rawCoords = geomObjects[i].coordinates,
            isPoly = type.indexOf('Polygon') !== -1,
            coords;
            
        if (type === 'MultiPolygon') {
            coords = rawCoords.map(function(component) { return component[0]; });
        } else if (type === 'LineString') {
            coords = [rawCoords];
        } else if (type === 'Polygon') {
            coords = [rawCoords[0]];
        } else {
            coords = rawCoords;
        }

        for (var c = 0; c < coords.length; c++) {

            var gmerc = coords[c].map(function(p, index) {
                var pm = mercProj.forward(p);
                return [pm[0] + WORLD_SIZE/2, WORLD_SIZE/2 - pm[1]];
            });

            var skip = !!_.find(this._filters, function(filter) {
                return !filter(gmerc);
            });

            if (!skip) {
                var bounds = new Bounds(gmerc);
                geoms.push({
                    coords: gmerc, 
                    isPoly: isPoly,
                    bounds: bounds
                });
                commonBounds.extendFromBounds(bounds);
            }
        }
    }

    if (geoms.length) {
        var ws2 = WORLD_SIZE/2,
            latlngMin = mercProj.inverse([commonBounds.min[0] - ws2, ws2 - commonBounds.min[1]]),
            latlngMax = mercProj.inverse([commonBounds.max[0] - ws2, ws2 - commonBounds.max[1]]);

        this.features.push({
            geoms: geoms, 
            properties: properties,
            bounds: [latlngMin, latlngMax]
        });
    }
}

HybridRenderer.prototype._parseGeom = function(geoJSON, properties) {
    var type = geoJSON.type;

    if (type === 'FeatureCollection') {
        geoJSON.features.forEach(function(feature) {
            this._parseGeom(feature, properties);
        }, this);
    } else if (type === 'Feature'){
        this._parseGeom(geoJSON.geometry, geoJSON.properties);
    } else if (type === 'GeometryCollection'){
        this._parseGeometryCollection(geoJSON.geometries, properties);
    } else {
        this._parseGeometryCollection([geoJSON], properties);
    }
}

HybridRenderer.prototype.renderTile = function(tilePos, options) {
    options = options || {};
    var indexShift = options.indexShift || 0;

    var tileRenderer = new TileRenderer();

    var tileSize = WORLD_SIZE / Math.pow(2, tilePos.z);
    var bounds = {
        min: [tilePos.x * tileSize, tilePos.y * tileSize], 
        max: [(tilePos.x + 1) * tileSize, (tilePos.y + 1) * tileSize]
    };

    for (var f = 0; f < this.features.length; f++) {
        var feature = this.features[f];

        for (var g = 0; g < feature.geoms.length; g++) {
            var geom = feature.geoms[g];

            if (geom.bounds.intersects(bounds)) {
                var ctx = renderRingToTile(this._drawContext, tilePos, geom.coords, geom.isPoly);
                tileRenderer.addObject(ctx, f + indexShift);
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

    var renderOptions = {
        indexShift: options.indexShift
    }

    var tileRenderer = this.renderTile(tilePos, renderOptions);

    console.log(tilePos, tileRenderer.objs.length, tileRenderer.indexes.length);

    if (tileRenderer.objs.length) {

        if (tileRenderer.indexes.length > 1) {

            if (options.loadFromFiles) {
                var filePrefix = this._targetDir + tilePos.z + '_' + tilePos.x + '_' + tilePos.y;
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
