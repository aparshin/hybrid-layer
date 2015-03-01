var proj4 = require('proj4'),
    Canvas = require('../../../node-canvas'),
    Q = require('q'),
    fs = require('fs');

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

var TileRenderer = function(geoJSON) {

    this.nextObjIndex = 0;

    var tmpCanvas = new Canvas(256, 256);

    this._drawContext = tmpCanvas.getContext('2d');
    this._geoms = [];
    this._mercProj = proj4('EPSG:3857');
    this._parseGeom(geoJSON);
}


TileRenderer.prototype._parseGeom = function(geoJSON) {
    var mercProj = this._mercProj;
    if (geoJSON.type === 'FeatureCollection') {
        console.log('FeatureCollection');

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

TileRenderer.prototype.renderTile = function(tilePos, geoJSON) {
    this.buf = new Uint32Array(256*256);
    this.objs = [[]];
    this.nextIndex = 1;
    this.debugHist = [256*256];

    var tileSize = WORLD_SIZE / Math.pow(2, tilePos.z);
    var bounds = {
        min: [tilePos.x * tileSize, tilePos.y * tileSize], 
        max: [(tilePos.x + 1) * tileSize, (tilePos.y + 1) * tileSize]
    };

    var count = 0;

    for (var g = 0; g < this._geoms.length; g++) {
        var coords = this._geoms[g].coords,
            isPoly = this._geoms[g].isPoly;
        for (var p = 0; p < coords.length; p++) {
            if (isInside(bounds, coords[p])) {
                var ctx = renderRingToTile(this._drawContext, tilePos, coords, isPoly);
                this.addObject(ctx, g);
                count++;
                break;
            }
        }
    }
    return count;
}

TileRenderer.prototype.addObject = function(ctx, id) {
    var t = new Date();
    var data = ctx.getImageData(0, 0, 256, 256).data;
    
    var cache = [];
    
    for (var p = 0; p < 256*256; p++) {
        if (!data[4*p+3]) {continue;}

        var prevIndex = this.buf[p];
        this.debugHist[prevIndex]--;
        if (!cache[prevIndex]) {
            var newSet = this.objs[prevIndex].concat([id]),
                newIndex = this.objs.length;
                
            this.objs.push(newSet);
            this.buf[p] = newIndex;
            
            cache[prevIndex] = newIndex;
        }
        
        this.buf[p] = cache[prevIndex];
        this.debugHist[cache[prevIndex]] = (this.debugHist[cache[prevIndex]] || 0) + 1;
    }
}

TileRenderer.prototype.removeNotUsed = function() {
    var newObjs = [],
        dict = [];

    for (var i = 0; i < this.objs.length; i++) {
        if (this.debugHist[i]) {
            dict[i] = newObjs.length;
            newObjs.push(this.objs[i]);
        }
    }

    this.objs = newObjs;

    for (var p = 0; p < this.buf.length; p++){
        var idx = this.buf[p];
        if (dict[idx]) {
             this.buf[p] = dict[idx];
        }
    }
}

TileRenderer.prototype.analyze = function() {
    var count = 0;
        max = 0,
        total = 0,
        hist = [],
        hist2 = [];
        
    for (var i = 0; i < this.objs.length; i++) {
        count++;
        
        var len = this.objs[i].length;
        max = Math.max(max, len);
        total += len;
        hist[len] = (hist[len] || 0) + 1;
        
        var pc = this.debugHist[i];
        if (pc < 1000000000) {
            hist2[pc] = (hist2[pc] || 0) + 1;
        }
    }
    console.log('Total count: ', count);
    console.log('Total length: ', total);
    console.log('Max: ', max);
    // console.log('Histogram: ', hist);
    // console.log('Number of pixels: ', hist2);
}

TileRenderer.prototype.saveToFiles = function(prefix) {
    var pngFile = fs.createWriteStream(prefix + '_img.png'),
        canvas = new Canvas(256, 256),
        ctx = canvas.getContext('2d');

    var def = Q.defer();

    var dataInfo = ctx.getImageData(0, 0, 256, 256);
    var uint8Buf = new Uint8Array(this.buf.buffer);

    for (var p = 0; p < 256*256*4; p++) {
        dataInfo.data[p] = uint8Buf[p];
        if (p % 4 === 3) {dataInfo.data[p] = 255;}
    }

    ctx.putImageData(dataInfo, 0, 0);

    var stream = canvas.pngStream();

    stream.on('data', function(chunk){
        pngFile.write(chunk);
    });

    stream.on('end', function(){
        pngFile.end();
        def.resolve();
    });
    
    var txtFile = fs.writeFileSync(prefix + '_info.txt', JSON.stringify(this.objs));

    return def.promise;
}

module.exports = TileRenderer;
