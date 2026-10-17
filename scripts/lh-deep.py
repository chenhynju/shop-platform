# -*- coding: utf-8 -*-
# 深挖 Lighthouse 结果：LCP 元素、CLS 来源、阻塞资源
import json
import glob

path = sorted(glob.glob('docs/perf/lh-baseline-*.json'))[1]  # 中位数那次
with open(path, encoding='utf-8') as f:
    d = json.load(f)
audits = d['audits']

print('=== LCP 元素 ===')
lcp_el = audits.get('largest-contentful-paint-element')
if lcp_el and lcp_el.get('details'):
    for item in lcp_el['details'].get('items', [])[:5]:
        node = item.get('node', {})
        print('-', item.get('node', {}).get('snippet', '')[:150])
        for sub in item.get('items', [])[:6]:
            print('   phase:', sub.get('phase'), '=', sub.get('timing'), 'ms')

print('=== 布局偏移来源 ===')
ls = audits.get('layout-shifts')
if ls and ls.get('details'):
    for item in ls['details'].get('items', [])[:6]:
        print('- score', item.get('score'), '|', (item.get('node') or {}).get('snippet', '')[:120])

print('=== 渲染阻塞资源 ===')
rb = audits.get('render-blocking-insight')
if rb and rb.get('details'):
    for item in rb['details'].get('items', [])[:8]:
        print('-', (item.get('node') or {}).get('snippet', '')[:120], item.get('wastedMs'), 'ms')

print('=== 长任务 ===')
lt = audits.get('long-tasks')
if lt and lt.get('details'):
    for item in lt['details'].get('items', [])[:5]:
        print('-', item.get('duration'), 'ms', (item.get('url') or '')[-80:])

print('=== 网络请求 Top ===')
nr = audits.get('network-requests')
if nr and nr.get('details'):
    for item in nr['details'].get('items', [])[:12]:
        print('-', item.get('resourceType', '?'), str(item.get('transferSize', '?')), 'B', (item.get('url') or '')[-70:])
