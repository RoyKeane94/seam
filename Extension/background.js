/**
 * SeamHQ Background Service Worker
 * Handles OAuth 1.0a, X API, and storage
 */

// X OAuth 1.0a Configuration
const TWITTER_API_KEY = 'FkNVBINScMYyIrY1xOJ76mMWk';
const TWITTER_API_SECRET = 'g8GBSjy1pgoD9puqgro5uh6nkpncWJOCClFQzqpD7UcxeFsIJE';
const TWITTER_REQUEST_TOKEN_URL = 'https://api.twitter.com/oauth/request_token';
const TWITTER_AUTHORIZE_URL = 'https://api.twitter.com/oauth/authorize';
const TWITTER_ACCESS_TOKEN_URL = 'https://api.twitter.com/oauth/access_token';
const TWITTER_API_URL = 'https://api.twitter.com/2';
// Get redirect URL - Chrome adds trailing slash automatically
let REDIRECT_URL = chrome.identity.getRedirectURL();
// Ensure it ends with / (Twitter sometimes requires this)
if (!REDIRECT_URL.endsWith('/')) {
  REDIRECT_URL = REDIRECT_URL + '/';
}

console.log('SeamHQ: Redirect URL is:', REDIRECT_URL);

// ============================================================
// OAUTH 1.0A HELPERS
// ============================================================

function generateNonce() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function generateTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function createSignature(method, url, params, consumerSecret, tokenSecret = '') {
  // Sort parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');
  
  // Create signature base string
  const signatureBaseString = `${method}&${percentEncode(url)}&${percentEncode(sortedParams)}`;
  
  // Create signing key
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  
  // HMAC-SHA1 (we'll use Web Crypto API)
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  ).then(key => {
    return crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signatureBaseString)
    );
  }).then(signature => {
    // Convert to base64
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  });
}

async function makeOAuthRequest(method, url, params, consumerSecret, tokenSecret = '') {
  // Add OAuth parameters
  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_version: '1.0'
  };
  
  // Add token if we have one
  if (params.oauth_token) {
    oauthParams.oauth_token = params.oauth_token;
  }
  
  // Merge all parameters
  const allParams = { ...oauthParams, ...params };
  
  // Create signature
  const signature = await createSignature(method, url, allParams, consumerSecret, tokenSecret);
  oauthParams.oauth_signature = signature;
  
  // Build authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');
  
  // Make request
  const queryString = Object.keys(params)
    .map(key => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join('&');
  
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  
  const response = await fetch(fullUrl, {
    method: method,
    headers: {
      'Authorization': authHeader
    }
  });
  
  return response;
}

// ============================================================
// OAUTH 1.0A FLOW
// ============================================================

