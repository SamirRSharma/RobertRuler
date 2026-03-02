/* ===== Welcome Gate ===== */
const gate = document.getElementById('gate');
const app = document.getElementById('app');
const enterBtn = document.getElementById('enterBtn');

function showApp() {
  // Fade out gate
  gate.classList.add('fade-out');
  
  // Wait for fade-out animation, then show app
  setTimeout(() => {
    gate.style.display = 'none';
    app.classList.add('fade-in');
    app.setAttribute('aria-hidden', 'false');
    
    // Focus first input after animation
    setTimeout(() => {
      const nameBox = document.getElementById('speakerName1');
      if (nameBox) nameBox.focus();
    }, 100);
  }, 500); // 500ms matches CSS transition duration
}

// Check if user already entered this session
function checkSession() {
  if (sessionStorage.getItem('eus_entered') === '1') {
    showApp();
  }
}

// Enter button click handler
enterBtn.addEventListener('click', () => {
  sessionStorage.setItem('eus_entered', '1');
  showApp();
});
checkSession();

/* ===== Dark Mode Toggle ===== */
document.getElementById('themeToggle').addEventListener('change', function () {
    if (this.checked) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
});

/* ===== Shared State & Persistence Helpers (Local + Redis) ===== */
let lastRemoteUpdatedAt = 0;
const SYNC_INTERVAL_MS = 1500; // How often to poll Redis-backed API for updates

function getCurrentStateSnapshot() {
    return {
    queueOnes,
    queueTwos,
    currentSpeaker: document.getElementById('currentSpeakerDisplay').textContent || 'None',
    totalSpeakersProcessed: totalSpeakersProcessed || 0
    };
}

// Local-only storage (used as cache / offline fallback)
function saveToLocalStorage(state) {
    const snapshot = state || getCurrentStateSnapshot();
    try {
    localStorage.setItem('queueOnes', JSON.stringify(snapshot.queueOnes || []));
    localStorage.setItem('queueTwos', JSON.stringify(snapshot.queueTwos || []));
    localStorage.setItem('currentSpeaker', snapshot.currentSpeaker || 'None');
    localStorage.setItem('totalSpeakers', snapshot.totalSpeakersProcessed || 0);
    } catch (e) {
    console.warn('Failed to save to localStorage:', e);
    }
}

function loadFromLocalStorage() {
    const defaultState = {
    queueOnes: [],
    queueTwos: [],
    currentSpeaker: 'None',
    totalSpeakersProcessed: 0
    };

    try {
    const savedOnes = localStorage.getItem('queueOnes');
    const savedTwos = localStorage.getItem('queueTwos');
    const savedCurrent = localStorage.getItem('currentSpeaker');
    const savedTotal = localStorage.getItem('totalSpeakers');
    
    if (savedOnes) defaultState.queueOnes = JSON.parse(savedOnes);
    if (savedTwos) defaultState.queueTwos = JSON.parse(savedTwos);
    if (savedCurrent && savedCurrent !== 'None') {
        defaultState.currentSpeaker = savedCurrent;
    }
    if (savedTotal) defaultState.totalSpeakersProcessed = parseInt(savedTotal);
    } catch (e) {
    console.warn('Failed to load from localStorage:', e);
    }

    applyStateToUi(defaultState, false);
}

function clearLocalStorage() {
    try {
    localStorage.removeItem('queueOnes');
    localStorage.removeItem('queueTwos');
    localStorage.removeItem('currentSpeaker');
    localStorage.removeItem('totalSpeakers');
    } catch (e) {
    console.warn('Failed to clear localStorage:', e);
    }
}

// Apply a full state object into in-memory variables + DOM
function applyStateToUi(state, fromRemote) {
    if (!state) return;

    queueOnes = Array.isArray(state.queueOnes) ? state.queueOnes : [];
    queueTwos = Array.isArray(state.queueTwos) ? state.queueTwos : [];
    totalSpeakersProcessed = typeof state.totalSpeakersProcessed === 'number'
    ? state.totalSpeakersProcessed
    : 0;

    const current = state.currentSpeaker || 'None';
    document.getElementById('currentSpeakerDisplay').textContent = current;

    updateQueueDisplay();
    // Mirror remote state into localStorage cache as well
    saveToLocalStorage(state);

    if (fromRemote && typeof state.updatedAt === 'number') {
    lastRemoteUpdatedAt = state.updatedAt;
    }
}

