$(function() {
    var opacity = 0.4,
        opacityHash = [];
    $('#slider').slider({
        min: 0,
        max: 1,
        step: 0.02,
        value: opacity,
        change: function(e, ui) {
            opacity = ui.value;
            opacityHash = [];
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
        return [g, 0, 255, opacity];
    };

    var indexFunc = function(objs) {
        var len = objs.length;
        if (!len) {
            return [0, 0, 0, 0];
        }
        var totalOpacity = opacityHash[len];
        if (!totalOpacity) {
            totalOpacity = opacityHash[len] = 1 - Math.pow(1 - opacity, len);
        }

        for (var i = 0; i < objs.length; i++) {
            if (objs[i] in activeObjs) {
                return [255, 0, 255, totalOpacity];
            }
        }
        return [0, 0, 255, totalOpacity];
    }

    var map = L.map('map', {center: [-27.6, 134.824], zoom: 4, maxZoom: 10});
    var osm = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: 'Data © <a href="http://osm.org/about/" target="_blank">OpenStreetMap</a> contributors'
    }).addTo(map);
    var trackLayer = new L.HybridLayer('http://localhost/maps/tracks4/{z}_{x}_{y}', {
    // var trackLayer = new L.HybridLayer('http://aparshin.ru/maps/tracks4/{z}_{x}_{y}', {
        colorFunc: colorFunc,
        indexFunc: indexFunc,
        infoFile: 'http://aparshin.ru/maps/tracks4/filenames.js'
    });
    // var spotLayer = new L.HybridLayer('http://aparshin.ru/maps/render/{z}_{x}_{y}', {colorFunc: colorFunc});
    var activeLayer = trackLayer;

    /*
    trackLayer.addRenderHook(function(canvas, tilePoint, zoom, tileViewer) {
        var ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.rect(0, 0, 256, 256);
        ctx.stroke();
        ctx.font = "20px arial";
        ctx.fillText(tilePoint.x + ':' + tilePoint.y + ':' + zoom, 10, 20);
        ctx.fillText('Indexes: ' + tileViewer.indexes.length, 10, 40);

        var objs = {},
            inds = tileViewer.indexes,
            objsCount = 0;

        for (var i = 0; i < inds.length; i++) {
            for (var j = 0; j < inds[i].length; j++) {
                objs[inds[i][j]] = true;
            }
        }

        for (var t in objs) {objsCount++};

        ctx.fillText('Objects: ' + objsCount, 10, 60);
    })
    */

    activeLayer.addTo(map);

    /*L.control.layers({
        'SPOT-5 Imagery': spotLayer,
        'OSM Tracks': trackLayer
    }, {}, {collapsed: false}).addTo(map);
    
    map.on('baselayerchange', function(e) {
        activeLayer = e.layer;
    });*/

    var activeObjs = {},
        activeObjsArray = [];
    var resortedObjs = [];
    map.on('mousemove', function(e) {
        var objs = activeLayer.getObjects(e.latlng, 4);

        var changed = true;
        if (objs.length === activeObjsArray.length) {
            changed = false;
            for (var i = 0; i < objs.length; i++) {
                if (objs[i] !== activeObjsArray[i]) {
                    changed = true;
                    break;
                }
            }
        }

        if (!changed) {return;}

        activeObjsArray = objs;

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

        /* if (activeLayer.objectsInfo && objs.length) {
            console.log(objs.map(function(objID) {
                return activeLayer.objectsInfo[objID]
            }));
        }*/

        activeObjs = {};
        for (var i = 0; i < objs.length; i++) {
            activeObjs[objs[i]] = true;
        }

        activeLayer.redrawFast();
    });
})

