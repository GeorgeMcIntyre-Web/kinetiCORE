#!/usr/bin/env python3
"""
KinetiCORE USD→GLB Converter Wrapper

Purpose: Delegate conversion to your production converter located outside this repo
without requiring you to manage environment variables. If the external script is
available, this wrapper launches it with the same arguments. Otherwise, it exits
with a clear error message.

Default external path it looks for:
  C:\\Users\\georgem\\source\\repos\\usd\\usd_to_glb_converter.py

Override via env var USDTOGLB_SCRIPT if needed.
"""

import os
import sys
import subprocess


def main() -> int:
    # 1) Env override
    script = os.getenv('USDTOGLB_SCRIPT')

    # 2) Default to your known path if not provided via env
    if not script:
        script = r"C:\\Users\\georgem\\source\\repos\\usd\\usd_to_glb_converter.py"

    # 3) Validate
    if not os.path.exists(script):
        sys.stderr.write(
            f"ERROR: External converter not found at: {script}\n"
            "Set USDTOGLB_SCRIPT env var to your converter script location, or place it there.\n"
        )
        return 2

    # 4) Delegate with same arguments (argv[1:])
    try:
        cmd = [sys.executable, script] + sys.argv[1:]
        result = subprocess.run(cmd, check=False)
        return result.returncode
    except Exception as e:
        sys.stderr.write(f"ERROR: Failed to run external converter: {e}\n")
        return 1


if __name__ == '__main__':
    raise SystemExit(main())



