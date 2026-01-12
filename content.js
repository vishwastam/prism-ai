/**
 * Prism AI - Privacy HUD for LLMs
 * Tier 1 Chrome Extension
 *
 * Invisible until needed, powerful when activated.
 */

class PrismAI {
  constructor() {
    this.state = {
      score: 100,
      stats: { critical: 0, sensitive: 0, contextual: 0 },
      sessionStats: { critical: 0, sensitive: 0, contextual: 0 },
      isExpanded: false,
      isGhostMode: false,
      isDarkMode: false,
      detections: [],
      activeTooltip: null,
    };

    this.elements = {
      pill: null,
      tooltip: null,
    };

    this.debounceTimer = null;
    this.observer = null;
    this.themeObserver = null;

    this.init();
  }

  // ========================================
  // Risk Explanations Database
  // ========================================

  riskExplanations = {
    // Critical
    'AWS Access Key': {
      icon: '🔑',
      description: 'AWS credentials can grant full access to cloud infrastructure. If exposed, attackers could spin up resources, access data, or incur charges.',
    },
    'AWS Secret Key': {
      icon: '🔑',
      description: 'AWS secret keys paired with access keys provide full API access. Never share these with AI services.',
    },
    'Private Key': {
      icon: '🔐',
      description: 'Private keys are used for encryption and authentication. Exposure could allow impersonation or data decryption.',
    },
    'API Key': {
      icon: '🔑',
      description: 'API keys authenticate requests to services. Leaked keys can be used to access your accounts or exhaust rate limits.',
    },
    'Bearer Token': {
      icon: '🎫',
      description: 'Bearer tokens grant API access. They often have expiration but can be abused while valid.',
    },
    'Password': {
      icon: '🔒',
      description: 'Passwords should never be shared. AI services may log inputs, creating potential exposure.',
    },
    'JWT Token': {
      icon: '🎟️',
      description: 'JSON Web Tokens contain encoded claims and can grant access to protected resources.',
    },
    'GitHub Token': {
      icon: '🐙',
      description: 'GitHub tokens can access repositories, actions, and account settings. Treat as highly sensitive.',
    },
    'Slack Token': {
      icon: '💬',
      description: 'Slack tokens can read messages, post content, and access workspace data.',
    },
    'Social Security Number': {
      icon: '🆔',
      description: 'SSNs are permanent identifiers used for identity theft. Never share with any AI service.',
    },
    'Credit Card': {
      icon: '💳',
      description: 'Credit card numbers enable fraudulent transactions. PCI compliance prohibits unnecessary storage.',
    },
    'Bank Account': {
      icon: '🏦',
      description: 'Bank account numbers combined with routing numbers enable unauthorized transfers.',
    },

    // Sensitive
    'Email Address': {
      icon: '📧',
      description: 'Email addresses enable spam, phishing, and can be correlated across data breaches.',
    },
    'Phone Number': {
      icon: '📱',
      description: 'Phone numbers enable spam calls, SMS phishing, and SIM swapping attacks.',
    },
    'Street Address': {
      icon: '🏠',
      description: 'Physical addresses enable stalking, targeted theft, or unwanted contact.',
    },
    'Full Name': {
      icon: '👤',
      description: 'Full names combined with other data points enable identity correlation.',
    },
    'Date of Birth': {
      icon: '🎂',
      description: 'Birth dates are common security questions and identity verification factors.',
    },

    // Contextual
    'IP Address': {
      icon: '🌐',
      description: 'IP addresses reveal approximate location and can identify network infrastructure.',
    },
    'Internal URL': {
      icon: '🔗',
      description: 'Internal URLs expose network architecture and may reveal security vulnerabilities.',
    },
    'Company Name': {
      icon: '🏢',
      description: 'Company context may reveal business relationships or confidential projects.',
    },
    'Project Codename': {
      icon: '📁',
      description: 'Project names may reveal strategic initiatives not meant for public knowledge.',
    },
  };