async function syncStateToServer() {
    const snapshot = getCurrentStateSnapshot();
    try {
    const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
        cache: 'no-store'
    });
    if (!res.ok) return;
    const serverState = await res.json();
    if (serverState && typeof serverState.updatedAt === 'number') {
        lastRemoteUpdatedAt = serverState.updatedAt;
    }
    } catch (e) {
    console.warn('Failed to sync state to server:', e);
    }
}

// Unified save: local cache + remote
function saveState() {
    saveToLocalStorage();
    syncStateToServer();
}

async function loadInitialState() {
    // Try Redis-backed API first
    try {
    const res = await fetch('/api/state', { method: 'GET', cache: 'no-store' });
    if (res.ok) {
        const remoteState = await res.json();
        if (remoteState && (remoteState.queueOnes || remoteState.queueTwos)) {
        applyStateToUi(remoteState, true);
        // Start polling after initial load
        startRemotePolling();
        return;
        }
    }
    } catch (e) {
    console.warn('Failed to load from server, falling back to localStorage:', e);
    }

    // Fallback: localStorage-only (e.g., offline)
    loadFromLocalStorage();
    startRemotePolling();
}

function startRemotePolling() {
    setInterval(async () => {
    try {
        const res = await fetch('/api/state', { method: 'GET', cache: 'no-store' });
        if (!res.ok) return;
        const remoteState = await res.json();
        if (!remoteState) return;

        const remoteUpdatedAt = typeof remoteState.updatedAt === 'number'
        ? remoteState.updatedAt
        : 0;

        // Only apply remote state if it's newer than what we know
        if (remoteUpdatedAt > lastRemoteUpdatedAt) {
        applyStateToUi(remoteState, true);
        }
    } catch (e) {
        console.warn('Polling for remote state failed:', e);
    }
    }, SYNC_INTERVAL_MS);
}

/* ===== Undo History System ===== */
let undoStack = [];
const MAX_UNDO_HISTORY = 10;

function addToUndoStack(action) {
    undoStack.push(action);
    if (undoStack.length > MAX_UNDO_HISTORY) {
    undoStack.shift(); // Remove oldest
    }
    updateUndoButton();
}

function undoLastAction() {
    if (undoStack.length === 0) return;
    
    const action = undoStack.pop();
    
    switch(action.type) {
    case 'DELETE_ONE':
        queueOnes.splice(action.index, 0, action.speaker);
        break;
    case 'DELETE_TWO':
        queueTwos.splice(action.index, 0, action.speaker);
        break;
    case 'CLEAR_ONES':
        queueOnes = action.speakers;
        break;
    case 'CLEAR_TWOS':
        queueTwos = action.speakers;
        break;
    }
    
    updateQueueDisplay();
    saveState();
    updateUndoButton();
    showNotification('Action undone');
}

function updateUndoButton() {
    const btn = document.getElementById('undoBtn');
    if (btn) {
    btn.disabled = undoStack.length === 0;
    btn.style.opacity = undoStack.length === 0 ? '0.5' : '1';
    }
}

/***********************
 * Speaker Queue Logic *
 ***********************/
let queueTwos = [];
let queueOnes = [];
let totalSpeakersProcessed = 0;

// Load shared WUSA state when app starts
window.addEventListener('DOMContentLoaded', () => {
    loadInitialState();
});

