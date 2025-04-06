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
    const modalTimeSlotSpan = document.getElementById('modal-time-slot');
    const modalDaySpan = document.getElementById('modal-day');
    const modalStartTimeInput = document.getElementById('modal-start-time');
    const modalDayIndexInput = document.getElementById('modal-day-index');

    // --- Export Button ---
    const exportButton = document.getElementById('export-csv');


    // --- Generate Time Axis Labels ---
    for (let i = 0; i < hours; i++) {
        const timeLabel = document.createElement('div');
        timeLabel.classList.add('time-label');
        timeLabel.textContent = `${String(i).padStart(2, '0')}:00`; // Format as HH:00
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
        const startTime = `${String(hour).padStart(2, '0')}:00`;
        modalDaySpan.textContent = day;
        modalTimeSlotSpan.textContent = `${startTime} - ${String(hour + 1).padStart(2, '0')}:00`; // Simple 1-hour slot
        modalStartTimeInput.value = startTime; // Store start time
        modalDayIndexInput.value = dayIndex; // Store day index
        eventTitleInput.value = ''; // Clear previous title
        modal.style.display = 'block';
        eventTitleInput.focus(); // Focus on title input
        // Ensure project dropdown is up-to-date when modal opens
        loadProjects(); // Reload projects when modal opens
    }

    closeModalButton.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    saveEventButton.addEventListener('click', async () => {
        const title = eventTitleInput.value.trim();
        const start = modalStartTimeInput.value; // e.g., "09:00"
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

        // Basic event object - adjust structure as needed
        const newEvent = {
            title: title,
            dayIndex: dayIndex, // 0 = Sun, 1 = Mon, ...
            start: start,       // e.g., "09:00"
            projectId: projectId, // Add project ID
            // Assuming 1-hour duration for simplicity now
            end: `${String(parseInt(start.split(':')[0]) + 1).padStart(2, '0')}:00`
        };

        console.log("Saving event:", newEvent);

         // --- Send event data to backend ---
        try {
            const response = await fetch('/api/events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(newEvent),
            });
            if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status}`);
             }
            const result = await response.json();
            console.log('Event saved:', result);

             // Add event visually to the calendar *after* successful save
            addEventToCalendar(newEvent);

            modal.style.display = 'none'; // Close modal on success
        } catch (error) {
            console.error('Error saving event:', error);
            alert('Failed to save event. See console for details.');
        }


    });

    // --- Function to Add Event Visually ---
    function addEventToCalendar(eventData) {
        console.log("Adding event to calendar:", eventData); // Log the data being added
        // Find the correct day column and time slot
        const dayColumn = gridContent.querySelector(`.day-column[data-day-index="${eventData.dayIndex}"]`);
        if (!dayColumn) {
            console.error("Could not find day column for index:", eventData.dayIndex);
            return;
        }

        const startHour = parseInt(eventData.start.split(':')[0]);
        // Assuming end hour calculation might be needed for height, but simple for now
        // const endHour = parseInt(eventData.end.split(':')[0]);
        // const duration = endHour - startHour; // Duration in hours

        const eventElement = document.createElement('div');
        eventElement.classList.add('event');
        eventElement.textContent = eventData.title;

        // --- Calculate position ---
        // Position based on start hour
        const topPosition = startHour * slotHeight; // Pixels from the top of the column
        // Height based on duration (assuming 1 hour for now)
        const eventHeight = slotHeight; // Simple 1-hour height

        eventElement.style.top = `${topPosition}px`;
        eventElement.style.height = `${eventHeight}px`;
        // Optionally add data attributes to the element if needed later
        eventElement.dataset.eventId = eventData.id || Date.now(); // Use backend ID or timestamp

        dayColumn.appendChild(eventElement);
    }

    // --- Project Handling Functions ---
    async function loadProjects() {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const projects = await response.json();
            console.log("Loaded projects:", projects);
            renderProjects(projects); // Update UI
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
            li.textContent = project.name;
            li.dataset.projectId = project.id; // Store ID if needed later
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
            if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status}`);
             }
            const events = await response.json();
            console.log("Loaded events:", events);
            events.forEach(event => addEventToCalendar(event));
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
