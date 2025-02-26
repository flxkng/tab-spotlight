document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const tabList = document.getElementById('tabList');
  let allTabs = [];
  let selectedIndex = -1;
  let hasSearchOption = false;

  // Focus search input when popup opens
  searchInput.focus();

  // Get all tabs
  chrome.tabs.query({}, (tabs) => {
    allTabs = tabs;
    renderTabs(tabs);
  });

  // Filter tabs based on search
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    if (query.trim() === '') {
      renderTabs(allTabs);
      return;
    }
    
    const filteredTabs = allTabs.filter(tab => 
      tab.title.toLowerCase().includes(query) || 
      tab.url.toLowerCase().includes(query)
    );
    renderTabs(filteredTabs, query);
  });

  // Handle keyboard navigation
  searchInput.addEventListener('keydown', (e) => {
    const visibleTabs = Array.from(tabList.querySelectorAll('.tab-item:not(.hidden)'));
    
    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, visibleTabs.length - 1);
        updateSelection(visibleTabs);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        updateSelection(visibleTabs);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < visibleTabs.length) {
          const element = visibleTabs[selectedIndex];
          if (element.dataset.action === 'search') {
            googleSearch(searchInput.value);
          } else {
            const tabId = parseInt(element.dataset.tabId);
            switchToTab(tabId);
          }
        } else if (searchInput.value.trim() !== '') {
          // If nothing is selected but we have a query, search Google
          googleSearch(searchInput.value);
        }
        break;
      case 'Escape':
        window.close();
        break;
    }
  });

  function renderTabs(tabs, query = '') {
    tabList.innerHTML = '';
    
    // If we have a query but no matching tabs, or very few matching tabs, add search option
    hasSearchOption = query !== '' && (tabs.length < 5);
    
    if (hasSearchOption) {
      const searchElement = document.createElement('div');
      searchElement.className = 'tab-item';
      searchElement.dataset.action = 'search';
      searchElement.innerHTML = `
        <img class="tab-icon" src="https://www.google.com/favicon.ico" />
        <span>Search Google for "${query}"</span>
      `;
      searchElement.addEventListener('click', () => googleSearch(query));
      tabList.appendChild(searchElement);
    }
    
    tabs.forEach((tab) => {
      const tabElement = document.createElement('div');
      tabElement.className = 'tab-item';
      tabElement.dataset.tabId = tab.id;
      tabElement.innerHTML = `
        <img class="tab-icon" src="${tab.favIconUrl || 'default-icon.png'}" />
        <span>${tab.title}</span>
      `;
      tabElement.addEventListener('click', () => switchToTab(tab.id));
      tabList.appendChild(tabElement);
    });
    
    // Select first item by default
    selectedIndex = tabList.children.length > 0 ? 0 : -1;
    updateSelection(Array.from(tabList.querySelectorAll('.tab-item')));
  }

  function updateSelection(visibleTabs) {
    visibleTabs.forEach((tab, index) => {
      tab.style.background = index === selectedIndex ? '#3a3a3a' : '';
    });
    if (selectedIndex >= 0) {
      visibleTabs[selectedIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function switchToTab(tabId) {
    chrome.tabs.update(tabId, { active: true }, () => {
      window.close();
    });
  }
  
  function googleSearch(query) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    chrome.tabs.create({ url: searchUrl }, () => {
      window.close();
    });
  }
});