Hybrid layer is intended to render massive vector geodata in browser without sending full geometry, but allowing some types of user interaction.

More concretely, it consists of a pre-rendered in pseudo-colors geometry (PNG image) and a correspondence between that pseudo-colors and original objects (text file). It is an intermediate format between fully server-side rendered images and original vector data.

Hybrid layers allow the following manipulations on the client side:
  * to change colors of separate objects
  * to change transparency of objects
  * to reorder objects
  * to get information about objects in any point without sending request to the server

This repository contains an implementation of server renderer and client-side viewer.

## Examples
  * [Australia and Oceania OSM GPS Tracks](https://aparshin.github.io/hybrid-layer/example)
  * [10 years of OSM edits](https://aparshin.github.io/hybrid-layer/example/osm_history) (idea and data from the [Mapbox example](https://www.mapbox.com/ten-years-openstreetmap))

## Format

All the data is splitted into classical "Google tiles". Each tile is described by two files:
  * PNG image 256x256. Each pixel stores an index in RGB channels (`index = R << 16 + G << 8 + B`), A channel is always 255. There should be no gaps in the indexes - if there is a pixel with index N, then it should be at least one pixel for each index less than N.
  * JSON file with index descriptions. It is an array of arrays. External array corresponds to indexes in a PNG file. Each index is described by an array of objects' IDs for that index.

The way of how objects' attributes or colors are transferred to a client is not defined.

## API

The main class `L.HybridLayer` extends `L.TileLayer.Canvas`. Constructor receives `URLTemplate` as the first argument:

```javascript
    var hybridLayer = new L.HybridLayer('http://localhost/tiles/{z}/{x}/{y}');
```

PNG tiles should have postfix `_img.png`, JSON tiles - `_info.txt`.

`L.HybridLayer` has the following additional options:

|Option|Type|Description|
|------|----|-----------|
|`colorFunc`|`function(objID)->array[4]`|Function, that returns color by object ID|
|`indexFunc`|`function(index)->array[4]`|Function, that returns color by index in tile|
|`sortFunc`|`function(a, b)->Number`|Function to sort an array of object IDs (as in JS `Array.sort`)|
