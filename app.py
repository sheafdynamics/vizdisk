#!/usr/bin/env python3
"""
macOS Storage Visualization Tool
Interactive treemap display of disk usage
"""

import os
import json
import threading
import time
from flask import Flask, render_template, jsonify, request
from scanner import StorageScanner

app = Flask(__name__)

# Global variables for scanning state
scan_progress = {"status": "idle", "progress": 0, "current_path": "", "total_size": 0}
scan_results = None
scan_thread = None
scan_cancelled = False

@app.route('/')
def index():
    """Main page with treemap visualization"""
    return render_template('index.html')

@app.route('/scan', methods=['POST'])
def start_scan():
    """Start filesystem scanning"""
    global scan_thread, scan_progress, scan_results, scan_cancelled
    
    data = request.get_json()
    scan_path = data.get('path', os.path.expanduser('~/Downloads'))  # Default to user Downloads
    exclude_dirs = data.get('exclude_dirs', [])
    
    # Check if path is too dangerous to scan (only exclude container-specific paths)
    dangerous_paths = ['/home/runner/.nix-defexpr', '/home/runner/.cache', '/nix', '/mnt']
    if any(scan_path.startswith(dangerous) for dangerous in dangerous_paths):
        return jsonify({"error": "Cannot scan container system directories. Please choose a different directory."}), 400
    
    # Reset scan state
    scan_progress = {"status": "scanning", "progress": 0, "current_path": "", "total_size": 0}
    scan_results = None
    scan_cancelled = False
    
    # Start scanning in a separate thread with smart optimizations
    if scan_path == '/':
        # Root scan: limit depth but use smart size-based exclusions
        max_depth = 6  # Limit depth to 6 levels
    else:
        max_depth = None
    
    scanner = StorageScanner(exclude_dirs, max_depth=max_depth)
    scan_thread = threading.Thread(target=run_scan, args=(scanner, scan_path))
    scan_thread.daemon = True
    scan_thread.start()
    
    return jsonify({"status": "started"})

@app.route('/stop_scan', methods=['POST'])
def stop_scan():
    """Stop current scan"""
    global scan_cancelled, scan_progress
    
    scan_cancelled = True
    scan_progress["status"] = "cancelled"
    
    return jsonify({"status": "cancelled"})

def run_scan(scanner, path):
    """Run the filesystem scan in a separate thread"""
    global scan_progress, scan_results, scan_cancelled
    
    try:
        def progress_callback(current_path, processed_items, total_items):
            global scan_cancelled
            if scan_cancelled:
                return False  # Signal to stop scanning
            scan_progress["current_path"] = current_path
            scan_progress["progress"] = min(int((processed_items / max(total_items, 1)) * 100), 100)  # Cap at 100%
            return True
        
        print(f"Starting scan of: {path}")
        results = scanner.scan_directory(path, progress_callback)
        
        if scan_cancelled:
            scan_progress["status"] = "cancelled"
            return
            
        if results:
            scan_results = results
            scan_progress["status"] = "completed"
            scan_progress["total_size"] = results.get("size", 0)
        else:
            scan_progress["status"] = "error"
            scan_progress["error"] = "No results returned from scan"
        print(f"Scan completed. Total size: {results.get('size', 0) if results else 0} bytes")
        
    except Exception as e:
        print(f"Scan error: {str(e)}")
        scan_progress["status"] = "error"
        scan_progress["error"] = str(e)

@app.route('/progress')
def get_progress():
    """Get current scan progress"""
    return jsonify(scan_progress)

@app.route('/results')
def get_results():
    """Get scan results for visualization"""
    if scan_results is None:
        return jsonify({"error": "No results available"}), 404
    
    return jsonify(scan_results)

@app.route('/treemap_data')
def get_treemap_data():
    """Get data formatted for Plotly treemap"""
    if scan_results is None:
        return jsonify({"error": "No results available"}), 404
    
    # Prune the data first to reduce size
    pruned_data = prune_scan_data(scan_results)
    
    # Convert scan results to treemap format
    treemap_data = convert_to_treemap_format(pruned_data)
    return jsonify(treemap_data)

