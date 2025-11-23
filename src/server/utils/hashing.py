import xxhash
import os

def calculate_file_hash(file_path: str, chunk_size: int = 8192) -> str:
    """Calculate XXHash64 of a file for caching purposes."""
    hasher = xxhash.xxh64()
    with open(file_path, 'rb') as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    return hasher.hexdigest()

def get_cache_path(cache_dir: str, file_hash: str, extension: str) -> str:
    """Get the path to a cached file."""
    return os.path.join(cache_dir, f"{file_hash}{extension}")
