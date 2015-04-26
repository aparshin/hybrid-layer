var TileRenderer = require('../../src/render/TileRenderer.js'),
    Canvas = require('canvas'),
    Handlebars = require('handlebars'),
    glob = require('glob');

var years = ['2006', '2007', '2008', '2009', '2010', '2011', '2012', '2014', '2015'],
    alphaLevels = 4,
    alphaStep = 256/alphaLevels;

var renderTile = function(x, y, z) {
    var imgTemplate = Handlebars.compile('history_img/{{year}}_{{z}}_{{y}}_{{x}}.png'),
        resTemplate = Handlebars.compile('./result/{{z}}_{{x}}_{{y}}'),
        params = {x: x, y: y, z: z};

    var tileRender = new TileRenderer();

    years.forEach(function(year, index) {
        var canvas = new Canvas(256, 256),
            ctx = canvas.getContext('2d');
        params.year = year;
        var img = new Canvas.Image;
        img.src = imgTemplate(params);
        try {
            ctx.drawImage(img, 0, 0, 256, 256);
        } catch (e) {
            return;
        }

        for (var a = 0; a < alphaLevels; a++) {
            tileRender.addObject(ctx, alphaLevels * index + a, {
                minAlpha: Math.floor(a * alphaStep) + 1,
                maxAlpha: Math.floor((a + 1) * alphaStep)
            });
        }
    })

    tileRender.saveToFiles(resTemplate(params));
}

glob.sync('history_img/2006_*.png').forEach(function(filename) {
    var m = filename.match(/(\d+)_(\d+)_(\d+).png/);
    console.log(m[1], m[2], m[3]);
    renderTile(m[3], m[2], m[1]);
})
