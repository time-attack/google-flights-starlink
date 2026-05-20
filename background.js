const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Listen for messages from content.js or popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkFlight') {
    const { flightNumber, date } = message;
    
    checkFlightStarlink(flightNumber, date)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
      
    return true; // Keeps the messaging channel open for asynchronous sendResponse
  }
});

/**
 * Checks if a flight is Starlink equipped, checking cache first then API
 */
async function checkFlightStarlink(flightNumber, date) {
  const cacheKey = `flight_${flightNumber}_${date}`;
  
  try {
    // 1. Try to read from chrome.storage.local cache
    const cacheResult = await new Promise((resolve) => {
      chrome.storage.local.get([cacheKey], (result) => {
        resolve(result[cacheKey]);
      });
    });
    
    if (cacheResult) {
      const { timestamp, data } = cacheResult;
      const age = Date.now() - timestamp;
      if (age < CACHE_TTL_MS) {
        console.log(`[Starlink Background] Cache hit for ${flightNumber} on ${date}`);
        return data;
      } else {
        console.log(`[Starlink Background] Cache expired for ${flightNumber} on ${date}`);
      }
    }
  } catch (err) {
    console.warn('[Starlink Background] Error reading cache', err);
  }

  // 2. Fetch from the tracker API
  console.log(`[Starlink Background] Cache miss. Fetching API for ${flightNumber} on ${date}`);
  const url = `https://unitedstarlinktracker.com/api/check-flight?flight_number=${flightNumber}&date=${date}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API returned HTTP status ${response.status}`);
  }

  const data = await response.json();

  // 3. Save to cache
  try {
    const cacheVal = {
      timestamp: Date.now(),
      data: data
    };
    await new Promise((resolve) => {
      chrome.storage.local.set({ [cacheKey]: cacheVal }, () => {
        resolve();
      });
    });
  } catch (err) {
    console.warn('[Starlink Background] Error writing to cache', err);
  }

  return data;
}
