from flask import Flask, render_template, jsonify, request, Response
import csv
import io
import uuid # Use UUID for simple unique IDs
import random # Import random module

# Add this near the top of app.py
PREDEFINED_COLORS = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
    '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'
]
# Keep track of the next color index
# next_color_index = 0

app = Flask(__name__)

# In-memory storage (replace with database later)
events_data = {
    # Example initial event (key is ID)
    # "evt1": {
    #     "id": "evt1",
    #     "title": "Initial Meeting",
    #     "dayIndex": 2, # Tuesday
    #     "start": "10:00",
    #     "end": "11:30",
    #     "projectId": "proj1"
    # }
}
projects_data = [
    # Example initial project
    # {
    #     "id": "proj1",
    #     "name": "Project Alpha",
    #     "color": "#F44336"
    # }
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/events', methods=['GET'])
def get_events():
    # Enhance event data with project name and color before sending to client
    events_with_project_info = []
    # Create maps for project name and color lookup
    project_name_map = {p['id']: p['name'] for p in projects_data}
    project_color_map = {p['id']: p.get('color') for p in projects_data} # Use .get for safety

    for event_id, event in events_data.items(): # Iterate over dictionary items
        event_copy = event.copy()
        project_id = event.get('projectId')
        if project_id:
            event_copy['projectName'] = project_name_map.get(project_id) # Add project name
            looked_up_color = project_color_map.get(project_id) # Add project color
            event_copy['projectColor'] = looked_up_color
        events_with_project_info.append(event_copy)

    return jsonify(events_with_project_info)

@app.route('/api/events', methods=['POST'])
def add_event():
    event_data = request.json
    print(f"Received event: {event_data}") # Keep for debugging
    # Basic validation (add more as needed)
    if not all(k in event_data for k in ('title', 'dayIndex', 'start', 'end', 'projectId')):
        return jsonify({"error": "Missing required event fields"}), 400

    new_event_id = str(uuid.uuid4()) # Generate unique ID
    newEvent = {
        "id": new_event_id,
        "title": event_data['title'],
        "dayIndex": event_data['dayIndex'],
        "start": event_data['start'],
        "end": event_data['end'], # Store the end time
        "projectId": event_data['projectId']
    }
    events_data[new_event_id] = newEvent # Add to dictionary
    return jsonify(newEvent), 201

@app.route('/api/events/<event_id>', methods=['PUT'])
def update_event(event_id):
    if event_id not in events_data:
        return jsonify({"error": "Event not found"}), 404

    update_data = request.json
    print(f"Updating event {event_id} with: {update_data}")

    # Basic validation
    if not all(k in update_data for k in ('title', 'dayIndex', 'start', 'end', 'projectId')):
        return jsonify({"error": "Missing required event fields for update"}), 400

    # Update the stored event (ensure ID remains the same)
    updated_event = events_data[event_id]
    updated_event.update({
        "title": update_data['title'],
        "dayIndex": update_data['dayIndex'], # Note: Allowing day change might need UI adjustments
        "start": update_data['start'],
        "end": update_data['end'],
        "projectId": update_data['projectId']
    })
    # events_data[event_id] = updated_event # No need, dictionary holds reference

    return jsonify(updated_event), 200

# --- Project API Endpoints ---
@app.route('/api/projects', methods=['GET'])
def get_projects():
    return jsonify(projects_data)

@app.route('/api/projects', methods=['POST'])
def add_project():
    project_info = request.json
    project_name = project_info.get('name', '').strip()

    if not project_name:
        return jsonify({"status": "error", "message": "Project name cannot be empty"}), 400

    # Check for duplicate project names (case-insensitive check)
    if any(p['name'].lower() == project_name.lower() for p in projects_data):
        return jsonify({"status": "error", "message": f"Project '{project_name}' already exists"}), 409 # Conflict

    # Assign a random color from the list
    assigned_color = random.choice(PREDEFINED_COLORS)

    new_project = {
        "id": str(uuid.uuid4()), # Generate a unique ID
        "name": project_name,
        "color": assigned_color
    }
    projects_data.append(new_project)
    print(f"Added project: {new_project}")
    return jsonify({"status": "success", "project": new_project}), 201
# --- End Project API ---


@app.route('/api/export/csv')
def export_csv():
    if not events_data:
        return "No data to export", 400

    output = io.StringIO()
    project_map = {p['id']: p['name'] for p in projects_data} # Map IDs to names for export

    # Define base fieldnames, add projectName dynamically if any event has it
    fieldnames = ['title', 'dayIndex', 'start', 'end', 'projectId', 'projectName'] # Add projectId and projectName

    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction='ignore') # Ignore extra fields if any
    writer.writeheader()

    # Prepare rows with project names
    rows_to_write = []
    for event in events_data.values():
        row = event.copy()
        row['projectName'] = project_map.get(event.get('projectId')) # Add project name
        rows_to_write.append(row)

    writer.writerows(rows_to_write)

    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition":
                 "attachment; filename=time_tracking_export.csv"})


if __name__ == '__main__':
    app.run(debug=True)
