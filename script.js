// Initialize map
const map = L.map('map').setView([52.9548, -1.1581], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ' OpenStreetMap contributors'
}).addTo(map);

// Initialize drawing controls
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Store current postcodes
let currentPostcodes = new Set();

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

// Handle drawing events
map.on(L.Draw.Event.CREATED, async function (event) {
    const layer = event.layer;
    drawnItems.addLayer(layer);
    
    // Show loading state
    const postcodeList = document.getElementById('postcode-list');
    postcodeList.innerHTML = '<div class="loading">Loading postcodes...</div>';
    document.getElementById('download-csv-btn').disabled = true;
    document.getElementById('download-xls-btn').disabled = true;
    document.getElementById('copy-postcodes-btn').disabled = true;
    
    try {
        await updatePostcodesFromShapes();
    } catch (error) {
        console.error('Error fetching postcodes:', error);
        postcodeList.innerHTML = '<div class="error">Error fetching postcodes. Please try again. (Error: ' + error.message + ')</div>';
        document.getElementById('download-csv-btn').disabled = true;
        document.getElementById('download-xls-btn').disabled = true;
        document.getElementById('copy-postcodes-btn').disabled = true;
    }
});

// Handle shape deletion
map.on(L.Draw.Event.DELETED, async function (event) {
    if (drawnItems.getLayers().length === 0) {
        // If all shapes are deleted, clear postcodes
        currentPostcodes.clear();
        const postcodeList = document.getElementById('postcode-list');
        postcodeList.innerHTML = '';
        document.getElementById('download-csv-btn').disabled = true;
        document.getElementById('download-xls-btn').disabled = true;
        document.getElementById('copy-postcodes-btn').disabled = true;
    } else {
        // If some shapes remain, update postcodes
        try {
            await updatePostcodesFromShapes();
        } catch (error) {
            console.error('Error updating postcodes:', error);
        }
    }
});

// Function to update postcodes from all shapes
async function updatePostcodesFromShapes() {
    const layers = drawnItems.getLayers();
    if (layers.length === 0) return;

    const postcodeList = document.getElementById('postcode-list');
    let allPostcodes = new Set();

    for (const layer of layers) {
        const bounds = layer.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        
        // Create a grid of points within the bounds
        const points = generateGridPoints(sw.lat, sw.lng, ne.lat, ne.lng);
        
        // Split points into chunks
        const chunks = chunkArray(points, 100);
        
        for (const chunk of chunks) {
            try {
                const response = await fetch('https://api.postcodes.io/postcodes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        geolocations: chunk.map(point => ({
                            longitude: point[1],
                            latitude: point[0],
                            radius: 1500, // 1.5km radius
                            limit: 1
                        }))
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (!data.result) {
                    console.error('Unexpected API response:', data);
                    throw new Error('Invalid API response format');
                }

                data.result.forEach(result => {
                    if (result.result && result.result.length > 0) {
                        // Only store the outward code (short postcode)
                        const shortCode = result.result[0].postcode.split(' ')[0];
                        allPostcodes.add(shortCode);
                    }
                });

                // Add a small delay between chunks to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (chunkError) {
                console.error('Error processing chunk:', chunkError);
                continue;
            }
        }
    }

    if (allPostcodes.size === 0) {
        postcodeList.innerHTML = '<div class="no-results">Draw a shape to select postcodes</div>';
        document.getElementById('download-csv-btn').disabled = true;
        document.getElementById('download-xls-btn').disabled = true;
        document.getElementById('copy-postcodes-btn').disabled = true;
        return;
    }

    // Update current postcodes and display them
    currentPostcodes = allPostcodes;
    displayPostcodes(Array.from(currentPostcodes));
}

