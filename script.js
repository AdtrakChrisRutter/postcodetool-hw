// Initialize the map centered on the UK
const map = L.map('map').setView([54.5, -4], 6);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ' OpenStreetMap contributors'
}).addTo(map);

// Initialize drawing controls
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Store current postcodes
let currentPostcodes = [];

// Initialize postcode format toggle
const formatToggle = document.getElementById('postcode-format-toggle');
let useFullPostcode = true;

formatToggle.addEventListener('change', function() {
    useFullPostcode = !this.checked;
    if (currentPostcodes.length > 0) {
        displayPostcodes(currentPostcodes);
    }
});

const drawControl = new L.Control.Draw({
    position: 'topright',
    draw: {
        polygon: {
            allowIntersection: false,
            drawError: {
                color: '#e1e100',
                timeout: 1000
            },
            shapeOptions: {
                color: '#2196F3'
            },
            showArea: true
        },
        rectangle: {
            shapeOptions: {
                color: '#2196F3'
            }
        },
        // Disable other drawing tools
        polyline: false,
        circle: false,
        circlemarker: false,
        marker: false
    },
    edit: {
        featureGroup: drawnItems,
        remove: true
    }
});
map.addControl(drawControl);

// Set UK bounds
const ukBounds = L.latLngBounds(
    [49.8, -8.6], // Southwest corner
    [60.9, 1.8]   // Northeast corner
);

// Restrict map to UK
map.setMaxBounds(ukBounds);
map.on('drag', function() {
    map.panInsideBounds(ukBounds, { animate: false });
});

// Handle drawing events
map.on(L.Draw.Event.CREATED, async function (event) {
    // Clear previous shapes
    drawnItems.clearLayers();
    
    const layer = event.layer;
    drawnItems.addLayer(layer);
    
    // Show loading state
    const postcodeList = document.getElementById('postcode-list');
    postcodeList.innerHTML = '<div class="loading">Loading postcodes...</div>';
    document.getElementById('download-btn').disabled = true;
    
    try {
        // Get the bounds of the drawn shape
        const bounds = layer.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        // Create a grid of points within the bounds
        const points = generateGridPoints(sw.lat, sw.lng, ne.lat, ne.lng);
        
        // Split points into chunks to avoid API limits
        const chunks = chunkArray(points, 100);
        let allPostcodes = new Set();
        
        for (const chunk of chunks) {
            const response = await fetch('https://api.postcodes.io/postcodes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    geolocations: chunk.map(point => ({
                        longitude: point[1],
                        latitude: point[0],
                        radius: 1000, // 1km radius
                        limit: 1
                    }))
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch postcodes');
            }

            const data = await response.json();
            data.result.forEach(result => {
                if (result.result && result.result.length > 0) {
                    allPostcodes.add(result.result[0].postcode);
                }
            });
        }

        // Update current postcodes and display them
        currentPostcodes = Array.from(allPostcodes).sort();
        displayPostcodes(currentPostcodes);
    } catch (error) {
        console.error('Error fetching postcodes:', error);
        postcodeList.innerHTML = '<div class="error">Error fetching postcodes. Please try again.</div>';
        currentPostcodes = [];
        document.getElementById('download-btn').disabled = true;
    }
});

// Helper function to generate a grid of points within bounds
function generateGridPoints(minLat, minLng, maxLat, maxLng) {
    const points = [];
    const step = 0.01; // Approximately 1km grid
    
    for (let lat = minLat; lat <= maxLat; lat += step) {
        for (let lng = minLng; lng <= maxLng; lng += step) {
            points.push([lat, lng]);
        }
    }
    
    return points;
}

// Helper function to split array into chunks
function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Function to display postcodes in the sidebar
function displayPostcodes(postcodes) {
    const postcodeList = document.getElementById('postcode-list');
    const downloadBtn = document.getElementById('download-btn');
    
    if (postcodes.length === 0) {
        postcodeList.innerHTML = '<div class="no-results">No postcodes found in this area</div>';
        downloadBtn.disabled = true;
        return;
    }
    
    // Format postcodes based on toggle state
    const formattedPostcodes = useFullPostcode 
        ? postcodes 
        : postcodes.map(postcode => postcode.split(' ')[0]);
    
    // Remove duplicates that might occur in short format
    const uniquePostcodes = [...new Set(formattedPostcodes)].sort();
    
    postcodeList.innerHTML = uniquePostcodes
        .map(postcode => `<div class="postcode-item">${postcode}</div>`)
        .join('');
        
    // Enable download button
    downloadBtn.disabled = false;
}

// Reset button functionality
document.getElementById('reset-btn').addEventListener('click', function() {
    drawnItems.clearLayers();
    document.getElementById('postcode-list').innerHTML = '';
    document.getElementById('download-btn').disabled = true;
    currentPostcodes = [];
});

// Download button functionality
document.getElementById('download-btn').addEventListener('click', function() {
    if (!currentPostcodes || !currentPostcodes.length) return;
    
    // Format postcodes based on toggle state
    const formattedPostcodes = useFullPostcode 
        ? currentPostcodes 
        : [...new Set(currentPostcodes.map(postcode => postcode.split(' ')[0]))];
    
    // Create CSV content
    const csvContent = 'Postcode\n' + formattedPostcodes.join('\n');
    
    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Set up download link
    link.href = URL.createObjectURL(blob);
    const format = useFullPostcode ? 'full' : 'short';
    link.download = `uk_postcodes_${format}_${new Date().toISOString().split('T')[0]}.csv`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Prevent map from zooming too far out
map.setMinZoom(5);

// Enable touch events for mobile devices
if (L.Browser.touch) {
    L.DomEvent.disableClickPropagation(map._container);
}
