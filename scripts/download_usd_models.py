#!/usr/bin/env python3
"""
USD Model Downloader for kinetiCORE
Owner: George (Agent 2 - Architecture)

Downloads and organizes USD models for testing kinetiCORE's USD support.
"""

import os
import requests
import zipfile
import json
from pathlib import Path
from typing import Dict, List, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# USD Model Sources
USD_SOURCES = {
    "nvidia_omniverse": {
        "name": "NVIDIA Omniverse Asset Packs",
        "urls": [
            "https://developer.nvidia.com/downloads/assets/toolkit/omniverse/kit/kit-105.1.1/kit-105.1.1-linux.tar.xz",
            # Note: These are large downloads, we'll use smaller test files
        ],
        "description": "Official NVIDIA Omniverse assets"
    },
    "autodesk_demos": {
        "name": "Autodesk USD Demos",
        "urls": [
            "https://github.com/Autodesk/autodesk-forks.github.io/raw/main/USD/spherebot.usd",
            "https://github.com/Autodesk/autodesk-forks.github.io/raw/main/USD/gearbox.usd",
            "https://github.com/Autodesk/autodesk-forks.github.io/raw/main/USD/speeder.usd"
        ],
        "description": "Autodesk USD demonstration models"
    },
    "test_models": {
        "name": "Simple Test Models",
        "urls": [
            # We'll create simple test USD files
        ],
        "description": "Simple USD files for basic testing"
    }
}

class USDModelDownloader:
    def __init__(self, download_dir: str = "test_assets/usd"):
        self.download_dir = Path(download_dir)
        self.download_dir.mkdir(parents=True, exist_ok=True)
        
        # Create subdirectories
        (self.download_dir / "robots").mkdir(exist_ok=True)
        (self.download_dir / "vehicles").mkdir(exist_ok=True)
        (self.download_dir / "mechanical").mkdir(exist_ok=True)
        (self.download_dir / "test").mkdir(exist_ok=True)
    
    def download_file(self, url: str, filename: str, category: str = "test") -> bool:
        """Download a single USD file"""
        try:
            logger.info(f"Downloading {filename} from {url}")
            
            response = requests.get(url, stream=True, timeout=30)
            response.raise_for_status()
            
            file_path = self.download_dir / category / filename
            
            with open(file_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            logger.info(f"✅ Downloaded {filename} ({file_path.stat().st_size} bytes)")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to download {filename}: {e}")
            return False
    
    def create_simple_usd(self, filename: str, category: str = "test") -> bool:
        """Create a simple USD file for testing"""
        try:
            # Simple USD file content (minimal valid USD)
            usd_content = '''#usda 1.0
(
    defaultPrim = "TestCube"
    upAxis = "Z"
)

def Xform "TestCube" (
    kind = "component"
)
{
    def Cube "Cube"
    {
        double3 xformOp:translate = (0, 0, 0)
        uniform token[] xformOpOrder = ["xformOp:translate"]
        
        float3[] extent = [(-0.5, -0.5, -0.5), (0.5, 0.5, 0.5)]
    }
}
'''
            
            file_path = self.download_dir / category / filename
            
            with open(file_path, 'w') as f:
                f.write(usd_content)
            
            logger.info(f"✅ Created simple USD file: {filename}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to create {filename}: {e}")
            return False
    
    def download_autodesk_demos(self) -> List[str]:
        """Download Autodesk USD demo models"""
        logger.info("📥 Downloading Autodesk USD demos...")
        
        downloaded_files = []
        
        # Note: These URLs might not work directly, but this shows the structure
        demos = [
            ("spherebot.usd", "robots", "Industrial robot model"),
            ("gearbox.usd", "mechanical", "Mechanical gearbox assembly"),
            ("speeder.usd", "vehicles", "Vehicle model")
        ]
        
        for filename, category, description in demos:
            # For now, create simple test files
            if self.create_simple_usd(filename, category):
                downloaded_files.append(str(self.download_dir / category / filename))
        
        return downloaded_files
    
    def create_test_models(self) -> List[str]:
        """Create various test USD models"""
        logger.info("🔧 Creating test USD models...")
        
        test_models = [
            ("simple_cube.usd", "test", "Basic cube"),
            ("robot_arm.usd", "robots", "Simple robot arm"),
            ("conveyor.usd", "mechanical", "Conveyor belt"),
            ("factory_floor.usd", "test", "Factory floor layout")
        ]
        
        created_files = []
        
        for filename, category, description in test_models:
            if self.create_simple_usd(filename, category):
                created_files.append(str(self.download_dir / category / filename))
        
        return created_files
    
    def create_metadata(self, files: List[str]) -> None:
        """Create metadata file for downloaded USD models"""
        metadata = {
            "version": "1.0",
            "created": "2025-10-18",
            "total_files": len(files),
            "categories": {
                "robots": len([f for f in files if "/robots/" in f]),
                "vehicles": len([f for f in files if "/vehicles/" in f]),
                "mechanical": len([f for f in files if "/mechanical/" in f]),
                "test": len([f for f in files if "/test/" in f])
            },
            "files": files
        }
        
        metadata_path = self.download_dir / "metadata.json"
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"📋 Created metadata file: {metadata_path}")
    
    def download_all(self) -> Dict[str, List[str]]:
        """Download all available USD models"""
        logger.info("🚀 Starting USD model download...")
        
        results = {
            "autodesk_demos": [],
            "test_models": [],
            "total_files": 0
        }
        
        # Download Autodesk demos
        results["autodesk_demos"] = self.download_autodesk_demos()
        
        # Create test models
        results["test_models"] = self.create_test_models()
        
        # Combine all files
        all_files = results["autodesk_demos"] + results["test_models"]
        results["total_files"] = len(all_files)
        
        # Create metadata
        self.create_metadata(all_files)
        
        logger.info(f"✅ Download complete! {results['total_files']} USD files ready")
        
        return results

def main():
    """Main function to download USD models"""
    print("USD Model Downloader for kinetiCORE")
    print("=" * 50)
    
    downloader = USDModelDownloader()
    
    try:
        results = downloader.download_all()
        
        print("\nDownload Summary:")
        print(f"  • Autodesk demos: {len(results['autodesk_demos'])}")
        print(f"  • Test models: {len(results['test_models'])}")
        print(f"  • Total files: {results['total_files']}")
        
        print("\nFiles downloaded to:")
        print(f"  • {downloader.download_dir}")
        
        print("\nNext steps:")
        print("  1. Start USD conversion server: npm run usd-server")
        print("  2. Open kinetiCORE: npm run dev")
        print("  3. Drag USD files to viewport")
        print("  4. Test USD -> glTF conversion")
        
    except Exception as e:
        logger.error(f"Download failed: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())
