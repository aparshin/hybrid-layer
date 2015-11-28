var fs = require('fs'),
    request = require('request'),
    Q = require('q'),
    Handlebars = require('handlebars');

var layers = [
    {title: "2006", fill: "#0000ff", layer: "enf.54a636f6"},
    {title: "2007", fill: "#4400CC", layer: "enf.5d7acc8f"},
    {title: "2008", fill: "#880088", layer: "enf.2bf64eff"},
    {title: "2009", fill: "#CC0044", layer: "enf.2420e529"},
    {title: "2010", fill: "#ff0000", layer: "enf.4d565f14"},
    {title: "2011", fill: "#ff4400", layer: "enf.d99207ef"},
    {title: "2012", fill: "#ff8800", layer: "enf.4c528ba7"},
    {title: "2013", fill: "#ffCC00", layer: "enf.0fb6824e"},
    {title: "2014", fill: "#ffff00", layer: "enf.f188e436"},
    {title: "2015", fill: "#ffff00", layer: "enf.0576ad9c"}
];

var token = 'pk.eyJ1IjoidHJpc3RlbiIsImEiOiJiUzBYOEJzIn0.VyXs9qNWgTfABLzSI3YcrQ',
    urlTemplate = Handlebars.compile(
        'https://b.tiles.mapbox.com/v4/{{layer}}/{{z}}/{{y}}/{{x}}.png?access_token={{token}}'
    ),
    filenameTemplate = Handlebars.compile('history_img/{{title}}_{{z}}_{{y}}_{{x}}.png');

var download = function(uri, filename){
    console.log('download ', uri);
    var def = Q.defer();
    request(uri).pipe(fs.createWriteStream(filename)).on('close', function() {
        def.resolve();
    });

    return def.promise;
};

var downloadTile = function(x, y, z) {
    var promise = Q();
    return layers.reduce(function(promise, layer) {
        var url = urlTemplate({x: x, y: y, z: z, layer: layer.layer, token: token}),
            filename = filenameTemplate({x: x, y: y, z: z, title: layer.title});
        return promise.then(download.bind(null, url, filename));
    }, Q());
}

var downloadTileSubtree = function(x, y, z, maxZ) {
    return downloadTile(x, y, z).then(function() {
        if (z < maxZ) {
            console.log(z, maxZ)
            return Q()
                .then(downloadTileSubtree.bind(null, 2*x,   2*y,   z+1, maxZ))
                .then(downloadTileSubtree.bind(null, 2*x+1, 2*y,   z+1, maxZ))
                .then(downloadTileSubtree.bind(null, 2*x,   2*y+1, z+1, maxZ))
                .then(downloadTileSubtree.bind(null, 2*x+1, 2*y+1, z+1, maxZ));
        }
    });
}

downloadTileSubtree(0, 0, 0, 4).then(function() {
    console.log('done');
})
