// --- Helper Function for Text Color based on Background ---
function getContrastYIQ(hexcolor){
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}

let currentEvents = {}; // Store fetched events by ID

document.addEventListener('DOMContentLoaded', function() {
    const gridContent = document.querySelector('.grid-content');
    const timeAxis = document.querySelector('.time-axis');
    // Sidebar elements
    const projectListUl = document.getElementById('project-list');
    const newProjectNameInput = document.getElementById('new-project-name');
    const addProjectButton = document.getElementById('add-project-button');

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const hours = 24; // 24 hours a day
    const slotHeight = 60; // Matches CSS: height of .time-slot

    // --- Modal Elements ---
    const modal = document.getElementById('event-modal');
    const closeModalButton = document.querySelector('.close-button');
    const saveEventButton = document.getElementById('save-event');
    const eventProjectSelect = document.getElementById('event-project'); // Project dropdown
    const eventTitleInput = document.getElementById('event-title');
    const eventStartTimeInput = document.getElementById('event-start-time'); // New input
    const eventEndTimeInput = document.getElementById('event-end-time');   // New input
    const modalDaySpan = document.getElementById('modal-day');
    const modalDayIndexInput = document.getElementById('modal-day-index');
    const modalEditEventIdInput = document.getElementById('modal-edit-event-id'); // For editing
    const modalTitleElement = document.getElementById('modal-title'); // Modal title H2

    // --- Export Button ---
    const exportButton = document.getElementById('export-csv');


    // --- Generate Time Axis Labels ---
    for (let i = 0; i < hours; i++) {
        const timeLabel = document.createElement('div');
        timeLabel.classList.add('time-label');
        // Wrap text in a span for precise CSS positioning
        const timeTextSpan = document.createElement('span');
        timeTextSpan.textContent = `${String(i).padStart(2, '0')}:00`; // Format as HH:00
        timeLabel.appendChild(timeTextSpan);
        timeAxis.appendChild(timeLabel);
    }

    // --- Generate Calendar Grid ---
    days.forEach((day, dayIndex) => {
        const dayColumn = document.createElement('div');
        dayColumn.classList.add('day-column');
        dayColumn.dataset.dayIndex = dayIndex; // Store day index

        for (let hour = 0; hour < hours; hour++) {
            const timeSlot = document.createElement('div');
            timeSlot.classList.add('time-slot');
            timeSlot.dataset.hour = hour; // Store hour
            timeSlot.dataset.day = day;
             timeSlot.dataset.dayIndex = dayIndex; // Also store day index here for easy access
             timeSlot.dataset.time = `${String(hour).padStart(2, '0')}:00`; // Store formatted time

            // --- Add Click Listener to Time Slots ---
            timeSlot.addEventListener('click', () => openAddEventModal(day, dayIndex, hour));

            dayColumn.appendChild(timeSlot);
        }
        gridContent.appendChild(dayColumn);
    });

    // --- Modal Logic ---
    function openAddEventModal(day, dayIndex, hour) {
        modalTitleElement.textContent = 'Add New Event'; // Set title for adding
        modalEditEventIdInput.value = ''; // Ensure edit ID is clear
        eventTitleInput.value = ''; // Clear previous title
        eventProjectSelect.value = ''; // Reset project selection

        const startTime = `${String(hour).padStart(2, '0')}:00`;
        modalDaySpan.textContent = day;
        eventStartTimeInput.value = startTime; // Store start time
        eventEndTimeInput.value = `${String(hour + 1).padStart(2, '0')}:00`; // Store end time
        modalDayIndexInput.value = dayIndex; // Store day index
        modal.style.display = 'block';
        eventTitleInput.focus(); // Focus on title input
        // Ensure project dropdown is up-to-date when modal opens
        loadProjects(); // Reload projects when modal opens
    }

    closeModalButton.onclick = function() {
        modal.style.display = 'none';
        modalEditEventIdInput.value = ''; // Clear edit ID on close
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
            modalEditEventIdInput.value = ''; // Clear edit ID on close
        }
    }

    saveEventButton.addEventListener('click', async () => {
        const title = eventTitleInput.value.trim();
        const start = eventStartTimeInput.value; // e.g., "09:00"
        const end = eventEndTimeInput.value; // e.g., "10:00"
        const projectId = eventProjectSelect.value; // Get selected project ID
        const dayIndex = parseInt(modalDayIndexInput.value); // e.g., 0 for Sunday

        if (!title) {
            alert('Please enter an event title.');
            return;
        }

        if (!projectId) {
            alert('Please select a project.');
            return;
        }

        // --- Time Validation ---
        const startMinutes = timeToMinutes(start);
        const endMinutes = timeToMinutes(end);

        if (startMinutes >= endMinutes) {
            alert('End time must be after start time.');
            return;
        }

        // Basic event object - adjust structure as needed
        const newEvent = {
            title: title,
            dayIndex: dayIndex, // 0 = Sun, 1 = Mon, ...
            start: start,       // e.g., "09:00"
            end: end,           // e.g., "10:00"
            projectId: projectId, // Add project ID
        };

        console.log("Saving event:", newEvent);

         // --- Send event data to backend ---
        const eventIdToUpdate = modalEditEventIdInput.value;
        const isEditing = !!eventIdToUpdate;
        const url = isEditing ? `/api/events/${eventIdToUpdate}` : '/api/events';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newEvent),
            });
            if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status}`);
             }
            const result = await response.json();
            console.log(isEditing ? 'Event updated:' : 'Event saved:', result);

             // Success! Close modal and reload events to show the new one
             modalEditEventIdInput.value = ''; // Clear edit ID
             modal.style.display = 'none';
             loadEvents(); // Refresh the calendar view

        } catch (error) {
            console.error('Error saving event:', error);
            alert('Failed to save event. See console for details.');
        }


    });

    // Helper function to convert time to minutes
    function timeToMinutes(time) {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // --- Function to Add Event Visually ---
    function addEventToCalendar(eventData) {
        console.log("Adding event to calendar:", eventData); // Log the data being added
        // Find the correct day column and time slot
        const dayColumn = gridContent.querySelector(`.day-column[data-day-index="${eventData.dayIndex}"]`);
        if (!dayColumn) {
            console.error("Could not find day column for index:", eventData.dayIndex);
            return;
        }

        const startMinutes = timeToMinutes(eventData.start);
        const endMinutes = timeToMinutes(eventData.end);
        const durationMinutes = endMinutes - startMinutes;

        const topPosition = (startMinutes / 60) * slotHeight; // Position in pixels
        const eventHeight = (durationMinutes / 60) * slotHeight; // Height in pixels

        const eventElement = document.createElement('div');
        eventElement.classList.add('event');
        eventElement.textContent = eventData.title;

        eventElement.style.top = `${topPosition}px`;
        eventElement.style.height = `${eventHeight}px`;
        eventElement.dataset.eventId = eventData.id; // Store event ID

        // Apply project color and ensure text readability
        // *** Check if event.projectColor exists before applying ***
        if (eventData.projectColor) {
            console.log('Rendering event:', eventData.title, 'with project color:', eventData.projectColor); // DEBUG
            eventElement.style.backgroundColor = eventData.projectColor;
            eventElement.style.color = getContrastYIQ(eventData.projectColor); // Adjust text color
        } else {
            console.warn('Event has no project color:', eventData.title); // DEBUG
            // Keep default blue or set another default if needed
        }

        dayColumn.appendChild(eventElement);

        // --- Add Click Listener for Editing ---
        eventElement.addEventListener('click', () => openEditEventModal(eventData.id));
    }

    // --- Function to Open Modal for Editing Existing Event ---
    function openEditEventModal(eventId) {
        const eventData = currentEvents[eventId];
        if (!eventData) {
            console.error("Event data not found for ID:", eventId);
            alert("Could not find event details to edit.");
            return;
        }

        console.log("Editing event:", eventData);

        // Populate modal fields
        modalTitleElement.textContent = 'Edit Event'; // Set title for editing
        modalEditEventIdInput.value = eventData.id;
        eventTitleInput.value = eventData.title;
        eventProjectSelect.value = eventData.projectId;
        eventStartTimeInput.value = eventData.start;
        eventEndTimeInput.value = eventData.end;
        modalDaySpan.textContent = days[eventData.dayIndex]; // Show day name
        modalDayIndexInput.value = eventData.dayIndex; // Store day index (may not be needed for update if day doesn't change)

        modal.style.display = 'block';
        eventTitleInput.focus();
    }

    // --- Project Handling Functions ---
    async function loadProjects() {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const projects = await response.json();
            console.log('Fetched projects:', projects); // DEBUG: Log fetched projects
            renderProjects(projects); // Update UI
            return projects; // Return projects for use elsewhere if needed
        } catch (error) {
            console.error('Error loading projects:', error);
            projectListUl.innerHTML = '<li>Error loading projects</li>'; // Show error in UI
        }
    }

    function renderProjects(projects) {
        projectListUl.innerHTML = ''; // Clear existing list
        eventProjectSelect.innerHTML = '<option value="">-- Select Project --</option>'; // Clear and add default option

        if (projects.length === 0) {
            projectListUl.innerHTML = '<li>No projects yet.</li>';
        }

        projects.forEach(project => {
            // Add to sidebar list
            const li = document.createElement('li');
            li.dataset.projectId = project.id; // Store ID if needed later

            // Add color indicator
            const colorIndicator = document.createElement('span');
            colorIndicator.classList.add('project-color-indicator');
            // *** Check if project.color exists before applying ***
            if (project.color) {
                console.log('Rendering project:', project.name, 'with color:', project.color); // DEBUG
                colorIndicator.style.backgroundColor = project.color;
            } else {
                console.warn('Project has no color:', project.name); // DEBUG
                colorIndicator.style.backgroundColor = '#ccc'; // Default color if missing
            }
            li.appendChild(colorIndicator);
            li.appendChild(document.createTextNode(project.name)); // Append project name text AFTER indicator

            projectListUl.appendChild(li);

            // Add to modal dropdown
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            eventProjectSelect.appendChild(option);
        });
    }

    addProjectButton.addEventListener('click', async () => {
        const projectName = newProjectNameInput.value.trim();
        if (!projectName) {
            alert('Please enter a project name.');
            return;
        }

        try {
            const response = await fetch('/api/projects', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: projectName }),
            });

            const result = await response.json(); // Always parse JSON to check status

            if (!response.ok) {
                // Use error message from backend if available
                throw new Error(result.message || `HTTP error! status: ${response.status}`);
            }

            console.log('Project added:', result);
            // No need to call loadProjects() again, just add the new one
             // 1. Add to sidebar list
             if (projectListUl.querySelector('li').textContent === 'No projects yet.') {
                 projectListUl.innerHTML = ''; // Clear the placeholder message
             }
            const li = document.createElement('li');
            li.textContent = result.project.name;
            li.dataset.projectId = result.project.id;

            // Add color indicator
            const colorIndicator = document.createElement('span');
            colorIndicator.classList.add('project-color-indicator');
            // *** Check if project.color exists before applying ***
            if (result.project.color) {
                console.log('Rendering project:', result.project.name, 'with color:', result.project.color); // DEBUG
                colorIndicator.style.backgroundColor = result.project.color;
            } else {
                console.warn('Project has no color:', result.project.name); // DEBUG
                colorIndicator.style.backgroundColor = '#ccc'; // Default color if missing
            }
            li.appendChild(colorIndicator);

            projectListUl.appendChild(li);

             // 2. Add to modal dropdown
            const option = document.createElement('option');
            option.value = result.project.id;
            option.textContent = result.project.name;
            eventProjectSelect.appendChild(option);

            newProjectNameInput.value = ''; // Clear input field

        } catch (error) {
            console.error('Error adding project:', error);
            alert(`Failed to add project: ${error.message}`);
        }
    });

    // --- Load Existing Events on Page Load ---
    async function loadEvents() {
        try {
            const response = await fetch('/api/events');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const events = await response.json();

            // Clear existing events from grid and local store
            gridContent.querySelectorAll('.event').forEach(e => e.remove());
            currentEvents = {}; // Clear the local store

            // Populate local store and add events to calendar
            events.forEach(event => {
                currentEvents[event.id] = event; // Store by ID
                addEventToCalendar(event);
            });
        } catch (error) {
            console.error('Error loading events:', error);
            // Optionally display a message to the user
        }
    }

    // --- Export CSV Logic ---
     exportButton.addEventListener('click', () => {
         // Trigger download by redirecting to the export URL
         window.location.href = '/api/export/csv';
     });

    loadProjects(); // Initial load of projects

    // Initial load of events when the page is ready
    loadEvents();

});
