var TrackParserManager = require('gpstracks/TrackParserManager.js'),
    HybridRenderer = require('../../../src/render/HybridRenderer.js'),
    fs = require('fs'),
    xz = require('xz'),
    tar = require('tar'),
    Q = require('q'),
    path = require('path'),
    xmlParser = require('xml2js'),
    _ = require('underscore');


var gpxFile = './data/australia-oceania.tar.xz',
// var gpxFile = './data/central-america.tar.xz',
// var gpxFile = './data/test.tar.xz',
    metadataFile = './data/metadata.xml',
    META_FILENAME_PREFIX = 'gpx-planet-2013-04-09/',
    CHUNK_SIZE = 200,
    MAX_TRACKS = 0,
    MAX_ZOOM = 10,
    MAX_DISTANCE = 100000,
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

var fewPointsFilter = function(gmerc) {
    var isNormal = gmerc.length >= MIN_POINTS;

    isNormal || console.log('Filter: few points');

    return isNormal;
}

var longTrackFilter = function(gmerc) {
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
                return gpxProperties[feature.properties.filename];
            }))
            def.resolve();
        })
    });
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

});