// Function to display postcodes in the sidebar
function displayPostcodes(postcodes) {
    const postcodeList = document.getElementById('postcode-list');
    const downloadCsvBtn = document.getElementById('download-csv-btn');
    const downloadXlsBtn = document.getElementById('download-xls-btn');
    
    if (postcodes.length === 0) {
        postcodeList.innerHTML = '<div class="no-results">Draw a shape to select postcodes</div>';
        downloadCsvBtn.disabled = true;
        downloadXlsBtn.disabled = true;
        return;
    }
    
    // Sort postcodes
    const sortedPostcodes = [...postcodes].sort();
    
    postcodeList.innerHTML = sortedPostcodes
        .map(postcode => `
            <div class="city-item" data-postcode="${postcode}">
                <button class="remove-city" aria-label="Remove ${postcode}">&times;</button>
                <div class="city-name">${postcode}</div>
            </div>
        `)
        .join('');
        
    // Add event listeners for remove buttons
    document.querySelectorAll('.remove-city').forEach(button => {
        button.addEventListener('click', function(e) {
            const postcodeItem = e.target.closest('.city-item');
            const postcode = postcodeItem.dataset.postcode;
            
            // Remove the postcode item from display
            postcodeItem.remove();
            currentPostcodes.delete(postcode);
            
            // Update download buttons state
            const remainingPostcodes = document.querySelectorAll('.city-item').length;
            downloadCsvBtn.disabled = remainingPostcodes === 0;
            downloadXlsBtn.disabled = remainingPostcodes === 0;
            copyPostcodesBtn.disabled = remainingPostcodes === 0;
            
            // Show "no results" if all postcodes are removed
            if (remainingPostcodes === 0) {
                postcodeList.innerHTML = '<div class="no-results">Draw a shape to select postcodes</div>';
            }
        });
    });
        
    // Enable download buttons
    downloadCsvBtn.disabled = false;
    downloadXlsBtn.disabled = false;
    document.getElementById('copy-postcodes-btn').disabled = false;
}

// Reset button functionality
document.getElementById('reset-btn').addEventListener('click', function() {
    drawnItems.clearLayers();
    document.getElementById('postcode-list').innerHTML = '';
    document.getElementById('download-csv-btn').disabled = true;
    document.getElementById('download-xls-btn').disabled = true;
    document.getElementById('copy-postcodes-btn').disabled = true;
    currentPostcodes.clear();
});

// Download CSV button functionality
document.getElementById('download-csv-btn').addEventListener('click', function() {
    if (!currentPostcodes.size) return;
    
    // Create CSV content
    const csvContent = 'Postcode\n' + Array.from(currentPostcodes).sort().join('\n');
    
    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Set up download link
    link.href = URL.createObjectURL(blob);
    link.download = `uk_postcodes_${new Date().toISOString().split('T')[0]}.csv`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Copy Postcodes button functionality
document.getElementById('copy-postcodes-btn').addEventListener('click', async function() {
    if (!currentPostcodes.size) return;
    
    // Create comma-separated string of postcodes
    const postcodesText = Array.from(currentPostcodes).sort().join(', ');
    
    try {
        await navigator.clipboard.writeText(postcodesText);
        alert('Postcodes copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy postcodes:', err);
        alert('Failed to copy postcodes to clipboard');
    }
});

// Download XLS button functionality
document.getElementById('download-xls-btn').addEventListener('click', function() {
    if (!currentPostcodes.size) return;
    
    // Create XLS content
    const xlsContent = [
        ['Postcode'],
        ...Array.from(currentPostcodes).sort().map(postcode => [postcode])
    ];
    
    // Create blob and download link
    const blob = new Blob([xlsContent.map(row => row.join('\t')).join('\n')], { type: 'text/tab-separated-values;charset=utf-8;' });
    const link = document.createElement('a');
    
    // Set up download link
    link.href = URL.createObjectURL(blob);
    link.download = `uk_postcodes_${new Date().toISOString().split('T')[0]}.xls`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Helper function to generate a grid of points within bounds
function generateGridPoints(minLat, minLng, maxLat, maxLng) {
    const points = [];
    const step = 0.02; // Approximately 2km grid
    
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

// Prevent map from zooming too far out
map.setMinZoom(5);

// Enable touch events for mobile devices
if (L.Browser.touch) {
    L.DomEvent.disableClickPropagation(map._container);
}
