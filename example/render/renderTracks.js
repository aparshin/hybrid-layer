var TrackParserManager = require('../../../gpstracks/TrackParserManager.js'),
    HybridRenderer = require('../../src/render/HybridRenderer.js'),
    fs = require('fs'),
    xz = require('xz'),
    tar = require('tar'),
    Q = require('q'),
    path = require('path');

var gpxFile = './data/australia-oceania.tar.xz',
// var gpxFile = './data/central-america.tar.xz',
// var gpxFile = './data/test.tar.xz',
    CHUNK_SIZE = 200,
    MAX_TRACKS = 0,
    MAX_ZOOM = 10;

var geomsCount = 0,
    filenames = [],
    doneAll = new Q.defer(); 

var trackParserManager = new TrackParserManager();

var fd = fs.openSync(gpxFile, 'r');
var inFile = fs.createReadStream(null, {fd: fd});
var decompressor = new xz.Decompressor();

var tarParser = new tar.Parse();
var rawStream = inFile.pipe(decompressor).pipe(tarParser);

var parseAndRenderTracks = function() {
    var def = new Q.defer();

    trackParserManager.process().done(function(tracks) {
        var geoJSON = {
            type: 'FeatureCollection', 
            features: tracks.map(function(track){
                track.geoJSON.properties = {filename: track.filename};
                return track.geoJSON;
            })
        };
        var hybridRenderer = new HybridRenderer(geoJSON);
        hybridRenderer.render({
            maxZoom: MAX_ZOOM,
            loadFromFiles: true,
            indexShift: geomsCount
        }).done(function() {
            geomsCount += hybridRenderer.geoms.length;
            filenames = filenames.concat(hybridRenderer.geoms.map(function(geom) {
                return geom.filename;
            }))
            def.resolve();
        })
    });
    return def.promise;
}

var count = 0,
    chunkCount = 0;
rawStream.on('entry', function(e) {
    if (path.extname(e.path) !== '.gpx') {
        return;
    }

    console.log('Decompressing ', e.path, e.size);
    var buf = new Buffer(e.size),
        pos = 0;
    e.on('data', function(data) {
        data.copy(buf, pos);
        pos += data.length;
    }).on('end', function() {
        console.log('Parsing ', e.path);
        trackParserManager.addTrack(e.path, buf);
        count++;
        chunkCount++;
        if (chunkCount === CHUNK_SIZE) {
            tarParser.pause();
            parseAndRenderTracks().done(function() {
                console.log('resume', count, MAX_TRACKS);
                chunkCount = 0;
                if (MAX_TRACKS && count >= MAX_TRACKS) {
                    console.log('destroy', count);
                    rawStream.removeAllListeners('entry');
                    inFile.destroy();
                    fs.writeFileSync('./result/filenames.js', JSON.stringify(filenames));
                }
                tarParser.resume();
            });
        }
    })
}).on('end', function() {
    parseAndRenderTracks().done(function() {
        fs.writeFileSync('./result/filenames.js', JSON.stringify(filenames));
    });
})
