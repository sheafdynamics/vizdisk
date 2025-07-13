# macOS Storage Visualization Tool

## Overview

This is a Flask-based web application that provides an interactive treemap visualization of disk usage on macOS systems. The application scans filesystem directories, calculates storage usage, and presents the data through a modern web interface with real-time progress tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**July 12, 2025:**
- **Smart Size-Based Directory Filtering**: Implemented intelligent scanning that doesn't miss large files in system directories
  - Added 10MB threshold checking for cache/temp directories - only excludes them if they're small
  - Quick directory size estimation (checks first 50 files) before exclusion decisions
  - Large files over 10MB in cache/temp/log directories are always included in scans
  - Preserves performance while ensuring no significant storage usage is missed
  - Cache patterns include /var/folders, /Library/Caches, /usr/share, /tmp, etc.
- **Optimized Root Scan Performance**: Implemented multiple performance improvements to prevent browser hangs during large filesystem scans
  - Added depth limiting for root scans (6 levels max) to prevent excessive recursion
  - Added batch processing with micro-pauses to prevent browser blocking
  - Reduced treemap node limit from 500 to 300 for faster rendering
  - Optimized progress polling from 1 second to 2 seconds intervals
  - Added performance warning notifications for root scans
  - Enhanced timeout handling and error recovery for large datasets
- **Enabled Full System Access**: Modified app to support scanning Applications folder, root directory, and all system directories
  - Removed restrictions preventing scanning of root (/), /Applications, /System, and other system directories
  - Added comprehensive system directories to path discovery: Root, Applications, System, Library, /usr, /var, /tmp, /private
  - Updated scanner exclusions to only skip virtual filesystems (/dev, /proc, /sys) and container-specific paths
  - Added detailed Full Disk Access setup instructions to launch script for maximum system scanning capability
  - Updated usage instructions to clearly indicate full system scanning is now supported
  - Now supports complete macOS filesystem analysis when Full Disk Access permissions are granted
- **Removed Test Storage Creation Logic**: Eliminated all code that automatically creates storage_test folders on the machine
  - Removed test directory creation from launch_macos.sh script that was creating ~/Desktop/storage_test with sample files
  - Removed sed commands that dynamically updated file paths to point to test directory
  - Updated default scan paths to use user's Downloads folder instead of /tmp/test_storage
  - Cleaned up JavaScript fallback paths to reference actual user directories
  - Removed TEST_DIR variable and associated cleanup logic from launch script
  - App no longer creates any folders on the user's machine during startup

**July 11, 2025:**
- **Dynamic Path Discovery**: Replaced drag-and-drop scan path input with intelligent dropdown populated by actual filesystem discovery
  - Backend endpoint `/discover_paths` scans filesystem at startup to find real directories
  - Automatically discovers user directories (Downloads, Documents, Desktop, Pictures, Music, Movies, Library, Public)
  - Detects accessible system directories (Applications, /usr/local, /opt, /var/log)
  - Groups paths into categories: Safe Test Paths, User Directories, System Directories
  - Custom path option for manual entry when needed
  - Real username detection using getpass module
  - Permission-safe scanning that skips unreadable directories
  - Improved reliability over problematic drag-and-drop functionality
- **Simplified Exclude Directories**: Removed drag-and-drop from exclude directories input
  - Now uses simple comma-separated text input for better reliability
  - Removed orange dashed border styling
  - Cleaner interface with just text entry
  - Example placeholder shows proper format: "/System, /private, /Applications"
- **Fixed File Path Display Truncation**: Improved responsive layout for largest files section
  - Added proper text wrapping for long file paths using word-break and overflow-wrap
  - Enhanced mobile responsiveness with smaller font sizes and better spacing
  - Fixed flex layout to prevent path truncation on narrow screens
  - File paths now display completely without being cut off
- **Improved Treemap Text Display**: Fixed text overlap and sizing issues in treemap visualization
  - Set consistent 12px font size for better fit in rectangles
  - Changed uniformtext mode to 'hide' to prevent overlapping text
  - Simplified text display to use label+value for better automatic scaling
  - Text now hides gracefully in small rectangles instead of overlapping
