var Bounds = function(points) {
    this.min = [ Number.MAX_VALUE,  Number.MAX_VALUE];
    this.max = [-Number.MAX_VALUE, -Number.MAX_VALUE];
    points && this.extendFromArray(points);
}

Bounds.prototype.extend = function(p) {
    this.min[0] = Math.min(this.min[0], p[0]);
    this.min[1] = Math.min(this.min[1], p[1]);
    this.max[0] = Math.max(this.max[0], p[0]);
    this.max[1] = Math.max(this.max[1], p[1]);
    return this;
}

Bounds.prototype.extendFromBounds = function(bounds) {
    return this.extendFromArray([bounds.min, bounds.max]);
}

Bounds.prototype.extendFromArray = function(points) {
    for (var p = 0; p < points.length; p++) {
        this.extend(points[p]);
    }
    return this;
}

Bounds.prototype.isInside = function(point) {
    return this.min[0] <= point[0] && this.min[1] <= point[1] && 
           this.max[0] >= point[0] && this.max[1] >= point[1];
}

Bounds.prototype.intersects = function(bounds) {
    return this.max[0] >= bounds.min[0] && bounds.max[0] >= this.min[0] &&
           this.max[1] >= bounds.min[1] && bounds.max[1] >= this.min[1];
}

module.exports = Bounds;
