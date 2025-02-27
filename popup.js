document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const tabList = document.getElementById('tabList');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const searchEnginesList = document.getElementById('searchEnginesList');
  const addEngineBtn = document.getElementById('addEngineBtn');
  
  let allTabs = [];
  let selectedIndex = -1;
  let hasSearchOption = false;
  let searchEngines = [];
  let defaultSearchEngine = {
    name: 'Google',
    icon: 'https://www.google.com/favicon.ico',
    url: 'https://www.google.com/search?q={query}'
  };

  // Load search engines from storage
  loadSearchEngines();

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
            const engineId = element.dataset.engineId;
            searchWithEngine(searchInput.value, engineId);
          } else {
            const tabId = parseInt(element.dataset.tabId);
            switchToTab(tabId);
          }
        } else if (searchInput.value.trim() !== '') {
          // If nothing is selected but we have a query, search with default engine
          searchWithEngine(searchInput.value);
        }
        break;
      case 'Escape':
        if (settingsModal.style.display === 'block') {
          settingsModal.style.display = 'none';
        } else {
          window.close();
        }
        break;
    }
  });

  // Settings button click handler
  settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
    renderSearchEnginesList();
  });

  // Close modal button click handler
  closeModalBtn.addEventListener('click', () => {
    settingsModal.style.display = 'none';
    searchInput.focus();
  });

  // Add search engine button click handler
  addEngineBtn.addEventListener('click', () => {
    const name = document.getElementById('engineName').value.trim();
    const icon = document.getElementById('engineIcon').value.trim() || 'default-icon.png';
    const url = document.getElementById('engineUrl').value.trim();

    if (name && url && url.includes('{query}')) {
      addSearchEngine(name, icon, url);
      renderSearchEnginesList();
      
      // Clear form
      document.getElementById('engineName').value = '';
      document.getElementById('engineIcon').value = '';
      document.getElementById('engineUrl').value = '';
    } else {
      alert('Please enter a valid name and URL that includes {query} placeholder');
    }
  });

  function renderTabs(tabs, query = '') {
    tabList.innerHTML = '';
    
    // If we have a query but no matching tabs, add search options
    hasSearchOption = query !== '';
    
    if (hasSearchOption) {
      // Add a divider before search options
      const divider = document.createElement('div');
      divider.className = 'search-divider';
      divider.textContent = 'Search with:';
      tabList.appendChild(divider);
      
      // Add search options for each search engine
      searchEngines.forEach((engine, index) => {
        const searchElement = document.createElement('div');
        searchElement.className = 'tab-item';
        searchElement.dataset.action = 'search';
        searchElement.dataset.engineId = index;
        
        // Create elements instead of using innerHTML to avoid potential rendering issues
        const iconImg = document.createElement('img');
        iconImg.className = 'tab-icon';
        iconImg.src = engine.icon;
        iconImg.onerror = () => { iconImg.src = 'default-icon.png'; }; // Fallback for failed icon loads
        
        const textSpan = document.createElement('span');
        textSpan.textContent = `${engine.name} "${query}"`;
        
        searchElement.appendChild(iconImg);
        searchElement.appendChild(textSpan);
        searchElement.addEventListener('click', () => searchWithEngine(query, index));
        tabList.appendChild(searchElement);
      });
      
      // Add a separator after search options if we have tabs
      if (tabs.length > 0) {
        const separator = document.createElement('div');
        separator.className = 'separator';
        tabList.appendChild(separator);
      }
    }
    
    tabs.forEach((tab) => {
      const tabElement = document.createElement('div');
      tabElement.className = 'tab-item';
      tabElement.dataset.tabId = tab.id;
      
      // Create elements instead of using innerHTML
      const iconImg = document.createElement('img');
      iconImg.className = 'tab-icon';
      iconImg.src = tab.favIconUrl || 'default-icon.png';
      iconImg.onerror = () => { iconImg.src = 'default-icon.png'; }; // Fallback for failed icon loads
      
      const textSpan = document.createElement('span');
      textSpan.textContent = tab.title;
      
      tabElement.appendChild(iconImg);
      tabElement.appendChild(textSpan);
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
  
  function searchWithEngine(query, engineId = 0) {
    const engine = searchEngines[engineId] || defaultSearchEngine;
    const searchUrl = engine.url.replace('{query}', encodeURIComponent(query));
    chrome.tabs.create({ url: searchUrl }, () => {
      window.close();
    });
  }

  function loadSearchEngines() {
    chrome.storage.sync.get('searchEngines', (data) => {
      if (data.searchEngines && data.searchEngines.length > 0) {
        searchEngines = data.searchEngines;
      } else {
        // Set default search engine if none exists
        searchEngines = [defaultSearchEngine];
        saveSearchEngines();
      }
    });
  }

  function saveSearchEngines() {
    chrome.storage.sync.set({ searchEngines: searchEngines });
  }

  function addSearchEngine(name, icon, url) {
    searchEngines.push({
      name: name,
      icon: icon,
      url: url
    });
    saveSearchEngines();
  }

  function deleteSearchEngine(index) {
    if (searchEngines.length > 1) {
      searchEngines.splice(index, 1);
      saveSearchEngines();
    } else {
      alert('You must have at least one search engine.');
    }
  }

  function renderSearchEnginesList() {
    searchEnginesList.innerHTML = '';
    
    searchEngines.forEach((engine, index) => {
      const engineElement = document.createElement('div');
      engineElement.className = 'search-engine-item';
      
      // Create engine info container
      const infoDiv = document.createElement('div');
      infoDiv.className = 'engine-info';
      
      // Create name container with icon
      const nameContainer = document.createElement('div');
      nameContainer.className = 'engine-name-container';
      
      // Create icon
      const iconImg = document.createElement('img');
      iconImg.className = 'tab-icon';
      iconImg.src = engine.icon;
      iconImg.onerror = () => { iconImg.src = 'default-icon.png'; }; // Fallback for failed icon loads
      
      // Create name 
      const nameStrong = document.createElement('strong');
      nameStrong.textContent = engine.name;
      
      // Add icon and name to container
      nameContainer.appendChild(iconImg);
      nameContainer.appendChild(nameStrong);
      nameContainer.appendChild(document.createTextNode(':'));
      
      // Create URL on its own line
      const urlSpan = document.createElement('span');
      urlSpan.className = 'engine-url';
      urlSpan.textContent = engine.url;
      
      // Append all elements to info div
      infoDiv.appendChild(nameContainer);
      infoDiv.appendChild(urlSpan);
      
      // Create delete button
      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-engine';
      deleteButton.dataset.index = index;
      
      const closeIcon = document.createElement('span');
      closeIcon.className = 'icon-close';
      
      deleteButton.appendChild(closeIcon);
      deleteButton.addEventListener('click', () => {
        deleteSearchEngine(index);
        renderSearchEnginesList();
      });
      
      engineElement.appendChild(infoDiv);
      engineElement.appendChild(deleteButton);
      searchEnginesList.appendChild(engineElement);
    });
  }
});