function updateQueueDisplay() {
    const speakerList1 = document.getElementById('speakerList1');
    const speakerList2 = document.getElementById('speakerList2');
    speakerList1.innerHTML = "";
    speakerList2.innerHTML = "";

    // Priority 1 Queue
    queueOnes.forEach((speakerObj, index) => {
    const li = document.createElement('li');
    li.className = 'speaker-item';
    if (speakerObj.skipped) li.classList.add('skipped');
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'speaker-item-name';
    nameSpan.textContent = speakerObj.name;
    
    const controls = document.createElement('div');
    controls.className = 'speaker-item-controls';
    
    // Move Up button
    const moveUpBtn = document.createElement('button');
    moveUpBtn.textContent = '▲';
    moveUpBtn.className = 'reorder-btn';
    moveUpBtn.disabled = index === 0;
    moveUpBtn.setAttribute('aria-label', `Move ${speakerObj.name} up`);
    moveUpBtn.addEventListener('click', () => {
        if (index > 0) {
        [queueOnes[index], queueOnes[index - 1]] = [queueOnes[index - 1], queueOnes[index]];
        updateQueueDisplay();
        saveState();
        }
    });
    
    // Move Down button
    const moveDownBtn = document.createElement('button');
    moveDownBtn.textContent = '▼';
    moveDownBtn.className = 'reorder-btn';
    moveDownBtn.disabled = index === queueOnes.length - 1;
    moveDownBtn.setAttribute('aria-label', `Move ${speakerObj.name} down`);
    moveDownBtn.addEventListener('click', () => {
        if (index < queueOnes.length - 1) {
        [queueOnes[index], queueOnes[index + 1]] = [queueOnes[index + 1], queueOnes[index]];
        updateQueueDisplay();
        saveState();
        }
    });
    
    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.textContent = speakerObj.skipped ? 'Unskip' : 'Skip';
    skipBtn.className = 'skip-btn';
    skipBtn.setAttribute('aria-label', `${speakerObj.skipped ? 'Unskip' : 'Skip'} ${speakerObj.name}`);
    skipBtn.addEventListener('click', () => {
        speakerObj.skipped = !speakerObj.skipped;
        updateQueueDisplay();
        saveState();
    });
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.className = 'remove-btn';
    removeBtn.setAttribute('aria-label', `Remove ${speakerObj.name} from queue`);
    removeBtn.addEventListener('click', () => {
        addToUndoStack({
        type: 'DELETE_ONE',
        speaker: { ...speakerObj },
        index: index
        });
        queueOnes.splice(index, 1);
        updateQueueDisplay();
        saveState();
        showNotification(`${speakerObj.name} removed`);
    });
    
    controls.appendChild(moveUpBtn);
    controls.appendChild(moveDownBtn);
    controls.appendChild(skipBtn);
    controls.appendChild(removeBtn);
    li.appendChild(nameSpan);
    li.appendChild(controls);
    speakerList1.appendChild(li);
    });

    // Priority 2 Queue
    queueTwos.forEach((speakerObj, index) => {
    const li = document.createElement('li');
    li.className = 'speaker-item';
    if (speakerObj.skipped) li.classList.add('skipped');
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'speaker-item-name';
    nameSpan.textContent = speakerObj.name;
    
    const controls = document.createElement('div');
    controls.className = 'speaker-item-controls';
    
    // Move Up button
    const moveUpBtn = document.createElement('button');
    moveUpBtn.textContent = '▲';
    moveUpBtn.className = 'reorder-btn';
    moveUpBtn.disabled = index === 0;
    moveUpBtn.setAttribute('aria-label', `Move ${speakerObj.name} up`);
    moveUpBtn.addEventListener('click', () => {
        if (index > 0) {
        [queueTwos[index], queueTwos[index - 1]] = [queueTwos[index - 1], queueTwos[index]];
        updateQueueDisplay();
        saveState();
        }
    });
    
    // Move Down button
    const moveDownBtn = document.createElement('button');
    moveDownBtn.textContent = '▼';
    moveDownBtn.className = 'reorder-btn';
    moveDownBtn.disabled = index === queueTwos.length - 1;
    moveDownBtn.setAttribute('aria-label', `Move ${speakerObj.name} down`);
    moveDownBtn.addEventListener('click', () => {
        if (index < queueTwos.length - 1) {
        [queueTwos[index], queueTwos[index + 1]] = [queueTwos[index + 1], queueTwos[index]];
        updateQueueDisplay();
        saveState();
        }
    });
    
    // Skip button
    const skipBtn = document.createElement('button');
    skipBtn.textContent = speakerObj.skipped ? 'Unskip' : 'Skip';
    skipBtn.className = 'skip-btn';
    skipBtn.setAttribute('aria-label', `${speakerObj.skipped ? 'Unskip' : 'Skip'} ${speakerObj.name}`);
    skipBtn.addEventListener('click', () => {
        speakerObj.skipped = !speakerObj.skipped;
        updateQueueDisplay();
        saveState();
    });
    
    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '✕';
    removeBtn.className = 'remove-btn';
    removeBtn.setAttribute('aria-label', `Remove ${speakerObj.name} from queue`);
    removeBtn.addEventListener('click', () => {
        addToUndoStack({
        type: 'DELETE_TWO',
        speaker: { ...speakerObj },
        index: index
        });
        queueTwos.splice(index, 1);
        updateQueueDisplay();
        saveState();
        showNotification(`${speakerObj.name} removed`);
    });
    controls.appendChild(moveUpBtn);
    controls.appendChild(moveDownBtn);
    controls.appendChild(skipBtn);
    controls.appendChild(removeBtn);
    li.appendChild(nameSpan);
    li.appendChild(controls);
    speakerList2.appendChild(li);
    });

    // Update stats
    const queuedCount = queueOnes.length + queueTwos.length;
    document.getElementById('queuedSpeakersCount').textContent = queuedCount;
    document.getElementById('totalSpeakersCount').textContent = totalSpeakersProcessed;
}

