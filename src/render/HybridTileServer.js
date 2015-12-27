var express = require('express'),
    compression = require('compression'),
    cors = require('cors'),
    fs = require('fs'),
    geojsonvt = require('geojson-vt'),
    Canvas = require('canvas'),

    HybridRenderer = require('./HybridRenderer'),
    TileRenderer = require('./TileRenderer');

var app = express();

// var FILES_PREFIX = './../../examples/routes/server/result/';
var FILES_PREFIX = './../../examples/tracks/server/result/';

var tileIndex = geojsonvt({type: 'MultiLineString', coordinates: []}, {
    maxZoom: 17,
    extent: 256,
    buffer: 16,
    debug: 2
});

var tmpCanvas = new Canvas(256, 256);
var drawContext = tmpCanvas.getContext('2d');

//FIXME
delete tileIndex.getTile(0, 0, 0).source;

var tileRenderers = {};

function toID(z, x, y) {
    return (((1 << z) * y + x) * 32) + z;
}

var getGeometry = function(z0, x0, y0) {
    console.log('getGeometry');
    return new Promise(function checkFiles(z, x, y, resolve, reject) {
        var geomFilename = FILES_PREFIX + z + '_' + x + '_' + y + '_geom.txt',
            infoFilename = FILES_PREFIX + z + '_' + x + '_' + y + '_info.txt';

        console.log('check', geomFilename, infoFilename);

        fs.access(infoFilename, fs.R_OK, function(err) {
            if (!err) { //we found rendered tile, so, there are no geometry in our subtile
                reject();
                return; 
            }              
            fs.access(geomFilename, fs.R_OK, function(err) {
                if (!err) {
                    fs.readFile(geomFilename, 'utf8', function(err, tile) {
                        var id = toID(z, x, y);
                        tileIndex.tiles[id] = JSON.parse(tile);
                        console.log(id, z, x, y, z0, x0, y0);
                        var targetTile = tileIndex.getTile(z0, x0, y0); 
                        if (targetTile) {
                            resolve(targetTile.features);
                        } else {
                            reject();
                        }
                    })
                } else {
                    if (z === 0) {
                        reject();
                    } else {
                        checkFiles(z - 1, x >> 1, y >> 1, resolve, reject);
                    }
                }
            });

        });
    }.bind(null, z0, x0, y0));
}

var responseFromRenderer = function(key, isPNG, res) {
    var renderer = tileRenderers[key];
    if (isPNG) {
        res.type('png');
        renderer.getPNGStream().pipe(res);
    } else {
        console.log('sending indexes', renderer.indexes.length);
        res.send(renderer.indexes);
    }
}

app.use(cors());
app.use(compression());
app.get('/tracks/:z/:x/:y.(png|txt)', function(req, res) {
    var p = req.params,
        isPNG = p[0] === 'png',
        postfix = isPNG ? 'img' : 'info',
        filename = p.z + '_' + p.x + '_' + p.y + '_' + postfix + '.' + p[0];

    //step 1: try to send already saved file
    res.sendFile(filename, {root: FILES_PREFIX}, function(err) {
        if (err) {
            var key = p.z + '_' + p.x + '_' + p.y;

            //step 2: try to send already rendered data
            if (tileRenderers[key]) {
                console.log('Found renderer');
                responseFromRenderer(key, isPNG, res);
                return;
            };

            //step 3: search stored geometry and render it
            getGeometry(Number(p.z), Number(p.x), Number(p.y)).then(function(features) {
                var tileRenderer = new TileRenderer();

                for (var f = 0; f < features.length; f++) {
                    var feature = features[f],
                        isPoly = feature.type === 3;

                    var ctx = HybridRenderer.renderRingToTile(drawContext, feature.geometry, isPoly);
                    tileRenderer.addObject(ctx, feature.tags._hybridIndex);
                }
                tileRenderer.removeNotUsed();

                tileRenderers[key] = tileRenderer;
                console.log('render done');
                responseFromRenderer(key, isPNG, res);
            }, function() {
                console.log('no file', filename);
                res.status(404).send();
            }).catch(function(err) {
                console.log(err);
            });
        }
    });
});

var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});
