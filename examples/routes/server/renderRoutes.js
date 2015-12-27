var HybridRenderer = require('../../../src/render/HybridRenderer.js'),
    fs = require('fs'),
    Q = require('q'),
    path = require('path'),
    _ = require('underscore');


var MAX_ZOOM = 17,
    CHUNK_SIZE = 1000;

var parsedRoutes = JSON.parse(fs.readFileSync('relations.json'));/*.slice(0, 30);*/

var count = 0,
    properties = [];

var renderChunk = function() {
    console.log(parsedRoutes.length);
    var chunk = parsedRoutes.splice(0, CHUNK_SIZE);
    var geoJSON = {
        type: 'FeatureCollection',
        features: chunk
            .filter(function(route) {
                return route.geoJSON.coordinates.length;
            })
            .map(function(route) {
                return {
                    type: 'Feature',
                    geometry: route.geoJSON,
                    properties: _.extend({}, route.tags, {id: route.id})
                }
            })
    }

    var hybridRenderer = new HybridRenderer(geoJSON, {
        drawOptions: {
            lineWidth: 2
        }
    });
    /*var properties = hybridRenderer.features.map(function(feature) {
        feature.properties.bounds = feature.bounds;
        return feature.properties;
    });
    fs.writeFileSync('info.txt', JSON.stringify(properties));
    return;*/

    hybridRenderer.render({
        maxZoom: MAX_ZOOM,
        loadFromFiles: true,
        indexShift: count
    }).done(function() {
        count += hybridRenderer.features.length;

        properties = properties.concat(hybridRenderer.features.map(function(feature) {
            feature.tags.bounds = {
                min: feature.min,
                max: feature.max
            };

            return feature.tags;
            // feature.properties.bounds = feature.bounds;
            // return feature.properties;
        }));

        if (parsedRoutes.length === 0) {
            fs.writeFileSync('tags.json', JSON.stringify(properties));
        } else {
            renderChunk();
        }
    })
}

renderChunk();
