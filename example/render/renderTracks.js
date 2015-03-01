var TrackParserManager = require('../../../gpstracks/TrackParserManager.js'),
    HybridRenderer = require('../../src/render/HybridRenderer.js'),
    fs = require('fs'),
    glob = require('glob');

var gpxFolder = './data/trackable/';

var files = glob.sync(gpxFolder + '**/*.gpx').slice(0, 10);

var trackParserManager = new TrackParserManager();

files.forEach(function(fileName) {
    var data = fs.readFileSync(fileName);
    trackParserManager.addTrack(fileName, data);
});

trackParserManager.process().done(function(tracks) {
    var hybridRenderer = new HybridRenderer();
    var geoJSON = {
        type: 'FeatureCollection', 
        features: tracks.map(function(track){return track.geoJSON;})
    };
    hybridRenderer.render(geoJSON, {maxZoom: 10});
});
