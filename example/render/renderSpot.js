var spot5 = require('./Operative_SPOT5_MS.js'),
    TileRender = require('./TileRender.js');

var MAX_ZOOM = 6;

var processTile = function(tilePos) {
    console.log(tilePos);
    var count = tileRender.renderTile(tilePos);
    console.log('Objects in tile: ', count);

    if (count) {
        var filePrefix = './result/' + tilePos.z + '_' + tilePos.x + '_' + tilePos.y;
        tileRender.removeNotUsed();
        tileRender.saveToFiles(filePrefix);
        if (tilePos.z < MAX_ZOOM) {
            processTile({x: 2*tilePos.x,   y: 2*tilePos.y,   z: tilePos.z+1});
            processTile({x: 2*tilePos.x+1, y: 2*tilePos.y,   z: tilePos.z+1});
            processTile({x: 2*tilePos.x,   y: 2*tilePos.y+1, z: tilePos.z+1});
            processTile({x: 2*tilePos.x+1, y: 2*tilePos.y+1, z: tilePos.z+1});
        }
    };
}
var tileRender = new TileRender(spot5);
processTile({z: 0, x: 0, y: 0});

/*console.log('count:', count);
tileRender.analyze();
tileRender.removeNotUsed();
tileRender.saveToFiles('res');
tileRender.analyze();*/