  // ========================================
  // Pattern Definitions (Improved)
  // ========================================

  patterns = {
    critical: [
      // Credentials - High precision patterns
      { name: 'AWS Access Key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
      { name: 'AWS Secret Key', regex: /\b[0-9a-zA-Z/+=]{40}\b/g, contextRequired: ['aws', 'secret', 'key'] },
      { name: 'Private Key', regex: /-----BEGIN (RSA |OPENSSH |EC |DSA |PGP )?PRIVATE KEY-----/g },
      { name: 'API Key', regex: /\b(sk|pk|api|key)[_-][a-zA-Z0-9]{20,}\b/gi },
      { name: 'Bearer Token', regex: /\bBearer\s+[a-zA-Z0-9\-._~+/]+=*\b/gi },
      { name: 'Password', regex: /\b(password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{8,}['"]?/gi },
      { name: 'JWT Token', regex: /\beyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g },
      { name: 'GitHub Token', regex: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}\b/g },
      { name: 'Slack Token', regex: /\bxox[baprs]-[0-9a-zA-Z-]{10,}\b/g },

      // Identity - Critical
      { name: 'Social Security Number', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
      { name: 'Credit Card', regex: /\b(?:4[0-9]{3}|5[1-5][0-9]{2}|6011|3[47][0-9]{2})[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}\b/g },
      { name: 'Bank Account', regex: /\b\d{8,17}\b/g, contextRequired: ['account', 'bank', 'routing', 'iban'] },
    ],

    sensitive: [
      // Contact Info
      { name: 'Email Address', regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g },
      { name: 'Phone Number', regex: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g },

      // Address
      { name: 'Street Address', regex: /\b\d{1,5}\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Court|Ct|Lane|Ln|Way)\b/gi },
      { name: 'ZIP Code', regex: /\b\d{5}(?:-\d{4})?\b/g, contextRequired: ['address', 'zip', 'postal', 'city', 'state'] },

      // Personal
      { name: 'Full Name', regex: /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?\b/g, excludePhrases: ['New York', 'Los Angeles', 'San Francisco', 'United States', 'Customer Support', 'Best Regards', 'Thank You', 'Please Note', 'For Example', 'In This', 'At The', 'Open Source'] },
      { name: 'Date of Birth', regex: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g, contextRequired: ['dob', 'birth', 'born', 'birthday'] },
    ],

    contextual: [
      // Network
      { name: 'IP Address', regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g },
      { name: 'Internal URL', regex: /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)[^\s]*/g },

      // Business
      { name: 'Company Name', regex: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Inc|LLC|Corp|Ltd|Limited)\b/g },
      { name: 'Project Codename', regex: /\b(?:project|codename|operation)\s*[:\-]?\s*[A-Z][a-z]+/gi },

      // Technical
      { name: 'Database Connection', regex: /\b(?:mongodb|mysql|postgresql|redis):\/\/[^\s]+/gi },
    ],
  };

  // ========================================
  // Redaction Templates
  // ========================================

  redactionTemplates = {
    'Email Address': { mask: '[EMAIL]', generalize: 'user@example.com' },
    'Phone Number': { mask: '[PHONE]', generalize: '(555) 000-0000' },
    'Social Security Number': { mask: '[SSN]', generalize: 'XXX-XX-XXXX' },
    'Credit Card': { mask: '[CARD]', generalize: '**** **** **** ****' },
    'API Key': { mask: '[API_KEY]', generalize: 'sk_***' },
    'AWS Access Key': { mask: '[AWS_KEY]', generalize: 'AKIA***' },
    'Password': { mask: '[PASSWORD]', generalize: '********' },
    'Full Name': { mask: '[NAME]', generalize: 'John Doe' },
    'Street Address': { mask: '[ADDRESS]', generalize: '123 Main St' },
    'IP Address': { mask: '[IP]', generalize: '0.0.0.0' },
    'default': { mask: '[REDACTED]', generalize: '***' },
  };

  // ========================================
  // Initialization
  // ========================================

  init() {
    this.detectTheme();
    this.observeThemeChanges();
    this.loadStats();
    this.injectPill();
    this.observeInputs();
    this.setupMessageListener();
    this.setupKeyboardShortcuts();
  }

  // ========================================
  // Theme Detection
  // ========================================

  detectTheme() {
    const isDark =
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches ||
      this.isBackgroundDark(document.body);

    this.state.isDarkMode = isDark;
    document.documentElement.setAttribute('data-prism-theme', isDark ? 'dark' : 'light');
  }

  isBackgroundDark(element) {
    const bg = window.getComputedStyle(element).backgroundColor;
    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return false;
    const [, r, g, b] = match.map(Number);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }

  observeThemeChanges() {
    // Watch for class changes on html/body
    this.themeObserver = new MutationObserver(() => this.detectTheme());
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Watch for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.detectTheme());
  }

