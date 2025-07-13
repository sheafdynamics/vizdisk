"""
Filesystem Scanner Module
Efficiently scans directories and calculates sizes
"""

import os
import stat
import time
from pathlib import Path
from collections import defaultdict

class StorageScanner:
    def __init__(self, exclude_dirs=None, max_depth=None):
        """Initialize scanner with optional directory exclusions and depth limit"""
        self.exclude_dirs = set(exclude_dirs or [])
        # Only exclude virtual filesystems and container-specific paths
        # Don't exclude cache/temp directories - we'll check their sizes instead
        self.exclude_dirs.update({
            '/dev', '/proc', '/sys',  # Virtual filesystems
            '/.Spotlight-V100', '/.fseventsd', '/.Trashes',  # macOS metadata
            '/home/runner/.nix-defexpr', '/home/runner/.cache',  # Replit container dirs
            '/nix', '/mnt',  # Container-specific paths
            '/cores', '/var/vm',  # System swap/core files (these are usually huge but not useful)
            '/.DocumentRevisions-V100', '/.PKInstallSandboxManager'  # macOS system dirs
        })
        # Size-based exclusion thresholds
        self.size_check_threshold = 10 * 1024 * 1024  # 10MB threshold
        # Track processed inodes to avoid counting hardlinks multiple times
        self.processed_inodes = set()
        # Track the starting filesystem to avoid crossing mount points
        self.start_filesystem = None
        # Set depth limit for performance (None = unlimited)
        self.max_depth = max_depth
        # Add batch processing counter
        self.processed_count = 0
        self.batch_size = 100
        
    def scan_directory(self, root_path, progress_callback=None):
        """
        Scan directory tree and return hierarchical size data
        
        Args:
            root_path: Path to scan
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dictionary with hierarchical directory structure and sizes
        """
        root_path = os.path.abspath(root_path)
        
        if not os.path.exists(root_path):
            raise ValueError(f"Path does not exist: {root_path}")
            
        if not os.path.isdir(root_path):
            raise ValueError(f"Path is not a directory: {root_path}")
        
        # Reset tracking variables for this scan
        self.processed_inodes = set()
        
        # Get the filesystem of the starting directory to avoid crossing mount points
        try:
            start_stat = os.lstat(root_path)
            self.start_filesystem = start_stat.st_dev
            print(f"Starting scan on filesystem device: {self.start_filesystem}")
        except (OSError, PermissionError):
            self.start_filesystem = None
            
        print(f"Scanning: {root_path}")
        print(f"Excluded directories: {len(self.exclude_dirs)} patterns")
        
        # Count total items for progress tracking
        total_items = self._count_items(root_path)
        processed_items = 0
        
        def update_progress(current_path):
            nonlocal processed_items
            processed_items += 1
            if progress_callback:
                progress_callback(current_path, processed_items, total_items)
        
        # Scan the directory tree with depth 0 as starting point
        result = self._scan_recursive(root_path, update_progress, depth=0)
        
        # Validate results and log potential issues
        if result:
            total_size_gb = result['size'] / (1024**3)
            print(f"Scan complete: {result['name']}")
            print(f"Total size: {self.format_size(result['size'])} ({total_size_gb:.1f} GB)")
            print(f"Files: {result['file_count']}, Directories: {result['dir_count']}")
            print(f"Processed inodes: {len(self.processed_inodes)}")
            
            # Sanity check: warn if size seems unrealistic
            if total_size_gb > 2000:  # More than 2TB seems suspicious
                print(f"WARNING: Calculated size ({total_size_gb:.1f} GB) seems unusually large!")
                print("This might indicate symlinks, network mounts, or hardlink counting issues.")
        
        return result
    
    def _count_items(self, path):
        """Count total number of items to process"""
        # For performance, use a fast estimate rather than deep counting
        if path == '/':
            # Root scan - use a reasonable estimate to avoid long counting
            return 10000  # Estimate for progress bar
        
        count = 0
        try:
            if os.path.exists(path) and os.path.isdir(path):
                try:
                    entries = os.listdir(path)
                    count = len(entries) * 20  # Quick multiplier estimate
                except (OSError, PermissionError):
                    count = 1000  # Default estimate
            print(f"Estimated items to process: {count}")
        except (OSError, PermissionError):
            count = 1000  # Default estimate
        return max(count, 1)  # Avoid division by zero
    
    def _scan_recursive(self, path, progress_callback, depth=0):
        """Recursively scan directory and build tree structure"""
        path = os.path.abspath(path)
        
        # Check depth limit for performance
        if self.max_depth is not None and depth > self.max_depth:
            return None
        
        # Skip excluded directories (exact match or subdirectory)
        excluded_check = any(path == excluded or path.startswith(excluded + '/') for excluded in self.exclude_dirs)
        if excluded_check:
            print(f"Skipping excluded directory: {path}")
            return None
        
        # Smart exclusion: check if this looks like a cache/temp directory
        # but only exclude it if it's small (under 10MB)
        if self._is_cache_or_temp_dir(path):
            dir_size = self._quick_directory_size_check(path)
            if dir_size is not None and dir_size < self.size_check_threshold:
                print(f"Skipping small cache/temp directory ({self.format_size(dir_size)}): {path}")
                return None
            elif dir_size is not None and dir_size >= self.size_check_threshold:
                print(f"Including large cache/temp directory ({self.format_size(dir_size)}): {path}")
        
        # Batch processing to prevent browser hangs
        self.processed_count += 1
        if self.processed_count % self.batch_size == 0:
            time.sleep(0.01)  # Small pause every 100 items
        
        try:
            # Get directory stats using lstat to avoid following symlinks
            stat_info = os.lstat(path)
            if not stat.S_ISDIR(stat_info.st_mode):
                return None
            
            # Check if we're crossing filesystem boundaries (mount points)
            if self.start_filesystem is not None and stat_info.st_dev != self.start_filesystem:
                print(f"Skipping different filesystem: {path}")
                return None
            
            # Initialize directory node
            node = {
                "name": os.path.basename(path) or path,
                "path": path,
                "size": 0,
                "children": [],
                "file_count": 0,
                "dir_count": 0
            }
            
            # Process directory contents
            try:
                entries = os.listdir(path)
            except (OSError, PermissionError):
                progress_callback(path)
                return node
            
            for entry in entries:
                entry_path = os.path.join(path, entry)
                progress_callback(entry_path)
                
                try:
                    # Use lstat to avoid following symlinks
                    entry_stat = os.lstat(entry_path)
                    
                    # Skip symlinks entirely to avoid confusion
                    if stat.S_ISLNK(entry_stat.st_mode):
                        continue
                    
                    # Check if we're crossing filesystem boundaries
                    if self.start_filesystem is not None and entry_stat.st_dev != self.start_filesystem:
                        continue
                    
                    if stat.S_ISDIR(entry_stat.st_mode):
                        # Recursively scan subdirectory with incremented depth
                        child_node = self._scan_recursive(entry_path, progress_callback, depth + 1)
                        if child_node:
                            node["children"].append(child_node)
                            node["size"] += child_node["size"]
                            node["dir_count"] += 1
                    elif stat.S_ISREG(entry_stat.st_mode):
                        # Check for hardlinks to avoid double-counting
                        inode_key = (entry_stat.st_dev, entry_stat.st_ino)
                        if entry_stat.st_nlink > 1 and inode_key in self.processed_inodes:
                            # This is a hardlink to a file we've already counted
                            continue
                        
                        # Add to processed inodes if it has multiple links
                        if entry_stat.st_nlink > 1:
                            self.processed_inodes.add(inode_key)
                        
                        # Add file size
                        file_size = entry_stat.st_size
                        
                        # Debug very large files
                        if file_size > 10 * 1024**3:  # Files larger than 10GB
                            print(f"WARNING: Very large file detected: {entry_path} - {self.format_size(file_size)}")
                        
                        node["size"] += file_size
                        node["file_count"] += 1
                        
                        # Add file as leaf node if it's large enough
                        if file_size > 1024 * 1024:  # Files larger than 1MB
                            file_node = {
                                "name": entry,
                                "path": entry_path,
                                "size": file_size,
                                "children": [],
                                "file_count": 1,
                                "dir_count": 0,
                                "is_file": True
                            }
                            node["children"].append(file_node)
                        
                except (OSError, PermissionError):
                    # Skip inaccessible files/directories
                    continue
            
            # Sort children by size (largest first) and limit count
            node["children"].sort(key=lambda x: x["size"], reverse=True)
            
            # Limit children to prevent data explosion - keep only the largest
            max_children = 50  # Reasonable limit per directory
            if len(node["children"]) > max_children:
                total_size_kept = sum(child["size"] for child in node["children"][:max_children])
                remaining_size = node["size"] - total_size_kept
                
                # Add a summary node for remaining items if significant
                if remaining_size > 0 and len(node["children"]) > max_children:
                    remaining_count = len(node["children"]) - max_children
                    summary_node = {
                        "name": f"... {remaining_count} other items",
                        "path": f"{path}/...",
                        "size": remaining_size,
                        "children": [],
                        "file_count": 0,
                        "dir_count": 0,
                        "is_summary": True
                    }
                    node["children"] = node["children"][:max_children] + [summary_node]
                else:
                    node["children"] = node["children"][:max_children]
            
            return node
            
        except (OSError, PermissionError):
            progress_callback(path)
            return None
    
    def get_top_directories(self, scan_result, limit=20):
        """Get top directories by size"""
        if not scan_result:
            return []
        
        directories = []
        
        def collect_directories(node):
            if node and not node.get("is_file", False):
                directories.append({
                    "path": node["path"],
                    "name": node["name"],
                    "size": node["size"],
                    "file_count": node["file_count"],
                    "dir_count": node["dir_count"]
                })
                
                for child in node.get("children", []):
                    collect_directories(child)
        
        collect_directories(scan_result)
        
        # Sort by size and return top N
        directories.sort(key=lambda x: x["size"], reverse=True)
        return directories[:limit]
    
    def get_top_files(self, scan_result, limit=20):
        """Get top files by size"""
        if not scan_result:
            return []
        
        files = []
        
        def collect_files(node):
            if node and node.get("is_file", False):
                files.append({
                    "path": node["path"],
                    "name": node["name"],
                    "size": node["size"]
                })
            
            for child in node.get("children", []):
                collect_files(child)
        
        collect_files(scan_result)
        
        # Sort by size and return top N
        files.sort(key=lambda x: x["size"], reverse=True)
        return files[:limit]
    
    def _is_cache_or_temp_dir(self, path):
        """Check if a directory looks like a cache or temp directory"""
        cache_patterns = [
            '/var/folders', '/var/db', '/var/cache', '/tmp/',
            '/Library/Caches', '/System/Library/Caches', '/Library/Logs',
            '/usr/share', '/usr/lib', '/System/Volumes', '/System/Library/Extensions'
        ]
        return any(path.startswith(pattern) or pattern in path.lower() for pattern in cache_patterns)
    
    def _quick_directory_size_check(self, path):
        """Quickly estimate directory size without deep scanning"""
        try:
            total_size = 0
            item_count = 0
            max_items_to_check = 50  # Only check first 50 items for speed
            
            for entry in os.listdir(path):
                if item_count >= max_items_to_check:
                    break
                    
                entry_path = os.path.join(path, entry)
                try:
                    stat_info = os.lstat(entry_path)
                    if stat.S_ISREG(stat_info.st_mode):
                        total_size += stat_info.st_size
                    item_count += 1
                except (OSError, PermissionError):
                    continue
            
            # If we hit the limit, estimate the total by extrapolating
            if item_count >= max_items_to_check:
                try:
                    total_items = len(os.listdir(path))
                    if total_items > max_items_to_check:
                        total_size = total_size * (total_items / max_items_to_check)
                except (OSError, PermissionError):
                    pass
                    
            return total_size
            
        except (OSError, PermissionError):
            return None

    def format_size(self, size_bytes):
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
