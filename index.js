document.addEventListener('DOMContentLoaded', () => {
    const appState = {
        currentDate: new Date(),
        viewMode: 'month', // 'day', 'month', 'year'
        events: JSON.parse(localStorage.getItem('schedule_events')) || [],
        selectedDate: new Date(),
        editingEventId: null,
    };

    const colors = ['#0284c7', '#16a34a', '#ca8a04', '#c026d3', '#db2777', '#dc2626'];
    let selectedColor = colors[0];

    // --- DOM Elements ---
    const headerText = document.getElementById('header-text');
    const viewContainer = document.getElementById('view-container');
    const viewSwitcher = document.getElementById('view-switcher');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const todayBtn = document.getElementById('today-btn');
    
    // Modal Elements
    const eventModal = document.getElementById('event-modal');
    const eventForm = document.getElementById('event-form');
    const modalTitle = document.getElementById('modal-title');
    const eventIdInput = document.getElementById('event-id');
    const eventTitleInput = document.getElementById('event-title');
    const eventDescriptionInput = document.getElementById('event-description');
    const startTimeInput = document.getElementById('start-time');
    const endTimeInput = document.getElementById('end-time');
    const eventRecurringInput = document.getElementById('event-recurring');
    const colorPicker = document.getElementById('color-picker');
    const modalError = document.getElementById('modal-error');
    const saveEventBtn = document.getElementById('save-event-btn');
    const deleteEventBtn = document.getElementById('delete-event-btn');
    const cancelBtn = document.getElementById('cancel-btn');


    // --- State Management & Rendering ---

    const saveEvents = () => {
        localStorage.setItem('schedule_events', JSON.stringify(appState.events));
    };

    const render = () => {
        viewContainer.style.opacity = '0';
        setTimeout(() => {
            updateHeader();
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
                headerText.textContent = appState.currentDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
                break;
            case 'day':
                headerText.textContent = appState.currentDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                break;
        }

        // Update active view button
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
        const monthNames = Array.from({ length: 12 }, (_, i) => new Date(0, i).toLocaleString('default', { month: 'long' }));
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
        const weekDayNames = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, i + 1).toLocaleString('default', { weekday: 'short' }));

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

            html += `
                <div class="day-cell relative p-2 border-r border-b border-gray-200 dark:border-gray-700 flex flex-col group hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer" data-date="${currentDate.toISOString()}">
                    <time datetime="${currentDate.toISOString()}" class="text-sm font-medium ${isTodayClass}">${day}</time>
                    <div class="mt-1 space-y-1 overflow-y-auto max-h-24">
                        ${dayEvents.slice(0, 2).map(event => `<div class="text-xs px-1.5 py-0.5 rounded text-white" style="background-color: ${event.color};">${event.title}</div>`).join('')}
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

        const formatTime = (hour) => new Date(0,0,0,hour).toLocaleTimeString([], { hour: 'numeric', hour12: true });

        let html = `
            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-lg flex flex-col h-full">
                <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <h3 class="text-lg font-semibold">${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
                    <button id="day-add-event" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">Add Event</button>
                </div>
                <div class="flex-1 overflow-auto relative">
                    <div class="grid grid-cols-[auto,1fr] h-full" style="min-height: ${24 * 4}rem;">
                        <div class="pr-2 text-right text-xs text-gray-500 dark:text-gray-400">
                            ${hours.map(hour => `<div class="h-16 flex items-start justify-end -translate-y-2">${hour > 0 ? formatTime(hour) : ''}</div>`).join('')}
                        </div>
                        <div class="relative border-l border-gray-200 dark:border-gray-700">
                            ${hours.map(hour => `<div class="h-16 border-b border-gray-200 dark:border-gray-700"></div>`).join('')}
                            ${dayEvents.map(event => {
                                const start = new Date(event.start);
                                const end = new Date(event.end);
                                const top = (start.getHours() * 60 + start.getMinutes()) / (24 * 60) * 100;
                                const duration = (end.getTime() - start.getTime()) / (1000 * 60);
                                const height = (duration / (24 * 60)) * 100;
                                return `
                                    <div class="day-event absolute left-2 right-2 p-2 text-white rounded-lg shadow-md cursor-pointer overflow-hidden" 
                                         style="top: ${top}%; height: ${Math.max(height, 2)}%; background-color: ${event.color};"
                                         data-event-id="${event.id}">
                                        <p class="font-bold text-sm">${event.title}</p>
                                        <p class="text-xs">${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
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
    };


    // --- Event Logic ---

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
    

    // --- Modal Logic ---

    const openEventModal = (date, eventId = null) => {
        appState.selectedDate = date;
        appState.editingEventId = eventId;
        eventForm.reset();
        modalError.classList.add('hidden');

        if (eventId) {
            const event = appState.events.find(e => e.id === eventId);
            modalTitle.textContent = 'Edit Event';
            eventIdInput.value = event.id;
            eventTitleInput.value = event.title;
            eventDescriptionInput.value = event.description;
            startTimeInput.value = new Date(event.start).toTimeString().substring(0, 5);
            endTimeInput.value = new Date(event.end).toTimeString().substring(0, 5);
            eventRecurringInput.value = event.recurring || 'none';
            selectedColor = event.color;
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
        eventModal.classList.add('is-open');
    };

    const closeEventModal = () => {
        eventModal.classList.remove('is-open');
        appState.editingEventId = null;
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

    viewContainer.addEventListener('click', (e) => {
        const monthBtn = e.target.closest('.month-btn');
        if (monthBtn) {
            appState.currentDate.setMonth(parseInt(monthBtn.dataset.month, 10));
            appState.viewMode = 'month';
            render();
            return;
        }

        const dayCell = e.target.closest('.day-cell');
        if (dayCell) {
            appState.currentDate = new Date(dayCell.dataset.date);
            appState.viewMode = 'day';
            render();
        }

        if (e.target.closest('.add-event-btn')) {
            const date = new Date(e.target.closest('.day-cell').dataset.date);
            openEventModal(date);
        }
        
        const dayEvent = e.target.closest('.day-event');
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

    eventForm.addEventListener('submit', (e) => {
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
        };

        if (appState.editingEventId) {
            appState.events = appState.events.map(event => event.id === appState.editingEventId ? eventData : event);
        } else {
            appState.events.push(eventData);
        }

        saveEvents();
        closeEventModal();
        render();
    });
    
    deleteEventBtn.addEventListener('click', () => {
        if (!appState.editingEventId) return;
        appState.events = appState.events.filter(event => event.id !== appState.editingEventId);
        saveEvents();
        closeEventModal();
        render();
    });

    // --- Initial Load ---
    render();
});
