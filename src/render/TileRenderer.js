var Canvas = require('canvas'),
    Q = require('q'),
    fs = require('fs');

var TileRenderer = function() {
    this.buf = new Uint32Array(256*256);
    this.indexes = [[]];
    this.debugHist = [256*256];
    this.objs = []; //for external use
}


TileRenderer.prototype.addObject = function(ctx, id, options) {
    options = options || {};
    var minAlpha = options.minAlpha || 1,
        maxAlpha = options.maxAlpha || 256,
        data = ctx.getImageData(0, 0, 256, 256).data,
        cache = [];

    if (this.objs.indexOf(id) === -1) {
        this.objs.push(id);
    }
    
    for (var p = 0; p < 256*256; p++) {
        if (data[4*p+3] < minAlpha || data[4*p+3] >= maxAlpha) {
            continue;
        }

        var prevIndex = this.buf[p];
        this.debugHist[prevIndex]--;
        if (!cache[prevIndex]) {
            var newIndex;

            if (this.indexes[prevIndex].indexOf(id) === -1) {
                var newSet = this.indexes[prevIndex].concat([id]);

                newIndex = this.indexes.length;
                this.indexes.push(newSet);
            } else {
                newIndex = prevIndex;
            }

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
        this.buf[p] = dict[this.buf[p]];
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

TileRenderer.prototype.getPNGStream = function() {
    var canvas = new Canvas(256, 256),
        ctx = canvas.getContext('2d');

    var dataInfo = ctx.getImageData(0, 0, 256, 256);
    var uint8Buf = new Uint8Array(this.buf.buffer);

    for (var p = 0; p < 256*256*4; p++) {
        dataInfo.data[p] = uint8Buf[p];
        if (p % 4 === 3) {dataInfo.data[p] = 255;}
    }

    ctx.putImageData(dataInfo, 0, 0);

    return canvas.pngStream();
}

TileRenderer.prototype.saveToFiles = function(prefix, options) {
    options = options || {};

    options.skipOptimization || this.removeNotUsed();

    var pngFD = fs.openSync(prefix + '_img.png', 'w'),
        def = Q.defer(),
        stream = this.getPNGStream();

    stream.on('data', function(chunk){
        fs.writeSync(pngFD, chunk, null, chunk.length);
    });

    stream.on('end', function(){
        fs.closeSync(pngFD);
        def.resolve();
    });
   
    if (options.binaryFormat) { 
        var arr = TileRenderer.indexesToArray(this.indexes),
            buffer = new Buffer(arr.buffer);

        fs.writeFileSync(prefix + '_binfo', buffer);
    } else {
        fs.writeFileSync(prefix + '_info.txt', JSON.stringify(this.indexes));
    }

    return def.promise;
}

//suppose that already rendered objects and objects from file are not intersected
TileRenderer.prototype.loadFromFiles = function(filesPrefix, options) {
    option = options || {};
    var pngFilename = filesPrefix + '_img.png',
        infoFilename = filesPrefix + (options.binaryFormat ? '_binfo' : '_info.txt');

    if (!fs.existsSync(pngFilename) || !fs.existsSync(infoFilename)) {
        return;
    }
    
    var canvas = new Canvas(256, 256),
        ctx = canvas.getContext('2d'),
        img = new Canvas.Image();

    img.src = pngFilename;
    ctx.drawImage(img, 0, 0, 256, 256);
    
    var data = ctx.getImageData(0, 0, 256, 256).data,
        converter = options.binaryFormat ? TileRenderer.arrayToIndexes : JSON.parse,
        newIndexes = converter(fs.readFileSync(infoFilename));

    var mergeCache = {};
    for (var i = 0; i < 256*256; i++) {
        var ind = data[4*i] + (data[4*i+1] << 8) + (data[4*i+2] << 16),
            prevInd = this.buf[i],
            mergeInd = prevInd + '_' + ind;

        if (!ind) {continue;}

        if (!mergeCache[mergeInd]) {
            mergeCache[mergeInd] = this.indexes.length;
            this.indexes.push(newIndexes[ind].concat(this.indexes[prevInd]));
        }
        this.debugHist[prevInd]--;

        var newInd = mergeCache[mergeInd];
        this.buf[i] = newInd;
        this.debugHist[newInd] = (this.debugHist[newInd] || 0) + 1;
    }

    var objsHash = {};

    //update this.objs
    for (var i = 0; i < newIndexes.length; i++) {
        for (var j = 0; j < newIndexes[i].length; j++) {
            objsHash[newIndexes[i][j]] = true;
        }
    }

    for (var i in objsHash) {
        this.objs.push(objsHash[i]);
    }
}

TileRenderer.indexesToArray = function(indexes) {
    var prefixLength = 1 + indexes.length,
        length = 0;

    for (var n = 0; n < indexes.length; n++) {
        length += indexes[n].length;
    }


    var arr = new Uint32Array(prefixLength + length);

    arr[0] = indexes.length;

    var curArrIndex = prefixLength;

    for (var n = 0; n < indexes.length; n++) {
        arr[n + 1] = curArrIndex;
        arr.set(indexes[n], curArrIndex);
        curArrIndex += indexes[n].length;
    }

    return arr;
}

TileRenderer.arrayToIndexes = function(buffer) {
    var tmpArr = new Uint8Array(buffer),
        arr = new Uint32Array(tmpArr.buffer),
        count = arr[0],
        resArr = new Array(count);

    for (var i = 0; i < count; i++) {
        var begin = arr[i+1],
            end = i === count - 1 ? arr.length : arr[i+2];

        resArr[i] = Array.prototype.slice.call(arr.subarray(begin, end));
    }

    return resArr;
}

module.exports = TileRenderer;
