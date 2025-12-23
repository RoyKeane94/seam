/**
 * SeamHQ Popup Script
 * Thread generation, editing, and X posting with OAuth
 */

(function() {
  'use strict';

  // ============================================================
  // STATE
  // ============================================================

  let currentCapture = null;
  let currentThread = [];
  let settings = { numbering: false };
  let twitterUser = null;
  let isPosting = false;
  let isConnecting = false;

  // ============================================================
  // DOM ELEMENTS
  // ============================================================

  const elements = {};

  function initElements() {
    elements.noCapture = document.getElementById('no-capture');
    elements.captureInfo = document.getElementById('capture-info');
    elements.threadEditor = document.getElementById('thread-editor');
    elements.settingsPanel = document.getElementById('settings-panel');
    elements.messageCount = document.getElementById('message-count');
    elements.captureTime = document.getElementById('capture-time');
    elements.generateBtn = document.getElementById('generate-btn');
    elements.clearBtn = document.getElementById('clear-btn');
    elements.regenerateBtn = document.getElementById('regenerate-btn');
    elements.copyBtn = document.getElementById('copy-btn');
    elements.settingsBtn = document.getElementById('settings-btn');
    elements.closeSettingsBtn = document.getElementById('close-settings-btn');
    elements.tweetsContainer = document.getElementById('tweets-container');
    elements.tweetCount = document.getElementById('tweet-count');
    elements.numberingToggle = document.getElementById('numbering-toggle');
    elements.postThreadBtn = document.getElementById('post-thread-btn');
    elements.postBtnText = document.getElementById('post-btn-text');
    elements.connectXBtn = document.getElementById('connect-x-btn');
    elements.disconnectXBtn = document.getElementById('disconnect-x-btn');
    elements.xDisconnected = document.getElementById('x-disconnected');
    elements.xConnected = document.getElementById('x-connected');
    elements.xUsername = document.getElementById('x-username');
    elements.statusToast = document.getElementById('status-toast');
    elements.refreshStatusBtn = document.getElementById('refresh-status-btn');
    elements.activateSelectionBtn = document.getElementById('activate-selection-btn');
  }

  // ============================================================
  // INIT
  // ============================================================

  document.addEventListener('DOMContentLoaded', async () => {
    console.log('SeamHQ Popup: Initializing...');
    initElements();
    
    // Load state immediately
    await loadState();
    await checkTwitterStatus();
    updateUI();
    
    // Event listeners
    elements.generateBtn?.addEventListener('click', handleGenerate);
    elements.clearBtn?.addEventListener('click', handleClear);
    elements.regenerateBtn?.addEventListener('click', handleGenerate);
    elements.copyBtn?.addEventListener('click', handleCopyAll);
    elements.numberingToggle?.addEventListener('change', handleNumberingChange);
    elements.activateSelectionBtn?.addEventListener('click', handleActivateSelection);
    elements.postThreadBtn?.addEventListener('click', handlePostThread);
    elements.settingsBtn?.addEventListener('click', () => toggleSettings(true));
    elements.closeSettingsBtn?.addEventListener('click', () => toggleSettings(false));
    elements.connectXBtn?.addEventListener('click', handleConnectX);
    elements.disconnectXBtn?.addEventListener('click', handleDisconnectX);
    elements.refreshStatusBtn?.addEventListener('click', async () => {
      await loadState();
      await checkTwitterStatus();
      updateUI();
      showToast('Refreshed', 'info');
    });
    
    // Refresh when popup becomes visible (user opens it)
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        console.log('SeamHQ Popup: Popup became visible, refreshing...');
        await loadState();
        await checkTwitterStatus();
        updateUI();
      }
    });
    
    // Also refresh on focus (when user clicks the extension icon)
    window.addEventListener('focus', async () => {
      console.log('SeamHQ Popup: Window focused, refreshing...');
      await loadState();
      await checkTwitterStatus();
      updateUI();
    });
    
    updateUI();
    console.log('SeamHQ Popup: Ready');
  });

  async function loadState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_CAPTURE' }, (response) => {
        console.log('SeamHQ Popup: Loaded state:', response);
        if (response?.success) {
          currentCapture = response.capture;
          currentThread = response.thread || [];
          settings = response.settings || { numbering: false };
          if (elements.numberingToggle) {
            elements.numberingToggle.checked = settings.numbering;
          }
        }
        resolve();
      });
    });
  }

  async function checkTwitterStatus() {
    console.log('SeamHQ Popup: Checking X status...');
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'TWITTER_STATUS' }, (response) => {
        console.log('SeamHQ Popup: X status:', response);
        if (response?.connected && response.user) {
          twitterUser = response.user;
        } else {
          twitterUser = null;
        }
        updateXStatus();
        resolve();
      });
    });
  }

  // ============================================================
  // UI
  // ============================================================

  function updateUI() {
    console.log('SeamHQ Popup: updateUI - currentCapture:', currentCapture);
    console.log('SeamHQ Popup: updateUI - messages length:', currentCapture?.messages?.length);
    
    elements.noCapture?.classList.add('hidden');
    elements.captureInfo?.classList.add('hidden');
    elements.threadEditor?.classList.add('hidden');
    
    if (!currentCapture?.messages?.length) {
      console.log('SeamHQ Popup: Showing no capture state');
      elements.noCapture?.classList.remove('hidden');
    } else {
      console.log('SeamHQ Popup: Showing capture info');
      elements.captureInfo?.classList.remove('hidden');
      if (elements.messageCount) elements.messageCount.textContent = 'Text captured';
      if (elements.captureTime) elements.captureTime.textContent = formatTime(currentCapture.timestamp);
      
      if (currentThread?.length) {
        elements.threadEditor?.classList.remove('hidden');
        renderTweets();
        updatePostButton();
      }
    }
    
    updateXStatus();
  }

  function updateXStatus() {
    console.log('SeamHQ Popup: Updating X status, user:', twitterUser);
    
    if (twitterUser) {
      elements.xDisconnected?.classList.add('hidden');
      elements.xConnected?.classList.remove('hidden');
      if (elements.xUsername) elements.xUsername.textContent = `@${twitterUser.username}`;
    } else {
      elements.xDisconnected?.classList.remove('hidden');
      elements.xConnected?.classList.add('hidden');
    }
    updatePostButton();
  }

  function updatePostButton() {
    if (!elements.postThreadBtn || !elements.postBtnText) return;
    
    const total = currentThread.length;
    
    if (isConnecting) {
      elements.postBtnText.textContent = 'Connecting...';
      elements.postThreadBtn.disabled = true;
    } else if (!twitterUser) {
      elements.postBtnText.textContent = 'Connect X to Post';
      elements.postThreadBtn.disabled = true;
      elements.postThreadBtn.classList.add('btn-disabled');
    } else if (isPosting) {
      elements.postBtnText.textContent = 'Posting...';
      elements.postThreadBtn.disabled = true;
    } else {
      elements.postBtnText.textContent = `Post Thread (${total} tweets)`;
      elements.postThreadBtn.disabled = false;
      elements.postThreadBtn.classList.remove('btn-disabled');
    }
  }

  function toggleSettings(show) {
    elements.settingsPanel?.classList.toggle('hidden', !show);
  }

  function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function renderTweets() {
    if (!elements.tweetsContainer) return;
    
    elements.tweetsContainer.innerHTML = '';
    if (elements.tweetCount) elements.tweetCount.textContent = `${currentThread.length} tweets`;
    
    currentThread.forEach((tweet, i) => {
      const el = createTweetEl(tweet, i);
      elements.tweetsContainer.appendChild(el);
    });
  }

  function createTweetEl(tweet, index) {
    const div = document.createElement('div');
    div.className = 'tweet-card';
    div.dataset.index = index;
    
    // Get text content for character count (strip HTML if present)
    let textContent = tweet;
    if (typeof tweet === 'string' && tweet.includes('<')) {
      const temp = document.createElement('div');
      temp.innerHTML = tweet;
      textContent = temp.textContent || temp.innerText || '';
    }
    const text = getTweetText(textContent, index);
    const over = text.length > 280;
    
    div.innerHTML = `
      <div class="tweet-header">
        <span class="tweet-number">${index + 1}</span>
        <button class="tweet-btn tweet-btn-mention" data-action="mention" title="Add @mention">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        </button>
        <div class="tweet-controls">
          <button class="tweet-btn" data-action="copy" title="Copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="tweet-btn" data-action="up" title="Move up" ${index === 0 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="tweet-btn" data-action="down" title="Move down" ${index === currentThread.length - 1 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="tweet-btn" data-action="add" title="Add below">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button class="tweet-btn tweet-btn-danger" data-action="delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <textarea class="tweet-text" data-index="${index}" rows="4">${textContent}</textarea>
      <div class="tweet-footer">
        <span class="char-count ${over ? 'over-limit' : ''}">${text.length}/280</span>
        ${over ? '<button class="split-btn" data-action="split">Split</button>' : ''}
      </div>
    `;
    
    const tweetTextEl = div.querySelector('.tweet-text');
    if (tweetTextEl) {
      tweetTextEl.addEventListener('input', handleEdit);
    }
    div.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', handleAction));
    
    return div;
  }

  function getTweetText(tweet, index) {
    // Extract plain text (remove any HTML if present, but preserve line breaks)
    let text = tweet;
    if (typeof tweet === 'string' && tweet.includes('<')) {
      // Convert HTML to text while preserving line breaks
      const temp = document.createElement('div');
      temp.innerHTML = tweet;
      
      // Convert <br> to newlines before extracting text
      temp.querySelectorAll('br').forEach(br => {
        br.replaceWith(document.createTextNode('\n'));
      });
      
      // Add newlines around block elements
      temp.querySelectorAll('p, div').forEach(el => {
        if (el.previousSibling) {
          el.insertAdjacentText('beforebegin', '\n');
        }
        if (el.nextSibling) {
          el.insertAdjacentText('afterend', '\n');
        }
      });
      
      text = temp.textContent || temp.innerText || '';
      
      // Clean up excessive newlines (max 2 consecutive)
      text = text.replace(/\n{3,}/g, '\n\n');
    }
    return settings.numbering ? `${index + 1}/${currentThread.length} ${text}` : text;
  }


  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }


  // ============================================================
  // HANDLERS
  // ============================================================

  function handleGenerate() {
    if (!currentCapture?.messages) return showToast('No text captured', 'error');
    currentThread = generateThread(currentCapture.messages);
    saveThread();
    elements.threadEditor?.classList.remove('hidden');
    renderTweets();
    updatePostButton();
  }

  function handleClear() {
    if (!confirm('Clear everything?')) return;
    chrome.runtime.sendMessage({ type: 'CLEAR_ALL' }, () => {
      currentCapture = null;
      currentThread = [];
      updateUI();
    });
  }

  async function handleCopyAll() {
    if (!currentThread.length) return;
    // Get plain text from textareas
    const textParts = currentThread.map((t, i) => {
      const el = document.querySelector(`.tweet-text[data-index="${i}"]`);
      if (el) {
        return el.value || el.textContent || '';
      }
      return getTweetText(t, i);
    });
    const text = textParts.join('\n\n---\n\n');
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  }

  function handleNumberingChange(e) {
    settings.numbering = e.target.checked;
    saveSettings();
    renderTweets();
    updatePostButton();
  }

  function handleEdit(e) {
    const i = parseInt(e.target.dataset.index);
    // Store plain text
    currentThread[i] = e.target.value || '';
    saveThread();
    
    const footer = e.target.parentElement.querySelector('.tweet-footer');
    const text = e.target.value || '';
    const len = getTweetText(text, i).length;
    const over = len > 280;
    footer.innerHTML = `<span class="char-count ${over ? 'over-limit' : ''}">${len}/280</span>${over ? '<button class="split-btn" data-action="split">Split</button>' : ''}`;
    footer.querySelector('.split-btn')?.addEventListener('click', () => splitTweet(i));
    updatePostButton();
  }


  function handleAction(e) {
    const action = e.currentTarget.dataset.action;
    const card = e.currentTarget.closest('.tweet-card');
    const i = parseInt(card.dataset.index);
    
    if (action === 'copy') {
      const tweetEl = document.querySelector(`.tweet-text[data-index="${i}"]`);
      const text = tweetEl ? (tweetEl.value || tweetEl.textContent || '') : getTweetText(currentThread[i], i);
      navigator.clipboard.writeText(text);
      showToast('Copied to clipboard', 'success');
    } else if (action === 'up' && i > 0) {
      [currentThread[i], currentThread[i - 1]] = [currentThread[i - 1], currentThread[i]];
      saveThread(); renderTweets();
    } else if (action === 'down' && i < currentThread.length - 1) {
      [currentThread[i], currentThread[i + 1]] = [currentThread[i + 1], currentThread[i]];
      saveThread(); renderTweets();
    } else if (action === 'add') {
      currentThread.splice(i + 1, 0, '');
      saveThread(); renderTweets(); updatePostButton();
    } else if (action === 'delete' && currentThread.length > 1) {
      currentThread.splice(i, 1);
      saveThread(); renderTweets(); updatePostButton();
    } else if (action === 'split') {
      splitTweet(i);
    } else if (action === 'mention') {
      handleMention(i);
    }
  }

  let currentMentionTweetIndex = null;
  let mentionDropdown = null;
  let mentionSearch = null;
  let mentionList = null;

  function handleMention(tweetIndex) {
    currentMentionTweetIndex = tweetIndex;
    
    if (!mentionDropdown) {
      mentionDropdown = document.getElementById('mention-dropdown');
      mentionSearch = document.getElementById('mention-search');
      mentionList = document.getElementById('mention-list');
      
      mentionSearch?.addEventListener('input', handleMentionSearch);
      mentionSearch?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const firstItem = mentionList?.querySelector('.mention-item');
          if (firstItem) firstItem.click();
        } else if (e.key === 'Escape') {
          closeMentionDropdown();
        }
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (mentionDropdown && !mentionDropdown.contains(e.target) && !e.target.closest('[data-action="mention"]')) {
          closeMentionDropdown();
        }
      });
    }
    
    // Position dropdown near the mention button
    const mentionBtn = document.querySelector(`.tweet-card[data-index="${tweetIndex}"] [data-action="mention"]`);
    if (mentionBtn && mentionDropdown) {
      const rect = mentionBtn.getBoundingClientRect();
      mentionDropdown.style.top = `${rect.bottom + 4}px`;
      mentionDropdown.style.left = `${rect.left}px`;
      mentionDropdown.classList.remove('hidden');
      mentionSearch?.focus();
      handleMentionSearch();
    }
  }

  function handleMentionSearch() {
    if (!mentionList || !mentionSearch) return;
    
    const query = mentionSearch.value.toLowerCase().trim();
    
    // Common/useful X accounts to suggest
    const suggestions = [
      'elonmusk', 'jack', 'OpenAI', 'AnthropicAI', 'Google', 'Microsoft',
      'verge', 'techcrunch', 'wired', 'TheEconomist', 'WSJ', 'nytimes'
    ];
    
    let filtered = suggestions;
    if (query) {
      filtered = suggestions.filter(u => u.toLowerCase().includes(query));
    }
    
    mentionList.innerHTML = '';
    
    if (query && !suggestions.some(u => u.toLowerCase() === query)) {
      // Show the searched username as first option
      const item = document.createElement('div');
      item.className = 'mention-item';
      item.innerHTML = `<span class="mention-username">@${query}</span>`;
      item.addEventListener('click', () => insertMention(query));
      mentionList.appendChild(item);
    }
    
    filtered.forEach(username => {
      const item = document.createElement('div');
      item.className = 'mention-item';
      item.innerHTML = `<span class="mention-username">@${username}</span>`;
      item.addEventListener('click', () => insertMention(username));
      mentionList.appendChild(item);
    });
    
    if (mentionList.children.length === 0) {
      mentionList.innerHTML = '<div class="mention-empty">No suggestions</div>';
    }
  }

  function insertMention(username) {
    if (currentMentionTweetIndex === null) return;
    
    const tweetEl = document.querySelector(`.tweet-text[data-index="${currentMentionTweetIndex}"]`);
    if (tweetEl && tweetEl.tagName === 'TEXTAREA') {
      const mention = `@${username} `;
      const start = tweetEl.selectionStart;
      const end = tweetEl.selectionEnd;
      const value = tweetEl.value;
      
      // Insert mention at cursor position
      tweetEl.value = value.substring(0, start) + mention + value.substring(end);
      tweetEl.selectionStart = tweetEl.selectionEnd = start + mention.length;
      tweetEl.focus();
      
      // Trigger input event to update character count
      tweetEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    closeMentionDropdown();
  }

  function closeMentionDropdown() {
    if (mentionDropdown) {
      mentionDropdown.classList.add('hidden');
      currentMentionTweetIndex = null;
      if (mentionSearch) mentionSearch.value = '';
    }
  }

  async function handlePostThread() {
    if (!twitterUser) {
      showToast('Please connect to X first', 'error');
      toggleSettings(true);
      return;
    }

    if (!currentThread.length) {
      showToast('No tweets to post', 'error');
      return;
    }

    // Check all tweets are under limit
    const tweetsToPost = currentThread.map((t, i) => getTweetText(t, i));
    const overLimit = tweetsToPost.findIndex(t => t.length > 280);
    if (overLimit !== -1) {
      showToast(`Tweet ${overLimit + 1} is over 280 characters!`, 'error');
      return;
    }

    isPosting = true;
    updatePostButton();
    showToast('Posting thread...', 'info');

    chrome.runtime.sendMessage({ 
      type: 'TWITTER_POST_THREAD', 
      tweets: tweetsToPost 
    }, (response) => {
      isPosting = false;
      updatePostButton();

      if (response?.success && response.results) {
        const successCount = response.results.filter(r => r.success).length;
        const failedAt = response.results.find(r => !r.success);
        
        if (successCount === tweetsToPost.length) {
          
          // Open the thread in a new tab
          const firstTweet = response.results[0];
          if (firstTweet?.tweet?.id && twitterUser?.username) {
            chrome.tabs.create({ 
              url: `https://twitter.com/${twitterUser.username}/status/${firstTweet.tweet.id}` 
            });
          }
        } else if (failedAt) {
          showToast(`Posted ${successCount} tweets, failed at tweet ${failedAt.index + 1}: ${failedAt.error}`, 'error');
        }
      } else {
        showToast(response?.error || 'Failed to post thread', 'error');
      }
    });
  }

  async function handleConnectX() {
    console.log('SeamHQ Popup: Connect button clicked');
    
    if (isConnecting) return;
    
    isConnecting = true;
    updatePostButton();
    
    // Update button text
    if (elements.connectXBtn) {
      elements.connectXBtn.textContent = 'Connecting...';
      elements.connectXBtn.disabled = true;
    }
    
    showToast('Opening X authorization...', 'info');
    
    chrome.runtime.sendMessage({ type: 'TWITTER_CONNECT' }, (response) => {
      console.log('SeamHQ Popup: Connect response:', response);
      
      isConnecting = false;
      
      // Reset button
      if (elements.connectXBtn) {
        elements.connectXBtn.textContent = 'Connect';
        elements.connectXBtn.disabled = false;
      }
      
      if (response?.success && response.user) {
        twitterUser = response.user;
        updateXStatus();
        updatePostButton();
      } else {
        const errorMsg = response?.error || 'Failed to connect';
        console.error('SeamHQ Popup: Connect failed:', errorMsg);
        showToast(errorMsg, 'error');
      }
    });
  }

  async function handleDisconnectX() {
    chrome.runtime.sendMessage({ type: 'TWITTER_DISCONNECT' }, (response) => {
      if (response?.success) {
        twitterUser = null;
        updateXStatus();
        updatePostButton();
      }
    });
  }

  // ============================================================
  // TWEET OPS
  // ============================================================

  function splitTweet(i) {
    // Get text content from textarea
    const tweetEl = document.querySelector(`.tweet-text[data-index="${i}"]`);
    const text = tweetEl ? (tweetEl.value || '') : (currentThread[i] || '');
    
    if (!text || text.trim().length === 0) {
      showToast('No text to split', 'error');
      return;
    }
    
    const parts = smartSplit(text);
    
    // If smartSplit couldn't split it further, try a simple split at the midpoint
    if (parts.length === 1) {
      const maxLen = settings.numbering ? 260 : 275;
      if (text.length <= maxLen) {
        showToast('Text is already short enough', 'error');
        return;
      }
      
      // Try to find a good split point (prefer newlines, then spaces)
      const midpoint = Math.floor(text.length / 2);
      let splitPoint = midpoint;
      
      // Look for a newline near the midpoint
      const newlineBefore = text.lastIndexOf('\n', midpoint);
      const newlineAfter = text.indexOf('\n', midpoint);
      
      if (newlineBefore > midpoint * 0.7) {
        splitPoint = newlineBefore + 1;
      } else if (newlineAfter > 0 && newlineAfter < midpoint * 1.3) {
        splitPoint = newlineAfter + 1;
      } else {
        // Look for a space near the midpoint
        const spaceBefore = text.lastIndexOf(' ', midpoint);
        const spaceAfter = text.indexOf(' ', midpoint);
        
        if (spaceBefore > midpoint * 0.7) {
          splitPoint = spaceBefore + 1;
        } else if (spaceAfter > 0 && spaceAfter < midpoint * 1.3) {
          splitPoint = spaceAfter + 1;
        }
      }
      
      parts[0] = text.slice(0, splitPoint).trim();
      parts.push(text.slice(splitPoint).trim());
    }
    
    if (parts.length === 1) {
      showToast('Cannot split further', 'error');
      return;
    }
    
    // Replace the single tweet with the split parts
    currentThread.splice(i, 1, ...parts);
    saveThread(); 
    renderTweets(); 
    updatePostButton();
  }

  function smartSplit(text) {
    // Account for numbering space
    const maxLen = settings.numbering ? 260 : 275;
    
    // Extract text content if HTML
    if (typeof text === 'string' && text.includes('<')) {
      const temp = document.createElement('div');
      temp.innerHTML = text;
      text = temp.textContent || temp.innerText || '';
    }
    
    if (!text || text.trim().length === 0) return [text];
    if (text.length <= maxLen) return [text];
    
    // Default: Split at midpoint (aim for 2 parts)
    // Only split into more parts if one part would still exceed maxLen
    function findBestSplitPoint(text, targetPoint) {
      // Prefer newlines near the target point
      const newlineBefore = text.lastIndexOf('\n', targetPoint);
      const newlineAfter = text.indexOf('\n', targetPoint);
      
      // Use newline if it's reasonably close (within 30% of target)
      if (newlineBefore > targetPoint * 0.7) {
        return newlineBefore + 1;
      }
      if (newlineAfter > 0 && newlineAfter < targetPoint * 1.3) {
        return newlineAfter + 1;
      }
      
      // Fall back to spaces
      const spaceBefore = text.lastIndexOf(' ', targetPoint);
      const spaceAfter = text.indexOf(' ', targetPoint);
      
      if (spaceBefore > targetPoint * 0.7) {
        return spaceBefore + 1;
      }
      if (spaceAfter > 0 && spaceAfter < targetPoint * 1.3) {
        return spaceAfter + 1;
      }
      
      // Last resort: split at target point (may split mid-word)
      return targetPoint;
    }
    
    // Try to split into 2 parts first
    const midpoint = Math.floor(text.length / 2);
    let splitPoint = findBestSplitPoint(text, midpoint);
    
    const part1 = text.slice(0, splitPoint).trim();
    const part2 = text.slice(splitPoint).trim();
    
    // If both parts fit, we're done
    if (part1.length <= maxLen && part2.length <= maxLen) {
      return [part1, part2];
    }
    
    // If one part is still too long, recursively split it
    const result = [];
    if (part1.length > maxLen) {
      result.push(...smartSplit(part1));
    } else {
      result.push(part1);
    }
    
    if (part2.length > maxLen) {
      result.push(...smartSplit(part2));
    } else {
      result.push(part2);
    }
    
    return result;
  }

  function saveThread() { 
    chrome.runtime.sendMessage({ type: 'SAVE_THREAD', thread: currentThread }); 
  }
  
  function saveSettings() { 
    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings }); 
  }

  // ============================================================
  // GENERATION
  // ============================================================

  function generateThread(messages) {
    const text = messages.map(m => m.text).join('\n\n');
    const pre = detectPreformatted(text);
    return pre || generateFromText(text);
  }

  function detectPreformatted(text) {
    if (!/Tweet\s*#?\s*\d+/i.test(text)) return null;
    
    const parts = text.split(/\n*\**Tweet\s*#?\s*(\d+)\**\s*\n*/i);
    const matches = [];
    
    for (let i = 1; i < parts.length; i += 2) {
      const content = parts[i + 1]?.trim();
      if (content) {
        matches.push({ num: parseInt(parts[i]), content });
      }
    }
    
    if (!matches.length) return null;
    matches.sort((a, b) => a.num - b.num);
    return matches.map(m => cleanContent(m.content));
  }

  function cleanContent(text) {
    return text
      .split('\n')
      .map(l => l.trim())
      .join('\n')
      .replace(/^\n+|\n+$/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function generateFromText(text) {
    const maxLen = settings.numbering ? 260 : 275;
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const tweets = [];
    let current = '';
    
    for (const s of sentences) {
      if ((current + s).length <= maxLen) {
        current += s;
      } else {
        if (current.trim()) tweets.push(current.trim());
        current = s;
      }
    }
    if (current.trim()) tweets.push(current.trim());
    
    return tweets.length ? tweets.slice(0, 25) : [text.slice(0, 280)];
  }

  // ============================================================
  // ACTIVATE SELECTION
  // ============================================================

  async function handleActivateSelection() {
    // Get the current active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        showToast('No active tab found', 'error');
        return;
      }
      
      const tab = tabs[0];
      const url = tab.url || '';
      
      // Check if we're on a supported page
      if (!url.includes('chatgpt.com') && !url.includes('chat.openai.com') && !url.includes('gemini.google.com') && !url.includes('bard.google.com')) {
        showToast('Please open a ChatGPT, Gemini, or AI conversation page first', 'error');
        return;
      }
      
      // Send message to content script to activate selection
      chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_SELECTION' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Seam: Error sending message:', chrome.runtime.lastError);
          showToast('Please reload the page and try again', 'error');
        } else if (response && response.success) {
          // Close popup after a short delay
          setTimeout(() => window.close(), 1000);
        } else {
          showToast('Failed to activate selection. Please reload the page.', 'error');
        }
      });
    });
  }

  // ============================================================
  // TOAST
  // ============================================================

  function showToast(msg, type = 'success') {
    if (!elements.statusToast) return;
    
    elements.statusToast.textContent = msg;
    elements.statusToast.className = `status-toast status-toast-${type}`;
    elements.statusToast.classList.remove('hidden');
    
    requestAnimationFrame(() => elements.statusToast.classList.add('show'));
    
    setTimeout(() => {
      elements.statusToast.classList.remove('show');
      setTimeout(() => elements.statusToast.classList.add('hidden'), 300);
    }, 4000);
  }

})();
