/**
 * SeamHQ Content Script
 * Handles overlay UI and text selection on AI conversation pages
 */

(function() {
  'use strict';

  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  
  const State = {
    MINIMIZED: 'minimized',
    IDLE: 'idle',
    SELECTING: 'selecting',
    CAPTURED: 'captured'
  };

  let currentState = State.MINIMIZED;
  let capturedText = '';
  let capturedMessages = [];

  // ============================================================
  // TEXT EXTRACTION
  // ============================================================

  function getSelectedText() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return '';
    }
    return selection.toString().trim();
  }

  function cleanText(text) {
    if (!text) return '';
    text = text.replace(/\n{3,}/g, '\n\n');
    return text.trim();
  }

  // ============================================================
  // OVERLAY UI
  // ============================================================

  let overlayElement = null;

  function createOverlay() {
    if (overlayElement) return;

    overlayElement = document.createElement('div');
    overlayElement.id = 'seamhq-overlay';
    overlayElement.className = 'seamhq-minimized seamhq-hidden';
    overlayElement.innerHTML = `
      <!-- Minimized state - just a button -->
      <div class="seamhq-mini" id="seamhq-mini">
        <button class="seamhq-mini-btn" id="seamhq-expand-btn">
          <span class="seamhq-mini-text">Seam</span>
        </button>
      </div>
      
      <!-- Expanded state -->
      <div class="seamhq-expanded" id="seamhq-expanded">
        <div class="seamhq-header">
          <span class="seamhq-logo">Seam</span>
          <button class="seamhq-close-btn" id="seamhq-close-btn" title="Minimize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="seamhq-status" id="seamhq-status">Ready to capture</div>
        <div class="seamhq-actions" id="seamhq-actions">
          <button class="seamhq-btn seamhq-btn-primary" id="seamhq-select-btn">Select New Text</button>
        </div>
        <div class="seamhq-selecting-actions seamhq-hidden" id="seamhq-selecting-actions">
          <button class="seamhq-btn seamhq-btn-primary" id="seamhq-capture-btn" disabled>Capture selection</button>
          <button class="seamhq-btn seamhq-btn-secondary" id="seamhq-cancel-btn">Cancel</button>
        </div>
        <div class="seamhq-info seamhq-hidden" id="seamhq-info"></div>
      </div>
    `;

    document.body.appendChild(overlayElement);

    // Attach event listeners
    document.getElementById('seamhq-expand-btn').addEventListener('click', handleExpand);
    document.getElementById('seamhq-close-btn').addEventListener('click', handleMinimize);
    document.getElementById('seamhq-select-btn').addEventListener('click', handleSelectClick);
    document.getElementById('seamhq-capture-btn').addEventListener('click', handleCaptureClick);
    document.getElementById('seamhq-cancel-btn').addEventListener('click', handleCancelClick);
  }

  function handleExpand() {
    currentState = State.IDLE;
    updateOverlay();
  }

  function handleMinimize() {
    disableSelectionMode();
    currentState = State.MINIMIZED;
    updateOverlay();
  }

  function updateOverlay() {
    const miniEl = document.getElementById('seamhq-mini');
    const expandedEl = document.getElementById('seamhq-expanded');
    const statusEl = document.getElementById('seamhq-status');
    const mainActions = document.getElementById('seamhq-actions');
    const selectingActions = document.getElementById('seamhq-selecting-actions');
    const infoEl = document.getElementById('seamhq-info');
    const captureBtn = document.getElementById('seamhq-capture-btn');

    if (!miniEl || !expandedEl) return;

    // Reset classes
    overlayElement.classList.remove('seamhq-minimized', 'seamhq-selecting', 'seamhq-captured');
    mainActions?.classList.remove('seamhq-hidden');
    selectingActions?.classList.add('seamhq-hidden');
    infoEl?.classList.add('seamhq-hidden');

    switch (currentState) {
      case State.MINIMIZED:
        overlayElement.classList.add('seamhq-minimized');
        break;

      case State.IDLE:
        if (statusEl) statusEl.textContent = 'Ready to capture';
        break;

      case State.SELECTING:
        overlayElement.classList.add('seamhq-selecting');
        if (statusEl) statusEl.textContent = 'Highlight text, then capture';
        mainActions?.classList.add('seamhq-hidden');
        selectingActions?.classList.remove('seamhq-hidden');
        
        const currentSelection = getSelectedText();
        if (currentSelection.length > 10 && captureBtn) {
          captureBtn.disabled = false;
          if (statusEl) statusEl.textContent = `${currentSelection.length} chars selected`;
        } else if (captureBtn) {
          captureBtn.disabled = true;
        }
        break;

      case State.CAPTURED:
        overlayElement.classList.add('seamhq-captured');
        if (statusEl) statusEl.textContent = 'Text captured!';
        if (infoEl) {
          infoEl.classList.remove('seamhq-hidden');
          infoEl.textContent = 'Open extension popup to generate thread';
        }
        break;
    }
  }

  function showToast(message, type = 'success') {
    const existingToast = document.querySelector('.seamhq-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = `seamhq-toast seamhq-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('seamhq-toast-show');
    });

    setTimeout(() => {
      toast.classList.remove('seamhq-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============================================================
  // SELECTION HANDLING
  // ============================================================

  function handleSelectClick() {
    currentState = State.SELECTING;
    updateOverlay();
    enableSelectionMode();
  }

  function handleCaptureClick() {
    const selectedText = getSelectedText();
    
    if (!selectedText || selectedText.length < 10) {
      return;
    }
    
    captureText(selectedText);
  }

  function handleCancelClick() {
    disableSelectionMode();
    currentState = State.IDLE;
    updateOverlay();
  }

  function enableSelectionMode() {
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function disableSelectionMode() {
    document.removeEventListener('selectionchange', handleSelectionChange);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  function handleSelectionChange() {
    if (currentState !== State.SELECTING) return;
    
    const captureBtn = document.getElementById('seamhq-capture-btn');
    const statusEl = document.getElementById('seamhq-status');
    
    if (!captureBtn || !statusEl) return;
    
    const selectedText = getSelectedText();
    
    if (selectedText.length > 10) {
      captureBtn.disabled = false;
      statusEl.textContent = `${selectedText.length} chars selected`;
    } else {
      captureBtn.disabled = true;
      statusEl.textContent = 'Highlight text, then capture';
    }
  }

  function handleMouseUp() {
    if (currentState !== State.SELECTING) return;
    setTimeout(() => handleSelectionChange(), 10);
  }

  function captureText(text) {
    disableSelectionMode();
    
    capturedText = cleanText(text);
    capturedMessages = [{
      role: 'assistant',
      text: capturedText,
      index: 0
    }];
    
    currentState = State.CAPTURED;
    updateOverlay();
    
    if (!chrome || !chrome.runtime) {
      console.error('SeamHQ: chrome.runtime not available');
      return;
    }
    
    chrome.runtime.sendMessage({
      type: 'SAVE_CAPTURE',
      messages: capturedMessages,
      url: window.location.href
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('SeamHQ: Message error:', chrome.runtime.lastError);
        return;
      }
      
      if (response && response.success) {
        window.getSelection()?.removeAllRanges();
        // Open extension popup after text is captured
        chrome.runtime.sendMessage({
          type: 'OPEN_POPUP'
        });
      } else {
      }
    });
  }

  // ============================================================
  // MESSAGE HANDLER
  // ============================================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ACTIVATE_SELECTION') {
      if (!overlayElement) {
        createOverlay();
      }
      overlayElement.classList.remove('seamhq-hidden');
      handleExpand();
      handleSelectClick();
      sendResponse({ success: true });
    }
    return true;
  });

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createOverlay);
    } else {
      createOverlay();
    }
    
    const observer = new MutationObserver(() => {
      if (!document.getElementById('seamhq-overlay')) {
        createOverlay();
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    console.log('SeamHQ: Content script initialized');
  }

  init();

})();
