// Mark the domain of the selected tab as junk.
function markAsJunk() {
  chrome.tabs.query({ active: true, currentWindow:true }, function (tabs) {
    var tab = tabs[0];
    var junkDomains = getLocal('junkDomains');
    var domain = trimPath(trimWWW(trimProtocol(tab.url.trim())));
    junkDomains.push(domain);
    setLocal('junkDomains', junkDomains);
    document.getElementById('mark_junk_button').style.display = "none";
    var bg = bgPage();
    bg.updateIcon(bg.extensionActive(), true);
  });
}

window.onload = function() {
  chrome.tabs.query({ active: true, currentWindow:true }, function (tabs) {
    var tab = tabs[0];
    if (!lookupJunkDomain(tab.url) && tab.url.indexOf('.') != -1) {
      // Show current domain.
      var normalized_url = trimWWW(trimProtocol(tab.url.trim()));
      var domain = trimPath(normalized_url)
      document.getElementById('current_domain').appendChild(document.createTextNode(domain));
      document.getElementById('mark_junk_button').style.display = "block";
      // Bind button action.
      document.getElementById('mark_junk_button').onclick = markAsJunk;
    }
  });

  // TODO: personal statistics
  document.getElementById('stats_link').onclick = function() {
    chrome.tabs.create({ url: chrome.extension.getURL('stats.html') });
    return false;
  };
}
