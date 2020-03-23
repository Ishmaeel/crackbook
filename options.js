var TOP_DOMAINS_NUM = 6;
var MSG_SAVED_DELAY = 2*1000;

function getTopDomains(historyItems) {
  var typedCounts = {};
  // Get URL data.
  var domains = [];
  for (var i = 0; i < historyItems.length; i++) {
    var h = historyItems[i];
    // firefox does not seem to use typedCount, so we use visitCount as a backup
    if (h.url && (h.typedCount || h.visitCount)) {
      var url = trimWWW(trimProtocol(h.url.trim()));
      var domain = trimPath(url);

      // Special case for Google Reader.
      // TODO: test me
      var components = url.split('/');
      if (components.length > 1 && components[0].indexOf('google.') != -1 && components[1] == 'reader') {
        domain = components[0] + '/' + components[1];
      }

      if (domains.indexOf(domain) == -1) {
        domains.push(domain);
        typedCounts[domain] = h.typedCount || h.visitCount;
      } else {
        typedCounts[domain] += h.typedCount || h.visitCount;
      }
    }
  }
  // Sort by typed count (descending).
  domains.sort(function(a, b) { return typedCounts[b] - typedCounts[a]; });
  // Take top N.
  var topUrls = domains.slice(0, TOP_DOMAINS_NUM);
  return topUrls;
} // getTopDomains

function addUrlField(ulId, value) {
  var checkbox = document.createElement('input');
  checkbox.setAttribute('type', 'checkbox');
  checkbox.setAttribute('checked', 'checked');

  var input = document.createElement('input');
  input.setAttribute('type', 'text');
  input.setAttribute('class', 'domain');
  input.value = value;

  var li = document.createElement('li');
  li.setAttribute('class', 'domain');
  li.appendChild(checkbox);
  li.appendChild(input);

  var ul = document.getElementById(ulId);
  var button_li = ul.children[ul.children.length - 1];
  // Insert field before the "add domain" button.
  ul.insertBefore(li, button_li);
}

function clearDomainsFromPage(ulId) {
  var ul = document.getElementById(ulId);
  for (var i = ul.children.length-1; i >= 0; i--) {
    var li = ul.children[i];
    if (li.getAttribute('class') == 'domain')
      ul.removeChild(li);
  }
}

function putDomainsOnPage(ulId, domains) {
  for (var i = 0; i < domains.length; i++) {
    addUrlField(ulId, domains[i]);
  }
}

function togglePlaceholder(placeholderId) {
  var placeholder = document.getElementById(placeholderId);
  if (placeholder) {
    var domains = getLocal("junkDomains");
    placeholder.style.display = domains.length > 0 ? 'none' : 'inline-block';
  }
}

function collectInputs(ulId) {
  var ul = document.getElementById(ulId);
  var domains = [];
  for (var i = 0; i < ul.childNodes.length; i++) {
    if (ul.childNodes[i].nodeName == "LI") {
      var li = ul.childNodes[i];
      var checkbox = li.childNodes[0];
      var input = li.childNodes[1];
      if (checkbox.checked && input.value.indexOf('.') != -1) {
        domains.push(input.value.trim());
      }
    }
  }
  return domains;
}

function generateFromHistory() {
  clearDomainsFromPage('siteBlacklist');
  loadTopUrls();
}

// Collect the most frequently visited domains and prepopulate the blacklist.
function loadTopUrls() {
  var weekAgo = new Date().getTime() - 1000*3600*24*7;
  chrome.history.search({ text: "", startTime: weekAgo,
                          maxResults: 1000 },
    function(historyItems) {
      var topUrls = getTopDomains(historyItems);
      setLocal('junkDomains', topUrls);
      putDomainsOnPage("siteBlacklist", topUrls);
    }
  );
} // loadTopUrls()


function addJunkDomain() {
  addUrlField('siteBlacklist', '');
}

function bindControlHandlers() {
  document.getElementById('generate_blacklist_button').onclick = generateFromHistory;
  document.getElementById('add_junk_domain_button').onclick = addJunkDomain;
  document.getElementById('save_button').onclick = saveSettings;
}


