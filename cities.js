// Initialize the map centered on the UK
const map = L.map('map').setView([54.5, -4], 6);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Initialize drawing controls
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Initialize drawing controls
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

// Function to get city coordinates using postcodes.io API
async function getCityCoordinates() {
    const cityPromises = ukCities.map(async city => {
        try {
            // Try to find a postcode for the city center
            const response = await fetch(`https://api.postcodes.io/postcodes?q=${encodeURIComponent(city.name)}&limit=1`);
            const data = await response.json();
            
            if (data.result && data.result.length > 0) {
                return {
                    ...city,
                    latitude: data.result[0].latitude,
                    longitude: data.result[0].longitude,
                    postcode: data.result[0].postcode
                };
            }
        } catch (error) {
            console.error(`Error fetching coordinates for ${city.name}:`, error);
        }
        return city;
    });
    
    const citiesWithCoordinates = await Promise.all(cityPromises);
    ukCities.splice(0, ukCities.length, ...citiesWithCoordinates);
}

// Function to check if a city is inside any of the drawn shapes
function isCityInShapes(city, layers) {
    for (const layer of layers) {
        if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
            const bounds = layer.getBounds();
            const cityLatLng = L.latLng(city.latitude, city.longitude);
            
            if (bounds.contains(cityLatLng)) {
                return true;
            }
        }
    }
    return false;
}

// Function to update cities list based on drawn shapes
function updateCitiesList(layers) {
    const citiesList = document.getElementById('cities-list');
    
    if (!layers || layers.length === 0) {
        citiesList.innerHTML = '';
        return;
    }
    
    // Filter cities within the shapes
    const citiesInShape = ukCities.filter(city => {
        return city.latitude && city.longitude && isCityInShapes(city, layers);
    });
    
    if (citiesInShape.length === 0) {
        citiesList.innerHTML = '<div class="no-results">No major cities found in these areas</div>';
        return;
    }
    
    // Sort cities by population
    citiesInShape.sort((a, b) => b.population - a.population);
    
    // Display cities
    citiesList.innerHTML = citiesInShape
        .map(city => `
            <div class="city-item">
                <div class="city-info">
                    <div class="city-name">${city.name}</div>
                    <div class="city-population">Population: ${city.population.toLocaleString()}</div>
                </div>
                <div class="area-code">${city.areaCode}</div>
            </div>
        `)
        .join('');
}

// Initialize city coordinates when the page loads
getCityCoordinates().catch(console.error);

// Handle drawing events
map.on(L.Draw.Event.CREATED, async function (event) {
    const layer = event.layer;
    drawnItems.addLayer(layer);
    
    // Show loading state
    const citiesList = document.getElementById('cities-list');
    citiesList.innerHTML = '<div class="loading">Finding cities...</div>';
    
    try {
        updateCitiesList(drawnItems.getLayers());
    } catch (error) {
        console.error('Error updating cities:', error);
        citiesList.innerHTML = '<div class="error">Error finding cities. Please try again.</div>';
    }
});

// Handle shape deletion
map.on(L.Draw.Event.DELETED, function (event) {
    const layers = drawnItems.getLayers();
    if (layers.length === 0) {
        document.getElementById('cities-list').innerHTML = '';
    } else {
        updateCitiesList(layers);
    }
});

// Reset button functionality
document.getElementById('reset-btn').addEventListener('click', function() {
    drawnItems.clearLayers();
    document.getElementById('cities-list').innerHTML = '';
});

// Prevent map from zooming too far out
map.setMinZoom(5);