  // ========================================
  // Pill HUD
  // ========================================

  injectPill() {
    if (this.elements.pill) return;

    const pill = document.createElement('div');
    pill.id = 'prism-pill';
    pill.innerHTML = this.renderCollapsedPill();
    document.body.appendChild(pill);
    this.elements.pill = pill;

    // Event listeners
    pill.addEventListener('click', (e) => this.handlePillClick(e));
    document.addEventListener('click', (e) => this.handleOutsideClick(e));
  }

  renderCollapsedPill() {
    const { score, sessionStats } = this.state;
    const statusClass = score >= 80 ? 'safe' : score >= 50 ? 'caution' : 'alert';
    const hasDetections = sessionStats.critical > 0 || sessionStats.sensitive > 0;
    const pulseClass = hasDetections ? 'pulse' : '';

    return `
      <div class="prism-pill-collapsed">
        <div class="prism-status-dot ${statusClass} ${pulseClass}"></div>
        <span class="prism-score-display">${score}</span>
        <span class="prism-logo-mini">Prism</span>
      </div>
    `;
  }

  renderExpandedPill() {
    const { score, sessionStats, isGhostMode } = this.state;
    const strokeColor = score >= 80 ? 'var(--prism-safe)' : score >= 50 ? 'var(--prism-sensitive)' : 'var(--prism-critical)';
    const circumference = 2 * Math.PI * 34;
    const offset = circumference - (score / 100) * circumference;

    return `
      <div class="prism-pill-expanded">
        <div class="prism-header">
          <div class="prism-brand">
            <span class="prism-brand-icon">🛡️</span>
            <span class="prism-brand-name">Prism AI</span>
          </div>
          <button class="prism-close-btn" data-action="close">×</button>
        </div>

        <div class="prism-score-section">
          <div class="prism-score-ring">
            <svg viewBox="0 0 80 80">
              <circle class="prism-score-ring-bg" cx="40" cy="40" r="34"/>
              <circle class="prism-score-ring-fill" cx="40" cy="40" r="34"
                stroke="${strokeColor}"
                stroke-dasharray="${circumference}"
                stroke-dashoffset="${offset}"/>
            </svg>
            <span class="prism-score-value">${score}</span>
          </div>
          <div class="prism-score-label">Privacy Score</div>
        </div>

        <div class="prism-stats">
          <div class="prism-stat">
            <div class="prism-stat-count critical">${sessionStats.critical}</div>
            <div class="prism-stat-label">Critical</div>
          </div>
          <div class="prism-stat">
            <div class="prism-stat-count sensitive">${sessionStats.sensitive}</div>
            <div class="prism-stat-label">Sensitive</div>
          </div>
          <div class="prism-stat">
            <div class="prism-stat-count contextual">${sessionStats.contextual}</div>
            <div class="prism-stat-label">Context</div>
          </div>
        </div>

        <div class="prism-actions">
          <button class="prism-action-btn primary" data-action="redact-all" ${sessionStats.critical + sessionStats.sensitive === 0 ? 'disabled' : ''}>
            🛡️ Redact All
          </button>
          <button class="prism-action-btn ${isGhostMode ? 'active' : ''}" data-action="ghost">
            ${isGhostMode ? '👁️' : '👻'} ${isGhostMode ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>
    `;
  }

