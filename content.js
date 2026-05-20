// Throttling for MutationObserver to avoid performance lag
let throttleTimeout = null;
let globalTooltip = null;

// Svg path for Google's satellite_alt material icon
const SATELLITE_ICON_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-1.52-1.98-2.35-4.43-2.35-6.9a10 10 0 0 1 10-10c2.47 0 4.92.83 6.9 2.35l-1.79 1.38C16.07 3.74 14.12 3 12 3zm0 4a5 5 0 0 0-5 5c0 1.05.33 2.03.88 2.85l-1.5 1.15A7 7 0 0 1 5 12a7 7 0 0 1 7-7c1.78 0 3.42.66 4.67 1.76l-1.5 1.15A4.9 4.9 0 0 0 12 7zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
</svg>`;

// Initialize the extension
function init() {
  console.log('[Starlink Flights] Extension initialized.');
  createGlobalTooltip();
  
  // Setup Observer for dynamic page changes (SPAs) and theme updates
  const observer = new MutationObserver(handleMutations);
  observer.observe(document.body, { 
    childList: true, 
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });
  
  // Run initial check
  runStarlinkCheck();
}

// Throttled handler for MutationObserver
function handleMutations() {
  if (throttleTimeout) return;
  
  throttleTimeout = setTimeout(() => {
    runStarlinkCheck();
    throttleTimeout = null;
  }, 250);
}

// Create single global tooltip to avoid clipping by overflow: hidden
function createGlobalTooltip() {
  if (document.getElementById('starlink-global-tooltip')) return;
  
  globalTooltip = document.createElement('div');
  globalTooltip.id = 'starlink-global-tooltip';
  globalTooltip.className = 'starlink-tooltip';
  document.body.appendChild(globalTooltip);
}

// Main logic to find and process flight cards
function runStarlinkCheck() {
  // Find all carbon emission selectors that contain the itinerary metadata URL
  const emissionElements = document.querySelectorAll('[data-travelimpactmodelwebsiteurl]');
  
  emissionElements.forEach(el => {
    // Find the enclosing list item flight card
    const card = el.closest('li, [role="listitem"], .gQ6yfe');
    if (!card) return;
    
    // Avoid double processing
    if (card.dataset.starlinkChecked === 'true') {
      // Check if we need to update aircraft model from expanded view
      checkExpandedAircraftType(card);
      return;
    }
    
    processCard(card, el);
  });
}

// Parse metadata and query/render Starlink details
function processCard(card, emissionEl) {
  const urlStr = emissionEl.getAttribute('data-travelimpactmodelwebsiteurl');
  if (!urlStr) return;
  
  const segments = parseItineraryUrl(urlStr);
  if (!segments || segments.length === 0) return;
  
  // Mark card as checked to avoid infinite loop
  card.dataset.starlinkChecked = 'true';
  card.dataset.starlinkItinerary = JSON.stringify(segments);
  
  // Create and inject the initial badge
  injectBadge(card, segments);
}

// Parse the Travel Impact Model itinerary URL into flight segments
function parseItineraryUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    const itinerary = url.searchParams.get('itinerary');
    if (!itinerary) return null;
    
    // Support multi-segment paths separated by commas
    return itinerary.split(',').map(seg => {
      const match = seg.match(/^([A-Z]{3})-([A-Z]{3})-([A-Z0-9]{2,3})-([0-9]+)-([0-9]{8})$/);
      if (match) {
        return {
          origin: match[1],
          destination: match[2],
          airline: match[3],
          flightNumber: match[4],
          dateRaw: match[5], // YYYYMMDD
          dateFormatted: `${match[5].slice(0, 4)}-${match[5].slice(4, 6)}-${match[5].slice(6, 8)}`, // YYYY-MM-DD
          aircraft: 'Unknown',
          status: 'checking', // 'yes', 'no', 'likely', 'checking'
          details: 'Verifying Starlink status...'
        };
      }
      return null;
    }).filter(Boolean);
  } catch (e) {
    console.error('[Starlink Flights] Error parsing itinerary URL:', e);
    return null;
  }
}

// Inject a badge next to the airline name in the flight card
function injectBadge(card, segments) {
  // Find airline name container (typically .sSHqwe.tPgKwe)
  const airlineContainer = card.querySelector('.sSHqwe.tPgKwe');
  if (!airlineContainer) return;
  
  const span = airlineContainer.querySelector('span');
  if (!span) return;
  
  // Create badge element securely avoiding TrustedHTML violations
  const badge = document.createElement('div');
  badge.className = 'starlink-badge';
  
  // Create SVG element
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-1.52-1.98-2.35-4.43-2.35-6.9a10 10 0 0 1 10-10c2.47 0 4.92.83 6.9 2.35l-1.79 1.38C16.07 3.74 14.12 3 12 3zm0 4a5 5 0 0 0-5 5c0 1.05.33 2.03.88 2.85l-1.5 1.15A7 7 0 0 1 5 12a7 7 0 0 1 7-7c1.78 0 3.42.66 4.67 1.76l-1.5 1.15A4.9 4.9 0 0 0 12 7zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z");
  svg.appendChild(path);
  
  const badgeText = document.createElement('span');
  badgeText.className = 'starlink-badge-text';
  badgeText.textContent = 'Starlink';
  
  badge.appendChild(svg);
  badge.appendChild(badgeText);
  
  // Determine page theme (dark/light mode)
  const isDark = isDarkMode();
  if (isDark) {
    badge.classList.add('dark-theme');
  }
  
  // Insert badge right after the airline name span
  span.parentNode.insertBefore(badge, span.nextSibling);
  
  // Process the Starlink status for these segments
  resolveStarlinkStatus(card, badge, segments);
  
  // Event listeners for the custom global tooltip
  badge.addEventListener('mouseenter', () => {
    showTooltip(badge, JSON.parse(card.dataset.starlinkItinerary));
  });
  
  badge.addEventListener('mouseleave', () => {
    hideTooltip();
  });
}

// Check page theme dynamically
function isDarkMode() {
  const bgColor = window.getComputedStyle(document.body).backgroundColor;
  const rgb = bgColor.match(/\d+/g);
  if (rgb && rgb.length >= 3) {
    const r = parseInt(rgb[0]);
    const g = parseInt(rgb[1]);
    const b = parseInt(rgb[2]);
    // Brightness threshold
    return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
  }
  return false;
}

// Core business logic to check status and handle API responses
async function resolveStarlinkStatus(card, badge, segments) {
  const promises = segments.map(async (seg) => {
    const airline = seg.airline;
    
    // 1. JSX (100% fleet)
    if (airline === 'XE' || airline === 'JSX') {
      seg.status = 'yes';
      seg.details = 'JSX: 100% of fleet equipped with Starlink Wi-Fi.';
      return;
    }
    
    // 2. ZIPAIR (100% fleet)
    if (airline === 'ZG') {
      seg.status = 'yes';
      seg.details = 'ZIPAIR: 100% of fleet equipped (Boeing 787-8).';
      return;
    }
    
    // 3. airBaltic (A220 fleet-wide rollout)
    if (airline === 'BT') {
      seg.status = 'yes';
      seg.details = 'airBaltic: Fleet-wide A220-300 rollout active.';
      return;
    }
    
    // 4. Hawaiian Airlines (Airbus only)
    if (airline === 'HA') {
      // In collapsed view, we check if aircraft is already scanned. Else, mark as likely/conditional
      if (seg.aircraft && seg.aircraft !== 'Unknown') {
        applyHawaiianRules(seg);
      } else {
        seg.status = 'likely';
        seg.details = 'Hawaiian Airbus (A321neo/A330): Yes. Boeing (717/787): No.';
      }
      return;
    }
    
    // 5. United Airlines (Dynamic lookup via background worker API check)
    if (airline === 'UA') {
      try {
        const fullFlightNum = `${seg.airline}${seg.flightNumber}`;
        const response = await queryUnitedStarlinkApi(fullFlightNum, seg.dateFormatted);
        
        if (response && response.success && response.data) {
          const apiData = response.data;
          
          if (apiData.hasStarlink) {
            seg.status = 'yes';
            const aircraft = apiData.fallback?.segments?.[0]?.aircraft_model || '';
            const tail = apiData.fallback?.segments?.[0]?.tail_number || '';
            seg.details = `United Starlink: Confirmed equipped${tail ? ' (Tail ' + tail + ')' : ''}${aircraft ? ' (' + aircraft + ')' : ''}.`;
          } else {
            seg.status = 'no';
            const wifi = apiData.fallback?.segments?.[0]?.verified_wifi || 'Legacy';
            const aircraft = apiData.fallback?.segments?.[0]?.aircraft_model || '';
            seg.details = `United legacy ${wifi} Wi-Fi${aircraft ? ' (' + aircraft + ')' : ''}.`;
          }
          
          // Save model if returned
          if (apiData.fallback?.segments?.[0]?.aircraft_model) {
            seg.aircraft = apiData.fallback.segments[0].aircraft_model;
          }
        } else {
          // API Fail fallback
          applyUnitedFallback(seg);
        }
      } catch (err) {
        console.warn(`[Starlink Flights] API check failed for UA${seg.flightNumber}:`, err);
        applyUnitedFallback(seg);
      }
      return;
    }
    
    // 6. Qatar Airways (completed on Boeing 777 & Airbus A350, active on Boeing 787)
    if (airline === 'QR') {
      if (seg.aircraft && seg.aircraft !== 'Unknown') {
        applyQatarRules(seg);
      } else {
        seg.status = 'likely';
        seg.details = 'Qatar Airways: Starlink Available on all Boeing 777 & Airbus A350 flights; Boeing 787 rollout active.';
      }
      return;
    }

    // 7. Emirates (active rollout on select Boeing 777s)
    if (airline === 'EK') {
      if (seg.aircraft && seg.aircraft !== 'Unknown') {
        applyEmiratesRules(seg);
      } else {
        seg.status = 'likely';
        seg.details = 'Emirates: Starlink rollout active. Select Boeing 777s are equipped (Free).';
      }
      return;
    }

    // 8. Southwest Airlines (Active summer 2026 rollout)
    if (airline === 'WN') {
      seg.status = 'no';
      seg.details = 'Southwest Airlines: Starlink rollout scheduled to begin summer 2026.';
      return;
    }
    
    // 9. Default (Panasonic / Viasat / Gogo)
    seg.status = 'no';
    seg.details = 'Legacy in-flight Wi-Fi (Panasonic / Viasat / Gogo).';
  });
  
  await Promise.all(promises);
  
  // Save updated itinerary segments on the card
  card.dataset.starlinkItinerary = JSON.stringify(segments);
  
  // Update the HTML badge rendering based on segment evaluations
  updateBadgeState(badge, segments);
}

// Query the background.js proxy API
function queryUnitedStarlinkApi(flightNumber, date) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: 'checkFlight', flightNumber, date },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      }
    );
  });
}

// Hawaiian Rules
function applyHawaiianRules(segment) {
  const model = segment.aircraft.toLowerCase();
  if (model.includes('a321') || model.includes('a330') || model.includes('airbus') || model.includes('a21n') || model.includes('a332')) {
    segment.status = 'yes';
    segment.details = `Hawaiian Airbus (${segment.aircraft}): Starlink Available (Free).`;
  } else if (model.includes('787')) {
    segment.status = 'likely';
    segment.details = `Hawaiian Boeing 787 (${segment.aircraft}): Starlink rollout active.`;
  } else {
    segment.status = 'no';
    segment.details = `Hawaiian Boeing 717 (${segment.aircraft}): Leg does not support Starlink.`;
  }
}

// Qatar Rules
function applyQatarRules(segment) {
  const model = segment.aircraft.toLowerCase();
  if (model.includes('777') || model.includes('77w') || model.includes('350') || model.includes('a350')) {
    segment.status = 'yes';
    segment.details = `Qatar Airways (${segment.aircraft}): Starlink Available (Free).`;
  } else if (model.includes('787')) {
    segment.status = 'likely';
    segment.details = `Qatar Boeing 787 (${segment.aircraft}): Starlink rollout active.`;
  } else {
    segment.status = 'no';
    segment.details = `Qatar Airways (${segment.aircraft}): Uses legacy high-speed Wi-Fi.`;
  }
}

// Emirates Rules
function applyEmiratesRules(segment) {
  const model = segment.aircraft.toLowerCase();
  if (model.includes('777') || model.includes('77w')) {
    segment.status = 'likely';
    segment.details = `Emirates Boeing 777 (${segment.aircraft}): Starlink rollout active (Free).`;
  } else {
    segment.status = 'no';
    segment.details = `Emirates (${segment.aircraft}): Uses legacy Wi-Fi (OnAir/Viasat).`;
  }
}

// United Fallback (if API fails or is down)
function applyUnitedFallback(segment) {
  if (segment.aircraft && segment.aircraft !== 'Unknown') {
    const model = segment.aircraft.toLowerCase();
    if (model.includes('e175') || model.includes('embraer 175')) {
      segment.status = 'likely';
      segment.details = `United Express E175: Starlink rollout nearly complete (Rollout check failed).`;
    } else if (model.includes('737-8') || model.includes('737-800')) {
      segment.status = 'likely';
      segment.details = `United Boeing 737-800: Starlink installations started.`;
    } else {
      segment.status = 'likely';
      segment.details = `United Airlines (${segment.aircraft}): Starlink fleet-wide rollout in progress.`;
    }
  } else {
    segment.status = 'likely';
    segment.details = 'United Airlines: Fleet-wide Starlink rollout in progress (Free Wi-Fi).';
  }
}

// Scrape aircraft model from flight details section once card is expanded
function checkExpandedAircraftType(card) {
  // Google Flights puts expanded panel in .m9ravf with [jsname="XxAJue"]
  const detailsPanel = card.querySelector('[jsname="XxAJue"]');
  if (!detailsPanel || detailsPanel.children.length === 0) return;
  
  // Don't re-run if already scraped details
  if (card.dataset.starlinkScraped === 'true') return;
  
  const text = detailsPanel.textContent || '';
  
  // Find aircraft keywords (e.g. "Airbus A321neo", "Boeing 737 MAX 9", etc.)
  const aircraftRegex = /(Airbus A\d{3}[a-zA-Z-]*|Boeing \d{3}[a-zA-Z-]*|Embraer E?\d{3}|Bombardier CRJ\d{3}|ATR \d{2}|De Havilland Dash \d)/gi;
  const matches = text.match(aircraftRegex);
  
  if (matches && matches.length > 0) {
    const segments = JSON.parse(card.dataset.starlinkItinerary || '[]');
    
    // Map matches to legs in sequence
    segments.forEach((seg, idx) => {
      if (matches[idx]) {
        seg.aircraft = matches[idx];
      } else {
        seg.aircraft = matches[0]; // Fallback to first if mismatch
      }
      
      // Re-apply aircraft specific rules
      if (seg.airline === 'HA') {
        applyHawaiianRules(seg);
      } else if (seg.airline === 'QR') {
        applyQatarRules(seg);
      } else if (seg.airline === 'EK') {
        applyEmiratesRules(seg);
      } else if (seg.airline === 'UA' && seg.status === 'checking') {
        // If United failed API previously, apply model rules
        applyUnitedFallback(seg);
      }
    });
    
    card.dataset.starlinkItinerary = JSON.stringify(segments);
    card.dataset.starlinkScraped = 'true';
    
    // Update badge visually
    const badge = card.querySelector('.starlink-badge');
    if (badge) {
      updateBadgeState(badge, segments);
    }
  }
}

// Update badge CSS classes and text based on evaluated segment statuses
function updateBadgeState(badge, segments) {
  // Clear previous state classes
  badge.classList.remove('starlink-badge-yes', 'starlink-badge-no', 'starlink-badge-likely');
  
  const badgeText = badge.querySelector('.starlink-badge-text');
  
  // Analyze aggregate state
  const statuses = segments.map(s => s.status);
  
  if (statuses.includes('checking')) {
    badge.classList.add('starlink-badge-likely');
    if (badgeText) badgeText.textContent = 'Checking...';
    return;
  }
  
  const hasYes = statuses.includes('yes');
  const hasLikely = statuses.includes('likely');
  const hasNo = statuses.includes('no');
  
  if (hasYes && !hasNo && !hasLikely) {
    // 100% Starlink
    badge.classList.add('starlink-badge-yes');
    if (badgeText) badgeText.textContent = 'Starlink';
  } else if (hasYes || hasLikely) {
    // Mixed or likely
    badge.classList.add('starlink-badge-likely');
    if (hasYes && hasNo) {
      if (badgeText) badgeText.textContent = 'Starlink Partial';
    } else {
      if (badgeText) badgeText.textContent = 'Starlink Likely';
    }
  } else {
    // No Starlink
    badge.classList.add('starlink-badge-no');
    if (badgeText) badgeText.textContent = 'No Starlink';
  }
}

// Show the floating tooltip
function showTooltip(badge, segments) {
  if (!globalTooltip) return;
  
  // Check current page theme
  const isDark = isDarkMode();
  globalTooltip.className = 'starlink-tooltip';
  if (isDark) {
    globalTooltip.classList.add('dark-theme');
    badge.classList.add('dark-theme');
  } else {
    globalTooltip.classList.add('light-theme');
    badge.classList.remove('dark-theme');
  }
  
  // Construct HTML
  let headerText = 'Starlink Wi-Fi Status';
  const statuses = segments.map(s => s.status);
  if (statuses.includes('yes') && !statuses.includes('no') && !statuses.includes('likely')) {
    headerText = 'Starlink Wi-Fi Available';
  } else if (statuses.includes('yes') || statuses.includes('likely')) {
    headerText = 'Starlink Rollout / Partial';
  } else {
    headerText = 'Starlink Wi-Fi Unavailable';
  }
  
  let bodyHtml = '';
  segments.forEach((seg) => {
    let statusClass = 'status-no';
    let statusLabel = 'No';
    if (seg.status === 'yes') {
      statusClass = 'status-yes';
      statusLabel = 'Available';
    } else if (seg.status === 'likely') {
      statusClass = 'status-likely';
      statusLabel = 'Likely';
    } else if (seg.status === 'checking') {
      statusClass = 'status-likely';
      statusLabel = 'Checking';
    }
    
    bodyHtml += `
      <div class="starlink-tooltip-segment">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="starlink-tooltip-segment-title">${seg.airline} ${seg.flightNumber} (${seg.origin} → ${seg.destination})</span>
          <span class="starlink-tooltip-status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="starlink-tooltip-segment-detail">
          <span>${seg.details}</span>
        </div>
      </div>
    `;
  });
  
  // Clear previous content securely
  globalTooltip.textContent = '';
  
  // 1. Create header
  const headerDiv = document.createElement('div');
  headerDiv.className = 'starlink-tooltip-header';
  
  const headerSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  headerSvg.setAttribute("viewBox", "0 0 24 24");
  headerSvg.setAttribute("fill", "currentColor");
  const headerPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  headerPath.setAttribute("d", "M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L4.35 19.4c-1.52-1.98-2.35-4.43-2.35-6.9a10 10 0 0 1 10-10c2.47 0 4.92.83 6.9 2.35l-1.79 1.38C16.07 3.74 14.12 3 12 3zm0 4a5 5 0 0 0-5 5c0 1.05.33 2.03.88 2.85l-1.5 1.15A7 7 0 0 1 5 12a7 7 0 0 1 7-7c1.78 0 3.42.66 4.67 1.76l-1.5 1.15A4.9 4.9 0 0 0 12 7zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z");
  headerSvg.appendChild(headerPath);
  
  const headerTitle = document.createElement('span');
  headerTitle.textContent = headerText;
  
  headerDiv.appendChild(headerSvg);
  headerDiv.appendChild(headerTitle);
  globalTooltip.appendChild(headerDiv);
  
  // 2. Create body
  const bodyDiv = document.createElement('div');
  bodyDiv.className = 'starlink-tooltip-body';
  
  segments.forEach((seg) => {
    let statusClass = 'status-no';
    let statusLabel = 'No';
    if (seg.status === 'yes') {
      statusClass = 'status-yes';
      statusLabel = 'Available';
    } else if (seg.status === 'likely') {
      statusClass = 'status-likely';
      statusLabel = 'Likely';
    } else if (seg.status === 'checking') {
      statusClass = 'status-likely';
      statusLabel = 'Checking';
    }
    
    const segmentDiv = document.createElement('div');
    segmentDiv.className = 'starlink-tooltip-segment';
    
    const rowDiv = document.createElement('div');
    rowDiv.style.display = 'flex';
    rowDiv.style.justifyContent = 'space-between';
    rowDiv.style.alignItems = 'center';
    
    const segTitle = document.createElement('span');
    segTitle.className = 'starlink-tooltip-segment-title';
    segTitle.textContent = `${seg.airline} ${seg.flightNumber} (${seg.origin} → ${seg.destination})`;
    
    const statusSpan = document.createElement('span');
    statusSpan.className = `starlink-tooltip-status ${statusClass}`;
    statusSpan.textContent = statusLabel;
    
    rowDiv.appendChild(segTitle);
    rowDiv.appendChild(statusSpan);
    
    const detailDiv = document.createElement('div');
    detailDiv.className = 'starlink-tooltip-segment-detail';
    
    const detailText = document.createElement('span');
    detailText.textContent = seg.details;
    detailDiv.appendChild(detailText);
    
    segmentDiv.appendChild(rowDiv);
    segmentDiv.appendChild(detailDiv);
    bodyDiv.appendChild(segmentDiv);
  });
  
  globalTooltip.appendChild(bodyDiv);
  
  // Position the tooltip
  const badgeRect = badge.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  
  globalTooltip.classList.add('visible');
  
  // Calculate coordinates: center horizontally above the badge
  const tooltipWidth = globalTooltip.offsetWidth;
  const tooltipHeight = globalTooltip.offsetHeight;
  
  let left = badgeRect.left + (badgeRect.width / 2) - (tooltipWidth / 2) + scrollX;
  let top = badgeRect.top - tooltipHeight - 8 + scrollY;
  
  // Collision detection (if tooltip goes offscreen)
  if (left < 10) left = 10;
  if (left + tooltipWidth > window.innerWidth - 10) {
    left = window.innerWidth - tooltipWidth - 10;
  }
  if (badgeRect.top - tooltipHeight - 8 < 0) {
    // Show below badge instead
    top = badgeRect.bottom + 8 + scrollY;
  }
  
  globalTooltip.style.left = `${left}px`;
  globalTooltip.style.top = `${top}px`;
}

// Hide the floating tooltip
function hideTooltip() {
  if (globalTooltip) {
    globalTooltip.classList.remove('visible');
  }
}

// Run initialization
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  init();
} else {
  document.addEventListener('DOMContentLoaded', init);
}
