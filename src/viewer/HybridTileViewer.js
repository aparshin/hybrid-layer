var HybridTileViewer = function(imgUrl, infoUrl, options) {
    var _this = this;
    this.promise = $.Deferred();
    this._objColors = [];
    this._indColors = [];
    this.options = options;

    this._sortFunc = function(a, b) {
        return a - b;
    }

    var infoDef = $.getJSON(infoUrl);

    var img = new Image();
    img.onload = function() {
        infoDef.then(function(indexes) {
            _this.indexes = indexes;

            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = tmpCanvas.height = 256;

            var tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.drawImage(img, 0, 0);

            _this._buf = new Uint32Array(tmpCtx.getImageData(0, 0, 256, 256).data.buffer);

            _this.promise.resolve();
        })
    }

    img.onerror = function() {
        _this.promise.reject();
    }

    img.crossOrigin = "Anonymous";

    img.src = imgUrl;
}

HybridTileViewer.prototype.render = function(ctx) {
    var dataInfo = ctx.getImageData(0, 0, 256, 256),
        data = dataInfo.data;

    this._indColors = [];
    for (var p = 0; p < 256*256; p++) {
        var index = this._buf[p] & 0xffffff;

        if (!this._indColors[index]) {
            var objs = this.indexes[index],
                a = [0, 0, 0, 0];
            
            for (var i = 0; i < objs.length; i++) {
                var b = this.options.objectsManager.getColor(objs[i]);
                var ta = b[3]*(1.0 - a[3]);
                var ra = a[3] + ta;

                if (ra > 0) {
                    var r0 = (a[0]*a[3] + b[0]*ta)/ra;
                    var r1 = (a[1]*a[3] + b[1]*ta)/ra;
                    var r2 = (a[2]*a[3] + b[2]*ta)/ra;
                    a = [r0, r1, r2, ra];
                }
            }
            this._indColors[index] = a;
        }

        var color = this._indColors[index];
        data[4*p + 0] = ~~(255*color[0]);
        data[4*p + 1] = ~~(255*color[1]);
        data[4*p + 2] = ~~(255*color[2]);
        data[4*p + 3] = ~~(255*color[3]);
    }

    ctx.putImageData(dataInfo, 0, 0);
}

HybridTileViewer.prototype.getObjectsNearPixel = function(x, y, size) {
    size = size || 1;
    var xmin = Math.max(x - Math.round(size/2) + 1, 0),
        ymin = Math.max(y - Math.round(size/2) + 1, 0),
        xmax = Math.min(xmin + size, 255),
        ymax = Math.min(ymin + size, 255);

    var commonObjHash = {};
    
    for (var ix = xmin; ix < xmax; ix++) {
        for (var iy = ymin; iy < ymax; iy++) {
            var index = this._buf[iy*256 + ix] & 0xffffff;
            var objs = this.indexes[index];
            for (var i = 0; i < objs.length; i++) {
                commonObjHash[objs[i]] = true;
            }
        }
    }

    var res = [];
    for (var i in commonObjHash) {
        res.push(i);
    }

    return res.sort(this._sortFunc);
}

HybridTileViewer.prototype.sort = function(sortFunc) {
    this._sortFunc = sortFunc;
    for (var k in this.indexes) {
        this.indexes[k] = this.indexes[k].sort(sortFunc);
    }
}