function addSpeaker1() {
    const input = document.getElementById('speakerName1');
    const name = input.value.trim();
    if (!name) { showNotification("Please enter a name for Priority 1 speaker."); return; }
    queueOnes.push({ name, skipped: false });
    input.value = "";
    updateQueueDisplay();
    saveState();

    // Add success animation
    const list = document.getElementById('speakerList1');
    list.classList.add('success');
    setTimeout(() => list.classList.remove('success'), 500);
}

function addSpeaker2() {
    const input = document.getElementById('speakerName2');
    const name = input.value.trim();
    if (!name) { showNotification("Please enter a name for Priority 2 speaker."); return; }
    queueTwos.push({ name, skipped: false });
    input.value = "";
    updateQueueDisplay();
    saveState();

    // Add success animation
    const list = document.getElementById('speakerList2');
    list.classList.add('success');
    setTimeout(() => list.classList.remove('success'), 500);
}

document.getElementById('addSpeakerBtn1').addEventListener('click', addSpeaker1);
document.getElementById('addSpeakerBtn2').addEventListener('click', addSpeaker2);
document.getElementById('speakerName1').addEventListener('keydown', (e) => { if (e.key === 'Enter') addSpeaker1(); });
document.getElementById('speakerName2').addEventListener('keydown', (e) => { if (e.key === 'Enter') addSpeaker2(); });

document.getElementById('nextSpeakerBtn').addEventListener('click', () => {
    let nextSpeaker = getNextSpeaker(queueTwos);
    if (!nextSpeaker) nextSpeaker = getNextSpeaker(queueOnes);
    if (nextSpeaker) {
    document.getElementById('currentSpeakerDisplay').textContent = nextSpeaker;
    totalSpeakersProcessed++;
    updateQueueDisplay();
    saveState();
    resetTimer1();
    startTimer1();
    } else showNotification("No speakers in the queue.");
});

document.getElementById('clearAllDataBtn').addEventListener('click', () => {
    const totalInQueue = queueOnes.length + queueTwos.length;
    const message = totalInQueue > 0 
    ? `Clear all ${totalInQueue} speakers and reset? This cannot be undone.`
    : "Clear all data and reset? This cannot be undone.";
    
    if (confirm(message)) {
    queueOnes = [];
    queueTwos = [];
    totalSpeakersProcessed = 0;
    document.getElementById('currentSpeakerDisplay').textContent = 'None';
    clearLocalStorage();
    updateQueueDisplay();
    showNotification('All data cleared');
    }
});

function getNextSpeaker(queue) {
    while (queue.length > 0 && queue[0].skipped) queue.shift();
    if (queue.length > 0) return queue.shift().name;
    return null;
}

document.getElementById('clearOnesBtn').addEventListener('click', () => {
    if (queueOnes.length === 0) return;
    
    addToUndoStack({
    type: 'CLEAR_ONES',
    speakers: [...queueOnes]
    });
    
    queueOnes = []; 
    updateQueueDisplay(); 
    saveState();
    showNotification('Priority 1 queue cleared');
});

document.getElementById('clearTwosBtn').addEventListener('click', () => {
    if (queueTwos.length === 0) return;
    
    addToUndoStack({
    type: 'CLEAR_TWOS',
    speakers: [...queueTwos]
    });
    
    queueTwos = []; 
    updateQueueDisplay();
    saveState();
    showNotification('Priority 2 queue cleared');
});

// Undo button event listener and initialization
document.getElementById('undoBtn').addEventListener('click', undoLastAction);
updateUndoButton();

/* ===== Accessible Notification System ===== */
let soundEnabled = true;
function showNotification(message) {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.classList.add('show');
    
    setTimeout(() => {
    notif.classList.remove('show');
    }, 4000);
}

// Play a single beep
function playBeep(frequency = 800, duration = 200) {
    return new Promise((resolve) => {
    if (!soundEnabled) {
        resolve();
        return;
    }
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
        
        setTimeout(() => resolve(), duration);
    } catch (error) {
        console.warn('Audio playback failed:', error);
        resolve();
    }
    });
}

// Play multiple beeps in sequence
async function playBeepSequence(count, frequency = 800, duration = 200, gap = 150) {
    if (!soundEnabled) return;
    
    for (let i = 0; i < count; i++) {
    await playBeep(frequency, duration);
    if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, gap));
    }
    }
}

