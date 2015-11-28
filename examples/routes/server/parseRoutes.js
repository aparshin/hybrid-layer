var fs = require('fs'),
    xz = require('xz'),
    tar = require('tar'),
    Q = require('q'),
    path = require('path'),
    sax = require('sax');

// var osmFile = './data/asti_italy.osm.tar.xz',
var osmFile = './data/moscow_russia.osm.tar.xz',
    CHUNK_SIZE = 200,
    MAX_TRACKS = 0,
    MAX_ZOOM = 10;

var runSAXParser = function(filename, SAXParser) {

    var fd = fs.openSync(filename, 'r');
    var inFile = fs.createReadStream(null, {fd: fd});
    var decompressor = new xz.Decompressor();

    var tarParser = new tar.Parse();
    var rawStream = inFile.pipe(decompressor).pipe(tarParser);

    var def = Q.defer();

    rawStream.on('entry', function(e) {
        console.log('Decompressing ', e.path, e.size);
        e.on('data', function(data) {
             SAXParser.write(data);
        })
    }).on('end', function() {
        SAXParser.end();
        def.resolve();
    })

    return def.promise;
}

var mixinCountLogger = function(parser) {

    var tagCount = 0;

    parser.on('opentag', function(node) {
        tagCount++;
        if (tagCount % 1000 === 0) {
            console.log('tags', tagCount);
        }
    });
}

var relationParser = sax.createStream(true);
mixinCountLogger(relationParser);

var isInsideRelation = false,
    currentRelation,
    relations = [],
    isRoute = false;

var routeMemberRoles = {'': true, 'route': true, 'forward': true, 'backward': true};

var ways = {};

relationParser.on('opentag', function(node) {
    var name = node.name,
        attrs = node.attributes;


    if (isInsideRelation) {
        if (name === 'member' && attrs.type === 'way' && attrs.role in routeMemberRoles) {
            currentRelation.members.push(attrs.ref);
        }
        if (name === 'tag') {
            if (attrs.k === 'type' && attrs.v === 'route') {
                isRoute = true;
            }

            currentRelation.tags[attrs.k] = attrs.v;
        }
    } else if (name === 'relation') {
        isInsideRelation = true;
        currentRelation = {
            id: attrs.id,
            members: [],
            tags: {}
        }
        return;
    }
}).on('closetag', function(name) {
    var name = name.toLowerCase();
    if (name === 'relation') {
        if (isRoute) {
            relations.push(currentRelation);

            for (var m = 0; m < currentRelation.members.length; m++) {
                var id = currentRelation.members[m];
                ways[id] = ways[id] || {nodes: [], relations: []};
                ways[id].relations.push(currentRelation.id);
            }
        }
        isInsideRelation = false;
        isRoute = false;
    }
}).on('end', function() {

})

var wayParser = sax.createStream(true);
mixinCountLogger(wayParser);

var isInWay = false,
    currentWayID;

var nodes = {};
wayParser.on('opentag', function(node) {
    var name = node.name,
        attrs = node.attributes;

    if (isInWay) {
        if (name === 'nd') {
            ways[currentWayID].nodes.push(attrs.ref);
            nodes[attrs.ref] = true;
        }
    } else if (name === 'way' && attrs.id in ways) {
        isInWay = true;
        currentWayID = attrs.id;
    }

}).on('closetag', function(name) {
    if (name === 'way') {
        isInWay = false;
    }
}).on('end', function() {

})

var nodeParser = sax.createStream(true);
mixinCountLogger(nodeParser);

nodeParser.on('opentag', function(node) {
    var name = node.name,
        attrs = node.attributes;

    if (name === 'node' && attrs.id in nodes) {
        nodes[attrs.id] = [attrs.lon, attrs.lat];
    }

});

runSAXParser(osmFile, relationParser).done(function() {
    runSAXParser(osmFile, wayParser).done(function() {
        runSAXParser(osmFile, nodeParser).done(function() {
            var res = [];
            relations.forEach(function(relation) {
                var coords = [];
                for (var m = 0; m < relation.members.length; m++) {
                    var wayCoords = [],
                        wayID = relation.members[m];

                    for (var p = 0; p < ways[wayID].nodes.length; p++) {
                        wayCoords.push(nodes[ways[wayID].nodes[p]]);
                    }

                    coords.push(wayCoords);
                }

                relation.geoJSON = {
                    type: 'MultiLineString',
                    coordinates: coords
                }

                delete relation.members;
            })
            
            fs.writeFileSync('./res.txt', JSON.stringify(relations));
        })
    })
});
