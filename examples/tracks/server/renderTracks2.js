var TrackParserManager = require('gpstracks/TrackParserManager.js'),
    HybridRenderer = require('../../../src/render/HybridRenderer.js'),
    fs = require('fs'),
    xz = require('xz'),
    tar = require('tar'),
    Q = require('q'),
    path = require('path'),
    xmlParser = require('xml2js'),
    _ = require('underscore');

var heapdump = require('heapdump'),
    memwatch = require('memwatch-next'),
    process  = require('process');

/*memwatch.on('stats', function(stats) {
    fs.appendFileSync('memory.txt', JSON.stringify(stats) + '\n');
})*/

var gpxFile = './data/australia-oceania.tar.xz',
// var gpxFile = './data/central-america.tar.xz',
// var gpxFile = './data/test.tar.xz',
    metadataFile = './data/metadata.xml',
    META_FILENAME_PREFIX = 'gpx-planet-2013-04-09/',
    MAX_POINTS = 500000,
    MAX_TRACKS = 0,
    MAX_ZOOM = 17,
    MAX_DISTANCE = 1/500, //about 800 Mercator kilometers
    MIN_POINTS = 10;


var geomsCount = 0,
    filenames = [],
    gpxProperties = {},
    doneAll = new Q.defer(); 

var trackParserManager = new TrackParserManager();

var fd = fs.openSync(gpxFile, 'r');
var inFile = fs.createReadStream(null, {fd: fd});
var decompressor = new xz.Decompressor();

var tarParser = new tar.Parse();
var rawStream = inFile.pipe(decompressor).pipe(tarParser);

var parseMetadata = function(result) {
    result.gpxFiles.gpxFile.forEach(function(gpxFile) {
        var props = _.clone(gpxFile.$);
        
        if (gpxFile.description) {
            props.description = gpxFile.description[0];
        };

        if (gpxFile.tags) {
            props.tags = gpxFile.tags[0].tag;
        }

        gpxProperties[META_FILENAME_PREFIX + props.filename] = props;
    })
};

var fewPointsFilter = function(feature) {
    var isNormal = feature.geometry[0].length >= MIN_POINTS;

    isNormal || console.log('Filter: few points');

    return isNormal;
}

var longTrackFilter = function(feature) {
    var gmerc = feature.geometry[0];
    for (var p = 1; p < gmerc.length; p++) {
        if (Math.abs(gmerc[p-1][0] - gmerc[p][0]) > MAX_DISTANCE ||
            Math.abs(gmerc[p-1][1] - gmerc[p][1]) > MAX_DISTANCE)
        {
            console.log('Filter: too long');
            return false;
        }
    }
    return true;
}

var trackChunk = [],
    trackChunkPoints = 0;

var parseTracks = function() {
    return trackParserManager.process().then(tracks => {
        var points = 0;
        var features = _.flatten(tracks.map(track => {
            var geoJSON = track.geoJSON;
            geoJSON.properties = {filename: track.filename};
            if (geoJSON.geometry.type === 'LineString') {
                points += geoJSON.geometry.coordinates.length;
                return geoJSON;
            } else { //MultiLineString
                //handle track parts as separate objects
                return geoJSON.geometry.coordinates.map(coords => {
                    points += coords.length;
                    return {
                        type: 'Feature',
                        properties: _.clone(geoJSON.properties),
                        geometry: {
                            type: 'LineString',
                            coordinates: coords
                        }
                    }
                })
            }
        }))
        trackChunk = trackChunk.concat(features);
        trackChunkPoints += points;
    })
}
var renderTracks = function() {
    var def = new Q.defer();

    var geoJSON = {
        type: 'FeatureCollection',
        features: trackChunk
    }

    var hybridRenderer = new HybridRenderer(geoJSON, {
        filters: [fewPointsFilter, longTrackFilter]
    });

    hybridRenderer.render({
        maxZoom: MAX_ZOOM,
        loadFromFiles: true,
        indexShift: geomsCount
    }).done(function() {
        geomsCount += hybridRenderer.features.length;
        filenames = filenames.concat(hybridRenderer.features.map(function(feature) {
            return gpxProperties[feature.tags.filename];
        }))
        hybridRenderer = null;
        gc();
        fs.appendFileSync('memoryusage.txt', JSON.stringify(process.memoryUsage()));
        // heapdump.writeSnapshot();
        def.resolve();
    })

    return def.promise;
}

var count = 0,
    chunkCount = 0;

xmlParser.parseString(fs.readFileSync(metadataFile), function(err, result) {
    parseMetadata(result);
    rawStream.on('entry', function(e) {
        if (path.extname(e.path) !== '.gpx') {
            return;
        }

        console.log(`Decompressing ${e.path} (${e.size >> 10} Kb)`);
        var buf = new Buffer(e.size),
            pos = 0;
        e.on('data', function(data) {
            data.copy(buf, pos);
            pos += data.length;
        }).on('end', function() {
            // console.log('Parsing ', e.path);
            trackParserManager.addTrack(e.path, buf);
            tarParser.pause();
            count++;
            parseTracks().done(() => {
                console.log(`Tracks: ${count}, points: ${trackChunkPoints}`); 
                if (MAX_TRACKS && count >= MAX_TRACKS) {
                    console.log('destroy', count);
                    rawStream.removeAllListeners('entry');
                    inFile.destroy();
                    fs.writeFileSync('./result/filenames.js', JSON.stringify(filenames));
                    //heapdump.writeSnapshot();
                }
                if (trackChunkPoints >= MAX_POINTS) {
                    renderTracks().done(() => {
                        trackChunkPoints = 0;
                        trackChunk = [];
                        tarParser.resume();
                    })
                } else {
                    tarParser.resume();
                }
            })
        })
    }).on('end', function() {
        renderTracks().done(function() {
            fs.writeFileSync('./result/filenames.js', JSON.stringify(filenames));
        });
    })

});
