// Neural UI Effects
document.addEventListener('DOMContentLoaded', function() {
  // Create floating particles
  createFloatingParticles();
  
  // Initialize biometric scanner effect
  initializeBiometricScanner();
  
  // Add neural typing effect to inputs
  addNeuralInputEffects();
});

function createFloatingParticles() {
  const container = document.querySelector('.floating-particles');
  
  for (let i = 0; i < 20; i++) {
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

function initializeBiometricScanner() {
  const biometricSection = document.querySelector('.biometric-section');
  const scannerDot = document.querySelector('.scanner-dot');
  
  biometricSection.addEventListener('click', function() {
    // Simulate biometric scan
    scannerDot.style.animation = 'scannerPulse 0.5s ease-in-out infinite';
    
    setTimeout(() => {
      showNeuralNotification('Biometric authentication not available in demo mode', 'warning');
      scannerDot.style.animation = 'scannerPulse 1.5s ease-in-out infinite';
    }, 2000);
  });
}

function addNeuralInputEffects() {
  const inputs = document.querySelectorAll('input');
  
  inputs.forEach(input => {
    input.addEventListener('focus', function() {
      this.parentElement.style.transform = 'scale(1.02)';
    });
    
    input.addEventListener('blur', function() {
      this.parentElement.style.transform = 'scale(1)';
    });
    
    // Add typing sound effect simulation
    input.addEventListener('input', function() {
      const glow = this.nextElementSibling;
      if (glow) {
        glow.style.opacity = '0.2';
        setTimeout(() => {
          glow.style.opacity = '0';
        }, 100);
      }
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
  }, 4000);
}

// Import Supabase configuration
import { neuralManager } from '../supabase-config.js';

// Enhanced form submission with neural effects
const form = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");

form.onsubmit = async (e) => {
  e.preventDefault();
  
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  // Validation
  if (!email || !password) {
    showNeuralNotification("Neural ID and Access Key are required", "warning");
    return;
  }

  // Show loading state
  loginBtn.innerHTML = `
    <span class="btn-text">
      <div style="display: inline-flex; align-items: center; gap: 8px;">
        <div style="width: 16px; height: 16px; border: 2px solid transparent; border-top: 2px solid currentColor; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        Establishing Neural Connection...
      </div>
    </span>
    <div class="btn-glow"></div>
  `;
  loginBtn.disabled = true;

  try {
    // Authenticate with Supabase
    const result = await neuralManager.authenticateNeural(email, password);
    
    if (result.success) {
      // Log neural activity
      await neuralManager.logNeuralActivity(result.user.id, 'Neural authentication successful');
      
      // Success animation
      loginBtn.innerHTML = `
        <span class="btn-text">✓ Neural Link Established</span>
        <div class="btn-glow"></div>
      `;
      loginBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
      
      const userName = result.user.user_metadata?.display_name || 'Agent';
      showNeuralNotification(`Neural link established. Welcome back, ${userName}!`, "success");
      
      // Store session data
      sessionStorage.setItem('neuralSession', JSON.stringify({
        user: result.user,
        session: result.session,
        loginTime: new Date().toISOString()
      }));
      
      // Redirect to dashboard after success animation
      setTimeout(() => {
        window.location.href = "../dashboard.html";
      }, 2000);
      
    } else {
      throw new Error(result.error);
    }
    
  } catch (error) {
    // Error state
    loginBtn.innerHTML = `
      <span class="btn-text">⚠ Authentication Failed</span>
      <div class="btn-glow"></div>
    `;
    loginBtn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    
    // Show specific error message
    let errorMessage = "Access denied. Invalid neural credentials.";
    if (error.message.includes('Invalid login credentials')) {
      errorMessage = "Neural ID or Access Key incorrect.";
    } else if (error.message.includes('Email not confirmed')) {
      errorMessage = "Neural profile not activated. Check your email.";
    } else if (error.message.includes('network')) {
      errorMessage = "Neural network connection failed. Try again.";
    }
    
    showNeuralNotification(errorMessage, "error");
    
    // Reset button after error
    setTimeout(() => {
      loginBtn.innerHTML = `
        <span class="btn-text">Initialize Connection</span>
        <div class="btn-glow"></div>
      `;
      loginBtn.style.background = 'linear-gradient(135deg, var(--primary-glow), var(--secondary-glow))';
      loginBtn.disabled = false;
    }, 3000);
  }
};

// Add CSS animations for notifications
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
`;
document.head.appendChild(style);
