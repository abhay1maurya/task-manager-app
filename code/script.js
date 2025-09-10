// DOM Elements
const themeToggle = document.getElementById('theme-toggle');
const taskForm = document.getElementById('task-form');
const taskTitleInput = document.getElementById('edit-title');
const addTodoBtn = document.getElementById('add-todo-btn');
const todoList = document.getElementById('todo-list');
const progressList = document.getElementById('progress-list');
const completedList = document.getElementById('completed-list');
const progressFill = document.getElementById('progress-fill');
const taskCount = document.getElementById('task-count');
const progressPercentage = document.getElementById('progress-percentage');
const taskModal = document.getElementById('task-modal');
const closeModalBtn = document.getElementById('close-modal');
const cancelEditBtn = document.getElementById('cancel-edit');
const undoToast = document.getElementById('undo-toast');
const undoDeleteBtn = document.getElementById('undo-delete');
const currentYearSpan = document.getElementById('current-year');

// Application State
let tasks = [];
let lastDeletedTask = null;
let undoTimeout = null;
let timers = {};
let sortState = {
    todo: 'newest' // Default sort order for todo list
};


// Initialize the application
function init() {
    loadTasks();
    loadTheme();
    setupEventListeners();
    updateCurrentYear();
    renderTasks();
    updateProgress();
    startTimers();
    startCountdownUpdates();
    updateStats(); 
    updateFooterStats();
}

// Load tasks from localStorage with error handling
function loadTasks() {
    try {
        const storedTasks = localStorage.getItem('tasks');
        if (storedTasks) {
            tasks = JSON.parse(storedTasks);
            
            // Validate loaded data
            if (!Array.isArray(tasks)) {
                throw new Error('Invalid tasks data structure');
            }
        }
    } catch (e) {
        console.error('Failed to load tasks:', e);
        tasks = [];
        alert('Failed to load tasks. Starting with empty task list.');
    }
}

// Save tasks to localStorage with error handling
function saveTasks() {
    try {
        localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (e) {
        console.error('Failed to save tasks:', e);
        alert('Failed to save tasks. Local storage might be full or disabled.');
        
        // Try to free up space by removing old data
        try {
            localStorage.removeItem('tasks');
            localStorage.setItem('tasks', JSON.stringify(tasks));
        } catch (retryError) {
            console.error('Failed to save tasks after cleanup:', retryError);
        }
    }
}

// Load theme preference from localStorage
function loadTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Set up all event listeners
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // Add task button
    addTodoBtn.addEventListener('click', () => openAddModal('To Do'));
    
    // Modal handling
    closeModalBtn.addEventListener('click', closeModal);
    cancelEditBtn.addEventListener('click', closeModal);
    
    // Form submission
    taskForm.addEventListener('submit', handleFormSubmit);
    
    // Undo functionality
    undoDeleteBtn.addEventListener('click', undoDelete);
    
    // Search functionality
    document.querySelectorAll('.search-box input').forEach(input => {
        input.addEventListener('input', (e) => {
            const column = e.target.closest('.dashboard-column');
            const status = column.classList.contains('todo-column') ? 'To Do' : 
                          column.classList.contains('progress-column') ? 'In Progress' : 'Completed';
            filterTasks(status, e.target.value);
        });
    });

    // Initialize custom dropdown
    initCustomDropdown();

    // Sorting functionality
    // Remove the old select event listener and replace with:
    document.getElementById('apply-sort').addEventListener('click', applySort);
    document.getElementById('todo-sort').addEventListener('change', (e) => {
        sortState.todo = e.target.value;
        applySort(); // Apply sort immediately when selection changes
    });
    
    // Load saved sort preference
    const savedSort = localStorage.getItem('todoSort');
    if (savedSort) {
        sortState.todo = savedSort;
        document.getElementById('todo-sort').value = savedSort;
    }

}