function showSettings() {
  // Threshold & delay
  document.getElementById("dimmerThreshold").value = getLocal('dimmerThreshold');
  document.getElementById("dimmerDelay").value = getLocal('dimmerDelay').toFixed(2);
  document.getElementById("dimmerDelayIncrement").value = getLocal('dimmerDelayIncrement').toFixed(2);
  document.getElementById("reset_daily_flag").checked = getLocal('reset_daily_flag');
  document.getElementById("base_delay").value = getLocal('base_delay').toFixed(2);

  document.getElementById("checkActiveTab").checked = getLocal('checkActiveTab');

  document.getElementById("blurBackground").checked = getLocal('blurBackground');

  // Junk domains.
  clearDomainsFromPage('siteBlacklist');
  if (getLocal('junkDomains').length > 0) {
    putDomainsOnPage("siteBlacklist", getLocal("junkDomains"));
  } else if (getLocal('first_run')) {
    loadTopUrls();
  }

  togglePlaceholder("blacklistPlaceholder");

  // Schedule
  document.getElementById("startTime").value = renderTime(getLocal('startTime'));
  document.getElementById("endTime").value = renderTime(getLocal('endTime'));

  var currentWeekdays = getLocal('weekdays');
  for (var i = 0; i < 7; i++) {
    document.getElementById("weekday-" + i).checked = currentWeekdays.indexOf("" + i) != -1;
  }
}


function saveSettings() {
  /* Save settings from submitted form. */

  var junkDomains = collectInputs("siteBlacklist");
  for (var i = 0; i < junkDomains.length; i++) {
    junkDomains[i] = trimWWW(trimProtocol(junkDomains[i]));
  }

  var dimmerThreshold = parseInt(document.getElementById("dimmerThreshold").value, 10);
  if (isNaN(dimmerThreshold) || dimmerThreshold < 0) {
    dimmerThreshold = getLocal('dimmerThreshold');
  }

  var dimmerDelay = parseFloat(document.getElementById("dimmerDelay").value);
  if (isNaN(dimmerDelay) || dimmerDelay < 0) {
    dimmerDelay = getLocal('dimmerDelay');
  }

  var dimmerDelayIncrement = parseFloat(document.getElementById("dimmerDelayIncrement").value);
  if (isNaN(dimmerDelayIncrement) || dimmerDelayIncrement < 0) {
    dimmerDelayIncrement = getLocal('dimmerDelayIncrement');
  }

  var base_delay = parseFloat(document.getElementById("base_delay").value);
  if (isNaN(base_delay) || base_delay < 0) {
    base_delay = getLocal('base_delay');
  }

  var reset_daily_flag = !!document.getElementById('reset_daily_flag').checked;

  var checkActiveTab = document.getElementById("checkActiveTab").checked;
  var blurBackground = document.getElementById("blurBackground").checked;

  // TODO: better validation
  var startTime = parseTime(document.getElementById("startTime").value);
  var endTime = parseTime(document.getElementById("endTime").value);

  var weekdays = "";
  for (i = 0; i < 7; i++) {
    if (document.getElementById("weekday-" + i).checked)
      weekdays += i;
  }

  // Write settings to storage.
  setLocal('dimmerThreshold', dimmerThreshold);
  setLocal('dimmerDelay', dimmerDelay);
  setLocal('dimmerDelayIncrement', dimmerDelayIncrement);
  setLocal('reset_daily_flag', reset_daily_flag);
  setLocal('base_delay', base_delay);
  setLocal('blurBackground', blurBackground);

  setLocal('checkActiveTab', checkActiveTab);
  setLocal('junkDomains', junkDomains);
  setLocal('startTime', startTime);
  setLocal('endTime', endTime);
  setLocal('weekdays', weekdays);

  setLocal('first_run', false);

  bgPage().updateIcon(null, true);

  // Re-render saved settings so that invalid settings can be seen.
  showSettings();

  // Show status message.
  var saveButton = document.getElementById('save_button');
  var msg = document.getElementById('saved_message');
  var inPopup = (location.hash === "#popup");
  var opacityValue = 1.0;
  var speedFactor = inPopup ? 20 : 80;

  saveButton.style.display = 'none';
  msg.style.display = 'inline'; 

  var timeoutFn = function() {
    opacityValue -= 1 / 20;
    msg.style.opacity = opacityValue;
    if (opacityValue < 0.1) {
      if (inPopup){
        window.close();
      } else {
        msg.style.display = 'none';
        saveButton.style.display = 'inline';
      }
    } else {
      setTimeout(timeoutFn, MSG_SAVED_DELAY / speedFactor);
    }
  };
  setTimeout(timeoutFn, MSG_SAVED_DELAY / speedFactor);
} // saveSettings

window.onload = function() {
  bindControlHandlers();
  showSettings();  
};
