export default defineBackground(() => {
  console.log('SDC Boost: Background script loaded', { id: browser.runtime.id });

  // Listen for messages to open the popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_POPUP') {
      // Get the popup URL and create a popup window
      const popupUrl = browser.runtime.getURL('popup/index.html');
      browser.windows.create({
        url: popupUrl,
        type: 'popup',
        width: 900,
        height: 800,
      }).then((window) => {
        sendResponse({ success: true, windowId: window?.id });
      }).catch((error) => {
        console.error('Failed to open popup window:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep the message channel open for async response
    }
  });
});
