$(function() {
    var opacity = 0.4;
    $('#slider').slider({
        min: 0,
        max: 1,
        step: 0.02,
        value: opacity,
        change: function(e, ui) {
            opacity = ui.value;
            activeLayer.redrawFast();
        }
    });

    var colorFunc = function(i){
        /*return [
            (i*101 % 256)/255,
            (i*505 % 256)/255,
            (i*303 % 256)/255,
            1.0
        ]*/
        var g = i in activeObjs ? 255 : 0;
        return [0, g, 0, opacity];
    };

    var map = L.map('map', {center: [0, 0], zoom: 1});
    var trackLayer = new L.HybridLayer('http://aparshin.ru/maps/rendert/{z}_{x}_{y}', {colorFunc: colorFunc});
    var spotLayer = new L.HybridLayer('http://aparshin.ru/maps/render/{z}_{x}_{y}', {colorFunc: colorFunc});
    var activeLayer = spotLayer;

    activeLayer.addTo(map);

    L.control.layers({
        'SPOT-5 Imagery': spotLayer,
        'OSM Tracks': trackLayer
    }, {}, {collapsed: false}).addTo(map);
    
    map.on('baselayerchange', function(e) {
        activeLayer = e.layer;
    });

    var activeObjs = {};
    var resortedObjs = [];
    map.on('mousemove', function(e) {
        var objs = activeLayer.getObjects(e.latlng, 4);
        // var point = map.options.crs.latLngToPoint(e.latlng, map.getZoom());
        // var objs = activeLayer.getObjectsInPixel(Math.round(point.x), Math.round(point.y), 4);

        /* if (objs.length) {
            var prevIndex = resortedObjs.indexOf(objs[0]);

            prevIndex >= 0 && resortedObjs.splice(prevIndex, 1);

            resortedObjs.push(objs[0]);
        }

        layer.sort(function(id1, id2) {
            var i1 = resortedObjs.indexOf(id1);
                i2 = resortedObjs.indexOf(id2);

            return i1 - i2 || id1 - id2;
        });*/

        activeObjs = {};
        for (var i = 0; i < objs.length; i++) {
            activeObjs[objs[i]] = true;
        }

        activeLayer.redrawFast();
    });
})

