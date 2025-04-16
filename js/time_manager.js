let gameIntervalId = null;
let progressIntervalId = null;
let quarterStartTime = null;

let eventPaused = false;

const tickTime = 6000; // 10 seconds

export function startTime() {
    quarterStartTime = Date.now();

    // Progress bar updater: runs every 100ms
    progressIntervalId = setInterval(() => {
        updateProgressBar();
    }, 100);

    // Game quarter tick every 10 seconds
    gameIntervalId = setInterval(() => {
        game.advanceQuarter();
        updateUI();
        quarterStartTime = Date.now(); // reset timer
    }, tickTime);
}

export function pauseTime() {
    clearInterval(gameIntervalId);
    clearInterval(progressIntervalId);
}

export function resumeTime() {
    startTime(); // restarts both timers
}

function updateProgressBar() {
    const elapsed = Date.now() - quarterStartTime;
    const quarter = eventPaused ? game.currentQuarter - 1 : game.currentQuarter;

    const percent = 25 * (quarter % 4) + Math.min((elapsed / (4 * tickTime)) * 100, 100);
    updateYearProgress(percent);
}

export function setTrigger(state) {
    if (state != eventPaused) {
        if (state) {
            pauseTime();
        } else {
            resumeTime();
        }
    }
    eventPaused = state;
}