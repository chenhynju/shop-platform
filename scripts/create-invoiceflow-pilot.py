"""Copy source only, then apply a bounded i18n adoption adapter. Never modifies source."""
import pathlib,sys,os,shutil,json,re,hashlib
root=pathlib.Path(__file__).resolve().parent.parent
source=pathlib.Path(sys.argv[1]).resolve()
target=pathlib.Path(sys.argv[2]).resolve()
if target.exists() or source==target or source in target.parents or target in source.parents:
    raise SystemExit('Destination must be new and outside the original project')
core=root/'packages/i18n'
if not (core/'dist/index.js').is_file():raise SystemExit('Build @toolkit/i18n first')
excluded={'node_modules','.git','.local','.test-runs','.pilot-data','.next','.turbo','dist','generated','coverage','artifacts','data','uploads','storage','test-results','playwright-report','playwright-pilot-report','__pycache__'}
allowed={'apps','packages','scripts','docs','public'}
rootfiles={'package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','tsconfig.base.json','README.md','.gitignore','.prettierrc','.prettierignore'}
hashes={}
for directory,folders,files in os.walk(source):
    here=pathlib.Path(directory)
    in_source='src' in here.relative_to(source).parts
    folders[:]=[f for f in folders if (f not in excluded or (in_source and f in {'data','uploads','storage'})) and not (here/f).is_symlink() and (here!=source or f in allowed)]
    for name in files:
        original=here/name;relative=original.relative_to(source)
        if original.is_symlink() or (here==source and name not in rootfiles):continue
        if name.startswith('.env') or name.endswith(('.db','.db-shm','.db-wal','.db-journal','.sqlite','.sqlite3','.pem','.key','.p12','.pfx','.zip','.tgz','.log','.tsbuildinfo','.pdf','.png','.jpg','.jpeg','.node','.dll','.exe','.so')):continue
        destination=target/relative;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(original,destination)
        hashes[relative.as_posix()]=hashlib.sha256(original.read_bytes()).hexdigest()
vendor=target/'vendor/toolkit-i18n';vendor.mkdir(parents=True)
shutil.copytree(core/'dist',vendor/'dist')
coremeta=json.loads((core/'package.json').read_text())
(vendor/'package.json').write_text(json.dumps({k:coremeta[k] for k in ['name','version','type','exports']},indent=2)+'\n')
web=target/'apps/web/package.json';meta=json.loads(web.read_text());meta['dependencies']['@toolkit/i18n']='file:../../vendor/toolkit-i18n';web.write_text(json.dumps(meta,indent=2)+'\n')
catalog=json.loads((root/'examples/invoiceflow/messages.json').read_text(encoding='utf-8'))
reverse={value:key for key,value in catalog.items()}
def literal_en(part,render):
    def replace(m):
        value=m.group(2)
        if value not in reverse:return m.group(0)
        quoted=json.dumps(reverse[value],ensure_ascii=False)
        return 't('+quoted+')' if render else quoted
    return re.sub(r'''(?<!=)(['"])([^'"\n]*)\1''',replace,part)
def rendered(part):
    part=literal_en(part,True)
    for chinese,english in sorted(reverse.items(),key=lambda item:len(item[0]),reverse=True):
        quote=json.dumps(english,ensure_ascii=False)
        part=re.sub(r'>(\s*)'+re.escape(chinese).replace(r'\ ',r'\s+')+r'(\s*)(?=[<{])',lambda m:'>'+m.group(1)+'{t('+quote+')}'+m.group(2),part)
        for attr in ['aria-label','placeholder','title']:
            part=part.replace(attr+'="'+chinese+'"',attr+'={t('+quote+')}')
    return part
