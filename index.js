

import { getGistData, saveGistData, verifyGistCredentials } from './services/gistService.js';
import { parseEventFromString } from './services/geminiService.js';

document.addEventListener('DOMContentLoaded', () => {
    const appState = {
        currentDate: new Date(),
        viewMode: 'week', // 'day', 'week', 'month', 'year'
        events: [],
        tasks: [],
        tags: [],
        selectedDate: new Date(),
        editingEventId: null,
        isTaskSidebarVisible: true,
        gistPat: localStorage.getItem('gistPat'),
        gistId: localStorage.getItem('gistId'),
        theme: localStorage.getItem('theme') || 'system',
        timeZone: localStorage.getItem('timeZone') || Intl.DateTimeFormat().resolvedOptions().timeZone,
        isDataLoaded: false,
        searchQuery: '',
        activeInteraction: null, // For custom drag/resize in day view
    };

    const colors = ['#0284c7', '#16a34a', '#ca8a04', '#c026d3', '#db2777', '#dc2626', '#0d9488', '#d97706', '#6d28d9'];
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
    const modalTimezoneDisplay = document.getElementById('modal-timezone-display');
    const eventLinkedTaskInput = document.getElementById('event-linked-task');
    const eventRecurringInput = document.getElementById('event-recurring');
    const recurrenceDetails = document.getElementById('recurrence-details');
    const customRecurrenceSettings = document.getElementById('custom-recurrence-settings');
    const recurrenceIntervalInput = document.getElementById('recurrence-interval');
    const recurrenceUnitInput = document.getElementById('recurrence-unit');
    const recurrenceEndDateInput = document.getElementById('recurrence-end-date');
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

    // Tag Elements
    const eventTagSelect = document.getElementById('event-tag-select');
    const eventTagColorSwatch = document.getElementById('event-tag-color-swatch');
    const tagManagementList = document.getElementById('tag-management-list');
    const newTagNameInput = document.getElementById('new-tag-name-input');
    const newTagColorInput = document.getElementById('new-tag-color-input');
    const addNewTagBtn = document.getElementById('add-new-tag-btn');

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
    const timezoneSelect = document.getElementById('timezone-select');
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

    // --- Time Zone & Date Helpers ---
    const formatDateInTimeZone = (date, timeZone, options) => {
        if (!date) return '';
        const d = (date instanceof Date) ? date : new Date(date);
        return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(d);
    };

    const getPartsInTimeZone = (date, timeZone) => {
        const d = (date instanceof Date) ? date : new Date(date);
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
        });
        const formatted = formatter.format(d);
        // Handle cases like "24:00" which Intl can produce
        const [hourStr, minuteStr] = formatted.split(':');
        const hour = hourStr === '24' ? 0 : parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);
        return { hour, minute };
    };

    const convertToUtc = (baseDate, timeString, timeZone) => {
        const year = baseDate.getFullYear();
        const month = baseDate.getMonth();
        const day = baseDate.getDate();
        const [hour, minute] = timeString.split(':').map(Number);
    
        // 1. Create a UTC date with the desired date/time components. This is our initial "guess".
        const utcDate = new Date(Date.UTC(year, month, day, hour, minute));
    
        // 2. Format this UTC date into the target timezone to see what its local time components are.
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        });
        const parts = formatter.formatToParts(utcDate);
        const findPart = (type) => parts.find(p => p.type === type)?.value || '0';
    
        const tzYear = parseInt(findPart('year'));
        const tzMonth = parseInt(findPart('month')) - 1;
        const tzDay = parseInt(findPart('day'));
        const tzHour = parseInt(findPart('hour')) % 24;
        const tzMinute = parseInt(findPart('minute'));

        // 3. Create a new UTC date from these timezone-specific components.
        const guessedTzDate = new Date(Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute));
    
        // 4. The difference between our initial guess and the timezone-specific date is the offset.
        const offset = utcDate.getTime() - guessedTzDate.getTime();
    
        // 5. Apply the offset to our initial guess to get the correct final UTC date.
        return new Date(utcDate.getTime() - offset);
    };

    const getStartOfDayInZone = (date, timeZone) => {
        return convertToUtc(date, '00:00', timeZone);
    };

    const getYmdInZone = (date, timeZone) => {
        const d = (date instanceof Date) ? date : new Date(date);
        const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
        return formatter.format(d);
    };


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
                case 'week':
                    renderWeekView();
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

    const getWeekRange = (date) => {
        const d = new Date(date);
        const day = d.getDay(); // Sunday - 0, Monday - 1, ...
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
        const startOfWeek = new Date(d.setDate(diff));
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return { start: startOfWeek, end: endOfWeek };
    };

    const updateHeader = () => {
        switch (appState.viewMode) {
            case 'year':
                headerText.textContent = appState.currentDate.getFullYear();
                break;
            case 'month':
                headerText.textContent = appState.currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
                break;
            case 'week': {
                const { start, end } = getWeekRange(appState.currentDate);
                const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
                const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
                if (startMonth === endMonth) {
                    headerText.textContent = `${startMonth} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
                } else if (start.getFullYear() !== end.getFullYear()) {
                     headerText.textContent = `${startMonth} ${start.getDate()}, ${start.getFullYear()} - ${endMonth} ${end.getDate()}, ${end.getFullYear()}`;
                } else {
                    headerText.textContent = `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${start.getFullYear()}`;
                }
                break;
            }
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
        
        const todayYmd = getYmdInZone(new Date(), appState.timeZone);

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        let firstDayOfMonth = new Date(year, month, 1).getDay(); // Sunday is 0, Monday is 1
        firstDayOfMonth = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1; // Monday is 0, Sunday is 6
        const weekDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
            const currentYmd = getYmdInZone(currentDate, appState.timeZone);
            const isTodayClass = currentYmd === todayYmd ? 'bg-blue-600 text-white rounded-full h-7 w-7 flex items-center justify-center' : '';
            
            const dayEvents = getEventsForDate(currentDate);
            const dayTasks = getTasksForDate(currentDate);

            const combinedItems = [
                ...dayEvents.map(e => ({ type: 'event', ...e })),
                ...dayTasks.map(t => ({ type: 'task', ...t }))
            ];
            combinedItems.sort((a,b) => {
                if (a.type === 'task' && b.type === 'event') return -1;
                if (a.type === 'event' && b.type === 'task') return 1;
                if (a.type === 'event') return new Date(a.start) - new Date(b.start);
                return 0;
            });

            html += `
                <div class="day-cell relative p-2 border-r border-b border-gray-200 dark:border-gray-700 flex flex-col group hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer" data-date="${currentDate.toISOString()}">
                    <time datetime="${currentDate.toISOString()}" class="text-sm font-medium ${isTodayClass}">${day}</time>
                    <div class="mt-1 space-y-1 overflow-y-auto max-h-24">
                        ${combinedItems.slice(0, 2).map(item => {
                            if (item.type === 'event') {
                                const event = item;
                                const linkedTask = event.taskId ? appState.tasks.find(t => t.id === event.taskId) : null;
                                return `<div class="month-event flex items-center gap-1 text-xs px-1.5 py-0.5 rounded text-white cursor-move" draggable="true" data-event-id="${event.id}" style="background-color: ${event.color};" title="${linkedTask ? `Linked Task: ${linkedTask.title}` : ''}">
                                    ${linkedTask ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h4a1 1 0 100-2H7z" clip-rule="evenodd" /></svg>` : ''}
                                    <span class="truncate">${event.title}</span>
                                </div>`;
                            } else { // It's a task
                                const task = item;
                                return `<div class="month-task flex items-center gap-1 text-xs px-1.5 py-0.5 rounded cursor-pointer ${task.completed ? 'bg-green-100 dark:bg-green-900/50 text-gray-500 line-through' : 'bg-gray-200 dark:bg-gray-600'}" data-date="${currentDate.toISOString()}" title="Task: ${task.title}">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 flex-shrink-0 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                                    <span class="truncate">${task.title}</span>
                                </div>`;
                            }
                        }).join('')}
                        ${combinedItems.length > 2 ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">+ ${combinedItems.length - 2} more</div>` : ''}
                    </div>
                    <button class="add-event-btn absolute bottom-2 right-2 h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">+</button>
                </div>
            `;
        }

        html += `</div></div>`;
        viewContainer.innerHTML = html;
    };

    const renderWeekView = () => {
        const getDatesOfWeek = (date) => {
            const { start } = getWeekRange(date);
            return Array.from({ length: 7 }, (_, i) => {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                return d;
            });
        };

        const weekDates = getDatesOfWeek(appState.currentDate);
        const todayYmd = getYmdInZone(new Date(), appState.timeZone);
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const formatTimeForAxis = (hour) => new Date(0, 0, 0, hour).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

        const allDayOccurrences = [];
        const timedOccurrences = [];
        const allDayTasks = [];
        const processedEventInstances = new Set();

        weekDates.forEach((date, dayIndex) => {
            getEventsForDate(date).forEach(event => {
                const instanceId = `${event.id}_${date.toISOString().split('T')[0]}`;
                if (processedEventInstances.has(instanceId)) {
                    return;
                }
                processedEventInstances.add(instanceId);

                const start = new Date(event.start);
                const end = new Date(event.end);
                const isAllDay = (end.getTime() - start.getTime()) >= (23.5 * 60 * 60 * 1000);

                const occurrence = { event, dayIndex, occurrenceDate: date };

                if (isAllDay) {
                    allDayOccurrences.push(occurrence);
                } else {
                    timedOccurrences.push(occurrence);
                }
            });

            getTasksForDate(date).forEach(task => {
                allDayTasks.push({ task, dayIndex });
            });
        });

        let allDayEventsHtml = allDayOccurrences.map(occ => {
            const { event, dayIndex } = occ;
            return `
                <div class="col-start-${dayIndex + 1} px-2 py-0.5 my-0.5 rounded text-white text-xs cursor-pointer" style="background-color: ${event.color};" data-event-id="${event.id}">
                    ${event.title}
                </div>`;
        }).join('');
        
        let allDayTasksHtml = allDayTasks.map(occ => {
            const { task, dayIndex } = occ;
            return `
                <div class="week-task col-start-${dayIndex + 1} px-2 py-0.5 my-0.5 rounded text-xs cursor-pointer ${task.completed ? 'bg-green-100 dark:bg-green-900/50 text-gray-500 line-through' : 'bg-gray-200 dark:bg-gray-600'}" data-date="${weekDates[dayIndex].toISOString()}" title="Task: ${task.title}">
                    <div class="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 flex-shrink-0 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        <span class="truncate">${task.title}</span>
                    </div>
                </div>`;
        }).join('');

        let timedEventsHtml = timedOccurrences.map(occ => {
            const { event, dayIndex } = occ;
            const linkedTask = event.taskId ? appState.tasks.find(t => t.id === event.taskId) : null;
            
            const startParts = getPartsInTimeZone(event.start, appState.timeZone);
            const startTotalMinutes = startParts.hour * 60 + startParts.minute;
            const top = (startTotalMinutes / (24 * 60)) * 100;

            const duration = (new Date(event.end).getTime() - new Date(event.start).getTime()) / (1000 * 60); // Duration is timezone-independent
            const height = (duration / (24 * 60)) * 100;
            
            return `
                <div class="week-event absolute p-1.5 text-white rounded-lg shadow-md cursor-pointer overflow-hidden flex flex-col justify-start" 
                     style="--day-index: ${dayIndex}; top: ${top}%; height: ${height}%; background-color: ${event.color};"
                     data-event-id="${event.id}">
                    <div class="flex-shrink-0">
                         <div class="flex items-start justify-between">
                            <p class="font-bold text-xs truncate">${event.title}</p>
                            ${linkedTask ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" title="Linked Task: ${linkedTask.title}"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h4a1 1 0 100-2H7z" clip-rule="evenodd" /></svg>` : ''}
                        </div>
                        <p class="text-xs opacity-90">${formatDateInTimeZone(event.start, appState.timeZone, {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    <div class="text-xs opacity-80 mt-1 space-y-0.5 overflow-hidden flex-grow">
                        ${event.location ? `<p class="flex items-center truncate"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>${event.location}</p>` : ''}
                        ${(event.guests && event.guests.length > 0) ? `<p class="flex items-center truncate"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0110 14.07a5 5 0 01-1.5-1.4c-.046.327-.07.66-.07 1a7 7 0 001.07 3.84.5.5 0 00.86 0A7 7 0 0012.93 17zM10 12a4 4 0 100-8 4 4 0 000 8z" /></svg>${event.guests.length} ${event.guests.length > 1 ? 'guests' : 'guest'}</p>` : ''}
                        ${(event.attachments && event.attachments.length > 0) ? `<p class="flex items-center truncate"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a3 3 0 006 0V7a1 1 0 112 0v4a5 5 0 01-10 0V7a5 5 0 0110 0v4a1 1 0 11-2 0V7a3 3 0 00-3-3z" clip-rule="evenodd" /></svg>${event.attachments.length} ${event.attachments.length > 1 ? 'attachments' : 'attachment'}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');


        let html = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg h-full flex flex-col">
                <!-- Header row for days -->
                <div class="flex border-b border-gray-200 dark:border-gray-700">
                    <div class="w-14 shrink-0"></div> <!-- Spacer for time column -->
                    ${weekDates.map(date => {
                        const isToday = getYmdInZone(date, appState.timeZone) === todayYmd;
                        return `<div class="flex-1 text-center py-2 border-l border-gray-200 dark:border-gray-700">
                            <div class="text-xs uppercase text-gray-500">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                            <div class="text-2xl font-semibold ${isToday ? 'bg-blue-600 text-white rounded-full h-10 w-10 flex items-center justify-center mx-auto' : 'h-10 w-10 flex items-center justify-center mx-auto'}">${date.getDate()}</div>
                        </div>`;
                    }).join('')}
                </div>

                <!-- All Day events section -->
                <div class="border-b border-gray-200 dark:border-gray-700">
                    <div class="flex">
                        <div class="w-14 shrink-0 text-xs text-center py-1 text-gray-500 flex items-center justify-center">All Day</div>
                        <div id="all-day-container" class="flex-1 grid grid-cols-7 relative border-l border-gray-200 dark:border-gray-700">
                           ${allDayEventsHtml}
                           ${allDayTasksHtml}
                        </div>
                    </div>
                </div>

                <!-- Main timeline -->
                <div class="flex-1 overflow-auto relative">
                    <div class="flex h-full" style="min-height: ${24 * 4}rem;">
                        <!-- Time column -->
                        <div class="w-14 shrink-0 pr-2 text-right text-xs text-gray-500 dark:text-gray-400">
                            ${hours.map(hour => `<div class="h-16 flex items-start justify-end -translate-y-2">${hour > 0 ? formatTimeForAxis(hour) : ''}</div>`).join('')}
                        </div>

                        <!-- Day columns container -->
                        <div id="week-view-timeline" class="flex-1 grid grid-cols-7 relative">
                            <!-- Vertical grid lines -->
                            ${[...Array(7)].map((_, i) => `<div class="h-full ${i > 0 ? 'border-l' : ''} border-gray-200 dark:border-gray-700"></div>`).join('')}
                            
                            <!-- Horizontal grid lines -->
                            <div class="absolute inset-0 pointer-events-none">
                                ${hours.map(hour => `<div class="h-16 border-b border-gray-200 dark:border-gray-700"></div>`).join('')}
                            </div>
                            
                            <!-- Events container -->
                            <div class="absolute inset-0">
                                ${timedEventsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        viewContainer.innerHTML = html;
    };

    const renderDayView = () => {
        const date = appState.currentDate;
        const todayYmd = getYmdInZone(new Date(), appState.timeZone);
        const currentYmd = getYmdInZone(date, appState.timeZone);

        const hours = Array.from({ length: 24 }, (_, i) => i);
        const dayEvents = getEventsForDate(date);
        const dayTasks = getTasksForDate(date);

        const isOverdue = currentYmd < todayYmd;
        const isDueToday = currentYmd === todayYmd;
        
        const formatTimeForAxis = (hour) => new Date(0,0,0,hour).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

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
                <div class="task-item flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm cursor-move" draggable="true" data-task-id="${task.id}">
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
                            ${hours.map(hour => `<div class="h-16 flex items-start justify-end -translate-y-2">${hour > 0 ? formatTimeForAxis(hour) : ''}</div>`).join('')}
                        </div>
                        <div id="day-view-timeline" class="relative border-l border-gray-200 dark:border-gray-700">
                            ${hours.map(hour => `<div class="h-16 border-b border-gray-200 dark:border-gray-700"></div>`).join('')}
                            ${dayEvents.map(event => {
                                const startParts = getPartsInTimeZone(event.start, appState.timeZone);
                                const startTotalMinutes = startParts.hour * 60 + startParts.minute;
                                const top = (startTotalMinutes / (24 * 60)) * 100;
                                
                                const duration = (new Date(event.end).getTime() - new Date(event.start).getTime()) / (1000 * 60);
                                const height = (duration / (24 * 60)) * 100;
                                const linkedTask = event.taskId ? appState.tasks.find(t => t.id === event.taskId) : null;
                                
                                const timeOpts = {hour: '2-digit', minute:'2-digit'};
                                return `
                                    <div class="day-event absolute left-2 right-2 p-2 text-white rounded-lg shadow-md cursor-move" 
                                         style="top: ${top}%; height: ${Math.max(height, 2)}%; background-color: ${event.color};"
                                         data-event-id="${event.id}">
                                        <div class="resize-handle top" data-handle="top"></div>
                                        <div class="event-content h-full overflow-hidden flex flex-col justify-start">
                                            <div class="flex-shrink-0">
                                                <p class="font-bold text-sm truncate">${event.title}</p>
                                                <p class="text-xs opacity-90">${formatDateInTimeZone(event.start, appState.timeZone, timeOpts)} - ${formatDateInTimeZone(event.end, appState.timeZone, timeOpts)}</p>
                                            </div>
                                            <div class="text-xs opacity-80 mt-1 space-y-0.5 overflow-hidden flex-grow">
                                                ${event.location ? `<p class="flex items-center truncate"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" /></svg>${event.location}</p>` : ''}
                                                ${(event.guests && event.guests.length > 0) ? `<p class="flex items-center truncate"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0110 14.07a5 5 0 01-1.5-1.4c-.046.327-.07.66-.07 1a7 7 0 001.07 3.84.5.5 0 00.86 0A7 7 0 0012.93 17zM10 12a4 4 0 100-8 4 4 0 000 8z" /></svg>${event.guests.length} ${event.guests.length > 1 ? 'guests' : 'guest'}</p>` : ''}
                                                ${(event.attachments && event.attachments.length > 0) ? `<p class="flex items-center truncate"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8 4a3 3 0 00-3 3v4a3 3 0 006 0V7a1 1 0 112 0v4a5 5 0 01-10 0V7a5 5 0 0110 0v4a1 1 0 11-2 0V7a3 3 0 00-3-3z" clip-rule="evenodd" /></svg>${event.attachments.length} ${event.attachments.length > 1 ? 'attachments' : 'attachment'}</p>` : ''}
                                                ${linkedTask ? `<p class="flex items-center truncate" title="Linked Task: ${linkedTask.title}"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 mr-1 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fill-rule="evenodd" d="M4 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h4a1 1 0 100-2H7z" clip-rule="evenodd" /></svg>${linkedTask.title}</p>` : ''}
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
            await saveGistData({ events: appState.events, tasks: appState.tasks, tags: appState.tags });
        }
    };

    // --- Event & Task Logic ---

    const getEventsForDate = (date) => {
        const query = appState.searchQuery ? appState.searchQuery.toLowerCase().trim() : null;
        const { timeZone } = appState;
    
        const getPartsForRecurrence = (d, tz) => {
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                weekday: 'short',
                day: 'numeric',
                month: 'numeric',
            });
            const parts = formatter.formatToParts(d);
            const find = (type) => parts.find(p => p.type === type).value;
            const weekdayMap = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
            return {
                dayOfWeek: weekdayMap[find('weekday')],
                dayOfMonth: parseInt(find('day')),
                month: parseInt(find('month')) - 1,
            };
        };
    
        const dateYmd = getYmdInZone(date, timeZone);
        const checkDateParts = getPartsForRecurrence(date, timeZone);
        const startOfCheckDate = getStartOfDayInZone(date, timeZone);
    
        return appState.events.filter(event => {
            if (query) {
                const titleMatch = event.title && event.title.toLowerCase().includes(query);
                const descMatch = event.description && event.description.toLowerCase().includes(query);
                const locationMatch = event.location && event.location.toLowerCase().includes(query);
                if (!titleMatch && !descMatch && !locationMatch) {
                    return false;
                }
            }
    
            const eventStartUTC = new Date(event.start);
            const recurring = event.recurring;
    
            if (!recurring) {
                return getYmdInZone(eventStartUTC, timeZone) === dateYmd;
            }
    
            const startOfEventDate = getStartOfDayInZone(eventStartUTC, timeZone);
            if (startOfCheckDate < startOfEventDate) {
                return false;
            }
    
            if (recurring.endDate) {
                const recurrenceEndDate = getStartOfDayInZone(new Date(recurring.endDate + 'T00:00:00'), timeZone);
                if (startOfCheckDate > recurrenceEndDate) {
                    return false;
                }
            }
    
            const eventStartDateParts = getPartsForRecurrence(eventStartUTC, timeZone);
    
            switch (recurring.type) {
                case 'daily': return true;
                case 'weekly': return eventStartDateParts.dayOfWeek === checkDateParts.dayOfWeek;
                case 'monthly': return eventStartDateParts.dayOfMonth === checkDateParts.dayOfMonth;
                case 'yearly': return eventStartDateParts.dayOfMonth === checkDateParts.dayOfMonth && eventStartDateParts.month === checkDateParts.month;
                case 'custom': {
                    const interval = parseInt(recurring.interval, 10) || 1;
                    if (interval <= 0) return false;
    
                    const diffTime = startOfCheckDate.getTime() - startOfEventDate.getTime();
    
                    switch (recurring.unit) {
                        case 'days': {
                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                            return diffDays >= 0 && diffDays % interval === 0;
                        }
                        case 'weeks': {
                            if (eventStartDateParts.dayOfWeek !== checkDateParts.dayOfWeek) return false;
                            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) return false;
                            const diffWeeks = Math.floor(diffDays / 7);
                            return diffWeeks % interval === 0;
                        }
                        case 'months': {
                            if (eventStartDateParts.dayOfMonth !== checkDateParts.dayOfMonth) return false;
                            const yearDiff = date.getFullYear() - eventStartUTC.getFullYear();
                            const monthDiff = yearDiff * 12 + date.getMonth() - eventStartUTC.getMonth();
                            return monthDiff >= 0 && monthDiff % interval === 0;
                        }
                        default: return false;
                    }
                }
                default: return false;
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
            <div class="task-item flex items-center justify-between p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm cursor-move" draggable="true" data-task-id="${task.id}">
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
        modalTimezoneDisplay.textContent = appState.timeZone.replace(/_/g, ' ');

        // Populate linked task dropdown
        eventLinkedTaskInput.innerHTML = '<option value="">None</option>';
        const incompleteTasks = appState.tasks.filter(t => !t.completed);
        incompleteTasks.forEach(task => {
            const option = document.createElement('option');
            option.value = task.id;
            option.textContent = task.title;
            eventLinkedTaskInput.appendChild(option);
        });
        
        const timeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };

        if (eventId) {
            const event = appState.events.find(e => e.id === eventId);
            modalTitle.textContent = 'Edit Event';
            eventIdInput.value = event.id;
            eventTitleInput.value = event.title;
            eventDescriptionInput.value = event.description;
            eventLocationInput.value = event.location || '';
            eventOrganizationInput.value = event.organization || '';
            startTimeInput.value = formatDateInTimeZone(event.start, appState.timeZone, timeFormatOptions);
            endTimeInput.value = formatDateInTimeZone(event.end, appState.timeZone, timeFormatOptions);
            eventLinkedTaskInput.value = event.taskId || '';
            eventTagSelect.value = event.tagId || (appState.tags.length > 0 ? appState.tags[0].id : '');
            
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

            modalGuests = event.guests || [];
            modalAttachments = event.attachments || [];
            deleteEventBtn.classList.remove('hidden');
        } else {
            modalTitle.textContent = 'Add Event';
            const roundedMinutes = Math.ceil(new Date().getMinutes() / 15) * 15;
            const startDate = new Date(date);
            startDate.setHours(new Date().getHours(), roundedMinutes);

            const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
            
            startTimeInput.value = formatDateInTimeZone(startDate, appState.timeZone, timeFormatOptions);
            endTimeInput.value = formatDateInTimeZone(endDate, appState.timeZone, timeFormatOptions);

            eventLinkedTaskInput.value = '';
            eventRecurringInput.value = 'none';
            eventTagSelect.value = appState.tags.length > 0 ? appState.tags[0].id : '';
            deleteEventBtn.classList.add('hidden');
        }
        
        populateTagSelect();
        renderTagManager();
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

    // --- Tag Management ---
    const populateTagSelect = () => {
        eventTagSelect.innerHTML = '';
        appState.tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.id;
            option.textContent = tag.name;
            eventTagSelect.appendChild(option);
        });
        updateTagColorSwatch();
    };

    const updateTagColorSwatch = () => {
        const selectedTagId = eventTagSelect.value;
        const tag = appState.tags.find(t => t.id === selectedTagId);
        if (tag) {
            eventTagColorSwatch.style.backgroundColor = tag.color;
        } else {
             eventTagColorSwatch.style.backgroundColor = 'transparent';
        }
    };

    const renderTagManager = () => {
        tagManagementList.innerHTML = appState.tags.map(tag => `
            <div class="flex items-center space-x-2" data-tag-id="${tag.id}">
                <input type="color" value="${tag.color}" class="tag-color-input h-6 w-6" title="Change tag color">
                <input type="text" value="${tag.name}" class="tag-name-input block w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" placeholder="Tag name">
                <button type="button" class="delete-tag-btn text-gray-400 hover:text-red-500 font-bold text-lg flex-shrink-0" aria-label="Delete tag">&times;</button>
            </div>
        `).join('');
        // Set default color for new tag input
        newTagColorInput.value = colors[appState.tags.length % colors.length];
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
            case 'week': date.setDate(date.getDate() - 7); break;
            case 'day': date.setDate(date.getDate() - 1); break;
        }
        render();
    });

    nextBtn.addEventListener('click', () => {
        const date = appState.currentDate;
        switch (appState.viewMode) {
            case 'year': date.setFullYear(date.getFullYear() + 1); break;
            case 'month': date.setMonth(date.getMonth() + 1); break;
            case 'week': date.setDate(date.getDate() + 7); break;
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
        
        const taskEl = e.target.closest('.month-task, .week-task');
        if (taskEl) {
            appState.currentDate = new Date(taskEl.dataset.date);
            appState.viewMode = 'day';
            render();
            return;
        }

        const dayCell = e.target.closest('.day-cell');
        if (dayCell && !e.target.closest('[draggable="true"]') && !e.target.closest('.month-task')) { // Prevent changing view when clicking a draggable event or a task
            appState.currentDate = new Date(dayCell.dataset.date);
            appState.viewMode = 'day';
            render();
            return;
        }
        
        if (appState.viewMode === 'week') {
            const timeline = e.target.closest('#week-view-timeline');
            if (timeline && !e.target.closest('[data-event-id]')) {
                 const getDatesOfWeek = (date) => {
                    const { start } = getWeekRange(date);
                    return Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(start);
                        d.setDate(d.getDate() + i);
                        return d;
                    });
                };
                const weekDates = getDatesOfWeek(appState.currentDate);
                const rect = timeline.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const dayIndex = Math.floor(x / (rect.width / 7));
                const minutes = (y / rect.height) * 24 * 60;
                
                const clickedDate = new Date(weekDates[dayIndex]);
                clickedDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
                
                openEventModal(clickedDate);
                return;
            }
        }

        if (e.target.closest('.add-event-btn')) {
            const date = new Date(e.target.closest('.day-cell').dataset.date);
            openEventModal(date);
            return;
        }
        
        const eventEl = e.target.closest('[data-event-id]');
        if (eventEl) {
             const eventId = eventEl.dataset.eventId;
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

        const startDateTime = convertToUtc(appState.selectedDate, startTimeInput.value, appState.timeZone);
        const endDateTime = convertToUtc(appState.selectedDate, endTimeInput.value, appState.timeZone);

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

        const selectedTagId = eventTagSelect.value;
        const tag = appState.tags.find(t => t.id === selectedTagId);

        const eventData = {
            id: appState.editingEventId || Date.now().toString(),
            title: eventTitleInput.value,
            description: eventDescriptionInput.value,
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            color: tag ? tag.color : '#808080',
            tagId: selectedTagId || null,
            recurring: recurring,
            location: eventLocationInput.value.trim(),
            organization: eventOrganizationInput.value.trim(),
            guests: modalGuests,
            attachments: modalAttachments,
            taskId: eventLinkedTaskInput.value || null,
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

    // Tag listeners
    eventTagSelect.addEventListener('change', updateTagColorSwatch);

    addNewTagBtn.addEventListener('click', async () => {
        const newName = newTagNameInput.value.trim();
        if (!newName) {
            alert('Tag name cannot be empty.');
            return;
        }
        if (appState.tags.some(t => t.name.toLowerCase() === newName.toLowerCase())) {
            alert('A tag with this name already exists.');
            return;
        }

        const newTag = {
            id: `tag-${Date.now()}`,
            name: newName,
            color: newTagColorInput.value
        };
        appState.tags.push(newTag);
        newTagNameInput.value = '';
        
        populateTagSelect();
        renderTagManager(); // This will also reset the new tag color input to the next default
        eventTagSelect.value = newTag.id; // Select the new tag
        updateTagColorSwatch();
        await syncData();
    });

    tagManagementList.addEventListener('change', async e => {
        if (e.target.classList.contains('tag-name-input')) {
            const tagId = e.target.closest('[data-tag-id]').dataset.tagId;
            const newName = e.target.value.trim();
            if (!newName) {
                alert('Tag name cannot be empty.');
                e.target.value = appState.tags.find(t => t.id === tagId).name; // Revert
                return;
            }
            const tag = appState.tags.find(t => t.id === tagId);
            if (tag) {
                tag.name = newName;
                populateTagSelect(); // Update names in dropdown
                await syncData();
            }
        }

        if (e.target.classList.contains('tag-color-input')) {
            const tagId = e.target.closest('[data-tag-id]').dataset.tagId;
            const newColor = e.target.value;
            const tag = appState.tags.find(t => t.id === tagId);
            if (tag) {
                tag.color = newColor;

                appState.events.forEach(event => {
                    if (event.tagId === tagId) {
                        event.color = newColor;
                    }
                });
                
                updateTagColorSwatch();
                await syncData();
                render(); // Full re-render needed to update event colors in the calendar view
            }
        }
    });

    tagManagementList.addEventListener('click', async e => {
        if (e.target.classList.contains('delete-tag-btn')) {
            if (appState.tags.length <= 1) {
                alert("You must have at least one tag.");
                return;
            }

            const tagIdToDelete = e.target.closest('[data-tag-id]').dataset.tagId;
            const tagToDelete = appState.tags.find(t => t.id === tagIdToDelete);

            if (confirm(`Are you sure you want to delete the tag "${tagToDelete.name}"? This will not delete events, but they will be reassigned to the first available tag.`)) {
                appState.tags = appState.tags.filter(t => t.id !== tagIdToDelete);
                
                const defaultTagId = appState.tags[0].id;

                appState.events.forEach(event => {
                    if (event.tagId === tagIdToDelete) {
                        event.tagId = defaultTagId;
                        event.color = appState.tags[0].color;
                    }
                });

                populateTagSelect();
                renderTagManager();
                await syncData();
                render(); // Full re-render needed as event colors might have changed
            }
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
    const pixelsToMinutes = (pixels, timelineHeight) => (pixels / timelineHeight) * (24 * 60);

    document.addEventListener('dragstart', e => {
        const eventEl = e.target.closest('.month-event[draggable="true"]');
        const taskItem = e.target.closest('.task-item[draggable="true"]');

        if (appState.viewMode === 'month' && eventEl) {
            draggedElement = eventEl;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'event', id: eventEl.dataset.eventId }));
            setTimeout(() => eventEl.classList.add('opacity-40'), 0);
        } else if (taskItem) {
            const taskId = taskItem.dataset.taskId;
            draggedElement = taskItem;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'task', id: taskId }));
            setTimeout(() => taskItem.classList.add('opacity-40'), 0);
        }
    });

    document.addEventListener('dragend', () => {
        if (draggedElement) {
            draggedElement.classList.remove('opacity-40');
        }
        draggedElement = null;
        
        const placeholder = document.getElementById('event-placeholder');
        if (placeholder) {
            placeholder.remove();
        }
        
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over', 'bg-blue-100', 'dark:bg-blue-900', 'dark:bg-gray-700'));
    });
    
    let lastDragOverCell = null;
    viewContainer.addEventListener('dragover', (e) => {
        let dragData;
        try {
            if (e.dataTransfer.types.includes('application/json')) {
                dragData = JSON.parse(e.dataTransfer.getData('application/json'));
            }
        } catch (err) { /* ignore */ }

        const isTaskDrag = dragData && dragData.type === 'task';
        const timeline = e.target.closest('#day-view-timeline, #week-view-timeline');

        if (isTaskDrag && timeline) {
            e.preventDefault();
            let placeholder = document.getElementById('event-placeholder');
            if (!placeholder) {
                placeholder = document.createElement('div');
                placeholder.id = 'event-placeholder';
                timeline.appendChild(placeholder);
            }
            const timelineRect = timeline.getBoundingClientRect();
            const y = e.clientY - timelineRect.top;
            let minutes = pixelsToMinutes(y, timelineRect.height);
            minutes = Math.round(minutes / 15) * 15;
            
            const top = (minutes / (24 * 60)) * 100;
            const height = (60 / (24 * 60)) * 100; // 1-hour default duration

            placeholder.style.top = `${top}%`;
            placeholder.style.height = `${height}%`;
            
            if (appState.viewMode === 'week') {
                const x = e.clientX - timelineRect.left;
                const dayIndex = Math.floor(x / (timelineRect.width / 7));
                placeholder.style.left = `calc(${dayIndex} * (100% / 7) + 0.25rem)`;
                placeholder.style.width = `calc((100% / 7) - 0.5rem)`;
                placeholder.style.right = 'auto';
            } else {
                 placeholder.style.left = '0.5rem';
                 placeholder.style.right = '0.5rem';
                 placeholder.style.width = 'auto';
            }
            return;
        }

        const isEventDrag = dragData && dragData.type === 'event';
        if (isEventDrag && appState.viewMode === 'month') {
            e.preventDefault();
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
        const timeline = e.target.closest('#day-view-timeline, #week-view-timeline');
        if(timeline) {
            const placeholder = document.getElementById('event-placeholder');
            if (placeholder) placeholder.remove();
        }
    });

    viewContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        if(lastDragOverCell) {
            lastDragOverCell.classList.remove('drag-over', 'bg-blue-100', 'dark:bg-gray-700');
            lastDragOverCell = null;
        }
        
        let dragData;
        try {
            dragData = JSON.parse(e.dataTransfer.getData('application/json'));
        } catch (error) { return; }

        if (!dragData) return;
        
        const timeline = e.target.closest('#day-view-timeline, #week-view-timeline');
        if (dragData.type === 'task' && timeline) {
            const taskId = dragData.id;
            const task = appState.tasks.find(t => t.id === taskId);
            if (!task) return;

            const timelineRect = timeline.getBoundingClientRect();
            const y = e.clientY - timelineRect.top;
            let minutes = pixelsToMinutes(y, timelineRect.height);
            minutes = Math.round(minutes / 15) * 15;
            const timeString = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

            let dropDate;
            if (appState.viewMode === 'day') {
                dropDate = new Date(appState.currentDate);
            } else { // week view
                const weekDates = Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(getWeekRange(appState.currentDate).start);
                    d.setDate(d.getDate() + i);
                    return d;
                });
                const x = e.clientX - timelineRect.left;
                const dayIndex = Math.floor(x / (timelineRect.width / 7));
                dropDate = new Date(weekDates[dayIndex]);
            }

            const startDateTime = convertToUtc(dropDate, timeString, appState.timeZone);
            const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1 hour duration
            const defaultTag = appState.tags.length > 0 ? appState.tags[0] : { id: null, color: '#808080' };

            const newEvent = {
                id: Date.now().toString(),
                title: task.title,
                description: '',
                start: startDateTime.toISOString(),
                end: endDateTime.toISOString(),
                color: defaultTag.color,
                tagId: defaultTag.id,
                taskId: task.id,
                recurring: null,
                location: '',
                organization: '',
                guests: [],
                attachments: [],
            };

            appState.events.push(newEvent);
            task.completed = true;

            await syncData();
            render();
            
            const placeholder = document.getElementById('event-placeholder');
            if (placeholder) placeholder.remove();
            return;
        }

        if (dragData.type === 'event' && appState.viewMode === 'month') {
            const eventId = dragData.id;
            const event = appState.events.find(ev => ev.id === eventId);
            if (!event) return;

            const dayCell = e.target.closest('.day-cell');
            if (dayCell) {
                const newDate = new Date(dayCell.dataset.date);
                const originalStartUTC = new Date(event.start);
                const originalEndUTC = new Date(event.end);
                const duration = originalEndUTC.getTime() - originalStartUTC.getTime();

                // Get time parts of original event in the current timezone
                const originalTimeParts = getPartsInTimeZone(originalStartUTC, appState.timeZone);
                const timeString = `${String(originalTimeParts.hour).padStart(2, '0')}:${String(originalTimeParts.minute).padStart(2, '0')}`;

                const newStartUTC = convertToUtc(newDate, timeString, appState.timeZone);
                const newEndUTC = new Date(newStartUTC.getTime() + duration);

                event.start = newStartUTC.toISOString();
                event.end = newEndUTC.toISOString();
                
                await syncData();
                render();
            }
        }
    });

    // Custom Drag & Resize for Day View
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

        const startParts = getPartsInTimeZone(newStart, appState.timeZone);
        const startTotalMinutes = startParts.hour * 60 + startParts.minute;
        const top = (startTotalMinutes / (24 * 60)) * 100;
        
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

            let finalTagId = null;
            if (event.tagId && appState.tags.find(t => t.id === event.tagId)) {
                finalTagId = event.tagId;
            } else if (event.tagName) {
                let tag = appState.tags.find(t => t.name.toLowerCase() === event.tagName.toLowerCase());
                if (tag) {
                    finalTagId = tag.id;
                } else {
                    const newTag = { id: event.tagId || `tag-${Date.now()}`, name: event.tagName, color: colors[appState.tags.length % colors.length] };
                    appState.tags.push(newTag);
                    finalTagId = newTag.id;
                }
            }

            const tag = appState.tags.find(t => t.id === finalTagId);

            const formattedEvent = {
                ...event,
                guests: event.guests ? event.guests.split(',').map(g => g.trim()).filter(Boolean) : [],
                attachments: event.attachments ? event.attachments.split(',').map(a => a.trim()).filter(Boolean) : [],
                recurring: recurring,
                tagId: finalTagId,
                color: tag ? tag.color : '#808080',
            };
            
            delete formattedEvent.recurring_type;
            delete formattedEvent.recurring_interval;
            delete formattedEvent.recurring_unit;
            delete formattedEvent.recurring_endDate;
            delete formattedEvent.tagName;

            
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

        const eventsToExport = appState.events.map(event => {
            const tag = appState.tags.find(t => t.id === event.tagId);
            return {
                ...event,
                tagName: tag ? tag.name : '',
            };
        });

        const headers = [
            { key: 'id', label: 'id' },
            { key: 'title', label: 'title' },
            { key: 'description', label: 'description' },
            { key: 'start', label: 'start' },
            { key: 'end', label: 'end' },
            { key: 'tagId', label: 'tagId' },
            { key: 'tagName', label: 'tagName' },
            { key: 'location', label: 'location' },
            { key: 'organization', label: 'organization' },
            { key: 'guests', label: 'guests', formatter: (guests) => (guests || []).join(', ') },
            { key: 'attachments', label: 'attachments', formatter: (attachments) => (attachments || []).join(', ') },
            { key: 'recurring.type', label: 'recurring_type' },
            { key: 'recurring.interval', label: 'recurring_interval' },
            { key: 'recurring.unit', label: 'recurring_unit' },
            { key: 'recurring.endDate', label: 'recurring_endDate' },
            { key: 'taskId', label: 'taskId' },
        ];

        const csvContent = convertToCsv(eventsToExport, headers);
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
            
            const eventDate = new Date(parsedData.date + "T00:00:00"); // Use a neutral time
            const startDateTime = convertToUtc(eventDate, parsedData.startTime, appState.timeZone);
            const endDateTime = convertToUtc(eventDate, parsedData.endTime, appState.timeZone);

            if (endDateTime < startDateTime) {
                endDateTime.setDate(endDateTime.getDate() + 1);
            }

            const defaultTag = appState.tags.length > 0 ? appState.tags[0] : { id: null, color: '#808080' };

            const newEvent = {
                id: Date.now().toString(),
                title: parsedData.title,
                description: '',
                start: startDateTime.toISOString(),
                end: endDateTime.toISOString(),
                color: defaultTag.color,
                tagId: defaultTag.id,
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
        
        if (timezoneSelect.options.length === 0) { // Populate only once
            try {
                const timezones = Intl.supportedValuesOf('timeZone');
                timezones.forEach(tz => {
                    const option = document.createElement('option');
                    option.value = tz;
                    option.textContent = tz.replace(/_/g, ' ');
                    timezoneSelect.appendChild(option);
                });
            } catch (e) {
                // Fallback for older browsers
                const option = document.createElement('option');
                option.value = appState.timeZone;
                option.textContent = appState.timeZone;
                timezoneSelect.appendChild(option);
                console.warn("Intl.supportedValuesOf is not available.");
            }
        }
        timezoneSelect.value = appState.timeZone;

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
        const newTimeZone = timezoneSelect.value;

        settingsError.classList.add('hidden');
        settingsSuccess.classList.add('hidden');

        let shouldReRender = false;
        if (newTimeZone !== appState.timeZone) {
            appState.timeZone = newTimeZone;
            localStorage.setItem('timeZone', newTimeZone);
            shouldReRender = true;
        }

        if (!pat || !id) {
            settingsError.textContent = "Both GitHub PAT and Gist ID are required for sync.";
            settingsError.classList.remove('hidden');
            if(shouldReRender) render();
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
             if(shouldReRender) render();
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
    const getDefaultTags = () => {
        return [
            { id: 'tag-1', name: 'Work', color: colors[0] },
            { id: 'tag-2', name: 'Personal', color: colors[1] },
            { id: 'tag-3', name: 'Important', color: colors[5] },
        ];
    };

    const initializeApp = async () => {
        appState.isDataLoaded = false;
        render();

        if (appState.gistPat && appState.gistId) {
            const data = await getGistData();
            if (data) {
                appState.tasks = data.tasks || [];
                appState.tags = data.tags || getDefaultTags();
                
                // Data migration for recurrence and tags
                appState.events = (data.events || []).map(event => {
                    const migratedEvent = { ...event };
                    
                    // Migrate recurrence
                    if (typeof migratedEvent.recurring === 'string') {
                        migratedEvent.recurring = (migratedEvent.recurring === 'none') ? null : { type: migratedEvent.recurring };
                    } else if (migratedEvent.recurring && migratedEvent.recurring.type === 'none') {
                        migratedEvent.recurring = null;
                    }

                    // Migrate color to tags for old events
                    if (!migratedEvent.tagId) {
                        let tag = appState.tags.find(t => t.color === migratedEvent.color);
                        if (!tag) {
                             tag = appState.tags[0] || { id: null };
                        }
                        migratedEvent.tagId = tag.id;
                    }

                    // Ensure color is consistent with tag
                    const eventTag = appState.tags.find(t => t.id === migratedEvent.tagId);
                    migratedEvent.color = eventTag ? eventTag.color : '#808080';

                    return migratedEvent;
                });

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
            appState.tags = getDefaultTags();
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