  handlePillClick(e) {
    e.stopPropagation(); // Prevent document click from firing
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'close') {
      this.collapsePill();
    } else if (action === 'redact-all') {
      this.redactAll();
    } else if (action === 'ghost') {
      this.toggleGhostMode();
    } else if (!this.state.isExpanded) {
      this.expandPill();
    }
  }

  handleOutsideClick(e) {
    if (this.state.isExpanded && !this.elements.pill.contains(e.target)) {
      this.collapsePill();
    }
  }

  expandPill() {
    this.state.isExpanded = true;
    this.elements.pill.innerHTML = this.renderExpandedPill();
  }

  collapsePill() {
    const expanded = this.elements.pill.querySelector('.prism-pill-expanded');
    if (expanded) {
      expanded.classList.add('closing');
      setTimeout(() => {
        this.state.isExpanded = false;
        this.elements.pill.innerHTML = this.renderCollapsedPill();
      }, 200);
    }
  }

  updatePill() {
    if (this.state.isExpanded) {
      this.elements.pill.innerHTML = this.renderExpandedPill();
    } else {
      this.elements.pill.innerHTML = this.renderCollapsedPill();
    }
  }

  // ========================================
  // Text Analysis
  // ========================================

  analyzeText(text) {
    const detections = [];
    const contextLower = text.toLowerCase();

    for (const [level, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        // Reset regex
        pattern.regex.lastIndex = 0;

        let match;
        while ((match = pattern.regex.exec(text)) !== null) {
          // Context check
          if (pattern.contextRequired) {
            const hasContext = pattern.contextRequired.some(ctx => contextLower.includes(ctx));
            if (!hasContext) continue;
          }

          // Exclusion check
          if (pattern.excludePhrases) {
            const isExcluded = pattern.excludePhrases.some(phrase =>
              match[0].includes(phrase) || text.substring(match.index - 10, match.index + match[0].length + 10).includes(phrase)
            );
            if (isExcluded) continue;
          }

          detections.push({
            text: match[0],
            index: match.index,
            name: pattern.name,
            level,
          });
        }
      }
    }

    // Deduplicate overlapping matches
    const uniqueDetections = this.deduplicateDetections(detections);

    // Calculate score
    const score = this.calculateScore(uniqueDetections);

    return { detections: uniqueDetections, score };
  }

  deduplicateDetections(detections) {
    return detections.filter((d, i, arr) => {
      return !arr.some((other, j) =>
        i !== j &&
        other.index <= d.index &&
        other.index + other.text.length >= d.index + d.text.length &&
        this.getLevelPriority(other.level) >= this.getLevelPriority(d.level)
      );
    });
  }

  getLevelPriority(level) {
    return { critical: 3, sensitive: 2, contextual: 1 }[level] || 0;
  }

  calculateScore(detections) {
    const weights = { critical: 15, sensitive: 8, contextual: 3 };
    let penalty = 0;

    for (const d of detections) {
      penalty += weights[d.level] || 0;
    }

    return Math.max(0, Math.round(100 - penalty));
  }

  // ========================================
  // Input Observation
  // ========================================

  observeInputs() {
    const handleInput = (e) => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.processInput(e.target), 150);
    };

    const attachListeners = () => {
      const inputs = document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]');
      inputs.forEach(input => {
        if (input.dataset.prismAttached) return;
        input.dataset.prismAttached = 'true';
        input.addEventListener('input', handleInput);
        input.addEventListener('paste', () => setTimeout(() => handleInput({ target: input }), 10));
      });
    };

    attachListeners();

    this.observer = new MutationObserver(attachListeners);
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  processInput(element) {
    const text = element.value || element.textContent || '';
    if (!text.trim()) {
      this.clearInputHighlight(element);
      this.state.detections = [];
      this.state.score = 100;
      this.state.sessionStats = { critical: 0, sensitive: 0, contextual: 0 };
      this.updatePill();
      return;
    }

    const { detections, score } = this.analyzeText(text);

    // Update state
    this.state.detections = detections;
    this.state.score = score;
    this.state.sessionStats = {
      critical: detections.filter(d => d.level === 'critical').length,
      sensitive: detections.filter(d => d.level === 'sensitive').length,
      contextual: detections.filter(d => d.level === 'contextual').length,
    };

    // Persist total stats
    this.state.stats.critical += this.state.sessionStats.critical;
    this.state.stats.sensitive += this.state.sessionStats.sensitive;
    this.state.stats.contextual += this.state.sessionStats.contextual;
    this.saveStats();

    // Visual feedback
    this.highlightInput(element, detections);
    this.updatePill();
  }

  highlightInput(element, detections) {
    // Remove existing classes
    element.classList.remove('prism-input-critical', 'prism-input-sensitive', 'prism-input-contextual', 'prism-input-safe');

    if (detections.length === 0) {
      element.classList.add('prism-input-safe');
      return;
    }

    const highestLevel = detections.some(d => d.level === 'critical') ? 'critical' :
                         detections.some(d => d.level === 'sensitive') ? 'sensitive' : 'contextual';

    element.classList.add(`prism-input-${highestLevel}`);

    // Store detections for tooltip access
    element.dataset.prismDetections = JSON.stringify(detections);

    // Add click listener for tooltips
    if (!element.dataset.prismTooltipListener) {
      element.dataset.prismTooltipListener = 'true';
      element.addEventListener('click', (e) => this.handleInputClick(e, element));
    }
  }

  clearInputHighlight(element) {
    element.classList.remove('prism-input-critical', 'prism-input-sensitive', 'prism-input-contextual', 'prism-input-safe');
    delete element.dataset.prismDetections;
  }

  // ========================================
  // Tooltip System
  // ========================================

  handleInputClick(e, element) {
    const detectionsJson = element.dataset.prismDetections;
    if (!detectionsJson) return;

    const detections = JSON.parse(detectionsJson);
    if (detections.length === 0) return;

    // Find which detection was clicked (approximate by cursor position)
    const text = element.value || element.textContent;
    const cursorPos = element.selectionStart || 0;

    const clickedDetection = detections.find(d =>
      cursorPos >= d.index && cursorPos <= d.index + d.text.length
    ) || detections[0];

    this.showTooltip(clickedDetection, e.clientX, e.clientY, element);
  }

  showTooltip(detection, x, y, inputElement) {
    this.hideTooltip();

    const explanation = this.riskExplanations[detection.name] || this.riskExplanations['default'] || {
      icon: '⚠️',
      description: 'This data may be sensitive. Consider removing before sending.',
    };

    const tooltip = document.createElement('div');
    tooltip.className = 'prism-tooltip';
    tooltip.innerHTML = `
      <div class="prism-tooltip-header">
        <div class="prism-tooltip-icon ${detection.level}">${explanation.icon}</div>
        <div class="prism-tooltip-title">${detection.name}</div>
      </div>
      <div class="prism-tooltip-body">${explanation.description}</div>
      <div class="prism-tooltip-actions">
        <button class="prism-tooltip-btn primary" data-action="redact">🛡️ Redact</button>
        <button class="prism-tooltip-btn" data-action="dismiss">Dismiss</button>
      </div>
    `;

    // Position tooltip
    tooltip.style.left = `${Math.min(x, window.innerWidth - 280)}px`;
    tooltip.style.top = `${Math.max(10, y - 150)}px`;

    document.body.appendChild(tooltip);
    this.elements.tooltip = tooltip;
    this.state.activeTooltip = { detection, inputElement };

    // Event listeners
    tooltip.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'redact') {
        this.redactDetection(detection, inputElement);
        this.hideTooltip();
      } else if (action === 'dismiss') {
        this.hideTooltip();
      }
    });

    // Auto-hide on outside click
    setTimeout(() => {
      document.addEventListener('click', this.handleTooltipOutsideClick, { once: true });
    }, 0);
  }

  handleTooltipOutsideClick = (e) => {
    if (this.elements.tooltip && !this.elements.tooltip.contains(e.target)) {
      this.hideTooltip();
    }
  };

  hideTooltip() {
    if (this.elements.tooltip) {
      this.elements.tooltip.remove();
      this.elements.tooltip = null;
      this.state.activeTooltip = null;
    }
  }

  // ========================================
  // Redaction
  // ========================================

  redactDetection(detection, element) {
    const text = element.value || element.textContent;
    const template = this.redactionTemplates[detection.name] || this.redactionTemplates['default'];
    const replacement = template.mask;

    const newText = text.substring(0, detection.index) + replacement + text.substring(detection.index + detection.text.length);

    if (element.value !== undefined) {
      element.value = newText;
    } else {
      element.textContent = newText;
    }

    // Trigger input event to re-analyze
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  redactAll() {
    const { detections } = this.state;
    if (detections.length === 0) return;

    // Find the active input
    const input = document.querySelector('[data-prism-detections]');
    if (!input) return;

    let text = input.value || input.textContent;

    // Sort detections by index descending to replace from end
    const sorted = [...detections].sort((a, b) => b.index - a.index);

    for (const detection of sorted) {
      const template = this.redactionTemplates[detection.name] || this.redactionTemplates['default'];
      text = text.substring(0, detection.index) + template.mask + text.substring(detection.index + detection.text.length);
    }

    if (input.value !== undefined) {
      input.value = text;
    } else {
      input.textContent = text;
    }

    // Trigger input event
    input.dispatchEvent(new Event('input', { bubbles: true }));
    this.collapsePill();
  }

  // ========================================
  // Ghost Mode
  // ========================================

  toggleGhostMode() {
    this.state.isGhostMode = !this.state.isGhostMode;

    const inputs = document.querySelectorAll('textarea, [contenteditable="true"], input[type="text"]');
    inputs.forEach(input => {
      if (this.state.isGhostMode) {
        input.classList.add('prism-ghost-active');
      } else {
        input.classList.remove('prism-ghost-active');
      }
    });

    this.updatePill();
  }

  // ========================================
  // Keyboard Shortcuts
  // ========================================

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + Shift + R = Redact All
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'r') {
        e.preventDefault();
        this.redactAll();
      }
      // Cmd/Ctrl + Shift + G = Ghost Mode
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'g') {
        e.preventDefault();
        this.toggleGhostMode();
      }
      // Escape = Close expanded pill / tooltip
      if (e.key === 'Escape') {
        this.hideTooltip();
        if (this.state.isExpanded) this.collapsePill();
      }
    });
  }

  // ========================================
  // Storage
  // ========================================

  saveStats() {
    chrome.storage?.local?.set({ prismStats: this.state.stats });
  }

  loadStats() {
    chrome.storage?.local?.get(['prismStats'], (result) => {
      if (result?.prismStats) {
        this.state.stats = result.prismStats;
      }
    });
  }

  // ========================================
  // Message Listener
  // ========================================

  setupMessageListener() {
    chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
      if (request.action === 'getStats') {
        sendResponse({
          ...this.state.stats,
          sessionStats: this.state.sessionStats,
          score: this.state.score,
        });
      } else if (request.action === 'resetStats') {
        this.state.stats = { critical: 0, sensitive: 0, contextual: 0 };
        this.state.sessionStats = { critical: 0, sensitive: 0, contextual: 0 };
        this.saveStats();
        sendResponse({ success: true });
      }
      return true;
    });
  }
}

// ========================================
// Initialize
// ========================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PrismAI());
} else {
  new PrismAI();
}
