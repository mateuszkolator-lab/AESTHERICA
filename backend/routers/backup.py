from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
import os
import re
import io
import json
import asyncio
import zipfile
import tempfile
from datetime import datetime, timezone

from models.database import get_db
from routers.auth import verify_token

router = APIRouter(prefix="/backup", tags=["Backup"])

BACKUP_DIR = os.environ.get("BACKUP_DIR")
BACKUP_KEEP = int(os.environ.get("BACKUP_KEEP", "14"))
FILE_RE = re.compile(r"^aestheticamd_\d{4}-\d{2}-\d{2}(_\d{6})?\.zip$")

def require_admin(authorization: str = Header(None)):
    user = verify_token(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def build_backup_bytes() -> bytes:
    db = get_db()
    names = await db.list_collection_names()
    buf = io.BytesIO()
    meta = {"db": os.environ.get("DB_NAME"), "created_at": datetime.now(timezone.utc).isoformat(), "collections": {}}
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name in sorted(names):
            docs = await db[name].find({}, {"_id": 0}).to_list(None)
            meta["collections"][name] = len(docs)
            zf.writestr(f"{name}.json", json.dumps(docs, ensure_ascii=False, default=str))
        zf.writestr("meta.json", json.dumps(meta, ensure_ascii=False, indent=2))
    return buf.getvalue()

def _file_info(path: str) -> dict:
    st = os.stat(path)
    return {
        "name": os.path.basename(path),
        "size": st.st_size,
        "created_at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat()
    }

def list_backups() -> list:
    if not BACKUP_DIR or not os.path.isdir(BACKUP_DIR):
        return []
    files = [os.path.join(BACKUP_DIR, f) for f in os.listdir(BACKUP_DIR) if FILE_RE.match(f)]
    files.sort(key=os.path.getmtime, reverse=True)
    return [_file_info(f) for f in files]

def prune_backups():
    for info in list_backups()[BACKUP_KEEP:]:
        try:
            os.remove(os.path.join(BACKUP_DIR, info["name"]))
        except OSError:
            pass

async def create_backup_file(with_time: bool = True) -> dict:
    if not BACKUP_DIR:
        raise HTTPException(status_code=400, detail="BACKUP_DIR nie jest skonfigurowany na serwerze")
    os.makedirs(BACKUP_DIR, exist_ok=True)
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y-%m-%d_%H%M%S") if with_time else now.strftime("%Y-%m-%d")
    path = os.path.join(BACKUP_DIR, f"aestheticamd_{stamp}.zip")
    data = await build_backup_bytes()
    await asyncio.to_thread(_write_file, path, data)
    prune_backups()
    return _file_info(path)

def _write_file(path: str, data: bytes):
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, path)

def has_backup_for_today() -> bool:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return any(b["name"].startswith(f"aestheticamd_{today}") for b in list_backups())

async def backup_scheduler():
    """Daily automatic backup: checks hourly, creates one backup per day."""
    if not BACKUP_DIR:
        return
    while True:
        try:
            if not has_backup_for_today():
                info = await create_backup_file(with_time=False)
                print(f"[backup] Auto backup created: {info['name']} ({info['size']} B)")
        except Exception as e:
            print(f"[backup] Auto backup failed: {e}")
        await asyncio.sleep(3600)

@router.get("/status")
async def backup_status(user: dict = Depends(require_admin)):
    backups = list_backups()
    return {
        "auto_enabled": bool(BACKUP_DIR),
        "dir": BACKUP_DIR,
        "keep": BACKUP_KEEP,
        "last_backup": backups[0] if backups else None,
        "backups": backups
    }

@router.post("/run")
async def run_backup(user: dict = Depends(require_admin)):
    return await create_backup_file(with_time=True)

@router.get("/download")
async def download_backup(user: dict = Depends(require_admin)):
    """Build a fresh backup and stream it to the browser."""
    data = await build_backup_bytes()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    tmp.write(data)
    tmp.close()
    filename = f"aestheticamd_{datetime.now(timezone.utc).strftime('%Y-%m-%d_%H%M%S')}.zip"
    return FileResponse(tmp.name, media_type="application/zip", filename=filename, background=BackgroundTask(os.remove, tmp.name))

@router.get("/files/{name}")
async def download_backup_file(name: str, user: dict = Depends(require_admin)):
    if not BACKUP_DIR or not FILE_RE.match(name):
        raise HTTPException(status_code=404, detail="Backup not found")
    path = os.path.join(BACKUP_DIR, name)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Backup not found")
    return FileResponse(path, media_type="application/zip", filename=name)

@router.delete("/files/{name}")
async def delete_backup_file(name: str, user: dict = Depends(require_admin)):
    if not BACKUP_DIR or not FILE_RE.match(name):
        raise HTTPException(status_code=404, detail="Backup not found")
    path = os.path.join(BACKUP_DIR, name)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Backup not found")
    os.remove(path)
    return {"message": "Backup deleted"}
