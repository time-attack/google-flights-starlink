document.addEventListener('DOMContentLoaded', () => {
  // Tab Elements
  const tabCheck = document.getElementById('tab-check');
  const tabAirlines = document.getElementById('tab-airlines');
  const contentCheck = document.getElementById('content-check');
  const contentAirlines = document.getElementById('content-airlines');

  // Form & Result Elements
  const checkForm = document.getElementById('check-form');
  const flightNumInput = document.getElementById('flight-num');
  const flightDateInput = document.getElementById('flight-date');
  const btnSubmit = document.getElementById('btn-submit');
  const spinner = btnSubmit.querySelector('.spinner');
  const btnText = btnSubmit.querySelector('span');

  const resultBox = document.getElementById('result-box');
  const resRoute = document.getElementById('res-route');
  const resBadge = document.getElementById('res-badge');
  const resStatusText = document.getElementById('res-status-text');
  const resAircraft = document.getElementById('res-aircraft');
  const resDetails = document.getElementById('res-details');

  // Set default date in date input to today
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  flightDateInput.value = `${yyyy}-${mm}-${dd}`;

  // Tab switching
  tabCheck.addEventListener('click', () => {
    tabCheck.classList.add('active');
    tabAirlines.classList.remove('active');
    contentCheck.classList.add('active');
    contentAirlines.classList.add('hidden');
    contentAirlines.classList.remove('active');
  });

  tabAirlines.addEventListener('click', () => {
    tabAirlines.classList.add('active');
    tabCheck.classList.remove('active');
    contentAirlines.classList.add('active');
    contentAirlines.classList.remove('hidden');
    contentCheck.classList.remove('active');
  });

  // Form submission handler
  checkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let flightInput = flightNumInput.value.trim().toUpperCase();
    const dateVal = flightDateInput.value;

    if (!flightInput || !dateVal) return;

    // Parse flight format e.g., UA123, UA 123, HA 50
    const parseRegex = /^([A-Z0-9]{2,3})\s*(\d+)$/;
    const match = flightInput.match(parseRegex);

    if (!match) {
      showErrorResult(flightInput, 'Invalid Flight Format. Please use letters followed by digits (e.g., UA123).');
      return;
    }

    const airlineCode = match[1];
    const flightNum = match[2];
    const fullFlight = `${airlineCode}${flightNum}`;

    // Show loading state
    setLoadingState(true);

    try {
      // 1. JSX
      if (airlineCode === 'XE' || airlineCode === 'JSX') {
        showSuccessResult(fullFlight, 'Starlink Available', 'Embraer Jet Fleet', 'JSX: 100% of fleet is fully equipped with Starlink high-speed Wi-Fi.', 'yes');
      }
      // 2. ZIPAIR
      else if (airlineCode === 'ZG') {
        showSuccessResult(fullFlight, 'Starlink Available', 'Boeing 787-8', 'ZIPAIR: 100% of active Boeing 787-8 fleet is equipped with Starlink Wi-Fi.', 'yes');
      }
      // 3. airBaltic
      else if (airlineCode === 'BT') {
        showSuccessResult(fullFlight, 'Starlink Available', 'Airbus A220-300', 'airBaltic: Fleet-wide A220-300 rollout active (100% fleet rollout completed).', 'yes');
      }
      // 4. Hawaiian Airlines
      else if (airlineCode === 'HA') {
        showSuccessResult(
          fullFlight, 
          'Starlink Likely', 
          'Airbus A321neo / A330', 
          'Hawaiian Airbus fleet (A321neo and A330-200) is 100% equipped. Boeing fleet (717 & 787-9) is not equipped.', 
          'likely'
        );
      }
      // 5. United Airlines (Check live tracker database)
      else if (airlineCode === 'UA') {
        const response = await queryUnitedStarlink(fullFlight, dateVal);
        
        if (response && response.success && response.data) {
          const apiData = response.data;
          const aircraft = apiData.fallback?.segments?.[0]?.aircraft_model || 'United Aircraft';
          const tail = apiData.fallback?.segments?.[0]?.tail_number || '';
          
          if (apiData.hasStarlink) {
            showSuccessResult(
              fullFlight, 
              'Starlink Available', 
              aircraft, 
              `United Airlines: Flight is scheduled to operate with a Starlink-equipped plane.${tail ? ' (Tail Number: ' + tail + ')' : ''}`, 
              'yes'
            );
          } else {
            const wifi = apiData.fallback?.segments?.[0]?.verified_wifi || 'Legacy';
            showSuccessResult(
              fullFlight, 
              'No Starlink', 
              aircraft, 
              `United Airlines: Flight is scheduled with a legacy ${wifi} Wi-Fi aircraft.`, 
              'no'
            );
          }
        } else {
          // Fallback if API fails
          showSuccessResult(
            fullFlight, 
            'Starlink Likely', 
            'United Fleet', 
            'United is currently deploying Starlink fleet-wide. Regional E175 jets are near-complete, mainline aircraft are actively starting rollout.', 
            'likely'
          );
        }
      }
      // 6. Qatar Airways
      else if (airlineCode === 'QR') {
        showSuccessResult(
          fullFlight, 
          'Starlink Likely', 
          'Boeing 777-300ER / 777-9', 
          'Qatar Airways is currently installing Starlink on selected Boeing 777s. Other fleet segments operate legacy Super Wi-Fi.', 
          'likely'
        );
      }
      // 7. Southwest Airlines
      else if (airlineCode === 'WN') {
        showSuccessResult(
          fullFlight, 
          'No Starlink', 
          'Boeing 737 Fleet', 
          'Southwest Airlines has announced a Starlink agreement, with rollout scheduled to begin in summer 2026.', 
          'no'
        );
      }
      // 8. Other carriers (Delta, American, JetBlue, etc.)
      else {
        showSuccessResult(
          fullFlight, 
          'No Starlink', 
          'Standard Fleet', 
          'This airline uses legacy in-flight Wi-Fi (Panasonic / Viasat / Gogo) and has not deployed Starlink.', 
          'no'
        );
      }
    } catch (err) {
      showErrorResult(fullFlight, 'An error occurred while checking flight status. Please try again.');
    } finally {
      setLoadingState(false);
    }
  });

  // Query background worker for API proxy
  function queryUnitedStarlink(flightNumber, date) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'checkFlight', flightNumber, date },
        (response) => {
          resolve(response);
        }
      );
    });
  }

  // Set UI state during fetch operation
  function setLoadingState(isLoading) {
    if (isLoading) {
      btnSubmit.disabled = true;
      spinner.classList.remove('hidden');
      btnText.textContent = 'Verifying...';
      resultBox.classList.add('hidden');
    } else {
      btnSubmit.disabled = false;
      spinner.classList.add('hidden');
      btnText.textContent = 'Check Status';
    }
  }

  // Display successful check results
  function showSuccessResult(route, badgeText, aircraft, details, statusType) {
    resRoute.textContent = route;
    resBadge.textContent = badgeText;
    resStatusText.textContent = badgeText;
    resAircraft.textContent = aircraft;
    resDetails.textContent = details;

    // Reset badge coloring classes
    resBadge.className = 'result-badge';
    resStatusText.className = 'detail-val';

    if (statusType === 'yes') {
      resBadge.classList.add('pill-yes');
      resStatusText.style.color = '#34d399'; // Emerald
    } else if (statusType === 'likely') {
      resBadge.classList.add('pill-likely');
      resStatusText.style.color = '#60a5fa'; // Blue
    } else {
      resBadge.classList.add('pill-no');
      resStatusText.style.color = '#94a3b8'; // Slate
    }

    resultBox.classList.remove('hidden');
  }

  // Display validation or connection error
  function showErrorResult(route, errorMsg) {
    resRoute.textContent = route;
    resBadge.textContent = 'Error';
    resStatusText.textContent = 'Failed';
    resAircraft.textContent = 'Unknown';
    resDetails.textContent = errorMsg;

    resBadge.className = 'result-badge pill-no';
    resStatusText.className = 'detail-val';
    resStatusText.style.color = '#ef4444'; // Red

    resultBox.classList.remove('hidden');
  }
});