// Warning sound - 1 beep
function playWarningSound() {
    playBeepSequence(1, 800, 200);
}

// Timer complete sound - 3 beeps
function playTimerCompleteSound() {
    playBeepSequence(3, 800, 200, 150);
}

// General notification sound - 2 beeps
function playNotificationSound() {
    playBeepSequence(2, 800, 200, 150);
}

// Sound toggle button
document.getElementById('soundToggle').addEventListener('click', function() {
    soundEnabled = !soundEnabled;
    this.textContent = soundEnabled ? '🔊' : '🔇';
    this.setAttribute('aria-label', soundEnabled ? 'Mute notification sound' : 'Unmute notification sound');
    showNotification(soundEnabled ? 'Sound enabled' : 'Sound muted');
});

/********************
 * Timer 1
 ********************/
let timerDuration1 = 60;
let timerRemaining1 = timerDuration1;
let timerInterval1 = null;

const circleProgress1 = document.querySelector('#timerCircle1 .timer-progress');
const circleCircumference1 = 2 * Math.PI * 50;

function updateTimerDisplay1() {
    const timerDisplay1 = document.getElementById('timerDisplay1');
    const timerSection = document.getElementById('timerSection1');
    const minutes1 = Math.floor(timerRemaining1 / 60);
    const seconds1 = timerRemaining1 % 60;
    const timeString1 = String(minutes1).padStart(2,'0') + ":" + String(seconds1).padStart(2,'0');
    timerDisplay1.textContent = timeString1;
    
    // Update progress circle
    const fraction1 = timerDuration1 > 0 ? timerRemaining1 / timerDuration1 : 1;
    circleProgress1.style.strokeDashoffset = circleCircumference1 * (1 - fraction1);
    
    // Visual warnings
    timerSection.classList.remove('timer-warning', 'timer-critical');
    if (timerRemaining1 <= 10 && timerRemaining1 > 5) {
    timerSection.classList.add('timer-warning');
    } else if (timerRemaining1 <= 5 && timerRemaining1 > 0) {
    timerSection.classList.add('timer-critical');
    }
}

function startTimer1() {
    if (timerInterval1 !== null) return;
    timerInterval1 = setInterval(() => {
    if (timerRemaining1 > 0) {
        timerRemaining1--;
        updateTimerDisplay1();
        
        // Warnings at specific times
        if (timerRemaining1 === 10) {
        showNotification('Timer 1: 10 seconds remaining');
        playWarningSound();
        }
    } else {
        clearInterval(timerInterval1);
        timerInterval1 = null;
        showNotification("Timer 1: Time's up!");
        playTimerCompleteSound();
        document.getElementById('timerSection1').classList.remove('timer-warning', 'timer-critical');
    }
    }, 1000);
}

function pauseTimer1() { if (timerInterval1 !== null) { clearInterval(timerInterval1); timerInterval1 = null; } }
function resetTimer1() { pauseTimer1(); timerRemaining1 = timerDuration1; updateTimerDisplay1(); }

document.querySelectorAll('#timerControls1 .preset').forEach(btn => {
    btn.addEventListener('click', () => { timerDuration1 = parseInt(btn.getAttribute('data-seconds')); resetTimer1(); });
});
document.getElementById('setCustomTimeBtn1').addEventListener('click', () => {
    const m = parseInt(document.getElementById('customMinutes1').value) || 0;
    const s = parseInt(document.getElementById('customSeconds1').value) || 0;
    const total = m * 60 + s;
    if (total <= 0) { showNotification("Please enter a valid time for Timer 1."); return; }
    timerDuration1 = total; resetTimer1();
    document.getElementById('customMinutes1').value = "";
    document.getElementById('customSeconds1').value = "";
});
document.getElementById('add30SecsBtn1').addEventListener('click', () => {
    timerRemaining1 += 30; timerDuration1 += 30; updateTimerDisplay1(); showNotification('Added 30 seconds to Timer 1'); playNotificationSound();
});
document.getElementById('startTimerBtn1').addEventListener('click', startTimer1);
document.getElementById('pauseTimerBtn1').addEventListener('click', pauseTimer1);
document.getElementById('resetTimerBtn1').addEventListener('click', resetTimer1);

circleProgress1.style.strokeDasharray = circleCircumference1;
updateTimerDisplay1();

/********************
 * Timer 2
 ********************/
