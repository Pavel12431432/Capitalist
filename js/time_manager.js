let quarterStartTime = 0;
let progressIntervalId = null;
let quarterTimeoutId = null;
let paused = false;
let elapsedAtPause = 0;

const tickTime = 6000;

// Called once game is allowed to tick into the next quarter
function onQuarterEnd() {
    // If an event is still open, do nothing
    if (eventManager.hasUnresolvedEvent()) return;

    // Try a random event (will only test once)
    if (eventManager.tryTriggerRandomEvent(window.game)) {
        return;
    }

    // No event → advance and begin next quarter
    window.game.advanceQuarter();
    window.updateUI();
    startTime();
}

/**
 * Start a brand‑new quarter: reset the "tested" flag, set up timers.
 */
export function startTime() {
    // Reset event testing
    eventManager.testedThisQuarter = false;

    // Clear any old timers
    clearInterval(progressIntervalId);
    clearTimeout(quarterTimeoutId);

    paused = false;
    elapsedAtPause = 0;
    quarterStartTime = Date.now();

    // Smooth bar updates
    progressIntervalId = setInterval(updateProgressBar, 100);

    // Schedule the quarter‐end driver
    quarterTimeoutId = setTimeout(onQuarterEnd, tickTime);
}

/**
 * Pause or resume everything.
 */
export function setTrigger(shouldPause) {
    if (shouldPause && !paused) {
        // PAUSE: record elapsed and clear timers
        paused = true;
        elapsedAtPause = Math.min(Date.now() - quarterStartTime, tickTime);
        clearInterval(progressIntervalId);
        clearTimeout(quarterTimeoutId);
    } else if (!shouldPause && paused) {
        // RESUME:
        paused = false;
        const remaining = tickTime - elapsedAtPause;

        // If we were right at the boundary, fire onQuarterEnd immediately
        if (remaining <= 0) {
            return onQuarterEnd();
        }

        // Else resume mid‑quarter
        quarterStartTime = Date.now() - elapsedAtPause;
        progressIntervalId = setInterval(updateProgressBar, 100);
        quarterTimeoutId = setTimeout(onQuarterEnd, remaining);
    }
}

/**
 * Updates the progress bar every 100ms when not paused.
 */
export function updateProgressBar() {
    if (paused) return;

    const elapsed = Date.now() - quarterStartTime;
    const frac = Math.min(Math.max(elapsed / tickTime, 0), 1);
    const subQ = window.game.currentQuarter % 4;
    const pct = (subQ + frac) * 25;
    window.updateYearProgress(pct);
}
