var TILES_PREFIX = 'http://localhost/maps/render_routes/';

var TypeFilterWidget = function(objectsInfo, container) {
    this._types = {};
    for (var i = 0; i < objectsInfo.length; i++) {
        var type = objectsInfo[i].route;
        if (type) {
            this._types[type] = true;
        }
    }

    var uiButtons = [];
    for (var t in this._types) {
        uiButtons.push({type: t});
    }

    container.empty().append($(this._uiTemplate({buttons: uiButtons})));

    container.find('input').button();

    this._info = objectsInfo;
}

TypeFilterWidget.prototype = {
    _uiTemplate: Handlebars.compile('{{#buttons}}' + 
        '<input type="checkbox" id="{{type}}"><label for="{{type}}">{{type}}</label>' +
    '{{/buttons}}'),
    filterObjects:  function(objects) {
    }
}

var RouteListWidget = function(objectsInfo, container, map) {
    this._objs = objectsInfo;
    this._map = map;
    this._container = container;
}

RouteListWidget.prototype = {
    _uiTemplate: Handlebars.compile(
        '{{#routes}}' +
            '<div class="route-list-item" data-id={{id}}>' +
                '<div class="route-list-title">{{ref}}, {{name}} ({{type}})</div>' +
                '<div class="route-list-item-info"></div>' +
            '</div>' +
        '{{/routes}}'
    ),
    showObjects: function(objs) {
        var container = this._container.empty(),
            _this = this;

        $(this._uiTemplate({
            routes: objs.map(function(objId) {
                var tags = _this._objs[objId];
                return {
                    name: tags.name,
                    ref: tags.ref,
                    type: tags.route, 
                    id: objId
                };
            })
        })).appendTo(container);

        container.find('.route-list-item').click(function() {
            var id = $(this).data('id'),
                objBounds = _this._objs[id].bounds;
            _this._map.fitBounds(L.GeoJSON.coordsToLatLngs(objBounds));
            $(_this).trigger('selectitem', id);
            container.find('.route-list-item-info').empty();
            var infoPlaceholder = $(this).find('.route-list-item-info');
            new RouteInfoWidget(_this._objs[id], infoPlaceholder);
        }).on('mouseover', function() {
            $(_this).trigger('highlightitem', $(this).data('id'));
        });
    }
}

var RouteInfoWidget = function(routeInfo, container) {
    routeInfo = $.extend({}, routeInfo);
    delete routeInfo.bounds;
    delete routeInfo.id;
    delete routeInfo.type;

    container.empty();
    $(this._uiTemplate({tags: routeInfo})).appendTo(container);
}

RouteInfoWidget.prototype = {
    _uiTemplate: Handlebars.compile(
        '<div>{{#each tags}}' +
            '<div>{{@key}}: {{this}}</div>' +
        '{{/each}}</div>'
    )
}

$(function() {
    var opacity = 0.4,
        opacityHash = [];

    $('#slider').slider({
        min: 0,
        max: 1,
        step: 0.02,
        value: opacity,
        change: function(e, ui) {
            opacity = ui.value;
            opacityHash = [];
            activeLayer.redrawFast();
        }
    });

    var activeObjs = {},
        activeObjsArray = [],
        selectedObj;

    /* var colorFunc = function(i){
        var g = i in activeObjs ? 255 : 0;
        return [g, 0, 255, opacity];
    };*/

    var indexFunc = function(objs) {
        var len = objs.length;
        if (!len) {
            return [0, 0, 0, 0];
        }
        var totalOpacity = opacityHash[len];
        if (!totalOpacity) {
            totalOpacity = opacityHash[len] = 1 - Math.pow(1 - opacity, len);
        }

        for (var i = 0; i < objs.length; i++) {
            var obj = objs[i];
            if (obj === selectedObj) {
                return [255, 0, 0, totalOpacity];
            } else if (obj in activeObjs) {
                return [255, 0, 255, totalOpacity];
            }
        }
        return [0, 0, 255, totalOpacity];
    }

    var map = L.map('map', {center: [-27.6, 134.824], zoom: 4, maxZoom: 17});
    L.hash(map);

    var osm = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: 'Data © <a href="http://osm.org/about/" target="_blank">OpenStreetMap</a> contributors'
    }).addTo(map);

    var trackLayer = new L.HybridLayer(TILES_PREFIX + '{z}_{x}_{y}', {
        // colorFunc: colorFunc,
        indexFunc: indexFunc,
        infoFile: 'tags.json'
    });

    var activeLayer = trackLayer;

    trackLayer.initPromise.then(function() {
        var typeFilterWidget = new TypeFilterWidget(trackLayer.objectsInfo, $('#type-filter'));
        var routeListWidget = new RouteListWidget(trackLayer.objectsInfo, $('#hover-info'), map);

        $(routeListWidget).on('highlightitem', function(e, objId) {
            activeObjsArray = [objId];
            activeObjs = {};
            activeObjs[objId] = true;

            activeLayer.redrawFast();
        }).on('selectitem', function(e, objId) {
            selectedObj = objId;
            activeLayer.redrawFast();
        });

        activeLayer.addTo(map);

        map.on('mousemove', function(e) {
            var objs = activeLayer.getObjects(e.latlng, 4);

            var changed = true;
            if (objs.length === activeObjsArray.length) {
                changed = false;
                for (var i = 0; i < objs.length; i++) {
                    if (objs[i] !== activeObjsArray[i]) {
                        changed = true;
                        break;
                    }
                }
            }

            if (!changed) {return;}

            activeObjsArray = objs;

            activeObjs = {};
            for (var i = 0; i < objs.length; i++) {
                activeObjs[objs[i]] = true;
            }

            activeLayer.redrawFast();
        });

        map.on('click', function(e) {
            var objs = activeLayer.getObjects(e.latlng, 4);

            routeListWidget.showObjects(objs);
        });
    });
})

