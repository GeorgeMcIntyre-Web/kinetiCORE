# kinetiCORE Development Tools

Scripts for packaging and tooling FEA code for AI-assisted development.

## FEA Packaging Scripts

### `package_fea_backend.py`

Creates a ZIP of **backend-only** FEA code for AI agents working on server-side logic.

**Contents:**
- `server/app/**` - All Python backend code
- `server/pyproject.toml`, `requirements-fea.txt` - Dependencies
- `server/README.md`, `pytest.ini`, `Makefile` - Dev docs & configs
- `docs/fea/**` - FEA documentation

**Excludes:** `.venv/`, `__pycache__/`, `*.pyc`, build artifacts

**Usage:**
```bash
python tools/package_fea_backend.py
# Output: dist/fea-backend.zip (~500 KB)
```

**Use Case:**
> "I'm uploading the FEA backend to Claude to debug a Celery task issue."

---

### `package_fea_full.py`

Creates a ZIP of **full FEA stack** (backend + frontend service client + docs).

**Contents:**
- `server/**` - Backend code & tests
- `src/services/fea/**` - Frontend TypeScript client
- `docs/fea/**` - All FEA documentation

**Excludes:** `.venv/`, `node_modules/`, `__pycache__/`, build artifacts

**Usage:**
```bash
python tools/package_fea_full.py
# Output: dist/fea-full.zip (~1.5 MB)
```

**Use Case:**
> "I'm uploading the full FEA feature to GPT-4 to design a new results visualization panel."

---

## Package Characteristics

- **Idempotent:** Can run multiple times without side effects
- **Respects `.gitignore`:** Excludes ignored files where sensible
- **Logged Output:** Clearly shows what is included and sizes
- **Consistent:** Uses Python stdlib (zipfile, pathlib)

---

## Output

Both scripts create ZIPs in the `dist/` directory:

```
dist/
├── fea-backend.zip  (~500 KB)
└── fea-full.zip     (~1.5 MB)
```

---

## Uploading to AI Agents

### Claude (Projects)
1. Go to Projects → Your Project
2. Click "Add content" → "Upload files"
3. Select `dist/fea-backend.zip` or `dist/fea-full.zip`
4. Ask Claude to work on the FEA feature

### ChatGPT / GPT-4
1. Start a new conversation
2. Click attachment icon
3. Upload ZIP file
4. Provide context about what you need

### Cursor
1. Open workspace
2. Right-click in file explorer
3. Add folder/ZIP to workspace
4. Code with AI assistance

---

## When to Use Which Package

| Scenario | Package | Reason |
|----------|---------|--------|
| Debugging Celery tasks | `fea-backend.zip` | Backend-only context needed |
| Fixing Pydantic models | `fea-backend.zip` | Backend-only context |
| Adding new REST endpoints | `fea-backend.zip` | Backend-only changes |
| Designing results UI | `fea-full.zip` | Need frontend + backend understanding |
| End-to-end integration | `fea-full.zip` | Need full stack context |
| Documentation improvements | `fea-full.zip` | Docs reference both backend & frontend |

---

## Future Enhancements

Potential additions:

- **`package_fea_ui.py`:** Frontend UI components only (when UI is built)
- **`package_experiments.py`:** Experimental code (experiments/fea-beam/)
- **`check_package_size.py`:** Warn if packages exceed size limits
- **`validate_package.py`:** Check ZIPs contain expected files

---

## See Also

- **FEA Backend Docs:** [docs/fea/FEA_BACKEND_IMPLEMENTATION.md](../docs/fea/FEA_BACKEND_IMPLEMENTATION.md)
- **Quick Start:** [docs/fea/QUICKSTART_FE_BACKEND.md](../docs/fea/QUICKSTART_FE_BACKEND.md)
- **Backend README:** [server/README.md](../server/README.md)
- **Frontend Client:** [src/services/fea/README.md](../src/services/fea/README.md)
