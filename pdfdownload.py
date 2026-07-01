import os
import requests
from urllib.parse import unquote
from concurrent.futures import ThreadPoolExecutor

# ----------------------------
# Configuration
# ----------------------------
API = "https://oag.gov.np/api/front/local-level-report?page={}"

DOWNLOAD_DIR = os.path.join(
    os.path.expanduser("~"),
    "Desktop",
    "OAG_Local_Level_Reports"
)

os.makedirs(DOWNLOAD_DIR, exist_ok=True)

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0"
})


def download(pdf_url):
    try:
        filename = unquote(pdf_url.split("/")[-1])

        path = os.path.join(DOWNLOAD_DIR, filename)

        if os.path.exists(path):
            print("✓ Already exists:", filename)
            return

        r = session.get(pdf_url, timeout=60)

        if r.status_code == 200:
            with open(path, "wb") as f:
                f.write(r.content)

            print("Downloaded:", filename)

        else:
            print("Failed:", pdf_url)

    except Exception as e:
        print("Error:", pdf_url, e)


pdf_urls = []

print("Collecting PDF URLs...")

for page in range(1, 602):      # 601 pages

    print(f"Page {page}/601")

    data = session.get(API.format(page)).json()

    for report in data["reports"]["data"]:

        for file in report["files"]:

            if file["extension"].lower() == "pdf":
                pdf_urls.append(file["location"])

print(f"\nFound {len(pdf_urls)} PDFs.\n")

print("Downloading...\n")

with ThreadPoolExecutor(max_workers=10) as executor:
    executor.map(download, pdf_urls)

print("\nFinished!")
print(DOWNLOAD_DIR)