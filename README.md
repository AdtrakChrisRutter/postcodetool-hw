# UK Postcode Map

An interactive web application that allows users to draw shapes on a map of the UK and view postcodes within the selected area.

## Features

- Interactive UK map with zoom and pan functionality
- Draw shapes (polygons or rectangles) to select areas
- View postcodes within the selected area
- Mobile-responsive design with touch support
- Reset button to clear selections

## Technologies Used

- Leaflet.js for the interactive map
- Leaflet.draw for drawing functionality
- OpenStreetMap for map tiles
- HTML5, CSS3, and JavaScript

## Setup

1. Clone this repository
2. Create a `config.js` file in the root directory with the following content:
   ```javascript
   window.CONFIG = {
       CLIENT_ID: 'your-google-oauth-client-id',
       API_KEY: 'your-google-api-key'
   };
   ```
3. Replace the placeholder values with your Google API credentials
4. Open `index.html` in a web browser

## Usage

1. Use the drawing tools on the right side of the map to draw a shape
2. The postcodes within the selected area will appear in the sidebar
3. Use the "Reset Shape" button to clear your selection
4. Pinch or use scroll wheel to zoom the map

## Note

Currently using sample postcodes for demonstration. To make it fully functional, you'll need to integrate with a UK postcode API service.
