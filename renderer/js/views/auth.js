/* ============================================
   views/auth.js - Authentication View (UPDATED)
   ============================================ */

import { signIn, signUp, signInWithGoogle } from '../firebase.js'; // ✅ UPDATED: Imported signInWithGoogle

let isLogin = true;
let isSubmitting = false;

/**
 * Setup authentication form handlers
 */
export function setupAuthHandlers() {
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const submitBtn = document.getElementById('auth-submit-btn');
  const googleBtn = document.getElementById('google-auth-btn'); // ✅ NEW
  const confirmPasswordGroup = document.getElementById('confirm-password-group');
  const authForm = document.getElementById('auth-form');
  const authError = document.getElementById('auth-error');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const authSubtitle = document.querySelector('.auth-subtitle');

  // Safety check
  if (!toggleBtn || !submitBtn || !authForm) {
    console.error('[Auth] Required form elements not found in DOM');
    return;
  }

  // Toggle between login and signup
  toggleBtn.addEventListener('click', () => {
    isLogin = !isLogin;
    clearErrors();

    if (isLogin) {
      submitBtn.textContent = 'Sign In';
      toggleBtn.textContent = "Don't have an account? Sign Up";
      if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
      if (authSubtitle) authSubtitle.textContent = 'Sign in to continue';
      if (googleBtn) googleBtn.style.display = 'flex';
    } else {
      submitBtn.textContent = 'Sign Up';
      toggleBtn.textContent = 'Already have an account? Sign In';
      if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'block';
      if (authSubtitle) authSubtitle.textContent = 'Create a new account';
      if (googleBtn) googleBtn.style.display = 'none';
    }

    // Clear form
    authForm.reset();
    if (emailInput) emailInput.focus();
  });

  // Handle standard form submission
  authForm.addEventListener('submit', handleAuthSubmit);

  // ✅ NEW: Handle Google Sign In
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      if (isSubmitting) return;
      isSubmitting = true;
      clearErrors();

      const originalText = googleBtn.innerHTML;
      googleBtn.disabled = true;
      googleBtn.innerHTML = 'Signing in...';

      try {
        await signInWithGoogle();
        // App.js listener handles the redirect
      } catch (error) {
        showError(error.message);
        googleBtn.disabled = false;
        googleBtn.innerHTML = originalText;
      } finally {
        isSubmitting = false;
      }
    });
  }

  // Clear error on input
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      if (authError && authError.style.display !== 'none') clearErrors();
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      if (authError && authError.style.display !== 'none') clearErrors();
    });
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();

    if (isSubmitting) return;

    clearErrors();

    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';
    const confirmPassword = confirmPasswordInput?.value || '';

    // Validation
    if (!email) { showError('Please enter your email address'); if(emailInput) emailInput.focus(); return; }
    if (!isValidEmail(email)) { showError('Please enter a valid email address'); if(emailInput) emailInput.focus(); return; }
    if (!password) { showError('Please enter a password'); if(passwordInput) passwordInput.focus(); return; }
    if (password.length < 6) { showError('Password must be at least 6 characters long'); if(passwordInput) passwordInput.focus(); return; }

    if (!isLogin) {
      if (!confirmPassword) { showError('Please confirm your password'); if(confirmPasswordInput) confirmPasswordInput.focus(); return; }
      if (password !== confirmPassword) { showError('Passwords do not match'); if(confirmPasswordInput) confirmPasswordInput.focus(); return; }
    }

    await submitAuth(email, password);
  }

  async function submitAuth(email, password) {
    isSubmitting = true;
    const originalText = submitBtn.textContent;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = isLogin ? 'Signing In...' : 'Creating Account...';

      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      if (authForm) authForm.reset();
    } catch (error) {
      showError(error.message || 'Authentication failed. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    } finally {
      isSubmitting = false;
    }
  }

  function showError(message) {
    if (!authError) return;
    authError.textContent = message;
    authError.style.display = 'block';
  }

  function clearErrors() {
    if (!authError) return;
    authError.textContent = '';
    authError.style.display = 'none';
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function showAuthScreen(authScreen, appContainer) {
  authScreen.style.display = 'flex';
  appContainer.style.display = 'none';
  setTimeout(() => { if(document.getElementById('email')) document.getElementById('email').focus(); }, 100);
}

export function hideAuthScreen(authScreen, appContainer) {
  authScreen.style.display = 'none';
  appContainer.style.display = 'flex';
}

export function resetAuthForm() {
  const authForm = document.getElementById('auth-form');
  const confirmPasswordGroup = document.getElementById('confirm-password-group');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const authSubtitle = document.querySelector('.auth-subtitle');
  const authError = document.getElementById('auth-error');
  const googleBtn = document.getElementById('google-auth-btn'); // ✅ NEW

  isLogin = true;
  isSubmitting = false;

  if (authForm) authForm.reset();
  if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
  if (submitBtn) { submitBtn.textContent = 'Sign In'; submitBtn.disabled = false; }
  if (toggleBtn) toggleBtn.textContent = "Don't have an account? Sign Up";
  if (authSubtitle) authSubtitle.textContent = 'Sign in to continue';
  if (authError) authError.style.display = 'none';
  if (googleBtn) googleBtn.style.display = 'flex'; // ✅ NEW: Ensure button is visible on reset
}

export function updateUserDisplay(email) {
  const userEmailElement = document.getElementById('sidebar-user-email');
  if (userEmailElement) {
    userEmailElement.textContent = email;
  }
}