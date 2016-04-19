L.HybridLayer = L.TileLayer.Canvas.extend({
    options: {
        async: true,
        colorFunc: function(i) {
            return [0, 0, 0, 0.2];
        },
        sortFunc: function(a, b) {
            return a - b;
        },
        infoFile: null
    },

    initialize: function (url, options) {
        L.setOptions(this, options);

        this._tileViewers = {};
        this._url = url;
        this._renderHooks = [];

        this._objectsManager._colorFunc = this.options.colorFunc;

        if (this.options.indexFunc) {
            this._objectsManager.getIndexColor = this.options.indexFunc;
        }

        this.on('tileunload', function(e) {
            var id = L.stamp(e.tile);

            delete this._tileViewers[id];
        }, this);

        this.initPromise = $.Deferred();

        if (this.options.infoFile) {
            $.getJSON(this.options.infoFile).then(function(info) {
                this.objectsInfo = info;
                this.initPromise.resolve();
            }.bind(this))
        } else {
            this.initPromise.resolve();
        }
    },

    _renderTileByID: function(id) {
        var tile = this._tileViewers[id];
        tile.viewer.render(tile.canvas.getContext('2d'));
        for (var r = 0; r < this._renderHooks.length; r++) {
            this._renderHooks[r](tile.canvas, tile.tilePoint, tile.zoom, tile.viewer);
        }
    },

    drawTile: function(canvas, tilePoint, zoom) {
        var _this = this,
            prefix = L.Util.template(this._url, {
                x: tilePoint.x,
                y: tilePoint.y,
                z: zoom
            }),
            crs = this._map.options.crs,
            id = L.stamp(canvas);

        var bounds = L.latLngBounds(
                crs.pointToLatLng({x: tilePoint.x*256, y: tilePoint.y*256}, zoom),
                crs.pointToLatLng({x: tilePoint.x*256 + 256, y: tilePoint.y*256 + 256}, zoom)
            );

        var tileViewer = new HybridTileViewer(
            prefix + '.png', 
            prefix + '.bin', 
            {objectsManager: this._objectsManager}
        );

        tileViewer.promise.then(function() {
            //tileViewer.sort(_this.options.sortFunc);
            _this._tileViewers[id] = {
                bounds: bounds,
                viewer: tileViewer,
                canvas: canvas,
                tilePoint: tilePoint,
                zoom: zoom
            };

            _this._renderTileByID(id);
            _this.tileDrawn(canvas);
        }, function() {
            _this.tileDrawn(canvas);
        });
    },

    redrawFast: function() {
        var mapBounds = this._map.getBounds();

        var time = new Date(),
            count = 0;

        this._objectsManager.clearCache();

        for (var t in this._tileViewers) {
            var tile = this._tileViewers[t];
            if (tile.bounds.intersects(mapBounds)) {
                count++;
                this._renderTileByID(t);
            }
        }
        console.log('Total (%d): %d', count, new Date() - time);
    },

    getObjects: function(latlng, size) {
        var point = this._map.options.crs.latLngToPoint(latlng, this._map.getZoom()),
            x = Math.round(point.x),
            y = Math.round(point.y),
            tx = Math.floor(x / 256),
            ty = Math.floor(y / 256);

        var tile = this._tiles[tx + ':' + ty];

        if (tile) {
            var tileViewer = this._tileViewers[L.stamp(tile)];

            if (tileViewer) {
                return tileViewer.viewer.getObjectsNearPixel(x % 256, y % 256, size);
            }
        }

        return [];
    },

    sort: function(sortFunc) {
        for (var id in this._tileViewers) {
            this._tileViewers[id].viewer.sort(sortFunc);
        }
    },

    // stores information about single objects' colors
    // shares this information between all the tiles
    _objectsManager: {
        _objColors: [],
        _colorFunc: null,
        getColor: function(objId) {
            var c = this._objColors;

            c[objId] = c[objId] || this._colorFunc(objId);

            return c[objId];
        },
        clearCache: function() {
            this._objColors = [];
        }
    },

    addRenderHook: function(renderHook) {
        this._renderHooks.push(renderHook);
    }
})

