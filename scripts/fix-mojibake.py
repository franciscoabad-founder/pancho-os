"""Repara UTF-8 doble-codificado (mojibake) en el arbol de src/.

La migracion al repo standalone re-codifico los archivos: bytes UTF-8 leidos
como cp1252 y re-guardados como UTF-8 ('invalido' -> 'invÃ¡lido'). La
reparacion invierte eso linea por linea: solo toca lineas con marcadores de
mojibake y deja intactas las lineas con Unicode legitimo (flechas, emoji),
que no sobreviven un encode cp1252.

Uso: python scripts/fix-mojibake.py [--check]
"""
import re
import sys
from pathlib import Path

MARKER = re.compile(r"Ã.|Â.|â€.")
check_only = "--check" in sys.argv

repaired_files = 0
repaired_lines = 0
leftovers = []

for path in sorted(Path("src").rglob("*")):
    if path.suffix not in {".ts", ".tsx", ".astro", ".css", ".md", ".mjs", ".sql"}:
        continue
    raw = path.read_text(encoding="utf-8")
    out_lines = []
    touched = 0
    for line in raw.splitlines(keepends=True):
        if MARKER.search(line):
            try:
                fixed = line.encode("cp1252").decode("utf-8")
                if not MARKER.search(fixed):
                    out_lines.append(fixed)
                    touched += 1
                    continue
            except (UnicodeEncodeError, UnicodeDecodeError):
                pass
            leftovers.append(f"{path}: {line.strip()[:80]}")
        out_lines.append(line)
    if touched:
        repaired_files += 1
        repaired_lines += touched
        if not check_only:
            path.write_text("".join(out_lines), encoding="utf-8", newline="")

print(f"archivos reparados: {repaired_files} | lineas: {repaired_lines}")
if leftovers:
    print("NO REPARADAS (revisar a mano):")
    print("\n".join(leftovers[:20]))
    sys.exit(1)
