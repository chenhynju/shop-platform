"""Create an allowlisted, secret-free source archive (Python 3 standard library)."""
import hashlib
import os
import pathlib
import sys
import tarfile

root = pathlib.Path(__file__).resolve().parent.parent
output = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.local/release.tgz').resolve()
output.parent.mkdir(parents=True, exist_ok=True)
excluded = {'node_modules', '.git', '.local', '.next', '.turbo', 'dist', 'coverage', 'playwright-report', 'playwright-pilot-report', 'test-results', '__pycache__'}
allowed = {'apps', 'packages', 'scripts', 'docs', 'docker', '.github', 'examples'}
root_files = {'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json', '.env.example', '.gitignore', '.dockerignore', '.npmrc', '.prettierrc', '.prettierignore', 'README.md', 'README.zh-CN.md', 'LICENSE', 'NOTICE'}
count = 0
with tarfile.open(output, 'w:gz') as archive:
    for directory, folders, filenames in os.walk(root):
        here = pathlib.Path(directory)
        folders[:] = [name for name in folders if name not in excluded and not (here / name).is_symlink() and (here != root or name in allowed)]
        for name in sorted(filenames):
            file = here / name
            relative = file.relative_to(root)
            if file.is_symlink() or (here == root and name not in root_files):
                continue
            if (name.startswith('.env') and name != '.env.example') or name.endswith(('.db', '.db-journal', '.db-shm', '.db-wal', '.zip', '.tgz', '.pem', '.key', '.pfx', '.p12', '.sqlite', '.sqlite3', '.bak', '.tsbuildinfo')):
                continue
            archive.add(file, arcname=relative.as_posix(), recursive=False)
            count += 1
digest = hashlib.sha256(output.read_bytes()).hexdigest()
output.with_suffix(output.suffix + '.sha256').write_text(digest + '  ' + output.name + '\n', encoding='utf-8')
print(f'Packaged {count} files; {output.stat().st_size} bytes; SHA256 {digest}')

