var BODY_POLL_MS = 30;
var DIMMER_DIV_ID = '_crackbook_dimmer_';
var DIMMER_TEXT = "Wait %d seconds for the content to appear.";
var DIMMER_SWITCH_TEXT = "The timer restarts if you switch away from this tab.";

var TRACING = false;

var original_url = null;
var dimmer_options = {};
var media_timer = null;

function clearDimTimer(dimmer) {
  // Clear old timer.
  var timerIdInput = document.getElementById(DIMMER_DIV_ID + "timerId");
  if (timerIdInput) {
    timerId = parseInt(timerIdInput.value);
    clearTimeout(timerId);
    dimmer.removeChild(timerIdInput);
  }
}

function setDimTimer(dimmer, delay) {
  // Clear old timer.
  var timerIdInput = document.getElementById(DIMMER_DIV_ID + "timerId");
  if (timerIdInput) {
    timerId = parseInt(timerIdInput.value);
    clearTimeout(timerId);
  }

  var timeoutFn = function() {
    // Disable the dimmer. This page may be dimmed again if the URL changes.
    var dimmer = document.getElementById(DIMMER_DIV_ID);
    dimmer.style.display = "none";

    showScrollbars();
    unSuppressMedia();
  };

  // Set timer.
  var timerId = setTimeout(timeoutFn, Math.round(delay * 1000));

  // Store timer ID.
  if (!timerIdInput) {
    var timerIdInput = document.createElement("input");
    timerIdInput.id = DIMMER_DIV_ID + "timerId";
    timerIdInput.type = "hidden";
    dimmer.appendChild(timerIdInput);
  }
  timerIdInput.value = timerId;
}

function addDimmer(delay) {
  var dimmer = document.createElement('div');
  dimmer.id = DIMMER_DIV_ID;

  // TODO: add a picture

  // Message
  dimmer.style.color = dimmer_options.textColor;
  dimmer.style.paddingTop = window.innerHeight / 2 - 30 + "px";
  dimmer.style.fontSize = '36px';
  dimmer.style.fontFamily = 'Georgia';
  dimmer.style.fontVariant = 'normal';

  var text = document.createElement("div");
  text.innerHTML = DIMMER_TEXT.replace('%d', Math.round(delay));
  text.style.textAlign = "center";
  text.style.paddingTop = "50px";
  text.style.fontSize = "20px";
  dimmer.appendChild(text);

  var switch_text = document.createElement("div");
  switch_text.innerHTML = DIMMER_SWITCH_TEXT;
  switch_text.id = DIMMER_DIV_ID + 'stayput';
  switch_text.style.display = "none";
  switch_text.style.textAlign = "center";
  switch_text.style.paddingTop = "10px";
  switch_text.style.fontSize = "14px";
  switch_text.style.color = "#aaaaaa";
  dimmer.appendChild(switch_text);

  // Positioning.
  dimmer.style.position = "fixed";
  dimmer.style.top = "0px";
  dimmer.style.left = "0px";
  dimmer.style.width = "100%";
  dimmer.style.height = "100%";

  // Background.
  dimmer.style.zIndex = "2147483647";
  dimmer.style.background = dimmer_options.backgroundColor;
  if (dimmer_options.blurBackground) {
    dimmer.style.background = "rgba(0, 16, 0, .6)";
    dimmer.style.backdropFilter = "blur(10px)";
  }

  document.body.insertBefore(dimmer, document.body.firstChild);

  hideScrollbars();

  // Install URL change watcher.
  original_url = document.URL;
  setInterval(watchUrlChanges, 1000);
  // TODO(gintas): Disable watcher when the tab is not active.

  // Pause audio/video
  suppressMedia();

  return dimmer;
}

function suppressMedia() {
  function pauseAll() {
    for (var video of document.getElementsByTagName("video")) {
      if (video.autoplay || !video.paused) {
        video.autoplay = false;
        video.pause();
      }
    }

    for (var audio of document.getElementsByTagName("audio")) {
      if (audio.autoplay || !audio.paused) {
        audio.autoplay = false;
        audio.pause();
      }
    }
  }
  pauseAll();

  if (media_timer !== null) {
    window.clearInterval(media_timer);
  }

  // Media elements may be inserted in to the page later...
  media_timer = window.setInterval(pauseAll, 250);
}

function unSuppressMedia() {
  if (media_timer !== null) {
    window.clearInterval(media_timer);
    media_timer = null;
  }
}

/* Watches for URL changes and reshows the dimmer if a change is detected. */
function watchUrlChanges() {
  if (document.URL != original_url) {
    original_url = document.URL;
    dim('reshow');
  }
}

// Actions

function create(dimmer_el, delay) {
  if (!dimmer_el) {
    var dimmer = addDimmer(delay);
    setDimTimer(dimmer, delay);
  }
}

function create_suspended(dimmer_el, delay) {
  if (!dimmer_el) {
    var dimmer = addDimmer(delay);
  }
}

function suspend(dimmer_el, delay) {
  if (dimmer_el) {
    clearDimTimer(dimmer_el);
  }
}

function resume(dimmer_el, delay) {
  if (dimmer_el && dimmer_el.style.display != "none") {
    setDimTimer(dimmer_el, delay);
    suppressMedia();

    var switch_text = document.getElementById(DIMMER_DIV_ID + 'stayput');
    switch_text.style.display = "block";
  }
}

function reshow(dimmer_el, delay) {
  if (dimmer_el) {
    dimmer_el.style.display = "block";

    hideScrollbars();
    setDimTimer(dimmer_el, delay);
    suppressMedia();
    // TODO(gintas): Do not assume that this tab is currently active.
  }
}

/* Dims the current page for a given time in seconds

   'action' is one of the following:
     - "create": a dimmer is created on the page if it is not already there and a timer is started
     - "create_suspended": a dimmer is created on the page if it is not already there, no timer is started
     - "suspend": the countdown is suspended if there is a dimmer on the page, no-op otherwise
     - "resume": the countdown is resumed if there is a dimmer on the page, no-op otherwise

 */
function dim(action) {
  // Dispatch by action name.
  var action_fns = {
    create: create,
    suspend: suspend,
    resume: resume,
    create_suspended: create_suspended,
    reshow: reshow
  };

  if (TRACING) {
    console.log("action: " + action);
  }

  var action_fn = action_fns[action];

  var dimmer_el = document.getElementById(DIMMER_DIV_ID);
  action_fn(dimmer_el, dimmer_options.delay);
}

/* Forwarder function for calls using executeScript() */
function invoke_dimmer(action) {
  dim(action);
}

// On initial load, check with the extension whether action needs to be taken.
chrome.extension.sendRequest({}, function(response) {
  if (response.redirectUrl) {
    window.location.href = response.redirectUrl;
  } else if (response.dimmerAction) {
    // Save dimmer parameters.
    dimmer_options = response.options;
    function delayedDimmerFn() {
      if (document.body != null) {
        // The body of the document has started loading, the dimmer can be shown.
        invoke_dimmer(response.dimmerAction);
      } else {
        // The body is not yet available.
        setTimeout(delayedDimmerFn, BODY_POLL_MS);
      }
    }
    // Start polling.
    delayedDimmerFn();
  }
});

function hideScrollbars() {
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
}

function showScrollbars() {
  document.body.style.overflow = null;
  document.documentElement.style.overflow = null;
}
