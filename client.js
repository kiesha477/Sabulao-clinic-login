// Protection check: Siguraduhing naka-login bilang client
//const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || 'null');

if (!currentUser || currentUser.role !== 'client') {
  window.location.href = 'login.html';
}

// Set welcome name
document.getElementById('clientWelcomeName').textContent = currentUser.username;

// Logout
document.getElementById('clientLogoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('currentUser');
  window.location.href = 'login.html';
});