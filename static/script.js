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

// --- IndexedDB Initialization with Dexie.js ---
// Database: calendarDB, Table: events
const db = new Dexie('calendarDB');
db.version(1).stores({
    events: 'id,title,dayIndex,date,start,end,projectId' // id is primary key
});
// --- End IndexedDB Init ---

document.addEventListener('DOMContentLoaded', function() {
    const gridContent = document.querySelector('.grid-content');
    const timeAxis = document.querySelector('.time-axis');
    // Sidebar elements
    const projectListUl = document.getElementById('project-list');
    const newProjectNameInput = document.getElementById('new-project-name');
    const addProjectButton = document.getElementById('add-project-button');

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // --- Drag-and-Drop Event Creation State ---
    let isDraggingEvent = false;         // True if user is dragging to create event
    let dragStartSlot = null;            // DOM element of the slot where drag started
    let dragEndSlot = null;              // DOM element of the slot where drag ends
    let dragStartInfo = null;            // {dayIndex, hour, mins} at drag start
    let dragEndInfo = null;              // {dayIndex, hour, mins} at drag end
    // These will be used for drag-and-drop event creation logic


    // --- Drag-and-Drop Visual Feedback Helpers ---
    function highlightDragRange() {
        clearDragHighlights();
        if (!dragStartSlot || !dragEndSlot) return;
        // Get all slot-quarters in the grid
        const allSlots = Array.from(document.querySelectorAll('.slot-quarter'));
        // Find indices of start and end
        const startIdx = allSlots.indexOf(dragStartSlot);
        const endIdx = allSlots.indexOf(dragEndSlot);
        if (startIdx === -1 || endIdx === -1) return;
        // Get range (either direction)
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        for (let i = from; i <= to; i++) {
            allSlots[i].classList.add('drag-select');
        }
    }
    function clearDragHighlights() {
        document.querySelectorAll('.slot-quarter.drag-select').forEach(el => el.classList.remove('drag-select'));
    }

    // Step 1: Attach handler to 'Today' button
    const todayBtn = document.querySelector('.calendar-nav-today');
    if (todayBtn) {
        todayBtn.addEventListener('click', function() {
            console.log('[Today Button] Clicked: will jump to week containing today');
            // Step 2: Calculate start of this week (Sunday as start)
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setHours(0,0,0,0); // Midnight
            weekStart.setDate(now.getDate() - now.getDay()); // Go back to Sunday
            // Update global state
            currentWeekStart = weekStart;
            console.log('[Today Button] Calculated weekStart:', weekStart);
            // Step 3: re-render calendar for new week
            setCalendarHeaderDates();
            renderCalendarGrid();
            loadEvents();
            console.log('[Today Button] Calendar re-rendered for week containing today');
        });
    }
    const hours = 24; // 24 hours a day
    const slotHeight = 60; // Matches CSS: height of .time-slot
    const timeAxisWidth = 60; // Width of the time axis in pixels

    // Store column width calculation for reuse
    let dayColumnWidth = 0;
    function calculateDayColumnWidth() {
        const gridWidth = gridContent.offsetWidth;
        const dayColumnsWidth = gridWidth - timeAxisWidth; // timeAxisWidth defined earlier
        dayColumnWidth = dayColumnsWidth / days.length;
    }

    // --- Modal Elements ---
    const modal = document.getElementById('event-modal');
    const closeModalButton = document.querySelector('.close-button');
    const saveEventButton = document.getElementById('save-event');
    const eventProjectSelect = document.getElementById('event-project'); // Project dropdown
    const eventTitleInput = document.getElementById('event-title');
    const eventStartTimeInput = document.getElementById('event-start-time'); // New input
    const eventEndTimeInput = document.getElementById('event-end-time');   // New input

    // --- Settings Elements ---
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.querySelector('.close-settings');
    const defaultDurationInput = document.getElementById('default-duration');
    const saveSettingsBtn = document.getElementById('save-settings');

    // --- Settings Logic ---
    function getDefaultDuration() {
        const val = localStorage.getItem('defaultEventDuration');
        return val ? parseInt(val) : 60;
    }
    function setDefaultDuration(val) {
        localStorage.setItem('defaultEventDuration', val);
    }
    // Open settings modal
    settingsBtn.onclick = function() {
        defaultDurationInput.value = getDefaultDuration();
        settingsModal.style.display = 'block';
    };
    // Close settings modal
    closeSettingsBtn.onclick = function() {
        settingsModal.style.display = 'none';
    };
    // Save settings
    saveSettingsBtn.onclick = function() {
        let val = parseInt(defaultDurationInput.value);
        if (isNaN(val) || val < 1 || val > 240) val = 60;
        setDefaultDuration(val);
        settingsModal.style.display = 'none';
    };
    // Close modal if background clicked
    window.addEventListener('click', function(event) {
        if (event.target === settingsModal) settingsModal.style.display = 'none';
    });
    const modalDaySpan = document.getElementById('modal-day');
    const modalDayIndexInput = document.getElementById('modal-day-index');
    const modalEditEventIdInput = document.getElementById('modal-edit-event-id'); // For editing
    const modalTitleElement = document.getElementById('modal-title'); // Modal title H2

    // --- Export Button ---
    const exportButton = document.getElementById('export-csv');


    // --- Week State ---
    // Track the start of the currently displayed week (Sunday)
    let currentWeekStart = getStartOfWeek(new Date());

    function getStartOfWeek(date) {
        // Returns a new Date object set to the most recent Sunday
        const d = new Date(date);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - d.getDay());
        return d;
    }

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

    // --- Set Dates in Calendar Header ---
    function setCalendarHeaderDates() {
        // Use currentWeekStart as the base
        // Remove highlight from all header-col elements
        const allHeaderCols = document.querySelectorAll('.header-col');
        allHeaderCols.forEach(col => col.classList.remove('today-header'));
        // Set date text and highlight header-col for today if in week
        const today = new Date();
        today.setHours(0,0,0,0);
        for (let i = 0; i < 7; i++) {
            const d = new Date(currentWeekStart);
            d.setDate(currentWeekStart.getDate() + i);
            d.setHours(0,0,0,0);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const label = document.getElementById('header-date-' + i);
            if (label) {
                label.textContent = `${yyyy}-${mm}-${dd}`;
                // Highlight entire header-col if this is today
                if (d.getTime() === today.getTime()) {
                    const headerCol = label.closest('.header-col');
                    if (headerCol) headerCol.classList.add('today-header');
                }
            }
        }
    }
    setCalendarHeaderDates();

    // --- Render Calendar Grid ---
    function renderCalendarGrid() {
        // Remove any existing now-line
        const oldNowLine = document.querySelector('.now-line');
        if (oldNowLine) oldNowLine.remove();

        // --- Step 1: Debug if today is in the displayed week ---
        const now = new Date();
        const todayIndex = now.getDay();
        const weekStart = new Date(currentWeekStart);
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const isTodayInWeek = (now >= weekStart && now <= weekEnd);
        console.log('[NOW LINE STEP 1] now:', now, 'currentWeekStart:', weekStart, 'weekEnd:', weekEnd, 'isTodayInWeek:', isTodayInWeek);

        // --- (Grid rendering happens here, unchanged) ---


        // --- Now-line logic runs AFTER grid rendering (deferred with setTimeout) ---
        if (isTodayInWeek) {
            console.log('[NOW LINE DEFER] Deferring now-line logic to after DOM update');
            setTimeout(() => {
                const grid = document.querySelector('.grid-content');
                const dayColumns = grid.querySelectorAll('.day-column');
                const colIndexes = Array.from(dayColumns).map(col => col.dataset.dayIndex);
                console.log('[NOW LINE STEP 2] (deferred) Number of dayColumns:', dayColumns.length, 'todayIndex:', todayIndex, 'colIndexes:', colIndexes);
                if (dayColumns && dayColumns[todayIndex]) {
                    const todayCol = dayColumns[todayIndex];
                    // Calculate vertical offset: minutes since midnight / (24*60) * grid height
                    const mins = now.getHours() * 60 + now.getMinutes();
                    const gridHeight = todayCol.offsetHeight;
                    const y = (mins / (24 * 60)) * gridHeight;
                    // Create the now line
                    const nowLine = document.createElement('div');
                    nowLine.className = 'now-line';
                    nowLine.style.position = 'absolute';
                    nowLine.style.left = '0';
                    nowLine.style.right = '0';
                    nowLine.style.top = `${y}px`;
                    nowLine.style.pointerEvents = 'none'; // Ensure it doesn't interfere with clicks
                    // Debug: log stacking context
                    console.log('[NOW LINE STEP 2] (deferred) Drawing now-line at y:', y, 'gridHeight:', gridHeight, 'mins:', mins);
                    // Ensure day column is relative
                    todayCol.style.position = 'relative';
                    todayCol.appendChild(nowLine);
                    // Debug: check z-index
                    console.log('[NOW LINE STEP 2] (deferred) Appended now-line to dayCol. nowLine z-index:', getComputedStyle(nowLine).zIndex);
                } else {
                    console.log('[NOW LINE STEP 2] (deferred) No valid dayColumn found for todayIndex');
                }
            }, 0);
        }

        console.log('renderCalendarGrid called');
        if (!gridContent) {
            console.error('gridContent not found!');
            return;
        }
        console.log('days:', days, 'hours:', hours);

        // Clear existing grid
        while (gridContent.firstChild) {
            gridContent.removeChild(gridContent.firstChild);
        }
        // Insert .time-axis-spacer as the first child of .grid-content for alignment
        const spacer = document.createElement('div');
        spacer.className = 'time-axis-spacer';
        gridContent.appendChild(spacer);

        days.forEach((day, dayIndex) => {
            const dayColumn = document.createElement('div');
            dayColumn.classList.add('day-column');
            dayColumn.dataset.dayIndex = dayIndex;
            // Add a data-date attribute for event rendering
            const colDateObj = new Date(currentWeekStart);
            colDateObj.setDate(currentWeekStart.getDate() + dayIndex);
            const yyyy = colDateObj.getFullYear();
            const mm = String(colDateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(colDateObj.getDate()).padStart(2, '0');
            dayColumn.dataset.date = `${yyyy}-${mm}-${dd}`;

            for (let hour = 0; hour < hours; hour++) {
                // Create parent time-slot for each hour
                const parentSlot = document.createElement('div');
                parentSlot.classList.add('time-slot');
                parentSlot.dataset.hour = hour;
                parentSlot.dataset.day = day;
                parentSlot.dataset.dayIndex = dayIndex;
                parentSlot.dataset.time = `${String(hour).padStart(2, '0')}:00`;

                // Create 4 child slot-quarter divs for :00, :15, :30, :45
                for (let quarter = 0; quarter < 4; quarter++) {
                    const mins = quarter * 15;
                    const slotQuarter = document.createElement('div');
                    slotQuarter.classList.add('slot-quarter');
                    slotQuarter.classList.add(`slot-quarter-${mins}`); // e.g., slot-quarter-00, slot-quarter-15
                    slotQuarter.dataset.hour = hour;
                    slotQuarter.dataset.day = day;
                    slotQuarter.dataset.dayIndex = dayIndex;
                    slotQuarter.dataset.time = `${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

                    // Attach click handler to open modal with correct time
                    slotQuarter.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent bubbling to parent
                        openAddEventModalWithMinutes(day, dayIndex, hour, mins);
                    });

                    // --- Drag-and-Drop Event Creation Handlers ---
                    slotQuarter.addEventListener('mousedown', (e) => {
                        isDraggingEvent = true;
                        dragStartSlot = slotQuarter;
                        dragEndSlot = slotQuarter;
                        dragStartInfo = {
                            dayIndex: dayIndex,
                            hour: hour,
                            mins: mins
                        };
                        dragEndInfo = {
                            dayIndex: dayIndex,
                            hour: hour,
                            mins: mins
                        };
                        highlightDragRange();
                    });
                    slotQuarter.addEventListener('mouseenter', (e) => {
                        if (isDraggingEvent) {
                            dragEndSlot = slotQuarter;
                            dragEndInfo = {
                                dayIndex: dayIndex,
                                hour: hour,
                                mins: mins
                            };
                            highlightDragRange();
                        }
                    });
                    // Mouseup on document to finish drag
                    document.addEventListener('mouseup', (e) => {
                        if (isDraggingEvent) {
                            isDraggingEvent = false;
                            // Compute the selected range (start and end slot info)
                            if (dragStartInfo && dragEndInfo) {
                                // Sort start and end
                                let a = dragStartInfo;
                                let b = dragEndInfo;
                                // Compare by dayIndex, then hour, then mins
                                const isEarlier = (x, y) =>
                                    x.dayIndex < y.dayIndex ||
                                    (x.dayIndex === y.dayIndex && x.hour < y.hour) ||
                                    (x.dayIndex === y.dayIndex && x.hour === y.hour && x.mins <= y.mins);
                                let start, end;
                                if (isEarlier(a, b)) {
                                    start = a; end = b;
                                } else {
                                    start = b; end = a;
                                }
                                // Open modal with pre-filled times
                                // Use the day and dayIndex from start, and pass start/end times
                                openAddEventModalWithMinutes(
                                    days[start.dayIndex],
                                    start.dayIndex,
                                    start.hour,
                                    start.mins
                                );
                                // Compute end time: last slot + 15 mins
                                let endMinutes = end.hour * 60 + end.mins + 15;
                                let endHour = Math.floor(endMinutes / 60);
                                let endMins = endMinutes % 60;
                                eventEndTimeInput.value = `${String(endHour).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
                            }
                            clearDragHighlights();
                            dragStartSlot = null;
                            dragEndSlot = null;
                            dragStartInfo = null;
                            dragEndInfo = null;
                        }
                    });

                    parentSlot.appendChild(slotQuarter);
                }
                dayColumn.appendChild(parentSlot);
            }
            gridContent.appendChild(dayColumn);
        });
    }

    // Initial render
    renderCalendarGrid();

    // --- Keep the now line updated every minute ---
    setInterval(() => {
        renderCalendarGrid();
        loadEvents(); // Ensure events are reloaded after grid re-render (now-line update)
    }, 60000); // every minute

    // --- Week Navigation Buttons ---
    const navRightBtn = document.querySelector('.calendar-nav-right');
    const navLeftBtn = document.querySelector('.calendar-nav-left');
    if (navRightBtn) {
        navRightBtn.addEventListener('click', function() {
            // Move to next week
            currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            setCalendarHeaderDates();
            renderCalendarGrid();
            loadEvents();
        });
    }
    if (navLeftBtn) {
        navLeftBtn.addEventListener('click', function() {
            // Move to previous week
            currentWeekStart.setDate(currentWeekStart.getDate() - 7);
            setCalendarHeaderDates();
            renderCalendarGrid();
            loadEvents();
        });
    }

