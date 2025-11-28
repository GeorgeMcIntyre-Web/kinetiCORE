import tempfile
import os
import shutil
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)

class FileManager:
    def __init__(self, base_dir: str = None):
        self.base_dir = base_dir or tempfile.gettempdir()
        
    @contextmanager
    def create_temp_dir(self):
        """Create a secure temporary directory that is cleaned up on exit."""
        temp_dir = tempfile.mkdtemp(dir=self.base_dir)
        try:
            yield temp_dir
        finally:
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.error(f"Failed to cleanup temp dir {temp_dir}: {e}")

    def get_temp_file(self, suffix: str = "") -> str:
        """Get a path to a temp file (caller is responsible for cleanup)."""
        fd, path = tempfile.mkstemp(suffix=suffix, dir=self.base_dir)
        os.close(fd)
        return path
