var DAY_STARTING_HOUR = 6; // AM

//
// Helper functions.
//

function trimProtocol(url) {
  var p = url.indexOf('://');
  if (p > -1) {
    url = url.slice(p + '://'.length);
  }
  return url;
}

function trimWWW(url) {
  if (url.slice(0, 4) == 'www.')
    url = url.slice(4);
  return url;
}

function trimPath(url) {
  p = url.indexOf('/');
  if (p > -1)
    domain = url.slice(0, p);
  else
    domain = url;
  return domain;
}

// Returns today's date as an ISO8601 string (e.g., 2011-03-04)
function todayAsString() {
  var now = new Date();
  var dt = new Date(now - DAY_STARTING_HOUR * 3600 * 1000);
  return dt.getFullYear() + "-" + lzero(dt.getMonth() + 1) + "-" + lzero(dt.getDate());
}

//
// Local storage functions.
//

var_defaults = {
  junkDomains: '[]',
  checkActiveTab: 'true',
  dimmerThreshold: '0',
  dimmerDelay: '3.0',
  dimmerDelayIncrement: '0.05',
  dimmerBackgroundColor: '"#001000"',
  dimmerTextColor: '"#ffffff"',
  redirectProbability: '2',
  startTime: '0',
  endTime: '' + 24*60-1,
  weekdays: '"12345"',
  day: '""',
  dayHits: '0',
  hitLogKeys: '[]',
  reset_daily_flag: 'false',
  base_delay: '3.0',
  first_run: true,
  blurBackground: false
};

function getLocal(varname) {
  if (!(varname in localStorage)) {
    var defaultValue = var_defaults[varname];
    if (defaultValue) {
      localStorage.setItem(varname, defaultValue);
    }
  }
  var s = localStorage.getItem(varname);
  return JSON.parse(s);
}

function setLocal(varname, value) {
  localStorage.setItem(varname, JSON.stringify(value));
}

function storeHit(domain, blocked, active) {
  var dt = new Date();

  // Create an entry.
  var timestamp = Math.round(dt.getTime() / 1000);
  var entry = JSON.stringify({ domain: domain, blocked: blocked, timestamp: timestamp, active: active });

  var key = 'hitLogKeys-' + (dt.getYear() - 100) + "-" + (dt.getMonth() + 1);

  // Append the entry to the right collection.
  var hitLogKeys = getLocal('hitLogKeys');
  var row = null;
  if (hitLogKeys.indexOf(key) == -1) {
    hitLogKeys.push(key);
    setLocal('hitLogKeys', hitLogKeys);
    row = entry;
  } else {
    row = localStorage.getItem(key) + "," + entry;
  }
  // Access localStorage directly to avoid double stringification.
  localStorage.setItem(key, row);
}

function loadHits(key) {
  return JSON.parse('[' + localStorage.getItem(key) + ']');
}

function getTodaysHits() {
  if (getLocal('day') == todayAsString()) {
      return getLocal('dayHits');
  } else {
      return 0;
  }
}

function lookupJunkDomain(url) {
  var junkDomains = getLocal('junkDomains');
  var normalized_url = trimWWW(trimProtocol(url.trim()));
  for (var i = 0; i < junkDomains.length; i++) {
    if (normalized_url.indexOf(junkDomains[i]) == 0) {
      return junkDomains[i];
    }
  }
  return null;
}

function bgPage() {
  return chrome.extension.getBackgroundPage();
}

function lzero(x) {
  // Add a leading zero to a number.
  return x > 9 ? x : '0' + x;
}

function renderTime(minutes) {
  return lzero((Math.floor(minutes / 60))) + ':' + lzero(minutes % 60);
}

function parseTime(s) {
  var components = s.split(':');
  var hr = parseInt(components[0], 10) | 0;
  if (hr < 0 || hr >= 24) hr = 0;
  var min = parseInt(components[1], 10) | 0;
  if (min < 0 || min >= 60) hr = 0;
  var r = hr * 60 + min;
  if (r >= 60*24)
    r = 0;
  return r;
}

function pickRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
