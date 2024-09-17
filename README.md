# aider browser helper
Aider's default setup uses Playwright to load web pages, running in headless mode. This means that even if a window is displayed, it quickly closes, making it impossible to access pages that require login or those that need a CAPTCHA to be entered.


## Usage 
load `plugin` into chrome extension, then open extension://${extension_id}/index.html   
`python tornado_server.py` Relay communication between the browser and aider , and after the plugin connects, you can see the log output.  
`chrome_plugin_scraper=http://127.0.0.1:8888/get_html python aider-1.py` run patched aider, use this helper   
in aider, use /web https://www.google.com to test if this plugin works,  you will see the url in the previous tab of index.html    