def prune_scan_data(data, max_size_mb=5):
    """Prune scan data to reduce memory usage"""
    import json
    import copy
    
    # Create a copy to avoid modifying original
    pruned = copy.deepcopy(data)
    
    def prune_node(node, depth=0):
        # Remove very deep nesting
        if depth > 6:
            node["children"] = []
            return node
            
        # Keep only the largest children
        children = node.get("children", [])
        if children:
            children.sort(key=lambda x: x["size"], reverse=True)
            max_children = max(25 - depth * 3, 8)  # Fewer children at deeper levels
            node["children"] = children[:max_children]
            
            # Recursively prune children
            for child in node["children"]:
                prune_node(child, depth + 1)
        
        return node
    
    pruned = prune_node(pruned)
    
    # Check approximate size
    try:
        json_size = len(json.dumps(pruned)) / (1024 * 1024)  # Size in MB
        print(f"Treemap data size: {json_size:.2f} MB")
        
        # If still too large, be more aggressive
        if json_size > max_size_mb:
            print("Data still too large, applying aggressive pruning...")
            def aggressive_prune(node, depth=0):
                if depth > 4:
                    node["children"] = []
                else:
                    children = node.get("children", [])
                    if children:
                        max_children = max(15 - depth * 2, 5)
                        node["children"] = children[:max_children]
                        for child in node["children"]:
                            aggressive_prune(child, depth + 1)
                return node
            pruned = aggressive_prune(pruned)
    except:
        pass  # If size check fails, proceed anyway
    
    return pruned

def convert_to_treemap_format(data, max_nodes=300):
    """Convert scan results to Plotly treemap format with size limits"""
    labels = []
    parents = []
    values = []
    ids = []
    node_count = 0
    
    def add_node(node, parent_id="", depth=0):
        nonlocal node_count
        
        # Limit total nodes to prevent browser freeze
        if node_count >= max_nodes:
            return
            
        # Limit depth to prevent too much nesting
        if depth > 8:
            return
            
        node_id = f"{parent_id}/{node['name']}" if parent_id else node['name']
        
        labels.append(node['name'])
        parents.append(parent_id)
        values.append(node['size'])
        ids.append(node_id)
        node_count += 1
        
        # Sort children by size and only add the largest ones
        children = node.get('children', [])
        if children:
            children.sort(key=lambda x: x['size'], reverse=True)
            # Limit children based on depth - fewer children at deeper levels
            max_children = max(20 - depth * 2, 5)
            for child in children[:max_children]:
                if node_count >= max_nodes:
                    break
                add_node(child, node_id, depth + 1)
    
    add_node(data)
    
    print(f"Generated treemap with {node_count} nodes")
    
    return {
        "labels": labels,
        "parents": parents,
        "values": values,
        "ids": ids,
        "node_count": node_count
    }

@app.route('/discover_paths')
def discover_paths():
    """Discover available paths on the system for dropdown population"""
    try:
        import getpass
        username = getpass.getuser()
        
        paths = []
        

        
        # Discover user directories
        user_home = os.path.expanduser('~')
        common_user_dirs = [
            ('Downloads', 'Downloads'),
            ('Documents', 'Documents'),
            ('Desktop', 'Desktop'),
            ('Pictures', 'Pictures'),
            ('Music', 'Music'),
            ('Movies', 'Movies'),
            ('Library', 'Library'),
            ('Public', 'Public')
        ]
        
        for label, dirname in common_user_dirs:
            dir_path = os.path.join(user_home, dirname)
            if os.path.exists(dir_path) and os.path.isdir(dir_path):
                paths.append({
                    'label': f'{label} ({dirname})',
                    'path': dir_path,
                    'category': 'user'
                })
        
        # Add iCloud directory if it exists
        icloud_path = os.path.join(user_home, 'Library', 'Mobile Documents', 'com~apple~CloudDocs')
        if os.path.exists(icloud_path) and os.path.isdir(icloud_path):
            try:
                # Test if iCloud directory is readable
                os.listdir(icloud_path)
                paths.append({
                    'label': 'iCloud Drive',
                    'path': icloud_path,
                    'category': 'user'
                })
            except PermissionError:
                # Skip if we can't read it
                pass
        
        # Add home directory itself
        if os.path.exists(user_home):
            paths.append({
                'label': f'Home Directory ({username})',
                'path': user_home,
                'category': 'user'
            })
        
        # Discover common system directories (if they exist and are readable)
        system_dirs = [
            ('/', 'Root Directory (/)'),
            ('/Applications', 'Applications'),
            ('/System', 'System'),
            ('/Library', 'System Library'),
            ('/usr', 'Unix System Resources (/usr)'),
            ('/usr/local', 'Local Software (/usr/local)'),
            ('/opt', 'Optional Software (/opt)'),
            ('/var', 'Variable Data (/var)'),
            ('/var/log', 'System Logs (/var/log)'),
            ('/tmp', 'Temporary Files (/tmp)'),
            ('/private', 'Private System Files')
        ]
        
        for dir_path, label in system_dirs:
            if os.path.exists(dir_path) and os.path.isdir(dir_path):
                try:
                    # Test if directory is readable
                    os.listdir(dir_path)
                    paths.append({
                        'label': label,
                        'path': dir_path,
                        'category': 'system'
                    })
                except PermissionError:
                    # Skip directories we can't read
                    continue
        
        return jsonify({
            'success': True,
            'username': username,
            'paths': paths
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'username': 'user',
            'paths': [{
                'label': 'Downloads',
                'path': os.path.expanduser('~/Downloads'),
                'category': 'user'
            }]
        })