async function startOAuthFlow() {
  console.log('SeamHQ: Starting OAuth 1.0a flow...');
  console.log('SeamHQ: Using callback URL:', REDIRECT_URL);
  
  // Step 1: Get request token
  const requestTokenResponse = await makeOAuthRequest(
    'POST',
    TWITTER_REQUEST_TOKEN_URL,
    {
      oauth_callback: REDIRECT_URL
    },
    TWITTER_API_SECRET
  );
  
  if (!requestTokenResponse.ok) {
    const errorText = await requestTokenResponse.text();
    console.error('SeamHQ: Request token failed:', errorText);
    throw new Error('Failed to get request token: ' + errorText);
  }
  
  const requestTokenText = await requestTokenResponse.text();
  const requestTokenParams = new URLSearchParams(requestTokenText);
  const oauthToken = requestTokenParams.get('oauth_token');
  const oauthTokenSecret = requestTokenParams.get('oauth_token_secret');
  const oauthCallbackConfirmed = requestTokenParams.get('oauth_callback_confirmed');
  
  console.log('SeamHQ: Got request token');
  
  if (oauthCallbackConfirmed !== 'true') {
    throw new Error('OAuth callback not confirmed');
  }
  
  // Store token secret for later
  await chrome.storage.local.set({
    oauth_token_secret: oauthTokenSecret
  });
  
  // Step 2: Authorize
  const authUrl = `${TWITTER_AUTHORIZE_URL}?oauth_token=${oauthToken}`;
  
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      async (redirectUrl) => {
        console.log('SeamHQ: Got redirect URL:', redirectUrl);
        
        if (chrome.runtime.lastError) {
          console.error('SeamHQ: OAuth error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!redirectUrl) {
          console.error('SeamHQ: No redirect URL received');
          reject(new Error('No redirect URL received - authorization may have been cancelled'));
          return;
        }
        
        try {
          const url = new URL(redirectUrl);
          const returnedToken = url.searchParams.get('oauth_token');
          const oauthVerifier = url.searchParams.get('oauth_verifier');
          const denied = url.searchParams.get('denied');
          
          if (denied) {
            reject(new Error('Authorization denied by user'));
            return;
          }
          
          if (!oauthVerifier) {
            reject(new Error('No oauth_verifier received'));
            return;
          }
          
          // Get stored token secret
          const stored = await chrome.storage.local.get(['oauth_token_secret']);
          if (!stored.oauth_token_secret) {
            reject(new Error('Token secret not found'));
            return;
          }
          
          console.log('SeamHQ: Exchanging for access token...');
          
          // Step 3: Exchange for access token
          const accessTokenResponse = await makeOAuthRequest(
            'POST',
            TWITTER_ACCESS_TOKEN_URL,
            {
              oauth_token: returnedToken,
              oauth_verifier: oauthVerifier
            },
            TWITTER_API_SECRET,
            stored.oauth_token_secret
          );
          
          if (!accessTokenResponse.ok) {
            const errorText = await accessTokenResponse.text();
            console.error('SeamHQ: Access token exchange failed:', errorText);
            throw new Error('Failed to get access token: ' + errorText);
          }
          
          const accessTokenText = await accessTokenResponse.text();
          const accessTokenParams = new URLSearchParams(accessTokenText);
          const accessToken = accessTokenParams.get('oauth_token');
          const accessTokenSecret = accessTokenParams.get('oauth_token_secret');
          const userId = accessTokenParams.get('user_id');
          const screenName = accessTokenParams.get('screen_name');
          
          console.log('SeamHQ: Got access token for user:', screenName);
          
          // Store tokens
          await chrome.storage.local.set({
            twitter_access_token: accessToken,
            twitter_access_token_secret: accessTokenSecret,
            twitter_user: {
              id: userId,
              username: screenName
            }
          });
          
          // Clean up
          await chrome.storage.local.remove(['oauth_token_secret']);
          
          resolve({
            success: true,
            user: {
              id: userId,
              username: screenName
            }
          });
        } catch (error) {
          console.error('SeamHQ: OAuth flow error:', error);
          reject(error);
        }
      }
    );
  });
}

async function disconnectTwitter() {
  console.log('SeamHQ: Disconnecting X...');
  await chrome.storage.local.remove([
    'twitter_access_token',
    'twitter_access_token_secret',
    'twitter_user'
  ]);
  return { success: true };
}

async function getTwitterStatus() {
  const stored = await chrome.storage.local.get(['twitter_access_token', 'twitter_user']);
  console.log('SeamHQ: Checking status - has token:', !!stored.twitter_access_token, 'has user:', !!stored.twitter_user);
  
  if (stored.twitter_access_token && stored.twitter_user) {
    return {
      connected: true,
      user: stored.twitter_user
    };
  }
  
  return { connected: false };
}

// ============================================================
// TWITTER API
// ============================================================

async function postTweet(text, replyToId = null) {
  const stored = await chrome.storage.local.get([
    'twitter_access_token',
    'twitter_access_token_secret'
  ]);
  
  if (!stored.twitter_access_token || !stored.twitter_access_token_secret) {
    throw new Error('Not connected to X');
  }
  
  const bodyParams = { text };
  if (replyToId) {
    bodyParams.reply = { in_reply_to_tweet_id: replyToId };
  }
  
  console.log('SeamHQ: Posting tweet...', replyToId ? `(reply to ${replyToId})` : '(first tweet)');
  console.log('SeamHQ: Tweet text length:', text.length);
  
  // For OAuth 1.0a with JSON body, we need to include body params in signature
  // X API v2 expects JSON, so we'll use a different approach
  const url = `${TWITTER_API_URL}/tweets`;
  
  // Build OAuth params
  const oauthParams = {
    oauth_consumer_key: TWITTER_API_KEY,
    oauth_token: stored.twitter_access_token,
    oauth_nonce: generateNonce(),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: generateTimestamp(),
    oauth_version: '1.0'
  };
  
  // Create signature (body params don't go in signature for JSON POST)
  const signature = await createSignature('POST', url, oauthParams, TWITTER_API_SECRET, stored.twitter_access_token_secret);
  oauthParams.oauth_signature = signature;
  
  // Build authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(key => `${percentEncode(key)}="${percentEncode(oauthParams[key])}"`)
    .join(', ');
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyParams)
  });
  
  const responseText = await response.text();
  console.log('SeamHQ: Tweet API response status:', response.status);
  console.log('SeamHQ: Tweet API response:', responseText);
  
  if (!response.ok) {
    let error;
    try {
      error = JSON.parse(responseText);
    } catch (e) {
      error = { detail: responseText, title: 'Unknown error' };
    }
    console.error('SeamHQ: Tweet failed:', error);
    
    let errorMsg = error.detail || error.title || 'Failed to post tweet';
    if (response.status === 401) {
      errorMsg = 'Unauthorized: Please reconnect to X.';
    } else if (response.status === 403) {
      errorMsg = 'Forbidden: Your app may not have permission to post tweets.';
    } else if (response.status === 429) {
      // Rate limit - check for Retry-After header
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000; // Default 60 seconds
      errorMsg = `Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`;
      // Store the error with retry info
      error.retryAfter = waitTime;
    }
    
    const err = new Error(errorMsg);
    err.status = response.status;
    err.retryAfter = error.retryAfter;
    throw err;
  }
  
  const data = JSON.parse(responseText);
  console.log('SeamHQ: Tweet posted:', data.data.id);
  return data.data;
}

