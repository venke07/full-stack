// Neural UI Effects
document.addEventListener('DOMContentLoaded', function() {
  // Create floating particles
  createFloatingParticles();
  
  // Initialize password strength checker
  initializePasswordStrength();
  
  // Add neural input effects
  addNeuralInputEffects();
  
  // Initialize feature cards animation
  initializeFeatureCards();
});

function createFloatingParticles() {
  const container = document.querySelector('.floating-particles');
  
  for (let i = 0; i < 25; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.cssText = `
      position: absolute;
      width: 2px;
      height: 2px;
      background: var(--primary-glow);
      border-radius: 50%;
      box-shadow: 0 0 6px var(--primary-glow);
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation: float ${3 + Math.random() * 4}s linear infinite;
      animation-delay: ${Math.random() * 2}s;
      opacity: ${0.3 + Math.random() * 0.7};
    `;
    container.appendChild(particle);
  }
}

function initializePasswordStrength() {
  const passwordInput = document.getElementById('password');
  const strengthFill = document.querySelector('.strength-fill');
  const strengthText = document.querySelector('.strength-text');
  
  passwordInput.addEventListener('input', function() {
    const password = this.value;
    const strength = calculatePasswordStrength(password);
    
    // Update strength bar
    strengthFill.style.width = `${strength.score * 25}%`;
    strengthText.textContent = `Key Strength: ${strength.level}`;
    
    // Update colors based on strength
    if (strength.score <= 1) {
      strengthFill.style.background = '#ef4444';
      strengthText.style.color = '#ef4444';
    } else if (strength.score <= 2) {
      strengthFill.style.background = 'var(--accent-glow)';
      strengthText.style.color = 'var(--accent-glow)';
    } else if (strength.score <= 3) {
      strengthFill.style.background = 'var(--primary-glow)';
      strengthText.style.color = 'var(--primary-glow)';
    } else {
      strengthFill.style.background = 'var(--success-glow)';
      strengthText.style.color = 'var(--success-glow)';
    }
  });
}

function calculatePasswordStrength(password) {
  let score = 0;
  let level = 'Weak';
  
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  switch (score) {
    case 0:
    case 1:
      level = 'Weak';
      break;
    case 2:
      level = 'Fair';
      break;
    case 3:
      level = 'Good';
      break;
    case 4:
    case 5:
      level = 'Strong';
      break;
  }
  
  return { score, level };
}

function addNeuralInputEffects() {
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
  
  inputs.forEach(input => {
    input.addEventListener('focus', function() {
      this.parentElement.style.transform = 'scale(1.02)';
      
      // Add ripple effect
      const ripple = document.createElement('div');
      ripple.style.cssText = `
        position: absolute;
        top: 50%;
        left: 20px;
        width: 0;
        height: 0;
        background: radial-gradient(circle, rgba(0, 212, 255, 0.3), transparent);
        border-radius: 50%;
        pointer-events: none;
        animation: rippleExpand 0.6s ease-out;
      `;
      this.parentElement.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
    
    input.addEventListener('blur', function() {
      this.parentElement.style.transform = 'scale(1)';
    });
    
    // Add typing effect
    input.addEventListener('input', function() {
      const glow = this.nextElementSibling;
      if (glow && glow.classList.contains('input-glow')) {
        glow.style.opacity = '0.2';
        setTimeout(() => {
          glow.style.opacity = '0';
        }, 100);
      }
    });
  });
}

function initializeFeatureCards() {
  const featureCards = document.querySelectorAll('.feature-card');
  
  featureCards.forEach((card, index) => {
    // Stagger animation
    card.style.animationDelay = `${index * 0.2}s`;
    
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateX(10px) scale(1.02)';
      this.querySelector('.feature-icon').style.transform = 'scale(1.1)';
      
      // Add glow effect
      this.style.boxShadow = '0 8px 32px rgba(0, 212, 255, 0.2)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateX(0) scale(1)';
      this.querySelector('.feature-icon').style.transform = 'scale(1)';
      this.style.boxShadow = 'none';
    });
  });
}

function showNeuralNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotification = document.querySelector('.neural-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = 'neural-notification';
  
  const colors = {
    info: 'var(--primary-glow)',
    success: '#10b981',
    warning: 'var(--accent-glow)',
    error: '#ef4444'
  };
  
  notification.style.cssText = `
    position: fixed;
    top: 30px;
    right: 30px;
    background: rgba(26, 26, 46, 0.95);
    border: 1px solid ${colors[type]};
    border-radius: 12px;
    padding: 16px 20px;
    color: var(--text-primary);
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3), 0 0 20px ${colors[type]}33;
    backdrop-filter: blur(20px);
    z-index: 1000;
    animation: slideInRight 0.3s ease-out;
    max-width: 350px;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 8px; height: 8px; background: ${colors[type]}; border-radius: 50%; box-shadow: 0 0 10px ${colors[type]};"></div>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Import Supabase configuration
import { neuralManager } from '../supabase-config.js';

// Enhanced form submission with neural effects
const form = document.getElementById("signupForm");
const signupBtn = document.getElementById("signupBtn");

form.onsubmit = async (e) => {
  e.preventDefault();
  
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const termsAccepted = document.getElementById("terms").checked;

  // Validation
  if (!name || !email || !password) {
    showNeuralNotification("All neural profile fields are required", "warning");
    return;
  }

  if (!termsAccepted) {
    showNeuralNotification("Please accept the Neural Protocol Terms", "warning");
    return;
  }

  // Check password strength
  const strength = calculatePasswordStrength(password);
  if (strength.score < 2) {
    showNeuralNotification("Access key too weak. Minimum Fair strength required.", "error");
    return;
  }

  // Show processing state
  signupBtn.innerHTML = `
    <span class="btn-text">
      <div style="display: inline-flex; align-items: center; gap: 8px;">
        <div style="width: 16px; height: 16px; border: 2px solid transparent; border-top: 2px solid currentColor; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        Initializing Neural Profile...
      </div>
    </span>
    <div class="btn-glow"></div>
  `;
  signupBtn.disabled = true;

  try {
    // Create neural profile with Supabase
    const result = await neuralManager.createNeuralProfile(name, email, password);
    
    if (result.success) {
      // Success animation
      signupBtn.innerHTML = `
        <span class="btn-text">✓ Neural Profile Initialized</span>
        <div class="btn-glow"></div>
      `;
      signupBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      
      showNeuralNotification(`Neural profile created successfully! Welcome to the network, ${name}.`, "success");
      
      // Show email verification message if needed
      if (result.user && !result.user.email_confirmed_at) {
        setTimeout(() => {
          showNeuralNotification("Please check your email to activate your neural profile.", "info");
        }, 2000);
      }
      
      // Redirect to login page after success animation
      setTimeout(() => {
        window.location.href = "../login/index.html";
      }, 3500);
      
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    // Error state
    signupBtn.innerHTML = `
      <span class="btn-text">⚠ Profile Creation Failed</span>
      <div class="btn-glow"></div>
    `;
    signupBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    
    // Show specific error message
    let errorMessage = "Neural profile creation failed. Please try again.";
    if (error.message.includes('already registered')) {
      errorMessage = "Neural ID already exists. Try logging in instead.";
    } else if (error.message.includes('Password')) {
      errorMessage = "Access key requirements not met. Use stronger key.";
    } else if (error.message.includes('Invalid email')) {
      errorMessage = "Invalid Neural ID format. Please check your email.";
    } else if (error.message.includes('network')) {
      errorMessage = "Neural network connection failed. Try again.";
    }
    
    showNeuralNotification(errorMessage, "error");
    
    // Reset button after error
    setTimeout(() => {
      signupBtn.innerHTML = `
        <span class="btn-text">Initialize Neural Profile</span>
        <div class="btn-glow"></div>
      `;
      signupBtn.style.background = 'linear-gradient(135deg, var(--primary-glow), var(--secondary-glow))';
      signupBtn.disabled = false;
    }, 3000);
  }
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  @keyframes rippleExpand {
    to {
      width: 100px;
      height: 100px;
      margin-top: -50px;
      margin-left: -50px;
      opacity: 0;
    }
  }
  
  @keyframes float {
    0% { transform: translateY(100vh) translateX(0px) rotate(0deg); }
    100% { transform: translateY(-100px) translateX(100px) rotate(180deg); }
  }
`;
document.head.appendChild(style);
