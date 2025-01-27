import json
import os
import re
import requests
import base64
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut

def get_issue_data():
    """Extract location data from the issue body"""
    event_path = os.environ['GITHUB_EVENT_PATH']
    with open(event_path, 'r') as f:
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
    r = requests.get(f"{api_url}/git/refs/heads/main", headers=headers)
    if r.status_code != 200:
        raise ValueError(f"Failed to get main branch SHA: {r.text}")
    sha = r.json()['object']['sha']
    
    # Create new branch
    try:
        requests.post(
            f"{api_url}/git/refs",
            headers=headers,
            json={
                'ref': f"refs/heads/{branch_name}",
                'sha': sha
            }
        )
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Failed to create branch: {str(e)}")

    # Get current file content
    r = requests.get(f"{api_url}/contents/uk_cities_data.js", headers=headers)
    if r.status_code != 200:
        raise ValueError(f"Failed to get file content: {r.text}")
    content = r.json()
    
    # Decode content
    file_content = base64.b64decode(content['content']).decode('utf-8')
    
    # Update file content
    new_location = f'    {{ name: "{name}", phoneCode: "", population: {population or 0}, latitude: {lat}, longitude: {lon} }},\n'
    insertion_point = file_content.rfind('];')
    new_content = file_content[:insertion_point] + new_location + file_content[insertion_point:]
    
    # Encode content
    encoded_content = base64.b64encode(new_content.encode('utf-8')).decode('utf-8')
    
    # Commit changes
    r = requests.put(
        f"{api_url}/contents/uk_cities_data.js",
        headers=headers,
        json={
            'message': f"Add {name} to locations",
            'content': encoded_content,
            'branch': branch_name,
            'sha': content['sha']
        }
    )
    if r.status_code != 200:
        raise ValueError(f"Failed to commit changes: {r.text}")
    
    # Create pull request
    r = requests.post(
        f"{api_url}/pulls",
        headers=headers,
        json={
            'title': f"Add {name} to locations",
            'body': f"Closes #{issue_number}\n\nAdds {name} to the location database with the following details:\n- Population: {population or 'TBD'}\n- Coordinates: {lat}, {lon}",
            'head': branch_name,
            'base': 'main'
        }
    )
    if r.status_code != 201:
        raise ValueError(f"Failed to create PR: {r.text}")
    
    return r.json()['html_url']

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