async function postThread(tweets) {
  console.log('SeamHQ: Posting thread of', tweets.length, 'tweets');
  
  const results = [];
  let previousTweetId = null;
  
  for (let i = 0; i < tweets.length; i++) {
    let retries = 3;
    let success = false;
    
    while (retries > 0 && !success) {
      try {
        const tweet = await postTweet(tweets[i], previousTweetId);
        results.push({ success: true, tweet, index: i });
        previousTweetId = tweet.id;
        success = true;
        
        // Small delay between tweets to avoid rate limits
        if (i < tweets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        if (error.status === 429 && retries > 0) {
          // Rate limit - wait and retry
          const waitTime = error.retryAfter || 60000; // Default 60 seconds
          console.log(`SeamHQ: Rate limited, waiting ${waitTime / 1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries--;
        } else {
          // Other error or out of retries
          console.error('SeamHQ: Thread posting failed at tweet', i, error);
          results.push({ success: false, error: error.message, index: i });
          break;
        }
      }
    }
    
    if (!success) {
      break; // Stop posting if we couldn't post this tweet
    }
  }
  
  console.log('SeamHQ: Thread posting complete, results:', results);
  return results;
}

// ============================================================
// MESSAGE HANDLER
// ============================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('SeamHQ: Received message:', message.type);
  
  (async () => {
    try {
      switch (message.type) {
        case 'SAVE_CAPTURE':
          await chrome.storage.local.set({
            capture: {
              messages: message.messages,
              url: message.url,
              timestamp: new Date().toISOString()
            }
          });
          sendResponse({ success: true });
          break;

        case 'GET_CAPTURE':
          const captureData = await chrome.storage.local.get(['capture', 'thread', 'settings']);
          sendResponse({
            success: true,
            capture: captureData.capture || null,
            thread: captureData.thread || [],
            settings: captureData.settings || { numbering: false }
          });
          break;

        case 'SAVE_THREAD':
          await chrome.storage.local.set({ thread: message.thread });
          sendResponse({ success: true });
          break;

        case 'SAVE_SETTINGS':
          await chrome.storage.local.set({ settings: message.settings });
          sendResponse({ success: true });
          break;

        case 'CLEAR_ALL':
          await chrome.storage.local.remove(['capture', 'thread', 'settings']);
          sendResponse({ success: true });
          break;

        case 'TWITTER_CONNECT':
          try {
            const authResult = await startOAuthFlow();
            console.log('SeamHQ: OAuth complete, sending response:', authResult);
            sendResponse(authResult);
          } catch (error) {
            console.error('SeamHQ: OAuth failed:', error);
            sendResponse({ success: false, error: error.message });
          }
          break;

        case 'TWITTER_DISCONNECT':
          const disconnectResult = await disconnectTwitter();
          sendResponse(disconnectResult);
          break;

        case 'TWITTER_STATUS':
          const status = await getTwitterStatus();
          console.log('SeamHQ: Status check result:', status);
          sendResponse(status);
          break;

        case 'TWITTER_POST_THREAD':
          const postResults = await postThread(message.tweets);
          sendResponse({ success: true, results: postResults });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('SeamHQ Error:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true;
});

// Handle toolbar icon click (when popup is disabled)
// Note: This only fires if default_popup is removed or set to null
// Since we have a popup, users can click the popup to access features
// The overlay will be hidden by default and shown when needed

// Log when service worker starts
console.log('SeamHQ: Background service worker initialized');
