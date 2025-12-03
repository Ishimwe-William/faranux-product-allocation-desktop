/* ============================================
   views/auth.js - Authentication View
   ============================================ */

import { signIn, signUp } from '../firebase.js';

let isLogin = true;
let isSubmitting = false;

/**
 * Setup authentication form handlers
 */
export function setupAuthHandlers() {
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const submitBtn = document.getElementById('auth-submit-btn');
  const confirmPasswordGroup = document.getElementById('confirm-password-group');
  const authForm = document.getElementById('auth-form');
  const authError = document.getElementById('auth-error');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const authSubtitle = document.getElementById('auth-subtitle');

  // Safety check - if elements don't exist, exit early
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
    } else {
      submitBtn.textContent = 'Sign Up';
      toggleBtn.textContent = 'Already have an account? Sign In';
      if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'block';
      if (authSubtitle) authSubtitle.textContent = 'Create a new account';
    }

    // Clear form
    authForm.reset();
    if (emailInput) emailInput.focus();
  });

  // Handle form submission
  authForm.addEventListener('submit', handleAuthSubmit);

  // Clear error on input
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      if (authError && authError.style.display !== 'none') {
        clearErrors();
      }
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      if (authError && authError.style.display !== 'none') {
        clearErrors();
      }
    });
  }

  /**
   * Handle authentication form submission
   */
  async function handleAuthSubmit(e) {
    e.preventDefault();

    if (isSubmitting) return;

    clearErrors();

    const email = emailInput?.value?.trim() || '';
    const password = passwordInput?.value || '';
    const confirmPassword = confirmPasswordInput?.value || '';

    // Validation
    if (!email) {
      showError('Please enter your email address');
      if (emailInput) emailInput.focus();
      return;
    }

    if (!isValidEmail(email)) {
      showError('Please enter a valid email address');
      if (emailInput) emailInput.focus();
      return;
    }

    if (!password) {
      showError('Please enter a password');
      if (passwordInput) passwordInput.focus();
      return;
    }

    if (password.length < 6) {
      showError('Password must be at least 6 characters long');
      if (passwordInput) passwordInput.focus();
      return;
    }

    if (!isLogin) {
      if (!confirmPassword) {
        showError('Please confirm your password');
        if (confirmPasswordInput) confirmPasswordInput.focus();
        return;
      }

      if (password !== confirmPassword) {
        showError('Passwords do not match');
        if (confirmPasswordInput) confirmPasswordInput.focus();
        return;
      }
    }

    // Submit
    await submitAuth(email, password);
  }

  /**
   * Submit authentication request
   */
  async function submitAuth(email, password) {
    isSubmitting = true;
    const submitBtnEl = document.getElementById('auth-submit-btn');
    const originalText = submitBtnEl?.textContent || 'Sign In';

    try {
      // Show loading state
      if (submitBtnEl) {
        submitBtnEl.disabled = true;
        submitBtnEl.textContent = isLogin ? 'Signing In...' : 'Creating Account...';
      }

      if (isLogin) {
        await signIn(email, password);
        console.log('Sign in successful');
      } else {
        await signUp(email, password);
        console.log('Sign up successful');
      }

      // Form will be hidden by the app when auth state changes
      if (authForm) authForm.reset();

    } catch (error) {
      console.error('Auth error:', error);
      showError(error.message || 'Authentication failed. Please try again.');

      // Restore button
      if (submitBtnEl) {
        submitBtnEl.disabled = false;
        submitBtnEl.textContent = originalText;
      }

    } finally {
      isSubmitting = false;
    }
  }

  function showError(message) {
    if (!authError) return;
    authError.textContent = message;
    authError.style.display = 'block';
    authError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearErrors() {
    if (!authError) return;
    authError.textContent = '';
    authError.style.display = 'none';
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Show authentication screen
 */
export function showAuthScreen(authScreen, appContainer) {
  authScreen.style.display = 'flex';
  appContainer.style.display = 'none';

  // Focus on email input for better UX
  setTimeout(() => {
    document.getElementById('email').focus();
  }, 100);
}

/**
 * Hide authentication screen
 */
export function hideAuthScreen(authScreen, appContainer) {
  authScreen.style.display = 'none';
  appContainer.style.display = 'flex';
}

/**
 * Reset auth form to login state
 */
export function resetAuthForm() {
  const authForm = document.getElementById('auth-form');
  const confirmPasswordGroup = document.getElementById('confirm-password-group');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const authSubtitle = document.getElementById('auth-subtitle');
  const authError = document.getElementById('auth-error');

  isLogin = true;
  isSubmitting = false;

  if (authForm) authForm.reset();
  if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
  if (submitBtn) submitBtn.textContent = 'Sign In';
  if (submitBtn) submitBtn.disabled = false;
  if (toggleBtn) toggleBtn.textContent = "Don't have an account? Sign Up";
  if (authSubtitle) authSubtitle.textContent = 'Sign in to continue';
  if (authError) authError.style.display = 'none';
}

/**
 * Update UI with current user info
 */
export function updateUserDisplay(email) {
  const userEmailElement = document.getElementById('sidebar-user-email');
  if (userEmailElement) {
    userEmailElement.textContent = email;
  }
}
