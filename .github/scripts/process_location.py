import json
import os
import re
import requests
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

def get_issue_data():
    """Extract location data from the issue body"""
    issue_number = os.environ['GITHUB_EVENT_PATH']
    with open(issue_number, 'r') as f:
        event = json.load(f)
    
    body = event['issue']['body']
    try:
        # Extract JSON data from the issue body
        json_match = re.search(r'```json\n(.*?)\n```', body, re.DOTALL)
        if not json_match:
            raise ValueError("No JSON data found in issue")
        
        data = json.loads(json_match.group(1))
        return data['data'], event['issue']['number']
    except (json.JSONDecodeError, KeyError) as e:
        raise ValueError(f"Invalid issue format: {str(e)}")

def get_location_data(name):
    """Get location data using OpenStreetMap's Nominatim"""
    geolocator = Nominatim(user_agent="uk-postcode-tool")
    
    try:
        location = geolocator.geocode(f"{name}, UK")
        if location:
            return location.latitude, location.longitude
    except GeocoderTimedOut:
        return None, None
    
    return None, None

def get_population_data(name):
    """Get population data from ONS API"""
    # This is a placeholder - we'd need to implement the actual ONS API call
    # For now, return None and let the issue comment handle missing data
    return None

def create_pull_request(name, lat, lon, population, issue_number):
    """Create a pull request with the new location data"""
    token = os.environ['GITHUB_TOKEN']
    repo = os.environ['GITHUB_REPOSITORY']
    api_url = f"https://api.github.com/repos/{repo}"
    
    headers = {
        'Authorization': f"token {token}",
        'Accept': 'application/vnd.github.v3+json'
    }

    # Create a new branch
    branch_name = f"add-location-{name.lower().replace(' ', '-')}"
    
    # Get the current commit SHA
    r = requests.get(f"{api_url}/git/ref/heads/main", headers=headers)
    sha = r.json()['object']['sha']
    
    # Create new branch
    requests.post(
        f"{api_url}/git/refs",
        headers=headers,
        json={
            'ref': f"refs/heads/{branch_name}",
            'sha': sha
        }
    )
    
    # Update uk_cities_data.js
    new_location = f"""    {{ name: "{name}", phoneCode: "", population: {population or 0}, latitude: {lat}, longitude: {lon} }},\n"""
    
    # Get current file content
    r = requests.get(f"{api_url}/contents/uk_cities_data.js", headers=headers)
    content = r.json()
    
    # Update file content
    file_content = content['content'].decode('base64')
    insertion_point = file_content.rfind('];')
    new_content = file_content[:insertion_point] + new_location + file_content[insertion_point:]
    
    # Commit changes
    requests.put(
        f"{api_url}/contents/uk_cities_data.js",
        headers=headers,
        json={
            'message': f"Add {name} to locations",
            'content': new_content.encode('base64'),
            'branch': branch_name,
            'sha': content['sha']
        }
    )
    
    # Create pull request
    pr = requests.post(
        f"{api_url}/pulls",
        headers=headers,
        json={
            'title': f"Add {name} to locations",
            'body': f"Closes #{issue_number}\n\nAdds {name} to the location database with the following details:\n- Population: {population or 'TBD'}\n- Coordinates: {lat}, {lon}",
            'head': branch_name,
            'base': 'main'
        }
    )
    
    return pr.json()['html_url']

def main():
    try:
        # Get location data from issue
        location_data, issue_number = get_issue_data()
        name = location_data['name']
        
        # Get location coordinates
        lat, lon = get_location_data(name)
        if not lat or not lon:
            raise ValueError(f"Could not find coordinates for {name}")
        
        # Get additional data
        population = get_population_data(name)
        
        # Create pull request
        pr_url = create_pull_request(name, lat, lon, population, issue_number)
        
        # Comment on the issue
        comment = f"""Location data gathered:
- Coordinates: {lat}, {lon}
- Population: {population or 'TBD - please provide in PR review'}

Created pull request: {pr_url}

Please review the data and update any missing information in the pull request."""
        
        requests.post(
            f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}/issues/{issue_number}/comments",
            headers={'Authorization': f"token {os.environ['GITHUB_TOKEN']}"},
            json={'body': comment}
        )
        
    except Exception as e:
        # Comment error on issue
        requests.post(
            f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}/issues/{issue_number}/comments",
            headers={'Authorization': f"token {os.environ['GITHUB_TOKEN']}"},
            json={'body': f"Error processing location request: {str(e)}"}
        )
        raise

if __name__ == '__main__':
    main()
