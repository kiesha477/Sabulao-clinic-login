const ADMIN_CREDENTIALS = {
  username: "Admin1",
  password: "Admin09876"
};

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const toRegisterBtn = document.getElementById('toRegisterBtn');
const toLoginBtn = document.getElementById('toLoginBtn');

toRegisterBtn.addEventListener('click', () => toggleView('register'));
toLoginBtn.addEventListener('click', () => toggleView('login'));

loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);

function toggleView(view) {
  clearAlert();
  if (view === 'register') {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
  } else {
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  }
}

function showAlert(msg, isError = true) {
  const alertBox = document.getElementById('alertBox');
  alertBox.textContent = msg;
  alertBox.className = isError 
    ? "mb-4 p-3 rounded-lg text-sm border bg-red-50 text-red-700 border-red-200 block"
    : "mb-4 p-3 rounded-lg text-sm border bg-green-50 text-green-700 border-green-200 block";
}

function clearAlert() {
  const alertBox = document.getElementById('alertBox');
  alertBox.className = "hidden mb-4 p-3 rounded-lg text-sm border";
  alertBox.textContent = '';
}

function handleLogin(e) {
  e.preventDefault();
  clearAlert();

  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;

  // 1. Check Admin Credentials
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    sessionStorage.setItem('currentUser', JSON.stringify({ username: 'Admin1', role: 'admin' }));
    window.location.href = 'admin.html';
    return;
  }

  // 2. Check Client Credentials
  const clients = JSON.parse(localStorage.getItem('client_db') || '{}');
  if (clients[username] && clients[username] === password) {
    sessionStorage.setItem('currentUser', JSON.stringify({ username: username, role: 'client' }));
    window.location.href = 'client.html';
    return;
  }

  showAlert("Invalid username and password.");
}

function handleRegister(e) {
  e.preventDefault();
  clearAlert();

  const username = document.getElementById('regUser').value.trim();
  const password = document.getElementById('regPass').value;

  if (username.toLowerCase() === ADMIN_CREDENTIALS.username.toLowerCase()) {
    showAlert("Hindi pwedeng gamitin ang username na ito.");
    return;
  }

  const hasUppercase = /[A-Z]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (!hasUppercase || !hasSpecialChar) {
    showAlert("Password error: You need atleast one UPPERCASE letter and SPECIAL CHARACTER (!@#$%^&*).");
    return;
  }

  const clients = JSON.parse(localStorage.getItem('client_db') || '{}');
  if (clients[username]) {
    showAlert("May nakagamit na ng username na ito. Pumili ng iba.");
    return;
  }

  clients[username] = password;
  localStorage.setItem('client_db', JSON.stringify(clients));

  showAlert("Account created successfully! Pwede ka nang mag-Sign In.", false);
  registerForm.reset();
  setTimeout(() => toggleView('login'), 1500);
}
