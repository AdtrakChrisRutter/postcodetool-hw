// Global variables for drawing and customer selection
let drawingLayer = null;
let existingLocations = new Set();
let selectedCustomer = null;

// Your OAuth 2.0 client ID will need to be added here
const CLIENT_ID = '863782134250-8kmnflneqfcp9peu116o5ufab9e4esip.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBE3cb3zm_RPSIReIsRRDSDX7ZK-_jGwt0';

// Discovery doc URL for APIs used by the quickstart
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

// Authorization scopes required by the API
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
];

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Initialize the Google API client
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        apiKey: API_KEY,
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        callback: '', // defined later
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    console.log('Checking button state - GAPI:', gapiInited, 'GIS:', gisInited);
    if (gapiInited && gisInited) {
        const button = document.getElementById('load-sheet');
        if (button) {
            console.log('Enabling load sheet button');
            button.style.display = 'block';
        } else {
            console.error('Load sheet button not found in DOM');
        }
    }
}

// Handle the sign-in flow
async function handleAuthClick() {
    console.log('Auth click handler started');
    tokenClient.callback = async (resp) => {
        console.log('Token client callback received:', resp);
        if (resp.error !== undefined) {
            console.error('Auth error:', resp);
            throw (resp);
        }
        console.log('Auth successful, fetching locations...');
        await listCustomerLocations();
    };

    try {
        const token = gapi.client.getToken();
        console.log('Current token state:', token ? 'Has token' : 'No token');
        
        if (token === null) {
            console.log('Requesting new token with consent...');
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            console.log('Using existing token...');
            tokenClient.requestAccessToken({ prompt: '' });
        }
    } catch (error) {
        console.error('Auth error:', error);
    }
}

// Function to extract city name from dialing code format
function extractCityName(dialingCodeArea) {
    // Format example: "Guildford (01483)"
    const match = dialingCodeArea.match(/(.+?)\s*\([0-9]+\)/);
    return match ? match[1].trim() : dialingCodeArea;
}

// Function to load customer list from Google Sheet
async function listCustomerLocations() {
    try {
        console.log('Starting to fetch customer locations...');
        console.log('GAPI Client Token:', gapi.client.getToken());
        const spreadsheetId = '1JpDjQ45YAqwmqg5nkI8qCmqiZa8HnNxFOK1yC8dLNjw';
        const range = 'Locations!A2:H';

        console.log('Fetching from sheet:', spreadsheetId, 'range:', range);
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: range,
        });

        const rows = response.result.values;
        console.log('Raw data from sheet:', rows);

        if (!rows || rows.length === 0) {
            console.log('No data found in the sheet.');
            return;
        }

        // Process and group locations by customer
        console.log('Processing', rows.length, 'rows from sheet');
        const customerLocations = {};

        rows.filter(row => row[0] && row[1]).forEach(row => {
            const customerName = row[0];
            const cityName = extractCityName(row[1]);
            const cityMatch = window.ukCities.find(city => 
                city.name.toLowerCase() === cityName.toLowerCase());

            if (!customerLocations[customerName]) {
                customerLocations[customerName] = [];
            }

            if (cityMatch) {
                customerLocations[customerName].push({
                    cityWithCode: row[1],
                    coordinates: [cityMatch.lat, cityMatch.lng]
                });
            }
            })
            .filter(location => location.coordinates); // Only keep locations with coordinates

        console.log('Valid customer locations:', customerLocations.length);

        // Wait for cities data to be available
        document.addEventListener('citiesLoaded', function() {
            console.log('Available UK cities:', window.ukCities ? window.ukCities.length : 'ukCities not found');

            // Find matching cities in the UK cities data
            const matchedLocations = customerLocations.map(customer => {
                const matchedCity = window.ukCities.find(city => 
                    city.name.toLowerCase() === customer.cityName.toLowerCase());
                
                const location = {
                    ...customer,
                    coordinates: matchedCity ? [matchedCity.latitude, matchedCity.longitude] : null
                };
                console.log(
                    'Matching result for', customer.cityName, ':', 
                    matchedCity ? 'Found at ' + location.coordinates : 'Not found'
                );
                return location;
            });

            // Add markers for each customer location
            console.log('Adding markers for', customerLocations.length, 'locations');
            addCustomerLocations(customerLocations);
        });


    } catch (err) {
        console.error('Error loading customer locations:', err);
    }
}

