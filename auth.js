// Login Page Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Role toggle functionality
    const roleButtons = document.querySelectorAll('.role-btn');
    roleButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            roleButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const activeRole = document.querySelector('.role-btn.active').dataset.role;
            
            // Simple validation
            if (!email || !password) {
                alert('Please fill in all fields');
                return;
            }
            
            // Simulate login (in a real app, this would be an API call)
            console.log(`Logging in as ${activeRole} with email: ${email}`);
            
            // Redirect based on role
            switch(activeRole) {
                case 'patient':
                    window.location.href = '/dashboard/patient.html';
                    break;
                case 'volunteer':
                    window.location.href = '/dashboard/volunteer.html';
                    break;
                case 'therapist':
                    window.location.href = '/dashboard/therapist.html';
                    break;
                default:
                    window.location.href = '/dashboard/patient.html';
            }
            
            // Store user in localStorage (simulated)
            localStorage.setItem('currentUser', JSON.stringify({
                email,
                role: activeRole,
                name: email.split('@')[0] // Simulated username
            }));
        });
    }
});