let timerDuration2 = 60;
let timerRemaining2 = timerDuration2;
let timerInterval2 = null;

const circleProgress2 = document.querySelector('#timerCircle2 .timer-progress');
const circleCircumference2 = 2 * Math.PI * 50;

function updateTimerDisplay2() {
    const timerDisplay2 = document.getElementById('timerDisplay2');
    const timerSection = document.getElementById('timerSection2');
    const minutes2 = Math.floor(timerRemaining2 / 60);
    const seconds2 = timerRemaining2 % 60;
    const timeString2 = String(minutes2).padStart(2,'0') + ":" + String(seconds2).padStart(2,'0');
    timerDisplay2.textContent = timeString2;
    const fraction2 = timerDuration2 > 0 ? timerRemaining2 / timerDuration2 : 1;
    circleProgress2.style.strokeDashoffset = circleCircumference2 * (1 - fraction2);
    // Visual warnings
    timerSection.classList.remove('timer-warning', 'timer-critical');
    if (timerRemaining2 <= 10 && timerRemaining2 > 5) {
    timerSection.classList.add('timer-warning');
    } else if (timerRemaining2 <= 5 && timerRemaining2 > 0) {
    timerSection.classList.add('timer-critical');
    }
}

function startTimer2() {
    if (timerInterval2 !== null) return;
    timerInterval2 = setInterval(() => {
    if (timerRemaining2 > 0) { 
        timerRemaining2--; 
        updateTimerDisplay2();
        if (timerRemaining2 === 10) {
        showNotification('Timer 2: 10 seconds remaining');
        playWarningSound();
        }
    }
    else { 
        clearInterval(timerInterval2); 
        timerInterval2 = null; 
        showNotification("Timer 2: Time's up!"); 
        playTimerCompleteSound();
        document.getElementById('timerSection2').classList.remove('timer-warning', 'timer-critical');
    }
    }, 1000);
}
function pauseTimer2() { if (timerInterval2 !== null) { clearInterval(timerInterval2); timerInterval2 = null; } }
function resetTimer2() { pauseTimer2(); timerRemaining2 = timerDuration2; updateTimerDisplay2(); }

document.querySelectorAll('#timerControls2 .preset').forEach(btn => {
    btn.addEventListener('click', () => { timerDuration2 = parseInt(btn.getAttribute('data-seconds')); resetTimer2(); });
});
document.getElementById('setCustomTimeBtn2').addEventListener('click', () => {
    const m = parseInt(document.getElementById('customMinutes2').value) || 0;
    const s = parseInt(document.getElementById('customSeconds2').value) || 0;
    const total = m * 60 + s;
    if (total <= 0) { showNotification("Please enter a valid time for Timer 2."); return; }
    timerDuration2 = total; resetTimer2();
    document.getElementById('customMinutes2').value = "";
    document.getElementById('customSeconds2').value = "";
});
document.getElementById('add30SecsBtn2').addEventListener('click', () => {
    timerRemaining2 += 30; timerDuration2 += 30; updateTimerDisplay2(); showNotification('Added 30 seconds to Timer 2'); playNotificationSound();
});
document.getElementById('startTimerBtn2').addEventListener('click', startTimer2);
document.getElementById('pauseTimerBtn2').addEventListener('click', pauseTimer2);
document.getElementById('resetTimerBtn2').addEventListener('click', resetTimer2);

circleProgress2.style.strokeDasharray = circleCircumference2;
updateTimerDisplay2();

/* ===== Keyboard Shortcuts ===== */
document.getElementById('keyboardShortcutsBtn').addEventListener('click', () => {
    document.getElementById('shortcutsModal').style.display = 'flex';
});

document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in an input
    if (e.target.tagName === 'INPUT') return;
    
    switch(e.key.toLowerCase()) {
    case ' ':
        e.preventDefault();
        if (timerInterval1 === null) startTimer1();
        else pauseTimer1();
        break;
    case 'n':
        document.getElementById('nextSpeakerBtn').click();
        break;
    case 'r':
        resetTimer1();
        break;
    case 'm':
        document.getElementById('soundToggle').click();
        break;
    case 'z':
        if (e.ctrlKey || e.metaKey) { // Ctrl+Z or Cmd+Z
        e.preventDefault();
        undoLastAction();
        }
        break;
    case '1':
        document.getElementById('speakerName1').focus();
        break;
    case '2':
        document.getElementById('speakerName2').focus();
        break;
    case 'escape':
        document.getElementById('shortcutsModal').style.display = 'none';
        break;
    }
});