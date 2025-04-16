// notification_system.js

const MAX_NOTIFICATIONS = 3;

export function showNotification(message, type = "info", duration = 2000) {
    const container = document.getElementById("notification-container");
    if (!container) return;

    // Remove oldest if at max limit
    const activeNotifications = Array.from(container.children).filter(
        (n) => !n.classList.contains("slide-out")
    );
    if (activeNotifications.length >= MAX_NOTIFICATIONS) {
        const oldest = activeNotifications[0];
        oldest.classList.add("slide-out");
        setTimeout(() => {
            if (container.contains(oldest)) container.removeChild(oldest);
        }, 300);
    }

    const notification = document.createElement("div");
    notification.classList.add("notification", type);
    notification.textContent = message;

    const closeBtn = document.createElement("span");
    closeBtn.classList.add("close-btn");
    closeBtn.textContent = "×";
    closeBtn.onclick = () => container.removeChild(notification);
    notification.appendChild(closeBtn);

    container.appendChild(notification);

    // Auto-remove after timeout
    setTimeout(() => {
        if (container.contains(notification)) {
            notification.classList.add("slide-out");
            setTimeout(() => {
                if (container.contains(notification)) {
                    container.removeChild(notification);
                }
            }, 300); // Wait for the animation to finish
        }
    }, duration);
}
