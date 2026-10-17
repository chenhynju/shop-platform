# -*- coding: utf-8 -*-
# 从 Lighthouse JSON 提取性能指标（在仓库根目录运行）
import json
import glob
import os

for path in sorted(glob.glob('docs/perf/lh-baseline-*.json')):
    try:
        with open(path, encoding='utf-8') as f:
            d = json.load(f)
        score = d['categories']['performance']['score']
        audits = d['audits']

        def val(key):
            a = audits.get(key)
            if a and a.get('numericValue') is not None:
                return a['numericValue']
            return None

        lcp = val('largest-contentful-paint')
        fcp = val('first-contentful-paint')
        cls = val('cumulative-layout-shift')
        inp = val('interaction-to-next-paint')
        tbt = val('total-blocking-time')
        tti = val('interactive')

        def fmt(v, scale, unit):
            return 'n/a' if v is None else f'{v/scale:.2f}{unit}'

        print(
            f"{os.path.basename(path)}: score={score*100:.0f} "
            f"LCP={fmt(lcp,1000,'s')} FCP={fmt(fcp,1000,'s')} "
            f"CLS={fmt(cls,1,'')} INP={fmt(inp,1,'ms')} "
            f"TBT={fmt(tbt,1,'ms')} TTI={fmt(tti,1000,'s')}"
        )
    except Exception as exc:
        print(f"{os.path.basename(path)}: ERROR {exc}")
