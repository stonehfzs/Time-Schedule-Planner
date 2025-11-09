import { getGistData, saveGistData, verifyGistCredentials } from './services/gistService.js';

document.addEventListener('DOMContentLoaded', () => {
    const appState = {
        currentDate: new Date(),
        viewMode: 'month', // 'day', 'month', 'year'
        events: [],
        tasks: [],
        selectedDate: new Date(),
        editingEventId: null,
        isTaskSidebarVisible: true,
        gistPat: localStorage.getItem('gistPat'),
        gistId: localStorage.getItem('gistId'),
        isDataLoaded: false,
    };

    const colors = ['#0284c7', '#16a34a', '#ca8a04', '#c026d3', '#db2777', '#dc2626'];
    let selectedColor = colors[0];
    let modalGuests = [];
    let modalAttachments = [];

    // --- DOM Elements ---
    const headerText = document.getElementById('header-text');
    const viewContainer = document.getElementById('view-container');
    const viewSwitcher = document.getElementById('view-switcher');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const todayBtn = document.getElementById('today-btn');
    const toggleTasksBtn = document.getElementById('toggle-tasks-btn');
    const settingsBtn = document.getElementById('settings-btn');

    // Task Sidebar Elements
    const taskSidebar = document.getElementById('task-sidebar');
    const taskForm = document.getElementById('task-form');
    const taskInput = document.getElementById('task-input');
    const taskDueDateInput = document.getElementById('task-due-date-input');
    const taskList = document.getElementById('task-list');
    
    // Modal Elements
    const eventModal = document.getElementById('event-modal');
    const eventForm = document.getElementById('event-form');
    const modalTitle = document.getElementById('modal-title');
    const eventIdInput = document.getElementById('event-id');
    const eventTitleInput = document.getElementById('event-title');
    const eventDescriptionInput = document.getElementById('event-description');
    const eventLocationInput = document.getElementById('event-location');
    const eventOrganizationInput = document.getElementById('event-organization');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const eventRecurringInput = document.getElementById('event-recurring');
    const colorPicker = document.getElementById('color-picker');
    const modalError = document.getElementById('modal-error');
    const saveEventBtn = document.getElementById('save-event-btn');
    const deleteEventBtn = document.getElementById('delete-event-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const eventGuestInput = document.getElementById('event-guest-input');
    const addGuestBtn = document.getElementById('add-guest-btn');
    const guestList = document.getElementById('guest-list');
    const eventAttachmentInput = document.getElementById('event-attachment-input');
    const addAttachmentBtn = document.getElementById('add-attachment-btn');
    const attachmentList = document.getElementById('attachment-list');

    // Settings Modal Elements
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const gistPatInput = document.getElementById('gist-pat');
    const gistIdInput = document.getElementById('gist-id');
    const settingsError = document.getElementById('settings-error');
    const settingsSuccess = document.getElementById('settings-success');
    const settingsCancelBtn = document.getElementById('settings-cancel-btn');


    // --- State Management & Rendering ---

    const render = () => {
        if (!appState.isDataLoaded) {
            viewContainer.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500">Loading your schedule...</div>`;
            return;
        }
        viewContainer.style.opacity = '0';
        setTimeout(() => {
            updateHeader();
            renderTasks();
            updateTaskSidebarVisibility();
            switch (appState.viewMode) {
                case 'year':
                    renderYearView();
                    break;
                case 'month':
                    renderMonthView();
                    break;
                case 'day':
                    renderDayView();
                    break;
            }
            viewContainer.style.opacity = '1';
        }, 300);
    };

    const updateHeader = () => {
        switch (appState.viewMode) {
            case 'year':
                headerText.textContent = appState.currentDate.getFullYear();
                break;
            case 'month':
                headerText.textContent = appState.currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                break;
            case 'day':
                headerText.textContent = appState.currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                break;
        }

        document.querySelectorAll('#view-switcher button').forEach(btn => {
            if (btn.dataset.view === appState.viewMode) {
                btn.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
                btn.classList.remove('text-gray-600', 'dark:text-gray-300');
            } else {
                btn.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
                btn.classList.add('text-gray-600', 'dark:text-gray-300');
            }
        });
    };

    // --- View Rendering ---

    const renderYearView = () => {
        const year = appState.currentDate.getFullYear();
        const monthNames = Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('en-US', { month: 'long' }));
        const today = new Date();

        let html = `<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6"><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">`;
        
        monthNames.forEach((name, index) => {
            const isCurrentMonth = index === today.getMonth() && year === today.getFullYear();
            html += `
                <button
                    data-month="${index}"
                    class="month-btn p-4 sm:p-6 rounded-lg text-center font-semibold transition-all duration-200 ease-in-out transform hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${isCurrentMonth ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900'}"
                >
                    ${name}
                </button>
            `;
        });

        html += `</div></div>`;
        viewContainer.innerHTML = html;
    };

    const renderMonthView = () => {
        const date = appState.currentDate;
        const year = date.getFullYear();
        const month = date.getMonth();
        const today = new Date();
        today.setHours(0,0,0,0);

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const weekDayNames = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, i + 1).toLocaleString('en-US', { weekday: 'short' }));

        let html = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden h-full flex flex-col">
                <div class="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700">
                    ${weekDayNames.map(day => `<div class="py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">${day}</div>`).join('')}
                </div>
                <div class="grid grid-cols-7 grid-rows-6 flex-1">
        `;
        
        for (let i = 0; i < firstDayOfMonth; i++) {
            html += `<div class="border-r border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"></div>`;
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, month, day);
            const isTodayClass = currentDate.getTime() === today.getTime() ? 'bg-blue-600 text-white rounded-full h-7 w-7 flex items-center justify-center' : '';
            const dayEvents = getEventsForDate(currentDate);
            const dayTasks = getTasksForDate(currentDate);

            html += `
                <div class="day-cell relative p-2 border-r border-b border-gray-200 dark:border-gray-700 flex flex-col group hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer" data-date="${currentDate.toISOString()}">
                    <time datetime="${currentDate.toISOString()}" class="text-sm font-medium ${isTodayClass}">${day}</time>
                    ${dayTasks.length > 0 ? `<div class="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500" title="${dayTasks.length} task(s)"></div>` : ''}
                    <div class="mt-1 space-y-1 overflow-y-auto max-h-24">
                        ${dayEvents.slice(0, 2).map(event => `<div class="month-event text-xs px-1.5 py-0.5 rounded text-white cursor-move" draggable="true" data-event-id="${event.id}" style="background-color: ${event.color};">${event.title}</div>`).join('')}
                        ${dayEvents.length > 2 ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">+ ${dayEvents.length - 2} more</div>` : ''}
                    </div>
                    <button class="add-event-btn absolute bottom-2 right-2 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">+</button>
                </div>
            `;
        }

        html += `</div></div>`;
        viewContainer.innerHTML = html;
    };

    const renderDayView = () => {
        const date = appState.currentDate;
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const dayEvents = getEventsForDate(date);
        const dayTasks = getTasksForDate(date);

        const formatTime = (hour) => new Date(0,0,0,hour).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

        const taskHtml = dayTasks.map(task => `
            <div class="task-item flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">
                <div class="flex items-center">
                    <input type="checkbox" class="task-checkbox h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
                    <label class="ml-3 ${task.completed ? 'line-through text-gray-500' : ''}">${task.title}</label>
                </div>
                <button class="delete-task-btn text-gray-400 hover:text-red-500 font-bold text-lg" data-task-id="${task.id}" aria-label="Delete task">&times;</button>
            </div>
        `).join('');

        let html = `
            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-lg flex flex-col h-full">
                <div class="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold">${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                        <button id="day-add-event" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">Add Event</button>
                    </div>
                    <div>
                        <h4 class="font-semibold mb-2 text-gray-700 dark:text-gray-300">Tasks for Today</h4>
                        <div id="day-view-tasks" class="space-y-1">
                            ${dayTasks.length > 0 ? taskHtml : '<p class="text-sm text-gray-500">No tasks due today.</p>'}
                        </div>
                    </div>
                </div>
                <div class="flex-1 overflow-auto relative">
                    <div class="grid grid-cols-[auto,1fr] h-full" style="min-height: ${24 * 4}rem;">
                        <div class="pr-2 text-right text-xs text-gray-500 dark:text-gray-400">
                            ${hours.map(hour => `<div class="h-16 flex items-start justify-end -translate-y-2">${hour > 0 ? formatTime(hour) : ''}</div>`).join('')}
                        </div>
                        <div id="day-view-timeline" class="relative border-l border-gray-200 dark:border-gray-700">
                            ${hours.map(hour => `<div class="h-16 border-b border-gray-200 dark:border-gray-700"></div>`).join('')}
                            ${dayEvents.map(event => {
                                const start = new Date(event.start);
                                const end = new Date(event.end);
                                const top = (start.getHours() * 60 + start.getMinutes()) / (24 * 60) * 100;
                                const duration = (end.getTime() - start.getTime()) / (1000 * 60);
                                const height = (duration / (24 * 60)) * 100;
                                return `
                                    <div class="day-event absolute left-2 right-2 p-2 text-white rounded-lg shadow-md cursor-pointer overflow-hidden cursor-move" 
                                         style="top: ${top}%; height: ${Math.max(height, 2)}%; background-color: ${event.color};"
                                         data-event-id="${event.id}"
                                         draggable="true">
                                        <p class="font-bold text-sm">${event.title}</p>
                                        <p class="text-xs opacity-90">${start.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</p>
                                        ${event.location ? `<p class="text-xs opacity-80 mt-1 flex items-center"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>${event.location}</p>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        viewContainer.innerHTML = html;
        document.getElementById('day-add-event')?.addEventListener('click', () => openEventModal(date));

        document.getElementById('day-view-tasks').addEventListener('click', async e => {
            const checkbox = e.target.closest('.task-checkbox');
            if (checkbox) {
                const taskId = checkbox.dataset.taskId;
                const task = appState.tasks.find(t => t.id === taskId);
                if (task) {
                    task.completed = checkbox.checked;
                    await syncData();
                    render(); // Re-render to update styles
                }
            }

            const deleteBtn = e.target.closest('.delete-task-btn');
            if (deleteBtn) {
                const taskId = deleteBtn.dataset.taskId;
                appState.tasks = appState.tasks.filter(t => t.id !== taskId);
                await syncData();
                render();
            }
        });
    };


    // --- Data Sync Logic ---
    const syncData = async () => {
        if (appState.gistPat && appState.gistId) {
            await saveGistData({ events: appState.events, tasks: appState.tasks });
        }
    };

    // --- Event & Task Logic ---

    const getEventsForDate = (date) => {
        const dateString = date.toDateString();
        const dayOfWeek = date.getDay();
        const dayOfMonth = date.getDate();

        return appState.events.filter(event => {
            const eventStart = new Date(event.start);
            eventStart.setHours(0,0,0,0);

            if (event.recurring === 'none') {
                return new Date(event.start).toDateString() === dateString;
            }
            if (eventStart.getTime() > date.getTime()) return false;
            
            if (event.recurring === 'daily') {
                return true;
            }
            if (event.recurring === 'weekly') {
                return new Date(event.start).getDay() === dayOfWeek;
            }
            if (event.recurring === 'monthly') {
                return new Date(event.start).getDate() === dayOfMonth;
            }
            return false;
        }).sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    };

    const getTasksForDate = (date) => {
        const dateString = date.toISOString().split('T')[0];
        return appState.tasks.filter(task => task.dueDate === dateString);
    };

    const renderTasks = () => {
        const sortedTasks = [...appState.tasks].sort((a, b) => {
            if (a.completed && !b.completed) return 1;
            if (!a.completed && b.completed) return -1;
            const dateA = a.createdAt ? new Date(a.createdAt) : 0;
            const dateB = b.createdAt ? new Date(b.createdAt) : 0;
            return dateA - dateB;
        });

        taskList.innerHTML = sortedTasks.map(task => `
            <div class="task-item flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">
                <div class="flex items-center overflow-hidden">
                    <input type="checkbox" class="task-checkbox h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 flex-shrink-0" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
                    <div class="ml-3 truncate">
                        <label class="${task.completed ? 'line-through text-gray-500' : ''}">${task.title}</label>
                        ${task.dueDate ? `<p class="text-xs text-gray-400 dark:text-gray-500">${new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>` : ''}
                    </div>
                </div>
                <button class="delete-task-btn text-gray-400 hover:text-red-500 font-bold text-lg ml-2 flex-shrink-0" data-task-id="${task.id}" aria-label="Delete task">&times;</button>
            </div>
        `).join('');
    };
    
    const updateTaskSidebarVisibility = () => {
        if (appState.isTaskSidebarVisible) {
            taskSidebar.classList.remove('hidden');
            toggleTasksBtn.classList.add('bg-blue-100', 'dark:bg-blue-900');
        } else {
            taskSidebar.classList.add('hidden');
            toggleTasksBtn.classList.remove('bg-blue-100', 'dark:bg-blue-900');
        }
    };
    
    // --- Modal Logic ---

    const renderGuests = () => {
        guestList.innerHTML = modalGuests.map(guest => `
            <span class="flex items-center bg-gray-200 dark:bg-gray-600 text-sm rounded-full px-3 py-1 font-medium">
                ${guest}
                <button type="button" class="ml-2 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 remove-guest-btn" data-guest="${guest}" aria-label="Remove guest">&times;</button>
            </span>
        `).join('');
    };

    const renderAttachments = () => {
        attachmentList.innerHTML = modalAttachments.map(link => {
            try {
                const hostname = new URL(link).hostname;
                return `
                <span class="flex items-center bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded-full px-3 py-1 font-medium">
                    <a href="${link}" target="_blank" rel="noopener noreferrer" class="hover:underline">${hostname}</a>
                    <button type="button" class="ml-2 text-blue-500 hover:text-blue-800 dark:hover:text-blue-200 remove-attachment-btn" data-link="${link}" aria-label="Remove attachment">&times;</button>
                </span>
            `
            } catch { return '' }
        }).join('');
    };

    const openEventModal = (date, eventId = null) => {
        appState.selectedDate = date;
        appState.editingEventId = eventId;
        eventForm.reset();
        modalGuests = [];
        modalAttachments = [];
        modalError.classList.add('hidden');

        if (eventId) {
            const event = appState.events.find(e => e.id === eventId);
            modalTitle.textContent = 'Edit Event';
            eventIdInput.value = event.id;
            eventTitleInput.value = event.title;
            eventDescriptionInput.value = event.description;
            eventLocationInput.value = event.location || '';
            eventOrganizationInput.value = event.organization || '';
            startTimeInput.value = new Date(event.start).toTimeString().substring(0, 5);
            endTimeInput.value = new Date(event.end).toTimeString().substring(0, 5);
            eventRecurringInput.value = event.recurring || 'none';
            selectedColor = event.color;
            modalGuests = event.guests || [];
            modalAttachments = event.attachments || [];
            deleteEventBtn.classList.remove('hidden');
        } else {
            modalTitle.textContent = 'Add Event';
            startTimeInput.value = '09:00';
            endTimeInput.value = '10:00';
            eventRecurringInput.value = 'none';
            selectedColor = colors[0];
            deleteEventBtn.classList.add('hidden');
        }
        
        updateColorPicker();
        renderGuests();
        renderAttachments();
        eventModal.classList.add('is-open');
    };

    const closeEventModal = () => {
        eventModal.classList.remove('is-open');
        appState.editingEventId = null;
        modalGuests = [];
        modalAttachments = [];
        guestList.innerHTML = '';
        attachmentList.innerHTML = '';
    };
    
    const updateColorPicker = () => {
        colorPicker.innerHTML = colors.map(c => `
            <button type="button" data-color="${c}" class="h-8 w-8 rounded-full transition-transform transform hover:scale-110 ${selectedColor === c ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800' : ''}" style="background-color: ${c}"></button>
        `).join('');
    };


    // --- Event Listeners ---

    viewSwitcher.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            appState.viewMode = e.target.dataset.view;
            render();
        }
    });

    prevBtn.addEventListener('click', () => {
        const date = appState.currentDate;
        switch (appState.viewMode) {
            case 'year': date.setFullYear(date.getFullYear() - 1); break;
            case 'month': date.setMonth(date.getMonth() - 1); break;
            case 'day': date.setDate(date.getDate() - 1); break;
        }
        render();
    });

    nextBtn.addEventListener('click', () => {
        const date = appState.currentDate;
        switch (appState.viewMode) {
            case 'year': date.setFullYear(date.getFullYear() + 1); break;
            case 'month': date.setMonth(date.getMonth() + 1); break;
            case 'day': date.setDate(date.getDate() + 1); break;
        }
        render();
    });

    todayBtn.addEventListener('click', () => {
        appState.currentDate = new Date();
        render();
    });

    toggleTasksBtn.addEventListener('click', () => {
        appState.isTaskSidebarVisible = !appState.isTaskSidebarVisible;
        updateTaskSidebarVisibility();
    });

    viewContainer.addEventListener('click', (e) => {
        const monthBtn = e.target.closest('.month-btn');
        if (monthBtn) {
            appState.currentDate.setMonth(parseInt(monthBtn.dataset.month, 10));
            appState.viewMode = 'month';
            render();
            return;
        }

        const dayCell = e.target.closest('.day-cell');
        if (dayCell && !e.target.closest('[draggable="true"]')) { // Prevent changing view when clicking a draggable event
            appState.currentDate = new Date(dayCell.dataset.date);
            appState.viewMode = 'day';
            render();
        }

        if (e.target.closest('.add-event-btn')) {
            const date = new Date(e.target.closest('.day-cell').dataset.date);
            openEventModal(date);
        }
        
        const dayEvent = e.target.closest('.day-event, .month-event');
        if (dayEvent) {
             const eventId = dayEvent.dataset.eventId;
             const event = appState.events.find(e => e.id === eventId);
             if(event) {
                openEventModal(new Date(event.start), eventId);
             }
        }
    });
    
    // Modal Listeners
    eventModal.addEventListener('click', (e) => {
        if (e.target === eventModal) closeEventModal();
    });
    
    cancelBtn.addEventListener('click', closeEventModal);
    
    colorPicker.addEventListener('click', e => {
        if (e.target.dataset.color) {
            selectedColor = e.target.dataset.color;
            updateColorPicker();
        }
    });

    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const startDateTime = new Date(appState.selectedDate);
        const [startHour, startMinute] = startTimeInput.value.split(':').map(Number);
        startDateTime.setHours(startHour, startMinute, 0, 0);

        const endDateTime = new Date(appState.selectedDate);
        const [endHour, endMinute] = endTimeInput.value.split(':').map(Number);
        endDateTime.setHours(endHour, endMinute, 0, 0);

        if (endDateTime <= startDateTime) {
            modalError.textContent = 'End time must be after start time.';
            modalError.classList.remove('hidden');
            return;
        }
        
        const eventData = {
            id: appState.editingEventId || Date.now().toString(),
            title: eventTitleInput.value,
            description: eventDescriptionInput.value,
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            color: selectedColor,
            recurring: eventRecurringInput.value,
            location: eventLocationInput.value.trim(),
            organization: eventOrganizationInput.value.trim(),
            guests: modalGuests,
            attachments: modalAttachments,
        };

        if (appState.editingEventId) {
            appState.events = appState.events.map(event => event.id === appState.editingEventId ? eventData : event);
        } else {
            appState.events.push(eventData);
        }
        
        await syncData();
        closeEventModal();
        render();
    });
    
    deleteEventBtn.addEventListener('click', async () => {
        if (!appState.editingEventId) return;
        appState.events = appState.events.filter(event => event.id !== appState.editingEventId);
        await syncData();
        closeEventModal();
        render();
    });
    
    addGuestBtn.addEventListener('click', () => {
        const guestEmail = eventGuestInput.value.trim();
        if (guestEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
            if (!modalGuests.includes(guestEmail)) {
                modalGuests.push(guestEmail);
                renderGuests();
                eventGuestInput.value = '';
                modalError.classList.add('hidden');
            } else {
                modalError.textContent = 'Guest already added.';
                modalError.classList.remove('hidden');
            }
        } else {
            modalError.textContent = 'Please enter a valid email address.';
            modalError.classList.remove('hidden');
        }
    });

    guestList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-guest-btn');
        if (removeBtn) {
            const guestToRemove = removeBtn.dataset.guest;
            modalGuests = modalGuests.filter(g => g !== guestToRemove);
            renderGuests();
        }
    });

    addAttachmentBtn.addEventListener('click', () => {
        const link = eventAttachmentInput.value.trim();
        if (link) {
            try {
                new URL(link); // Validate URL
                if (!modalAttachments.includes(link)) {
                    modalAttachments.push(link);
                    renderAttachments();
                    eventAttachmentInput.value = '';
                    modalError.classList.add('hidden');
                } else {
                    modalError.textContent = 'Attachment link already added.';
                    modalError.classList.remove('hidden');
                }
            } catch (_) {
                modalError.textContent = 'Please enter a valid URL.';
                modalError.classList.remove('hidden');
            }
        }
    });

    attachmentList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-attachment-btn');
        if (removeBtn) {
            const linkToRemove = removeBtn.dataset.link;
            modalAttachments = modalAttachments.filter(l => l !== linkToRemove);
            renderAttachments();
        }
    });
    
    eventGuestInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addGuestBtn.click();
        }
    });

    eventAttachmentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addAttachmentBtn.click();
        }
    });

    // Task Listeners
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = taskInput.value.trim();
        if (title) {
            const newTask = {
                id: Date.now().toString(),
                title: title,
                completed: false,
                dueDate: taskDueDateInput.value || null,
                createdAt: new Date().toISOString(),
            };
            appState.tasks.push(newTask);
            await syncData();
            render();
            taskForm.reset();
        }
    });

    taskList.addEventListener('click', async e => {
        const checkbox = e.target.closest('.task-checkbox');
        if (checkbox) {
            const taskId = checkbox.dataset.taskId;
            const task = appState.tasks.find(t => t.id === taskId);
            if (task) {
                task.completed = checkbox.checked;
                await syncData();
                renderTasks(); // Just re-render tasks for responsiveness
            }
        }

        const deleteBtn = e.target.closest('.delete-task-btn');
        if (deleteBtn) {
            const taskId = deleteBtn.dataset.taskId;
            appState.tasks = appState.tasks.filter(t => t.id !== taskId);
            await syncData();
            render();
        }
    });

    // --- Drag and Drop Logic ---
    let draggedElement = null;

    viewContainer.addEventListener('dragstart', (e) => {
        const eventEl = e.target.closest('[data-event-id]');
        if (eventEl) {
            draggedElement = eventEl;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', eventEl.dataset.eventId);
            setTimeout(() => {
                eventEl.classList.add('opacity-40');
            }, 0);
        }
    });

    viewContainer.addEventListener('dragend', () => {
        if (draggedElement) {
            draggedElement.classList.remove('opacity-40');
            draggedElement = null;
        }
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over', 'bg-blue-100', 'dark:bg-gray-700'));
    });
    
    let lastDragOverCell = null;
    viewContainer.addEventListener('dragover', (e) => {
        e.preventDefault();

        if (appState.viewMode === 'month') {
            const dayCell = e.target.closest('.day-cell');
            if (dayCell && dayCell !== lastDragOverCell) {
                 if(lastDragOverCell) {
                    lastDragOverCell.classList.remove('drag-over', 'bg-blue-100', 'dark:bg-gray-700');
                }
                dayCell.classList.add('drag-over', 'bg-blue-100', 'dark:bg-gray-700');
                lastDragOverCell = dayCell;
            }
        } else if (appState.viewMode === 'day') {
             const timeline = e.target.closest('#day-view-timeline');
             if (timeline) {
                 e.dataTransfer.dropEffect = 'move';
             }
        }
    });
    
    viewContainer.addEventListener('dragleave', (e) => {
        const dayCell = e.target.closest('.day-cell');
        if (dayCell && dayCell === lastDragOverCell) {
            dayCell.classList.remove('drag-over', 'bg-blue-100', 'dark:bg-gray-700');
            lastDragOverCell = null;
        }
    });

    viewContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        if(lastDragOverCell) {
            lastDragOverCell.classList.remove('drag-over', 'bg-blue-100', 'dark:bg-gray-700');
            lastDragOverCell = null;
        }

        const eventId = e.dataTransfer.getData('text/plain');
        const event = appState.events.find(ev => ev.id === eventId);
        if (!event) return;

        if (appState.viewMode === 'month') {
            const dayCell = e.target.closest('.day-cell');
            if (dayCell) {
                const newDateStr = dayCell.dataset.date;
                
                const originalStart = new Date(event.start);
                const originalEnd = new Date(event.end);
                const duration = originalEnd.getTime() - originalStart.getTime();

                const newStartDate = new Date(newDateStr);
                newStartDate.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), originalStart.getMilliseconds());
                
                const newEndDate = new Date(newStartDate.getTime() + duration);

                event.start = newStartDate.toISOString();
                event.end = newEndDate.toISOString();
                
                await syncData();
                render();
            }
        } else if (appState.viewMode === 'day') {
            const timeline = e.target.closest('#day-view-timeline');
            if (timeline) {
                const rect = timeline.getBoundingClientRect();
                const dropY = e.clientY - rect.top;
                const totalMinutes = (dropY / rect.height) * 24 * 60;
                
                const snappedMinutes = Math.round(totalMinutes / 15) * 15;
                const newHours = Math.floor(snappedMinutes / 60);
                const newMinutes = snappedMinutes % 60;

                const originalStart = new Date(event.start);
                const originalEnd = new Date(event.end);
                const duration = originalEnd.getTime() - originalStart.getTime();

                const newStartDate = new Date(appState.currentDate);
                newStartDate.setHours(newHours, newMinutes, 0, 0);

                const newEndDate = new Date(newStartDate.getTime() + duration);
                
                event.start = newStartDate.toISOString();
                event.end = newEndDate.toISOString();

                await syncData();
                render();
            }
        }
    });

    // --- Settings Modal Logic ---
    const openSettingsModal = () => {
        gistPatInput.value = appState.gistPat || '';
        gistIdInput.value = appState.gistId || '';
        settingsError.classList.add('hidden');
        settingsSuccess.classList.add('hidden');
        settingsModal.classList.add('is-open');
    }

    const closeSettingsModal = () => settingsModal.classList.remove('is-open');

    settingsBtn.addEventListener('click', openSettingsModal);
    settingsModal.addEventListener('click', e => { if (e.target === settingsModal) closeSettingsModal() });
    settingsCancelBtn.addEventListener('click', closeSettingsModal);

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pat = gistPatInput.value.trim();
        const id = gistIdInput.value.trim();
        settingsError.classList.add('hidden');
        settingsSuccess.classList.add('hidden');

        if (!pat || !id) {
            settingsError.textContent = "Both fields are required.";
            settingsError.classList.remove('hidden');
            return;
        }

        const isValid = await verifyGistCredentials(pat, id);
        if (isValid) {
            appState.gistPat = pat;
            appState.gistId = id;
            localStorage.setItem('gistPat', pat);
            localStorage.setItem('gistId', id);
            settingsSuccess.textContent = 'Credentials verified and saved! Syncing data...';
            settingsSuccess.classList.remove('hidden');
            
            await initializeApp();

            setTimeout(() => {
                closeSettingsModal();
            }, 1500);

        } else {
            settingsError.textContent = "Invalid credentials or Gist not found. Please check your PAT and Gist ID.";
            settingsError.classList.remove('hidden');
        }
    });

    // --- Initial Load ---
    const initializeApp = async () => {
        appState.isDataLoaded = false;
        render();

        if (appState.gistPat && appState.gistId) {
            const data = await getGistData();
            if (data) {
                appState.events = data.events || [];
                appState.tasks = data.tasks || [];
            } else {
                // Handle case where credentials are saved but invalid
                console.error("Failed to fetch data from Gist. Please check your credentials in Settings.");
                appState.gistPat = null;
                appState.gistId = null;
                localStorage.removeItem('gistPat');
                localStorage.removeItem('gistId');
                openSettingsModal(); // Force user to re-enter
            }
        } else {
            // No credentials, prompt user
            openSettingsModal();
        }
        
        appState.isDataLoaded = true;
        render();
    };

    initializeApp();
});