// Update the current year in the footer
function updateCurrentYear() {
    currentYearSpan.textContent = new Date().getFullYear();
}

// Toggle between light and dark theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update both header and footer theme toggles
    document.querySelector('#theme-toggle').textContent = newTheme === 'dark' ? '☀️' : '🌙';
    const footerToggle = document.querySelector('#theme-toggle-footer');
    if (footerToggle) {
        footerToggle.textContent = newTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    }
}

// Open add task modal
function openAddModal(status) {
    document.getElementById('modal-title').textContent = 'Add New Task';
    document.getElementById('edit-id').value = '';
    document.getElementById('edit-title').value = '';
    document.getElementById('edit-description').value = '';
    document.getElementById('edit-priority').value = 'Medium';
    document.getElementById('edit-dueDate').value = '';
    document.getElementById('edit-dueTime').value = '';
    
    taskModal.classList.add('active');
}

// Close modal
function closeModal() {
    taskModal.classList.remove('active');
}

// Handle form submission for adding/editing tasks
function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('edit-id').value || generateId();
    const title = document.getElementById('edit-title').value;
    const description = document.getElementById('edit-description').value;
    const priority = document.getElementById('edit-priority').value;
    const dueDate = document.getElementById('edit-dueDate').value;
    const dueTime = document.getElementById('edit-dueTime').value;
    
    if (!title) {
        alert('Please enter a task title');
        return;
    }
    
    // Combine date and time into a single datetime string
    let dueDateTime = null;
    if (dueDate && dueTime) {
        dueDateTime = `${dueDate}T${dueTime}:00`;
    }
    
    // Check if we're editing an existing task
    const existingTaskIndex = tasks.findIndex(task => task.id === id);
    
    if (existingTaskIndex !== -1) {
        // Update existing task
        tasks[existingTaskIndex].title = title;
        tasks[existingTaskIndex].description = description;
        tasks[existingTaskIndex].priority = priority;
        tasks[existingTaskIndex].dueDateTime = dueDateTime;
    } else {
        // Create new task
        const newTask = {
            id: id,
            title: title,
            description: description,
            dueDateTime: dueDateTime,
            priority: priority,
            status: 'To Do',
            createdAt: new Date().toISOString(),
            startedAt: null,
            completedAt: null,
            timeSpent: 0
        };
        
        tasks.unshift(newTask);
    }
    
    saveTasks();
    renderTasks();
    updateProgress();
    closeModal();
    updateFooterStats();
}

