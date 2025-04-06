from flask import Flask, render_template, jsonify, request, Response
import csv
import io
import uuid # Use UUID for simple unique IDs

# Add this near the top of app.py
PREDEFINED_COLORS = [
    '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
    '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'
]
# Keep track of the next color index
next_color_index = 0

app = Flask(__name__)

# In-memory storage (replace with database later)
events_data = []
projects_data = [] # Add storage for projects

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/events', methods=['GET'])
def get_events():
    # Enhance event data with project name before sending to client
    events_with_project_names = []
    project_map = {p['id']: p['name'] for p in projects_data}
    for event in events_data:
        event_copy = event.copy()
        event_copy['projectName'] = project_map.get(event.get('projectId')) # Add project name if projectId exists
        events_with_project_names.append(event_copy)
    return jsonify(events_with_project_names)

@app.route('/api/events', methods=['POST'])
def add_event():
    event = request.json
    # Add basic validation/sanitization here
    print(f"Received event: {event}") # Server-side logging
    # Ensure required fields exist (add projectId)
    if not all(k in event for k in ('title', 'dayIndex', 'start', 'end', 'projectId')):
         return jsonify({"status": "error", "message": "Missing event data"}), 400

    # Optional: Validate projectId exists in projects_data
    if not any(p['id'] == event['projectId'] for p in projects_data):
         print(f"Warning: Event added with non-existent projectId: {event['projectId']}") # Log warning but allow for now

    events_data.append(event)
    # Return the event data as it was stored (client can use projectId)
    return jsonify({"status": "success", "event": event}), 201

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

    new_project = {
        "id": str(uuid.uuid4()), # Generate a unique ID
        "name": project_name
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
    for event in events_data:
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
