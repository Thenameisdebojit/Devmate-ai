document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('clickBtn');
    let count = 0;
    
    button.addEventListener('click', () => {
        count++;
        button.textContent = `Clicked ${count} time${count !== 1 ? 's' : ''}`;
    });
});
