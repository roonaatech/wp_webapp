import React from 'react';
import { FiMapPin } from 'react-icons/fi';

const OnDutyLocationMap = ({ startLat, startLong, endLat, endLong, clientName, location }) => {
    // Debug logging
    console.log('OnDutyLocationMap props:', { startLat, startLong, endLat, endLong, clientName, location });
    
    const hasStartLocation = startLat && startLong && startLat !== '0.0' && startLong !== '0.0';
    const hasEndLocation = endLat && endLong && endLat !== '0.0' && endLong !== '0.0';

    console.log('Location check:', { hasStartLocation, hasEndLocation });

    if (!hasStartLocation && !hasEndLocation) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500">
                <FiMapPin className="inline-block w-5 h-5 mr-2" />
                No location data available (Start: {startLat}, {startLong} | End: {endLat}, {endLong})
            </div>
        );
    }

    const getGoogleMapsUrl = (lat, lng, label) => {
        return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    };

    const getDirectionsUrl = () => {
        if (hasStartLocation && hasEndLocation) {
            return `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLong}&destination=${endLat},${endLong}`;
        }
        return null;
    };

    return (
        <div className="space-y-4">
            {/* Location Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start Location */}
                {hasStartLocation && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <h4 className="font-semibold text-green-900 flex items-center">
                                    <FiMapPin className="w-4 h-4 mr-2" />
                                    Start Location
                                </h4>
                                <p className="text-sm text-green-700 mt-1">{location || clientName}</p>
                            </div>
                            <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full">Start</span>
                        </div>
                        <div className="space-y-1 text-sm text-green-800">
                            <p><strong>Latitude:</strong> {startLat}</p>
                            <p><strong>Longitude:</strong> {startLong}</p>
                        </div>
                        <a
                            href={getGoogleMapsUrl(startLat, startLong, 'Start')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-block px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                            View on Map
                        </a>
                    </div>
                )}

                {/* End Location */}
                {hasEndLocation && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <h4 className="font-semibold text-red-900 flex items-center">
                                    <FiMapPin className="w-4 h-4 mr-2" />
                                    End Location
                                </h4>
                                <p className="text-sm text-red-700 mt-1">{location || clientName}</p>
                            </div>
                            <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full">End</span>
                        </div>
                        <div className="space-y-1 text-sm text-red-800">
                            <p><strong>Latitude:</strong> {endLat}</p>
                            <p><strong>Longitude:</strong> {endLong}</p>
                        </div>
                        <a
                            href={getGoogleMapsUrl(endLat, endLong, 'End')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-block px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
                        >
                            View on Map
                        </a>
                    </div>
                )}
            </div>

            {/* Directions Link */}
            {hasStartLocation && hasEndLocation && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <a
                        href={getDirectionsUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        <FiMapPin className="w-4 h-4 mr-2" />
                        View Route on Google Maps
                    </a>
                    <p className="text-xs text-blue-700 mt-2">
                        See the route from start to end location
                    </p>
                </div>
            )}

            {/* Embedded Map */}
            {(hasStartLocation || hasEndLocation) && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <iframe
                        width="100%"
                        height="400"
                        style={{ border: 0 }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={
                            hasStartLocation && hasEndLocation
                                ? `https://www.google.com/maps/embed/v1/directions?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&origin=${startLat},${startLong}&destination=${endLat},${endLong}`
                                : `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${hasStartLocation ? startLat : endLat},${hasStartLocation ? startLong : endLong}&zoom=15`
                        }
                        title="On-Duty Location Map"
                    />
                </div>
            )}
        </div>
    );
};

export default OnDutyLocationMap;
