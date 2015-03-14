$(function() {
    var yearIndex = 9,
        playMode = false;

    var layers = [
        {fill: [0x00/256, 0x00/256, 0xff/256, 1]},
        {fill: [0x44/256, 0x00/256, 0xCC/256, 1]},
        {fill: [0x88/256, 0x00/256, 0x88/256, 1]},
        {fill: [0xCC/256, 0x00/256, 0x44/256, 1]},
        {fill: [0xff/256, 0x00/256, 0x00/256, 1]},
        {fill: [0xff/256, 0x44/256, 0x00/256, 1]},
        {fill: [0xff/256, 0x88/256, 0x00/256, 1]},
        {fill: [0xff/256, 0xCC/256, 0x00/256, 1]},
        {fill: [0xff/256, 0xff/256, 0x00/256, 1]},
        {fill: [0xff/256, 0xff/256, 0x00/256, 1]}
    ];
    
    $('#playButton').click(function() {
        playMode = !playMode;
        $(this).text(playMode ? 'Stop' : 'Play');
        playMode && $('#slider').slider('value', yearIndex);
    })

    $('#slider').slider({
        min: 0,
        max: 9,
        step: 0.1,
        value: yearIndex,
        change: function(e, ui) {
            yearIndex = ui.value;
            historyLayer.redrawFast();
            if (playMode) {
                setTimeout(function() {
                    $('#slider').slider('value', (yearIndex + 0.1) % 9);
                }, 0);
            }
        }
    });

    var ALPHA_LEVELS = 4;
    var colorFunc = function(i){
        var objYear = Math.floor(i/ALPHA_LEVELS),
            objAlpha = (i % ALPHA_LEVELS + 1)/ALPHA_LEVELS,
            res;

        if (yearIndex < objYear) {
            res = [0, 0, 0, 0];
        } else if (yearIndex >= objYear + 1) {
            res = layers[objYear].fill.slice(0); 
            res[3] *= objAlpha;
        } else {
            var opacity = (yearIndex - Math.floor(yearIndex)) * objAlpha,
                c = layers[objYear].fill;

            res = [c[0], c[1], c[2], opacity];
        }
        return res;
    };

    var map = L.map('map', {center: [55.3, 37.7], zoom: 9});
    var historyLayer = new L.HybridLayer('http://aparshin.ru/maps/renderh4/{z}_{y}_{x}', {
        colorFunc: colorFunc,
        sortFunc: function(a, b) {
            return b - a;
        }
    });
    historyLayer.addTo(map);
})
