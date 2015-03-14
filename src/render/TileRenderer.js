var Canvas = require('../../../node-canvas'),
    Q = require('q'),
    fs = require('fs');

var TileRenderer = function() {
    this.buf = new Uint32Array(256*256);
    this.indexes = [[]];
    this.debugHist = [256*256];
    this.objs = [];
}


TileRenderer.prototype.addObject = function(ctx, id, options) {
    options = options || {};
    var minAlpha = options.minAlpha || 1,
        maxAlpha = options.maxAlpha || 256,
        data = ctx.getImageData(0, 0, 256, 256).data,
        cache = [];

    this.objs.push(id);
    
    for (var p = 0; p < 256*256; p++) {
        if (data[4*p+3] < minAlpha || data[4*p+3] >= maxAlpha) {
            continue;
        }

        var prevIndex = this.buf[p];
        this.debugHist[prevIndex]--;
        if (!cache[prevIndex]) {
            //TODO: check that new id is not already in array
            var newSet = this.indexes[prevIndex].concat([id]),
                newIndex = this.indexes.length;
                
            this.indexes.push(newSet);
            this.buf[p] = newIndex;
            
            cache[prevIndex] = newIndex;
        }
        
        this.buf[p] = cache[prevIndex];
        this.debugHist[cache[prevIndex]] = (this.debugHist[cache[prevIndex]] || 0) + 1;
    }
}

TileRenderer.prototype.removeNotUsed = function() {
    var newIndexes = [],
        dict = [];

    for (var i = 0; i < this.indexes.length; i++) {
        if (this.debugHist[i]) {
            dict[i] = newIndexes.length;
            newIndexes.push(this.indexes[i]);
        }
    }

    this.indexes = newIndexes;

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
        
    for (var i = 0; i < this.indexes.length; i++) {
        count++;
        
        var len = this.indexes[i].length;
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

    this.removeNotUsed();

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
    
    var txtFile = fs.writeFileSync(prefix + '_info.txt', JSON.stringify(this.indexes));

    return def.promise;
}

module.exports = TileRenderer;
