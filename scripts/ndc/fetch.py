import json, sys, urllib.request, os
I2 = "DZ EG LY MR MA TN BJ BF CV CI GM GH GN GW LR ML NE NG SN SL TG BI CM CF TD CG CD GQ GA ST KM DJ ER ET KE MG MU RW SC SO SS SD TZ UG AO BW SZ LS MW MZ NA ZA ZM ZW".split()
I3 = "DZA EGY LBY MRT MAR TUN BEN BFA CPV CIV GMB GHA GIN GNB LBR MLI NER NGA SEN SLE TGO BDI CMR CAF TCD COG COD GNQ GAB STP COM DJI ERI ETH KEN MDG MUS RWA SYC SOM SSD SDN TZA UGA AGO BWA SWZ LSO MWI MOZ NAM ZAF ZMB ZWE".split()
pairs = list(zip(I2, I3)) + [('UK', 'GBR'), ('US', 'USA'), ('EU', 'EUU')]
out = sys.argv[1]
for i2, i3 in pairs:
    p = os.path.join(out, i2 + '.json')
    if os.path.exists(p): continue
    rows, page = [], 1
    while True:
        url = f"https://www.climatewatchdata.org/api/v1/data/ndc_content?countries[]={i3}&per_page=1000&page={page}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        d = json.load(urllib.request.urlopen(req, timeout=60))
        rows += d['data']
        if len(d['data']) < 1000: break
        page += 1
    json.dump(rows, open(p, 'w', encoding='utf-8'))
    print(i2, len(rows), flush=True)
