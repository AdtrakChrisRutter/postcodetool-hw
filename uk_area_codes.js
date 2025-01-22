// Comprehensive list of UK area codes for major cities
const ukAreaCodes = {
    // Major Cities
    'London': '020',
    'Birmingham': '0121',
    'Manchester': '0161',
    'Leeds': '0113',
    'Glasgow': '0141',
    'Liverpool': '0151',
    'Newcastle': '0191',
    'Sheffield': '0114',
    'Bristol': '0117',
    'Belfast': '028',
    'Edinburgh': '0131',
    'Cardiff': '029',
    
    // Other Notable Cities
    'Southampton': '023',
    'Portsmouth': '023',
    'Nottingham': '0115',
    'Leicester': '0116',
    'Coventry': '024',
    'Aberdeen': '01224',
    'Dundee': '01382',
    'Swansea': '01792',
    'Plymouth': '01752',
    'Brighton': '01273',
    'Cambridge': '01223',
    'Oxford': '01865',
    'York': '01904',
    
    // Regions
    'Inner London': '020',
    'Outer London': '020',
    'Greater Manchester': '0161',
    'West Midlands': '0121',
    'Yorkshire': '0113',
    'North East': '0191',
    
    // Default
    'default': '01'
};

// Function to get area code for a city
function getAreaCode(cityName) {
    // Normalize city name by removing spaces and converting to lowercase
    const normalizedName = cityName.toLowerCase().replace(/\s+/g, '');
    
    // Try direct match first
    for (let city in ukAreaCodes) {
        if (city.toLowerCase().replace(/\s+/g, '') === normalizedName) {
            return ukAreaCodes[city];
        }
    }
    
    // If no direct match, try partial match
    for (let city in ukAreaCodes) {
        if (normalizedName.includes(city.toLowerCase().replace(/\s+/g, ''))) {
            return ukAreaCodes[city];
        }
    }
    
    // Return default if no match found
    return ukAreaCodes['default'];
}

export { ukAreaCodes, getAreaCode };
