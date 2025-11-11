

import { getGistData, saveGistData, verifyGistCredentials } from './services/gistService.js';
import { parseEventFromString } from './services/geminiService.js';

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
        theme: localStorage.getItem('theme') || 'system',
        isDataLoaded: false,
        searchQuery: '',
        activeInteraction: null, // For custom drag/resize in day view
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
    const quickAddBtn = document.getElementById('quick-add-btn');
    const toggleTasksBtn = document.getElementById('toggle-tasks-btn');
    const exportBtn = document.getElementById('export-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');

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
    const recurrenceDetails = document.getElementById('recurrence-details');
    const customRecurrenceSettings = document.getElementById('custom-recurrence-settings');
    const recurrenceIntervalInput = document.getElementById('recurrence-interval');
    const recurrenceUnitInput = document.getElementById('recurrence-unit');
    const recurrenceEndDateInput = document.getElementById('recurrence-end-date');
    const colorPicker = document.getElementById('color-picker');
    const customColorInput = document.getElementById('custom-color-input');
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

    // Quick Add Modal Elements
    const quickAddModal = document.getElementById('quick-add-modal');
    const quickAddForm = document.getElementById('quick-add-form');
    const quickAddInput = document.getElementById('quick-add-input');
    const quickAddError = document.getElementById('quick-add-error');
    const quickAddSaveBtn = document.getElementById('quick-add-save-btn');
    const quickAddCancelBtn = document.getElementById('quick-add-cancel-btn');

    // Settings Modal Elements
    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const themeSwitcher = document.getElementById('theme-switcher');
    const gistPatInput = document.getElementById('gist-pat');
    const gistIdInput = document.getElementById('gist-id');
    const settingsError = document.getElementById('settings-error');
    const settingsSuccess = document.getElementById('settings-success');
    const settingsCancelBtn = document.getElementById('settings-cancel-btn');

    // Data I/O Dropdown Elements
    const exportDropdown = document.getElementById('export-dropdown');
    const exportEventsBtn = document.getElementById('export-events-btn');
    const exportTasksBtn = document.getElementById('export-tasks-btn');
    const importEventsBtn = document.getElementById('import-events-btn');
    const importTasksBtn = document.getElementById('import-tasks-btn');
    const importEventsInput = document.getElementById('import-events-input');
    const importTasksInput = document.getElementById('import-tasks-input');


    // --- Theme Management ---
    const updateThemeSwitcherUI = () => {
        document.querySelectorAll('#theme-switcher .theme-btn').forEach(btn => {
            if (btn.dataset.theme === appState.theme) {
                btn.classList.add('bg-white', 'dark:bg-gray-900', 'shadow-sm');
                btn.classList.remove('text-gray-600', 'dark:text-gray-300');
            } else {
                btn.classList.remove('bg-white', 'dark:bg-gray-900', 'shadow-sm');
                btn.classList.add('text-gray-600', 'dark:text-gray-300');
            }
        });
    };

    const applyTheme = (theme) => {
        appState.theme = theme;
        localStorage.setItem('theme', theme);
        
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (theme === 'light') {
            document.documentElement.classList.remove('dark');
        } else { // system
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
        updateThemeSwitcherUI();
    };


    // --- State Management & Rendering ---

    const render = () => {
        if (!appState.isDataLoaded) {
            viewContainer.innerHTML = `<div class="flex items-center justify-center h-full text-gray-500">Loading your schedule...</div>`;
            return;
        }

        const renderNewContent = () => {
            // Update content
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
            
            // Trigger fade-in animation
            viewContainer.classList.remove('view-transition-out');
            viewContainer.classList.add('view-transition-in');
            
            // Clean up animation class after it's done
            viewContainer.addEventListener('animationend', () => {
                viewContainer.classList.remove('view-transition-in');
            }, { once: true });
        };

        const isInitialRender = viewContainer.innerHTML.trim() === '' || viewContainer.innerHTML.includes("Loading");
        
        if (isInitialRender) {
            // If it's the first time rendering, just show the content without an "out" animation
            renderNewContent();
        } else {
            // For subsequent renders, animate the old content out first
            viewContainer.classList.add('view-transition-out');
            viewContainer.addEventListener('animationend', renderNewContent, { once: true });
        }
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
                headerText.textContent = appState.currentDate.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
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

    const monthHasSearchResults = (year, month) => {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            if (getEventsForDate(date).length > 0) {
                return true;
            }
        }
        return false;
    };

    const renderYearView = () => {
        const year = appState.currentDate.getFullYear();
        const monthNames = Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('en-US', { month: 'long' }));
        const today = new Date();

        let html = `<div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sm:p-6"><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">`;
        
        monthNames.forEach((name, index) => {
            const isCurrentMonth = index === today.getMonth() && year === today.getFullYear();
            const hasResults = appState.searchQuery ? monthHasSearchResults(year, index) : false;
            const hasResultsIndicator = hasResults ? '<span class="absolute top-2 right-2 h-2.5 w-2.5 bg-blue-500 rounded-full" title="Event found in this month"></span>' : '';
            
            html += `
                <button
                    data-month="${index}"
                    class="month-btn relative p-4 sm:p-6 rounded-lg text-center font-semibold transition-all duration-200 ease-in-out transform hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500
                    ${isCurrentMonth ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900'}"
                >
                    ${name}
                    ${hasResultsIndicator}
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
            currentDate.setHours(0,0,0,0);
            const isTodayClass = currentDate.getTime() === today.getTime() ? 'bg-blue-600 text-white rounded-full h-7 w-7 flex items-center justify-center' : '';
            const dayEvents = getEventsForDate(currentDate);
            const dayTasks = getTasksForDate(currentDate);
            
            const incompleteTasks = dayTasks.filter(t => !t.completed);
            let taskIndicatorHtml = '';
            if (incompleteTasks.length > 0) {
                const isOverdue = currentDate < today;
                const isDueToday = currentDate.getTime() === today.getTime();
                let indicatorClass = 'bg-green-500'; // Upcoming
                let title = `${incompleteTasks.length} upcoming task(s)`;
                if (isOverdue) {
                    indicatorClass = 'bg-red-500';
                    title = `${incompleteTasks.length} overdue task(s)`;
                } else if (isDueToday) {
                    indicatorClass = 'bg-yellow-500';
                    title = `${incompleteTasks.length} task(s) due today`;
                }
                taskIndicatorHtml = `<div class="absolute top-1 right-1 h-2 w-2 rounded-full ${indicatorClass}" title="${title}"></div>`;
            }

            html += `
                <div class="day-cell relative p-2 border-r border-b border-gray-200 dark:border-gray-700 flex flex-col group hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer" data-date="${currentDate.toISOString()}">
                    <time datetime="${currentDate.toISOString()}" class="text-sm font-medium ${isTodayClass}">${day}</time>
                    ${taskIndicatorHtml}
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
        date.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);

        const hours = Array.from({ length: 24 }, (_, i) => i);
        const dayEvents = getEventsForDate(date);
        const dayTasks = getTasksForDate(date);

        const isOverdue = date < today;
        const isDueToday = date.getTime() === today.getTime();

        const formatTime = (hour) => new Date(0,0,0,hour).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

        const taskHtml = dayTasks.map(task => {
             let statusIndicator = '';
            if (!task.completed) {
                if (isOverdue) {
                    statusIndicator = '<span class="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" title="Overdue"></span>';
                } else if (isDueToday) {
                    statusIndicator = '<span class="h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" title="Due today"></span>';
                }
            }
            return `
                <div class="task-item flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">
                    <div class="flex items-center min-w-0">
                        <input type="checkbox" class="task-checkbox h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
                        <div class="ml-3 flex items-center gap-2 min-w-0">
                            ${statusIndicator}
                            <label class="truncate ${task.completed ? 'line-through text-gray-500' : ''}">${task.title}</label>
                        </div>
                    </div>
                    <button class="delete-task-btn text-gray-400 hover:text-red-500 font-bold text-lg ml-2 flex-shrink-0" data-task-id="${task.id}" aria-label="Delete task">&times;</button>
                </div>
            `;
        }).join('');

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
                                    <div class="day-event absolute left-2 right-2 p-2 text-white rounded-lg shadow-md cursor-move" 
                                         style="top: ${top}%; height: ${Math.max(height, 2)}%; background-color: ${event.color};"
                                         data-event-id="${event.id}">
                                        <div class="resize-handle top" data-handle="top"></div>
                                        <div class="event-content h-full overflow-hidden flex flex-col justify-start">
                                            <div class="flex-shrink-0">
                                                <p class="font-bold text-sm truncate">${event.title}</p>
                                                <p class="text-xs opacity-90">${start.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</p>
                                            </div>
                                            <div class="text-xs opacity-80 mt-1 space-y-0.5 overflow-hidden flex-grow">
                                                ${event.location ? `<p class="flex items-center truncate"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>${event.location}</p>` : ''}
                                                ${(event.guests && event.guests.length > 0) ? `<p class="flex items-center truncate"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0110 14.07a5 5 0 01-1.5-1.4c-.046.327-.07.66-.07 1a7 7 0 001.07 3.84.5.5 0 00.86 0A7 7 0 0012.93 17zM10 12a4 4 0 100-8 4 4 0 000 8z" /></svg>${event.guests.length} ${event.guests.length > 1 ? 'guests' : 'guest'}</p>` : ''}
                                                ${(event.attachments && event.attachments.length > 0) ? `<p class="flex items-center truncate"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a3 3 0 006 0V7a1 1 0 112 0v4a5 5 0 01-10 0V7a5 5 0 0110 0v4a1 1 0 11-2 0V7a3 3 0 00-3-3z" clip-rule="evenodd" /></svg>${event.attachments.length} ${event.attachments.length > 1 ? 'attachments' : 'attachment'}</p>` : ''}
                                            </div>
                                        </div>
                                        <div class="resize-handle bottom" data-handle="bottom"></div>
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
        const query = appState.searchQuery ? appState.searchQuery.toLowerCase().trim() : null;

        const dateWithoutTime = new Date(date);
        dateWithoutTime.setHours(0, 0, 0, 0);
        const dateString = dateWithoutTime.toDateString();

        return appState.events.filter(event => {
            if (query) {
                const titleMatch = event.title && event.title.toLowerCase().includes(query);
                const descMatch = event.description && event.description.toLowerCase().includes(query);
                const locationMatch = event.location && event.location.toLowerCase().includes(query);
                if (!titleMatch && !descMatch && !locationMatch) {
                    return false;
                }
            }

            const eventStart = new Date(event.start);
            eventStart.setHours(0, 0, 0, 0);

            if (eventStart.getTime() > dateWithoutTime.getTime()) {
                return false;
            }

            const recurring = event.recurring;

            if (!recurring) { // Includes null and undefined
                return eventStart.toDateString() === dateString;
            }
            
            if (recurring.endDate) {
                const recurrenceEndDate = new Date(recurring.endDate + 'T00:00:00');
                if (dateWithoutTime.getTime() > recurrenceEndDate.getTime()) {
                    return false; // Current date is after the recurrence end date
                }
            }

            const dayOfWeek = dateWithoutTime.getDay();
            const dayOfMonth = dateWithoutTime.getDate();
            const month = dateWithoutTime.getMonth();

            const eventStartDayOfWeek = eventStart.getDay();
            const eventStartDayOfMonth = eventStart.getDate();
            const eventStartMonth = eventStart.getMonth();
            
            switch (recurring.type) {
                case 'daily':
                    return true;
                case 'weekly':
                    return eventStartDayOfWeek === dayOfWeek;
                case 'monthly':
                    return eventStartDayOfMonth === dayOfMonth;
                case 'yearly':
                    return eventStartDayOfMonth === dayOfMonth && eventStartMonth === month;
                case 'custom': {
                    const interval = parseInt(recurring.interval, 10) || 1;
                    if (interval <= 0) return false;

                    switch (recurring.unit) {
                        case 'days': {
                            const diffTime = dateWithoutTime.getTime() - eventStart.getTime();
                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                            return diffDays >= 0 && diffDays % interval === 0;
                        }
                        case 'weeks': {
                            if (eventStartDayOfWeek !== dayOfWeek) return false;
                            const diffTime = dateWithoutTime.getTime() - eventStart.getTime();
                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) return false;
                            const diffWeeks = Math.floor(diffDays / 7);
                            return diffWeeks % interval === 0;
                        }
                        case 'months': {
                             if (eventStartDayOfMonth !== dayOfMonth) return false;
                             const yearDiff = dateWithoutTime.getFullYear() - eventStart.getFullYear();
                             const monthDiff = yearDiff * 12 + dateWithoutTime.getMonth() - eventStart.getMonth();
                             return monthDiff >= 0 && monthDiff % interval === 0;
                        }
                        default:
                            return false;
                    }
                }
                default:
                    return false;
            }
        }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        taskList.innerHTML = sortedTasks.map(task => {
            let dueDateHtml = '';
            if (task.dueDate) {
                const dueDate = new Date(task.dueDate + 'T00:00:00');
                let dateClass = 'text-gray-400 dark:text-gray-500';
                let dateText = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                if (!task.completed) {
                    if (dueDate < today) {
                        dateClass = 'text-red-500 font-medium';
                        dateText += ' (Overdue)';
                    } else if (dueDate.getTime() === today.getTime()) {
                        dateClass = 'text-yellow-600 dark:text-yellow-500 font-medium';
                        dateText = 'Today';
                    }
                }
                dueDateHtml = `<p class="text-xs ${dateClass}">${dateText}</p>`;
            }

            return `
            <div class="task-item flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">
                <div class="flex items-center overflow-hidden">
                    <input type="checkbox" class="task-checkbox h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 flex-shrink-0" data-task-id="${task.id}" ${task.completed ? 'checked' : ''}>
                    <div class="ml-3 truncate">
                        <label class="${task.completed ? 'line-through text-gray-500' : ''}">${task.title}</label>
                        ${dueDateHtml}
                    </div>
                </div>
                <button class="delete-task-btn text-gray-400 hover:text-red-500 font-bold text-lg ml-2 flex-shrink-0" data-task-id="${task.id}" aria-label="Delete task">&times;</button>
            </div>
            `;
        }).join('');
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
        customRecurrenceSettings.classList.add('hidden');
        recurrenceDetails.classList.add('hidden');

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
            
            const recurring = event.recurring;
            if (recurring) {
                recurrenceDetails.classList.remove('hidden');
                recurrenceEndDateInput.value = recurring.endDate || '';
                if (recurring.type === 'custom') {
                    eventRecurringInput.value = 'custom';
                    recurrenceIntervalInput.value = recurring.interval || 1;
                    recurrenceUnitInput.value = recurring.unit || 'days';
                    customRecurrenceSettings.classList.remove('hidden');
                } else {
                    eventRecurringInput.value = recurring.type;
                }
            } else {
                eventRecurringInput.value = 'none';
            }

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
        // Render swatches
        colorPicker.innerHTML = colors.map(c => `
            <button type="button" data-color="${c}" class="h-8 w-8 rounded-full transition-transform transform hover:scale-110 ${selectedColor === c ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800' : ''}" style="background-color: ${c}"></button>
        `).join('');
        
        // Update custom color input's value. The browser will then show this color.
        customColorInput.value = selectedColor;
    
        const isCustom = !colors.includes(selectedColor);
        const customColorWrapper = document.getElementById('custom-color-wrapper');
        
        const ringClasses = ['ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-800'];
        if (isCustom) {
            customColorWrapper.classList.add(...ringClasses);
        } else {
            customColorWrapper.classList.remove(...ringClasses);
        }
    };


    // --- Event Listeners ---
    searchForm.addEventListener('submit', e => e.preventDefault());
    searchInput.addEventListener('input', () => {
        appState.searchQuery = searchInput.value;
        render();
    });

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
        
        const dayEvent = e.target.closest('.day-event .event-content, .month-event');
        if (dayEvent) {
             const eventId = dayEvent.closest('[data-event-id]').dataset.eventId;
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

    customColorInput.addEventListener('input', e => {
        selectedColor = e.target.value;
        updateColorPicker();
    });

    eventRecurringInput.addEventListener('change', () => {
        const recurrenceType = eventRecurringInput.value;
        if (recurrenceType === 'none') {
            recurrenceDetails.classList.add('hidden');
        } else {
            recurrenceDetails.classList.remove('hidden');
        }

        if (recurrenceType === 'custom') {
            customRecurrenceSettings.classList.remove('hidden');
        } else {
            customRecurrenceSettings.classList.add('hidden');
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
        
        let recurring = null;
        const recurringType = eventRecurringInput.value;
        if (recurringType !== 'none') {
            recurring = { type: recurringType };

            if (recurringType === 'custom') {
                recurring.interval = parseInt(recurrenceIntervalInput.value, 10) || 1;
                recurring.unit = recurrenceUnitInput.value;
            }

            const endDate = recurrenceEndDateInput.value;
            if (endDate) {
                recurring.endDate = endDate;
            }
        }

        const eventData = {
            id: appState.editingEventId || Date.now().toString(),
            title: eventTitleInput.value,
            description: eventDescriptionInput.value,
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            color: selectedColor,
            recurring: recurring,
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

    // Native D&D for Month View
    viewContainer.addEventListener('dragstart', (e) => {
        if (appState.viewMode !== 'month') {
            e.preventDefault();
            return;
        }
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
        }
    });

    // Custom Drag & Resize for Day View
    const pixelsToMinutes = (pixels, timelineHeight) => (pixels / timelineHeight) * (24 * 60);

    viewContainer.addEventListener('mousedown', e => {
        if (appState.viewMode !== 'day' || e.button !== 0) return;

        const eventEl = e.target.closest('.day-event');
        if (!eventEl) return;

        const eventId = eventEl.dataset.eventId;
        const event = appState.events.find(ev => ev.id === eventId);
        if (!event) return;

        const timeline = document.getElementById('day-view-timeline');
        const timelineRect = timeline.getBoundingClientRect();
        
        const handle = e.target.closest('.resize-handle');
        let type;

        if (handle) {
            type = handle.dataset.handle === 'top' ? 'resize-start' : 'resize-end';
            document.body.classList.add('is-resizing');
        } else {
            type = 'move';
            document.body.classList.add('is-dragging');
        }
        e.preventDefault();

        const placeholder = document.createElement('div');
        placeholder.id = 'event-placeholder';
        placeholder.style.top = eventEl.style.top;
        placeholder.style.height = eventEl.style.height;
        timeline.appendChild(placeholder);
        eventEl.style.opacity = '0.5';

        appState.activeInteraction = {
            type,
            eventId,
            initialY: e.clientY,
            initialStart: new Date(event.start),
            initialEnd: new Date(event.end),
            timelineRect,
            placeholder,
            originalElement: eventEl,
        };
    });

    document.addEventListener('mousemove', e => {
        if (!appState.activeInteraction) return;

        const { type, initialY, initialStart, initialEnd, timelineRect, placeholder } = appState.activeInteraction;
        
        const deltaY = e.clientY - initialY;
        let deltaMinutes = pixelsToMinutes(deltaY, timelineRect.height);
        deltaMinutes = Math.round(deltaMinutes / 15) * 15;

        let newStart = new Date(initialStart);
        let newEnd = new Date(initialEnd);
        const minDuration = 15;

        if (type === 'move') {
            newStart.setMinutes(initialStart.getMinutes() + deltaMinutes);
            newEnd.setMinutes(initialEnd.getMinutes() + deltaMinutes);
        } else if (type === 'resize-end') {
            newEnd.setMinutes(initialEnd.getMinutes() + deltaMinutes);
            if ((newEnd.getTime() - newStart.getTime()) / (1000 * 60) < minDuration) {
                newEnd = new Date(newStart.getTime() + minDuration * 60 * 1000);
            }
        } else if (type === 'resize-start') {
            newStart.setMinutes(initialStart.getMinutes() + deltaMinutes);
            if ((newEnd.getTime() - newStart.getTime()) / (1000 * 60) < minDuration) {
                newStart = new Date(newEnd.getTime() - minDuration * 60 * 1000);
            }
        }

        const top = ((newStart.getHours() * 60 + newStart.getMinutes()) / (24 * 60)) * 100;
        const duration = (newEnd.getTime() - newStart.getTime()) / (1000 * 60);
        const height = (duration / (24 * 60)) * 100;

        placeholder.style.top = `${top}%`;
        placeholder.style.height = `${Math.max(height, 0)}%`;

        appState.activeInteraction.newStart = newStart;
        appState.activeInteraction.newEnd = newEnd;
    });

    document.addEventListener('mouseup', async () => {
        if (!appState.activeInteraction) return;

        const { eventId, newStart, newEnd, placeholder, originalElement } = appState.activeInteraction;
        
        document.body.classList.remove('is-dragging', 'is-resizing');
        placeholder.remove();
        originalElement.style.opacity = '1';

        const hasChanged = newStart && newEnd && (newStart.getTime() !== new Date(appState.events.find(ev => ev.id === eventId).start).getTime() || newEnd.getTime() !== new Date(appState.events.find(ev => ev.id === eventId).end).getTime());

        if (hasChanged) {
            const event = appState.events.find(ev => ev.id === eventId);
            if (event) {
                event.start = newStart.toISOString();
                event.end = newEnd.toISOString();
                await syncData();
                render();
            }
        }
        
        appState.activeInteraction = null;
    });

    // --- CSV Export/Import Logic ---
    const escapeCsvCell = (cell) => {
        if (cell === null || cell === undefined) {
            return '';
        }
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const convertToCsv = (data, headers) => {
        const headerRow = headers.map(h => escapeCsvCell(h.label)).join(',');
        const rows = data.map(item => {
            return headers.map(header => {
                const value = header.key.split('.').reduce((o, i) => (o ? o[i] : undefined), item);
                return escapeCsvCell(header.formatter ? header.formatter(value) : value);
            }).join(',');
        });
        return [headerRow, ...rows].join('\n');
    };

    const downloadFile = (content, filename, mimeType) => {
        // Add a UTF-8 Byte Order Mark (BOM) to ensure Excel opens the file correctly with special characters.
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const parseCsv = (csvString) => {
        const lines = csvString.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(','); // Simplified parsing, assumes no commas in values
            const obj = {};
            for (let j = 0; j < headers.length; j++) {
                obj[headers[j]] = values[j] ? values[j].trim() : '';
            }
            data.push(obj);
        }
        return data;
    };

    const handleFileImport = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const csvContent = event.target.result;
                const parsedData = parseCsv(csvContent);
                if (type === 'events') {
                    processImportedEvents(parsedData);
                } else if (type === 'tasks') {
                    processImportedTasks(parsedData);
                }
                await syncData();
                render();
                alert(`Successfully imported ${parsedData.length} ${type}.`);
            } catch (error) {
                console.error(`Error importing ${type}:`, error);
                alert(`Failed to import ${type}. Please check the file format.`);
            } finally {
                // Reset input value to allow importing the same file again
                e.target.value = null;
            }
        };
        reader.readAsText(file);
    };
    
    const processImportedTasks = (tasks) => {
        tasks.forEach(task => {
            if (!task.id || !task.title) return; // Skip invalid rows
            
            const existingTaskIndex = appState.tasks.findIndex(t => t.id === task.id);
            const formattedTask = {
                ...task,
                completed: task.completed === 'true',
                dueDate: task.dueDate || null,
            };

            if (existingTaskIndex > -1) {
                appState.tasks[existingTaskIndex] = { ...appState.tasks[existingTaskIndex], ...formattedTask };
            } else {
                appState.tasks.push(formattedTask);
            }
        });
    };
    
    const processImportedEvents = (events) => {
        events.forEach(event => {
            if (!event.id || !event.title || !event.start || !event.end) return; // Skip invalid rows

            let recurring = null;
            if (event.recurring_type && event.recurring_type !== 'none') {
                recurring = {
                    type: event.recurring_type,
                    interval: event.recurring_interval ? parseInt(event.recurring_interval, 10) : 1,
                    unit: event.recurring_unit || 'days',
                    endDate: event.recurring_endDate || undefined,
                };
                if (!recurring.endDate) delete recurring.endDate;
            }

            const formattedEvent = {
                ...event,
                guests: event.guests ? event.guests.split(',').map(g => g.trim()).filter(Boolean) : [],
                attachments: event.attachments ? event.attachments.split(',').map(a => a.trim()).filter(Boolean) : [],
                recurring: recurring,
            };
            
            delete formattedEvent.recurring_type;
            delete formattedEvent.recurring_interval;
            delete formattedEvent.recurring_unit;
            delete formattedEvent.recurring_endDate;
            
            const existingEventIndex = appState.events.findIndex(e => e.id === event.id);
            if (existingEventIndex > -1) {
                appState.events[existingEventIndex] = { ...appState.events[existingEventIndex], ...formattedEvent };
            } else {
                appState.events.push(formattedEvent);
            }
        });
    };

    exportEventsBtn.addEventListener('click', () => {
        if (appState.events.length === 0) {
            alert("No events to export.");
            return;
        }

        const headers = [
            { key: 'id', label: 'id' },
            { key: 'title', label: 'title' },
            { key: 'description', label: 'description' },
            { key: 'start', label: 'start' },
            { key: 'end', label: 'end' },
            { key: 'color', label: 'color' },
            { key: 'location', label: 'location' },
            { key: 'organization', label: 'organization' },
            { key: 'guests', label: 'guests', formatter: (guests) => (guests || []).join(', ') },
            { key: 'attachments', label: 'attachments', formatter: (attachments) => (attachments || []).join(', ') },
            { key: 'recurring.type', label: 'recurring_type' },
            { key: 'recurring.interval', label: 'recurring_interval' },
            { key: 'recurring.unit', label: 'recurring_unit' },
            { key: 'recurring.endDate', label: 'recurring_endDate' },
        ];

        const csvContent = convertToCsv(appState.events, headers);
        downloadFile(csvContent, 'events.csv', 'text/csv;charset=utf-8;');
    });

    exportTasksBtn.addEventListener('click', () => {
        if (appState.tasks.length === 0) {
            alert("No tasks to export.");
            return;
        }
        
        const headers = [
            { key: 'id', label: 'id' },
            { key: 'title', label: 'title' },
            { key: 'completed', label: 'completed' },
            { key: 'dueDate', label: 'dueDate' },
            { key: 'createdAt', label: 'createdAt' },
        ];

        const csvContent = convertToCsv(appState.tasks, headers);
        downloadFile(csvContent, 'tasks.csv', 'text/csv;charset=utf-8;');
    });
    
    importEventsBtn.addEventListener('click', () => importEventsInput.click());
    importTasksBtn.addEventListener('click', () => importTasksInput.click());
    importEventsInput.addEventListener('change', (e) => handleFileImport(e, 'events'));
    importTasksInput.addEventListener('change', (e) => handleFileImport(e, 'tasks'));


    // --- Quick Add Modal Logic ---
    const openQuickAddModal = () => {
        quickAddForm.reset();
        quickAddError.classList.add('hidden');
        const saveBtnText = quickAddSaveBtn.querySelector('.btn-text');
        const saveBtnLoader = quickAddSaveBtn.querySelector('.btn-loader');
        saveBtnText.classList.remove('hidden');
        saveBtnLoader.classList.add('hidden');
        quickAddSaveBtn.disabled = false;
        quickAddModal.classList.add('is-open');
        quickAddInput.focus();
    };

    const closeQuickAddModal = () => {
        quickAddModal.classList.remove('is-open');
    };

    quickAddBtn.addEventListener('click', openQuickAddModal);
    quickAddModal.addEventListener('click', e => { if (e.target === quickAddModal) closeQuickAddModal(); });
    quickAddCancelBtn.addEventListener('click', closeQuickAddModal);

    quickAddForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = quickAddInput.value.trim();
        if (!prompt) return;

        quickAddError.classList.add('hidden');
        const saveBtnText = quickAddSaveBtn.querySelector('.btn-text');
        const saveBtnLoader = quickAddSaveBtn.querySelector('.btn-loader');

        // Show loading state
        saveBtnText.classList.add('hidden');
        saveBtnLoader.classList.remove('hidden');
        quickAddSaveBtn.disabled = true;

        try {
            const parsedData = await parseEventFromString(prompt);

            if (!parsedData.title || !parsedData.date || !parsedData.startTime || !parsedData.endTime) {
                throw new Error("Couldn't extract all required event details.");
            }

            const [startHour, startMinute] = parsedData.startTime.split(':').map(Number);
            const [endHour, endMinute] = parsedData.endTime.split(':').map(Number);

            const [year, month, day] = parsedData.date.split('-').map(Number);

            const startDateTime = new Date(year, month - 1, day, startHour, startMinute);
            const endDateTime = new Date(year, month - 1, day, endHour, endMinute);
            
            if (endDateTime < startDateTime) {
                endDateTime.setDate(endDateTime.getDate() + 1);
            }

            const newEvent = {
                id: Date.now().toString(),
                title: parsedData.title,
                description: '',
                start: startDateTime.toISOString(),
                end: endDateTime.toISOString(),
                color: colors[Math.floor(Math.random() * colors.length)],
                recurring: null,
                location: '',
                organization: '',
                guests: [],
                attachments: [],
            };

            appState.events.push(newEvent);
            await syncData();
            closeQuickAddModal();
            render();

        } catch (error) {
            quickAddError.textContent = error.message || "An unexpected error occurred.";
            quickAddError.classList.remove('hidden');
        } finally {
            // Hide loading state
            saveBtnText.classList.remove('hidden');
            saveBtnLoader.classList.add('hidden');
            quickAddSaveBtn.disabled = false;
        }
    });

    // --- Settings Modal Logic ---
    const openSettingsModal = () => {
        gistPatInput.value = appState.gistPat || '';
        gistIdInput.value = appState.gistId || '';
        settingsError.classList.add('hidden');
        settingsSuccess.classList.add('hidden');
        updateThemeSwitcherUI();
        settingsModal.classList.add('is-open');
    }

    const closeSettingsModal = () => settingsModal.classList.remove('is-open');

    themeSwitcher.addEventListener('click', (e) => {
        const themeBtn = e.target.closest('.theme-btn');
        if (themeBtn) {
            const newTheme = themeBtn.dataset.theme;
            applyTheme(newTheme);
        }
    });

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

    // --- Export Dropdown Logic ---
    const toggleExportDropdown = (e) => {
        e.stopPropagation();
        const isHidden = exportDropdown.classList.toggle('hidden');
        exportBtn.setAttribute('aria-expanded', !isHidden);
    };

    const closeExportDropdown = () => {
        if (!exportDropdown.classList.contains('hidden')) {
            exportDropdown.classList.add('hidden');
            exportBtn.setAttribute('aria-expanded', 'false');
        }
    };

    exportBtn.addEventListener('click', toggleExportDropdown);
    document.addEventListener('click', (e) => {
        const isClickInside = exportBtn.contains(e.target) || exportDropdown.contains(e.target);
        if (!isClickInside) {
            closeExportDropdown();
        }
    });


    // --- Initial Load ---
    const initializeApp = async () => {
        appState.isDataLoaded = false;
        render();

        if (appState.gistPat && appState.gistId) {
            const data = await getGistData();
            if (data) {
                // Data migration for recurrence
                appState.events = (data.events || []).map(event => {
                    const migratedEvent = { ...event };
                    if (typeof migratedEvent.recurring === 'string') {
                        if (migratedEvent.recurring === 'none') {
                            migratedEvent.recurring = null;
                        } else {
                            migratedEvent.recurring = { type: migratedEvent.recurring };
                        }
                    } else if (migratedEvent.recurring && migratedEvent.recurring.type === 'none') {
                        migratedEvent.recurring = null;
                    }
                    return migratedEvent;
                });
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

    // Apply initial theme and listen for OS changes
    applyTheme(appState.theme);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (appState.theme === 'system') {
            applyTheme('system');
        }
    });

    initializeApp();
});