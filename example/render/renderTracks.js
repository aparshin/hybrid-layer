var TrackParserManager = require('../../../gpstracks/TrackParserManager.js'),
    HybridRenderer = require('../../src/render/HybridRenderer.js'),
    fs = require('fs'),
    glob = require('glob');

var gpxFolder = './data/public/',
    chunkSize = 250;

var files = glob.sync(gpxFolder + '**/*.gpx');//.slice(0, 100);
var curIndex = 0;

var processNexChunk = function() {
    if (curIndex >= files.length) {
        return;
    }

    var curFiles = files.slice(curIndex, curIndex + chunkSize);
    console.log('process chunk: ', curIndex, curFiles.length);

    var trackParserManager = new TrackParserManager();

    curFiles.forEach(function(fileName) {
        var data = fs.readFileSync(fileName);
        trackParserManager.addTrack(fileName, data);
    });

    trackParserManager.process().done(function(tracks) {
        var geoJSON = {
            type: 'FeatureCollection', 
            features: tracks.map(function(track){return track.geoJSON;})
        };
        var hybridRenderer = new HybridRenderer(geoJSON);
        hybridRenderer.render({maxZoom: 10, loadFromFiles: true, indexShift: curIndex}).then(function() {
            curIndex += chunkSize;
            processNexChunk();
       })
    });
}

processNexChunk();
