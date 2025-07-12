# VizDisk
**A Free macOS Disk Space Visualizer and Analyzer**

VizDisk is a modern, web-based disk usage analyzer for macOS that provides interactive treemap visualizations of your storage usage. Think WizTree for Windows, but designed specifically for macOS with a clean, native interface.

![VizDisk Interface](https://img.shields.io/badge/Platform-macOS-blue) ![Python](https://img.shields.io/badge/Python-3.8+-green) ![License](https://img.shields.io/badge/License-MIT-orange)

## 🌟 Features

### Core Functionality
- **📊 Interactive Treemap Visualization** - Navigate through your storage usage with zoom, hover, and click interactions
- **⚡ Real-time Scanning Progress** - Live progress updates with detailed status messages during filesystem analysis
- **🎯 Smart Directory Discovery** - Automatically discovers and suggests common directories (Downloads, Documents, Desktop, etc.)
- **🔍 Advanced Navigation Controls** - Home button to reset view and search filter to find specific files/folders
- **📱 Responsive Design** - Optimized interface that works perfectly on all screen sizes

### Analysis & Export
- **💾 Standalone HTML Reports** - Export fully interactive reports that work offline without internet connection
- **📈 Detailed Statistics** - View largest files and directories with precise size calculations
- **🚫 Smart Exclusions** - Pre-configured to skip system directories, with custom exclusion support
- **🔄 Real-time Updates** - Live progress tracking with percentage completion and current path display

### User Experience
- **🎨 macOS-Native Design** - Clean interface that feels at home on macOS
- **⚡ Fast Performance** - Efficient scanning algorithm optimized for large directory trees
- **🛡️ Permission-Safe** - Gracefully handles restricted directories without crashing
- **📋 Click-to-Open** - Click directory names to open them directly in Finder

## 🚀 First-Time Setup Guide

### Prerequisites

Before installing VizDisk, ensure you have the following:

1. **macOS Version**: macOS 10.15 (Catalina) or later
2. **Xcode Command Line Tools**: Required for Python compilation

### Step 1: Install Xcode Command Line Tools

Open Terminal and run:
```bash
xcode-select --install
```

When prompted:
- Click "Install" in the popup dialog
- Click "Agree" to the license terms
- Wait for the installation to complete (this may take 10-15 minutes)

### Step 2: Grant Terminal Permissions

VizDisk needs Terminal to access your files for scanning. You'll need to grant permissions:

1. **Full Disk Access** (Recommended):
   - Open System Preferences → Security & Privacy → Privacy
   - Click "Full Disk Access" in the left sidebar
   - Click the lock icon and enter your password
   - Click the "+" button and add Terminal.app
   - This allows VizDisk to scan all directories without restrictions

2. **Individual Folder Access** (Alternative):
   - When you first run a scan, macOS will prompt you to allow Terminal access
   - Click "OK" or "Allow" for each directory you want to scan
   - You may see multiple prompts for different system folders

### Step 3: Download and Install VizDisk

1. **Download the repository**:
   ```bash
   # Option 1: Using git (if you have it installed)
   git clone https://github.com/yourusername/vizdisk.git
   cd vizdisk
   
   # Option 2: Download ZIP file
   # Download from GitHub, extract, and navigate to the folder in Terminal
   ```

2. **Make the launch script executable**:
   ```bash
   chmod +x launch_macos.sh
   ```

3. **Run the installation**:
   ```bash
   ./launch_macos.sh
   ```

The script will automatically:
- Create a Python virtual environment
- Install all required dependencies (Flask, etc.)
- Create test directories with sample data
- Start the web server on an available port
- Open your default browser to the application

### Step 4: First Scan

1. **Select a directory**: Choose from the dropdown (starts with your Home Directory)
2. **Configure exclusions** (optional): Add comma-separated paths like `/System, /private`
3. **Start scanning**: Click "Start Scan" and watch the real-time progress
4. **Explore results**: Navigate the treemap, search for files, and view detailed statistics

## 🔧 Usage Guide

### Scanning Directories

1. **Choose Scan Path**: Select from discovered paths or enter a custom path
   - **Safe Test Paths**: Pre-created test directories for safe experimentation
   - **User Directories**: Your Downloads, Documents, Desktop, etc.
   - **System Directories**: Applications, /usr/local, and other system paths
   - **Custom Path**: Enter any valid directory path manually

2. **Configure Exclusions**: Add directories to skip during scanning
   ```
   Example: /System, /private, /Applications, node_modules
   ```

3. **Monitor Progress**: Watch real-time updates showing:
   - Percentage completion
   - Current directory being scanned
   - Processing status messages

### Navigating Results

1. **Treemap View**:
   - **Zoom**: Click on any directory to focus on that subtree
   - **Hover**: See detailed size and path information
   - **Colors**: Each directory level uses different colors for easy identification

2. **Navigation Controls**:
   - **Home Button**: Reset to full directory view
   - **Search Filter**: Type to find specific files or folders
   - **Clear Search**: Quick reset of search filter

3. **Details Tab**:
   - **Largest Directories**: Top space consumers by directory
   - **Largest Files**: Individual files taking up the most space
   - **Click to Open**: Click any path to open it in Finder

### Exporting Reports

1. Click "Export Results" after a successful scan
2. Save the HTML file to your desired location
3. Open the file in any modern web browser
4. The exported report includes:
   - Fully interactive treemap (works offline)
   - All navigation controls (Home, Search)
   - Complete directory and file listings
   - Identical functionality to the live application

## 🛠️ Advanced Configuration

### Custom Port

If port 8080 is in use, specify a different port:
```bash
python app.py --port 8081
```

### Environment Variables

- `PORT`: Override the default port
- `DEBUG`: Set to `1` for development mode with detailed logging

### Exclusion Patterns

Default exclusions include common system directories:
- `/System` - macOS system files
- `/private` - Private system data
- `/Applications` - Installed applications
- `/Library/Caches` - System caches
- `node_modules` - Node.js dependencies
- `.git` - Git repositories

## 🔍 Troubleshooting

### Common Issues

**"Permission denied" errors**:
- Grant Full Disk Access to Terminal in System Preferences
- Or click "Allow" when prompted for specific directories

**"Port already in use" error**:
- macOS uses port 5000 for AirPlay, use port 8080 instead
- Specify a custom port: `python app.py --port 8081`

**Scan appears to freeze**:
- Large directories may take time to process
- Watch for "Processing results..." status after 100% completion
- Check console output for detailed progress information

**Python/Flask installation issues**:
- Ensure Xcode Command Line Tools are installed
- Try running the setup script again: `./launch_macos.sh`
- Check Python version: `python3 --version` (should be 3.8+)

### Getting Help

If you encounter issues:
1. Check the console output for detailed error messages
2. Ensure all permissions are granted in System Preferences
3. Try scanning a smaller directory first (like Downloads)
4. Open an issue on GitHub with:
   - Your macOS version
   - Python version
   - Complete error message
   - Steps to reproduce the problem

## 🏗️ Technical Architecture

### Backend
- **Flask**: Web framework providing RESTful API endpoints
- **Python Threading**: Background scanning with progress callbacks
- **StorageScanner**: Custom filesystem traversal engine
- **Smart Exclusions**: Pre-configured system directory filtering

### Frontend
- **Vanilla JavaScript**: Modern ES6+ with no framework dependencies
- **Plotly.js**: Interactive treemap visualization library
- **Responsive CSS**: Mobile-first design with macOS aesthetics
- **Real-time Updates**: WebSocket-style progress polling

### Data Flow
1. User configures scan parameters through web interface
2. Flask spawns background thread for filesystem scanning
3. Scanner provides real-time progress callbacks
4. Results are processed and formatted for visualization
5. Interactive treemap is rendered with full navigation controls
6. Export functionality generates standalone HTML reports

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## 🔗 Links

- **GitHub Repository**: [https://github.com/sheafdynamics/vizdisk](https://github.com/sheafdynamics/vizdisk)
- **Issues & Support**: [GitHub Issues](https://github.com/sheafdynamics/vizdisk/issues)
- **Latest Releases**: [GitHub Releases](https://github.com/sheafdynamics/vizdisk/releases)

---

**VizDisk** - Making disk space analysis simple and visual on macOS.
