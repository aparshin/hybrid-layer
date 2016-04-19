var TileRenderer = require('../../../src/render/TileRenderer.js'),
    glob = require('glob'),
    fs = require('fs');

glob.sync('result_200/*_info.txt').forEach(file => {
    var targetFile = file.replace('_info.txt', '_binfo');
    console.log(file);

    var index = JSON.parse(fs.readFileSync(file));
    
    var buffer = new Buffer(TileRenderer.indexesToArray(index).buffer);

    fs.writeFileSync(targetFile, buffer);
});
