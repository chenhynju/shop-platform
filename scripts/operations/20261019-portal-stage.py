import sys
if sys.argv[1:] != ['--execute']:
 raise SystemExit('Explicit --execute required for isolated portal restoration')
import subprocess, json, os, pathlib, urllib.parse
os.umask(0o077)
TAG='r20261019-portals-01'
def run(args, **kwargs):
 return subprocess.run(args, check=True, **kwargs)
def output(args):
 return subprocess.check_output(args, text=True).strip()
for image in ['api','web','migrate']:
 run(['docker','image','inspect',f'shop-platform-{image}:{TAG}'],stdout=subprocess.DEVNULL)
backup=pathlib.Path('/opt/shop-platform/backups/before-portals-20261019.dump')
if backup.exists():raise SystemExit('Backup already exists; inspect previous run before retry')
with backup.open('wb') as stream:run(['docker','exec','shop-platform-postgres-1','pg_dump','-U','postgres','-d','shop','-Fc'],stdout=stream)
assert backup.stat().st_size>0
run(['docker','exec','shop-test-postgres','createdb','-U','postgres','portal_stage_20261019'])
with backup.open('rb') as stream:run(['docker','exec','-i','shop-test-postgres','pg_restore','-U','postgres','-d','portal_stage_20261019','--no-owner','--no-privileges'],stdin=stream)
run(['docker','exec','shop-test-postgres','psql','-U','postgres','-d','portal_stage_20261019','-c','DELETE FROM "Session";'])
meta=json.loads(output(['docker','inspect','shop-test-postgres']))[0]
password=next(v.partition('=')[2] for v in meta['Config']['Env'] if v.startswith('POSTGRES_PASSWORD='))
pg_ip=meta['NetworkSettings']['Networks']['bridge']['IPAddress']
redis_ip=output(['docker','inspect','shop-portal-test-redis-20261019','--format','{{.NetworkSettings.Networks.bridge.IPAddress}}'])
url='postgresql://postgres:'+urllib.parse.quote(password,safe='')+'@'+pg_ip+':5432/portal_stage_20261019'
envfile=pathlib.Path('/opt/shop-platform/shared/portal-stage-20261019.env')
envfile.write_text('DATABASE_URL='+url+'\nREDIS_URL=redis://'+redis_ip+':6379\nNODE_ENV=production\nAPP_ORIGIN=https://shop.purelamp.uk\nTRUST_PROXY=172.16.0.0/12\n')
run(['docker','run','--rm','--network','bridge','--env-file',str(envfile),f'shop-platform-migrate:{TAG}'])
run(['docker','exec','shop-test-postgres','psql','-U','postgres','-d','portal_stage_20261019','-Atc','SELECT count(*) FROM "User"; SELECT count(*) FROM "Order"; SELECT count(*) FROM "Product";'])
run(['docker','run','-d','--name','shop-portal-stage-api-20261019','--network','bridge','--env-file',str(envfile),'-p','127.0.0.1:3284:3001','--memory','256m','--cpus','0.5','--security-opt','no-new-privileges:true','--cap-drop','ALL',f'shop-platform-api:{TAG}'])
run(['docker','run','-d','--name','shop-portal-stage-web-20261019','--network','bridge','-p','127.0.0.1:3283:3000','--memory','256m','--cpus','0.5','--security-opt','no-new-privileges:true','--cap-drop','ALL',f'shop-platform-web:{TAG}'])
site=pathlib.Path('/etc/caddy/sites-enabled/shop-platform.caddy')
saved=pathlib.Path('/opt/shop-platform/shared/reports/portal-caddy-before-20261019.caddy')
if saved.exists():raise SystemExit('Caddy backup exists; inspect before retry')
saved.write_bytes(site.read_bytes())
site.write_text('shop.purelamp.uk {\n encode zstd gzip\n header {\n  Strict-Transport-Security "max-age=31536000"\n  -Server\n }\n route {\n  @portal header X-Shop-Portal-Preview portals-r20261019\n  handle @portal {\n   handle /api/* {\n    reverse_proxy 127.0.0.1:3284\n   }\n   handle {\n    reverse_proxy 127.0.0.1:3283\n   }\n  }\n  handle /api/* {\n   reverse_proxy 127.0.0.1:3281\n  }\n  handle {\n   reverse_proxy 127.0.0.1:3280\n  }\n }\n}\n')
try:
 run(['caddy','validate','--config','/etc/caddy/Caddyfile'])
 run(['caddy','reload','--config','/etc/caddy/Caddyfile'])
except BaseException:
 site.write_bytes(saved.read_bytes()); run(['caddy','reload','--config','/etc/caddy/Caddyfile']);raise
print('RESTORE_AND_UPGRADE_OK; isolated portal preview started')