// Function to show customer locations on the map
function showCustomerLocations(locations) {
    console.log('Showing customer locations...');
    
    const addMarkers = () => {
        console.log('Map ready, adding markers...');
        if (!window.map) {
            console.error('Map not initialized yet');
            return;
        }
        
        try {
            clearMap();

            // Create a new layer group for customer locations
            window.customerLayer = L.layerGroup();
            existingLocations.clear();

            // Add markers for each location
            let markersAdded = 0;
            let totalALD = 0;
            let totalAdspend = 0;

            locations.forEach(location => {
                try {
                    if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
                        console.error('Invalid coordinates for:', location);
                        return;
                    }

                    const [lat, lng] = location.coordinates;
                    existingLocations.add(`${lat},${lng}`);
                    console.log('Adding marker at:', lat, lng);

                    const marker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'customer-marker-icon',
                            html: `<div></div>`,
                            iconSize: [12, 12]
                        })
                    });

                    // Add popup with location information
                    marker.bindPopup(`<strong>${location.cityWithCode}</strong>`);

                    marker.addTo(window.customerLayer);
                    markersAdded++;

                    // Calculate costs based on city size
                    const cityMatch = window.ukCities.find(city => 
                        city.name.toLowerCase() === extractCityName(location.cityWithCode).toLowerCase());
                    
                    if (cityMatch) {
                        const population = cityMatch.population || 0;
                        let costs;
                        if (population >= 500000) {
                            costs = {
                                ald: Number(document.getElementById('major-ald').value),
                                adspend: Number(document.getElementById('major-adspend').value)
                            };
                        } else if (population >= 200000) {
                            costs = {
                                ald: Number(document.getElementById('large-ald').value),
                                adspend: Number(document.getElementById('large-adspend').value)
                            };
                        } else if (population >= 100000) {
                            costs = {
                                ald: Number(document.getElementById('medium-ald').value),
                                adspend: Number(document.getElementById('medium-adspend').value)
                            };
                        } else {
                            costs = {
                                ald: Number(document.getElementById('small-ald').value),
                                adspend: Number(document.getElementById('small-adspend').value)
                            };
                        }
                        totalALD += costs.ald;
                        totalAdspend += costs.adspend;
                    }
                } catch (err) {
                    console.error('Error adding marker for:', location, err);
                }
            });

            // Add the layer to the map
            window.customerLayer.addTo(window.map);
            console.log('Added', markersAdded, 'markers to the map');

            // Update totals display
            const totalsBox = document.getElementById('totals-box');
            const totalsContent = document.getElementById('totals-content');
            totalsBox.style.display = 'block';
            totalsContent.innerHTML = `
                <div class="total-item">
                    <span>Total ALD License Cost:</span>
                    <span>£${totalALD.toLocaleString()}</span>
                </div>
                <div class="total-item">
                    <span>Total Estimated Adspend:</span>
                    <span>£${totalAdspend.toLocaleString()}</span>
                </div>
                <div class="total-item total-combined">
                    <span>Combined Total:</span>
                    <span>£${(totalALD + totalAdspend).toLocaleString()}</span>
                </div>
            `;

            // Fit the map to show all markers
            if (markersAdded > 0) {
                const bounds = L.latLngBounds(locations.map(loc => loc.coordinates));
                window.map.fitBounds(bounds, { padding: [50, 50] });
                console.log('Fitted map to bounds:', bounds);
            }

            // Initialize drawing controls if not already done
            initializeDrawingControls();
        } catch (err) {
            console.error('Error in showCustomerLocations:', err);
        }
    };

    // If map is ready, add markers immediately
    if (window.map && window.map.getCenter()) {
        console.log('Map already initialized, adding markers now...');
        addMarkers();
    } else {
        // Otherwise wait for map to be ready
        console.log('Waiting for map to be initialized...');
        window.addEventListener('mapInitialized', addMarkers);
    }
}

// Function to clear the map
function clearMap() {
    if (window.customerLayer) {
        window.map.removeLayer(window.customerLayer);
    }
    if (drawingLayer) {
        window.map.removeLayer(drawingLayer);
        drawingLayer = null;
    }
    // Hide totals box
    const totalsBox = document.getElementById('totals-box');
    if (totalsBox) {
        totalsBox.style.display = 'none';
    }
}

// Function to initialize drawing controls
function initializeDrawingControls() {
    // Initialize drawing layer if not exists
    if (!drawingLayer) {
        drawingLayer = new L.FeatureGroup();
        window.map.addLayer(drawingLayer);
    }

    // Initialize drawing control if not exists
    if (!window.drawControl) {
        window.drawControl = new L.Control.Draw({
            draw: {
                marker: false,
                circle: true,
                circlemarker: false,
                rectangle: true,
                polygon: true,
                polyline: false
            },
            edit: {
                featureGroup: drawingLayer
            }
        });
        window.map.addControl(window.drawControl);

        // Handle drawing events
        window.map.on('draw:created', function(e) {
            const layer = e.layer;
            const bounds = layer.getBounds();
            
            // Check if the drawn area overlaps with existing locations
            let canAdd = true;
            existingLocations.forEach(coord => {
                const [lat, lng] = coord.split(',').map(Number);
                if (bounds.contains([lat, lng])) {
                    canAdd = false;
                }
            });

            if (canAdd) {
                drawingLayer.addLayer(layer);
            } else {
                alert('This area overlaps with existing customer locations!');
            }
        });
    }

    // Set up drawing control buttons
    document.getElementById('start-draw').addEventListener('click', () => {
        new L.Draw.Polygon(window.map).enable();
    });

    document.getElementById('clear-draw').addEventListener('click', () => {
        drawingLayer.clearLayers();
    });
}

// Add event listeners
document.getElementById('load-sheet').addEventListener('click', handleAuthClick);