- **Darker Treemap Colors**: Made chart colors 40% darker for better visual contrast
  - Updated color palette from light pastels to medium-dark shades
  - Root element now uses darker gray (#94a3b8) instead of light gray
  - Improved readability while maintaining accessibility with dark text
- **UI Text Updates**: Simplified scan path help text to show clear examples
  - Replaced bulky instructional text with simple "Example: /Users/john/Downloads"
  - Made active tab background even darker (#4c63d2) for better visual prominence
- **Default Home Directory**: Set dropdown to default to Home Directory instead of Test Storage
  - Users now start with their home directory selected by default
  - More intuitive starting point for actual disk usage analysis
- **Improved Hover Styling**: Fixed treemap hover overlays to use black text on white background
  - Added hoverlabel configuration for consistent white background with black text
  - Added CSS styling for Plotly hover elements with proper contrast
  - All mouse hover information now displays clearly with consistent styling
- **Animated Chart Loading**: Added loading spinner during treemap generation
  - Shows spinning animation with "Building Treemap Visualization" message
  - Prevents users from thinking the program has frozen during chart building
  - Appears immediately after scan completion while chart is being rendered
- **Interactive HTML Export**: Fixed exported HTML reports to have fully interactive treemap charts
  - Embedded treemap data directly into exported HTML for offline functionality
  - Removed "VizDisk Report" header text from exports for cleaner presentation
  - Charts in exported reports now have same interactivity as live app
  - Exports are now standalone files that work without internet connection
- **Treemap Navigation Controls**: Added Home button and search filter for better chart exploration
  - Home button resets treemap to original full view
  - Search filter allows typing to find specific files and folders
  - Clear search button to quickly reset filter
  - Both features work in live app and exported HTML reports
  - Search maintains parent hierarchy when filtering results
- **Fixed Post-Scan Processing Feedback**: Improved user experience during result preparation phase
  - Added "Processing results..." and "Building treemap visualization..." status messages
  - Shows clear feedback during the pause after 100% scan completion
  - Fixed JavaScript syntax errors that were causing console issues
  - Smooth transition with appropriate delays between processing phases
- **Fully Functional HTML Exports**: Resolved all export functionality issues
  - Fixed "Loading treemap..." message stuck in exported reports
  - Home and Search buttons now work correctly in exported HTML files
  - Added complete CSS styling and JavaScript functions for export interactivity
  - Exported reports now have identical functionality to the live application
- **Comprehensive GitHub README**: Created detailed documentation for repository
  - Complete first-time setup guide with Xcode Command Line Tools installation
  - Detailed macOS permission instructions (Full Disk Access vs individual folder access)
  - Step-by-step installation and usage instructions
  - Troubleshooting section for common issues
  - Technical architecture overview and advanced configuration options
- **Static GitHub Pages Website**: Created professional marketing site in `/docs` folder
  - Modern responsive design with gradient backgrounds and smooth animations
  - Hero section with app screenshots and clear call-to-action buttons
  - Features showcase highlighting treemap visualization and export capabilities
  - Step-by-step installation guide with code examples
  - Demo page with detailed feature explanations and all three screenshots
  - SEO optimization with meta tags and structured markup
  - GitHub Pages configuration with Jekyll settings
- **Simplified Help Text**: Replaced verbose scan path instructions with concise example
  - Removed multi-line explanation about path selection and $USER replacement
  - Changed to simple "Example: /Users/john/Downloads" format
  - Cleaner interface with less visual clutter
- **Click-to-Open Directories**: Added ability to click on directory items in Details tab to open them in Finder
  - Clickable visual styling with hover effects and external link icons
  - Uses file:// protocol to trigger system file browser
  - Fallback to clipboard copy if browser doesn't support direct file opening
  - Works in both main app and exported HTML reports
- **Enhanced UI Visual Cues**: Added dashed orange borders to input boxes to indicate drag-and-drop capability
  - Light orange background (#fef9f5) with `2px dashed #ff8c42` border
  - Clear visual indication that folders can be dragged into input fields
- **Improved Treemap Readability**: Fixed dark text on dark background issues
  - Switched from dark blue/gray color scheme to light teal gradient (#e6fffa to #285e61)
  - Dark text color (#1a202c) ensures readability on all background colors
  - Root element remains medium gray (#a0aec0) for visibility against white background
- **Fixed Drag-and-Drop Path Resolution**: Resolved issue where "/Users/user/Downloads" was incorrectly converted to "/Users/Downloads"
  - Removed aggressive auto-correction logic that treated valid paths as incomplete
  - Only corrects paths that clearly lack leading slashes or are very basic paths
  - Enhanced URI detection with support for plain text paths in drag data
- **Rebranded to VizDisk**: Updated application name from "macOS Storage Visualization Tool" to "VizDisk" with new tagline "A Free macOS Disk Space Visualizer and Analyzer"
- **Export Functionality**: Added Export Results button that generates standalone HTML reports for offline viewing
  - Button is greyed out until successful scan completion
  - Exported HTML includes both treemap and details tabs with full functionality
  - Added banner linking to GitHub repository (https://github.com/sheafdynamics/vizdisk)
  - Includes timestamp showing when report was generated
- **Enhanced Test Data**: Created realistic file structure with varied sizes (50KB-1MB) for better testing
- Fixed critical scanning issue where system directories (like /nix, /home/.cache) were being scanned
- Added safety checks to prevent scanning dangerous system paths
- Improved progress calculation to cap at 100% instead of going over
- Added scan cancellation functionality
- Updated default scan path to safer `/tmp/test_storage`
- Enhanced exclusion list to prevent scanning massive system directories
- Fixed treemap visualization to work with proper data structure
- Application now successfully scans directories and displays interactive treemap
- Created comprehensive macOS launch script (`launch_macos.sh`) for easy deployment
- Added automated environment setup with virtual environment and dependency installation
- Created README.md and DOWNLOAD_INSTRUCTIONS.md for user-friendly setup
- Added test directory creation with sample files for safe testing
- Fixed macOS port conflicts by avoiding ports 5000 (AirPlay) and 5001 (System services)
- Updated default port to 8080 for local macOS usage, 5000 for Replit environment
- Added automatic port detection and command-line port override support
- Implemented drag-and-drop functionality for folder inputs with visual feedback
- Added support for multiple folder selection in exclude directories field
- Enhanced user interface with drag hints and success/error messaging

## System Architecture

### Backend Architecture
- **Framework**: Flask web application serving as the main backend
- **Threading Model**: Multi-threaded architecture with background scanning capabilities
- **Scanner Module**: Dedicated `StorageScanner` class for efficient filesystem traversal
- **API Design**: RESTful endpoints for scan control and progress monitoring

### Frontend Architecture
- **UI Framework**: Vanilla JavaScript with modern ES6+ features
- **Visualization**: Plotly.js for interactive treemap generation
- **Styling**: CSS3 with modern design patterns and gradients
- **Icons**: Feather Icons for consistent iconography

### Data Flow
1. User initiates scan through web interface
2. Frontend sends scan request to Flask backend
3. Backend spawns separate thread for filesystem scanning
4. Scanner recursively traverses directories while respecting exclusions
5. Progress updates are streamed back to frontend
6. Results are processed and visualized as interactive treemap

## Key Components

### StorageScanner (`scanner.py`)
- **Purpose**: Core filesystem scanning engine
- **Features**: 
  - Recursive directory traversal
  - Size calculation and aggregation
  - Progress tracking with callbacks
  - Configurable directory exclusions
- **Exclusions**: Pre-configured to skip system directories like `/System`, `/private`, `/Applications`

### Flask Application (`app.py`)
- **Purpose**: Web server and API endpoint handler
- **Features**:
  - Thread-safe scanning operations
  - Global state management for scan progress
  - RESTful API for scan control
- **Endpoints**:
  - `/` - Main application interface
  - `/scan` - POST endpoint to initiate scanning

### Frontend Interface (`static/script.js`, `templates/index.html`)
- **Purpose**: User interface and visualization
- **Features**:
  - Real-time progress updates
  - Interactive treemap visualization
  - Scan configuration controls
  - Responsive design optimized for macOS aesthetics

## Data Flow

1. **Scan Initiation**: User configures scan path and exclusions through web form
2. **Backend Processing**: Flask spawns daemon thread running StorageScanner
3. **Progress Updates**: Scanner provides real-time progress callbacks
4. **Data Collection**: Scanner builds hierarchical directory structure with size data
5. **Visualization**: Frontend receives results and renders interactive treemap
6. **User Interaction**: Users can explore the treemap to understand storage usage patterns

## External Dependencies

- **Flask**: Web framework for backend API
- **Plotly.js**: JavaScript visualization library for treemap rendering
- **Feather Icons**: Icon library for consistent UI elements
- **Python Standard Library**: `os`, `stat`, `pathlib`, `threading` for system operations

## Deployment Strategy

### Development Setup
- Standard Flask development server
- Static file serving through Flask
- No external database required (in-memory state management)

### Production Considerations
- **WSGI Server**: Application ready for deployment with Gunicorn or uWSGI
- **Static Files**: Can be served through nginx or CDN in production
- **Security**: Basic Flask security practices should be implemented
- **Performance**: Thread-safe design allows for concurrent scanning operations

### Platform Requirements
- **Target OS**: macOS (directory exclusions are macOS-specific)
- **Python Version**: Python 3.x with standard library
- **Browser Support**: Modern browsers with JavaScript ES6+ support
- **System Permissions**: Requires read access to filesystem directories being scanned

## Technical Decisions

### Threading Model
- **Problem**: Filesystem scanning can be time-consuming and would block web interface
- **Solution**: Background thread execution with progress callbacks
- **Benefits**: Non-blocking UI, real-time progress updates, cancellable operations

### Visualization Choice
- **Problem**: Need interactive way to explore hierarchical storage data
- **Solution**: Plotly.js treemap visualization
- **Benefits**: Interactive exploration, zoom capabilities, responsive design

### State Management
- **Problem**: Track scan progress across multiple requests
- **Solution**: Global variables with thread-safe updates
- **Trade-off**: Simple but not suitable for multi-user environments

### Directory Exclusions
- **Problem**: System directories can cause permission issues and aren't useful for user analysis
- **Solution**: Pre-configured exclusion list with user customization
- **Benefits**: Faster scans, fewer permission errors, focused results