import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { defaults as defaultInteractions, MouseWheelZoom } from 'ol/interaction.js';

const LiveMap = () => {
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) {
      const map = new Map({
        target: mapRef.current,
        layers: [
          new TileLayer({
            source: new OSM(),
          }),
        ],
        view: new View({
          center: [0, 0],
          zoom: 1,
        }),
        interactions: defaultInteractions().extend([
          new MouseWheelZoom({
            delta: 7,
            duration: 250,
            constrainResolution: true,
          }),
        ]),
      });

      window.map = map;
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100vh',overflow: 'hidden' }}>
      <div id="map" ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default LiveMap;
