var HITNUM_FONT = '12px Arial Bold';
var HITNUM_COLOR = "rgb(255,255,255)";
var HITNUM_POS_X = 3;
var HITNUM_POS_Y = 12;
var DAY_STARTING_HOUR = 6; // AM
var NOTIFICATION_THRESHOLD = 20;
var NOTIFICATION_HIT_INTERVAL = 10;
var NOTIFICATION_TEXT = 'Time to get back to work!';
var DIMMER_THRESHOLD = 50;
var API_URL = 'http://crackbook.info/api/';

function drawIcon(img_name) {
  img_path = "images/" + img_name;
  chrome.browserAction.setIcon({ path: img_path });
} // drawIcon

function drawTextOnBg(canvas, image, value) {
  var ctx = canvas.getContext('2d');

  ctx.drawImage(image, 0, 0);

  ctx.font = HITNUM_FONT;
  ctx.fillStyle = HITNUM_COLOR;
  ctx.fillText("" + value, HITNUM_POS_X, HITNUM_POS_Y);

  var imageData = ctx.getImageData(0, 0, 19, 19);
  chrome.browserAction.setIcon({imageData: imageData});
} // drawTextOnBg

// Returns today's date as an ISO8601 string (e.g., 2011-03-04)
function todayAsString() {
  var now = new Date();
  var dt = new Date(now - DAY_STARTING_HOUR * 3600 * 1000);
  return dt.toISOString().slice(0, 10);
}

function historyVisitedHandler(histItem) {
  if (!histItem.url)
    return;
  var domain = normalizedDomain(histItem.url);
  if (isJunkDomain(domain))
    junkHit(domain); // XXX seems to be counting excessively
}

var iconState = null;

function updateIcon(inJunk) {
  if (iconState != inJunk) {
    iconState = inJunk;
    // TODO: animate transition
    if (inJunk)
      drawIcon("hamburger-19px.png");
    else
      drawIcon("carrot-19px.png");
  }
}

function shouldDimPage() {
  return getTodaysHits() > DIMMER_THRESHOLD;
}

function toQueryString(obj) {
  // Convert an object to a query string.
  var components = [];
  for (k in obj) {
    var v = obj[k];
    components.push(k + '=' + encodeURIComponent(v));
  }
  return components.join('&');
}

function ajaxPost(url, fields) {
  fields['user_id'] = getLocal('user_id');
  fields['timestamp'] = new Date().valueOf();
  var xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.send(toQueryString(fields));
}

function registerHit(domain, blocked) {
  if (getLocal('reporting'))
    ajaxPost(API_URL + 'register_hit', {domain: domain, blocked: blocked});
}

function registerConfigChange(domains) {
  if (getLocal('reporting'))
    ajaxPost(API_URL + 'register_configuration', {domains: JSON.stringify(domains)});
}

/*
 * Dimmer state transitions for junk pages
 *
 * onTabUpdated:
 *  - tab active --> enable dimmer
 *  - tab inactive --> enable dimmer, suspend timer
 *
 * onTabSelectionChanged:
 *  - previous tab is junk -> suspend timer on previous tab
 *  - new tab is junk -> restart timer on new tab
 *
 * onWindowFocusChanged:
 *  - suspend timer on previous tab
 *  - restart timer on active tab
 *
 */

var lastDimmedTabId = null;

function tabUpdatedHandler(tabId, changeInfo, tab) {
  var domain = normalizedDomain(tab.url);
  var isJunk = isJunkDomain(domain);
  var shouldDim = shouldDimPage();
  updateIcon(isJunk);

  // Always update the icon, but only do other changes if the page load is complete.
  if (changeInfo.status != 'complete')
    return;

  // TODO: see if we can harmlessly blank the page while it's loading

  if (isJunk) {
    registerHit(domain, shouldDim);
    if (shouldDim) {
      chrome.tabs.getSelected(null, function(selectedTab) {
	var tabIsActive = selectedTab.id == tabId;
	if (tabIsActive)
	  lastDimmedTabId = tabId;
	invokeDimmer(tabId, tabIsActive ? "create" : "create_suspended");
      });
    }
  }
}

function tabSelectionChangedHandler(tabId, selectInfo) {
  if (lastDimmedTabId) {
    invokeDimmer(lastDimmedTabId, "suspend");
    lastDimmedTabId = null;
  }

  chrome.tabs.get(tabId, function(tab) {
    var isJunk = isJunkDomain(normalizedDomain(tab.url))
    updateIcon(isJunk);
    if (isJunk && shouldDimPage()) {
      invokeDimmer(tabId, "resume");
      lastDimmedTabId = tabId;
    }
  });
}

function windowFocusChangedHandler(windowId) {
  if (lastDimmedTabId) {
    invokeDimmer(lastDimmedTabId, "suspend");
    lastDimmedTabId = null;
  }

  if (windowId != chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.getSelected(windowId, function(tab) {
      var isJunk = isJunkDomain(normalizedDomain(tab.url))
      updateIcon(isJunk);
      if (isJunk && shouldDimPage()) {
	invokeDimmer(tab.id, "resume");
	lastDimmedTabId = tab.id;
      }
    });
  }
}

function showNotification() {
  var notification_obj = webkitNotifications.createNotification(
	  'images/Hamburger-128px.png',
	  NOTIFICATION_TEXT,
	  "");
  notification_obj.show();
  window.setTimeout(function() { notification_obj.cancel() }, 3000);
}

function junkHit(domain) {
  // Get number of hits today.
  var hist = getHitHistory();
  var today = todayAsString();
  if (!hist[today])
    hist[today] = 0;
  hist[today] += 1;

  // Save incremented hit.
  setHitHistory(hist);
  
  var hits = hist[today];

  chrome.browserAction.setBadgeText({text: "" + hits});
  setTimeout(function() { chrome.browserAction.setBadgeText({text: ''}) },
      3000);

  if ( hits < DIMMER_THRESHOLD && hits > NOTIFICATION_THRESHOLD
      && (hits % NOTIFICATION_HIT_INTERVAL == 0))
    // If hits >= DIMMER_THRESHOLD, the notification is not needed any
    // more as the dimmer kicks in.
    showNotification();
}

function invokeDimmer(tabId, action) {
  // Dim the page and start (or restart) the timer.
  //
  // Actions:
  // - "create": a dimmer is created on the page if it is not already there and a timer is started
  // - "create_suspended": a dimmer is created on the page if it is not already there, no timer is started
  // - "suspend": the countdown is suspended if there is a dimmer on the page
  // - "resume": the countdown is resumed if there is a dimmer on the page

  var primer_code = "var _dimmer_action_ = '" + action + "';";
  chrome.tabs.executeScript(tabId, { code: primer_code }, function() {
    // Set desired action and then invoke the script.
    chrome.tabs.executeScript(tabId, { file: "dimmer.js" });
  });
}

function initIcon() {
  // TODO: check the current tab
  updateIcon(false);
}

function initUserID() {
  var user_id = getLocal('user_id');
  if (user_id == 0)
    setLocal('user_id', Math.floor(Math.random() * 256*256*256*127));
}

function initExtension() {
  initUserID();
  chrome.history.onVisited.addListener(historyVisitedHandler);
  chrome.tabs.onUpdated.addListener(tabUpdatedHandler);
  chrome.tabs.onSelectionChanged.addListener(tabSelectionChangedHandler);
  chrome.windows.onFocusChanged.addListener(windowFocusChangedHandler);
  initIcon();

  if (getJunkDomains().length == 0)
    chrome.tabs.create({ url: "options.html" });
}