for filename,function in [('app/login/page.tsx','LoginPage'),('app/workspace/page.tsx','WorkspacePage'),('components/saas-shell.tsx','SaasShell'),('app/upload/page.tsx','UploadPage')]:
    path=target/'apps/web/src'/filename;text=path.read_text(encoding='utf-8')
    imports="'use client';\nimport { usePilotLocale } from '@/components/pilot-locale';"+("\nimport { formatDate } from '@toolkit/i18n';" if function=='WorkspacePage' else '')
    text=text.replace("'use client';",imports,1)
    signature=re.search(r'(export (?:default )?function '+function+r'\([^\n]*?\) \{)',text)
    if not signature:raise SystemExit('Unsupported source component: '+filename)
    hook="\n  const { locale, t } = usePilotLocale();" if function=='WorkspacePage' else "\n  const { t } = usePilotLocale();"
    text=text[:signature.end()]+hook+text[signature.end():]
    # Translate render fragments only; state stores stable English source keys.
    if function=='SaasShell':
        boundary=text.index("  if (pathname === '/login') return")
    else:boundary=text.index('  return ' if function in ['LoginPage','WorkspacePage'] else '  return (')
    text=literal_en(text[:boundary],False)+rendered(text[boundary:])
    text=text.replace('{label}', '{t(label)}').replace('{error}', '{t(error)}')
    text=text.replace("{error || t(\"Opening your workspace…\")}","{t(error || 'Opening your workspace…')}")
    text=text.replace('aria-label={`${m.user.name}的角色`}',"aria-label={t('Role for {name}', { name: m.user.name })}")
    text=text.replace('Starter · 最多保存 {usage.organization.documentLimit} 份文档 / {usage.organization.memberLimit} 名有效成员',"{t('Starter · up to {documents} documents / {members} active members', { documents: usage.organization.documentLimit, members: usage.organization.memberLimit })}")
    text=text.replace('{new Date(event.createdAt).toLocaleString()}',"{formatDate(event.createdAt, locale, { dateStyle: 'medium', timeStyle: 'short' })}")
    path.write_text(text,encoding='utf-8')
components=target/'apps/web/src/components'
shutil.copy2(root/'examples/invoiceflow/pilot-locale.tsx',components/'pilot-locale.tsx')
shutil.copy2(root/'examples/invoiceflow/messages.json',components/'pilot-messages.json')
layout=target/'apps/web/src/app/layout.tsx';text=layout.read_text(encoding='utf-8')
text=text.replace("import { Inter } from 'next/font/google';", "import { cookies } from 'next/headers';\nimport { localeCookie, resolveLocale } from '@toolkit/i18n';\nimport { PilotLocaleProvider } from '@/components/pilot-locale';")
text=re.sub(r"const inter = Inter\([^\n]+\);",'',text)
text=text.replace('export default function RootLayout','export default async function RootLayout')
text=text.replace('  return (',"  const locale = resolveLocale((await cookies()).get(localeCookie)?.value);\n  return (",1)
text=text.replace('<html lang="zh-CN" className={inter.variable}>','<html lang={locale}>')
text=text.replace('<body className="min-h-screen bg-background font-sans antialiased">','<body className="min-h-screen bg-background font-sans antialiased"><PilotLocaleProvider initialLocale={locale}>')
text=text.replace('</body>','</PilotLocaleProvider></body>')
layout.write_text(text,encoding='utf-8')
nextconfig=target/'apps/web/next.config.js';text=nextconfig.read_text(encoding='utf-8');text=text.replace('  reactStrictMode: true,',"  reactStrictMode: true,\n  outputFileTracingRoot: require('node:path').resolve(__dirname, '../..'),\n  experimental: { cpus: 1 },");nextconfig.write_text(text,encoding='utf-8')
regression=target/'scripts/saas-integration.cjs';text=regression.read_text(encoding='utf-8');text=text.replace('const headers={...extra};',"const headers={...(process.env.API_ACCESS_KEY?{'x-api-key':process.env.API_ACCESS_KEY}:{}),...extra};");regression.write_text(text,encoding='utf-8')
ignore=target/'.gitignore';existing=ignore.read_text(encoding='utf-8') if ignore.exists() else '';ignore.write_text(existing+'\n# Isolated adoption pilot data and credentials\n.pilot-data/\n.env\n.env.*\nnode_modules/\ngenerated/\nplaywright-pilot-report/\n',encoding='utf-8')
(target/'pilot-source-manifest.json').write_text(json.dumps({'source':str(source),'sourceHashes':hashes,'coreSha256':hashlib.sha256((core/'dist/index.js').read_bytes()).hexdigest(),'scope':'English-first account, organization and upload interface; existing NestJS tenant/business logic unchanged'},indent=2),encoding='utf-8')
print('Created isolated source-only InvoiceFlow pilot with '+str(len(hashes))+' source files; original project untouched')
