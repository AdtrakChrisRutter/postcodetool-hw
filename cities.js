// Initialize the map centered on Nottingham
const map = L.map('map').setView([52.9548, -1.1581], 3);

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ' OpenStreetMap contributors'
}).addTo(map);

// Initialize drawing controls
const drawnItems = new L.FeatureGroup();
const cityMarkers = new L.FeatureGroup();
map.addLayer(drawnItems);
map.addLayer(cityMarkers);

// Override Leaflet.Draw strings to remove tooltips
L.drawLocal.draw.handlers.polygon.tooltip = {
    start: '',
    cont: '',
    end: ''
};
L.drawLocal.draw.handlers.rectangle.tooltip = {
    start: ''
};
L.drawLocal.edit.handlers.edit.tooltip = {
    text: '',
    subtext: ''
};
L.drawLocal.edit.handlers.remove.tooltip = {
    text: ''
};

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
            showArea: true,
            guideLayers: [],
            tooltips: {
                start: '',
                cont: '',
                end: ''
            }
        },
        rectangle: {
            shapeOptions: {
                color: '#2196F3'
            },
            tooltips: {
                start: ''
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
        remove: true,
        edit: {
            selectedPathOptions: {
                maintainColor: true,
                opacity: 0.3
            }
        }
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

// Store current cities and excluded cities
let currentCities = [];
let excludedCities = new Set();

// Function to create a city marker
function createCityMarker(city) {
    const marker = L.marker([city.latitude, city.longitude], {
        title: city.name
    });

    marker.bindPopup(`
        <div style="text-align: center;">
            <h3 style="margin: 0 0 5px 0;">${city.name}</h3>
            <div style="color: #666;">Population: ${city.population.toLocaleString()}</div>
            <div style="color: #FF4438; font-weight: bold; margin-top: 5px;">${city.areaCode}</div>
        </div>
    `);

    return marker;
}

// Function to check if a city is inside any of the drawn shapes
function isCityInShapes(city, layers) {
    if (!city.latitude || !city.longitude) {
        console.log('City has no coordinates:', city.name);
        return false;
    }
    
    const cityLatLng = L.latLng(city.latitude, city.longitude);
    
    for (const layer of layers) {
        // For rectangles, use bounds check
        if (layer instanceof L.Rectangle) {
            if (layer.getBounds().contains(cityLatLng)) {
                console.log('City is inside rectangle:', city.name);
                return true;
            }
        }
        // For polygons, use proper point-in-polygon check
        else if (layer instanceof L.Polygon && !(layer instanceof L.Circle)) {
            const latLngs = layer.getLatLngs()[0];
            if (isPointInPolygon(cityLatLng, latLngs)) {
                console.log('City is inside polygon:', city.name);
                return true;
            }
        }
        // For circles, check if point is within radius
        else if (layer instanceof L.Circle) {
            const distance = layer.getLatLng().distanceTo(cityLatLng);
            if (distance <= layer.getRadius()) {
                console.log('City is inside circle:', city.name);
                return true;
            }
        }
    }
    return false;
}

// Helper function to check if a point is inside a polygon
function isPointInPolygon(point, polygon) {
    // Ray casting algorithm
    let inside = false;
    let j = polygon.length - 1;

    for (let i = 0; i < polygon.length; i++) {
        const xi = polygon[i].lng;
        const yi = polygon[i].lat;
        const xj = polygon[j].lng;
        const yj = polygon[j].lat;

        const intersect = ((yi > point.lat) !== (yj > point.lat))
            && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);

        if (intersect) inside = !inside;
        j = i;
    }

    return inside;
}

// Function to update cities list based on drawn shapes and population filter
function updateCitiesList(layers) {
    const citiesList = document.getElementById('cities-list');
    citiesList.innerHTML = '';
    cityMarkers.clearLayers();
    currentCities = [];

    // Get population filter values
    const populationFilter = parseInt(document.getElementById('population-filter').value);
    
    console.log('Updating cities list with filter:', populationFilter);
    console.log('Number of shapes:', layers.length);
    
    if (!layers || layers.length === 0) {
        citiesList.innerHTML = '';
        document.querySelector('.cities-count').textContent = 'Draw a shape to find towns & cities';
        document.getElementById('download-btn').disabled = true;
        currentCities = [];
        return;
    }
    
    // Filter cities within the shapes and by population
    for (const city of ukTownsAndCities) {
        if (isCityInShapes(city, layers)) {
            // Check population filter
            if (populationFilter === '' || city.population >= populationFilter) {
                
                // Skip excluded cities
                if (excludedCities.has(city.name)) continue;

                currentCities.push(city);
                
                // Create city marker
                const marker = createCityMarker(city);
                cityMarkers.addLayer(marker);

                // Create city list item
                const cityItem = document.createElement('div');
                cityItem.className = 'city-item';
                cityItem.innerHTML = `
                    <div class="city-info">
                        <span class="city-name">${city.name}</span>
                        <span class="city-population">Pop: ${city.population.toLocaleString()}</span>
                        <span class="city-area-code">${city.areaCode}</span>
                    </div>
                    <button class="exclude-city" title="Exclude city" data-city="${city.name}">×</button>
                `;
                citiesList.appendChild(cityItem);
            }
        }
    }

    // Enable/disable download buttons
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.disabled = currentCities.length === 0;

    // Update counters
    updateCityCounters();
}

// Function to update city counters
function updateCityCounters() {
    const totalCities = currentCities.length;
    const excludedCount = excludedCities.size;
    
    const counterDiv = document.createElement('div');
    counterDiv.className = 'city-counters';
    counterDiv.innerHTML = `
        <div>Cities shown: ${totalCities}</div>
        ${excludedCount > 0 ? `<div>Cities excluded: ${excludedCount}</div>` : ''}
    `;
    
    const citiesList = document.getElementById('cities-list');
    const existingCounter = citiesList.querySelector('.city-counters');
    if (existingCounter) {
        citiesList.removeChild(existingCounter);
    }
    citiesList.insertBefore(counterDiv, citiesList.firstChild);
}

// Handle city exclusion
document.getElementById('cities-list').addEventListener('click', function(e) {
    if (e.target.classList.contains('exclude-city')) {
        const cityName = e.target.dataset.city;
        excludedCities.add(cityName);
        
        // Update the display
        const layers = drawnItems.getLayers();
        updateCitiesList(layers);
    }
});

// Add clear exclusions button
const buttonGroup = document.querySelector('.button-group');
const clearExclusionsBtn = document.createElement('button');
clearExclusionsBtn.id = 'clear-exclusions-btn';
clearExclusionsBtn.textContent = 'Clear Exclusions';
clearExclusionsBtn.disabled = true;
buttonGroup.appendChild(clearExclusionsBtn);

// Handle clearing exclusions
clearExclusionsBtn.addEventListener('click', function() {
    excludedCities.clear();
    const layers = drawnItems.getLayers();
    updateCitiesList(layers);
    this.disabled = true;
});

// Update clear exclusions button state
function updateClearExclusionsButton() {
    const btn = document.getElementById('clear-exclusions-btn');
    if (btn) {
        btn.disabled = excludedCities.size === 0;
    }
}

// Handle population filter change
document.getElementById('population-filter').addEventListener('change', () => {
    updateCitiesList(drawnItems.getLayers());
});

// Handle drawing events
map.on(L.Draw.Event.CREATED, async function (event) {
    const layer = event.layer;
    drawnItems.addLayer(layer);

    // Show loading state
    const citiesList = document.getElementById('cities-list');
    citiesList.innerHTML = '<div class="loading">Finding locations...</div>';
    document.getElementById('download-btn').disabled = true;

    try {
        updateCitiesList(drawnItems.getLayers());
    } catch (error) {
        console.error('Error updating cities:', error);
        citiesList.innerHTML = '<div class="error">Error finding locations. Please try again.</div>';
    }
});

// Handle shape deletion
map.on(L.Draw.Event.DELETED, function (event) {
    const layers = drawnItems.getLayers();
    if (layers.length === 0) {
        document.getElementById('cities-list').innerHTML = '';
        document.querySelector('.cities-count').textContent = 'Draw a shape to find towns & cities';
        document.getElementById('download-btn').disabled = true;
        cityMarkers.clearLayers();
        currentCities = [];
    } else {
        updateCitiesList(layers);
    }
});

// Reset button functionality
document.getElementById('reset-btn').addEventListener('click', function() {
    drawnItems.clearLayers();
    cityMarkers.clearLayers();
    document.getElementById('cities-list').innerHTML = '';
    document.querySelector('.cities-count').textContent = 'Draw a shape to find towns & cities';
    document.getElementById('download-btn').disabled = true;
    currentCities = [];
});

// Download button functionality
document.getElementById('download-btn').addEventListener('click', function() {
    if (!currentCities.length) return;

    // Create CSV content
    const csvContent = [
        ['Location', 'Population', 'Area Code', 'Latitude', 'Longitude'].join(','),
        ...currentCities.map(city => [
            city.name,
            city.population,
            city.areaCode,
            city.latitude,
            city.longitude
        ].join(','))
    ].join('\n');

    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    // Set up download link
    link.href = URL.createObjectURL(blob);
    link.download = `uk_locations_${new Date().toISOString().split('T')[0]}.csv`;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Prevent map from zooming too far out
map.setMinZoom(5);
