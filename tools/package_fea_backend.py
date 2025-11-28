#!/usr/bin/env python3
"""
Package FEA backend code into a ZIP for AI agent tooling.

Creates dist/fea-backend.zip containing:
- server/app/** (all Python backend code)
- server/pyproject.toml
- server/requirements-fea.txt
- server/README.md
- docs/fea/** (backend documentation)

Excludes:
- .venv/, __pycache__/, *.pyc
- Large build artifacts
- .git/

Usage:
    python tools/package_fea_backend.py

Output:
    dist/fea-backend.zip (~500 KB)
"""

import os
import zipfile
from pathlib import Path
from typing import List

# Root directory of the repo
REPO_ROOT = Path(__file__).parent.parent

# Output directory
DIST_DIR = REPO_ROOT / "dist"
OUTPUT_ZIP = DIST_DIR / "fea-backend.zip"

# Patterns to include (relative to REPO_ROOT)
INCLUDE_PATTERNS: List[str] = [
    "server/app/**/*.py",
    "server/pyproject.toml",
    "server/requirements-fea.txt",
    "server/README.md",
    "server/pytest.ini",
    "server/Makefile",
    "docs/fea/**/*.md",
]

# Patterns to exclude
EXCLUDE_PATTERNS: List[str] = [
    "**/__pycache__/**",
    "**/*.pyc",
    "**/*.pyo",
    "**/.venv/**",
    "**/.pytest_cache/**",
    "**/.mypy_cache/**",
    "**/htmlcov/**",
    "**/*.egg-info/**",
]


def should_exclude(path: Path) -> bool:
    """Check if path matches any exclude pattern."""
    path_str = str(path)
    for pattern in EXCLUDE_PATTERNS:
        # Simple pattern matching for ** and *
        pattern_parts = pattern.split("/")
        if "**" in pattern_parts:
            # Recursive pattern
            if any(part in path_str for part in pattern_parts if part != "**"):
                return True
        elif "*" in pattern:
            # Wildcard pattern
            import fnmatch

            if fnmatch.fnmatch(path_str, pattern):
                return True
    return False


def find_files_to_package() -> List[Path]:
    """Find all files to include in the package."""
    files_to_include: List[Path] = []

    for pattern in INCLUDE_PATTERNS:
        # Convert pattern to Path glob
        if "**" in pattern:
            # Recursive glob
            pattern_path = Path(pattern.replace("**/*", ""))
            for file_path in REPO_ROOT.glob(pattern):
                if file_path.is_file() and not should_exclude(file_path):
                    files_to_include.append(file_path)
        else:
            # Simple glob
            for file_path in REPO_ROOT.glob(pattern):
                if file_path.is_file() and not should_exclude(file_path):
                    files_to_include.append(file_path)

    return files_to_include


def create_package():
    """Create the FEA backend package ZIP file."""
    print("🔧 FEA Backend Packager")
    print("=" * 60)
    print()

    # Create dist directory if it doesn't exist
    DIST_DIR.mkdir(exist_ok=True)

    # Find files to package
    print("📦 Finding files to package...")
    files = find_files_to_package()

    if not files:
        print("❌ No files found to package!")
        return

    print(f"✅ Found {len(files)} files")
    print()

    # Create ZIP file
    print(f"📝 Creating {OUTPUT_ZIP}...")
    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(files):
            # Get relative path for archive
            arcname = file_path.relative_to(REPO_ROOT)
            zf.write(file_path, arcname)
            print(f"   + {arcname}")

    # Get file size
    size_bytes = OUTPUT_ZIP.stat().st_size
    size_kb = size_bytes / 1024
    size_mb = size_kb / 1024

    print()
    print("=" * 60)
    print(f"✅ Package created successfully!")
    print(f"📦 Output: {OUTPUT_ZIP}")
    print(f"📊 Size: {size_kb:.1f} KB ({size_mb:.2f} MB)")
    print(f"📁 Files: {len(files)}")
    print()
    print("🚀 Ready to upload to AI agents (Claude, GPT-4, etc.)")
    print()


if __name__ == "__main__":
    create_package()
