// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    try {
        // Initialize map
        const map = L.map('map').setView([52.9548, -1.1581], 8);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

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

        // Add city markers
        if (window.ukTownsAndCities && Array.isArray(window.ukTownsAndCities)) {
            const cityMarkersLayer = L.layerGroup().addTo(map);
            
            window.ukTownsAndCities.forEach(city => {
                L.marker([city.latitude, city.longitude])
                    .bindPopup(`<b>${city.name}</b><br>Population: ${city.population.toLocaleString()}<br>Phone Code: ${city.phoneCode}`)
                    .addTo(cityMarkersLayer);
            });

            // Update city list
            const cityList = document.getElementById('city-list');
            const categorizedCities = window.categorizeCities(window.ukTownsAndCities);
            const categories = ['Major City', 'Large City', 'Medium City', 'Small City', 'Town'];
            
            cityList.innerHTML = categories.map(category => {
                const citiesInCategory = categorizedCities.filter(city => city.category === category);
                if (citiesInCategory.length === 0) return '';
                
                return `
                    <div class="category">
                        <h3>${category}</h3>
                        ${citiesInCategory.map(city => `
                            <div class="city-item">
                                ${city.name} (${city.phoneCode})
                            </div>
                        `).join('')}
                    </div>
                `;
            }).join('');
        } else {
            throw new Error('Cities data not loaded');
        }
    } catch (error) {
        console.error('Map initialization error:', error);
        alert('Failed to initialize map. Please refresh the page.');
    }
});
