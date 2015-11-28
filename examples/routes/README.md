Render and viewer of OSM "route" relations.

Raw data should be downloaded from https://mapzen.com/data/metro-extracts in OSM XML format and converted into `tar.xz` format from original `bz2`.

`render/parseRoutes.js` is used to extract routes and save them as GeoJSON file.`render/renderRoutes.js` converts GeoJSON file into hybrid format.
