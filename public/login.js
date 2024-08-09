document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form')
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const authMsg = document.getElementById('auth-msg');

        try{
            const response = await fetch('http://localhost:4000/api/login', {
                method: 'POST',
                headers:  {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json()

            if (data.userId) {
                localStorage.setItem('userId', data.userId);
                window.location.href = '/index.html';
            } else {
                authMsg.textContent = 'Failed to retrieve userId';
            }
        } catch (err) {
            authMsg.textContent = err
        }
    })
})


// Open the Login webpage using: http://127.0.0.1:4000/login.html