// --- Load Existing Events on Page Load ---
async function loadEvents() {
    try {
        // Load all events from IndexedDB (Dexie.js)
        const events = await db.events.toArray();
        // Clear existing events from grid and local store
        gridContent.querySelectorAll('.event').forEach(e => e.remove());
        currentEvents = {};
        // Step 1: Group events by day for overlap processing
        const eventsByDay = {};
        events.forEach(event => {
            currentEvents[event.id] = event;
            if (!eventsByDay[event.date]) eventsByDay[event.date] = [];
            eventsByDay[event.date].push(event);
        });
        // Step 2: Detect overlap groups for each day
        Object.entries(eventsByDay).forEach(([date, dayEvents]) => {
            // Sort events by start time
            const sorted = dayEvents.slice().sort((a, b) => a.start.localeCompare(b.start));
            const overlapGroups = [];
            let group = [];
            let groupEnd = null;
            sorted.forEach(event => {
                const eventStart = event.start;
                const eventEnd = event.end;
                if (!group.length) {
                    group.push(event);
                    groupEnd = eventEnd;
                } else if (eventStart < groupEnd) {
                    group.push(event);
                    if (eventEnd > groupEnd) groupEnd = eventEnd;
                } else {
                    overlapGroups.push(group);
                    group = [event];
                    groupEnd = eventEnd;
                }
            });
            if (group.length) overlapGroups.push(group);
            console.log(`[Overlap] Overlap groups for ${date}:`, overlapGroups);

            // Step 3: Assign overlapColumn and overlapColumnCount for each event in each group
            overlapGroups.forEach((grp, groupIdx) => {
                const colCount = grp.length;
                grp.forEach((event, idx) => {
                    event.overlapColumn = idx;
                    event.overlapColumnCount = colCount;
                    // Log assignment for debugging
                    console.log(`[Overlap] ${date} - Event "${event.title}": column ${idx} of ${colCount}`);
                });
            });
        });

        // After assigning overlap properties, render events
        Object.values(eventsByDay).forEach(dayEvents => {
            dayEvents.forEach(event => addEventToCalendar(event));
        });
        // Still log the groups by day for debugging
        console.log('[Overlap] Events grouped by day:', eventsByDay);
        console.log('[IndexedDB] Loaded events from local DB:', events.length);
    } catch (error) {
        console.error('Error loading events from IndexedDB:', error);
        // Optionally display a message to the user
    }
}

    // Function to open modal specifically from a grid click (pre-filled times)
    function openAddEventModalFromGridClick(dayIndex, startTime, endTime) {
        modalTitleElement.textContent = 'Add New Event'; // Set title
        modalForm.reset(); // Clear previous entries
        modalEditEventIdInput.value = ''; // Ensure no edit ID is lingering
        // Populate fields
    // Populate fields
    modalDaySelect.value = days[dayIndex];       // Corrected: Use the select element
    modalStartTimeInput.value = startTime;      // Corrected: Use the time input
    modalEndTimeInput.value = endTime;        // Corrected: Use the time input
        modalDaySelect.value = days[dayIndex];       // Corrected: Use the select element
        modalStartTimeInput.value = startTime;      // Corrected: Use the time input
        modalEndTimeInput.value = endTime;        // Corrected: Use the time input
        modalDescriptionInput.value = 'New Event';  // Corrected: Use the description input

        modal.style.display = 'block'; // Show the modal
        modalDescriptionInput.focus(); // Focus on description for quick typing
    }

    // --- Modal Logic ---
    function openAddEventModalWithMinutes(day, dayIndex, hour, mins) {
        // Hide the delete button when adding
        const deleteButton = document.getElementById('delete-event');
        if (deleteButton) deleteButton.style.display = 'none';
        modalTitleElement.textContent = 'Add New Event';
        modalEditEventIdInput.value = '';
        eventTitleInput.value = '';
        eventProjectSelect.value = '';

        // Set day label and index
        if (modalDaySpan) modalDaySpan.textContent = day;
        if (modalDayIndexInput) modalDayIndexInput.value = dayIndex;

        // Compute start and end time
        const startTime = `${String(hour).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        eventStartTimeInput.value = startTime;
        // Use settings for default duration
        const duration = getDefaultDuration();
        let startMinutes = hour * 60 + mins;
        let endMinutes = startMinutes + duration;
        let endHour = Math.floor(endMinutes / 60);
        let endMinute = endMinutes % 60;
        eventEndTimeInput.value = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

        modal.style.display = 'block';
        eventTitleInput.focus();
        loadProjects();
    }

    function openAddEventModal(day, dayIndex, hour) {
    // Hide the delete button when adding
    const deleteButton = document.getElementById('delete-event');
    if (deleteButton) deleteButton.style.display = 'none';
        modalTitleElement.textContent = 'Add New Event'; // Set title for adding
        modalEditEventIdInput.value = ''; // Ensure edit ID is clear
        eventTitleInput.value = ''; // Clear previous title
        eventProjectSelect.value = ''; // Reset project selection

        const startTime = `${String(hour).padStart(2, '0')}:00`;
        modalDaySpan.textContent = day;
        eventStartTimeInput.value = startTime; // Store start time
        // Use settings for default duration
        const duration = getDefaultDuration();
        let endHour = hour, endMinute = 0;
        const startParts = startTime.split(':');
        let startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        let endMinutes = startMinutes + duration;
        endHour = Math.floor(endMinutes / 60);
        endMinute = endMinutes % 60;
        eventEndTimeInput.value = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
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

    // Delete event logic
    const deleteButton = document.getElementById('delete-event');
    if (deleteButton) {
        deleteButton.onclick = async function() {
            const eventId = modalEditEventIdInput.value;
            if (!eventId) return;
            if (!confirm('Are you sure you want to delete this event?')) return;

            try {
                // Delete from IndexedDB
                await db.events.delete(eventId);
                delete currentEvents[eventId];
                loadEvents();
                modal.style.display = 'none';
                modalEditEventIdInput.value = '';
            } catch (err) {
                alert('Error deleting event locally.');
            }
        };
    }

    // Save event logic
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

        // If no project selected, assign to 'Others' by default
        let finalProjectId = projectId || 'others-project-id';

        // --- Time Validation ---
        const startMinutes = timeToMinutes(start);
        const endMinutes = timeToMinutes(end);

        if (startMinutes >= endMinutes) {
            alert('End time must be after start time.');
            return;
        }

        // Compute the date string for this event
        const eventDateObj = new Date(currentWeekStart);
        eventDateObj.setDate(currentWeekStart.getDate() + dayIndex);
        const yyyy = eventDateObj.getFullYear();
        const mm = String(eventDateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(eventDateObj.getDate()).padStart(2, '0');
        const date = `${yyyy}-${mm}-${dd}`;
        // Basic event object - now includes date
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            alert('Could not determine event date.');
            return;
        }
        // Find the color for the selected project
        let projectColor = '#4a90e2'; // Default blue if not found
        if (window.loadedProjects && Array.isArray(window.loadedProjects)) {
            const proj = window.loadedProjects.find(p => p.id === finalProjectId);
            if (proj && proj.color) {
                projectColor = proj.color;
            }
        }
        const newEvent = {
            title: title,
            dayIndex: dayIndex, // 0 = Sun, 1 = Mon, ...
            date: date,         // yyyy-mm-dd
            start: start,       // e.g., "09:00"
            end: end,           // e.g., "10:00"
            projectId: finalProjectId, // Use final project ID (defaults to 'Others')
            projectColor: projectColor
        };

        // If editing, preserve the original event ID and date if possible
        const eventIdToUpdate = modalEditEventIdInput.value;
        const isEditing = !!eventIdToUpdate;
        if (isEditing && currentEvents[eventIdToUpdate] && currentEvents[eventIdToUpdate].date) {
            newEvent.date = currentEvents[eventIdToUpdate].date;
        }

        console.log("Saving event:", newEvent);

        try {
            // If editing, preserve the original event ID
            if (isEditing) {
                newEvent.id = eventIdToUpdate;
            } else {
                // Assign a unique ID for new events (timestamp-based)
                newEvent.id = Date.now().toString();
            }
            // Save or update the event in IndexedDB
            await db.events.put(newEvent);
            console.log(isEditing ? 'Event updated locally:' : 'Event saved locally:', newEvent);

            // Success! Close modal and reload events to show the new one
            modalEditEventIdInput.value = '';
            modal.style.display = 'none';
            loadEvents(); // Refresh the calendar view
        } catch (error) {
            console.error('Error saving event to IndexedDB:', error);
            alert('Failed to save event locally. See console for details.');
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
    let dayColumn = null;
    if (eventData.date) {
        // Find column by date attribute if present
        dayColumn = gridContent.querySelector(`.day-column[data-date="${eventData.date}"]`);
    } else {
        // Fallback to dayIndex for legacy events
        dayColumn = gridContent.querySelector(`.day-column[data-day-index="${eventData.dayIndex}"]`);
    }
    if (!dayColumn) {
        console.error("Could not find day column for event:", eventData);
        return;
    }

    const startMinutes = timeToMinutes(eventData.start);
    const endMinutes = timeToMinutes(eventData.end);
    const durationMinutes = endMinutes - startMinutes;

    const topPosition = (startMinutes / 60) * slotHeight; // Position in pixels
    const eventHeight = (durationMinutes / 60) * slotHeight; // Height in pixels

    // --- Step 4: Calculate left and width for overlap rendering ---
    let left = 0;
    let width = '100%';
    if (
        typeof eventData.overlapColumn === 'number' &&
        typeof eventData.overlapColumnCount === 'number' &&
        eventData.overlapColumnCount > 1
    ) {
        // Calculate width and left position as a percentage
        width = (100 / eventData.overlapColumnCount) + '%';
        left = (100 / eventData.overlapColumnCount) * eventData.overlapColumn + '%';
    }

    const eventElement = document.createElement('div');
    eventElement.classList.add('event');
    eventElement.textContent = eventData.title;

    eventElement.style.top = `${topPosition}px`;
    eventElement.style.height = `${eventHeight}px`;
    eventElement.style.setProperty('--event-left', left);
    eventElement.style.setProperty('--event-width', width);
    eventElement.style.position = 'absolute';
    eventElement.dataset.eventId = eventData.id;

    // Apply project color and ensure text readability
    if (eventData.projectColor) {
        eventElement.style.backgroundColor = eventData.projectColor;
        eventElement.style.color = getContrastYIQ(eventData.projectColor);
    }

    dayColumn.appendChild(eventElement);

    // --- Add Click Listener for Editing ---
    eventElement.addEventListener('click', () => openEditEventModal(eventData.id));
}

    // Edit event logic
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
            window.loadedProjects = projects; // Make available globally for event saving
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

            // Add a space element before the color indicator
            const spaceElem = document.createElement('span');
            spaceElem.className = 'space-before-color';
            spaceElem.textContent = ' ';
            li.appendChild(spaceElem);
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


    exportButton.addEventListener('click', async () => {
        const csvRows = [];
        const headerRow = ['Date', 'Event ID', 'Title', 'Project', 'Start Time', 'End Time', 'Day'];
        csvRows.push(headerRow.map(f => `"${f}"`).join(','));

        // Build a map of projectId to project name for export
        let projectMap = {};
        if (window.loadedProjects && Array.isArray(window.loadedProjects)) {
            window.loadedProjects.forEach(proj => {
                projectMap[proj.id] = proj.name;
            });
        }
        Object.values(currentEvents).forEach(ev => {
            const row = [];
            row.push(`"${ev.date || ''}"`);
            row.push(`"${ev.id}"`);
            row.push(`"${ev.title}"`);
            row.push(`"${projectMap[ev.projectId] || ''}"`);
            row.push(`"${ev.start}"`);
            row.push(`"${ev.end}"`);
            row.push(`"${days[ev.dayIndex]}"`);
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\r\n');
        // Download CSV
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'toggl2_events_export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    loadProjects(); // Initial load of projects

    // Initial load of events when the page is ready
    loadEvents();

    // Calculate initial column width after rendering
    calculateDayColumnWidth();

    // Recalculate column width on window resize
    window.addEventListener('resize', calculateDayColumnWidth);

}); // End DOMContentLoaded
