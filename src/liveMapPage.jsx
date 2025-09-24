import React from 'react';
import LiveMap from './liveMap.jsx';
import Navbar from './components/navbar/navbar.jsx';

const LiveMapPage = () => {
return (
    <div style={{ width: '100vw', height: '100%', position: 'fixed', top: 0, left: 0, zIndex: 9999, background: '#053943' }}>
        <Navbar title="Aether" />
        <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <LiveMap />
        </div>
    </div>
);
};

export default LiveMapPage;
