To host the Restorative Pathways catalog from your computer (so your phone can auto-load it over Wi‑Fi):

1) Copy these files into this folder:
   - master_restorative_pathways_node_index_v1_0.json
   - master_restorative_pathways_map_v1_0.csv (optional)
   - framework_guide.txt (recommended; enables in-app Guide + improves AI alignment)

2) Run the app on your computer and open it on your phone via Wi‑Fi, e.g.:
   http://192.168.68.116:5173/

3) The app will attempt to fetch:
   /rp/master_restorative_pathways_node_index_v1_0.json
   /rp/master_restorative_pathways_map_v1_0.csv
   /rp/framework_guide.txt

If fetching succeeds, the catalog is cached locally in IndexedDB and will keep working offline.