@app.route('/directory_info')
def get_directory_info():
    """Get detailed information about a specific directory"""
    path = request.args.get('path', '/')
    
    try:
        # Get directory contents with sizes
        contents = []
        total_size = 0
        
        if os.path.exists(path) and os.path.isdir(path):
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                try:
                    if os.path.isdir(item_path):
                        size = get_directory_size(item_path)
                        item_type = "directory"
                    else:
                        size = os.path.getsize(item_path)
                        item_type = "file"
                    
                    contents.append({
                        "name": item,
                        "size": size,
                        "size_formatted": format_size(size),
                        "type": item_type,
                        "path": item_path
                    })
                    total_size += size
                    
                except (OSError, PermissionError):
                    # Skip inaccessible items
                    continue
        
        # Sort by size (largest first)
        contents.sort(key=lambda x: x['size'], reverse=True)
        
        return jsonify({
            "path": path,
            "total_size": total_size,
            "total_size_formatted": format_size(total_size),
            "contents": contents
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def get_directory_size(path):
    """Calculate total size of a directory"""
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(path):
            for filename in filenames:
                try:
                    filepath = os.path.join(dirpath, filename)
                    total_size += os.path.getsize(filepath)
                except (OSError, PermissionError):
                    continue
    except (OSError, PermissionError):
        pass
    return total_size

def format_size(size_bytes):
    """Format bytes as human-readable string"""
    if size_bytes == 0:
        return "0 B"
    
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    unit_index = 0
    size = float(size_bytes)
    
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    
    return f"{size:.1f} {units[unit_index]}"

if __name__ == '__main__':
    import sys
    import socket
    
    # Default port (avoid macOS conflicts: 5000=AirPlay, 5001=System)
    port = 8080
    
    # Check for command line arguments
    if len(sys.argv) > 1:
        for arg in sys.argv[1:]:
            if arg.startswith('--port='):
                port = int(arg.split('=')[1])
            elif arg.startswith('--port'):
                port = int(sys.argv[sys.argv.index(arg) + 1])
    
    # Find available port if default is in use
    def find_available_port(start_port):
        for p in range(start_port, start_port + 50):
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex(('localhost', p))
                sock.close()
                if result != 0:  # Port is available
                    return p
            except:
                continue
        return None
    
    # Check if we're running on Replit (no port switching needed)
    if os.environ.get('REPLIT_ENVIRONMENT'):
        # On Replit, use port 5000 as expected by the platform
        port = 5000
    else:
        # For local development, try to use the specified port, fallback if needed
        if '--dev' in sys.argv:
            # Development mode - use dynamic ports
            available_port = find_available_port(port)
            if available_port != port:
                if available_port:
                    print(f"Port {port} is in use, using port {available_port} instead")
                    port = available_port
                else:
                    print(f"Could not find available port starting from {port}")
                    sys.exit(1)
        else:
            # Production mode - try the specific port first
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(1)
                result = sock.connect_ex(('localhost', port))
                sock.close()
                if result == 0:  # Port is in use
                    available_port = find_available_port(port + 1)
                    if available_port:
                        print(f"Port {port} is in use, using port {available_port} instead")
                        port = available_port
                    else:
                        print(f"Could not find available port starting from {port}")
                        sys.exit(1)
            except:
                pass  # Port check failed, proceed with original port
    
    print("Starting macOS Storage Visualization Tool...")
    print(f"Open your browser to http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
