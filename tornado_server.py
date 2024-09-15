import tornado.ioloop
import tornado.web
import tornado.gen
import asyncio
import requests

class GetHtmlHandler(tornado.web.RequestHandler):
    @tornado.gen.coroutine
    def get(self):
        url = self.get_argument('url')
        future = asyncio.Future()

        def fetch_html():
            try:
                response = requests.get(url)
                response.raise_for_status()
                future.set_result(response.text)
            except Exception as e:
                future.set_exception(e)

        tornado.ioloop.IOLoop.current().add_callback(fetch_html)

        try:
            html = yield tornado.gen.with_timeout(datetime.timedelta(milliseconds=5000), future)
            self.write(html)
        except tornado.gen.TimeoutError:
            self.set_status(504)
            self.write("Request timed out")
        except Exception as e:
            self.set_status(500)
            self.write(f"Error: {str(e)}")

def make_app():
    return tornado.web.Application([
        (r"/get_html", GetHtmlHandler),
    ])

if __name__ == "__main__":
    app = make_app()
    app.listen(8888)
    tornado.ioloop.IOLoop.current().start()
