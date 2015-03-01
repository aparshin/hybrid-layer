L.HybridLayer = L.TileLayer.Canvas.extend({
    options: {
        async: true,
        colorFunc: function(i) {
            return [0, 0, 0, 0.2];
        }
    },

    initialize: function (url, options) {
        L.setOptions(this, options);

        this._tileViewers = {};
        this._url = url;

        this.on('tileunload', function(e) {
            var id = L.stamp(e.tile);

            delete this._tileViewers[id];
        }, this);
    },

    drawTile: function(canvas, tilePoint, zoom) {
        var _this = this,
            prefix = L.Util.template(this._url, {
                x: tilePoint.x,
                y: tilePoint.y,
                z: zoom
            }),
            // prefix = 'http://localhost/maps/rendert/' + zoom + '_' + tilePoint.x + '_' + tilePoint.y,
            crs = this._map.options.crs,
            id = L.stamp(canvas);

        var bounds = L.latLngBounds(
                crs.pointToLatLng({x: tilePoint.x*256, y: tilePoint.y*256}, zoom),
                crs.pointToLatLng({x: tilePoint.x*256 + 256, y: tilePoint.y*256 + 256}, zoom)
            );

        var tileViewer = new HybridTileViewer(
            prefix + '_img.png', 
            prefix + '_info.txt', 
            {color: this.options.colorFunc}
        );

        tileViewer.promise.done(function() {
            _this._tileViewers[id] = {
                bounds: bounds,
                viewer: tileViewer,
                canvas: canvas
            };

            tileViewer.render(canvas.getContext('2d'));
            _this.tileDrawn(canvas);
        }, function() {
            _this.tileDrawn(canvas);
        });
    },

    redrawFast: function() {
        var mapBounds = this._map.getBounds();

        var time = new Date(),
            count = 0;

        for (var t in this._tileViewers) {
            var tile = this._tileViewers[t];
            if (tile.bounds.intersects(mapBounds)) {
                count++;
                tile.viewer.render(tile.canvas.getContext('2d'));
            }
        }
        console.log('Total (%d): %d', count, new Date() - time);
    },

    getObjectsInPixel: function(x, y) {
        var tx = Math.floor(x / 256),
            ty = Math.floor(y / 256);

        var tile = this._tiles[tx + ':' + ty];

        if (tile) {
            var tileViewer = this._tileViewers[L.stamp(tile)];

            if (tileViewer) {
                return tileViewer.viewer.getObjectsInPixel(x % 256, y % 256);
            }
        }

        return [];
    },

    sort: function(sortFunc) {
        for (var id in this._tileViewers) {
            this._tileViewers[id].viewer.sort(sortFunc);
        }
    }
})

