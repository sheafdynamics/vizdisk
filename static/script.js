/**
 * macOS Storage Visualization Tool - Frontend JavaScript
 * Handles UI interactions, scanning progress, and treemap visualization
 */

class StorageVisualizer {
    constructor() {
        this.isScanning = false;
        this.scanResults = null;
        this.progressInterval = null;
        
        this.initializeElements();
        this.bindEvents();
    }
    
    initializeElements() {
        // Control elements
        this.scanPathSelect = document.getElementById('scan-path');
        this.customPathInput = document.getElementById('custom-path');
        this.excludeDirsInput = document.getElementById('exclude-dirs');
        this.exportResultsBtn = document.getElementById('export-results');
        this.startScanBtn = document.getElementById('start-scan');
        this.stopScanBtn = document.getElementById('stop-scan');
        
        // Progress elements
        this.progressSection = document.getElementById('progress-section');
        this.progressFill = document.getElementById('progress-fill');
        this.progressPercentage = document.getElementById('progress-percentage');
        this.progressStatus = document.getElementById('progress-status');
        this.currentPath = document.getElementById('current-path');
        
        // Results elements
        this.resultsSection = document.getElementById('results-section');
        this.errorSection = document.getElementById('error-section');
        this.errorText = document.getElementById('error-text');
        
        // Tab elements
        this.tabButtons = document.querySelectorAll('.tab-btn');
        this.tabContents = document.querySelectorAll('.tab-content');
        
        // Details elements
        this.totalSize = document.getElementById('total-size');
        this.fileCount = document.getElementById('file-count');
        this.dirCount = document.getElementById('dir-count');
        this.topDirectories = document.getElementById('top-directories');
        this.topFiles = document.getElementById('top-files');
        
        // Treemap control elements
        this.homeButton = document.getElementById('home-button');
        this.searchFilter = document.getElementById('search-filter');
        this.clearSearchBtn = document.getElementById('clear-search');
    }
    
