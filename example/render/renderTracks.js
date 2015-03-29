var TrackParserManager = require('../../../gpstracks/TrackParserManager.js'),
    HybridRenderer = require('../../src/render/HybridRenderer.js'),
    fs = require('fs'),
    glob = require('glob'),
    Q = require('q');

var gpxFolder = './data/public/',
    CHUNK_SIZE = 200,
    MAX_ZOOM = 10;

var files = glob.sync(gpxFolder + '**/*.gpx'); //.slice(0, 100),
    curIndex = 0,
    geomsCount = 0,
    filenames = [],
    doneAll = new Q.defer(); 

var processNexChunk = function() {
    if (curIndex >= files.length) {
        doneAll.resolve();
        return;
    }

    var curFiles = files.slice(curIndex, curIndex + CHUNK_SIZE);
    console.log('process chunk: ', curIndex, curFiles.length);

    var trackParserManager = new TrackParserManager();

    curFiles.forEach(function(fileName) {
        var data = fs.readFileSync(fileName);
        trackParserManager.addTrack(fileName, data);
    });

    trackParserManager.process().done(function(tracks) {
        var geoJSON = {
            type: 'FeatureCollection', 
            features: tracks.map(function(track){
                track.geoJSON.properties = {filename: track.filename};
                return track.geoJSON;
            })
        };
        var hybridRenderer = new HybridRenderer(geoJSON);
        hybridRenderer.render({maxZoom: MAX_ZOOM, loadFromFiles: true, indexShift: geomsCount}).then(function() {
            curIndex += CHUNK_SIZE;
            geomsCount += hybridRenderer.geoms.length;
            filenames = filenames.concat(hybridRenderer.geoms.map(function(geom) {
                return geom.filename;
            }))
            processNexChunk();
        })
    });
}

processNexChunk();
doneAll.promise.done(function() {
    fs.writeFileSync('./result/filenames.js', JSON.stringify(filenames));
})
