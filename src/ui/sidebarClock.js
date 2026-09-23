const timeElement = document.getElementById('sidebarClockTime');
const dateElement = document.getElementById('sidebarClockDate');

if (timeElement && dateElement) {
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const dateFormatter = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    function updateClock() {
        const now = new Date();
        timeElement.textContent = timeFormatter.format(now);
        timeElement.dateTime = now.toISOString();
        dateElement.textContent = dateFormatter.format(now);
    }

    updateClock();
    setInterval(updateClock, 1000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) updateClock();
    });
}