    bindEvents() {
        // Scan controls
        this.exportResultsBtn.addEventListener('click', () => this.exportResults());
        this.startScanBtn.addEventListener('click', () => this.startScan());
        this.stopScanBtn.addEventListener('click', () => this.stopScan());
        
        // Tab switching
        this.tabButtons.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });
        
        // Handle scan path dropdown changes
        this.scanPathSelect.addEventListener('change', () => {
            if (this.scanPathSelect.value === 'custom') {
                this.customPathInput.style.display = 'block';
                this.customPathInput.focus();
            } else {
                this.customPathInput.style.display = 'none';
            }
        });
        
        // Enter key in input fields
        this.customPathInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startScan();
        });
        
        this.excludeDirsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startScan();
        });
        
        // Treemap control events
        if (this.homeButton) {
            this.homeButton.addEventListener('click', () => this.resetTreemapView());
        }
        
        if (this.searchFilter) {
            this.searchFilter.addEventListener('input', (e) => this.filterTreemap(e.target.value));
            this.searchFilter.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.filterTreemap(e.target.value);
                }
            });
        }
        
        if (this.clearSearchBtn) {
            this.clearSearchBtn.addEventListener('click', () => {
                this.searchFilter.value = '';
                this.filterTreemap('');
            });
        }
        
        // Note: Exclude directories is now just a simple comma-separated text input
    }
    
    setupDragAndDrop(inputElement, mode) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            inputElement.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        // Highlight input on drag enter/over
        ['dragenter', 'dragover'].forEach(eventName => {
            inputElement.addEventListener(eventName, () => {
                inputElement.classList.add('drag-over');
            });
        });
        
        // Remove highlight on drag leave
        inputElement.addEventListener('dragleave', () => {
            inputElement.classList.remove('drag-over');
        });
        
        // Handle file drop
        inputElement.addEventListener('drop', async (e) => {
            inputElement.classList.remove('drag-over');
            
            const folderPaths = [];
            
            // Method 1: Check files array for actual file paths (most reliable on macOS)
            if (e.dataTransfer.files) {
                const files = Array.from(e.dataTransfer.files);
                
                for (const file of files) {
                    // Check for actual file system path (webkitRelativePath or path property)
                    let fullPath = null;
                    
                    if (file.webkitRelativePath) {
                        // Get the root folder from webkitRelativePath
                        const pathParts = file.webkitRelativePath.split('/');
                        if (pathParts.length > 1) {
                            fullPath = '/' + pathParts.slice(0, -1).join('/'); // Remove filename, keep dir
                        }
                    } else if (file.path) {
                        // macOS: file.path contains the actual filesystem path
                        if (file.name === '.DS_Store') {
                            // Extract directory from .DS_Store path
                            fullPath = file.path.substring(0, file.path.lastIndexOf('/.DS_Store'));
                        } else {
                            // Extract directory from file path
                            fullPath = file.path.substring(0, file.path.lastIndexOf('/'));
                        }
                    }
                    
                    if (fullPath && !folderPaths.includes(fullPath)) {
                        folderPaths.push(fullPath);
                    }
                }
            }
            
            // Method 2: Check for directory entries with better path detection
            if (folderPaths.length === 0 && e.dataTransfer.items) {
                const items = Array.from(e.dataTransfer.items);
                
                for (const item of items) {
                    if (item.kind === 'file') {
                        const entry = item.webkitGetAsEntry();
                        if (entry && entry.isDirectory) {
                            const folderName = entry.name;
                            console.log('Detected folder but path unclear:', folderName);
                            
                            // Try to get the filesystem path through various methods
                            if (entry.filesystem && entry.filesystem.root && entry.filesystem.root.toURL) {
                                const rootUrl = entry.filesystem.root.toURL();
                                if (rootUrl.startsWith('filesystem:file:///')) {
                                    // Extract the real path from filesystem URL
                                    const realPath = decodeURIComponent(rootUrl.substring('filesystem:file://'.length));
                                    folderPaths.push(realPath + '/' + folderName);
                                }
                            }
                        }
                    }
                }
            }
            
            // Method 3: Try to get paths from the dataTransfer types (enhanced)
            if (folderPaths.length === 0) {
                const types = e.dataTransfer.types;
                
                // Check for file URI list
                if (types.includes('text/uri-list')) {
                    const uriList = e.dataTransfer.getData('text/uri-list');
                    const paths = uriList.split('\n').filter(path => path.trim());
                    
                    for (const path of paths) {
                        if (path.startsWith('file://')) {
                            const decodedPath = decodeURIComponent(path.substring(7));
                            // Don't filter out paths with dots - they might be valid directories
                            folderPaths.push(decodedPath.replace(/\/$/, ''));
                        }
                    }
                }
                
                // Also check for plain text which might contain paths
                if (folderPaths.length === 0 && types.includes('text/plain')) {
                    const plainText = e.dataTransfer.getData('text/plain');
                    if (plainText && plainText.startsWith('/')) {
                        folderPaths.push(plainText.trim());
                    }
                }
            }
            
            // Debug: Log all available data transfer info
            console.log('DataTransfer types:', e.dataTransfer.types);
            console.log('DataTransfer files count:', e.dataTransfer.files.length);
            console.log('DataTransfer items count:', e.dataTransfer.items.length);
            
            // Method 4: Try all available text formats
            if (folderPaths.length === 0) {
                for (const type of e.dataTransfer.types) {
                    try {
                        const data = e.dataTransfer.getData(type);
                        console.log(`Data for type ${type}:`, data);
                        
                        if (data && data.includes('/')) {
                            // This might be a path
                            const lines = data.split('\n').filter(line => line.trim());
                            for (const line of lines) {
                                if (line.startsWith('/') || line.startsWith('file://')) {
                                    let path = line.startsWith('file://') ? decodeURIComponent(line.substring(7)) : line;
                                    path = path.replace(/\/$/, ''); // Remove trailing slash
                                    if (!folderPaths.includes(path)) {
                                        folderPaths.push(path);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.log(`Error reading data for type ${type}:`, error);
                    }
                }
            }

            if (folderPaths.length > 0) {
                this.handleFolderDrop(inputElement, folderPaths, mode);
            } else {
                this.showDragError('Could not detect folder paths. Please try typing the path manually.');
            }
        });
    }
    
    handleFolderDrop(inputElement, folderPaths, mode) {
        if (mode === 'single') {
            // For scan path, use the first folder
            if (folderPaths.length > 0) {
                let pathToUse = folderPaths[0];
                
                // Only auto-correct if path is clearly incomplete (no leading slash or just a folder name)
                if (!pathToUse.startsWith('/')) {
                    const folderName = pathToUse;
                    const username = this.getCurrentUsername();
                    
                    // Common macOS user folder locations
                    if (folderName === 'user' || folderName === username) {
                        pathToUse = `/Users/${username}`;
                    } else if (folderName === 'Library') {
                        pathToUse = `/Users/${username}/Library`;
                    } else if (folderName === 'Documents') {
                        pathToUse = `/Users/${username}/Documents`;
                    } else if (folderName === 'Downloads') {
                        pathToUse = `/Users/${username}/Downloads`;
                    } else if (folderName === 'Desktop') {
                        pathToUse = `/Users/${username}/Desktop`;
                    } else {
                        // Default guess for user folders
                        pathToUse = `/Users/${username}/${folderName}`;
                    }
                } else if (pathToUse === '/Users' || pathToUse.split('/').length === 2) {
                    // Only correct very incomplete paths like "/Users" or "/Applications"
                    const folderName = pathToUse.replace(/^\/+/, '');
                    const username = this.getCurrentUsername();
                    if (folderName === 'Users') {
                        pathToUse = `/Users/${username}`;
                    }
                }
                
                inputElement.value = pathToUse;
                
                // Show message with option to correct
                if (pathToUse !== folderPaths[0]) {
                    this.showDragSuccess(`Path set to: ${pathToUse} (auto-corrected - please verify)`);
                } else {
                    this.showDragSuccess(`Scan path set to: ${pathToUse}`);
                }
            }
        } else if (mode === 'multiple') {
            // For exclude directories, append all folders
            const currentValue = inputElement.value.trim();
            const existingDirs = currentValue ? currentValue.split(',').map(d => d.trim()) : [];
            
            // Process and correct paths (only if clearly incomplete)
            const processedPaths = folderPaths.map(path => {
                if (!path.startsWith('/')) {
                    const folderName = path;
                    const username = this.getCurrentUsername();
                    return `/Users/${username}/${folderName}`;
                } else if (path === '/Users' || path.split('/').length === 2) {
                    // Only correct very incomplete paths
                    const folderName = path.replace(/^\/+/, '');
                    const username = this.getCurrentUsername();
                    if (folderName === 'Users') {
                        return `/Users/${username}`;
                    }
                }
                return path;
            });
            
            // Add new folders that aren't already in the list
            const newDirs = processedPaths.filter(path => !existingDirs.includes(path));
            const allDirs = [...existingDirs, ...newDirs];
            
            inputElement.value = allDirs.join(', ');
            
            if (newDirs.length > 0) {
                this.showDragSuccess(`Added ${newDirs.length} folder(s) to exclusion list`);
            } else {
                this.showDragSuccess('Folders already in exclusion list');
            }
        }
    }
    
    getCurrentUsername() {
        return this.currentUsername;
    }
    
    async loadAvailablePaths() {
        try {
            const response = await fetch('/discover_paths');
            const data = await response.json();
            
            this.currentUsername = data.username;
            this.populatePathDropdown(data.paths);
            
        } catch (error) {
            console.error('Failed to load available paths:', error);
            // Fallback to basic paths
            this.populatePathDropdown([
                {label: 'Downloads', path: '/home/Downloads', category: 'user'}
            ]);
        }
    }
    
    populatePathDropdown(paths) {
        const select = this.scanPathSelect;
        select.innerHTML = '';
        
        // Group paths by category
        const categories = {
            'user': { label: 'User Directories', paths: [] },
            'system': { label: 'System Directories', paths: [] }
        };
        
        paths.forEach(path => {
            if (categories[path.category]) {
                categories[path.category].paths.push(path);
            }
        });
        
        // Add options grouped by category
        Object.entries(categories).forEach(([key, category]) => {
            if (category.paths.length > 0) {
                const optgroup = document.createElement('optgroup');
                optgroup.label = category.label;
                
                category.paths.forEach(path => {
                    const option = document.createElement('option');
                    option.value = path.path;
                    option.textContent = path.label;
                    optgroup.appendChild(option);
                });
                
                select.appendChild(optgroup);
            }
        });
        
        // Add custom path option
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = 'Custom Path...';
        select.appendChild(customOption);
        
        // Select home directory by default, fallback to first option
        const homeDirectory = paths.find(p => p.path.includes('/Users/') && p.path.endsWith(this.currentUsername));
        if (homeDirectory) {
            select.value = homeDirectory.path;
        } else if (paths.length > 0) {
            select.value = paths[0].path;
        }
    }
    
    showDragSuccess(message) {
        this.showTemporaryMessage(message, 'success');
    }
    
    
    showTemporaryMessage(message, type) {
        // Create temporary message element
        const messageEl = document.createElement('div');
        messageEl.className = `drag-message drag-message-${type}`;
        messageEl.textContent = message;
        
        // Add to controls section
        const controls = document.querySelector('.controls');
        controls.appendChild(messageEl);
        
        // Animate in
        setTimeout(() => messageEl.classList.add('show'), 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            messageEl.classList.remove('show');
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }
    
    async startScan() {
        if (this.isScanning) return;
        
        let scanPath;
        if (this.scanPathSelect.value === 'custom') {
            scanPath = this.customPathInput.value.trim();
        } else {
            scanPath = this.scanPathSelect.value;
        }
        
        // Replace $USER with actual username
        scanPath = scanPath.replace('$USER', this.getCurrentUsername());
        
        if (!scanPath) {
            this.showError('Please select or enter a scan path.');
            return;
        }
        const excludeDirs = this.excludeDirsInput.value
            .split(',')
            .map(dir => dir.trim())
            .filter(dir => dir.length > 0);
        
        // Show performance warning for root scans
        if (scanPath === '/') {
            this.showTemporaryMessage(
                'Root scan detected. Large cache/temp directories will be intelligently filtered unless they contain files over 10MB.',
                'info'
            );
        }
        
        this.isScanning = true;
        this.hideAllSections();
        this.showProgressSection();
        this.updateScanButtons();
        
        try {
            // Start the scan
            const response = await fetch('/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    path: scanPath,
                    exclude_dirs: excludeDirs
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to start scan');
            }
            
            // Start polling for progress
            this.startProgressPolling();
            
        } catch (error) {
            this.showError('Failed to start scan: ' + error.message);
            this.resetScanState();
        }
    }
    
    async stopScan() {
        if (!this.isScanning) return;
        
        try {
            const response = await fetch('/stop_scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                this.isScanning = false;
                this.stopProgressPolling();
                this.resetScanState();
                this.hideAllSections();
            }
        } catch (error) {
            console.error('Error stopping scan:', error);
        }
    }
    
    startProgressPolling() {
        this.progressInterval = setInterval(async () => {
            try {
                const response = await fetch('/progress');
                const progress = await response.json();
                
                this.updateProgress(progress);
                
                if (progress.status === 'completed') {
                    // Show processing message when scan is done but results are loading
                    this.progressStatus.textContent = 'Processing results...';
                    this.currentPath.textContent = 'Preparing visualization data...';
                    
                    this.stopProgressPolling();
                    
                    // Add small delay to show processing message before switching to results
                    setTimeout(async () => {
                        this.currentPath.textContent = 'Building treemap visualization...';
                        await this.loadResults();
                    }, 300);
                } else if (progress.status === 'error') {
                    this.stopProgressPolling();
                    this.showError('Scan failed: ' + progress.error);
                    this.resetScanState();
                }
                
            } catch (error) {
                console.error('Error fetching progress:', error);
            }
        }, 2000);  // Poll every 2 seconds instead of 1 to reduce browser load
    }
    
    stopProgressPolling() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
    
    updateProgress(progress) {
        this.progressFill.style.width = progress.progress + '%';
        this.progressPercentage.textContent = progress.progress + '%';
        this.progressStatus.textContent = this.getStatusText(progress.status);
        
        if (progress.current_path) {
            this.currentPath.textContent = progress.current_path;
        }
    }
    
    getStatusText(status) {
        switch (status) {
            case 'scanning': return 'Scanning directories...';
            case 'completed': return 'Processing results...';
            case 'error': return 'Scan failed';
            default: return 'Initializing...';
        }
    }
    
    async loadResults() {
        try {
            const response = await fetch('/results');
            if (!response.ok) {
                throw new Error('Failed to load results');
            }
            
            this.scanResults = await response.json();
            this.showResults();
            this.resetScanState();
            this.updateScanButtons(); // Enable export button after successful scan
            
        } catch (error) {
            this.showError('Failed to load results: ' + error.message);
            this.resetScanState();
        }
    }
    
    showResults() {
        this.hideAllSections();
        this.resultsSection.style.display = 'block';
        this.resultsSection.classList.add('fade-in');
        
        // Show treemap controls
        if (this.homeButton) this.homeButton.style.display = 'flex';
        if (this.searchFilter && this.searchFilter.parentElement) {
            this.searchFilter.parentElement.style.display = 'flex';
        }
        
        // Show loading indicator immediately, then load treemap
        const treemapContainer = document.getElementById('treemap-plot');
        treemapContainer.innerHTML = `
            <div class="chart-loading">
                <div class="spinner"></div>
                <div class="loading-text">Building Treemap Visualization</div>
                <div class="loading-subtext">Processing your scan results...</div>
            </div>
        `;
        
        // Load treemap with slight delay to ensure loading animation shows
        setTimeout(() => {
            this.loadTreemap();
        }, 100);
        
        // Load details
        this.loadDetails();
    }
    
    async loadTreemap() {
        try {
            // Show animated loading state
            const treemapContainer = document.getElementById('treemap-plot');
            treemapContainer.innerHTML = `
                <div class="chart-loading">
                    <div class="spinner"></div>
                    <div class="loading-text">Building Treemap Visualization</div>
                    <div class="loading-subtext">Processing your scan results...</div>
                </div>
            `;
            
            const response = await fetch('/treemap_data');
            if (!response.ok) {
                throw new Error('Failed to load treemap data');
            }
            
            const data = await response.json();
            
            // Check data size and warn user if large
            if (data.node_count > 300) {
                console.log(`Large dataset detected: ${data.node_count} nodes`);
            }
            
            // Add timeout to prevent long hangs
            const renderPromise = new Promise((resolve, reject) => {
                try {
                    this.renderTreemap(data);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Treemap rendering timed out')), 30000);
            });
            
            await Promise.race([renderPromise, timeoutPromise]);
            
        } catch (error) {
            console.error('Error loading treemap:', error);
            const treemapContainer = document.getElementById('treemap-plot');
            treemapContainer.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #d32f2f;">
                    <h4>Treemap could not be generated</h4>
                    <p>The dataset may be too large for visualization.</p>
                    <p>Try scanning a smaller directory or check the Details tab for file listings.</p>
                    <small>Error: ${error.message}</small>
                </div>
            `;
        }
    }
    
    renderTreemap(data) {
        console.log('Rendering treemap with data:', data);
        
        // Save treemap data for export and filtering
        this.lastTreemapData = data;
        this.originalTreemapData = JSON.parse(JSON.stringify(data)); // Deep copy
        
        // Validate data
        if (!data || !data.labels || !data.values || data.labels.length === 0) {
            console.error('Invalid treemap data:', data);
            document.getElementById('treemap-plot').innerHTML = 
                '<div style="text-align: center; padding: 50px; color: #d32f2f;">No data available for visualization</div>';
            return;
        }
        
        // Calculate adaptive text sizes based on values
        const maxValue = Math.max(...data.values);
        const minValue = Math.min(...data.values.filter(v => v > 0));
        
        console.log('Value range:', minValue, 'to', maxValue);
        
        // Darker colors (40% darker than previous light colors)
        const darkerColors = [
            '#fca5a5', // darker red
            '#fbbf24', // darker yellow
            '#34d399', // darker green
            '#60a5fa', // darker blue
            '#a78bfa', // darker purple
            '#f472b6', // darker pink
            '#2dd4bf', // darker teal
            '#f59e0b', // darker amber
            '#94a3b8', // darker slate
            '#9ca3af'  // darker gray
        ];
        
        // Create explicit colors for each item
        const colors = data.values.map((value, index) => {
            const isRoot = data.parents[index] === ''; // Root has empty parent
            if (isRoot) {
                return '#94a3b8'; // Darker gray for root - visible but subtle
            }
            
            // Use predefined darker colors in rotation
            return darkerColors[index % darkerColors.length];
        });

        const trace = {
            type: 'treemap',
            labels: data.labels,
            parents: data.parents,
            values: data.values,
            ids: data.ids,
            
            // Use explicit colors instead of colorscale
            marker: {
                colors: colors,
                line: {
                    width: 1,
                    color: '#ffffff'
                }
            },
            
            // Improved text display with better scaling
            textinfo: 'label+text',  // Use formatted text instead of raw value
            texttemplate: '%{label}<br>%{text}',
            text: data.values.map(v => this.formatSize(v)),
            
            // Enhanced text positioning and scaling
            textposition: 'middle center',
            textfont: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                size: 12,  // Slightly smaller to fit better
                color: '#000000'  // Pure black for maximum contrast and accessibility
            },
            
            // Better hover information with consistent styling
            hovertemplate: '<b>%{label}</b><br>' +
                         'Size: %{text}<br>' +
                         'Percentage: %{percentParent}<br>' +
                         'Path: %{id}<br>' +
                         '<extra></extra>',
            hoverlabel: {
                bgcolor: 'white',
                bordercolor: '#ccc',
                font: {
                    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    size: 12,
                    color: 'black'
                }
            },
            
            // Remove color bar to save space
            showscale: false,
            
            // Better spacing and padding
            pathbar: {
                visible: false  // Remove path bar to maximize chart area
            },
            
            // Improved sector configuration
            sort: true,  // Sort by size
            branchvalues: 'total'  // Use total values for branch sizing
        };
        
        const layout = {
            font: {
                family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                size: 12  // Consistent with textfont size
            },
            // Minimize margins to maximize chart area
            margin: { t: 5, r: 5, b: 5, l: 5 },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
            autosize: true,
            showlegend: false,
            
            // Better text scaling to prevent overlap
            uniformtext: {
                minsize: 12,  // Smaller minimum to prevent overlap
                mode: 'hide'  // Hide text that doesn't fit instead of overlapping
            }
        };
        
        const config = {
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: [
                'pan2d', 'select2d', 'lasso2d', 'resetScale2d',
                'autoScale2d', 'hoverClosestCartesian', 'hoverCompareCartesian'
            ],
            modeBarButtonsToAdd: [
                {
                    name: 'Zoom to fit',
                    icon: Plotly.Icons.home,
                    click: function(gd) {
                        Plotly.relayout(gd, {
                            'xaxis.autorange': true,
                            'yaxis.autorange': true
                        });
                    }
                }
            ],
            responsive: true,
            doubleClick: 'reset'  // Double-click to reset zoom
        };
        
        // Clear any existing plot
        const plotDiv = document.getElementById('treemap-plot');
        plotDiv.innerHTML = '';
        
        // Create the plot with error handling
        try {
            Plotly.newPlot('treemap-plot', [trace], layout, config)
                .then(() => {
                    console.log('Treemap rendered successfully');
                })
                .catch(error => {
                    console.error('Plotly rendering error:', error);
                    plotDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #d32f2f;">Error rendering treemap: ' + error.message + '</div>';
                });
        } catch (error) {
            console.error('Plotly newPlot error:', error);
            plotDiv.innerHTML = '<div style="text-align: center; padding: 50px; color: #d32f2f;">Error creating treemap: ' + error.message + '</div>';
        }
        
        // Add click handler for drilling down (after plot is created)
        const plotElement = document.getElementById('treemap-plot');
        plotElement.removeAllListeners?.('plotly_click'); // Remove existing listeners
        plotElement.on('plotly_click', (data) => {
            if (data.points && data.points[0]) {
                const point = data.points[0];
                console.log('Clicked on:', point.label, 'Path:', point.id);
            }
        });
        
        // Force a resize after rendering
        setTimeout(() => {
            Plotly.Plots.resize('treemap-plot');
        }, 100);
    }
    
    loadDetails() {
        if (!this.scanResults) return;
        
        // Update summary cards
        this.totalSize.textContent = this.formatSize(this.scanResults.size);
        this.fileCount.textContent = this.scanResults.file_count.toLocaleString();
        this.dirCount.textContent = this.scanResults.dir_count.toLocaleString();
        
        // Load top directories and files
        this.loadTopItems();
    }
    
    async loadTopItems() {
        // For now, extract top items from scan results
        // In a real implementation, you might want separate endpoints
        const topDirs = this.extractTopDirectories(this.scanResults);
        const topFiles = this.extractTopFiles(this.scanResults);
        
        this.renderTopItems(this.topDirectories, topDirs, 'folder');
        this.renderTopItems(this.topFiles, topFiles, 'file');
    }
    
    extractTopDirectories(node, result = []) {
        if (!node || node.is_file) return result;
        
        if (node.path && node.size > 0) {
            result.push({
                name: node.name,
                path: node.path,
                size: node.size,
                file_count: node.file_count,
                dir_count: node.dir_count
            });
        }
        
        if (node.children) {
            node.children.forEach(child => this.extractTopDirectories(child, result));
        }
        
        return result.sort((a, b) => b.size - a.size).slice(0, 10);
    }
    
    extractTopFiles(node, result = []) {
        if (!node) return result;
        
        if (node.is_file) {
            result.push({
                name: node.name,
                path: node.path,
                size: node.size
            });
        }
        
        if (node.children) {
            node.children.forEach(child => this.extractTopFiles(child, result));
        }
        
        return result.sort((a, b) => b.size - a.size).slice(0, 10);
    }
    
    renderTopItems(container, items, iconType) {
        container.innerHTML = items.slice(0, 10).map(item => `
            <div class="item ${iconType === 'folder' ? 'item-clickable' : ''}" 
                 ${iconType === 'folder' ? `onclick="window.vizDisk.openInFinder('${this.escapeHtml(item.path)}')" title="Click to open in Finder"` : ''}>
                <div class="item-size-badge">${this.formatSize(item.size)}</div>
                <div class="item-icon">
                    <i data-feather="${iconType}"></i>
                </div>
                <div class="item-info">
                    <div class="item-name">${this.escapeHtml(item.name)}</div>
                    <div class="item-path">${this.escapeHtml(item.path || '')}</div>
                </div>
                ${iconType === 'folder' ? '<div class="item-action"><i data-feather="external-link"></i></div>' : ''}
            </div>
        `).join('');
        
        feather.replace();
    }
    
    openInFinder(path) {
        if (!path) return;
        
        try {
            // Method 1: Try using file:// protocol to open Finder
            const fileUrl = `file://${encodeURIComponent(path)}`;
            window.open(fileUrl, '_blank');
        } catch (error) {
            console.log('Failed to open Finder via file protocol:', error);
            
            // Method 2: Copy path to clipboard as fallback
            this.copyToClipboard(path);
            this.showTemporaryMessage(`Path copied to clipboard: ${path}`, 'success');
        }
    }
    
    copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(err => {
                console.log('Failed to copy to clipboard:', err);
                this.fallbackCopyToClipboard(text);
            });
        } else {
            this.fallbackCopyToClipboard(text);
        }
    }
    
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
        } catch (err) {
            console.log('Fallback copy failed:', err);
        }
        
        document.body.removeChild(textArea);
    }
    
    switchTab(tabName) {
        // Update tab buttons
        this.tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Update tab contents
        this.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === tabName + '-tab');
        });
        
        // Redraw treemap if switching to treemap tab
        if (tabName === 'treemap') {
            setTimeout(() => {
                Plotly.Plots.resize('treemap-plot');
            }, 100);
        }
    }
    
    showProgressSection() {
        this.progressSection.style.display = 'block';
        this.progressSection.classList.add('fade-in');
    }
    
    hideAllSections() {
        this.progressSection.style.display = 'none';
        this.resultsSection.style.display = 'none';
        this.errorSection.style.display = 'none';
        
        // Remove animation classes
        [this.progressSection, this.resultsSection, this.errorSection].forEach(el => {
            el.classList.remove('fade-in');
        });
    }
    
    showError(message) {
        this.hideAllSections();
        this.errorText.textContent = message;
        this.errorSection.style.display = 'block';
        this.errorSection.classList.add('fade-in');
    }
    
    updateScanButtons() {
        this.startScanBtn.disabled = this.isScanning;
        this.stopScanBtn.disabled = !this.isScanning;
        this.exportResultsBtn.disabled = !this.scanResults || this.isScanning;
    }
    
    resetScanState() {
        this.isScanning = false;
        this.updateScanButtons();
    }

    exportResults() {
        if (!this.scanResults) {
            this.showError('No scan results available to export');
            return;
        }

        try {
            const exportHtml = this.generateExportHtml();
            const blob = new Blob([exportHtml], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `vizdisk-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.html`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);
            
            this.showTemporaryMessage('Export completed successfully!', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showError('Failed to export results: ' + error.message);
        }
    }

    generateExportHtml() {
        const timestamp = new Date().toLocaleString();
        
        let scanPath;
        if (this.scanPathSelect.value === 'custom') {
            scanPath = this.customPathInput.value.trim();
        } else {
            scanPath = this.scanPathSelect.value;
        }
        scanPath = scanPath.replace('$USER', this.getCurrentUsername());
        
        // Get treemap data for interactive recreation
        const treemapData = JSON.stringify({
            ids: this.lastTreemapData?.ids || [],
            labels: this.lastTreemapData?.labels || [],
            parents: this.lastTreemapData?.parents || [],
            values: this.lastTreemapData?.values || []
        });
        
        // Get details data
        const totalSize = this.totalSize.textContent;
        const fileCount = this.fileCount.textContent;
        const dirCount = this.dirCount.textContent;
        
        // Generate top items HTML
        const topDirsHtml = this.generateTopItemsHtml(this.extractTopDirectories(this.scanResults), 'folder');
        const topFilesHtml = this.generateTopItemsHtml(this.extractTopFiles(this.scanResults), 'file');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VizDisk Report - ${scanPath}</title>
    <script src="https://cdn.plot.ly/plotly-3.0.1.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js"></script>
    <style>
        ${this.getExportStyles()}
    </style>
</head>
<body>
    <div class="export-banner">
        <div class="banner-content">
            <h2>📊 VizDisk Export Report</h2>
            <p>This is an exported result, not the full app. <a href="https://github.com/sheafdynamics/vizdisk" target="_blank">Click here for the full VizDisk application</a></p>
            <div class="timestamp">Report generated: ${timestamp}</div>
        </div>
    </div>
    
    <div class="container">
        <header>
            <p>Scan Path: ${this.escapeHtml(scanPath)}</p>
        </header>

        <div class="results-section">
            <div class="tabs">
                <button class="tab-btn active" onclick="switchTab('treemap')">
                    <i data-feather="map"></i>
                    Treemap
                </button>
                <button class="tab-btn" onclick="switchTab('details')">
                    <i data-feather="list"></i>
                    Details
                </button>
            </div>

            <div class="tab-content active" id="treemap-tab">
                <div class="treemap-controls">
                    <button onclick="resetTreemapView()" class="btn btn-small" style="display: flex;">
                        <i data-feather="home"></i>
                        Home
                    </button>
                    <div class="search-container" style="display: flex;">
                        <input type="text" id="export-search-filter" placeholder="Search files and folders..." oninput="filterTreemapExport(this.value)">
                        <button onclick="clearSearchExport()" class="btn btn-small">
                            <i data-feather="x"></i>
                        </button>
                    </div>
                </div>
                <div class="visualization-container">
                    <div id="treemap-plot">Loading treemap...</div>
                </div>
            </div>

            <div class="tab-content" id="details-tab">
                <div class="details-container">
                    <div class="summary-cards">
                        <div class="card">
                            <div class="card-header">
                                <i data-feather="folder"></i>
                                Total Size
                            </div>
                            <div class="card-value">${totalSize}</div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <i data-feather="file"></i>
                                File Count
                            </div>
                            <div class="card-value">${fileCount}</div>
                        </div>
                        <div class="card">
                            <div class="card-header">
                                <i data-feather="folder"></i>
                                Directory Count
                            </div>
                            <div class="card-value">${dirCount}</div>
                        </div>
                    </div>
                    
                    <div class="top-items">
                        <div class="top-item-section">
                            <h3><i data-feather="folder"></i> Largest Directories</h3>
                            <div class="item-list">${topDirsHtml}</div>
                        </div>
                        <div class="top-item-section">
                            <h3><i data-feather="file"></i> Largest Files</h3>
                            <div class="item-list">${topFilesHtml}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Tab switching functionality
        function switchTab(tabName) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            document.querySelector('[onclick="switchTab(\\'' + tabName + '\\')"]').classList.add('active');
            document.getElementById(tabName + '-tab').classList.add('active');
        }
        
        // Initialize Feather icons
        feather.replace();
        
        // Function to open paths in Finder (for exported reports)
        function openInFinder(path) {
            if (!path) return;
            
            try {
                const fileUrl = 'file://' + encodeURIComponent(path);
                window.open(fileUrl, '_blank');
            } catch (error) {
                console.log('Failed to open Finder:', error);
                
                // Fallback: copy to clipboard
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(path).then(() => {
                        alert('Path copied to clipboard: ' + path);
                    }).catch(() => {
                        alert('Could not open Finder. Path: ' + path);
                    });
                } else {
                    alert('Could not open Finder. Path: ' + path);
                }
            }
        }
        
        // Recreate treemap if needed
        ${this.getTreemapRecreationScript(treemapData)}
    </script>