// Generate a unique ID for tasks
function generateId() {
    return 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Render tasks in their respective columns
function renderTasks() {
    // Clear all lists
    todoList.innerHTML = '';
    progressList.innerHTML = '';
    completedList.innerHTML = '';
    
    // Show empty states if no tasks
    if (tasks.filter(task => task.status === 'To Do').length === 0) {
        todoList.innerHTML = '<div class="empty-state"><p>No tasks to do. Add a new task to get started!</p></div>';
    } else {
        // Apply sorting to todo tasks
        applySort();
    }
    
    if (tasks.filter(task => task.status === 'In Progress').length === 0) {
        progressList.innerHTML = '<div class="empty-state"><p>No tasks in progress. Start a task to track time!</p></div>';
    } else {
        // Render in-progress tasks (no sorting applied)
        tasks.filter(task => task.status === 'In Progress').forEach(task => {
            const taskElement = createTaskElement(task);
            progressList.appendChild(taskElement);
        });
    }
    
    if (tasks.filter(task => task.status === 'Completed').length === 0) {
        completedList.innerHTML = '<div class="empty-state"><p>No tasks completed yet. Complete a task to see it here!</p></div>';
    } else {
        // Render completed tasks (no sorting applied)
        tasks.filter(task => task.status === 'Completed').forEach(task => {
            const taskElement = createTaskElement(task);
            completedList.appendChild(taskElement);
        });
    }
    
    // Update the separate statistics section
    updateStats();
}

// Create DOM element for a task
function createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.id = task.id;
    taskElement.className = `task-card ${task.status.toLowerCase().replace(' ', '-')}`;
    
    // Calculate time remaining if dueDateTime exists
    let timeRemainingHtml = '';
    let isOverdue = false;
    
    if (task.dueDateTime && task.status !== 'Completed') {
        const now = new Date();
        const dueDate = new Date(task.dueDateTime);
        const timeDiff = dueDate - now;
        
        isOverdue = timeDiff < 0;
        
        // Format time remaining
        const absTimeDiff = Math.abs(timeDiff);
        const days = Math.floor(absTimeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((absTimeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((absTimeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        let timeRemainingClass = '';
        if (isOverdue) {
            timeRemainingClass = 'urgent';
        } else if (days < 1) {
            timeRemainingClass = 'soon';
        }
        
        let timeText = '';
        if (days > 0) {
            timeText = `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            timeText = `${hours}h ${minutes}m`;
        } else {
            timeText = `${minutes}m`;
        }
        
        timeRemainingHtml = `
            <div class="time-remaining ${timeRemainingClass}">
                <i class="far ${isOverdue ? 'fa-exclamation-circle' : 'fa-clock'}"></i>
                ${isOverdue ? 'Overdue by' : 'Due in'}: ${timeText}
            </div>
        `;
    }
    
    const formattedDateTime = task.dueDateTime ? formatDateTime(task.dueDateTime) : '';
    
    // Generate completion info for completed tasks
    let completionInfoHtml = '';
    if (task.status === 'Completed') {
        let performanceIndicator = '';
        
        if (task.timeToComplete) {
            const timeToCompleteFormatted = formatTime(task.timeToComplete);
            
            // Add performance indicator if efficiency is calculated
            if (task.efficiency) {
                let performanceClass = 'performance-average';
                let performanceText = 'Average';
                
                if (task.efficiency < 70) {
                    performanceClass = 'performance-fast';
                    performanceText = 'Fast';
                } else if (task.efficiency > 130) {
                    performanceClass = 'performance-slow';
                    performanceText = 'Slow';
                }
                
                performanceIndicator = `<span class="performance-indicator ${performanceClass}">${performanceText}</span>`;
            }
            
            completionInfoHtml = `
                <div class="completion-info">
                    <div>
                        <i class="fas fa-stopwatch"></i>
                        Time spent: <span class="time-stat">${timeToCompleteFormatted}</span>
                        ${performanceIndicator}
                    </div>
                    <div>
                        <i class="far fa-calendar-check"></i>
                        Completed on: ${formatDate(task.completedAt)}
                    </div>
                </div>
            `;
        } else {
            completionInfoHtml = `
                <div class="completion-info">
                    <div>
                        <i class="far fa-calendar-check"></i>
                        Completed on: ${formatDate(task.completedAt)}
                    </div>
                </div>
            `;
        }
    }
    
    taskElement.innerHTML = `
        <div class="task-header">
            <h3 class="task-title">${escapeHtml(task.title)}</h3>
            <span class="task-priority priority-${task.priority}">${task.priority}</span>
        </div>
        
        ${task.dueDateTime ? `
            <div class="task-dueDate ${isOverdue ? 'overdue' : ''}">
                <i class="far fa-calendar-alt"></i>
                Due: ${formattedDateTime}
            </div>
            ${timeRemainingHtml}
        ` : ''}
        
        ${task.status === 'In Progress' ? `
            <div class="task-timer">
                <i class="far fa-clock"></i>
                Time spent: ${formatTime(task.timeSpent)}
            </div>
        ` : ''}
        
        ${task.description ? `
            <div class="task-description">${escapeHtml(task.description)}</div>
        ` : ''}
        
        ${completionInfoHtml}
        
        <div class="task-footer">
            <div class="task-actions">
                ${task.status === 'To Do' ? `
                    <button class="start-btn" onclick="startTask('${task.id}')">
                        <i class="fas fa-play"></i> Start
                    </button>
                ` : ''}
                
                ${task.status === 'In Progress' ? `
                    <button class="complete-btn" onclick="completeTask('${task.id}')">
                        <i class="fas fa-check"></i> Complete
                    </button>
                ` : ''}
                
                ${task.status === 'Completed' ? `
                    <button class="start-btn" onclick="reopenTask('${task.id}')">
                        <i class="fas fa-redo"></i> Reopen
                    </button>
                ` : ''}
                
                <button class="edit-btn" onclick="editTask('${task.id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                
                <button class="delete-btn" onclick="deleteTask('${task.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;
    
    return taskElement;
}
// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Format date for display
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// Format time for display
// Format time for display (improved for longer durations)
function formatTime(seconds) {
    if (!seconds) return "0s";
    
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

// Start a task (change status to In Progress)
function startTask(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        task.status = 'In Progress';
        task.startedAt = new Date().toISOString();
        
        // Start timer for this task
        startTimer(taskId);
        
        saveTasks();
        renderTasks();
        updateProgress();
        updateFooterStats();
    }
}

// Complete a task
function completeTask(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        task.status = 'Completed';
        task.completedAt = new Date().toISOString();
        
        // Calculate time to complete if task was in progress
        if (task.startedAt) {
            const startTime = new Date(task.startedAt);
            const endTime = new Date();
            task.timeToComplete = Math.floor((endTime - startTime) / 1000); // in seconds
            
            // Calculate efficiency (time spent vs estimated time if available)
            if (task.dueDateTime && task.startedAt) {
                const dueDate = new Date(task.dueDateTime);
                const startDate = new Date(task.startedAt);
                const estimatedTime = Math.floor((dueDate - startDate) / 1000);
                
                if (estimatedTime > 0) {
                    task.efficiency = Math.min(100, Math.floor((task.timeToComplete / estimatedTime) * 100));
                }
            }
        }
        
        // Stop timer for this task
        stopTimer(taskId);
        
        saveTasks();
        renderTasks();
        updateProgress();
        updateStats(); // Update the statistics display
        updateFooterStats();
    }
}

// Edit a task
function editTask(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (task) {
        document.getElementById('modal-title').textContent = 'Edit Task';
        document.getElementById('edit-id').value = task.id;
        document.getElementById('edit-title').value = task.title;
        document.getElementById('edit-description').value = task.description;
        document.getElementById('edit-priority').value = task.priority;
        
        // Set date and time separately
        if (task.dueDateTime) {
            const dueDate = new Date(task.dueDateTime);
            document.getElementById('edit-dueDate').value = dueDate.toISOString().split('T')[0];
            document.getElementById('edit-dueTime').value = 
                `${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;
        } else {
            document.getElementById('edit-dueDate').value = '';
            document.getElementById('edit-dueTime').value = '23:59';
        }
        
        taskModal.classList.add('active');
    }
}
// Delete a task
function deleteTask(taskId) {
    const taskIndex = tasks.findIndex(task => task.id === taskId);
    
    if (taskIndex !== -1) {
        // Store the deleted task for possible undo
        lastDeletedTask = {
            task: tasks[taskIndex],
            index: taskIndex
        };
        
        // Stop timer if task is in progress
        if (tasks[taskIndex].status === 'In Progress') {
            stopTimer(taskId);
        }
        
        // Remove the task with animation
        const taskElement = document.getElementById(taskId);
        if (taskElement) {
            taskElement.classList.add('deleting');
            setTimeout(() => {
                tasks.splice(taskIndex, 1);
                saveTasks();
                renderTasks();
                updateProgress();
                updateStats(); // Update statistics
                showUndoToast();
                updateFooterStats();
            }, 300);
        } else {
            tasks.splice(taskIndex, 1);
            saveTasks();
            renderTasks();
            updateProgress();
            updateStats(); // Update statistics
            showUndoToast();
        }
    }
}

// Show undo toast notification
function showUndoToast() {
    undoToast.classList.add('show');
    
    if (undoTimeout) {
        clearTimeout(undoTimeout);
    }
    
    undoTimeout = setTimeout(() => {
        undoToast.classList.remove('show');
        lastDeletedTask = null;
    }, 5000);
}

// Undo the last delete action
function undoDelete() {
    if (lastDeletedTask) {
        tasks.splice(lastDeletedTask.index, 0, lastDeletedTask.task);
        
        // Restart timer if task was in progress
        if (lastDeletedTask.task.status === 'In Progress') {
            startTimer(lastDeletedTask.task.id);
        }
        
        saveTasks();
        renderTasks();
        updateProgress();
        
        undoToast.classList.remove('show');
        lastDeletedTask = null;
        
        if (undoTimeout) {
            clearTimeout(undoTimeout);
            undoTimeout = null;
        }
    }
}

// Start timer for a task
function startTimer(taskId) {
    stopTimer(taskId);
    const task = tasks.find(task => task.id === taskId);
    if (!task) return;
    
    // Update the last timer check timestamp
    const now = new Date().getTime();
    task.lastTimerCheck = now;
    
    timers[taskId] = setInterval(() => {
        const currentTime = new Date().getTime();
        const timeDiff = Math.floor((currentTime - task.lastTimerCheck) / 1000);
        task.timeSpent += timeDiff;
        task.lastTimerCheck = currentTime;
        
        const timerElement = document.querySelector(`#${taskId} .task-timer`);
        if (timerElement) {
            timerElement.innerHTML = `<i class="far fa-clock"></i> Time spent: ${formatTime(task.timeSpent)}`;
        }
        
        if (task.timeSpent % 10 === 0) {
            saveTasks();
        }
    }, 1000);
}

// Stop timer for a task
function stopTimer(taskId) {
    if (timers[taskId]) {
        clearInterval(timers[taskId]);
        delete timers[taskId];
    }
}

// Start all timers for in-progress tasks
function startTimers() {
    tasks.filter(task => task.status === 'In Progress').forEach(task => {
        startTimer(task.id);
    });
}

// Update progress bar and counters
function updateProgress() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'Completed').length;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    progressFill.style.width = `${percentage}%`;
    taskCount.textContent = `${completedTasks} of ${totalTasks} tasks completed`;
    progressPercentage.textContent = `${percentage}%`;
    
    // Update progress bar color based on percentage
    if (percentage < 30) {
        progressFill.style.backgroundColor = 'var(--danger-color)';
    } else if (percentage < 70) {
        progressFill.style.backgroundColor = 'var(--warning-color)';
    } else {
        progressFill.style.backgroundColor = 'var(--success-color)';
    }
}

// Filter tasks based on search input
function filterTasks(status, searchText) {
    const filteredTasks = tasks.filter(task => {
        if (task.status !== status) return false;
        
        if (!searchText) return true;
        
        const searchLower = searchText.toLowerCase();
        return (
            task.title.toLowerCase().includes(searchLower) ||
            (task.description && task.description.toLowerCase().includes(searchLower))
        );
    });
    
    const listId = status === 'To Do' ? 'todo-list' : 
                  status === 'In Progress' ? 'progress-list' : 'completed-list';
    const listElement = document.getElementById(listId);
    
    // Clear the list
    listElement.innerHTML = '';
    
    // Show empty state if no tasks
    if (filteredTasks.length === 0) {
        const emptyText = searchText ? 
            `No ${status.toLowerCase()} tasks matching "${searchText}"` : 
            `No ${status.toLowerCase()} tasks`;
        
        listElement.innerHTML = `<div class="empty-state"><p>${emptyText}</p></div>`;
        return;
    }
    
    // Render filtered tasks
    filteredTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        listElement.appendChild(taskElement);
    });
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Cleanup intervals on page unload
window.addEventListener('unload', () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    // Clear all task timers
    Object.keys(timers).forEach(taskId => {
        stopTimer(taskId);
    });
});

// Format datetime for display
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString(undefined, options);
}

// Add to the init function
function init() {
    loadTasks();
    loadTheme();
    setupEventListeners();
    updateCurrentYear();
    renderTasks();
    updateProgress();
    startTimers();
    
    // Start countdown updates for due dates
    startCountdownUpdates();
}

// Global variable for countdown interval
let countdownInterval;

// Add this function to update countdowns in real-time
function startCountdownUpdates() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    
    countdownInterval = setInterval(() => {
        const timeRemainingElements = document.querySelectorAll('.time-remaining');
        timeRemainingElements.forEach(element => {
            const taskId = element.closest('.task-card').id;
            const task = tasks.find(t => t.id === taskId);
            
            if (task && task.dueDateTime && task.status !== 'Completed') {
                const now = new Date();
                const dueDate = new Date(task.dueDateTime);
                const timeDiff = dueDate - now;
                
                const absTimeDiff = Math.abs(timeDiff);
                const days = Math.floor(absTimeDiff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((absTimeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((absTimeDiff % (1000 * 60 * 60)) / (1000 * 60));
                
                let timeRemainingClass = '';
                if (timeDiff < 0) {
                    timeRemainingClass = 'urgent';
                } else if (days < 1) {
                    timeRemainingClass = 'soon';
                }
                
                let timeText = '';
                if (days > 0) {
                    timeText = `${days}d ${hours}h ${minutes}m`;
                } else if (hours > 0) {
                    timeText = `${hours}h ${minutes}m`;
                } else {
                    timeText = `${minutes}m`;
                }
                
                element.className = `time-remaining ${timeRemainingClass}`;
                element.innerHTML = `
                    <i class="far ${timeDiff < 0 ? 'fa-exclamation-circle' : 'fa-clock'}"></i>
                    ${timeDiff < 0 ? 'Overdue by' : 'Due in'}: ${timeText}
                `;
            }
        });
    }, 60000); // Update every minute
}


// Reopen a completed task
function reopenTask(taskId) {
    const task = tasks.find(task => task.id === taskId);
    if (task && confirm("Reopen this task? It will be moved back to To Do.")) {
        task.status = 'To Do';
        task.completedAt = null;
        task.timeToComplete = null;
        task.efficiency = null;
        
        saveTasks();
        renderTasks();
        updateProgress();
        updateStats(); // Update statistics
        updateFooterStats();
    }
}

// Update completion statistics
function updateStats() {
    const completedTasks = tasks.filter(task => task.status === 'Completed');
    const statsSection = document.getElementById('completion-stats');
    
    if (completedTasks.length > 0) {
        // Calculate statistics
        const tasksWithTime = completedTasks.filter(task => task.timeToComplete);
        
        let totalTime = 0;
        let avgTime = 0;
        let minTime = Infinity;
        let maxTime = 0;
        let efficiencySum = 0;
        let efficiencyCount = 0;
        
        if (tasksWithTime.length > 0) {
            tasksWithTime.forEach(task => {
                totalTime += task.timeToComplete;
                minTime = Math.min(minTime, task.timeToComplete);
                maxTime = Math.max(maxTime, task.timeToComplete);
                
                if (task.efficiency) {
                    efficiencySum += task.efficiency;
                    efficiencyCount++;
                }
            });
            
            avgTime = Math.floor(totalTime / tasksWithTime.length);
        }
        
        // Calculate average efficiency if available
        const avgEfficiency = efficiencyCount > 0 ? Math.floor(efficiencySum / efficiencyCount) : null;
        
        // Update stats section
        statsSection.innerHTML = `
            <div class="stats-header">
                <i class="fas fa-chart-line"></i>
                <h3 class="stats-title">Completion Statistics</h3>
            </div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${completedTasks.length}</div>
                    <div class="stat-label">Total Tasks Completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${tasksWithTime.length}</div>
                    <div class="stat-label">Tasks with Time Tracking</div>
                </div>
                ${tasksWithTime.length > 0 ? `
                    <div class="stat-card">
                        <div class="stat-value">${formatTime(avgTime)}</div>
                        <div class="stat-label">Average Completion Time</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${formatTime(totalTime)}</div>
                        <div class="stat-label">Total Time Spent</div>
                    </div>
                ` : ''}
            </div>
            ${tasksWithTime.length > 0 ? `
                <div class="detailed-stats">
                    <div class="detailed-stats-title">
                        <i class="fas fa-info-circle"></i>
                        Performance Details
                    </div>
                    <div class="detailed-stats-grid">
                        <div class="detailed-stat">
                            <div class="detailed-stat-value">${formatTime(minTime)}</div>
                            <div class="detailed-stat-label">Fastest Completion</div>
                        </div>
                        <div class="detailed-stat">
                            <div class="detailed-stat-value">${formatTime(maxTime)}</div>
                            <div class="detailed-stat-label">Longest Completion</div>
                        </div>
                        ${avgEfficiency ? `
                            <div class="detailed-stat">
                                <div class="detailed-stat-value">${avgEfficiency}%</div>
                                <div class="detailed-stat-label">Avg. Efficiency</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            ` : ''}
        `;
    } else {
        // Show empty state
        statsSection.innerHTML = `
            <div class="stats-empty">
                <i class="fas fa-chart-pie"></i>
                <p>Complete some tasks to see statistics here</p>
            </div>
        `;
    }
}

// Apply sorting to todo list
function applySort() {
     // Get sort value from hidden input
    const sortValue = document.getElementById('todo-sort').value;
    sortState.todo = sortValue;
    
    // Save sort preference
    localStorage.setItem('todoSort', sortValue);
    
    // Get todo tasks
    const todoTasks = tasks.filter(task => task.status === 'To Do');
    
    // Apply sorting based on selected option
    let sortedTasks = [];
    
    switch(sortState.todo) {
        case 'newest':
            sortedTasks = todoTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'oldest':
            sortedTasks = todoTasks.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'priority-high':
            sortedTasks = todoTasks.sort((a, b) => {
                const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });
            break;
        case 'priority-low':
            sortedTasks = todoTasks.sort((a, b) => {
                const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
            break;
        case 'deadline-early':
            sortedTasks = todoTasks.sort((a, b) => {
                // Tasks without deadlines go to the end
                if (!a.dueDateTime && !b.dueDateTime) return 0;
                if (!a.dueDateTime) return 1;
                if (!b.dueDateTime) return -1;
                return new Date(a.dueDateTime) - new Date(b.dueDateTime);
            });
            break;
        case 'deadline-late':
            sortedTasks = todoTasks.sort((a, b) => {
                // Tasks without deadlines go to the end
                if (!a.dueDateTime && !b.dueDateTime) return 0;
                if (!a.dueDateTime) return 1;
                if (!b.dueDateTime) return -1;
                return new Date(b.dueDateTime) - new Date(a.dueDateTime);
            });
            break;
        default:
            sortedTasks = todoTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    // Render sorted tasks
    renderSortedTasks(sortedTasks);
}
// Render sorted tasks to todo list
function renderSortedTasks(sortedTasks) {
    const todoList = document.getElementById('todo-list');
    
    // Clear the list
    todoList.innerHTML = '';
    
    // Show empty state if no tasks
    if (sortedTasks.length === 0) {
        todoList.innerHTML = '<div class="empty-state"><p>No tasks to do. Add a new task to get started!</p></div>';
        return;
    }
    
    // Render sorted tasks
    sortedTasks.forEach(task => {
        const taskElement = createTaskElement(task);
        todoList.appendChild(taskElement);
    });
}

// Initialize custom dropdown
function initCustomDropdown() {
    const dropdown = document.getElementById('todo-sort-dropdown');
    const selected = dropdown.querySelector('.dropdown-selected');
    const options = dropdown.querySelector('.dropdown-options');
    const hiddenInput = document.getElementById('todo-sort');
    
    // Load saved sort preference
    const savedSort = localStorage.getItem('todoSort');
    if (savedSort) {
        sortState.todo = savedSort;
        hiddenInput.value = savedSort;
        updateSelectedText(savedSort);
    }
    
    // Toggle dropdown on click
    selected.addEventListener('click', () => {
        options.classList.toggle('show');
    });
    
    // Handle option selection
    options.querySelectorAll('.dropdown-option').forEach(option => {
        option.addEventListener('click', () => {
            const value = option.getAttribute('data-value');
            hiddenInput.value = value;
            sortState.todo = value;
            updateSelectedText(value);
            options.classList.remove('show');
            applySort();
            
            // Save preference
            localStorage.setItem('todoSort', value);
        });
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            options.classList.remove('show');
        }
    });
}

// Update selected text based on value
function updateSelectedText(value) {
    const selectedText = document.querySelector('.dropdown-selected .selected-text');
    const options = {
        'newest': 'Newest First',
        'oldest': 'Oldest First',
        'priority-high': 'Priority (High to Low)',
        'priority-low': 'Priority (Low to High)',
        'deadline-early': 'Deadline (Early First)',
        'deadline-late': 'Deadline (Late First)'
    };
    
    selectedText.textContent = options[value] || 'Newest First';
}

// Add these functions to your existing script.js

// Update footer stats
function updateFooterStats() {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'Completed').length;
    const inProgressTasks = tasks.filter(task => task.status === 'In Progress').length;
    
    document.getElementById('footer-total-tasks').textContent = totalTasks;
    document.getElementById('footer-completed-tasks').textContent = completedTasks;
    document.getElementById('footer-inprogress-tasks').textContent = inProgressTasks;
}

// Add task from footer
function addTaskFromFooter() {
    // Focus on the task input field in the todo column
    document.getElementById('edit-title').focus();
    
    // Open the add task modal
    openAddModal('To Do');
}

// Clear completed tasks with additional safety checks
function clearCompletedTasks() {
    const completedTasks = tasks.filter(task => task.status === 'Completed');
    
    if (completedTasks.length === 0) {
        alert('No completed tasks to clear.');
        return;
    }
    
    // Show detailed confirmation with task count and warning
    const confirmMessage = `Warning: You are about to delete ${completedTasks.length} completed task(s).\n\n` +
                         `This will permanently remove all completed tasks and their time tracking data.\n\n` +
                         `Are you sure you want to continue? This action cannot be undone.`;
    
    if (confirm(confirmMessage)) {
        tasks = tasks.filter(task => task.status !== 'Completed');
        saveTasks();
        renderTasks();
        updateProgress();
        updateStats();
        updateFooterStats();
        alert(`Cleared ${completedTasks.length} completed tasks.`);
    }
}

// Export tasks
function exportTasks() {
    const dataStr = JSON.stringify(tasks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `tasks-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    alert('Tasks exported successfully!');
}

// Placeholder functions for footer links
function showHelp() {
    alert('Help documentation will be available in the next version.');
}

function showFeedback() {
    alert('Feedback feature coming soon!');
}

function showAbout() {
    alert('Task Manager with Progress Tracker\nVersion 1.0\n\nA productivity tool to help you manage your tasks efficiently.');
}

function showPrivacy() {
    alert('Privacy policy information will be available soon.');
}

function showTerms() {
    alert('Terms of service information will be available soon.');
}