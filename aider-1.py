# -*- coding: utf-8 -*-
import re
import sys
import os
import urllib
from aider.main import main
from aider.scrape import Scraper

old_scape = Scraper.scrape

def scrape(self, url):
    scraper = os.environ.get("chrome_plugin_scraper")
    if scraper:
        print(f"{scraper}?url={urllib.parse.quote(url)}")
        content, mime_type = self.scrape_with_httpx(f"{scraper}?url={urllib.parse.quote(url)}")

    elif  self.playwright_available:
        content, mime_type = self.scrape_with_playwright(url)
    else:
        content, mime_type = self.scrape_with_httpx(url)

    if not content:
        self.print_error(f"Failed to retrieve content from {url}")
        return None

    # Check if the content is HTML based on MIME type or content
    if (mime_type and mime_type.startswith("text/html")) or (
        mime_type is None and self.looks_like_html(content)
    ):
        self.try_pandoc()
        content = self.html_to_markdown(content)

    return content

Scraper.scrape = scrape

if __name__ == '__main__':
    sys.argv[0] = re.sub(r'(-script\.pyw|\.exe)?$', '', sys.argv[0])
    sys.exit(main())