</body>
</html>`;
    }

    generateTopItemsHtml(items, iconType) {
        return items.slice(0, 10).map(item => `
            <div class="item ${iconType === 'folder' ? 'item-clickable' : ''}" 
                 ${iconType === 'folder' ? `onclick="openInFinder('${this.escapeHtml(item.path)}')" title="Click to open in Finder"` : ''}>
                <div class="item-size-badge">${this.formatSize(item.size)}</div>
                <div class="item-icon">
                    <i data-feather="${iconType}"></i>
                </div>
                <div class="item-info">
                    <div class="item-name">${this.escapeHtml(item.name)}</div>
                    <div class="item-path">${this.escapeHtml(item.path || '')}</div>
                </div>
                ${iconType === 'folder' ? '<div class="item-action"><i data-feather="external-link"></i></div>' : ''}
            </div>
        `).join('');
    }

    getExportStyles() {
        // Return a simplified version of the styles for the export
        return `
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; background: #f8f9fa; }
            .export-banner { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px 0; text-align: center; margin-bottom: 30px; }
            .banner-content h2 { margin: 0 0 10px 0; }
            .banner-content p { margin: 5px 0; }
            .banner-content a { color: #fff; text-decoration: underline; }
            .timestamp { font-size: 14px; opacity: 0.9; margin-top: 10px; }
            .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
            header { text-align: center; margin-bottom: 40px; }
            header h1 { display: flex; align-items: center; justify-content: center; gap: 10px; color: #333; margin: 0 0 10px 0; }
            .tabs { display: flex; gap: 10px; margin-bottom: 20px; justify-content: center; }
            .tab-btn { padding: 12px 20px; border: none; border-radius: 8px; background: #e2e8f0; color: #666; cursor: pointer; display: flex; align-items: center; gap: 8px; }
            .tab-btn.active { background: #667eea; color: white; }
            .tab-content { display: none; }
            .tab-content.active { display: block; }
            .visualization-container { width: 100%; height: 700px; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; background: white; }
            #treemap-plot { width: 100%; height: 100%; }
            .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .card { background: #eef1ff; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; }
            .card-header { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #666; margin-bottom: 10px; }
            .card-value { font-size: 1.8rem; font-weight: 700; color: #333; }
            .top-items { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
            .top-item-section h3 { display: flex; align-items: center; gap: 8px; margin-bottom: 15px; color: #333; }
            .item { display: flex; align-items: center; gap: 12px; padding: 12px; background: #eef1ff; border-radius: 6px; margin-bottom: 8px; border-left: 3px solid #667eea; }
            .item-clickable { cursor: pointer; transition: all 0.2s ease; }
            .item-clickable:hover { background: #e2edff; transform: translateX(2px); box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15); }
            .item-action { margin-left: auto; color: #667eea; opacity: 0.6; transition: opacity 0.2s ease; }
            .item-clickable:hover .item-action { opacity: 1; }
            .item-size-badge { background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; min-width: 60px; text-align: center; }
            .item-icon { color: #667eea; }
            .item-info { flex: 1; }
            .item-name { font-weight: 600; color: #333; }
            .item-path { font-size: 12px; color: #666; }
            /* Treemap controls for export */
            .treemap-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
            .search-container { display: flex; align-items: center; gap: 8px; }
            .search-container input { padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; width: 250px; }
            .search-container input:focus { outline: none; border-color: #4c63d2; box-shadow: 0 0 0 2px rgba(76, 99, 210, 0.1); }
            .btn-small { padding: 8px 12px; font-size: 14px; display: flex; align-items: center; gap: 6px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer; }
            .btn-small:hover { background: #5a67d8; }
        `;
    }

    getTreemapRecreationScript(treemapData) {
        if (!treemapData) return '';
        
        // Generate the treemap data recreation script
        return `
        // Initialize export functionality
        let originalExportData = null;
        
        // Recreate interactive treemap from embedded data
        document.addEventListener('DOMContentLoaded', function() {
            const data = ${treemapData};
            if (data && data.labels && data.values && data.labels.length > 0) {
                originalExportData = data;
                renderTreemap(data);
                feather.replace(); // Initialize icons
            } else {
                document.getElementById('treemap-plot').innerHTML = '<div style="text-align: center; padding: 50px; color: #666;">No treemap data available</div>';
            }
        });
            
        function renderTreemap(data) {
            // Format size function
            function formatSize(bytes) {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
            }
            
            // Darker colors (40% darker than previous light colors)
            const darkerColors = [
                '#fca5a5', // darker red
                '#fbbf24', // darker yellow
                '#34d399', // darker green
                '#60a5fa', // darker blue
                '#a78bfa', // darker purple
                '#f472b6', // darker pink
                '#2dd4bf', // darker teal
                '#f59e0b', // darker amber
                '#94a3b8', // darker slate
                '#9ca3af'  // darker gray
            ];
            
            // Create explicit colors for each item
            const colors = data.values.map((value, index) => {
                const isRoot = data.parents[index] === ''; // Root has empty parent
                if (isRoot) {
                    return '#94a3b8'; // Darker gray for root - visible but subtle
                }
                
                // Use predefined darker colors in rotation
                return darkerColors[index % darkerColors.length];
            });

            const trace = {
                type: 'treemap',
                labels: data.labels,
                parents: data.parents,
                values: data.values,
                ids: data.ids,
                marker: {
                    colors: colors,
                    line: { width: 1, color: '#ffffff' }
                },
                textinfo: 'label+text',
                texttemplate: '<b>%{label}</b><br><span style="font-size: 0.9em">%{text}</span>',
                text: data.values.map(v => formatSize(v)),
                textposition: 'middle center',
                textfont: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 12, color: '#000000' },
                hovertemplate: '<b>%{label}</b><br>Size: %{text}<br>Percentage: %{percentParent}<br>Path: %{id}<br><extra></extra>',
                showscale: false, pathbar: { visible: false }, sort: true, branchvalues: 'total'
            };
            
            const layout = {
                font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', size: 12 },
                margin: { t: 5, r: 5, b: 5, l: 5 }, paper_bgcolor: 'white', plot_bgcolor: 'white',
                autosize: true, showlegend: false
            };
            
            const config = { displayModeBar: false, responsive: true };
            Plotly.newPlot('treemap-plot', [trace], layout, config);
            
            // Store original data for export filtering
            originalExportData = data;
        }
        
        // Export-specific functions for standalone HTML
        function resetTreemapView() {
            if (originalExportData) {
                renderTreemap(originalExportData);
                const searchInput = document.getElementById('export-search-filter');
                if (searchInput) searchInput.value = '';
            }
        }
        
        function filterTreemapExport(searchTerm) {
            if (!originalExportData || !searchTerm.trim()) {
                renderTreemap(originalExportData);
                return;
            }
            
            const search = searchTerm.toLowerCase();
            const filteredData = {
                ids: [],
                labels: [],
                parents: [],
                values: []
            };
            
            // Find matching items and their paths to root
            const matchingIndices = new Set();
            
            originalExportData.labels.forEach((label, index) => {
                if (label.toLowerCase().includes(search) || 
                    originalExportData.ids[index].toLowerCase().includes(search)) {
                    matchingIndices.add(index);
                    
                    // Add path to root
                    let currentIndex = index;
                    while (currentIndex !== -1) {
                        matchingIndices.add(currentIndex);
                        const parent = originalExportData.parents[currentIndex];
                        if (!parent) break;
                        currentIndex = originalExportData.ids.indexOf(parent);
                    }
                }
            });
            
            // Build filtered data maintaining hierarchy
            [...matchingIndices].sort((a, b) => a - b).forEach(originalIndex => {
                filteredData.ids.push(originalExportData.ids[originalIndex]);
                filteredData.labels.push(originalExportData.labels[originalIndex]);
                filteredData.values.push(originalExportData.values[originalIndex]);
                
                const parent = originalExportData.parents[originalIndex];
                if (parent && originalExportData.ids.includes(parent) && matchingIndices.has(originalExportData.ids.indexOf(parent))) {
                    filteredData.parents.push(parent);
                } else {
                    filteredData.parents.push('');
                }
            });
            
            if (filteredData.ids.length > 0) {
                renderTreemap(filteredData);
            }
        }
        
        function clearSearchExport() {
            const searchInput = document.getElementById('export-search-filter');
            if (searchInput) {
                searchInput.value = '';
                filterTreemapExport('');
            }
        }
        `;
    }
    
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let unitIndex = 0;
        let size = bytes;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
    
    resetTreemapView() {
        if (this.originalTreemapData) {
            this.renderTreemap(this.originalTreemapData);
            if (this.searchFilter) {
                this.searchFilter.value = '';
            }
        }
    }
    
    filterTreemap(searchTerm) {
        if (!this.originalTreemapData || !searchTerm.trim()) {
            this.renderTreemap(this.originalTreemapData);
            return;
        }
        
        const search = searchTerm.toLowerCase();
        const filteredData = {
            ids: [],
            labels: [],
            parents: [],
            values: []
        };
        
        // Find matching items and their paths to root
        const matchingIndices = new Set();
        
        // First, find direct matches
        this.originalTreemapData.labels.forEach((label, index) => {
            if (label.toLowerCase().includes(search) || 
                this.originalTreemapData.ids[index].toLowerCase().includes(search)) {
                matchingIndices.add(index);
                
                // Add path to root
                let currentIndex = index;
                while (currentIndex !== -1) {
                    matchingIndices.add(currentIndex);
                    const parent = this.originalTreemapData.parents[currentIndex];
                    if (!parent) break;
                    currentIndex = this.originalTreemapData.ids.indexOf(parent);
                }
            }
        });
        
        // Build filtered data maintaining hierarchy
        const indexMapping = new Map();
        let newIndex = 0;
        
        [...matchingIndices].sort((a, b) => a - b).forEach(originalIndex => {
            indexMapping.set(originalIndex, newIndex);
            filteredData.ids.push(this.originalTreemapData.ids[originalIndex]);
            filteredData.labels.push(this.originalTreemapData.labels[originalIndex]);
            filteredData.values.push(this.originalTreemapData.values[originalIndex]);
            
            const parent = this.originalTreemapData.parents[originalIndex];
            if (parent && indexMapping.has(this.originalTreemapData.ids.indexOf(parent))) {
                filteredData.parents.push(parent);
            } else {
                filteredData.parents.push('');
            }
            
            newIndex++;
        });
        
        if (filteredData.ids.length > 0) {
            this.renderTreemap(filteredData);
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    window.vizDisk = new StorageVisualizer();
    await window.vizDisk.loadAvailablePaths();
});
